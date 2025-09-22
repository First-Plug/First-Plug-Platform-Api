import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { WarehousesService } from '../warehouses.service';

import { WarehouseMetricsService } from '../services/warehouse-metrics.service';

/**
 * Script para probar la migración automática de warehouses
 */

async function testMigration() {
  console.log('🧪 Starting warehouse migration test...');

  const app = await NestFactory.createApplicationContext(AppModule);
  const warehousesService = app.get(WarehousesService);

  const metricsService = app.get(WarehouseMetricsService);

  try {
    // 1. Listar warehouses disponibles
    console.log('\n📋 Available warehouses:');
    const warehouses = await warehousesService.findAll();

    warehouses.forEach((country) => {
      console.log(`\n🌍 ${country.country} (${country.countryCode}):`);
      country.warehouses.forEach((warehouse) => {
        const status = warehouse.isActive ? '✅ ACTIVE' : '⚪ INACTIVE';
        const deleted = warehouse.isDeleted ? '🗑️ DELETED' : '';
        console.log(`   - ${warehouse.name || 'Unnamed'} ${status} ${deleted}`);
        console.log(`     ID: ${warehouse._id}`);
      });
    });

    // 2. Buscar un país con múltiples warehouses para probar
    const testCountry = warehouses.find((c) => c.warehouses.length > 1);

    if (!testCountry) {
      console.log(
        '\n⚠️  No country found with multiple warehouses for testing',
      );
      console.log(
        '💡 Create multiple warehouses in a country first to test migration',
      );
      return;
    }

    console.log(`\n🎯 Testing migration in ${testCountry.country}...`);

    const activeWarehouse = testCountry.warehouses.find(
      (w) => w.isActive && !w.isDeleted,
    );
    const inactiveWarehouse = testCountry.warehouses.find(
      (w) => !w.isActive && !w.isDeleted,
    );

    if (!activeWarehouse || !inactiveWarehouse) {
      console.log(
        '⚠️  Need at least one active and one inactive warehouse for testing',
      );
      return;
    }

    console.log(`📦 Current active: ${activeWarehouse.name || 'Unnamed'}`);
    console.log(`📦 Will activate: ${inactiveWarehouse.name || 'Unnamed'}`);

    // 3. Mostrar métricas antes de la migración
    console.log('\n📊 Metrics before migration:');
    try {
      const metricsBefore = await metricsService.getCountryMetrics(
        testCountry.countryCode,
      );
      console.log(`   - Total products: ${metricsBefore.total}`);
      console.log(`   - Computers: ${metricsBefore.computers}`);
      console.log(`   - Other products: ${metricsBefore.nonComputers}`);
      console.log(`   - Tenants: ${metricsBefore.distinctTenants}`);

      // También mostrar métricas del warehouse actual
      const currentWarehouseMetrics = await metricsService.getWarehouseMetrics(
        testCountry.countryCode,
        activeWarehouse._id.toString(),
      );
      if (currentWarehouseMetrics) {
        console.log(
          `\n📦 Current warehouse (${currentWarehouseMetrics.warehouseName}):`,
        );
        console.log(`   - Products: ${currentWarehouseMetrics.totalProducts}`);
        console.log(`   - Computers: ${currentWarehouseMetrics.computers}`);
        console.log(`   - Other: ${currentWarehouseMetrics.nonComputers}`);
        console.log(`   - Tenants: ${currentWarehouseMetrics.distinctTenants}`);
      }
    } catch (error) {
      console.log('   - No metrics available (global index might be empty)');
    }

    // 4. Confirmar antes de proceder
    console.log('\n❓ Do you want to proceed with the migration test?');
    console.log(
      '   This will activate a different warehouse and migrate products.',
    );
    console.log('   Type "yes" to continue or anything else to cancel:');

    // En un script real, podrías usar readline para input del usuario
    // Por ahora, solo mostramos lo que haría
    console.log('\n🔄 SIMULATION MODE - What would happen:');

    console.log(`1. Deactivate: ${activeWarehouse.name || 'Unnamed'}`);
    console.log(`2. Activate: ${inactiveWarehouse.name || 'Unnamed'}`);
    console.log('3. Scan all tenant databases');
    console.log('4. Update products with new warehouse reference');
    console.log('5. Update global index');
    console.log('6. Show migration results');

    // 5. Para ejecutar realmente (descomenta estas líneas):
    /*
    const result = await warehousesService.activateWarehouse(
      testCountry.country,
      inactiveWarehouse._id.toString()
    );
    
    console.log('\n✅ Migration completed!');
    console.log(`📊 Results:`);
    console.log(`   - Activated: ${result.activated}`);
    console.log(`   - Message: ${result.message}`);
    console.log(`   - Migrated products: ${result.migratedProducts || 0}`);
    console.log(`   - Affected tenants: ${result.affectedTenants || 0}`);
    
    if (result.deactivatedWarehouses) {
      console.log(`   - Deactivated: ${result.deactivatedWarehouses.join(', ')}`);
    }
    */

    console.log(
      '\n💡 To run actual migration, uncomment the execution code in the script',
    );
  } catch (error) {
    console.error('❌ Error during migration test:', error);
  } finally {
    await app.close();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  testMigration();
}

export { testMigration };
