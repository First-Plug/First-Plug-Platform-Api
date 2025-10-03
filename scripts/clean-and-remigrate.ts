import { config } from 'dotenv';
import { MongoClient } from 'mongodb';

config();

/**
 * Script para limpiar colecciones y preparar para re-migración
 */

async function cleanAndPrepare() {
  console.log('🧹 LIMPIANDO COLECCIONES PARA RE-MIGRACIÓN\n');

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

    // 1. Limpiar global_products
    console.log('🗑️  Limpiando global_products...');
    const globalProductsResult = await firstPlugDb
      .collection('global_products')
      .deleteMany({});
    console.log(`   ✅ ${globalProductsResult.deletedCount} productos eliminados\n`);

    // 2. Limpiar warehouse_metrics
    console.log('🗑️  Limpiando warehouse_metrics...');
    const metricsResult = await firstPlugDb
      .collection('warehouse_metrics')
      .deleteMany({});
    console.log(`   ✅ ${metricsResult.deletedCount} métricas eliminadas\n`);

    // 3. Limpiar warehousemetrics (colección incorrecta si existe)
    console.log('🗑️  Limpiando warehousemetrics (colección incorrecta)...');
    try {
      const incorrectMetricsResult = await firstPlugDb
        .collection('warehousemetrics')
        .deleteMany({});
      console.log(
        `   ✅ ${incorrectMetricsResult.deletedCount} documentos eliminados\n`,
      );
    } catch (error) {
      console.log('   ℹ️  Colección no existe o ya está vacía\n');
    }

    console.log('✅ LIMPIEZA COMPLETADA\n');
    console.log('📋 PRÓXIMOS PASOS:');
    console.log('   1. npm run migrate:members-to-global -- --tenant=mechi_test');
    console.log('   2. npm run migrate:products-to-global -- --tenant=mechi_test');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('🔌 Conexión cerrada');
  }
}

if (require.main === module) {
  cleanAndPrepare().catch(console.error);
}

export { cleanAndPrepare };

