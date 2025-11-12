import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
import { countryCodes } from '../src/shipments/helpers/countryCodes';

// Cargar variables de entorno
config();

/**
 * Script para corregir country en shipments
 * Convierte nombres de países en originDetails.country y destinationDetails.country
 * Solo procesa members y oficinas (FP warehouse no tiene country en versiones viejas)
 * Ejemplos: "Argentina" → "AR", "United States" → "US"
 */

async function fixShipmentCountryCodes() {
  const args = process.argv.slice(2);
  const tenantArg = args.find((arg) => arg.startsWith('--tenant='));

  if (!tenantArg) {
    console.error('❌ Error: Debes especificar --tenant=NOMBRE_TENANT');
    console.log(
      'Uso: npx ts-node scripts/fix-shipment-country-codes.ts -- --tenant=demo',
    );
    return;
  }

  const tenantName = tenantArg.split('=')[1];
  if (!tenantName) {
    console.error('❌ Error: Nombre de tenant vacío');
    return;
  }

  console.log(`🚀 Corrigiendo country en shipments para tenant: ${tenantName}`);

  const mongoUri = process.env.DB_CONNECTION_STRING || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('❌ No se encontró DB_CONNECTION_STRING o MONGO_URI');
  }

  console.log(
    `🔗 Conectando a: ${mongoUri.replace(/\/\/.*:.*@/, '//***:***@')}`,
  );
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    console.log('✅ Conectado a MongoDB');

    // Determinar base de datos global
    let globalDbName = 'main';
    if (mongoUri.includes('firstplug-dev')) {
      globalDbName = 'firstPlug';
    }

    // Buscar tenant
    const globalDb = client.db(globalDbName);
    const tenantsCollection = globalDb.collection('tenants');
    const tenant = await tenantsCollection.findOne({ tenantName: tenantName });

    if (!tenant) {
      console.error(`❌ No se encontró tenant: ${tenantName}`);
      return;
    }

    console.log(`✅ Tenant encontrado: ${tenant.tenantName}`);

    // Conectar a base de datos del tenant
    const tenantDbName = `tenant_${tenantName}`;
    const tenantDb = client.db(tenantDbName);
    const shipmentsCollection = tenantDb.collection('shipments');

    // 1. Buscar shipments con originDetails.country incorrecto
    console.log(
      '\n🔍 Buscando shipments con originDetails.country incorrecto...',
    );

    const shipmentsWithIncorrectOriginCountry = await shipmentsCollection
      .find({
        'originDetails.country': {
          $exists: true,
          $not: /^[A-Z]{2}$/, // No es código de 2 letras
        },
      })
      .toArray();

    console.log(
      `📦 Shipments con originDetails.country incorrecto: ${shipmentsWithIncorrectOriginCountry.length}`,
    );

    // 2. Buscar shipments con destinationDetails.country incorrecto
    console.log(
      '\n🔍 Buscando shipments con destinationDetails.country incorrecto...',
    );

    const shipmentsWithIncorrectDestinationCountry = await shipmentsCollection
      .find({
        'destinationDetails.country': {
          $exists: true,
          $not: /^[A-Z]{2}$/, // No es código de 2 letras
        },
      })
      .toArray();

    console.log(
      `📦 Shipments con destinationDetails.country incorrecto: ${shipmentsWithIncorrectDestinationCountry.length}`,
    );

    // 3. Combinar y deduplicar shipments
    const allIncorrectShipments = new Map();

    shipmentsWithIncorrectOriginCountry.forEach((shipment) => {
      allIncorrectShipments.set(shipment._id.toString(), shipment);
    });

    shipmentsWithIncorrectDestinationCountry.forEach((shipment) => {
      allIncorrectShipments.set(shipment._id.toString(), shipment);
    });

    const uniqueIncorrectShipments = Array.from(allIncorrectShipments.values());
    console.log(
      `📦 Total shipments únicos a procesar: ${uniqueIncorrectShipments.length}`,
    );

    if (uniqueIncorrectShipments.length === 0) {
      console.log('✅ No hay shipments que necesiten corrección');
      return;
    }

    // 4. Mostrar ejemplos de lo que se va a corregir
    console.log('\n📋 Ejemplos de correcciones:');
    const examples = uniqueIncorrectShipments.slice(0, 5);
    examples.forEach((shipment, index) => {
      console.log(`   ${index + 1}. Shipment ${shipment.order_id}:`);

      if (
        shipment.originDetails?.country &&
        !/^[A-Z]{2}$/.test(shipment.originDetails.country)
      ) {
        const originCountry = shipment.originDetails.country;
        const newOriginCode = countryCodes[originCountry];
        console.log(
          `      Origin: "${originCountry}" → "${newOriginCode || 'NO_ENCONTRADO'}"`,
        );
      }

      if (
        shipment.destinationDetails?.country &&
        !/^[A-Z]{2}$/.test(shipment.destinationDetails.country)
      ) {
        const destCountry = shipment.destinationDetails.country;
        const newDestCode = countryCodes[destCountry];
        console.log(
          `      Destination: "${destCountry}" → "${newDestCode || 'NO_ENCONTRADO'}"`,
        );
      }
    });

    // 5. Procesar correcciones
    console.log('\n🔄 Procesando correcciones...');
    let correctedCount = 0;
    let errorCount = 0;

    for (const shipment of uniqueIncorrectShipments) {
      try {
        const updateFields: any = {};
        let hasChanges = false;

        // Corregir originDetails.country si es necesario
        if (
          shipment.originDetails?.country &&
          !/^[A-Z]{2}$/.test(shipment.originDetails.country)
        ) {
          const currentOriginCountry = shipment.originDetails.country;
          const newOriginCode = countryCodes[currentOriginCountry];

          if (!newOriginCode) {
            console.log(
              `⚠️  País de origen no encontrado: "${currentOriginCountry}" (Shipment: ${shipment.order_id})`,
            );
            errorCount++;
            continue;
          }

          updateFields['originDetails.country'] = newOriginCode;
          hasChanges = true;
          console.log(
            `✅ ${shipment.order_id} - Origin: "${currentOriginCountry}" → "${newOriginCode}"`,
          );
        }

        // Corregir destinationDetails.country si es necesario
        if (
          shipment.destinationDetails?.country &&
          !/^[A-Z]{2}$/.test(shipment.destinationDetails.country)
        ) {
          const currentDestCountry = shipment.destinationDetails.country;
          const newDestCode = countryCodes[currentDestCountry];

          if (!newDestCode) {
            console.log(
              `⚠️  País de destino no encontrado: "${currentDestCountry}" (Shipment: ${shipment.order_id})`,
            );
            errorCount++;
            continue;
          }

          updateFields['destinationDetails.country'] = newDestCode;
          hasChanges = true;
          console.log(
            `✅ ${shipment.order_id} - Destination: "${currentDestCountry}" → "${newDestCode}"`,
          );
        }

        // Actualizar shipment si hay cambios
        if (hasChanges) {
          updateFields.updatedAt = new Date();

          await shipmentsCollection.updateOne(
            { _id: shipment._id },
            { $set: updateFields },
          );

          correctedCount++;
        }
      } catch (error) {
        console.error(
          `❌ Error procesando shipment ${shipment.order_id}:`,
          error,
        );
        errorCount++;
      }
    }

    // 6. Verificación final
    console.log('\n🔍 Verificación final...');
    const remainingIncorrectOrigin = await shipmentsCollection.countDocuments({
      'originDetails.country': {
        $exists: true,
        $not: /^[A-Z]{2}$/,
      },
    });

    const remainingIncorrectDestination =
      await shipmentsCollection.countDocuments({
        'destinationDetails.country': {
          $exists: true,
          $not: /^[A-Z]{2}$/,
        },
      });

    // 7. Reporte final
    console.log('\n📊 REPORTE FINAL:');
    console.log('='.repeat(50));
    console.log(`🏢 Tenant: ${tenantName}`);
    console.log(`✅ Shipments corregidos: ${correctedCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    console.log(
      `📦 Total shipments procesados: ${uniqueIncorrectShipments.length}`,
    );
    console.log(
      `📊 Shipments restantes con originDetails.country incorrecto: ${remainingIncorrectOrigin}`,
    );
    console.log(
      `📊 Shipments restantes con destinationDetails.country incorrecto: ${remainingIncorrectDestination}`,
    );

    if (remainingIncorrectOrigin === 0 && remainingIncorrectDestination === 0) {
      console.log('🎉 ¡Corrección completada exitosamente!');
    }

    if (errorCount > 0) {
      console.log(
        '\n⚠️  Revisa los países no encontrados y agrégalos al archivo countryCodes.ts si es necesario',
      );
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n🔌 Conexión cerrada');
  }
}

if (require.main === module) {
  fixShipmentCountryCodes().catch(console.error);
}
