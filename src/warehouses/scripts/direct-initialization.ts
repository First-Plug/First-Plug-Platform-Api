import { MongoClient, ObjectId } from 'mongodb';
import { countryCodes } from '../../shipments/helpers/countryCodes';

/**
 * Script directo para inicializar warehouses sin NestJS
 * Conecta directamente a MongoDB
 */

// URI de conexión para testing
const MONGO_URI =
  'mongodb+srv://santiago:2025devs%2B@firstplug-dev.qxiv5.mongodb.net/firstPlug';

async function initializeWarehousesDirectly() {
  console.log('🚀 Starting direct warehouses initialization...');
  console.log(
    `🔗 Connecting to: ${MONGO_URI.replace(/\/\/.*:.*@/, '//***:***@')}`,
  );

  const client = new MongoClient(MONGO_URI);

  try {
    // Conectar a MongoDB
    await client.connect();
    console.log('✅ Connected to MongoDB');

    // Obtener la base de datos firstPlug
    const db = client.db('firstPlug');
    const warehousesCollection = db.collection('warehouses');

    // Obtener todos los países
    const countries = Object.keys(countryCodes);
    console.log(`📦 Processing ${countries.length} countries...`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const country of countries) {
      try {
        const countryCode = countryCodes[country];

        // Verificar si ya existe
        const existingCountry = await warehousesCollection.findOne({ country });
        if (existingCountry) {
          console.log(`⏭️  Country ${country} already exists, skipping...`);
          skipCount++;
          continue;
        }

        // Crear documento del país con warehouse vacío
        const warehouseDocument = {
          country,
          countryCode,
          hasActiveWarehouse: false,
          warehouses: [
            {
              _id: new ObjectId(),
              name: '',
              address: '',
              apartment: '',
              city: '',
              state: '',
              zipCode: '',
              email: '',
              phone: '',
              contactPerson: '',
              canal: 'whatsapp',
              isActive: false,
              additionalInfo: '',
              partnerType: 'default',
              isRealPartner: false,
              isDeleted: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Insertar documento
        await warehousesCollection.insertOne(warehouseDocument);
        successCount++;
        console.log(`✅ Initialized: ${country} (${countryCode})`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Failed to initialize ${country}:`, error.message);
      }
    }

    console.log(`
🎉 Direct warehouses initialization completed!
📊 Summary:
   ✅ Successfully initialized: ${successCount} countries
   ⏭️  Already existed (skipped): ${skipCount} countries  
   ❌ Failed: ${errorCount} countries
   📦 Total countries processed: ${countries.length}
    `);
  } catch (error) {
    console.error('💥 Fatal error during initialization:', error);
    throw error;
  } finally {
    // Cerrar conexión
    await client.close();
    console.log('🔌 MongoDB connection closed');
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  initializeWarehousesDirectly()
    .then(() => {
      console.log('✅ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { initializeWarehousesDirectly };
