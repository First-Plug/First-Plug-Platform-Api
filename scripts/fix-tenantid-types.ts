import { config } from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';

// Cargar variables de entorno
config();

/**
 * Script para convertir tenantId de String a ObjectId en global_products
 *
 * PROBLEMA:
 * - Algunos productos tienen tenantId como String debido a que el schema
 *   anterior lo definía como string
 * - Mongoose convertía ObjectId a String automáticamente
 *
 * SOLUCIÓN:
 * - Buscar todos los productos con tenantId como String
 * - Convertir a ObjectId usando el tenantName
 */

async function fixTenantIdTypes() {
  console.log('🔧 Iniciando conversión de tenantId de String a ObjectId...\n');

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ Error: MONGO_URI no está definido en .env');
    return;
  }

  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    console.log('✅ Conectado a MongoDB\n');

    const firstPlugDb = client.db('firstPlug');
    const globalProductsCollection = firstPlugDb.collection('global_products');
    const tenantsCollection = firstPlugDb.collection('tenants');

    // 1. Obtener todos los productos
    const allProducts = await globalProductsCollection.find({}).toArray();
    console.log(
      `📊 Total productos en global_products: ${allProducts.length}\n`,
    );

    // 2. Filtrar productos con tenantId como String
    const productsWithStringId = allProducts.filter(
      (p) => typeof p.tenantId === 'string',
    );

    console.log(
      `🔍 Productos con tenantId como String: ${productsWithStringId.length}`,
    );

    if (productsWithStringId.length === 0) {
      console.log(
        '✅ ¡Todos los productos ya tienen tenantId como ObjectId!\n',
      );
      return;
    }

    // 3. Agrupar por tenantName
    const tenantGroups = new Map<string, any[]>();
    for (const product of productsWithStringId) {
      const tenantName = product.tenantName;
      if (!tenantGroups.has(tenantName)) {
        tenantGroups.set(tenantName, []);
      }
      tenantGroups.get(tenantName)!.push(product);
    }

    console.log(`\n📋 Tenants afectados: ${tenantGroups.size}`);
    for (const [tenantName, products] of tenantGroups.entries()) {
      console.log(`   - ${tenantName}: ${products.length} productos`);
    }

    // 4. Convertir cada grupo
    let totalUpdated = 0;
    let totalErrors = 0;

    console.log('\n🔄 Iniciando conversión...\n');

    for (const [tenantName, products] of tenantGroups.entries()) {
      console.log(`\n📦 Procesando tenant: ${tenantName}`);

      // Buscar el tenant para obtener su ObjectId
      const tenant = await tenantsCollection.findOne({ tenantName });

      if (!tenant) {
        console.error(`   ❌ No se encontró tenant con nombre: ${tenantName}`);
        totalErrors += products.length;
        continue;
      }

      console.log(`   ✅ Tenant encontrado: ${tenant._id}`);
      console.log(`   📦 Productos a actualizar: ${products.length}`);

      // Procesar cada producto individualmente para manejar duplicados
      let updated = 0;
      let deleted = 0;
      let errors = 0;

      for (const product of products) {
        try {
          // Verificar si existe un duplicado con ObjectId
          const duplicateWithObjectId = await globalProductsCollection.findOne({
            tenantId: new ObjectId(tenant._id),
            originalProductId: product.originalProductId,
            _id: { $ne: product._id }, // Diferente _id
          });

          if (duplicateWithObjectId) {
            // Hay un duplicado con ObjectId, eliminar el que tiene String
            console.log(
              `   🗑️  Eliminando duplicado con String: ${product._id} (originalProductId: ${product.originalProductId})`,
            );
            await globalProductsCollection.deleteOne({ _id: product._id });
            deleted++;
          } else {
            // No hay duplicado, convertir a ObjectId
            await globalProductsCollection.updateOne(
              { _id: product._id },
              { $set: { tenantId: new ObjectId(tenant._id) } },
            );
            updated++;
          }
        } catch (error) {
          console.error(
            `   ❌ Error procesando producto ${product._id}: ${error.message}`,
          );
          errors++;
        }
      }

      console.log(`   ✅ Actualizados: ${updated} productos`);
      if (deleted > 0) {
        console.log(`   🗑️  Eliminados (duplicados): ${deleted} productos`);
      }
      if (errors > 0) {
        console.log(`   ❌ Errores: ${errors} productos`);
      }

      totalUpdated += updated;
      totalErrors += errors;
    }

    // 5. Verificar resultado
    console.log('\n📊 RESUMEN FINAL:');
    console.log(
      `   - Total productos procesados: ${productsWithStringId.length}`,
    );
    console.log(`   - Productos actualizados: ${totalUpdated}`);
    console.log(`   - Errores: ${totalErrors}`);

    // Verificar que no queden productos con String
    const remainingStringIds = await globalProductsCollection.countDocuments({
      tenantId: { $type: 'string' },
    });

    console.log(`\n🔍 Verificación final:`);
    console.log(
      `   - Productos con tenantId como String: ${remainingStringIds}`,
    );

    if (remainingStringIds === 0) {
      console.log(
        '\n🎉 ¡ÉXITO! Todos los productos tienen tenantId como ObjectId\n',
      );
    } else {
      console.log(
        `\n⚠️ Advertencia: Todavía hay ${remainingStringIds} productos con tenantId como String\n`,
      );
    }
  } catch (error) {
    console.error('❌ Error durante la conversión:', error);
  } finally {
    await client.close();
    console.log('🔌 Conexión cerrada');
  }
}

// Ejecutar script
if (require.main === module) {
  fixTenantIdTypes()
    .then(() => {
      console.log('✅ Script finalizado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

export { fixTenantIdTypes };
