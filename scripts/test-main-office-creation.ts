import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { TenantModelRegistry } from '../src/infra/db/tenant-model-registry';
import { TenantsService } from '../src/tenants/tenants.service';

async function testMainOfficeCreation() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const tenantModelRegistry = app.get(TenantModelRegistry);
    const tenantsService = app.get(TenantsService);

    // Crear un tenant de prueba
    const testTenantName = `test-tenant-${Date.now()}`;

    await tenantsService.create({
      tenantName: testTenantName,
      name: `Test Tenant ${Date.now()}`,
    });

    // Acceder al modelo de offices (esto debería crear automáticamente la Main Office)

    const OfficeModel =
      await tenantModelRegistry.getOfficeModel(testTenantName);

    // Verificar que la Main Office fue creada
    const mainOffice = await OfficeModel.findOne({
      isDefault: true,
      isDeleted: false,
    });

    if (mainOffice) {
    } else {
      console.log(`❌ Main Office NO fue creada`);
    }

    // Verificar que accesos posteriores no crean duplicados

    await tenantModelRegistry.getOfficeModel(testTenantName);

    const officesCount = await OfficeModel.countDocuments({
      isDefault: true,
      isDeleted: false,
    });

    if (officesCount === 1) {
    } else {
      console.log(
        `❌ Se crearon ${officesCount} oficinas default (debería ser 1)`,
      );
    }
  } catch (error) {
    console.error('❌ Error durante la prueba:', error.message);
  } finally {
    await app.close();
  }
}

// Ejecutar la prueba
testMainOfficeCreation().catch(console.error);
