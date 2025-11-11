import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
import { countryCodes } from '../src/shipments/helpers/countryCodes';

// Cargar variables de entorno
config();

/**
 * Script para corregir country en members
 * Convierte nombres de países como "Philippines" → "PH"
 */

async function fixMemberCountryCodes() {
  const args = process.argv.slice(2);
  const tenantArg = args.find((arg) => arg.startsWith('--tenant='));

  if (!tenantArg) {
    console.error('❌ Error: Debes especificar --tenant=NOMBRE_TENANT');
    console.log(
      'Uso: npx ts-node scripts/fix-member-country-codes.ts -- --tenant=demo',
    );
    return;
  }

  const tenantName = tenantArg.split('=')[1];
  if (!tenantName) {
    console.error('❌ Error: Nombre de tenant vacío');
    return;
  }

  console.log(`🚀 Corrigiendo country en members para tenant: ${tenantName}`);

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
    const membersCollection = tenantDb.collection('members');

    // 1. Buscar members con country que no sea código de país
    console.log('\n🔍 Buscando members con country incorrecto...');

    const membersWithIncorrectCountry = await membersCollection
      .find({
        country: {
          $exists: true,
          $not: /^[A-Z]{2}$/, // No es código de 2 letras
        },
      })
      .toArray();

    console.log(
      `👥 Members encontrados: ${membersWithIncorrectCountry.length}`,
    );

    if (membersWithIncorrectCountry.length === 0) {
      console.log('✅ No hay members que necesiten corrección');
      return;
    }

    // 2. Mostrar ejemplos de lo que se va a corregir
    console.log('\n📋 Ejemplos de correcciones:');
    const examples = membersWithIncorrectCountry.slice(0, 5);
    examples.forEach((member, index) => {
      const currentCountry = member.country;
      const newCode = countryCodes[currentCountry];
      console.log(
        `   ${index + 1}. "${currentCountry}" → "${newCode || 'NO_ENCONTRADO'}" (${member.firstName} ${member.lastName})`,
      );
    });

    // 3. Procesar correcciones
    console.log('\n🔄 Procesando correcciones...');
    let correctedCount = 0;
    let errorCount = 0;

    for (const member of membersWithIncorrectCountry) {
      try {
        const currentCountry = member.country;
        const newCode = countryCodes[currentCountry];

        if (!newCode) {
          console.log(
            `⚠️  País no encontrado en mapeo: "${currentCountry}" (Member: ${member.firstName} ${member.lastName})`,
          );
          errorCount++;
          continue;
        }

        // Actualizar member
        await membersCollection.updateOne(
          { _id: member._id },
          {
            $set: {
              country: newCode,
              updatedAt: new Date(),
            },
          },
        );

        correctedCount++;
        console.log(
          `✅ ${member.firstName} ${member.lastName}: "${currentCountry}" → "${newCode}"`,
        );
      } catch (error) {
        console.error(`❌ Error procesando member ${member._id}:`, error);
        errorCount++;
      }
    }

    // 4. También corregir en global_products si los members tienen productos
    console.log(
      '\n🌐 Corrigiendo country en productos de members en global_products...',
    );
    const globalProductsCollection = globalDb.collection('global_products');

    // Buscar productos que tengan memberCountry incorrecto
    const globalProductsWithIncorrectMemberCountry =
      await globalProductsCollection
        .find({
          tenantName: tenantName,
          memberCountry: {
            $exists: true,
            $not: /^[A-Z]{2}$/,
          },
        })
        .toArray();

    console.log(
      `📦 Productos globales con memberCountry incorrecto: ${globalProductsWithIncorrectMemberCountry.length}`,
    );

    let globalCorrectedCount = 0;
    for (const product of globalProductsWithIncorrectMemberCountry) {
      try {
        const currentCountry = product.memberCountry;
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
              memberCountry: newCode,
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
    console.log(`✅ Members corregidos: ${correctedCount}`);
    console.log(`✅ Productos globales corregidos: ${globalCorrectedCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    console.log(
      `👥 Total members procesados: ${membersWithIncorrectCountry.length}`,
    );
    console.log(
      `📦 Total productos globales procesados: ${globalProductsWithIncorrectMemberCountry.length}`,
    );

    if (errorCount > 0) {
      console.log(
        '\n⚠️  Revisa los países no encontrados y agrégalos al archivo countryCodes.ts si es necesario',
      );
    }

    // 6. Verificación final
    console.log('\n🔍 Verificación final...');
    const remainingIncorrectMembers = await membersCollection.countDocuments({
      country: {
        $exists: true,
        $not: /^[A-Z]{2}$/,
      },
    });

    const remainingIncorrectGlobalProducts =
      await globalProductsCollection.countDocuments({
        tenantName: tenantName,
        memberCountry: {
          $exists: true,
          $not: /^[A-Z]{2}$/,
        },
      });

    console.log(
      `📊 Members restantes con country incorrecto: ${remainingIncorrectMembers}`,
    );
    console.log(
      `📊 Productos globales restantes con memberCountry incorrecto: ${remainingIncorrectGlobalProducts}`,
    );

    if (
      remainingIncorrectMembers === 0 &&
      remainingIncorrectGlobalProducts === 0
    ) {
      console.log('🎉 ¡Corrección completada exitosamente!');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n🔌 Conexión cerrada');
  }
}

if (require.main === module) {
  fixMemberCountryCodes().catch(console.error);
}
