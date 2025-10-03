import { config } from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';

config();

/**
 * Script para corregir warehouse IDs usando warehouses default de cada país
 *
 * ACCIONES:
 * 1. Identificar warehouse default de cada país (aunque esté inactivo)
 * 2. Actualizar productos con warehouse ID incorrecto para usar el default
 * 3. Re-generar métricas de warehouse
 */

async function fixWarehouseData() {
  console.log('🔧 CORRIGIENDO DATOS DE WAREHOUSE\n');

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ Error: MONGO_URI no está definido en .env');
    return;
  }

  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    console.log('✅ Conectado a MongoDB\n');

    const firstPlugDb = client.db('firstPlug');
    const globalProductsCollection = firstPlugDb.collection('global_products');
    const warehousesCollection = firstPlugDb.collection('warehouses');
    const warehouseMetricsCollection =
      firstPlugDb.collection('warehouse_metrics');
    const tenantsCollection = firstPlugDb.collection('tenants');

    // ==================== PASO 1: OBTENER WAREHOUSES DEFAULT POR PAÍS ====================
    console.log('📍 PASO 1: IDENTIFICAR WAREHOUSES DEFAULT\n');

    // Obtener todos los países con warehouses
    const allCountries = await warehousesCollection.find({}).toArray();

    const defaultWarehouses = new Map<string, any>();

    for (const countryDoc of allCountries) {
      if (countryDoc.warehouses && countryDoc.warehouses.length > 0) {
        // Tomar el primer warehouse (default) de cada país
        const defaultWarehouse = countryDoc.warehouses[0];
        defaultWarehouses.set(countryDoc.countryCode, {
          id: defaultWarehouse._id,
          name:
            defaultWarehouse.name ||
            `Default Warehouse ${countryDoc.countryCode}`,
          countryCode: countryDoc.countryCode,
          country: countryDoc.country,
        });
        console.log(
          `✅ ${countryDoc.countryCode}: ${defaultWarehouse._id} (${defaultWarehouse.name || 'Sin nombre'})`,
        );
      }
    }
    console.log('');

    // ==================== PASO 2: CORREGIR IDs DE PRODUCTOS ====================
    console.log('📦 PASO 2: CORREGIR WAREHOUSE IDs EN PRODUCTOS\n');

    // Obtener todos los productos en warehouses
    const allProductsInWarehouses = await globalProductsCollection
      .find({
        inFpWarehouse: true,
        'fpWarehouse.warehouseId': { $exists: true },
        isDeleted: { $ne: true },
      })
      .toArray();

    console.log(
      `📦 Total productos en warehouses: ${allProductsInWarehouses.length}\n`,
    );

    let totalUpdated = 0;
    const updatesByCountry = new Map<string, number>();

    // Agrupar productos por warehouse ID actual
    const productsByWarehouse = new Map<string, any[]>();

    for (const product of allProductsInWarehouses) {
      const warehouseIdStr = product.fpWarehouse.warehouseId.toString();
      if (!productsByWarehouse.has(warehouseIdStr)) {
        productsByWarehouse.set(warehouseIdStr, []);
      }
      productsByWarehouse.get(warehouseIdStr)!.push(product);
    }

    // Verificar cada warehouse y corregir si es necesario
    for (const [warehouseIdStr, products] of productsByWarehouse.entries()) {
      const warehouseId = new ObjectId(warehouseIdStr);
      const countryCode = products[0].fpWarehouse.warehouseCountryCode;

      console.log(
        `🔍 Verificando warehouse ${warehouseIdStr} (${countryCode})`,
      );
      console.log(`   Productos: ${products.length}`);

      // Verificar si este warehouse existe en la DB
      const warehouseExists = await warehousesCollection.findOne({
        'warehouses._id': warehouseId,
      });

      if (warehouseExists) {
        console.log(`   ✅ Warehouse existe, no requiere corrección\n`);
        continue;
      }

      // Warehouse no existe, usar el default del país
      console.log(`   ⚠️  Warehouse NO existe en DB`);

      const defaultWarehouse = defaultWarehouses.get(countryCode);

      if (!defaultWarehouse) {
        console.log(
          `   ❌ No se encontró warehouse default para ${countryCode}, saltando...\n`,
        );
        continue;
      }

      console.log(
        `   🔄 Corrigiendo a warehouse default: ${defaultWarehouse.id}`,
      );

      const updateResult = await globalProductsCollection.updateMany(
        {
          'fpWarehouse.warehouseId': warehouseId,
        },
        {
          $set: {
            'fpWarehouse.warehouseId': defaultWarehouse.id,
            'fpWarehouse.warehouseName': defaultWarehouse.name,
          },
        },
      );

      console.log(
        `   ✅ ${updateResult.modifiedCount} productos actualizados\n`,
      );
      totalUpdated += updateResult.modifiedCount;
      updatesByCountry.set(
        countryCode,
        (updatesByCountry.get(countryCode) || 0) + updateResult.modifiedCount,
      );
    }

    console.log(`✅ Total productos actualizados: ${totalUpdated}`);
    if (updatesByCountry.size > 0) {
      console.log('   Por país:');
      for (const [country, count] of updatesByCountry.entries()) {
        console.log(`   - ${country}: ${count} productos`);
      }
    }
    console.log('');

    // ==================== PASO 3: RE-GENERAR MÉTRICAS ====================
    console.log('📊 PASO 3: RE-GENERAR MÉTRICAS DE WAREHOUSE\n');

    // Limpiar métricas existentes
    await warehouseMetricsCollection.deleteMany({});
    console.log('🗑️  Métricas anteriores eliminadas\n');

    // Obtener todos los productos en warehouses
    const productsInWarehouses = await globalProductsCollection
      .find({
        inFpWarehouse: true,
        'fpWarehouse.warehouseId': { $exists: true },
        isDeleted: { $ne: true },
      })
      .toArray();

    console.log(`📦 Productos en warehouses: ${productsInWarehouses.length}\n`);

    // Agrupar por warehouse
    const warehouseMap = new Map<string, any[]>();

    for (const product of productsInWarehouses) {
      const warehouseIdStr = product.fpWarehouse.warehouseId.toString();
      if (!warehouseMap.has(warehouseIdStr)) {
        warehouseMap.set(warehouseIdStr, []);
      }
      warehouseMap.get(warehouseIdStr)!.push(product);
    }

    console.log(`🏭 Warehouses únicos: ${warehouseMap.size}\n`);

    // Generar métricas para cada warehouse
    let metricsCreated = 0;

    for (const [warehouseIdStr, products] of warehouseMap.entries()) {
      const warehouseId = new ObjectId(warehouseIdStr);

      console.log(`🏭 Procesando warehouse: ${warehouseIdStr}`);
      console.log(`   Productos: ${products.length}`);

      // Buscar información del warehouse
      const warehouseDoc = await warehousesCollection.findOne({
        'warehouses._id': warehouseId,
      });

      if (!warehouseDoc) {
        console.log(`   ❌ Warehouse no encontrado en DB\n`);
        continue;
      }

      const warehouse = warehouseDoc.warehouses.find(
        (wh: any) => wh._id.toString() === warehouseIdStr,
      );

      if (!warehouse) {
        console.log(`   ❌ Warehouse no encontrado en array\n`);
        continue;
      }

      // Agrupar productos por tenant
      const tenantMap = new Map<string, any>();

      for (const product of products) {
        const tenantIdStr = product.tenantId.toString();

        if (!tenantMap.has(tenantIdStr)) {
          tenantMap.set(tenantIdStr, {
            tenantId: product.tenantId,
            tenantName: product.tenantName,
            companyName: product.tenantName, // Temporal
            computers: 0,
            otherProducts: 0,
            totalProducts: 0,
          });
        }

        const tenantMetrics = tenantMap.get(tenantIdStr)!;
        tenantMetrics.totalProducts++;
        if (product.isComputer) {
          tenantMetrics.computers++;
        } else {
          tenantMetrics.otherProducts++;
        }
      }

      // Obtener companyName real de cada tenant
      for (const [tenantIdStr, metrics] of tenantMap.entries()) {
        const tenant = await tenantsCollection.findOne({
          _id: new ObjectId(tenantIdStr),
        });
        if (tenant) {
          metrics.companyName = tenant.name || tenant.tenantName;
        }
      }

      // Calcular totales
      const totalProducts = products.length;
      const totalComputers = products.filter((p) => p.isComputer).length;
      const totalOtherProducts = totalProducts - totalComputers;
      const totalTenants = tenantMap.size;

      // Preparar array de tenantMetrics
      const tenantMetrics = Array.from(tenantMap.values()).map((tm) => ({
        tenantId: tm.tenantId,
        tenantName: tm.tenantName,
        companyName: tm.companyName,
        totalProducts: tm.totalProducts,
        computers: tm.computers,
        otherProducts: tm.otherProducts,
        lastUpdated: new Date(),
      }));

      // Crear documento de métricas
      const metricsDoc = {
        warehouseId,
        countryCode: warehouseDoc.countryCode,
        country: warehouseDoc.country,
        warehouseName: warehouse.name || 'Unnamed Warehouse',
        partnerType: warehouse.partnerType || 'FirstPlug',
        isActive: warehouse.isActive,
        totalProducts,
        totalComputers,
        totalOtherProducts,
        totalTenants,
        tenantMetrics,
        lastCalculated: new Date(),
      };

      await warehouseMetricsCollection.insertOne(metricsDoc);

      console.log(`   ✅ Métricas creadas:`);
      console.log(`      - Total productos: ${totalProducts}`);
      console.log(`      - Computers: ${totalComputers}`);
      console.log(`      - Otros: ${totalOtherProducts}`);
      console.log(`      - Tenants: ${totalTenants}\n`);

      metricsCreated++;
    }

    console.log(`✅ MÉTRICAS GENERADAS: ${metricsCreated} warehouses\n`);

    // ==================== RESUMEN FINAL ====================
    console.log('📊 RESUMEN FINAL:\n');
    console.log(`✅ Warehouse activado: 68c466eb2a12cf5c56301a2e`);
    console.log(`✅ Productos actualizados: ${totalUpdated}`);
    console.log(`✅ Métricas generadas: ${metricsCreated} warehouses`);
    console.log(
      `✅ Total productos en warehouses: ${productsInWarehouses.length}\n`,
    );
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('🔌 Conexión cerrada');
  }
}

if (require.main === module) {
  fixWarehouseData().catch(console.error);
}

export { fixWarehouseData };
