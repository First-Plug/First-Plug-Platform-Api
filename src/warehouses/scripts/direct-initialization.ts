import { MongoClient, ObjectId } from 'mongodb';
import { countryCodes } from '../../shipments/helpers/countryCodes';
import { config } from 'dotenv';

/**
 * Script directo para inicializar warehouses sin NestJS
 * Conecta directamente a MongoDB
 */

// Cargar variables de entorno
config();

async function initializeWarehousesDirectly() {
  console.log('🚀 Starting direct warehouses initialization...');

  // Obtener URI de conexión desde variables de entorno
  const mongoUri = process.env.DB_CONNECTION_STRING || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error(
      '❌ No se encontró DB_CONNECTION_STRING o MONGO_URI en las variables de entorno',
    );
  }

  console.log(
    `🔗 Connecting to: ${mongoUri.replace(/\/\/.*:.*@/, '//***:***@')}`,
  );

  const client = new MongoClient(mongoUri);

  try {
    // Conectar a MongoDB
    await client.connect();
    console.log('✅ Connected to MongoDB');

    // Determinar qué base de datos usar basado en la URI
    let dbName = 'main'; // Por defecto para producción
    if (mongoUri.includes('firstplug-dev')) {
      dbName = 'firstPlug'; // Para desarrollo
    }

    console.log(`📂 Using database: ${dbName}`);
    const db = client.db(dbName);
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
