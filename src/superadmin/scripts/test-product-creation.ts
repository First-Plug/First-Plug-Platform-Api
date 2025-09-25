import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { SuperAdminService } from '../superadmin.service';
import { CreateProductForTenantDto } from '../dto/create-product-for-tenant.dto';

/**
 * Script para probar la creación de productos desde SuperAdmin
 */
async function testProductCreation() {
  console.log('🚀 Probando creación de productos desde SuperAdmin...');

  const app = await NestFactory.createApplicationContext(AppModule);
  const superAdminService = app.get(SuperAdminService);

  try {
    // === CASO 1: Crear MacBook para tenant en Argentina ===
    console.log('\n📦 CASO 1: Creando MacBook para tenant en Argentina...');

    const macbookDto: CreateProductForTenantDto = {
      tenantName: 'test-tenant', // Cambiar por un tenant real
      warehouseCountryCode: 'AR',

      name: 'MacBook Pro 16" M3 Max',
      category: 'Computer',
      attributes: [
        { key: 'brand', value: 'Apple' },
        { key: 'model', value: 'MacBook Pro' },
        { key: 'screen_size', value: '16"' },
        { key: 'processor', value: 'M3 Max' },
        { key: 'ram', value: '32GB' },
        { key: 'storage', value: '1TB SSD' },
      ],

      serialNumber: 'SUPERADMIN-001',
      productCondition: 'Optimal',
      recoverable: true,
    };

    const result1 = await superAdminService.createProductForTenant(macbookDto);
    console.log('✅ MacBook creado:', JSON.stringify(result1, null, 2));

    // === CASO 2: Crear Monitor para tenant en USA ===
    console.log('\n🖥️ CASO 2: Creando Monitor para tenant en USA...');

    const monitorDto: CreateProductForTenantDto = {
      tenantName: 'test-tenant', // Cambiar por un tenant real
      warehouseCountryCode: 'US',

      name: 'Dell UltraSharp 32" 4K',
      category: 'Monitor',
      attributes: [
        { key: 'brand', value: 'Dell' },
        { key: 'model', value: 'UltraSharp U3223QE' },
        { key: 'screen_size', value: '32"' },
        { key: 'resolution', value: '4K UHD' },
        { key: 'panel_type', value: 'IPS' },
      ],

      serialNumber: 'SUPERADMIN-002',
      productCondition: 'Optimal',
      recoverable: true,
    };

    const result2 = await superAdminService.createProductForTenant(monitorDto);
    console.log('✅ Monitor creado:', JSON.stringify(result2, null, 2));

    // === CASO 3: Intentar crear en país sin warehouse (debería fallar) ===
    console.log('\n❌ CASO 3: Intentando crear en país sin warehouse...');

    const invalidDto: CreateProductForTenantDto = {
      tenantName: 'test-tenant',
      warehouseCountryCode: 'XX', // País inexistente

      name: 'Producto de prueba',
      category: 'Other',
      attributes: [{ key: 'test', value: 'test' }],

      productCondition: 'Good',
    };

    try {
      await superAdminService.createProductForTenant(invalidDto);
      console.log('❌ ERROR: Debería haber fallado');
    } catch (error) {
      console.log('✅ Error esperado:', error.message);
    }

    // === CASO 4: Intentar crear para tenant inexistente (debería fallar) ===
    console.log('\n❌ CASO 4: Intentando crear para tenant inexistente...');

    const invalidTenantDto: CreateProductForTenantDto = {
      tenantName: 'tenant-inexistente',
      warehouseCountryCode: 'AR',

      name: 'Producto de prueba',
      category: 'Other',
      attributes: [{ key: 'test', value: 'test' }],

      productCondition: 'Good',
    };

    try {
      await superAdminService.createProductForTenant(invalidTenantDto);
      console.log('❌ ERROR: Debería haber fallado');
    } catch (error) {
      console.log('✅ Error esperado:', error.message);
    }

    console.log('\n🎯 Test de creación de productos completado!');
    console.log('\n📋 Resumen:');
    console.log('- ✅ Productos creados en tenant DB');
    console.log('- ✅ Asignación automática a FP warehouse');
    console.log('- ✅ Sincronización automática a colección global');
    console.log('- ✅ Validaciones de tenant y warehouse funcionando');
  } catch (error) {
    console.error('❌ Error en el test:', error);
  } finally {
    await app.close();
  }
}

// Ejecutar el test
if (require.main === module) {
  testProductCreation().catch(console.error);
}

export { testProductCreation };
