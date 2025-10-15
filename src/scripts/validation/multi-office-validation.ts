import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { TenantConnectionService } from '../../infra/db/tenant-connection.service';
import { TenantsService } from '../../tenants/tenants.service';
import { OfficesService } from '../../offices/offices.service';

/**
 * Script de validación para Multi-Office Feature
 *
 * Este script valida la integridad de los datos después de la migración:
 * 1. Verifica que todos los productos con location="Our office" tengan officeId válido
 * 2. Verifica que todos los shipments con origin/destination="Our office" tengan officeIds válidos
 * 3. Verifica que todos los officeIds referencien oficinas existentes
 * 4. Reporta inconsistencias encontradas
 */
async function runMultiOfficeValidation() {
  console.log('🔍 Iniciando validación Multi-Office...');

  const app = await NestFactory.createApplicationContext(AppModule);
  const tenantConnectionService = app.get(TenantConnectionService);
  const tenantsService = app.get(TenantsService);
  const officesService = app.get(OfficesService);

  try {
    // Obtener todos los tenants
    const tenants = await tenantsService.findAllTenants();
    console.log(`📋 Validando ${tenants.length} tenants...`);

    const totalStats = {
      tenantsValidated: 0,
      productsValidated: 0,
      shipmentsValidated: 0,
      inconsistenciesFound: 0,
      errors: 0,
    };

    const inconsistencies: string[] = [];

    for (const tenant of tenants) {
      const tenantName = tenant.name;
      console.log(`\n🏢 Validando tenant: ${tenantName}`);

      try {
        // 1. Obtener todas las oficinas del tenant
        const offices = await officesService.findAllByTenantName(tenantName);
        const officeIds = new Set(
          offices.map((office) => office._id.toString()),
        );

        console.log(`🏢 Oficinas encontradas: ${offices.length}`);

        // 2. Validar productos
        const productsStats = await validateProductsForTenant(
          tenantConnectionService,
          tenantName,
          officeIds,
          inconsistencies,
        );

        // 3. Validar shipments
        const shipmentsStats = await validateShipmentsForTenant(
          tenantConnectionService,
          tenantName,
          officeIds,
          inconsistencies,
        );

        // 4. Actualizar estadísticas
        totalStats.tenantsValidated++;
        totalStats.productsValidated += productsStats.validated;
        totalStats.shipmentsValidated += shipmentsStats.validated;
        totalStats.inconsistenciesFound +=
          productsStats.inconsistencies + shipmentsStats.inconsistencies;

        console.log(`✅ Tenant ${tenantName} validado:`);
        console.log(`   - Productos validados: ${productsStats.validated}`);
        console.log(`   - Shipments validados: ${shipmentsStats.validated}`);
        console.log(
          `   - Inconsistencias: ${productsStats.inconsistencies + shipmentsStats.inconsistencies}`,
        );
      } catch (error) {
        console.error(`❌ Error validando tenant ${tenantName}:`, error);
        totalStats.errors++;
      }
    }

    // 5. Mostrar resumen final
    console.log('\n📊 RESUMEN DE VALIDACIÓN:');
    console.log(`✅ Tenants validados: ${totalStats.tenantsValidated}`);
    console.log(`📦 Productos validados: ${totalStats.productsValidated}`);
    console.log(`🚚 Shipments validados: ${totalStats.shipmentsValidated}`);
    console.log(
      `⚠️ Inconsistencias encontradas: ${totalStats.inconsistenciesFound}`,
    );
    console.log(`❌ Errores: ${totalStats.errors}`);

    // 6. Mostrar inconsistencias detalladas
    if (inconsistencies.length > 0) {
      console.log('\n🚨 INCONSISTENCIAS DETALLADAS:');
      inconsistencies.forEach((inconsistency, index) => {
        console.log(`${index + 1}. ${inconsistency}`);
      });
    }

    if (totalStats.inconsistenciesFound === 0 && totalStats.errors === 0) {
      console.log(
        '\n🎉 Validación completada exitosamente! No se encontraron inconsistencias.',
      );
    } else {
      console.log(
        '\n⚠️ Validación completada con inconsistencias. Revisar logs.',
      );
    }
  } catch (error) {
    console.error('❌ Error fatal en validación:', error);
  } finally {
    await app.close();
  }
}

/**
 * Valida productos de un tenant específico
 */
async function validateProductsForTenant(
  tenantConnectionService: TenantConnectionService,
  tenantName: string,
  validOfficeIds: Set<string>,
  inconsistencies: string[],
): Promise<{ validated: number; inconsistencies: number }> {
  console.log(`📦 Validando productos para tenant ${tenantName}...`);

  const connection =
    await tenantConnectionService.getTenantConnection(tenantName);
  let validated = 0;
  let inconsistenciesCount = 0;

  try {
    // Validar productos en colección 'products'
    const productsCollection = connection.collection('products');

    // 1. Productos con location="Our office" sin officeId
    const productsWithoutOfficeId = await productsCollection
      .find({
        location: 'Our office',
        officeId: { $exists: false },
        isDeleted: { $ne: true },
      })
      .toArray();

    if (productsWithoutOfficeId.length > 0) {
      inconsistencies.push(
        `${tenantName}: ${productsWithoutOfficeId.length} productos con location="Our office" sin officeId`,
      );
      inconsistenciesCount += productsWithoutOfficeId.length;
    }

    // 2. Productos con officeId inválido
    const productsWithInvalidOfficeId = await productsCollection
      .find({
        location: 'Our office',
        officeId: { $exists: true },
        isDeleted: { $ne: true },
      })
      .toArray();

    for (const product of productsWithInvalidOfficeId) {
      if (
        product.officeId &&
        !validOfficeIds.has(product.officeId.toString())
      ) {
        inconsistencies.push(
          `${tenantName}: Producto ${product._id} tiene officeId inválido: ${product.officeId}`,
        );
        inconsistenciesCount++;
      }
    }

    validated +=
      productsWithoutOfficeId.length + productsWithInvalidOfficeId.length;

    // 3. Validar productos embebidos en colección 'members'
    const membersCollection = connection.collection('members');
    const membersWithProducts = await membersCollection
      .find({
        'products.location': 'Our office',
        isDeleted: { $ne: true },
      })
      .toArray();

    for (const member of membersWithProducts) {
      for (const product of member.products || []) {
        if (product.location === 'Our office') {
          validated++;

          if (!product.officeId) {
            inconsistencies.push(
              `${tenantName}: Producto embebido ${product._id} en member ${member._id} sin officeId`,
            );
            inconsistenciesCount++;
          } else if (!validOfficeIds.has(product.officeId.toString())) {
            inconsistencies.push(
              `${tenantName}: Producto embebido ${product._id} tiene officeId inválido: ${product.officeId}`,
            );
            inconsistenciesCount++;
          }
        }
      }
    }

    return { validated, inconsistencies: inconsistenciesCount };
  } catch (error) {
    console.error(`❌ Error validando productos para ${tenantName}:`, error);
    throw error;
  }
}

/**
 * Valida shipments de un tenant específico
 */
async function validateShipmentsForTenant(
  tenantConnectionService: TenantConnectionService,
  tenantName: string,
  validOfficeIds: Set<string>,
  inconsistencies: string[],
): Promise<{ validated: number; inconsistencies: number }> {
  console.log(`🚚 Validando shipments para tenant ${tenantName}...`);

  const connection =
    await tenantConnectionService.getTenantConnection(tenantName);
  let validated = 0;
  let inconsistenciesCount = 0;

  try {
    const shipmentsCollection = connection.collection('shipments');

    // 1. Shipments con origin="Our office" sin originOfficeId
    const shipmentsWithoutOriginOfficeId = await shipmentsCollection
      .find({
        origin: 'Our office',
        originOfficeId: { $exists: false },
        isDeleted: { $ne: true },
      })
      .toArray();

    if (shipmentsWithoutOriginOfficeId.length > 0) {
      inconsistencies.push(
        `${tenantName}: ${shipmentsWithoutOriginOfficeId.length} shipments con origin="Our office" sin originOfficeId`,
      );
      inconsistenciesCount += shipmentsWithoutOriginOfficeId.length;
    }

    // 2. Shipments con destination="Our office" sin destinationOfficeId
    const shipmentsWithoutDestinationOfficeId = await shipmentsCollection
      .find({
        destination: 'Our office',
        destinationOfficeId: { $exists: false },
        isDeleted: { $ne: true },
      })
      .toArray();

    if (shipmentsWithoutDestinationOfficeId.length > 0) {
      inconsistencies.push(
        `${tenantName}: ${shipmentsWithoutDestinationOfficeId.length} shipments con destination="Our office" sin destinationOfficeId`,
      );
      inconsistenciesCount += shipmentsWithoutDestinationOfficeId.length;
    }

    // 3. Shipments con officeIds inválidos
    const shipmentsWithOfficeIds = await shipmentsCollection
      .find({
        $or: [
          { origin: 'Our office', originOfficeId: { $exists: true } },
          { destination: 'Our office', destinationOfficeId: { $exists: true } },
        ],
        isDeleted: { $ne: true },
      })
      .toArray();

    for (const shipment of shipmentsWithOfficeIds) {
      validated++;

      if (shipment.origin === 'Our office' && shipment.originOfficeId) {
        if (!validOfficeIds.has(shipment.originOfficeId.toString())) {
          inconsistencies.push(
            `${tenantName}: Shipment ${shipment._id} tiene originOfficeId inválido: ${shipment.originOfficeId}`,
          );
          inconsistenciesCount++;
        }
      }

      if (
        shipment.destination === 'Our office' &&
        shipment.destinationOfficeId
      ) {
        if (!validOfficeIds.has(shipment.destinationOfficeId.toString())) {
          inconsistencies.push(
            `${tenantName}: Shipment ${shipment._id} tiene destinationOfficeId inválido: ${shipment.destinationOfficeId}`,
          );
          inconsistenciesCount++;
        }
      }
    }

    validated +=
      shipmentsWithoutOriginOfficeId.length +
      shipmentsWithoutDestinationOfficeId.length;

    return { validated, inconsistencies: inconsistenciesCount };
  } catch (error) {
    console.error(`❌ Error validando shipments para ${tenantName}:`, error);
    throw error;
  }
}

// Ejecutar validación si se llama directamente
if (require.main === module) {
  runMultiOfficeValidation()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Error ejecutando validación:', error);
      process.exit(1);
    });
}

export { runMultiOfficeValidation };
