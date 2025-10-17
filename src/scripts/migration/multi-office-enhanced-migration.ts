import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { TenantConnectionService } from '../../infra/db/tenant-connection.service';
import { TenantsService } from '../../tenants/tenants.service';
import { OfficesService } from '../../offices/offices.service';

/**
 * Migración mejorada Multi-Office que incluye:
 * 1. Asignación de officeId a productos y shipments
 * 2. Creación del objeto office completo (similar a fpWarehouse)
 * 3. Actualización de productos en colección global
 */

interface MigrationStats {
  tenantsProcessed: number;
  productsUpdated: number;
  productsWithOfficeObject: number;
  shipmentsUpdated: number;
  globalProductsUpdated: number;
  errors: string[];
}

async function runEnhancedMultiOfficeMigration(): Promise<void> {
  console.log('🚀 Iniciando migración mejorada Multi-Office...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const tenantConnectionService = app.get(TenantConnectionService);
  const tenantsService = app.get(TenantsService);
  const officesService = app.get(OfficesService);

  const stats: MigrationStats = {
    tenantsProcessed: 0,
    productsUpdated: 0,
    productsWithOfficeObject: 0,
    shipmentsUpdated: 0,
    globalProductsUpdated: 0,
    errors: [],
  };

  try {
    const tenants = await tenantsService.findAllTenants();
    console.log(`📋 Encontrados ${tenants.length} tenants para migrar\n`);

    for (const tenant of tenants) {
      try {
        console.log(`🏢 Procesando tenant: ${tenant.name}`);

        // Obtener oficina default del tenant
        const defaultOffice = await officesService.getDefaultOffice(
          tenant.name,
        );

        if (!defaultOffice) {
          console.log(
            `⚠️ No se encontró oficina default para tenant ${tenant.name}, saltando...`,
          );
          stats.errors.push(`Tenant ${tenant.name}: No default office found`);
          continue;
        }

        console.log(
          `✅ Oficina default encontrada: ${defaultOffice.name} (${defaultOffice._id})`,
        );

        // Migrar productos y shipments para este tenant
        const tenantStats = await migrateTenantData(
          tenant.name,
          defaultOffice,
          tenantConnectionService,
        );

        stats.productsUpdated += tenantStats.productsUpdated;
        stats.productsWithOfficeObject += tenantStats.productsWithOfficeObject;
        stats.shipmentsUpdated += tenantStats.shipmentsUpdated;
        stats.globalProductsUpdated += tenantStats.globalProductsUpdated;
        stats.tenantsProcessed++;

        console.log(`✅ Tenant ${tenant.name} migrado exitosamente`);
        console.log(
          `   - Productos actualizados: ${tenantStats.productsUpdated}`,
        );
        console.log(
          `   - Productos con objeto office: ${tenantStats.productsWithOfficeObject}`,
        );
        console.log(
          `   - Shipments actualizados: ${tenantStats.shipmentsUpdated}`,
        );
        console.log(
          `   - Productos globales actualizados: ${tenantStats.globalProductsUpdated}\n`,
        );
      } catch (error) {
        console.error(`❌ Error migrando tenant ${tenant.name}:`, error);
        stats.errors.push(`Tenant ${tenant.name}: ${error.message}`);
      }
    }

    // Reporte final
    console.log('\n📊 REPORTE FINAL DE MIGRACIÓN');
    console.log('='.repeat(50));
    console.log(
      `✅ Tenants procesados: ${stats.tenantsProcessed}/${tenants.length}`,
    );
    console.log(`📦 Productos actualizados: ${stats.productsUpdated}`);
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
    console.error('❌ Error general en la migración:', error);
    throw error;
  } finally {
    await app.close();
  }
}

async function migrateTenantData(
  tenantName: string,
  defaultOffice: any,
  tenantConnectionService: TenantConnectionService,
): Promise<{
  productsUpdated: number;
  productsWithOfficeObject: number;
  shipmentsUpdated: number;
  globalProductsUpdated: number;
}> {
  const connection =
    await tenantConnectionService.getTenantConnection(tenantName);
  const session = await connection.startSession();

  let productsUpdated = 0;
  let productsWithOfficeObject = 0;
  let shipmentsUpdated = 0;
  let globalProductsUpdated = 0;

  try {
    await session.withTransaction(async () => {
      // 1. Migrar productos en colección 'products'
      const productsCollection = connection.collection('products');

      // Actualizar productos con objeto office
      const productsResult = await productsCollection.updateMany(
        {
          location: 'Our office',
          office: { $exists: false },
          isDeleted: { $ne: true },
        },
        {
          $set: {
            office: {
              officeId: defaultOffice._id,
              officeCountryCode: defaultOffice.country,
              officeName: defaultOffice.name,
              assignedAt: new Date(),
              isDefault: defaultOffice.isDefault,
            },
          },
        },
        { session },
      );

      productsUpdated += productsResult.modifiedCount;
      productsWithOfficeObject += productsResult.modifiedCount;

      // 2. Migrar productos embebidos en colección 'members'
      const membersCollection = connection.collection('members');

      const membersResult = await membersCollection.updateMany(
        {
          'products.location': 'Our office',
          'products.office': { $exists: false },
          isDeleted: { $ne: true },
        },
        {
          $set: {
            'products.$[elem].office': {
              officeId: defaultOffice._id,
              officeCountryCode: defaultOffice.country,
              officeName: defaultOffice.name,
              assignedAt: new Date(),
              isDefault: defaultOffice.isDefault,
            },
          },
        },
        {
          arrayFilters: [
            {
              'elem.location': 'Our office',
              'elem.office': { $exists: false },
            },
          ],
          session,
        },
      );

      productsUpdated += membersResult.modifiedCount;
      productsWithOfficeObject += membersResult.modifiedCount;

      // 3. Migrar shipments con origin="Our office"
      const shipmentsCollection = connection.collection('shipments');

      const originShipmentsResult = await shipmentsCollection.updateMany(
        {
          origin: 'Our office',
          originOfficeId: { $exists: false },
          isDeleted: { $ne: true },
        },
        {
          $set: { originOfficeId: defaultOffice._id },
        },
        { session },
      );

      shipmentsUpdated += originShipmentsResult.modifiedCount;

      // 4. Migrar shipments con destination="Our office"
      const destinationShipmentsResult = await shipmentsCollection.updateMany(
        {
          destination: 'Our office',
          destinationOfficeId: { $exists: false },
          isDeleted: { $ne: true },
        },
        {
          $set: { destinationOfficeId: defaultOffice._id },
        },
        { session },
      );

      shipmentsUpdated += destinationShipmentsResult.modifiedCount;

      // 5. Actualizar productos en colección global
      try {
        const globalConnection =
          await tenantConnectionService.getTenantConnection('firstPlug');
        const globalProductsCollection =
          globalConnection.collection('global_products');

        const globalResult = await globalProductsCollection.updateMany(
          {
            tenantName: tenantName,
            location: 'Our office',
            officeId: { $exists: false },
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

        globalProductsUpdated += globalResult.modifiedCount;
      } catch (globalError) {
        console.warn(
          `⚠️ Error actualizando productos globales para ${tenantName}:`,
          globalError.message,
        );
      }
    });
  } catch (error) {
    console.error(`❌ Error en transacción para tenant ${tenantName}:`, error);
    throw error;
  } finally {
    await session.endSession();
  }

  return {
    productsUpdated,
    productsWithOfficeObject,
    shipmentsUpdated,
    globalProductsUpdated,
  };
}

// Ejecutar migración si se llama directamente
if (require.main === module) {
  runEnhancedMultiOfficeMigration()
    .then(() => {
      console.log(
        '\n🎉 Migración mejorada Multi-Office completada exitosamente!',
      );
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error ejecutando migración mejorada:', error);
      process.exit(1);
    });
}

export { runEnhancedMultiOfficeMigration };
