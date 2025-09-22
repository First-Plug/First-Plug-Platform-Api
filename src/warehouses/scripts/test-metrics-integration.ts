import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { WarehouseMetricsService } from '../services/warehouse-metrics.service';
import { GlobalProductSyncService } from '../../products/services/global-product-sync.service';
import { GlobalWarehouseMetricsService } from '../../superadmin/services/global-warehouse-metrics.service';
import { Types } from 'mongoose';

/**
 * Script para probar la integración de warehouses globales
 */
async function testGlobalWarehousesIntegration() {
  console.log('🚀 Probando integración de warehouses globales...');

  const app = await NestFactory.createApplicationContext(AppModule);
  const metricsService = app.get(WarehouseMetricsService);
  const syncService = app.get(GlobalProductSyncService);
  const globalWarehouseService = app.get(GlobalWarehouseMetricsService);

  try {
    // === PASO 1: Crear algunos productos de prueba ===
    console.log('\n📦 PASO 1: Creando productos de prueba...');

    // Producto 1: MacBook en warehouse AR
    await syncService.syncProduct({
      tenantId: 'test-tenant',
      tenantName: 'test-tenant',
      originalProductId: new Types.ObjectId(),
      sourceCollection: 'products',

      name: 'MacBook Pro Test',
      category: 'Computer',
      status: 'Available',
      location: 'FP warehouse',

      attributes: [
        { key: 'brand', value: 'Apple' },
        { key: 'model', value: 'MacBook Pro' },
      ],

      serialNumber: 'TEST123',
      productCondition: 'Optimal',
      recoverable: true,
      fp_shipment: false,
      activeShipment: false,

      fpWarehouse: {
        warehouseId: new Types.ObjectId('507f1f77bcf86cd799439011'),
        warehouseCountryCode: 'AR',
        warehouseName: 'Test Warehouse Argentina',
        assignedAt: new Date(),
        status: 'STORED',
      },
    });

    // Producto 2: Monitor en warehouse AR
    await syncService.syncProduct({
      tenantId: 'test-tenant',
      tenantName: 'test-tenant',
      originalProductId: new Types.ObjectId(),
      sourceCollection: 'products',

      name: 'Monitor Dell Test',
      category: 'Monitor',
      status: 'Available',
      location: 'FP warehouse',

      attributes: [
        { key: 'brand', value: 'Dell' },
        { key: 'model', value: 'UltraSharp' },
      ],

      serialNumber: 'TEST456',
      productCondition: 'Optimal',
      recoverable: true,
      fp_shipment: false,
      activeShipment: false,

      fpWarehouse: {
        warehouseId: new Types.ObjectId('507f1f77bcf86cd799439011'),
        warehouseCountryCode: 'AR',
        warehouseName: 'Test Warehouse Argentina',
        assignedAt: new Date(),
        status: 'STORED',
      },
    });

    console.log('✅ Productos de prueba creados');

    // === PASO 2: Probar métricas de warehouse específico ===
    console.log('\n📊 PASO 2: Probando métricas de warehouse específico...');

    const warehouseMetrics = await syncService.getWarehouseMetrics(
      '507f1f77bcf86cd799439011',
    );
    console.log(
      'Métricas del warehouse:',
      JSON.stringify(warehouseMetrics, null, 2),
    );

    // === PASO 3: Probar métricas por país ===
    console.log('\n🌍 PASO 3: Probando métricas por país...');

    const countryMetrics = await syncService.getCountryMetrics('AR');
    console.log(
      'Métricas de Argentina:',
      JSON.stringify(countryMetrics, null, 2),
    );

    // === PASO 4: Probar estadísticas globales ===
    console.log('\n🌐 PASO 4: Probando estadísticas globales...');

    const globalStats = await syncService.getGlobalStats();
    console.log('Estadísticas globales:', JSON.stringify(globalStats, null, 2));

    // === PASO 5: Probar integración con GlobalWarehouseMetricsService ===
    console.log(
      '\n🔗 PASO 5: Probando integración con GlobalWarehouseMetricsService (SuperAdmin)...',
    );

    try {
      // Probar el servicio transversal completo
      const allMetrics = await globalWarehouseService.getAllWarehouseMetrics();
      console.log(
        'Métricas de todos los warehouses (servicio transversal):',
        JSON.stringify(allMetrics, null, 2),
      );

      const globalOverview = await globalWarehouseService.getGlobalOverview();
      console.log('Resumen global:', JSON.stringify(globalOverview, null, 2));
    } catch (error) {
      console.log(
        '⚠️ Error esperado (no hay warehouses reales):',
        error.message,
      );
    }

    console.log('\n🎯 Test de integración de warehouses globales completado!');
  } catch (error) {
    console.error('❌ Error en el test:', error);
  } finally {
    await app.close();
  }
}

// Ejecutar el test
if (require.main === module) {
  testGlobalWarehousesIntegration().catch(console.error);
}

export { testGlobalWarehousesIntegration };
