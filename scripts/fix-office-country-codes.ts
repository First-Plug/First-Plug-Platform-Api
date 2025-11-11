import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
import { countryCodes } from '../src/shipments/helpers/countryCodes';

// Cargar variables de entorno
config();

/**
 * Script para corregir officeCountryCode en productos
 * Convierte nombres de países como "Argentina" → "AR"
 */

async function fixOfficeCountryCodes() {
  const args = process.argv.slice(2);
  const tenantArg = args.find((arg) => arg.startsWith('--tenant='));

  if (!tenantArg) {
    console.error('❌ Error: Debes especificar --tenant=NOMBRE_TENANT');
    console.log(
      'Uso: npx ts-node scripts/fix-office-country-codes.ts -- --tenant=demo',
    );
    return;
  }

  const tenantName = tenantArg.split('=')[1];
  if (!tenantName) {
    console.error('❌ Error: Nombre de tenant vacío');
    return;
  }

  console.log(`🚀 Corrigiendo officeCountryCode para tenant: ${tenantName}`);

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
    const productsCollection = tenantDb.collection('products');

    // 1. Buscar productos con office.officeCountryCode que no sea código de país
    console.log('\n🔍 Buscando productos con officeCountryCode incorrecto...');

    const productsWithIncorrectCountry = await productsCollection
      .find({
        'office.officeCountryCode': {
          $exists: true,
          $not: /^[A-Z]{2}$/, // No es código de 2 letras
        },
      })
      .toArray();

    console.log(
      `📦 Productos encontrados: ${productsWithIncorrectCountry.length}`,
    );

    if (productsWithIncorrectCountry.length === 0) {
      console.log('✅ No hay productos que necesiten corrección');
      return;
    }

    // 2. Mostrar ejemplos de lo que se va a corregir
    console.log('\n📋 Ejemplos de correcciones:');
    const examples = productsWithIncorrectCountry.slice(0, 5);
    examples.forEach((product, index) => {
      const currentCountry = product.office.officeCountryCode;
      const newCode = countryCodes[currentCountry];
      console.log(
        `   ${index + 1}. "${currentCountry}" → "${newCode || 'NO_ENCONTRADO'}"`,
      );
    });

    // 3. Procesar correcciones
    console.log('\n🔄 Procesando correcciones...');
    let correctedCount = 0;
    let errorCount = 0;

    for (const product of productsWithIncorrectCountry) {
      try {
        const currentCountry = product.office.officeCountryCode;
        const newCode = countryCodes[currentCountry];

        if (!newCode) {
          console.log(
            `⚠️  País no encontrado en mapeo: "${currentCountry}" (Producto: ${product._id})`,
          );
          errorCount++;
          continue;
        }

        // Actualizar producto
        await productsCollection.updateOne(
          { _id: product._id },
          {
            $set: {
              'office.officeCountryCode': newCode,
              updatedAt: new Date(),
            },
          },
        );

        correctedCount++;
        console.log(`✅ ${product._id}: "${currentCountry}" → "${newCode}"`);
      } catch (error) {
        console.error(`❌ Error procesando producto ${product._id}:`, error);
        errorCount++;
      }
    }

    // 4. También corregir en global_products si existe
    console.log('\n🌐 Corrigiendo en global_products...');
    const globalProductsCollection = globalDb.collection('global_products');

    const globalProductsWithIncorrectCountry = await globalProductsCollection
      .find({
        tenantName: tenantName,
        'office.officeCountryCode': {
          $exists: true,
          $not: /^[A-Z]{2}$/,
        },
      })
      .toArray();

    console.log(
      `📦 Productos globales encontrados: ${globalProductsWithIncorrectCountry.length}`,
    );

    let globalCorrectedCount = 0;
    for (const product of globalProductsWithIncorrectCountry) {
      try {
        const currentCountry = product.office.officeCountryCode;
        const newCode = countryCodes[currentCountry];

        if (!newCode) {
          console.log(
            `⚠️  País no encontrado en mapeo global: "${currentCountry}"`,
          );
          continue;
        }

        await globalProductsCollection.updateOne(
          { _id: product._id },
          {
            $set: {
              'office.officeCountryCode': newCode,
              updatedAt: new Date(),
            },
          },
        );

        globalCorrectedCount++;
      } catch (error) {
        console.error(
          `❌ Error procesando producto global ${product._id}:`,
          error,
        );
      }
    }

    // 5. Reporte final
    console.log('\n📊 REPORTE FINAL:');
    console.log('='.repeat(50));
    console.log(`🏢 Tenant: ${tenantName}`);
    console.log(`✅ Productos locales corregidos: ${correctedCount}`);
    console.log(`✅ Productos globales corregidos: ${globalCorrectedCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    console.log(
      `📦 Total procesados: ${productsWithIncorrectCountry.length + globalProductsWithIncorrectCountry.length}`,
    );

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
  fixOfficeCountryCodes().catch(console.error);
}
