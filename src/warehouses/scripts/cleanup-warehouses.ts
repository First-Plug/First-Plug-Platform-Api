import { MongoClient } from 'mongodb';

/**
 * Script de limpieza para warehouses existentes
 * - Elimina la propiedad isRealPartner
 * - Cambia canal de "whatsapp" a "" para warehouses default
 */

// URI de conexión para testing
const MONGO_URI = 'mongodb+srv://santiago:2025devs%2B@firstplug-dev.qxiv5.mongodb.net/firstPlug';

async function cleanupWarehouses() {
  console.log('🧹 Starting warehouses cleanup...');
  console.log(`🔗 Connecting to: ${MONGO_URI.replace(/\/\/.*:.*@/, '//***:***@')}`);
  
  const client = new MongoClient(MONGO_URI);
  
  try {
    // Conectar a MongoDB
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    // Obtener la base de datos firstPlug
    const db = client.db('firstPlug');
    const warehousesCollection = db.collection('warehouses');
    
    // Obtener todos los documentos de warehouses
    const allWarehouses = await warehousesCollection.find({}).toArray();
    console.log(`📦 Found ${allWarehouses.length} warehouse documents to process...`);
    
    let updatedDocuments = 0;
    let updatedWarehouses = 0;
    
    for (const warehouseDoc of allWarehouses) {
      let documentNeedsUpdate = false;
      let warehousesInDocUpdated = 0;
      
      // Procesar cada warehouse en el array
      for (const warehouse of warehouseDoc.warehouses) {
        let warehouseNeedsUpdate = false;
        
        // 1. Eliminar isRealPartner si existe
        if (warehouse.hasOwnProperty('isRealPartner')) {
          delete warehouse.isRealPartner;
          warehouseNeedsUpdate = true;
          console.log(`   🗑️  Removed isRealPartner from warehouse in ${warehouseDoc.country}`);
        }
        
        // 2. Cambiar canal de "whatsapp" a "" si es partnerType "default"
        if (warehouse.partnerType === 'default' && warehouse.canal === 'whatsapp') {
          warehouse.canal = '';
          warehouseNeedsUpdate = true;
          console.log(`   📝 Changed canal from "whatsapp" to "" in ${warehouseDoc.country}`);
        }
        
        if (warehouseNeedsUpdate) {
          warehouse.updatedAt = new Date();
          warehousesInDocUpdated++;
          documentNeedsUpdate = true;
        }
      }
      
      // Actualizar el documento si hubo cambios
      if (documentNeedsUpdate) {
        warehouseDoc.updatedAt = new Date();
        
        await warehousesCollection.replaceOne(
          { _id: warehouseDoc._id },
          warehouseDoc
        );
        
        updatedDocuments++;
        updatedWarehouses += warehousesInDocUpdated;
        console.log(`✅ Updated document for ${warehouseDoc.country} (${warehousesInDocUpdated} warehouses modified)`);
      } else {
        console.log(`⏭️  No changes needed for ${warehouseDoc.country}`);
      }
    }
    
    console.log(`
🎉 Warehouses cleanup completed!
📊 Summary:
   📄 Documents processed: ${allWarehouses.length}
   📄 Documents updated: ${updatedDocuments}
   🏢 Individual warehouses updated: ${updatedWarehouses}
   
🧹 Cleanup actions performed:
   - Removed 'isRealPartner' property from warehouses
   - Changed 'canal' from "whatsapp" to "" for default warehouses
    `);
    
  } catch (error) {
    console.error('💥 Fatal error during cleanup:', error);
    throw error;
  } finally {
    // Cerrar conexión
    await client.close();
    console.log('🔌 MongoDB connection closed');
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  cleanupWarehouses()
    .then(() => {
      console.log('✅ Cleanup script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Cleanup script failed:', error);
      process.exit(1);
    });
}

export { cleanupWarehouses };
