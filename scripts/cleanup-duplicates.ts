console.log('🧹 SCRIPT DE LIMPIEZA DE DUPLICADOS INICIADO');

import { MongoClient } from 'mongodb';

const MONGO_URI =
  process.env.DB_CONNECTION_STRING ||
  'mongodb+srv://santiago:2025devs%2B@firstplug-dev.qxiv5.mongodb.net/firstPlug';

async function cleanupDuplicates(tenantName: string) {
  console.log(`🧹 Limpiando duplicados para tenant: ${tenantName}`);
  
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('✅ Conectado a MongoDB Atlas');

    const mainDb = client.db('firstPlug');
    const tenantsCollection = mainDb.collection('tenants');
    const usersCollection = mainDb.collection('users');

    // 1. Buscar todos los registros con el tenantName
    console.log(`🔍 Buscando registros con tenantName: ${tenantName}`);
    const allRecords = await tenantsCollection.find({ tenantName }).toArray();
    
    console.log(`📋 Encontrados ${allRecords.length} registros:`);
    allRecords.forEach((record, index) => {
      console.log(`   ${index + 1}. ID: ${record._id}`);
      console.log(`      Email: ${record.email}`);
      console.log(`      Name: ${record.name}`);
      console.log(`      CreatedAt: ${record.createdAt}`);
    });

    if (allRecords.length <= 1) {
      console.log('✅ No hay duplicados para limpiar');
      return;
    }

    // 2. Eliminar usuarios migrados si existen
    console.log('🔍 Verificando usuarios migrados...');
    const migratedUsers = await usersCollection.find({ tenantName }).toArray();
    
    if (migratedUsers.length > 0) {
      console.log(`🗑️ Eliminando ${migratedUsers.length} usuarios migrados...`);
      await usersCollection.deleteMany({ tenantName });
      console.log('✅ Usuarios migrados eliminados');
    }

    // 3. Mantener solo el registro más antiguo (original)
    const sortedRecords = allRecords.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    
    const originalRecord = sortedRecords[0];
    const duplicateRecords = sortedRecords.slice(1);

    console.log(`📌 Manteniendo registro original:`);
    console.log(`   ID: ${originalRecord._id}`);
    console.log(`   Email: ${originalRecord.email}`);
    console.log(`   CreatedAt: ${originalRecord.createdAt}`);

    // 4. Eliminar duplicados
    if (duplicateRecords.length > 0) {
      const duplicateIds = duplicateRecords.map(record => record._id);
      console.log(`🗑️ Eliminando ${duplicateIds.length} registros duplicados...`);
      
      duplicateRecords.forEach(record => {
        console.log(`   - Eliminando: ${record._id} (${record.email})`);
      });

      await tenantsCollection.deleteMany({
        _id: { $in: duplicateIds }
      });

      console.log('✅ Registros duplicados eliminados');
    }

    // 5. Limpiar oficina si existe
    console.log('🔍 Verificando oficina en tenant DB...');
    const tenantDb = client.db(`tenant_${tenantName}`);
    const officesCollection = tenantDb.collection('offices');
    const office = await officesCollection.findOne({});
    
    if (office) {
      console.log('🗑️ Eliminando oficina existente...');
      await officesCollection.deleteMany({});
      console.log('✅ Oficina eliminada');
    }

    console.log(`\n🎉 LIMPIEZA COMPLETADA:`);
    console.log(`✅ Tenant: ${tenantName}`);
    console.log(`✅ Registro original mantenido: ${originalRecord.email}`);
    console.log(`✅ ${duplicateRecords.length} duplicados eliminados`);
    console.log(`✅ Usuarios migrados eliminados: ${migratedUsers.length}`);
    console.log(`✅ Oficina eliminada: ${office ? 'Sí' : 'No'}`);

  } catch (error) {
    console.error('❌ Error en limpieza:', error.message);
  } finally {
    await client.close();
  }
}

// Script principal
async function main() {
  try {
    const tenantName = process.argv[2];
    
    if (!tenantName) {
      console.error('❌ Uso: npm run cleanup:duplicates <tenantName>');
      console.error('❌ Ejemplo: npm run cleanup:duplicates mechi_test');
      process.exit(1);
    }

    console.log(`⚠️ ADVERTENCIA: Esto eliminará registros duplicados de ${tenantName}`);
    console.log(`⚠️ Solo se mantendrá el registro más antiguo (original)`);
    
    await cleanupDuplicates(tenantName);
    
  } catch (error) {
    console.error('💥 ERROR CRÍTICO:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
