import { config } from 'dotenv';
import { MongoClient } from 'mongodb';

config();

/**
 * Script para eliminar la colección warehouse_metrics obsoleta
 * Ya no se usa porque ahora calculamos métricas en tiempo real
 */

async function cleanupOldMetricsCollection() {
  console.log('🧹 LIMPIANDO COLECCIÓN OBSOLETA DE MÉTRICAS\n');

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

    // Verificar si existe la colección
    const collections = await firstPlugDb.listCollections().toArray();
    const metricsCollections = collections.filter((c) =>
      c.name.includes('metrics'),
    );

    console.log('📋 Colecciones de métricas encontradas:');
    metricsCollections.forEach((c) => {
      console.log(`  - ${c.name}`);
    });
    console.log('');

    // Eliminar warehouse_metrics si existe
    if (metricsCollections.some((c) => c.name === 'warehouse_metrics')) {
      const count = await firstPlugDb
        .collection('warehouse_metrics')
        .countDocuments();
      console.log(
        `🗑️  Eliminando colección warehouse_metrics (${count} documentos)...`,
      );
      await firstPlugDb.collection('warehouse_metrics').drop();
      console.log('✅ Colección warehouse_metrics eliminada\n');
    } else {
      console.log('ℹ️  Colección warehouse_metrics no existe\n');
    }

    // Eliminar warehousemetrics (sin guion bajo) si existe
    if (metricsCollections.some((c) => c.name === 'warehousemetrics')) {
      const count = await firstPlugDb
        .collection('warehousemetrics')
        .countDocuments();
      console.log(
        `🗑️  Eliminando colección warehousemetrics (${count} documentos)...`,
      );
      await firstPlugDb.collection('warehousemetrics').drop();
      console.log('✅ Colección warehousemetrics eliminada\n');
    } else {
      console.log('ℹ️  Colección warehousemetrics no existe\n');
    }

    // Mostrar colecciones finales
    const finalCollections = await firstPlugDb.listCollections().toArray();
    console.log('📋 Colecciones finales en firstPlug:');
    finalCollections.forEach((c) => {
      console.log(`  - ${c.name}`);
    });
    console.log('');

    console.log('✅ Limpieza completada\n');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('🔌 Conexión cerrada');
  }
}

if (require.main === module) {
  cleanupOldMetricsCollection().catch(console.error);
}

export { cleanupOldMetricsCollection };

