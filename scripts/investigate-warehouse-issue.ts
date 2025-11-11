import { config } from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';

config();

async function investigateWarehouseIssue() {
  console.log('🔍 INVESTIGANDO PROBLEMA DE WAREHOUSE IDs\n');

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

    // 1. Ver todos los warehouses de Argentina
    console.log('📍 WAREHOUSES DE ARGENTINA:\n');
    const argentinaDoc = await warehousesCollection.findOne({ countryCode: 'AR' });

    if (!argentinaDoc) {
      console.error('❌ No se encontró documento de Argentina');
      return;
    }

    console.log(`País: ${argentinaDoc.country} (${argentinaDoc.countryCode})`);
    console.log(`Warehouses encontrados: ${argentinaDoc.warehouses?.length || 0}\n`);

    if (argentinaDoc.warehouses) {
      argentinaDoc.warehouses.forEach((wh: any, index: number) => {
        console.log(`${index + 1}. ID: ${wh._id}`);
        console.log(`   Nombre: ${wh.name || 'Sin nombre'}`);
        console.log(`   Activo: ${wh.isActive}`);
        console.log(`   Partner: ${wh.partnerType || 'N/A'}\n`);
      });
    }

    // 2. Ver distribución de productos por warehouse
    console.log('\n📊 DISTRIBUCIÓN DE PRODUCTOS POR WAREHOUSE:\n');
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
      const exists = argentinaDoc.warehouses?.some(
        (wh: any) => wh._id.toString() === item._id.toString(),
      );
      console.log(`Warehouse ID: ${item._id}`);
      console.log(`   Nombre: ${item.warehouseName}`);
      console.log(`   País: ${item.countryCode}`);
      console.log(`   Productos: ${item.count}`);
      console.log(`   ¿Existe en DB?: ${exists ? '✅ SÍ' : '❌ NO'}\n`);
    });

    // 3. Verificar el warehouse problemático
    const problematicId = new ObjectId('68c466eb2a12cf5c56301a2f');
    const productsWithProblematicId = await globalProductsCollection.countDocuments({
      'fpWarehouse.warehouseId': problematicId,
    });

    console.log('\n⚠️ WAREHOUSE PROBLEMÁTICO:\n');
    console.log(`ID: ${problematicId}`);
    console.log(`Productos afectados: ${productsWithProblematicId}`);

    // 4. Ver un producto de ejemplo
    const sampleProduct = await globalProductsCollection.findOne({
      'fpWarehouse.warehouseId': problematicId,
    });

    if (sampleProduct) {
      console.log('\n📦 EJEMPLO DE PRODUCTO AFECTADO:\n');
      console.log(`Producto ID: ${sampleProduct._id}`);
      console.log(`Nombre: ${sampleProduct.name}`);
      console.log(`Warehouse ID: ${sampleProduct.fpWarehouse.warehouseId}`);
      console.log(`Warehouse Name: ${sampleProduct.fpWarehouse.warehouseName}`);
      console.log(`Country Code: ${sampleProduct.fpWarehouse.warehouseCountryCode}`);
    }

    // 5. Sugerencia de corrección
    console.log('\n💡 SUGERENCIA DE CORRECCIÓN:\n');
    
    const activeWarehouse = argentinaDoc.warehouses?.find((wh: any) => wh.isActive);
    if (activeWarehouse) {
      console.log('Se encontró warehouse activo en Argentina:');
      console.log(`   ID: ${activeWarehouse._id}`);
      console.log(`   Nombre: ${activeWarehouse.name}`);
      console.log(`   Activo: ${activeWarehouse.isActive}\n`);
      console.log('OPCIÓN 1: Actualizar los 82 productos para usar este warehouse ID');
      console.log(`   Comando MongoDB:`);
      console.log(`   db.global_products.updateMany(`);
      console.log(`     { "fpWarehouse.warehouseId": ObjectId("${problematicId}") },`);
      console.log(`     { $set: { `);
      console.log(`       "fpWarehouse.warehouseId": ObjectId("${activeWarehouse._id}"),`);
      console.log(`       "fpWarehouse.warehouseName": "${activeWarehouse.name}"`);
      console.log(`     }}`);
      console.log(`   )\n`);
    } else {
      console.log('⚠️ No se encontró warehouse activo en Argentina');
      console.log('OPCIÓN 2: Activar uno de los warehouses existentes');
      console.log('OPCIÓN 3: Crear un nuevo warehouse con el ID problemático\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('🔌 Conexión cerrada');
  }
}

if (require.main === module) {
  investigateWarehouseIssue().catch(console.error);
}

export { investigateWarehouseIssue };

