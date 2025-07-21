console.log('🔥 SCRIPT DE MIGRACIÓN DIRECTA INICIADO');

import { MongoClient } from 'mongodb';

// Configuración de conexión (usar la URI de MongoDB Atlas)
const MONGO_URI =
  process.env.DB_CONNECTION_STRING ||
  'mongodb+srv://santiago:2025devs%2B@firstplug-dev.qxiv5.mongodb.net/firstPlug';
console.log(
  `🔗 URI de conexión: ${MONGO_URI.replace(/\/\/.*:.*@/, '//***:***@')}`,
);

interface MigrationResult {
  success: boolean;
  tenantName: string;
  migratedUsers?: any[];
  createdOffice?: any;
  updatedTenant?: any;
  error?: string;
}

async function migrateTenantDirect(
  tenantName: string,
  dryRun: boolean = false,
): Promise<MigrationResult> {
  console.log(`🚀 Iniciando migración directa para tenant: ${tenantName}`);
  console.log(
    `🔒 Modo: ${dryRun ? 'DRY RUN (solo lectura)' : 'EJECUCIÓN REAL'}`,
  );

  const client = new MongoClient(MONGO_URI);

  try {
    // Conectar a MongoDB
    console.log('📡 Conectando a MongoDB...');
    await client.connect();
    console.log('✅ Conectado a MongoDB');

    // Verificar qué bases de datos existen
    console.log('🔍 Verificando bases de datos disponibles...');
    const adminDb = client.db().admin();
    const dbList = await adminDb.listDatabases();
    console.log('📋 Bases de datos disponibles:');
    dbList.databases.forEach((db) => {
      const sizeInMB = db.sizeOnDisk
        ? (db.sizeOnDisk / 1024 / 1024).toFixed(2)
        : 'N/A';
      console.log(`   - ${db.name} (${sizeInMB} MB)`);
    });

    // Obtener bases de datos (usar firstPlug de MongoDB Atlas)
    const mainDb = client.db('firstPlug');
    const tenantDb = client.db(`tenant_${tenantName}`);

    console.log(`📋 Usando bases de datos: firstPlug, tenant_${tenantName}`);

    // 1. Buscar usuarios viejos en la colección tenants
    console.log(`🔍 Buscando usuarios con tenantName: ${tenantName}`);
    const tenantsCollection = mainDb.collection('tenants');

    // Debug: Ver todas las colecciones y buscar el usuario
    console.log('🔍 Verificando colecciones disponibles...');
    const collections = await mainDb.listCollections().toArray();
    console.log('📋 Colecciones en firstPlug:');
    collections.forEach((col) => {
      console.log(`   - ${col.name}`);
    });

    console.log('🔍 Verificando estructura de colección tenants...');
    const allTenants = await tenantsCollection.find({}).limit(3).toArray();
    console.log(
      `📋 Total documentos en tenants: ${await tenantsCollection.countDocuments()}`,
    );
    console.log('📋 Primeros 3 documentos en tenants:');
    allTenants.forEach((doc, index) => {
      console.log(`   ${index + 1}. ID: ${doc._id}`);
      console.log(`      tenantName: ${doc.tenantName || 'NO EXISTE'}`);
      console.log(`      name: ${doc.name || 'NO EXISTE'}`);
      console.log(`      email: ${doc.email || 'NO EXISTE'}`);
    });

    // Buscar el usuario específico en todas las colecciones
    console.log(
      `🔍 Buscando usuario mechi@email.com en todas las colecciones...`,
    );
    for (const col of collections) {
      const collection = mainDb.collection(col.name);
      const userInCol = await collection.findOne({ email: 'mechi@email.com' });
      if (userInCol) {
        console.log(`✅ Usuario encontrado en colección: ${col.name}`);
        console.log(`   - ID: ${userInCol._id}`);
        console.log(`   - tenantName: ${userInCol.tenantName || 'NO EXISTE'}`);
        console.log(`   - name: ${userInCol.name || 'NO EXISTE'}`);
        console.log(`   - email: ${userInCol.email}`);
      }
    }

    const oldUsers = await tenantsCollection.find({ tenantName }).toArray();
    console.log(
      `🔍 Búsqueda con tenantName="${tenantName}" encontró: ${oldUsers.length} documentos`,
    );

    if (oldUsers.length === 0) {
      // Intentar búsqueda alternativa
      console.log('🔍 Intentando búsqueda alternativa...');
      const alternativeSearch = await tenantsCollection
        .find({
          $or: [
            { tenantName: tenantName },
            { name: { $regex: tenantName, $options: 'i' } },
            { email: { $regex: tenantName, $options: 'i' } },
          ],
        })
        .toArray();

      console.log(
        `🔍 Búsqueda alternativa encontró: ${alternativeSearch.length} documentos`,
      );
      if (alternativeSearch.length > 0) {
        console.log('📋 Documentos encontrados en búsqueda alternativa:');
        alternativeSearch.forEach((doc) => {
          console.log(
            `   - ID: ${doc._id}, tenantName: ${doc.tenantName}, email: ${doc.email}`,
          );
        });
      }

      throw new Error(`No se encontraron usuarios para tenant: ${tenantName}`);
    }

    console.log(`📋 Encontrados ${oldUsers.length} usuarios para migrar`);
    oldUsers.forEach((user) => {
      console.log(`   - ${user.email} (${user.name})`);
    });

    // 2. Verificar si ya está migrado
    const usersCollection = mainDb.collection('users');
    const existingUser = await usersCollection.findOne({
      email: { $in: oldUsers.map((u) => u.email) },
    });

    if (existingUser) {
      throw new Error(
        `Tenant ya migrado. Usuario encontrado: ${existingUser.email}`,
      );
    }

    // 3. Migrar usuarios a colección users
    console.log(`👥 Migrando ${oldUsers.length} usuarios...`);
    const migratedUsers: Array<{
      id: any;
      email: string;
      firstName: string;
    }> = [];

    for (const oldUser of oldUsers) {
      console.log(`👤 Migrando usuario: ${oldUser.email}`);

      const newUser = {
        firstName: oldUser.name?.split(' ')[0] || 'Usuario',
        lastName: oldUser.name?.split(' ').slice(1).join(' ') || '',
        email: oldUser.email,
        accountProvider: oldUser.accountProvider || 'credentials',
        password: oldUser.password,
        salt: oldUser.salt,
        role: 'user', // ✅ Agregar rol user
        tenantId: oldUser._id, // ID del tenant original
        tenantName: oldUser.tenantName,
        widgets: oldUser.widgets || [],
        phone: '', // Datos personales vacíos
        address: '',
        apartment: '',
        city: '',
        state: '',
        country: '',
        zipCode: '',
        image: oldUser.image || '',
        status: 'active',
        isActive: true,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (dryRun) {
        console.log(`🔍 [DRY RUN] Insertaría usuario: ${newUser.email}`);
        // Simular ID para DRY RUN
        migratedUsers.push({
          id: 'dry-run-id',
          email: newUser.email,
          firstName: newUser.firstName,
        });
      } else {
        const result = await usersCollection.insertOne(newUser);
        migratedUsers.push({
          id: result.insertedId,
          email: newUser.email,
          firstName: newUser.firstName,
        });
      }

      console.log(`✅ Usuario migrado: ${newUser.email}`);
    }

    // 4. Crear oficina en tenant DB
    const firstUser = oldUsers[0]; // Usar primer usuario para datos de oficina
    console.log(`🏢 Creando oficina en tenant_${tenantName}...`);

    const officesCollection = tenantDb.collection('offices');
    const newOffice = {
      name: 'Oficina Principal',
      email: '', // Vacío inicialmente, se completará después
      phone: firstUser.phone || '',
      country: firstUser.country || '',
      city: firstUser.city || '',
      state: firstUser.state || '',
      zipCode: firstUser.zipCode || '',
      address: firstUser.address || '',
      apartment: firstUser.apartment || '',
      tenantId: firstUser._id,
      isDefault: true,
      isActive: true,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (dryRun) {
      console.log(`🔍 [DRY RUN] Crearía oficina: ${newOffice.name}`);
    } else {
      await officesCollection.insertOne(newOffice);
      console.log(`✅ Oficina creada: ${newOffice.name}`);
    }

    // 5. Limpiar TODOS los tenants con el mismo tenantName
    console.log(`🧹 Limpiando ${oldUsers.length} registros de tenant...`);
    const firstUserId = migratedUsers[0]?.id;

    // Mantener solo el primer registro como tenant principal
    const mainTenant = oldUsers[0];

    // Actualizar el tenant principal
    if (dryRun) {
      console.log(
        `🔍 [DRY RUN] Actualizaría tenant principal: ${mainTenant._id}`,
      );
    } else {
      await tenantsCollection.updateOne(
        { _id: mainTenant._id },
        {
          $unset: {
            // Remover datos de usuario
            email: 1,
            password: 1,
            salt: 1,
            accountProvider: 1,
            widgets: 1,
            // Remover datos de oficina
            phone: 1,
            country: 1,
            city: 1,
            state: 1,
            zipCode: 1,
            address: 1,
            apartment: 1,
          },
          $set: {
            // Actualizar datos corporativos
            name: `${tenantName.charAt(0).toUpperCase() + tenantName.slice(1)} Company`,
            createdBy: firstUserId,
            isActive: true,
            updatedAt: new Date(),
          },
        },
      );
    }

    // Eliminar los registros adicionales (usuarios duplicados)
    if (oldUsers.length > 1) {
      const additionalIds = oldUsers.slice(1).map((user) => user._id);
      console.log(
        `🗑️ Eliminando ${additionalIds.length} registros duplicados...`,
      );

      if (dryRun) {
        console.log(
          `🔍 [DRY RUN] Eliminaría ${additionalIds.length} registros duplicados`,
        );
      } else {
        await tenantsCollection.deleteMany({
          _id: { $in: additionalIds },
        });
        console.log(
          `✅ ${additionalIds.length} registros duplicados eliminados`,
        );
      }
    }

    console.log(`✅ Tenant principal limpiado`);

    return {
      success: true,
      tenantName,
      migratedUsers,
      createdOffice: {
        id: dryRun ? 'dry-run-office-id' : 'office-created',
        name: newOffice.name,
        address: newOffice.address,
      },
      updatedTenant: {
        id: firstUser._id,
        name: `${firstUser.name} Company`,
      },
    };
  } catch (error) {
    console.error('❌ Error en migración:', error.message);
    return {
      success: false,
      tenantName,
      error: error.message,
    };
  } finally {
    await client.close();
    console.log('📡 Conexión a MongoDB cerrada');
  }
}

// Script principal
async function main() {
  try {
    console.log('🚀 INICIANDO MIGRACIÓN DIRECTA');

    const tenantName = process.argv[2];

    if (!tenantName) {
      console.error('❌ Uso: npm run migrate:direct <tenantName>');
      console.error('❌ Ejemplo: npm run migrate:direct mechi_test');
      process.exit(1);
    }

    console.log(`🎯 Migrando tenant: ${tenantName}`);

    const result = await migrateTenantDirect(tenantName);

    if (result.success) {
      console.log(`\n🎉 MIGRACIÓN EXITOSA:`);
      console.log(`✅ Tenant: ${result.tenantName}`);
      console.log(`✅ Usuarios migrados: ${result.migratedUsers?.length || 0}`);
      result.migratedUsers?.forEach((user) => {
        console.log(`   - ${user.email} (${user.firstName})`);
      });
      console.log(`✅ Oficina creada: ${result.createdOffice.name}`);
      console.log(`✅ Tenant actualizado: ${result.updatedTenant.name}`);
    } else {
      console.log(`\n💥 MIGRACIÓN FALLÓ:`);
      console.log(`❌ Tenant: ${result.tenantName}`);
      console.log(`❌ Error: ${result.error}`);
    }
  } catch (error) {
    console.error('💥 ERROR CRÍTICO:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
