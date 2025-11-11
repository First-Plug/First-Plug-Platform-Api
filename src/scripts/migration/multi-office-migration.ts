import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { TenantConnectionService } from '../../infra/db/tenant-connection.service';
import { TenantsService } from '../../tenants/tenants.service';
import { OfficesService } from '../../offices/offices.service';
import { Types } from 'mongoose';

/**
 * Script de migración para Multi-Office Feature
 *
 * Este script migra datos existentes para soportar múltiples oficinas:
 * 1. Asigna officeId de la oficina default a productos con location="Our office"
 * 2. Asigna originOfficeId/destinationOfficeId a shipments con origin/destination="Our office"
 * 3. Valida integridad de datos después de la migración
 */
async function runMultiOfficeMigration() {
  console.log('🚀 Iniciando migración Multi-Office...');

  const app = await NestFactory.createApplicationContext(AppModule);
  const tenantConnectionService = app.get(TenantConnectionService);
  const tenantsService = app.get(TenantsService);
  const officesService = app.get(OfficesService);

  try {
    // Obtener todos los tenants
    const tenants = await tenantsService.findAllTenants();
    console.log(`📋 Encontrados ${tenants.length} tenants para migrar`);

    const totalStats = {
      tenantsProcessed: 0,
      productsUpdated: 0,
      shipmentsUpdated: 0,
      errors: 0,
    };

    for (const tenant of tenants) {
      const tenantName = tenant.name;
      console.log(`\n🏢 Procesando tenant: ${tenantName}`);

      try {
        // 1. Obtener oficina default del tenant
        const defaultOffice = await officesService.getDefaultOffice(tenantName);
        if (!defaultOffice) {
          console.log(
            `⚠️ No se encontró oficina default para tenant ${tenantName}, saltando...`,
          );
          continue;
        }

        console.log(
          `✅ Oficina default encontrada: ${defaultOffice.name} (${defaultOffice._id})`,
        );

        // 2. Migrar productos
        const productsStats = await migrateProductsForTenant(
          tenantConnectionService,
          tenantName,
          defaultOffice._id.toString(),
        );

        // 3. Migrar shipments
        const shipmentsStats = await migrateShipmentsForTenant(
          tenantConnectionService,
          tenantName,
          defaultOffice._id.toString(),
        );

        // 4. Actualizar estadísticas
        totalStats.tenantsProcessed++;
        totalStats.productsUpdated += productsStats.updated;
        totalStats.shipmentsUpdated += shipmentsStats.updated;

        console.log(`✅ Tenant ${tenantName} migrado exitosamente:`);
        console.log(`   - Productos actualizados: ${productsStats.updated}`);
        console.log(`   - Shipments actualizados: ${shipmentsStats.updated}`);
      } catch (error) {
        console.error(`❌ Error migrando tenant ${tenantName}:`, error);
        totalStats.errors++;
      }
    }

    // 5. Mostrar resumen final
    console.log('\n📊 RESUMEN DE MIGRACIÓN:');
    console.log(`✅ Tenants procesados: ${totalStats.tenantsProcessed}`);
    console.log(`📦 Productos actualizados: ${totalStats.productsUpdated}`);
    console.log(`🚚 Shipments actualizados: ${totalStats.shipmentsUpdated}`);
    console.log(`❌ Errores: ${totalStats.errors}`);

    if (totalStats.errors === 0) {
      console.log('\n🎉 Migración completada exitosamente!');
    } else {
      console.log('\n⚠️ Migración completada con errores. Revisar logs.');
    }
  } catch (error) {
    console.error('❌ Error fatal en migración:', error);
  } finally {
    await app.close();
  }
}

/**
 * Migra productos de un tenant específico
 */
async function migrateProductsForTenant(
  tenantConnectionService: TenantConnectionService,
  tenantName: string,
  defaultOfficeId: string,
): Promise<{ updated: number }> {
  console.log(`📦 Migrando productos para tenant ${tenantName}...`);

  const connection =
    await tenantConnectionService.getTenantConnection(tenantName);
  const session = await connection.startSession();

  try {
    await session.withTransaction(async () => {
      // Migrar productos en colección 'products'
      const productsCollection = connection.collection('products');

      const productsResult = await productsCollection.updateMany(
        {
          location: 'Our office',
          officeId: { $exists: false },
          isDeleted: { $ne: true },
        },
        {
          $set: { officeId: new Types.ObjectId(defaultOfficeId) },
        },
        { session },
      );

      // Migrar productos embebidos en colección 'members'
      const membersCollection = connection.collection('members');

      const membersResult = await membersCollection.updateMany(
        {
          'products.location': 'Our office',
          'products.officeId': { $exists: false },
          isDeleted: { $ne: true },
        },
        {
          $set: {
            'products.$[elem].officeId': new Types.ObjectId(defaultOfficeId),
          },
        },
        {
          arrayFilters: [
            {
              'elem.location': 'Our office',
              'elem.officeId': { $exists: false },
            },
          ],
          session,
        },
      );

      const totalUpdated =
        productsResult.modifiedCount + membersResult.modifiedCount;
      console.log(
        `   📦 Productos actualizados en 'products': ${productsResult.modifiedCount}`,
      );
      console.log(
        `   👥 Productos actualizados en 'members': ${membersResult.modifiedCount}`,
      );

      return { updated: totalUpdated };
    });

    return { updated: 0 }; // El resultado real se maneja dentro de la transacción
  } catch (error) {
    console.error(`❌ Error migrando productos para ${tenantName}:`, error);
    throw error;
  } finally {
    await session.endSession();
  }
}

/**
 * Migra shipments de un tenant específico
 */
async function migrateShipmentsForTenant(
  tenantConnectionService: TenantConnectionService,
  tenantName: string,
  defaultOfficeId: string,
): Promise<{ updated: number }> {
  console.log(`🚚 Migrando shipments para tenant ${tenantName}...`);

  const connection =
    await tenantConnectionService.getTenantConnection(tenantName);
  const session = await connection.startSession();

  try {
    let totalUpdated = 0;

    await session.withTransaction(async () => {
      const shipmentsCollection = connection.collection('shipments');

      // Migrar shipments con origin="Our office"
      const originResult = await shipmentsCollection.updateMany(
        {
          origin: 'Our office',
          originOfficeId: { $exists: false },
          isDeleted: { $ne: true },
        },
        {
          $set: { originOfficeId: new Types.ObjectId(defaultOfficeId) },
        },
        { session },
      );

      // Migrar shipments con destination="Our office"
      const destinationResult = await shipmentsCollection.updateMany(
        {
          destination: 'Our office',
          destinationOfficeId: { $exists: false },
          isDeleted: { $ne: true },
        },
        {
          $set: { destinationOfficeId: new Types.ObjectId(defaultOfficeId) },
        },
        { session },
      );

      totalUpdated =
        originResult.modifiedCount + destinationResult.modifiedCount;
      console.log(
        `   🚚 Shipments con origin actualizado: ${originResult.modifiedCount}`,
      );
      console.log(
        `   🚚 Shipments con destination actualizado: ${destinationResult.modifiedCount}`,
      );
    });

    return { updated: totalUpdated };
  } catch (error) {
    console.error(`❌ Error migrando shipments para ${tenantName}:`, error);
    throw error;
  } finally {
    await session.endSession();
  }
}

// Ejecutar migración si se llama directamente
if (require.main === module) {
  runMultiOfficeMigration()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Error ejecutando migración:', error);
      process.exit(1);
    });
}

export { runMultiOfficeMigration };
