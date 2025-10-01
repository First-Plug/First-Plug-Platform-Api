import { config } from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';

// Cargar variables de entorno
config();

/**
 * Script para poblar métricas iniciales de warehouses
 * 
 * Este script:
 * 1. Lee todos los productos en global_products que están en warehouses
 * 2. Agrupa por warehouse y tenant
 * 3. Calcula métricas (total, computers, otherProducts)
 * 4. Crea/actualiza documentos en warehouse_metrics
 */

interface ProductInWarehouse {
  _id: ObjectId;
  tenantId: ObjectId;
  tenantName: string;
  originalProductId: ObjectId;
  category: string;
  isComputer: boolean;
  fpWarehouse: {
    warehouseId: ObjectId;
    warehouseCountryCode: string;
    warehouseName: string;
  };
}

interface TenantMetrics {
  tenantId: ObjectId;
  tenantName: string;
  companyName: string;
  computers: number;
  otherProducts: number;
  totalProducts: number;
}

interface WarehouseMetrics {
  warehouseId: ObjectId;
  countryCode: string;
  country: string;
  warehouseName: string;
  partnerType: string;
  isActive: boolean;
  totalProducts: number;
  totalComputers: number;
  totalOtherProducts: number;
  totalTenants: number;
  tenantMetrics: TenantMetrics[];
  lastCalculated: Date;
}

async function populateWarehouseMetrics() {
  console.log('🔧 Iniciando población de métricas de warehouses...\n');

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
    const warehouseMetricsCollection = firstPlugDb.collection('warehouse_metrics');
    const warehousesCollection = firstPlugDb.collection('warehouses');
    const tenantsCollection = firstPlugDb.collection('tenants');

    // 1. Obtener todos los productos en warehouses
    console.log('📦 Obteniendo productos en warehouses...');
    const productsInWarehouses = await globalProductsCollection
      .find({
        inFpWarehouse: true,
        'fpWarehouse.warehouseId': { $exists: true },
        isDeleted: { $ne: true },
      })
      .toArray() as unknown as ProductInWarehouse[];

    console.log(`   ✅ Encontrados ${productsInWarehouses.length} productos en warehouses\n`);

    if (productsInWarehouses.length === 0) {
      console.log('⚠️ No hay productos en warehouses. Nada que hacer.\n');
      return;
    }

    // 2. Agrupar por warehouse
    const warehouseMap = new Map<string, ProductInWarehouse[]>();

    for (const product of productsInWarehouses) {
      const warehouseKey = product.fpWarehouse.warehouseId.toString();
      if (!warehouseMap.has(warehouseKey)) {
        warehouseMap.set(warehouseKey, []);
      }
      warehouseMap.get(warehouseKey)!.push(product);
    }

    console.log(`📊 Warehouses con productos: ${warehouseMap.size}\n`);

    // 3. Procesar cada warehouse
    let processedWarehouses = 0;
    let totalMetricsCreated = 0;

    for (const [warehouseIdStr, products] of warehouseMap.entries()) {
      const warehouseId = new ObjectId(warehouseIdStr);
      const firstProduct = products[0];

      console.log(`\n📦 Procesando warehouse: ${firstProduct.fpWarehouse.warehouseName} (${warehouseIdStr})`);
      console.log(`   - País: ${firstProduct.fpWarehouse.warehouseCountryCode}`);
      console.log(`   - Productos: ${products.length}`);

      // Obtener información del warehouse
      const warehouseDoc = await warehousesCollection.findOne({
        countryCode: firstProduct.fpWarehouse.warehouseCountryCode,
      });

      if (!warehouseDoc) {
        console.warn(`   ⚠️ No se encontró documento de warehouse para país ${firstProduct.fpWarehouse.warehouseCountryCode}`);
        continue;
      }

      const warehouse = warehouseDoc.warehouses.find(
        (w: any) => w._id.toString() === warehouseIdStr
      );

      if (!warehouse) {
        console.warn(`   ⚠️ No se encontró warehouse ${warehouseIdStr} en documento de país`);
        continue;
      }

      // Agrupar productos por tenant
      const tenantMap = new Map<string, {
        tenantId: ObjectId;
        tenantName: string;
        companyName: string;
        computers: number;
        otherProducts: number;
        totalProducts: number;
      }>();

      for (const product of products) {
        const tenantKey = product.tenantId.toString();

        if (!tenantMap.has(tenantKey)) {
          // Obtener companyName del tenant
          const tenant = await tenantsCollection.findOne({ _id: product.tenantId });
          const companyName = tenant?.name || product.tenantName;

          tenantMap.set(tenantKey, {
            tenantId: product.tenantId,
            tenantName: product.tenantName,
            companyName,
            computers: 0,
            otherProducts: 0,
            totalProducts: 0,
          });
        }

        const tenantMetrics = tenantMap.get(tenantKey)!;
        tenantMetrics.totalProducts++;
        if (product.isComputer) {
          tenantMetrics.computers++;
        } else {
          tenantMetrics.otherProducts++;
        }
      }

      // Calcular totales
      const tenantMetrics = Array.from(tenantMap.values()).map((tm) => ({
        tenantId: tm.tenantId,
        tenantName: tm.tenantName,
        companyName: tm.companyName,
        totalProducts: tm.totalProducts,
        computers: tm.computers,
        otherProducts: tm.otherProducts,
        lastUpdated: new Date(),
      }));

      const totalProducts = products.length;
      const totalComputers = products.filter((p) => p.isComputer).length;
      const totalOtherProducts = totalProducts - totalComputers;
      const totalTenants = tenantMap.size;

      console.log(`   - Tenants: ${totalTenants}`);
      console.log(`   - Computers: ${totalComputers}`);
      console.log(`   - Other products: ${totalOtherProducts}`);

      // Crear/actualizar documento de métricas
      const metricsDoc: WarehouseMetrics = {
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

      await warehouseMetricsCollection.updateOne(
        { warehouseId },
        { $set: metricsDoc },
        { upsert: true },
      );

      console.log(`   ✅ Métricas actualizadas`);
      processedWarehouses++;
      totalMetricsCreated += totalTenants;
    }

    // 4. Resumen final
    console.log('\n📊 RESUMEN FINAL:');
    console.log(`   - Warehouses procesados: ${processedWarehouses}`);
    console.log(`   - Total productos: ${productsInWarehouses.length}`);
    console.log(`   - Métricas de tenants creadas: ${totalMetricsCreated}`);

    // Verificar resultado
    const metricsCount = await warehouseMetricsCollection.countDocuments({});
    console.log(`\n🔍 Verificación:`);
    console.log(`   - Documentos en warehouse_metrics: ${metricsCount}`);

    console.log('\n🎉 ¡Población de métricas completada exitosamente!\n');

  } catch (error) {
    console.error('❌ Error durante la población de métricas:', error);
  } finally {
    await client.close();
    console.log('🔌 Conexión cerrada');
  }
}

// Ejecutar script
if (require.main === module) {
  populateWarehouseMetrics()
    .then(() => {
      console.log('✅ Script finalizado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

export { populateWarehouseMetrics };

