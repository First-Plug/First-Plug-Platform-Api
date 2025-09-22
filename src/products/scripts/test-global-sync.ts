import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { GlobalProductSyncService } from '../services/global-product-sync.service';
import { Types } from 'mongoose';

/**
 * Script para probar la sincronización global de productos
 * y la lógica de lastAssigned con warehouses
 */
async function testGlobalSync() {
  console.log('🚀 Iniciando test de sincronización global...');

  const app = await NestFactory.createApplicationContext(AppModule);
  const syncService = app.get(GlobalProductSyncService);

  try {
    // === ESCENARIO 1: Producto nuevo en warehouse ===
    console.log('\n📦 ESCENARIO 1: Producto llega a warehouse');

    await syncService.syncProduct({
      tenantId: 'empresa1',
      tenantName: 'empresa1',
      originalProductId: new Types.ObjectId('64e1a2b3c4d5e6f7g8h9i0j1'),
      sourceCollection: 'products',

      name: 'MacBook Pro 16',
      category: 'Computer',
      status: 'Available',
      location: 'FP warehouse',

      attributes: [
        { key: 'brand', value: 'Apple' },
        { key: 'model', value: 'MacBook Pro' },
        { key: 'processor', value: 'M2 Pro' },
        { key: 'ram', value: '32GB' },
        { key: 'storage', value: '1TB SSD' },
      ],

      serialNumber: 'ABC123456789',
      acquisitionDate: '2024-01-15',
      price: { amount: 2500, currencyCode: 'USD' },
      additionalInfo: 'Laptop nueva en caja',
      productCondition: 'Optimal',
      recoverable: true,
      fp_shipment: false,
      activeShipment: false,

      fpWarehouse: {
        warehouseId: new Types.ObjectId('64b1a2b3c4d5e6f7g8h9i0j6'),
        warehouseCountryCode: 'AR',
        warehouseName: 'Warehouse Buenos Aires',
        assignedAt: new Date(),
        status: 'STORED',
      },

      lastAssigned: undefined, // Primera vez en warehouse
    });

    console.log('✅ Producto sincronizado en warehouse AR');

    // === ESCENARIO 2: Producto sale del warehouse a member ===
    console.log('\n👤 ESCENARIO 2: Producto sale de warehouse a member');

    await syncService.syncProduct({
      tenantId: 'empresa1',
      tenantName: 'empresa1',
      originalProductId: new Types.ObjectId('64e1a2b3c4d5e6f7g8h9i0j1'),
      sourceCollection: 'members',

      name: 'MacBook Pro 16',
      category: 'Computer',
      status: 'In Transit',
      location: 'Employee', // Cambio de ubicación

      attributes: [
        { key: 'brand', value: 'Apple' },
        { key: 'model', value: 'MacBook Pro' },
        { key: 'processor', value: 'M2 Pro' },
        { key: 'ram', value: '32GB' },
        { key: 'storage', value: '1TB SSD' },
      ],

      serialNumber: 'ABC123456789',
      assignedEmail: 'john.doe@empresa1.com',
      assignedMember: 'John Doe',
      acquisitionDate: '2024-01-15',
      price: { amount: 2500, currencyCode: 'USD' },
      additionalInfo: 'Laptop nueva en caja',
      productCondition: 'Optimal',
      recoverable: true,
      fp_shipment: true,
      activeShipment: true,

      fpWarehouse: {
        warehouseId: new Types.ObjectId('64b1a2b3c4d5e6f7g8h9i0j6'),
        warehouseCountryCode: 'AR',
        warehouseName: 'Warehouse Buenos Aires',
        assignedAt: new Date(),
        status: 'IN_TRANSIT_OUT', // Saliendo del warehouse
      },

      memberData: {
        memberId: new Types.ObjectId('64c1a2b3c4d5e6f7g8h9i0j3'),
        memberEmail: 'john.doe@empresa1.com',
        memberName: 'John Doe',
        assignedAt: new Date(),
      },

      lastAssigned: undefined, // Se calculará automáticamente: "FP warehouse - AR"
    });

    console.log(
      '✅ Producto sincronizado saliendo de warehouse (lastAssigned = "FP warehouse - AR")',
    );

    // === ESCENARIO 3: Producto entregado al member ===
    console.log('\n📋 ESCENARIO 3: Producto entregado al member');

    await syncService.syncProduct({
      tenantId: 'empresa1',
      tenantName: 'empresa1',
      originalProductId: new Types.ObjectId('64e1a2b3c4d5e6f7g8h9i0j1'),
      sourceCollection: 'members',

      name: 'MacBook Pro 16',
      category: 'Computer',
      status: 'Delivered',
      location: 'Employee',

      attributes: [
        { key: 'brand', value: 'Apple' },
        { key: 'model', value: 'MacBook Pro' },
        { key: 'processor', value: 'M2 Pro' },
        { key: 'ram', value: '32GB' },
        { key: 'storage', value: '1TB SSD' },
      ],

      serialNumber: 'ABC123456789',
      assignedEmail: 'john.doe@empresa1.com',
      assignedMember: 'John Doe',
      acquisitionDate: '2024-01-15',
      price: { amount: 2500, currencyCode: 'USD' },
      additionalInfo: 'Laptop nueva en caja',
      productCondition: 'Optimal',
      recoverable: true,
      fp_shipment: false, // Envío completado
      activeShipment: false, // No hay envío activo

      fpWarehouse: undefined, // Ya no está relacionado con warehouse

      memberData: {
        memberId: new Types.ObjectId('64c1a2b3c4d5e6f7g8h9i0j3'),
        memberEmail: 'john.doe@empresa1.com',
        memberName: 'John Doe',
        assignedAt: new Date(),
      },

      lastAssigned: 'FP warehouse - AR', // Mantiene el último warehouse
    });

    console.log(
      '✅ Producto entregado (mantiene lastAssigned = "FP warehouse - AR")',
    );

    // === ESCENARIO 4: Member devuelve a Our office ===
    console.log('\n🏢 ESCENARIO 4: Member devuelve producto a Our office');

    await syncService.syncProduct({
      tenantId: 'empresa1',
      tenantName: 'empresa1',
      originalProductId: new Types.ObjectId('64e1a2b3c4d5e6f7g8h9i0j1'),
      sourceCollection: 'products',

      name: 'MacBook Pro 16',
      category: 'Computer',
      status: 'Available',
      location: 'Our office', // Cambio de ubicación

      attributes: [
        { key: 'brand', value: 'Apple' },
        { key: 'model', value: 'MacBook Pro' },
        { key: 'processor', value: 'M2 Pro' },
        { key: 'ram', value: '32GB' },
        { key: 'storage', value: '1TB SSD' },
      ],

      serialNumber: 'ABC123456789',
      assignedEmail: undefined, // Ya no está asignado
      assignedMember: undefined,
      acquisitionDate: '2024-01-15',
      price: { amount: 2500, currencyCode: 'USD' },
      additionalInfo: 'Laptop devuelta por member',
      productCondition: 'Optimal',
      recoverable: true,
      fp_shipment: false,
      activeShipment: false,

      fpWarehouse: undefined,
      memberData: undefined,

      lastAssigned: undefined, // Se calculará automáticamente: "john.doe@empresa1.com"
    });

    console.log(
      '✅ Producto devuelto a Our office (lastAssigned = "john.doe@empresa1.com")',
    );

    // === MOSTRAR MÉTRICAS ===
    console.log('\n📊 MÉTRICAS GLOBALES:');
    const stats = await syncService.getGlobalStats();
    console.log(JSON.stringify(stats, null, 2));

    console.log('\n🎯 Test completado exitosamente!');
  } catch (error) {
    console.error('❌ Error en el test:', error);
  } finally {
    await app.close();
  }
}

// Ejecutar el test
if (require.main === module) {
  testGlobalSync().catch(console.error);
}

export { testGlobalSync };
