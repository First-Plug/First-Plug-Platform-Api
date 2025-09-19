import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { WarehouseMetricsService } from '../services/warehouse-metrics.service';

/**
 * Script para mostrar métricas actuales de warehouses
 * Las métricas son obtenidas en tiempo real del índice global
 * No requiere actualización manual - siempre están sincronizadas
 */

async function updateWarehouseMetrics() {
  console.log('🚀 Starting warehouse metrics display...');

  const app = await NestFactory.createApplicationContext(AppModule);
  const metricsService = app.get(WarehouseMetricsService);

  try {
    // Obtener métricas de todos los warehouses activos
    const allMetrics = await metricsService.getAllWarehouseMetrics();

    console.log('\n📊 CURRENT WAREHOUSE METRICS:');
    console.log('='.repeat(60));

    if (allMetrics.length === 0) {
      console.log('📦 No active warehouses found or no products in warehouses');
      console.log('💡 This is normal if:');
      console.log('   - No warehouses are active yet');
      console.log('   - No products are assigned to FP warehouses');
      console.log('   - Global index is empty (products not synced yet)');
    } else {
      let totalProducts = 0;
      let totalComputers = 0;
      let totalTenants = 0;

      allMetrics.forEach((warehouse, index) => {
        console.log(
          `\n${index + 1}. 🏢 ${warehouse.country} (${warehouse.countryCode})`,
        );
        console.log(`   📦 Warehouse: ${warehouse.warehouseName}`);
        console.log(
          `   🟢 Status: ${warehouse.isActive ? 'ACTIVE' : 'INACTIVE'}`,
        );
        console.log(`   📊 Products: ${warehouse.totalProducts}`);
        console.log(`   � Computers: ${warehouse.computers}`);
        console.log(`   📱 Other: ${warehouse.nonComputers}`);
        console.log(`   🏢 Tenants: ${warehouse.distinctTenants}`);

        totalProducts += warehouse.totalProducts;
        totalComputers += warehouse.computers;
        totalTenants = Math.max(totalTenants, warehouse.distinctTenants);
      });

      console.log('\n' + '='.repeat(60));
      console.log('📈 SUMMARY:');
      console.log(`   🎯 Total warehouses: ${allMetrics.length}`);
      console.log(`   📦 Total products: ${totalProducts}`);
      console.log(`   💻 Total computers: ${totalComputers}`);
      console.log(`   📱 Total other: ${totalProducts - totalComputers}`);
    }

    console.log('\n✅ Warehouse metrics display completed!');
    console.log('💡 Note: Metrics are now real-time from the global index');
  } catch (error) {
    console.error('❌ Error getting warehouse metrics:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  updateWarehouseMetrics();
}

export { updateWarehouseMetrics };
