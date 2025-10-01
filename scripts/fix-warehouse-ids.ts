import { config } from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';

// Cargar variables de entorno
config();

/**
 * Script para corregir warehouse IDs incorrectos en global_products
 * 
 * PROBLEMA:
 * - 82 productos tienen warehouseId: 68c466eb2a12cf5c56301a2f
 * - Este warehouse NO existe en la colección warehouses
 * 
 * SOLUCIÓN:
 * - Identificar el warehouse correcto
 * - Actualizar productos con el ID correcto
 */

async function fixWarehouseIds() {
  console.log('🔧 Iniciando corrección de warehouse IDs...\n');

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ Error: MONGO_URI no está definido en .env');
    return;
  }

  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    console.log('✅ Conectado a MongoDB\n');

    const firstPlugDb = client.db('firstPlug');
    const globalProductsCollection = firstPlugDb.collection('global_products');
    const warehousesCollection = firstPlugDb.collection('warehouses');

    // ==================== PASO 1: INVESTIGACIÓN ====================
    console.log('📊 PASO 1: INVESTIGACIÓN\n');

    // 1.1 Ver warehouses de Argentina
    console.log('🔍 Warehouses de Argentina:');
    const argentinaDoc = await warehousesCollection.findOne({ countryCode: 'AR' });
    
    if (!argentinaDoc) {
      console.error('❌ No se encontró documento de Argentina');
      return;
    }

    console.log(`   País: ${argentinaDoc.country} (${argentinaDoc.countryCode})`);
    console.log(`   Warehouses encontrados: ${argentinaDoc.warehouses?.length || 0}\n`);

    if (argentinaDoc.warehouses) {
      argentinaDoc.warehouses.forEach((wh: any, index: number) => {
        console.log(`   ${index + 1}. ID: ${wh._id}`);
        console.log(`      Nombre: ${wh.name || 'Sin nombre'}`);
        console.log(`      Activo: ${wh.isActive}`);
        console.log(`      Partner: ${wh.partnerType || 'N/A'}\n`);
      });
    }

    // 1.2 Contar productos con warehouse ID incorrecto
    const incorrectWarehouseId = new ObjectId('68c466eb2a12cf5c56301a2f');
    const productsWithIncorrectId = await globalProductsCollection.countDocuments({
      'fpWarehouse.warehouseId': incorrectWarehouseId,
    });

    console.log(`📦 Productos con warehouse ID incorrecto (${incorrectWarehouseId}):`);
    console.log(`   Total: ${productsWithIncorrectId}\n`);

    // 1.3 Ver distribución de productos por warehouse
    console.log('📊 Distribución de productos por warehouse:');
    const distribution = await globalProductsCollection
      .aggregate([
        {
          $match: {
            inFpWarehouse: true,
            tenantName: 'mechi_test',
          },
        },
        {
          $group: {
            _id: '$fpWarehouse.warehouseId',
            count: { $sum: 1 },
            warehouseName: { $first: '$fpWarehouse.warehouseName' },
            countryCode: { $first: '$fpWarehouse.warehouseCountryCode' },
          },
        },
      ])
      .toArray();

    distribution.forEach((item: any) => {
      console.log(`   Warehouse: ${item._id}`);
      console.log(`   Nombre: ${item.warehouseName}`);
      console.log(`   País: ${item.countryCode}`);
      console.log(`   Productos: ${item.count}\n`);
    });

    // ==================== PASO 2: CORRECCIÓN ====================
    console.log('\n🛠️ PASO 2: CORRECCIÓN\n');

    // Determinar el warehouse correcto
    // Opción 1: Usar el primer warehouse activo de Argentina
    const correctWarehouse = argentinaDoc.warehouses?.find((wh: any) => wh.isActive);
    
    if (!correctWarehouse) {
      console.error('❌ No se encontró warehouse activo en Argentina');
      console.log('\n⚠️ OPCIONES:');
      console.log('   1. Activar un warehouse existente');
      console.log('   2. Crear un nuevo warehouse');
      console.log('   3. Especificar manualmente el warehouse correcto\n');
      return;
    }

    const correctWarehouseId = correctWarehouse._id;
    console.log(`✅ Warehouse correcto identificado:`);
    console.log(`   ID: ${correctWarehouseId}`);
    console.log(`   Nombre: ${correctWarehouse.name || 'Sin nombre'}`);
    console.log(`   Activo: ${correctWarehouse.isActive}\n`);

    // Preguntar confirmación (en producción, esto debería ser un prompt)
    console.log('⚠️ CONFIRMACIÓN REQUERIDA:');
    console.log(`   Se actualizarán ${productsWithIncorrectId} productos`);
    console.log(`   Warehouse incorrecto: ${incorrectWarehouseId}`);
    console.log(`   Warehouse correcto: ${correctWarehouseId}\n`);

    // DESCOMENTAR PARA EJECUTAR LA CORRECCIÓN:
    /*
    console.log('🔄 Actualizando productos...\n');
    
    const updateResult = await globalProductsCollection.updateMany(
      {
        'fpWarehouse.warehouseId': incorrectWarehouseId,
      },
      {
        $set: {
          'fpWarehouse.warehouseId': correctWarehouseId,
          'fpWarehouse.warehouseName': correctWarehouse.name || 'Default Warehouse AR',
        },
      }
    );

    console.log(`✅ Productos actualizados: ${updateResult.modifiedCount}\n`);

    // Verificar resultado
    const remainingIncorrect = await globalProductsCollection.countDocuments({
      'fpWarehouse.warehouseId': incorrectWarehouseId,
    });

    console.log(`🔍 Verificación:`);
    console.log(`   Productos con ID incorrecto restantes: ${remainingIncorrect}`);
    
    if (remainingIncorrect === 0) {
      console.log(`   ✅ Todos los productos corregidos!\n`);
    } else {
      console.log(`   ⚠️ Aún quedan ${remainingIncorrect} productos sin corregir\n`);
    }
    */

    console.log('\n📝 SIGUIENTE PASO:');
    console.log('   1. Revisar la información anterior');
    console.log('   2. Si el warehouse correcto es el identificado, descomentar el código de actualización');
    console.log('   3. Re-ejecutar el script');
    console.log('   4. Ejecutar: npm run populate:warehouse-metrics\n');

  } catch (error) {
    console.error('❌ Error durante la corrección:', error);
  } finally {
    await client.close();
    console.log('🔌 Conexión cerrada');
  }
}

// Ejecutar script
if (require.main === module) {
  fixWarehouseIds()
    .then(() => {
      console.log('✅ Script finalizado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

export { fixWarehouseIds };

