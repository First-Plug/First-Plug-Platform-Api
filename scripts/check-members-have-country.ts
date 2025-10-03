import { config } from 'dotenv';
import { MongoClient } from 'mongodb';

config();

/**
 * Script para verificar si los members tienen el campo country
 */

async function checkMembersHaveCountry() {
  const args = process.argv.slice(2);
  const tenantArg = args.find((arg) => arg.startsWith('--tenant='));

  if (!tenantArg) {
    console.error('❌ Error: Debes especificar --tenant=NOMBRE_TENANT');
    console.log('Uso: npm run check:members-country-field -- --tenant=mechi_test');
    return;
  }

  const tenantName = tenantArg.split('=')[1];

  console.log(`🔍 VERIFICANDO CAMPO country EN MEMBERS - TENANT: ${tenantName}\n`);

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ Error: MONGO_URI no está definido en .env');
    return;
  }

  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    console.log('✅ Conectado a MongoDB\n');

    const tenantDb = client.db(`tenant_${tenantName}`);
    const membersCollection = tenantDb.collection('members');

    // Total members
    const totalMembers = await membersCollection.countDocuments({});
    console.log(`👥 Total members: ${totalMembers}\n`);

    // Members con campo country
    const membersWithCountry = await membersCollection.countDocuments({
      country: { $exists: true, $ne: null, $ne: '' },
    });

    // Members sin campo country
    const membersWithoutCountry = await membersCollection.countDocuments({
      $or: [
        { country: { $exists: false } },
        { country: null },
        { country: '' },
      ],
    });

    console.log(`✅ Members CON country: ${membersWithCountry}`);
    console.log(`❌ Members SIN country: ${membersWithoutCountry}\n`);

    // Distribución por país
    if (membersWithCountry > 0) {
      console.log('🌍 DISTRIBUCIÓN POR PAÍS:\n');

      const byCountry = await membersCollection
        .aggregate([
          {
            $match: {
              country: { $exists: true, $ne: null, $ne: '' },
            },
          },
          {
            $group: {
              _id: '$country',
              count: { $sum: 1 },
            },
          },
          {
            $sort: { count: -1 },
          },
        ])
        .toArray();

      for (const country of byCountry) {
        console.log(`   ${country._id}: ${country.count} members`);
      }
      console.log('');
    }

    // Ejemplos de members sin country
    if (membersWithoutCountry > 0) {
      console.log('📋 EJEMPLOS DE MEMBERS SIN COUNTRY:\n');

      const examples = await membersCollection
        .find({
          $or: [
            { country: { $exists: false } },
            { country: null },
            { country: '' },
          ],
        })
        .limit(10)
        .toArray();

      for (const member of examples) {
        console.log(`   📧 ${member.email}`);
        console.log(`      Nombre: ${member.firstName} ${member.lastName}`);
        console.log(`      Country: ${member.country || 'NO DEFINIDO'}`);
        console.log(`      Productos: ${member.products?.length || 0}\n`);
      }

      if (membersWithoutCountry > 10) {
        console.log(`   ... y ${membersWithoutCountry - 10} más\n`);
      }
    }

    // Resumen
    console.log('📊 RESUMEN:\n');
    if (membersWithoutCountry === 0) {
      console.log('✅ Todos los members tienen el campo country definido\n');
    } else {
      console.log(`⚠️  ${membersWithoutCountry} members NO tienen country definido`);
      console.log('   Esto puede causar que los productos se asignen a Argentina por defecto\n');
      console.log('💡 SOLUCIÓN:');
      console.log('   1. Asegúrate de que todos los members tengan el campo country');
      console.log('   2. Puedes usar el tenant.countryCode como fallback\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('🔌 Conexión cerrada');
  }
}

if (require.main === module) {
  checkMembersHaveCountry().catch(console.error);
}

export { checkMembersHaveCountry };

