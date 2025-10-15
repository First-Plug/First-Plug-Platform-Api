#!/usr/bin/env ts-node

/**
 * Migración Multi-Office para un tenant específico
 *
 * Migra:
 * 1. Productos en colección 'products' del tenant (location: "Our office")
 * 2. Shipments en colección 'shipments' del tenant (origin/destination: "Our office")
 * 3. Productos en colección 'global_products' (firstPlug DB)
 */

import { config } from 'dotenv';
import { MongoClient } from 'mongodb';

// Cargar variables de entorno
config();

interface TenantMigrationStats {
  tenantName: string;
  productsUpdated: number;
  productsWithOfficeObject: number;
  shipmentsUpdated: number;
  globalProductsUpdated: number;
  errors: string[];
}

async function runSingleTenantOfficeMigration(): Promise<void> {
  const args = process.argv.slice(2);
  const tenantArg = args.find((arg) => arg.startsWith('--tenant='));

  if (!tenantArg) {
    console.error('❌ Error: Debes especificar --tenant=NOMBRE_TENANT');
    console.log('Uso: npm run migrate:single-tenant -- --tenant=mechi_test');
    return;
  }

  const tenantName = tenantArg.split('=')[1];

  if (!tenantName) {
    console.error('❌ Error: Nombre de tenant vacío');
    return;
  }

  console.log(
    `🚀 Iniciando migración Multi-Office para tenant: ${tenantName}\n`,
  );

  // Mostrar URI que se va a usar
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017';
  console.log(`🔗 Conectando a: ${mongoUri}`);

  // Conectar a MongoDB directamente
  const client = new MongoClient(mongoUri);

  const stats: TenantMigrationStats = {
    tenantName,
    productsUpdated: 0,
    productsWithOfficeObject: 0,
    shipmentsUpdated: 0,
    globalProductsUpdated: 0,
    errors: [],
  };

  try {
    await client.connect();
    console.log('✅ Conectado a MongoDB');

    // 1. Buscar el tenant real por tenantName
    const firstPlugDb = client.db('firstPlug');
    const tenantsCollection = firstPlugDb.collection('tenants');

    console.log(`🔍 Buscando tenant con nombre: ${tenantName}`);
    const tenant = await tenantsCollection.findOne({ tenantName: tenantName });

    if (!tenant) {
      console.error(`❌ No se encontró tenant con nombre: ${tenantName}`);
      return;
    }

    console.log(
      `✅ Tenant encontrado: ${tenant.tenantName} (ID: ${tenant._id})`,
    );

    // 2. Conectar a la base de datos del tenant
    const tenantDbName = `tenant_${tenantName}`;
    console.log(`📂 Buscando base de datos: ${tenantDbName}`);
    const tenantDb = client.db(tenantDbName);

    // 3. Obtener oficina default del tenant
    const officesCollection = tenantDb.collection('offices');
    const defaultOffice = await officesCollection.findOne({
      isDefault: true,
      isDeleted: { $ne: true },
    });

    if (!defaultOffice) {
      throw new Error(
        `No se encontró oficina default para tenant ${tenantName}`,
      );
    }

    console.log(
      `✅ Oficina default encontrada: ${defaultOffice.name} (${defaultOffice._id})`,
    );
    console.log(`   - País: ${defaultOffice.country}`);
    console.log(`   - Email: ${defaultOffice.email || 'No definido'}`);
    console.log(`   - Teléfono: ${defaultOffice.phone || 'No definido'}\n`);

    // 4. Migrar datos del tenant
    await migrateTenantData(tenantDb, defaultOffice, stats);

    // 5. Migrar colección global
    await migrateGlobalProducts(firstPlugDb, tenantName, defaultOffice, stats);

    // 6. Reporte final
    console.log('\n📊 REPORTE DE MIGRACIÓN');
    console.log('='.repeat(50));
    console.log(`🏢 Tenant: ${stats.tenantName}`);
    console.log(
      `📦 Productos actualizados (products): ${stats.productsUpdated}`,
    );
    console.log(
      `🏢 Productos con objeto office: ${stats.productsWithOfficeObject}`,
    );
    console.log(`🚚 Shipments actualizados: ${stats.shipmentsUpdated}`);
    console.log(
      `🌐 Productos globales actualizados: ${stats.globalProductsUpdated}`,
    );

    if (stats.errors.length > 0) {
      console.log(`\n❌ Errores encontrados (${stats.errors.length}):`);
      stats.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    } else {
      console.log('\n🎉 Migración completada sin errores!');
    }
  } catch (error) {
    console.error(`❌ Error en la migración del tenant ${tenantName}:`, error);
    throw error;
  } finally {
    await client.close();
    console.log('🔌 Conexión cerrada');
  }
}

async function migrateTenantData(
  tenantDb: any,
  defaultOffice: any,
  stats: TenantMigrationStats,
): Promise<void> {
  console.log(`📋 Migrando datos del tenant ${stats.tenantName}...`);

  try {
    // 1. Migrar productos en colección 'products'
    console.log('   📦 Migrando productos en colección products...');
    const productsCollection = tenantDb.collection('products');

    const productsResult = await productsCollection.updateMany(
      {
        location: 'Our office',
        $or: [{ officeId: { $exists: false } }, { office: { $exists: false } }],
        isDeleted: { $ne: true },
      },
      {
        $set: {
          officeId: defaultOffice._id,
          office: {
            officeId: defaultOffice._id,
            officeCountryCode: defaultOffice.country,
            officeName: defaultOffice.name,
            assignedAt: new Date(),
            isDefault: defaultOffice.isDefault,
          },
        },
      },
    );

    stats.productsUpdated = productsResult.modifiedCount;
    stats.productsWithOfficeObject = productsResult.modifiedCount;
    console.log(`   ✅ ${productsResult.modifiedCount} productos actualizados`);

    // 2. Migrar shipments
    console.log('   🚚 Migrando shipments...');
    const shipmentsCollection = tenantDb.collection('shipments');

    // Origin = Our office
    const originShipmentsResult = await shipmentsCollection.updateMany(
      {
        origin: 'Our office',
        originOfficeId: { $exists: false },
        isDeleted: { $ne: true },
      },
      {
        $set: { originOfficeId: defaultOffice._id },
      },
    );

    // Destination = Our office
    const destinationShipmentsResult = await shipmentsCollection.updateMany(
      {
        destination: 'Our office',
        destinationOfficeId: { $exists: false },
        isDeleted: { $ne: true },
      },
      {
        $set: { destinationOfficeId: defaultOffice._id },
      },
    );

    stats.shipmentsUpdated =
      originShipmentsResult.modifiedCount +
      destinationShipmentsResult.modifiedCount;
    console.log(`   ✅ ${stats.shipmentsUpdated} shipments actualizados`);
  } catch (error) {
    console.error(`❌ Error en migración de datos del tenant:`, error);
    stats.errors.push(`Tenant data migration: ${error.message}`);
    throw error;
  }
}

async function migrateGlobalProducts(
  firstPlugDb: any,
  tenantName: string,
  defaultOffice: any,
  stats: TenantMigrationStats,
): Promise<void> {
  console.log(`🌐 Migrando productos globales para tenant ${tenantName}...`);

  try {
    const globalProductsCollection = firstPlugDb.collection('global_products');

    const globalResult = await globalProductsCollection.updateMany(
      {
        tenantName: tenantName,
        location: 'Our office',
        $or: [{ officeId: { $exists: false } }, { office: { $exists: false } }],
        isDeleted: { $ne: true },
      },
      {
        $set: {
          officeId: defaultOffice._id,
          office: {
            officeId: defaultOffice._id,
            officeCountryCode: defaultOffice.country,
            officeName: defaultOffice.name,
            assignedAt: new Date(),
            isDefault: defaultOffice.isDefault,
          },
        },
      },
    );

    stats.globalProductsUpdated = globalResult.modifiedCount;
    console.log(
      `   ✅ ${globalResult.modifiedCount} productos globales actualizados`,
    );
  } catch (globalError) {
    console.warn(
      `⚠️ Error actualizando productos globales:`,
      globalError.message,
    );
    stats.errors.push(`Global products migration: ${globalError.message}`);
  }
}

// Función para ejecutar desde línea de comandos
async function main() {
  try {
    await runSingleTenantOfficeMigration();
    console.log(`\n🎉 Migración completada exitosamente!`);
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error ejecutando migración:`, error);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

export { runSingleTenantOfficeMigration };
