console.log('🔄 SCRIPT DE ROLLBACK DIRECTO INICIADO');

import { MongoClient } from 'mongodb';

// Usar la misma URI que el script de migración
const MONGO_URI =
  process.env.DB_CONNECTION_STRING ||
  'mongodb+srv://santiago:2025devs%2B@firstplug-dev.qxiv5.mongodb.net/firstPlug';

async function rollbackMigration(tenantName: string) {
  console.log(`🔄 Iniciando rollback para tenant: ${tenantName}`);

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ Conectado a MongoDB Atlas');

    const mainDb = client.db('firstPlug');
    const tenantDb = client.db(`tenant_${tenantName}`);

    // 🔧 NUEVO: Buscar tenant existente para preservar configuración
    console.log('🔍 Buscando tenant existente para preservar configuración...');
    const tenantsCollection = mainDb.collection('tenants');
    const existingTenant = await tenantsCollection.findOne({ tenantName });

    let preservedConfig = {
      computerExpiration: 1,
      isRecoverableConfig: {},
      image: '',
    };

    if (existingTenant) {
      console.log('✅ Tenant existente encontrado, preservando configuración:');
      preservedConfig = {
        computerExpiration: existingTenant.computerExpiration || 1,
        isRecoverableConfig: existingTenant.isRecoverableConfig || {},
        image: existingTenant.image || '',
      };
      console.log(
        `   - computerExpiration: ${preservedConfig.computerExpiration}`,
      );
      console.log(
        `   - isRecoverableConfig: ${Object.keys(preservedConfig.isRecoverableConfig).length} campos`,
      );
      console.log(
        `   - image: ${preservedConfig.image ? 'presente' : 'ausente'}`,
      );
    } else {
      console.log(
        '⚠️ No se encontró tenant existente, usando valores por defecto',
      );
    }

    // 1. Buscar usuarios migrados
    console.log('🔍 Buscando usuarios migrados...');
    const usersCollection = mainDb.collection('users');
    const migratedUsers = await usersCollection
      .find({
        tenantName: tenantName,
      })
      .toArray();

    if (migratedUsers.length === 0) {
      console.log('⚠️ No se encontraron usuarios migrados');
      return;
    }

    console.log(`📋 Encontrados ${migratedUsers.length} usuarios migrados:`);
    migratedUsers.forEach((user) => {
      console.log(`   - ${user.email} (${user.firstName})`);
    });

    // 2. Buscar oficina en tenant DB
    console.log('🔍 Buscando oficina migrada...');
    const officesCollection = tenantDb.collection('offices');
    const office = await officesCollection.findOne({ isDefault: true });

    // 3. Restaurar usuarios como registros de tenant
    console.log('🔄 Restaurando usuarios como registros de tenant...');

    for (const user of migratedUsers) {
      // 🔧 CORRECCIÓN: Crear objeto base sin password/salt
      const restoredTenant: any = {
        tenantName: user.tenantName,
        name: user.firstName + (user.lastName ? ` ${user.lastName}` : ''),
        email: user.email,
        accountProvider: user.accountProvider,
        widgets: user.widgets || [],
        // Restaurar datos de oficina si existe
        phone: office?.phone || '',
        country: office?.country || '',
        city: office?.city || '',
        state: office?.state || '',
        zipCode: office?.zipCode || '',
        address: office?.address || '',
        apartment: office?.apartment || '',
        // 🔧 USAR configuración preservada del tenant
        computerExpiration: preservedConfig.computerExpiration,
        isRecoverableConfig: preservedConfig.isRecoverableConfig,
        // 🔧 USAR imagen personal del usuario
        image: user.image || '',
        createdAt: user.createdAt,
        updatedAt: new Date(),
      };

      // 🔧 CORRECCIÓN: Solo agregar password/salt si usa credentials
      if (user.accountProvider === 'credentials' || !user.accountProvider) {
        restoredTenant.password = user.password;
        restoredTenant.salt = user.salt;
        console.log(
          `   - Usuario con credentials: password ${user.password ? 'presente' : 'ausente'}`,
        );
      } else {
        console.log(
          `   - Usuario con ${user.accountProvider}: sin password/salt`,
        );
      }

      await tenantsCollection.insertOne(restoredTenant);
      console.log(`✅ Usuario restaurado como tenant: ${user.email}`);
    }

    // 4. Eliminar usuarios de users collection
    console.log('🗑️ Eliminando usuarios migrados...');
    await usersCollection.deleteMany({
      tenantName: tenantName,
    });

    // 5. Eliminar oficina de tenant DB
    if (office) {
      console.log('🗑️ Eliminando oficina...');
      await officesCollection.deleteOne({ _id: office._id });
    }

    // 6. Restaurar tenant original (eliminar el limpio)
    console.log('🔄 Restaurando tenant original...');
    const cleanTenant = await tenantsCollection.findOne({
      tenantName: tenantName,
      createdBy: { $exists: true }, // El tenant limpio tiene createdBy
    });

    if (cleanTenant) {
      await tenantsCollection.deleteOne({ _id: cleanTenant._id });
      console.log('✅ Tenant limpio eliminado');
    }

    console.log(`✅ Rollback completado para ${tenantName}`);
  } catch (error) {
    console.error('❌ Error en rollback:', error.message);
  } finally {
    await client.close();
  }
}

// Script principal
async function main() {
  try {
    const tenantName = process.argv[2];

    if (!tenantName) {
      console.error('❌ Uso: npm run rollback:direct <tenantName>');
      console.error('❌ Ejemplo: npm run rollback:direct mechi_test');
      process.exit(1);
    }

    console.log(`⚠️ ADVERTENCIA: Esto revertirá la migración de ${tenantName}`);
    console.log(`⚠️ Los datos volverán al formato anterior`);

    await rollbackMigration(tenantName);
  } catch (error) {
    console.error('💥 ERROR CRÍTICO:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
