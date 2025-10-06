import { config } from 'dotenv';
import { MongoClient } from 'mongodb';

config();

/**
 * Script para diagnosticar la distribución de productos por país
 */

async function diagnoseProductsDistribution() {
  const args = process.argv.slice(2);
  const tenantArg = args.find((arg) => arg.startsWith('--tenant='));

  if (!tenantArg) {
    console.error('❌ Error: Debes especificar --tenant=NOMBRE_TENANT');
    console.log('Uso: npm run diagnose:products -- --tenant=mechi_test');
    return;
  }

  const tenantName = tenantArg.split('=')[1];

  console.log(`🔍 DIAGNÓSTICO DE PRODUCTOS - TENANT: ${tenantName}\n`);

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ Error: MONGO_URI no está definido en .env');
    return;
  }

  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    console.log('✅ Conectado a MongoDB\n');

    const tenantDb = client.db(`tenant_${tenantName}`);
    const firstPlugDb = client.db('firstPlug');
    const productsCollection = tenantDb.collection('products');
    const globalProductsCollection = firstPlugDb.collection('global_products');

    // ==================== ANÁLISIS EN COLECCIÓN PRODUCTS ====================
    console.log('📦 ANÁLISIS EN COLECCIÓN PRODUCTS (TENANT)\n');

    const totalProducts = await productsCollection.countDocuments({
      isDeleted: { $ne: true },
    });

    const fpWarehouseProducts = await productsCollection.countDocuments({
      location: 'FP warehouse',
      isDeleted: { $ne: true },
    });

    const ourOfficeProducts = await productsCollection.countDocuments({
      location: 'Our office',
      isDeleted: { $ne: true },
    });

    console.log(`📊 Total productos: ${totalProducts}`);
    console.log(`🏭 FP warehouse: ${fpWarehouseProducts}`);
    console.log(`🏢 Our office: ${ourOfficeProducts}`);
    console.log(`📍 Otras ubicaciones: ${totalProducts - fpWarehouseProducts - ourOfficeProducts}\n`);

    // Distribución por país
    console.log('🌍 DISTRIBUCIÓN POR PAÍS (en products):\n');

    const productsByCountry = await productsCollection
      .aggregate([
        {
          $match: {
            location: 'FP warehouse',
            isDeleted: { $ne: true },
          },
        },
        {
          $group: {
            _id: '$fpWarehouse.warehouseCountryCode',
            count: { $sum: 1 },
            computers: {
              $sum: {
                $cond: [{ $eq: ['$category', 'Computer'] }, 1, 0],
              },
            },
            others: {
              $sum: {
                $cond: [{ $ne: ['$category', 'Computer'] }, 1, 0],
              },
            },
          },
        },
        {
          $sort: { count: -1 },
        },
      ])
      .toArray();

    let totalByCountry = 0;
    for (const country of productsByCountry) {
      console.log(`   ${country._id || 'Sin país'}: ${country.count} productos`);
      console.log(`      - Computers: ${country.computers}`);
      console.log(`      - Otros: ${country.others}`);
      totalByCountry += country.count;
    }
    console.log(`\n   TOTAL: ${totalByCountry} productos\n`);

    // ==================== ANÁLISIS EN GLOBAL_PRODUCTS ====================
    console.log('📦 ANÁLISIS EN GLOBAL_PRODUCTS\n');

    const globalTotal = await globalProductsCollection.countDocuments({
      tenantName: tenantName,
      isDeleted: { $ne: true },
    });

    const globalFpWarehouse = await globalProductsCollection.countDocuments({
      tenantName: tenantName,
      inFpWarehouse: true,
      isDeleted: { $ne: true },
    });

    console.log(`📊 Total productos: ${globalTotal}`);
    console.log(`🏭 En FP warehouse: ${globalFpWarehouse}\n`);

    // Distribución por país en global
    console.log('🌍 DISTRIBUCIÓN POR PAÍS (en global_products):\n');

    const globalByCountry = await globalProductsCollection
      .aggregate([
        {
          $match: {
            tenantName: tenantName,
            inFpWarehouse: true,
            isDeleted: { $ne: true },
          },
        },
        {
          $group: {
            _id: '$fpWarehouse.warehouseCountryCode',
            count: { $sum: 1 },
            computers: {
              $sum: {
                $cond: [{ $eq: ['$category', 'Computer'] }, 1, 0],
              },
            },
            others: {
              $sum: {
                $cond: [{ $ne: ['$category', 'Computer'] }, 1, 0],
              },
            },
          },
        },
        {
          $sort: { count: -1 },
        },
      ])
      .toArray();

    let totalGlobalByCountry = 0;
    for (const country of globalByCountry) {
      console.log(`   ${country._id || 'Sin país'}: ${country.count} productos`);
      console.log(`      - Computers: ${country.computers}`);
      console.log(`      - Otros: ${country.others}`);
      totalGlobalByCountry += country.count;
    }
    console.log(`\n   TOTAL: ${totalGlobalByCountry} productos\n`);

    // ==================== COMPARACIÓN ====================
    console.log('📊 COMPARACIÓN:\n');

    console.log(`Products (tenant):       ${fpWarehouseProducts} productos en FP warehouse`);
    console.log(`Global_products:         ${globalFpWarehouse} productos en FP warehouse`);
    console.log(`Diferencia:              ${fpWarehouseProducts - globalFpWarehouse} productos\n`);

    if (fpWarehouseProducts !== globalFpWarehouse) {
      console.log('⚠️  HAY DISCREPANCIA ENTRE LAS COLECCIONES\n');
    } else {
      console.log('✅ Las colecciones están sincronizadas\n');
    }

    // ==================== PRODUCTOS SIN PAÍS ====================
    console.log('🔍 PRODUCTOS SIN PAÍS O CON DATOS INCOMPLETOS:\n');

    const productsWithoutCountry = await productsCollection
      .find({
        location: 'FP warehouse',
        $or: [
          { 'fpWarehouse.warehouseCountryCode': { $exists: false } },
          { 'fpWarehouse.warehouseCountryCode': null },
          { 'fpWarehouse.warehouseCountryCode': '' },
        ],
        isDeleted: { $ne: true },
      })
      .toArray();

    if (productsWithoutCountry.length > 0) {
      console.log(`❌ ${productsWithoutCountry.length} productos sin país:\n`);
      for (const product of productsWithoutCountry.slice(0, 5)) {
        console.log(`   - ID: ${product._id}`);
        console.log(`     Nombre: ${product.name || 'Sin nombre'}`);
        console.log(`     Categoría: ${product.category}`);
        console.log(`     fpWarehouse: ${JSON.stringify(product.fpWarehouse)}\n`);
      }
      if (productsWithoutCountry.length > 5) {
        console.log(`   ... y ${productsWithoutCountry.length - 5} más\n`);
      }
    } else {
      console.log('✅ Todos los productos tienen país asignado\n');
    }

    // ==================== MÉTRICAS EN WAREHOUSE_METRICS ====================
    console.log('📊 MÉTRICAS EN WAREHOUSE_METRICS:\n');

    const metrics = await firstPlugDb
      .collection('warehouse_metrics')
      .find({})
      .toArray();

    let totalInMetrics = 0;
    for (const metric of metrics) {
      console.log(`🏭 ${metric.country} (${metric.countryCode}):`);
      console.log(`   Total productos: ${metric.totalProducts}`);
      console.log(`   Computers: ${metric.totalComputers}`);
      console.log(`   Otros: ${metric.totalOtherProducts}`);
      totalInMetrics += metric.totalProducts;
    }
    console.log(`\n   TOTAL EN MÉTRICAS: ${totalInMetrics} productos\n`);

    // ==================== RESUMEN FINAL ====================
    console.log('📋 RESUMEN FINAL:\n');
    console.log(`✅ Productos en tenant (FP warehouse):  ${fpWarehouseProducts}`);
    console.log(`✅ Productos en global (FP warehouse):  ${globalFpWarehouse}`);
    console.log(`✅ Productos en métricas:               ${totalInMetrics}`);
    console.log('');

    if (fpWarehouseProducts === globalFpWarehouse && globalFpWarehouse === totalInMetrics) {
      console.log('🎉 ¡TODO ESTÁ SINCRONIZADO CORRECTAMENTE!\n');
    } else {
      console.log('⚠️  HAY DISCREPANCIAS - REVISAR DATOS\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('🔌 Conexión cerrada');
  }
}

if (require.main === module) {
  diagnoseProductsDistribution().catch(console.error);
}

export { diagnoseProductsDistribution };

