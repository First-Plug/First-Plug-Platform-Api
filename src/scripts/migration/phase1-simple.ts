#!/usr/bin/env ts-node

/**
 * FASE 1 SIMPLE: Preparar Warehouses (sin NestJS)
 *
 * Script simplificado que agrega el esquema fpWarehouse directamente con MongoDB
 */

import { config } from 'dotenv';
import { MongoClient } from 'mongodb';

// Cargar variables de entorno
config();

async function runSimpleMigration() {
  const args = process.argv.slice(2);
  const tenantArg = args.find((arg) => arg.startsWith('--tenant='));

  if (!tenantArg) {
    console.error('❌ Error: Debes especificar --tenant=NOMBRE_TENANT');
    console.log(
      'Uso: npm run migrate:prepare-warehouses-simple -- --tenant=mechi_test',
    );
    return;
  }

  const tenantName = tenantArg.split('=')[1];

  if (!tenantName) {
    console.error('❌ Error: Nombre de tenant vacío');
    return;
  }

  console.log(
    `🚀 FASE 1 SIMPLE: Preparando warehouses para tenant ${tenantName}`,
  );

  // Mostrar URI que se va a usar
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017';
  console.log(`🔗 Conectando a: ${mongoUri}`);

  // Conectar a MongoDB directamente
  const client = new MongoClient(mongoUri);

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
    const productsCollection = tenantDb.collection('products');

    // 1. Contar productos totales
    const totalProducts = await productsCollection.countDocuments({
      isDeleted: { $ne: true },
    });
    console.log(`📊 Total productos en tenant: ${totalProducts}`);

    // 2. Contar productos con "FP warehouse"
    const fpWarehouseProducts = await productsCollection.countDocuments({
      location: 'FP warehouse',
      isDeleted: { $ne: true },
    });
    console.log(`📦 Productos con "FP warehouse": ${fpWarehouseProducts}`);

    // 3. Contar productos con "FP warehouse" SIN esquema fpWarehouse
    const productsToUpdate = await productsCollection.countDocuments({
      location: 'FP warehouse',
      fpWarehouse: { $exists: false },
      isDeleted: { $ne: true },
    });
    console.log(
      `🔧 Productos que necesitan actualización: ${productsToUpdate}`,
    );

    if (productsToUpdate === 0) {
      console.log('✅ No hay productos que necesiten actualización');
      return;
    }

    // 4. Obtener warehouse default de Argentina desde firstPlug DB
    const warehousesCollection = firstPlugDb.collection('warehouses');

    // Primero ver qué warehouses existen
    console.log('🔍 Buscando warehouses en firstPlug...');
    const allWarehouses = await warehousesCollection.find({}).toArray();
    console.log(`📦 Total warehouses encontrados: ${allWarehouses.length}`);

    if (allWarehouses.length > 0) {
      console.log('📋 Warehouses disponibles:');
      allWarehouses.forEach((wh, index) => {
        console.log(
          `   ${index + 1}. ${wh.name || 'Sin nombre'} - País: ${wh.country || wh.countryCode || 'Sin país'} - Activo: ${wh.isActive}`,
        );
      });
    }

    let defaultWarehouse = await warehousesCollection.findOne({
      countryCode: 'AR',
      isActive: true,
    });

    if (!defaultWarehouse) {
      // Buscar por nombre de país
      defaultWarehouse = await warehousesCollection.findOne({
        country: 'Argentina',
        isActive: true,
      });
    }

    if (!defaultWarehouse) {
      // Buscar cualquier warehouse de Argentina (sin importar isActive)
      defaultWarehouse = await warehousesCollection.findOne({
        $or: [{ countryCode: 'AR' }, { country: 'Argentina' }],
      });
    }

    if (!defaultWarehouse) {
      console.error('❌ No se encontró warehouse para Argentina');
      return;
    }

    console.log(
      `🏭 Usando warehouse: ${defaultWarehouse.name || 'Default Warehouse AR'}`,
    );

    // 5. Preparar el esquema fpWarehouse
    const fpWarehouseData = {
      warehouseId: defaultWarehouse._id,
      warehouseCountryCode: 'AR',
      warehouseName: defaultWarehouse.name || 'Default Warehouse AR',
      assignedAt: new Date(),
      status: 'STORED',
    };

    console.log('📝 Esquema fpWarehouse a agregar:', fpWarehouseData);

    // 6. Actualizar productos
    console.log('🔄 Actualizando productos...');

    const updateResult = await productsCollection.updateMany(
      {
        location: 'FP warehouse',
        fpWarehouse: { $exists: false },
        isDeleted: { $ne: true },
      },
      {
        $set: {
          fpWarehouse: fpWarehouseData,
          updatedAt: new Date(),
        },
      },
    );

    console.log(`✅ FASE 1 COMPLETADA:`);
    console.log(`   - Productos actualizados: ${updateResult.modifiedCount}`);
    console.log(
      `   - Productos que coincidieron: ${updateResult.matchedCount}`,
    );

    // 7. Verificar resultado
    const updatedCount = await productsCollection.countDocuments({
      location: 'FP warehouse',
      fpWarehouse: { $exists: true },
      isDeleted: { $ne: true },
    });

    console.log(
      `🔍 Verificación: ${updatedCount} productos ahora tienen esquema fpWarehouse`,
    );

    if (updatedCount === fpWarehouseProducts) {
      console.log(
        '🎉 ¡Migración exitosa! Todos los productos FP warehouse tienen el esquema completo',
      );
    } else {
      console.log(
        `⚠️ Advertencia: Esperábamos ${fpWarehouseProducts} pero tenemos ${updatedCount}`,
      );
    }
  } catch (error) {
    console.error('❌ Error en migración:', error);
  } finally {
    await client.close();
    console.log('🔌 Conexión cerrada');
  }
}

if (require.main === module) {
  runSimpleMigration().catch(console.error);
}
