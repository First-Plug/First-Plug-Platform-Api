import { MongoClient } from 'mongodb';
import { config } from 'dotenv';

// Cargar variables de entorno
config();

async function checkWarehouses() {
  const mongoUri = process.env.DB_CONNECTION_STRING || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('❌ No se encontró DB_CONNECTION_STRING o MONGO_URI');
  }

  console.log(`🔗 Conectando a: ${mongoUri.replace(/\/\/.*:.*@/, '//***:***@')}`);
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    console.log('✅ Conectado a MongoDB');

    // Verificar en ambas bases de datos
    const databases = ['main', 'firstPlug'];
    
    for (const dbName of databases) {
      console.log(`\n📂 Verificando base de datos: ${dbName}`);
      const db = client.db(dbName);
      const warehousesCollection = db.collection('warehouses');
      
      const count = await warehousesCollection.countDocuments();
      console.log(`   📦 Total warehouses: ${count}`);
      
      if (count > 0) {
        // Mostrar algunos ejemplos
        const samples = await warehousesCollection.find({}).limit(3).toArray();
        console.log(`   📋 Ejemplos:`);
        samples.forEach((wh, index) => {
          console.log(`      ${index + 1}. ${wh.country} (${wh.countryCode}) - Warehouses: ${wh.warehouses?.length || 0}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n🔌 Conexión cerrada');
  }
}

checkWarehouses().catch(console.error);
