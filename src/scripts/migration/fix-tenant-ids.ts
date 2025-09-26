#!/usr/bin/env ts-node

/**
 * SCRIPT DE CORRECCIÓN: Arreglar tenantId en global_products
 * 
 * Reemplaza tenantId string por ObjectId real del tenant
 */

import { config } from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';

// Cargar variables de entorno
config();

async function fixTenantIds() {
  const args = process.argv.slice(2);
  const tenantArg = args.find(arg => arg.startsWith('--tenant='));
  
  if (!tenantArg) {
    console.error('❌ Error: Debes especificar --tenant=NOMBRE_TENANT');
    console.log('Uso: npm run fix:tenant-ids -- --tenant=mechi_test');
    return;
  }

  const tenantName = tenantArg.split('=')[1];
  
  if (!tenantName) {
    console.error('❌ Error: Nombre de tenant vacío');
    return;
  }

  console.log(`🔧 CORRECCIÓN: Arreglando tenantId para tenant ${tenantName}`);

  // Mostrar URI que se va a usar
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017';
  console.log(`🔗 Conectando a: ${mongoUri}`);

  // Conectar a MongoDB directamente
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    console.log('✅ Conectado a MongoDB');

    // Conectar a la base de datos firstPlug
    const firstPlugDb = client.db('firstPlug');
    const tenantsCollection = firstPlugDb.collection('tenants');
    const globalProductsCollection = firstPlugDb.collection('global_products');

    // 1. Buscar el tenant real por tenantName
    console.log(`🔍 Buscando tenant con nombre: ${tenantName}`);
    const tenant = await tenantsCollection.findOne({ tenantName: tenantName });

    if (!tenant) {
      console.error(`❌ No se encontró tenant con nombre: ${tenantName}`);
      console.log('📋 Tenants disponibles:');
      const allTenants = await tenantsCollection.find({}).toArray();
      allTenants.forEach((t, index) => {
        console.log(`   ${index + 1}. ${t.tenantName} (ID: ${t._id})`);
      });
      return;
    }

    console.log(`✅ Tenant encontrado:`);
    console.log(`   - Nombre: ${tenant.tenantName}`);
    console.log(`   - ID: ${tenant._id}`);
    console.log(`   - Company: ${tenant.name}`);

    // 2. Contar productos con tenantId incorrecto
    const productsWithWrongId = await globalProductsCollection.countDocuments({
      tenantId: tenantName // String en lugar de ObjectId
    });

    console.log(`📦 Productos con tenantId incorrecto: ${productsWithWrongId}`);

    if (productsWithWrongId === 0) {
      console.log('✅ No hay productos que necesiten corrección');
      return;
    }

    // 3. Mostrar algunos ejemplos antes de la corrección
    console.log('\n📋 Ejemplos de productos a corregir:');
    const sampleProducts = await globalProductsCollection.find({
      tenantId: tenantName
    }).limit(3).toArray();

    sampleProducts.forEach((product, index) => {
      console.log(`   ${index + 1}. ${product.name || 'Sin nombre'} - tenantId actual: "${product.tenantId}" (${typeof product.tenantId})`);
    });

    // 4. Confirmar antes de proceder
    console.log(`\n⚠️  ATENCIÓN: Se van a actualizar ${productsWithWrongId} productos`);
    console.log(`   - Cambiar tenantId de: "${tenantName}" (string)`);
    console.log(`   - Cambiar tenantId a: ${tenant._id} (ObjectId)`);

    // 5. Realizar la actualización
    console.log('\n🔄 Actualizando productos...');
    
    const updateResult = await globalProductsCollection.updateMany(
      {
        tenantId: tenantName // Buscar por string
      },
      {
        $set: {
          tenantId: new ObjectId(tenant._id), // Reemplazar con ObjectId
          updatedAt: new Date()
        }
      }
    );

    console.log(`✅ CORRECCIÓN COMPLETADA:`);
    console.log(`   - Productos que coincidieron: ${updateResult.matchedCount}`);
    console.log(`   - Productos actualizados: ${updateResult.modifiedCount}`);

    // 6. Verificar resultado
    const productsWithCorrectId = await globalProductsCollection.countDocuments({
      tenantId: new ObjectId(tenant._id)
    });

    const remainingWrongIds = await globalProductsCollection.countDocuments({
      tenantId: tenantName
    });

    console.log(`\n🔍 Verificación:`);
    console.log(`   - Productos con tenantId correcto: ${productsWithCorrectId}`);
    console.log(`   - Productos con tenantId incorrecto restantes: ${remainingWrongIds}`);

    // 7. Mostrar algunos ejemplos después de la corrección
    console.log('\n📋 Ejemplos de productos corregidos:');
    const correctedProducts = await globalProductsCollection.find({
      tenantId: new ObjectId(tenant._id)
    }).limit(3).toArray();

    correctedProducts.forEach((product, index) => {
      console.log(`   ${index + 1}. ${product.name || 'Sin nombre'} - tenantId corregido: ${product.tenantId} (${typeof product.tenantId})`);
    });

    if (remainingWrongIds === 0 && productsWithCorrectId === updateResult.modifiedCount) {
      console.log('\n🎉 ¡Corrección exitosa! Todos los tenantId han sido actualizados correctamente');
    } else {
      console.log('\n⚠️ Advertencia: Algunos productos pueden no haberse actualizado correctamente');
    }

    // 8. Resumen final
    console.log('\n📊 RESUMEN FINAL:');
    console.log(`   - Tenant: ${tenant.tenantName} (${tenant._id})`);
    console.log(`   - Productos corregidos: ${updateResult.modifiedCount}`);
    console.log(`   - Total productos del tenant en global: ${productsWithCorrectId}`);

  } catch (error) {
    console.error('❌ Error en corrección:', error);
  } finally {
    await client.close();
    console.log('🔌 Conexión cerrada');
  }
}

if (require.main === module) {
  fixTenantIds().catch(console.error);
}
