import { config } from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';

config();

/**
 * Script para corregir warehouse IDs en la colección products del tenant
 * ANTES de migrar a global_products
 * 
 * Corrige dos problemas:
 * 1. Productos con location="FP warehouse" pero SIN fpWarehouse object
 * 2. Productos con fpWarehouse pero con warehouse ID inválido
 */

async function fixTenantWarehouseIds() {
  const args = process.argv.slice(2);
  const tenantArg = args.find((arg) => arg.startsWith('--tenant='));

  if (!tenantArg) {
    console.error('❌ Error: Debes especificar --tenant=NOMBRE_TENANT');
    console.log('Uso: npm run fix:tenant-warehouse-ids -- --tenant=mechi_test');
    return;
  }

  const tenantName = tenantArg.split('=')[1];

  console.log(`🔍 VERIFICANDO Y CORRIGIENDO WAREHOUSE IDs EN TENANT: ${tenantName}\n`);

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
    const tenantDb = client.db(`tenant_${tenantName}`);
    const productsCollection = tenantDb.collection('products');
    const warehousesCollection = firstPlugDb.collection('warehouses');
    const tenantsCollection = firstPlugDb.collection('tenants');

    // Obtener información del tenant
    const tenant = await tenantsCollection.findOne({ tenantName });
    if (!tenant) {
      console.error(`❌ Tenant ${tenantName} no encontrado`);
      return;
    }

    const tenantCountryCode = tenant.countryCode || 'AR'; // Default a Argentina si no tiene
    console.log(`🌍 País del tenant: ${tenantCountryCode}\n`);

    // ==================== PASO 1: OBTENER WAREHOUSES DEFAULT ====================
    console.log('📍 PASO 1: OBTENER WAREHOUSES DEFAULT POR PAÍS\n');

    const allCountries = await warehousesCollection.find({}).toArray();
    const defaultWarehouses = new Map<string, any>();

    for (const countryDoc of allCountries) {
      if (countryDoc.warehouses && countryDoc.warehouses.length > 0) {
        const defaultWarehouse = countryDoc.warehouses[0];
        defaultWarehouses.set(countryDoc.countryCode, {
          id: defaultWarehouse._id,
          name: defaultWarehouse.name || `Default Warehouse ${countryDoc.countryCode}`,
          countryCode: countryDoc.countryCode,
          country: countryDoc.country,
        });
      }
    }

    const tenantDefaultWarehouse = defaultWarehouses.get(tenantCountryCode);
    if (!tenantDefaultWarehouse) {
      console.error(`❌ No se encontró warehouse default para ${tenantCountryCode}`);
      return;
    }

    console.log(`✅ Warehouse default del tenant: ${tenantDefaultWarehouse.id} (${tenantDefaultWarehouse.name})\n`);

    // ==================== PASO 2: PRODUCTOS SIN fpWarehouse ====================
    console.log('📦 PASO 2: PRODUCTOS CON location="FP warehouse" PERO SIN fpWarehouse\n');

    const productsWithoutWarehouse = await productsCollection
      .find({
        location: 'FP warehouse',
        fpWarehouse: { $exists: false },
        isDeleted: { $ne: true },
      })
      .toArray();

    console.log(`📦 Productos sin fpWarehouse: ${productsWithoutWarehouse.length}`);

    if (productsWithoutWarehouse.length > 0) {
      console.log(`🔧 Asignando warehouse default a estos productos...\n`);

      const updateResult = await productsCollection.updateMany(
        {
          location: 'FP warehouse',
          fpWarehouse: { $exists: false },
          isDeleted: { $ne: true },
        },
        {
          $set: {
            fpWarehouse: {
              warehouseId: tenantDefaultWarehouse.id,
              warehouseCountryCode: tenantDefaultWarehouse.countryCode,
              warehouseName: tenantDefaultWarehouse.name,
              assignedAt: new Date(),
              status: 'STORED',
            },
          },
        },
      );

      console.log(`   ✅ ${updateResult.modifiedCount} productos actualizados\n`);
    } else {
      console.log(`   ✅ Todos los productos tienen fpWarehouse\n`);
    }

    // ==================== PASO 3: PRODUCTOS CON WAREHOUSE ID INVÁLIDO ====================
    console.log('📦 PASO 3: VERIFICAR WAREHOUSE IDs EXISTENTES\n');

    const productsInWarehouse = await productsCollection
      .find({
        location: 'FP warehouse',
        'fpWarehouse.warehouseId': { $exists: true },
        isDeleted: { $ne: true },
      })
      .toArray();

    console.log(`📦 Total productos en FP warehouse: ${productsInWarehouse.length}\n`);

    if (productsInWarehouse.length === 0) {
      console.log('✅ No hay productos en FP warehouse para verificar\n');
      return;
    }

    // Agrupar por warehouse ID
    const productsByWarehouse = new Map<string, any[]>();

    for (const product of productsInWarehouse) {
      if (product.fpWarehouse && product.fpWarehouse.warehouseId) {
        const warehouseIdStr = product.fpWarehouse.warehouseId.toString();
        if (!productsByWarehouse.has(warehouseIdStr)) {
          productsByWarehouse.set(warehouseIdStr, []);
        }
        productsByWarehouse.get(warehouseIdStr)!.push(product);
      }
    }

    console.log(`🏭 Warehouses únicos encontrados: ${productsByWarehouse.size}\n`);

    // Verificar cada warehouse
    let totalInvalid = 0;
    const invalidWarehouses: Array<{
      warehouseId: string;
      countryCode: string;
      productCount: number;
    }> = [];

    for (const [warehouseIdStr, products] of productsByWarehouse.entries()) {
      const warehouseId = new ObjectId(warehouseIdStr);
      const countryCode = products[0].fpWarehouse.warehouseCountryCode;
      const warehouseName = products[0].fpWarehouse.warehouseName;

      console.log(`🏭 Warehouse: ${warehouseIdStr}`);
      console.log(`   Nombre: ${warehouseName}`);
      console.log(`   País: ${countryCode}`);
      console.log(`   Productos: ${products.length}`);

      // Verificar si existe
      const warehouseExists = await warehousesCollection.findOne({
        'warehouses._id': warehouseId,
      });

      if (warehouseExists) {
        console.log(`   ✅ Warehouse VÁLIDO\n`);
      } else {
        console.log(`   ❌ Warehouse NO EXISTE en DB\n`);
        totalInvalid += products.length;
        invalidWarehouses.push({
          warehouseId: warehouseIdStr,
          countryCode,
          productCount: products.length,
        });
      }
    }

    // ==================== PASO 4: CORREGIR WAREHOUSE IDs INVÁLIDOS ====================
    console.log('📊 RESUMEN:\n');
    console.log(`✅ Total productos en FP warehouse: ${productsInWarehouse.length}`);
    console.log(`❌ Productos con warehouse ID inválido: ${totalInvalid}`);
    console.log(`✅ Productos con warehouse ID válido: ${productsInWarehouse.length - totalInvalid}\n`);

    if (invalidWarehouses.length === 0) {
      console.log('🎉 ¡Todos los warehouse IDs son válidos!\n');
    } else {
      console.log('🔧 CORRIGIENDO WAREHOUSE IDs INVÁLIDOS\n');

      let totalUpdated = 0;

      for (const invalid of invalidWarehouses) {
        const defaultWarehouse = defaultWarehouses.get(invalid.countryCode);

        if (!defaultWarehouse) {
          console.log(`⚠️  Saltando ${invalid.warehouseId} - no hay warehouse default para ${invalid.countryCode}`);
          continue;
        }

        console.log(`🔄 Corrigiendo ${invalid.productCount} productos (${invalid.countryCode})...`);

        const updateResult = await productsCollection.updateMany(
          {
            'fpWarehouse.warehouseId': new ObjectId(invalid.warehouseId),
          },
          {
            $set: {
              'fpWarehouse.warehouseId': defaultWarehouse.id,
              'fpWarehouse.warehouseName': defaultWarehouse.name,
              'fpWarehouse.warehouseCountryCode': defaultWarehouse.countryCode,
            },
          },
        );

        console.log(`   ✅ ${updateResult.modifiedCount} productos actualizados\n`);
        totalUpdated += updateResult.modifiedCount;
      }

      console.log(`✅ Total productos corregidos: ${totalUpdated}\n`);
    }

    // ==================== PASO 5: VERIFICACIÓN FINAL ====================
    console.log('🔍 VERIFICACIÓN FINAL\n');

    const finalCount = await productsCollection.countDocuments({
      location: 'FP warehouse',
      isDeleted: { $ne: true },
    });

    const withWarehouse = await productsCollection.countDocuments({
      location: 'FP warehouse',
      'fpWarehouse.warehouseId': { $exists: true },
      isDeleted: { $ne: true },
    });

    console.log(`📦 Productos en FP warehouse: ${finalCount}`);
    console.log(`✅ Productos con fpWarehouse: ${withWarehouse}`);
    console.log(`❌ Productos sin fpWarehouse: ${finalCount - withWarehouse}\n`);

    if (finalCount === withWarehouse) {
      console.log('🎉 ¡CORRECCIÓN COMPLETADA! Todos los productos tienen warehouse válido.\n');
      console.log('📋 PRÓXIMOS PASOS:\n');
      console.log('   1. npm run migrate:members-to-global -- --tenant=mechi_test');
      console.log('   2. npm run migrate:products-to-global -- --tenant=mechi_test\n');
    } else {
      console.log('⚠️  Aún hay productos sin warehouse. Revisa los datos.\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('🔌 Conexión cerrada');
  }
}

if (require.main === module) {
  fixTenantWarehouseIds().catch(console.error);
}

export { fixTenantWarehouseIds };

