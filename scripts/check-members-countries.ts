import { config } from 'dotenv';
import { MongoClient } from 'mongodb';

config();

/**
 * Script para verificar países en productos de members
 */

async function checkMembersCountries() {
  const args = process.argv.slice(2);
  const tenantArg = args.find((arg) => arg.startsWith('--tenant='));

  if (!tenantArg) {
    console.error('❌ Error: Debes especificar --tenant=NOMBRE_TENANT');
    console.log('Uso: npm run check:members-countries -- --tenant=mechi_test');
    return;
  }

  const tenantName = tenantArg.split('=')[1];

  console.log(`🔍 VERIFICANDO PAÍSES EN PRODUCTOS DE MEMBERS - TENANT: ${tenantName}\n`);

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

    // Contar productos en members con fpWarehouse
    const membersWithProducts = await membersCollection
      .find({
        'products.fpWarehouse': { $exists: true },
      })
      .toArray();

    console.log(`👥 Members con productos en warehouse: ${membersWithProducts.length}\n`);

    // Extraer todos los productos con fpWarehouse
    const allProducts: any[] = [];
    for (const member of membersWithProducts) {
      if (member.products && Array.isArray(member.products)) {
        for (const product of member.products) {
          if (product.fpWarehouse) {
            allProducts.push({
              memberId: member._id,
              memberEmail: member.email,
              productId: product._id,
              productName: product.name,
              category: product.category,
              countryCode: product.fpWarehouse.warehouseCountryCode,
              warehouseId: product.fpWarehouse.warehouseId,
              warehouseName: product.fpWarehouse.warehouseName,
            });
          }
        }
      }
    }

    console.log(`📦 Total productos con fpWarehouse en members: ${allProducts.length}\n`);

    // Agrupar por país
    const byCountry = new Map<string, number>();
    for (const product of allProducts) {
      const country = product.countryCode || 'Sin país';
      byCountry.set(country, (byCountry.get(country) || 0) + 1);
    }

    console.log('🌍 DISTRIBUCIÓN POR PAÍS:\n');
    const sortedCountries = Array.from(byCountry.entries()).sort((a, b) => b[1] - a[1]);
    
    for (const [country, count] of sortedCountries) {
      console.log(`   ${country}: ${count} productos`);
    }
    console.log('');

    // Mostrar ejemplos de productos en países diferentes a AR
    const nonARProducts = allProducts.filter(p => p.countryCode !== 'AR');
    
    if (nonARProducts.length > 0) {
      console.log(`🌎 PRODUCTOS EN PAÍSES DIFERENTES A ARGENTINA: ${nonARProducts.length}\n`);
      
      for (const product of nonARProducts.slice(0, 10)) {
        console.log(`   📦 ${product.productName || 'Sin nombre'} (${product.category})`);
        console.log(`      País: ${product.countryCode}`);
        console.log(`      Warehouse: ${product.warehouseName}`);
        console.log(`      Warehouse ID: ${product.warehouseId}`);
        console.log(`      Member: ${product.memberEmail}\n`);
      }
      
      if (nonARProducts.length > 10) {
        console.log(`   ... y ${nonARProducts.length - 10} más\n`);
      }
    } else {
      console.log('✅ Todos los productos están en Argentina\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('🔌 Conexión cerrada');
  }
}

if (require.main === module) {
  checkMembersCountries().catch(console.error);
}

export { checkMembersCountries };

