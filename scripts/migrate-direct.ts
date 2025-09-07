console.log('🔥 SCRIPT DE MIGRACIÓN DIRECTA INICIADO');
// por consola para migrar el tenant
//npm run migrate:direct retool

// Por consola para probar como quedaria el tenant migrado sin cambiarlo realmente en base de datos
// npm run migrate:direct retool --dry-run

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
  message?: string;
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

    // 🔧 VERIFICAR SI YA ESTÁ MIGRADO
    console.log('🔍 Verificando si el tenant ya está migrado...');
    const usersCollection = mainDb.collection('users');
    const existingMigratedUser = await usersCollection.findOne({
      tenantName: tenantName,
    });

    if (existingMigratedUser) {
      console.log('⚠️ TENANT YA MIGRADO');
      console.log(`   - Usuario encontrado: ${existingMigratedUser.email}`);
      console.log('   - Use el script de rollback si necesita revertir');
      return {
        success: false,
        message: `Tenant ${tenantName} ya está migrado`,
        tenantName,
        error: 'Tenant already migrated',
      };
    }

    // 🔧 BUSCAR DOCUMENTOS DEL TENANT
    const oldUsers = await tenantsCollection.find({ tenantName }).toArray();

    // 🔧 FILTRAR SOLO DOCUMENTOS CON EMAIL VÁLIDO (usuarios reales)
    const validUsers = oldUsers.filter(
      (user) => user.email && user.email.trim() !== '',
    );
    console.log(
      `🔍 Filtrados ${validUsers.length} usuarios válidos de ${oldUsers.length} documentos`,
    );
    if (validUsers.length === 0) {
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

    console.log(`📋 Encontrados ${validUsers.length} usuarios para migrar`);
    validUsers.forEach((user) => {
      console.log(`   - ${user.email} (${user.name})`);
    });

    // 2. Verificación adicional por email (ya verificado arriba, pero por seguridad)
    const existingUser = await usersCollection.findOne({
      email: { $in: validUsers.map((u) => u.email) },
    });

    if (existingUser) {
      console.log('⚠️ Usuario específico ya migrado:', existingUser.email);
      return {
        success: false,
        tenantName,
        error: `Usuario ya migrado: ${existingUser.email}`,
      };
    }

    // 3. Migrar usuarios a colección users
    console.log(`👥 Migrando ${validUsers.length} usuarios...`);
    const migratedUsers: Array<{
      id: any;
      email: string;
      firstName: string;
    }> = [];

    // 🔧 CORRECCIÓN: Identificar el tenant principal (el que se mantendrá)
    const mainTenant = validUsers[0]; // El primer usuario será el tenant principal
    console.log(
      `🏢 Tenant principal identificado: ${mainTenant._id} (${mainTenant.email})`,
    );

    for (const oldUser of validUsers) {
      console.log(`👤 Migrando usuario: ${oldUser.email}`);

      // 🔧 CORRECCIÓN: Crear objeto base sin password/salt
      const newUser: any = {
        firstName: oldUser.name?.split(' ')[0] || 'Usuario',
        lastName: oldUser.name?.split(' ').slice(1).join(' ') || '',
        email: oldUser.email,
        accountProvider: oldUser.accountProvider || 'credentials',
        role: 'user', // ✅ Agregar rol user
        tenantId: mainTenant._id, // 🔧 CORRECCIÓN: ID del tenant principal, NO del usuario
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

      // 🔧 CORRECCIÓN: Solo agregar password/salt si usa credentials
      if (
        oldUser.accountProvider === 'credentials' ||
        !oldUser.accountProvider
      ) {
        newUser.password = oldUser.password;
        newUser.salt = oldUser.salt;
        console.log(
          `   - Usuario con credentials: password ${oldUser.password ? 'presente' : 'ausente'}`,
        );
      } else {
        console.log(
          `   - Usuario con ${oldUser.accountProvider}: sin password/salt`,
        );
      }

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

    // 4. Crear oficina en tenant DB (verificar si ya existe)
    const firstUser = validUsers[0]; // Usar primer usuario para datos de oficina
    const officesCollection = tenantDb.collection('offices');

    // Verificar si ya existe una oficina
    const existingOffice = await officesCollection.findOne({});
    if (existingOffice) {
      console.log('⚠️ Ya existe una oficina, saltando creación');
    } else {
      console.log(`🏢 Creando nueva oficina en tenant_${tenantName}...`);

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
        tenantId: mainTenant._id, // 🔧 CORRECCIÓN: ID del tenant principal, NO del usuario
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
    }

    // 5. Limpiar TODOS los tenants con el mismo tenantName
    console.log(`🧹 Limpiando ${validUsers.length} registros de tenant...`);
    const firstUserId = migratedUsers[0]?.id;

    // 5. Actualizar el tenant principal (ya identificado arriba)
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
    if (validUsers.length > 1) {
      const additionalIds = validUsers.slice(1).map((user) => user._id);
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
        name: 'Oficina Principal',
        address: firstUser.address || '',
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
    const isDryRun =
      process.argv[3] === '--dry-run' || process.argv[3] === 'dry-run';

    // 🔍 DEBUG: Mostrar argumentos recibidos
    console.log('🔍 DEBUG - Argumentos recibidos:', process.argv);
    console.log('🔍 DEBUG - tenantName:', tenantName);
    console.log('🔍 DEBUG - isDryRun:', isDryRun);
    console.log('🔍 DEBUG - process.argv[3]:', process.argv[3]);

    if (!tenantName) {
      console.error('❌ Uso: npm run migrate:direct <tenantName> [--dry-run]');
      console.error('❌ Ejemplo: npm run migrate:direct mechi_test');
      console.error(
        '❌ Ejemplo DRY RUN: npm run migrate:direct mechi_test --dry-run',
      );
      process.exit(1);
    }

    console.log(`🎯 Migrando tenant: ${tenantName}`);
    if (isDryRun) {
      console.log(
        '🔍 MODO DRY RUN ACTIVADO - Solo simulación, no se harán cambios',
      );
    }

    const result = await migrateTenantDirect(tenantName, isDryRun);

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
