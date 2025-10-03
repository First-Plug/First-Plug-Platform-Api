#!/usr/bin/env ts-node

/**
 * FASE 3 SIMPLE: Migrar productos de Products a Global + Generar Métricas de Warehouse
 *
 * Script simplificado que:
 * 1. Migra productos de la colección products a global_products
 * 2. Genera métricas de warehouse en warehouse_metrics para productos en FP warehouse
 */

import { config } from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';

// Cargar variables de entorno
config();

// Interface para acumular productos por warehouse
interface ProductMetrics {
  tenantId: ObjectId;
  tenantName: string;
  companyName: string;
  isComputer: boolean;
}

async function runSimpleMigration() {
  const args = process.argv.slice(2);
  const tenantArg = args.find((arg) => arg.startsWith('--tenant='));

  if (!tenantArg) {
    console.error('❌ Error: Debes especificar --tenant=NOMBRE_TENANT');
    console.log(
      'Uso: npm run migrate:products-to-global-simple -- --tenant=mechi_test',
    );
    return;
  }

  const tenantName = tenantArg.split('=')[1];

  if (!tenantName) {
    console.error('❌ Error: Nombre de tenant vacío');
    return;
  }

  console.log(
    `🚀 FASE 3 SIMPLE: Migrando productos de products para tenant ${tenantName}`,
  );

  // Mostrar URI que se va a usar
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017';
  console.log(`🔗 Conectando a: ${mongoUri}`);

  // Conectar a MongoDB directamente
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    console.log('✅ Conectado a MongoDB');

    // 1. Buscar el tenant real por tenantName
    const firstPlugDb = client.db('firstPlug');
    const tenantsCollection = firstPlugDb.collection('tenants');

    console.log(`🔍 Buscando tenant con nombre: ${tenantName}`);
    const tenant = await tenantsCollection.findOne({ tenantName: tenantName });

    if (!tenant) {
      console.error(`❌ No se encontró tenant con nombre: ${tenantName}`);
      return;
    }

    console.log(
      `✅ Tenant encontrado: ${tenant.tenantName} (ID: ${tenant._id})`,
    );

    // 2. Conectar a la base de datos del tenant
    const tenantDbName = `tenant_${tenantName}`;
    console.log(`📂 Buscando base de datos: ${tenantDbName}`);
    const tenantDb = client.db(tenantDbName);
    const productsCollection = tenantDb.collection('products');

    // 3. Conectar a la base de datos global
    const globalProductsCollection = firstPlugDb.collection('global_products');
    const warehousesCollection = firstPlugDb.collection('warehouses');
    const warehouseMetricsCollection =
      firstPlugDb.collection('warehouse_metrics');

    // Obtener todos los warehouses default por país
    console.log('📍 Obteniendo warehouses default por país...');
    const allCountries = await warehousesCollection.find({}).toArray();
    const defaultWarehouses = new Map<string, any>();

    for (const countryDoc of allCountries) {
      if (countryDoc.warehouses && countryDoc.warehouses.length > 0) {
        const defaultWarehouse = countryDoc.warehouses[0];
        defaultWarehouses.set(countryDoc.countryCode, {
          id: defaultWarehouse._id,
          name:
            defaultWarehouse.name ||
            `Default Warehouse ${countryDoc.countryCode}`,
          countryCode: countryDoc.countryCode,
          country: countryDoc.country,
        });
      }
    }
    console.log(`✅ ${defaultWarehouses.size} países con warehouses\n`);

    // Map para acumular productos por warehouse
    const warehouseProductsMap = new Map<string, ProductMetrics[]>();

    // 1. Contar productos totales
    const totalProducts = await productsCollection.countDocuments({
      isDeleted: { $ne: true },
    });
    console.log(`📦 Total productos en products: ${totalProducts}`);

    // 2. Clasificar productos por location
    const fpWarehouseProducts = await productsCollection.countDocuments({
      location: 'FP warehouse',
      isDeleted: { $ne: true },
    });

    const ourOfficeProducts = await productsCollection.countDocuments({
      location: 'Our office',
      isDeleted: { $ne: true },
    });

    const otherLocationProducts =
      totalProducts - fpWarehouseProducts - ourOfficeProducts;

    console.log(`🏭 Productos en "FP warehouse": ${fpWarehouseProducts}`);
    console.log(`🏢 Productos en "Our office": ${ourOfficeProducts}`);
    console.log(`📍 Productos en otras ubicaciones: ${otherLocationProducts}`);

    if (totalProducts === 0) {
      console.log('✅ No hay productos para migrar');
      return;
    }

    // 3. Obtener todos los productos
    const products = await productsCollection
      .find({ isDeleted: { $ne: true } })
      .toArray();

    // 4. Migrar cada producto
    let migrated = 0;
    const errors: string[] = [];

    for (const product of products) {
      try {
        // Preparar datos de warehouse si es FP warehouse
        let fpWarehouseData: any = null;
        let inFpWarehouse = false;

        if (product.location === 'FP warehouse' && product.fpWarehouse) {
          const originalWarehouseId = product.fpWarehouse.warehouseId;
          const countryCode = product.fpWarehouse.warehouseCountryCode;

          // Verificar si el warehouse existe
          const warehouseExists = await warehousesCollection.findOne({
            'warehouses._id': originalWarehouseId,
          });

          let finalWarehouseId = originalWarehouseId;
          let finalWarehouseName = product.fpWarehouse.warehouseName;

          // Si no existe, usar el warehouse default del país
          if (!warehouseExists) {
            const defaultWarehouse = defaultWarehouses.get(countryCode);
            if (defaultWarehouse) {
              finalWarehouseId = defaultWarehouse.id;
              finalWarehouseName = defaultWarehouse.name;
            }
          }

          fpWarehouseData = {
            warehouseId: finalWarehouseId,
            warehouseCountryCode: countryCode,
            warehouseName: finalWarehouseName,
            assignedAt: product.fpWarehouse.assignedAt,
            status: product.fpWarehouse.status,
          };
          inFpWarehouse = true;
        }

        // Preparar documento para global_products
        const globalProduct = {
          // === DATOS DEL TENANT ===
          tenantId: new ObjectId(tenant._id),
          tenantName: tenantName,

          // === REFERENCIA ORIGINAL ===
          originalProductId: new ObjectId(product._id),
          sourceCollection: 'products',

          // === DATOS DEL PRODUCTO ===
          name: product.name || '',
          category: product.category,
          status: product.status,
          location: product.location || 'FP warehouse',

          // Convertir atributos a formato string
          attributes:
            product.attributes?.map((attr: any) => ({
              key: attr.key,
              value: String(attr.value),
            })) || [],

          serialNumber: product.serialNumber || null,
          assignedEmail: product.assignedEmail || '',
          assignedMember: product.assignedMember || '',
          lastAssigned: product.lastAssigned,
          acquisitionDate: product.acquisitionDate,
          price: product.price,
          additionalInfo: product.additionalInfo,
          productCondition: product.productCondition,
          recoverable: product.recoverable,
          fp_shipment: product.fp_shipment || false,
          activeShipment: product.activeShipment || false,
          imageUrl: product.imageUrl,
          isDeleted: false,

          // === DATOS DE ASIGNACIÓN ===
          memberData: null, // Productos en 'products' no están asignados actualmente

          // === DATOS DE WAREHOUSE ===
          fpWarehouse: fpWarehouseData,

          // === CAMPOS CALCULADOS ===
          isComputer: product.category === 'Computer',
          inFpWarehouse: inFpWarehouse,
          isAssigned: !!(product.assignedEmail && product.assignedMember),

          // === METADATOS ===
          lastSyncedAt: new Date(),
          sourceUpdatedAt: product.updatedAt || new Date(),
          createdAt: product.createdAt || new Date(),
          updatedAt: new Date(),
        };

        // Verificar si ya existe (evitar duplicados)
        const existing = await globalProductsCollection.findOne({
          tenantId: new ObjectId(tenant._id),
          originalProductId: new ObjectId(product._id),
          sourceCollection: 'products',
        });

        if (existing) {
          // Actualizar existente
          await globalProductsCollection.updateOne(
            { _id: existing._id },
            { $set: globalProduct },
          );
        } else {
          // Insertar nuevo
          await globalProductsCollection.insertOne(globalProduct);
        }

        migrated++;

        // Si el producto está en FP warehouse, acumular para métricas
        if (inFpWarehouse && fpWarehouseData) {
          const warehouseIdStr = fpWarehouseData.warehouseId.toString();

          if (!warehouseProductsMap.has(warehouseIdStr)) {
            warehouseProductsMap.set(warehouseIdStr, []);
          }

          warehouseProductsMap.get(warehouseIdStr)!.push({
            tenantId: new ObjectId(tenant._id),
            tenantName: tenantName,
            companyName: tenant.name || tenantName,
            isComputer: product.category === 'Computer',
          });
        }

        if (migrated % 25 === 0) {
          console.log(`📦 Migrados ${migrated}/${totalProducts} productos`);
        }
      } catch (error) {
        const errorMsg = `Error migrando producto ${product._id}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log(`✅ FASE 3 COMPLETADA:`);
    console.log(`   - Total productos: ${totalProducts}`);
    console.log(`   - FP warehouse: ${fpWarehouseProducts}`);
    console.log(`   - Our office: ${ourOfficeProducts}`);
    console.log(`   - Otras ubicaciones: ${otherLocationProducts}`);
    console.log(`   - Migrados: ${migrated}`);
    console.log(`   - Errores: ${errors.length}`);

    if (errors.length > 0) {
      console.log('\n❌ Errores encontrados:');
      errors.forEach((error) => console.log(`   - ${error}`));
    }

    // 5. Verificar resultado
    const globalCount = await globalProductsCollection.countDocuments({
      tenantId: new ObjectId(tenant._id),
      sourceCollection: 'products',
    });

    console.log(
      `🔍 Verificación: ${globalCount} productos de products en global_products`,
    );

    if (globalCount >= migrated) {
      console.log(
        '🎉 ¡Migración exitosa! Productos de products migrados a global',
      );
    } else {
      console.log(
        `⚠️ Advertencia: Esperábamos al menos ${migrated} pero tenemos ${globalCount}`,
      );
    }

    // ==================== GENERAR MÉTRICAS DE WAREHOUSE ====================
    console.log('\n📊 GENERANDO MÉTRICAS DE WAREHOUSE...\n');

    if (warehouseProductsMap.size === 0) {
      console.log(
        'ℹ️  No hay productos en FP warehouse, no se generan métricas',
      );
    } else {
      console.log(`📦 Warehouses con productos: ${warehouseProductsMap.size}`);

      let metricsCreated = 0;
      const metricsErrors: string[] = [];

      for (const [warehouseIdStr, products] of warehouseProductsMap.entries()) {
        try {
          const warehouseId = new ObjectId(warehouseIdStr);

          console.log(`\n🏭 Procesando warehouse: ${warehouseIdStr}`);
          console.log(`   Productos: ${products.length}`);

          // Buscar información del warehouse
          const warehouseDoc = await warehousesCollection.findOne({
            'warehouses._id': warehouseId,
          });

          if (!warehouseDoc) {
            const errorMsg = `Warehouse ${warehouseIdStr} no encontrado en colección warehouses`;
            console.error(`   ❌ ${errorMsg}`);
            metricsErrors.push(errorMsg);
            continue;
          }

          // Encontrar el warehouse específico en el array
          const warehouse = warehouseDoc.warehouses.find(
            (wh: any) => wh._id.toString() === warehouseIdStr,
          );

          if (!warehouse) {
            const errorMsg = `Warehouse ${warehouseIdStr} no encontrado en array de warehouses`;
            console.error(`   ❌ ${errorMsg}`);
            metricsErrors.push(errorMsg);
            continue;
          }

          // Agrupar productos por tenant
          const tenantMap = new Map<
            string,
            {
              tenantId: ObjectId;
              tenantName: string;
              companyName: string;
              computers: number;
              otherProducts: number;
              totalProducts: number;
            }
          >();

          for (const product of products) {
            const tenantIdStr = product.tenantId.toString();

            if (!tenantMap.has(tenantIdStr)) {
              tenantMap.set(tenantIdStr, {
                tenantId: product.tenantId,
                tenantName: product.tenantName,
                companyName: product.companyName,
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

          // Insertar o actualizar métricas
          await warehouseMetricsCollection.updateOne(
            { warehouseId },
            { $set: metricsDoc },
            { upsert: true },
          );

          console.log(`   ✅ Métricas creadas:`);
          console.log(`      - Total productos: ${totalProducts}`);
          console.log(`      - Computers: ${totalComputers}`);
          console.log(`      - Otros: ${totalOtherProducts}`);
          console.log(`      - Tenants: ${totalTenants}`);

          metricsCreated++;
        } catch (error) {
          const errorMsg = `Error generando métricas para warehouse ${warehouseIdStr}: ${error.message}`;
          console.error(`   ❌ ${errorMsg}`);
          metricsErrors.push(errorMsg);
        }
      }

      console.log(`\n✅ MÉTRICAS GENERADAS:`);
      console.log(`   - Warehouses procesados: ${metricsCreated}`);
      console.log(`   - Errores: ${metricsErrors.length}`);

      if (metricsErrors.length > 0) {
        console.log('\n❌ Errores en métricas:');
        metricsErrors.forEach((error) => console.log(`   - ${error}`));
      }
    }
  } catch (error) {
    console.error('❌ Error en migración:', error);
  } finally {
    await client.close();
    console.log('🔌 Conexión cerrada');
  }
}

if (require.main === module) {
  runSimpleMigration().catch(console.error);
}
