console.log('🧹 LIMPIANDO COLECCIÓN OFFICES INCORRECTA');

import { MongoClient } from 'mongodb';

const MONGO_URI =
  process.env.DB_CONNECTION_STRING ||
  'mongodb+srv://santiago:2025devs%2B@firstplug-dev.qxiv5.mongodb.net/firstPlug';

async function cleanupOffices() {
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('✅ Conectado a MongoDB Atlas');

    const mainDb = client.db('firstPlug');
    
    // Verificar si existe la colección offices en DB principal
    const collections = await mainDb.listCollections().toArray();
    const officesExists = collections.some(col => col.name === 'offices');
    
    if (officesExists) {
      console.log('❌ Encontrada colección "offices" en DB principal (incorrecto)');
      
      // Ver qué contiene
      const officesCollection = mainDb.collection('offices');
      const count = await officesCollection.countDocuments();
      console.log(`📋 Documentos en offices: ${count}`);
      
      if (count > 0) {
        const docs = await officesCollection.find({}).toArray();
        console.log('📋 Contenido:');
        docs.forEach(doc => {
          console.log(`   - ${doc.name} (tenant: ${doc.tenantId})`);
        });
      }
      
      // Eliminar la colección
      console.log('🗑️ Eliminando colección "offices" de DB principal...');
      await officesCollection.drop();
      console.log('✅ Colección "offices" eliminada de DB principal');
      
    } else {
      console.log('✅ No existe colección "offices" en DB principal (correcto)');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

cleanupOffices().catch(console.error);
