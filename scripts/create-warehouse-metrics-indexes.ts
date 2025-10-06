import { config } from 'dotenv';
import { MongoClient } from 'mongodb';

config();

/**
 * Script para crear índices optimizados para agregaciones de métricas de warehouse
 * en la colección global_products
 */

async function createWarehouseMetricsIndexes() {
  console.log('📊 CREANDO ÍNDICES PARA MÉTRICAS DE WAREHOUSE\n');

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

    console.log('🔍 Verificando índices existentes...\n');
    const existingIndexes = await globalProductsCollection.indexes();
    console.log('Índices actuales:');
    existingIndexes.forEach((index) => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });
    console.log('');

    // Índice compuesto para agregaciones de métricas de warehouse
    console.log('📝 Creando índice compuesto para métricas de warehouse...');
    await globalProductsCollection.createIndex(
      {
        'fpWarehouse.warehouseId': 1,
        inFpWarehouse: 1,
        isDeleted: 1,
        isComputer: 1,
        tenantId: 1,
      },
      {
        name: 'warehouse_metrics_aggregation_idx',
        background: true,
      },
    );
    console.log('✅ Índice warehouse_metrics_aggregation_idx creado\n');

    // Índice para queries por país
    console.log('📝 Creando índice para queries por país...');
    await globalProductsCollection.createIndex(
      {
        'fpWarehouse.warehouseCountryCode': 1,
        inFpWarehouse: 1,
        isDeleted: 1,
      },
      {
        name: 'warehouse_country_idx',
        background: true,
      },
    );
    console.log('✅ Índice warehouse_country_idx creado\n');

    // Verificar índices creados
    console.log('🔍 Verificando índices finales...\n');
    const finalIndexes = await globalProductsCollection.indexes();
    console.log('Índices finales:');
    finalIndexes.forEach((index) => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });
    console.log('');

    console.log('✅ Índices creados exitosamente\n');

    // Mostrar estadísticas de la colección
    const count = await globalProductsCollection.countDocuments();
    console.log('📊 ESTADÍSTICAS DE LA COLECCIÓN:');
    console.log(`  Total documentos: ${count}`);
    console.log('');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('🔌 Conexión cerrada');
  }
}

if (require.main === module) {
  createWarehouseMetricsIndexes().catch(console.error);
}

export { createWarehouseMetricsIndexes };
