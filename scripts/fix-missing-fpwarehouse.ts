import { config } from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';

config();

/**
 * Script para restaurar fpWarehouse en productos que están en "FP warehouse"
 * pero tienen fpWarehouse = null
 */

async function fixMissingFpWarehouse() {
  console.log('🔧 RESTAURANDO fpWarehouse EN PRODUCTOS\n');

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

    // Buscar productos en FP warehouse sin fpWarehouse
    const productsWithoutWarehouse = await globalProductsCollection
      .find({
        location: 'FP warehouse',
        $or: [
          { fpWarehouse: null },
          { fpWarehouse: { $exists: false } },
        ],
        isDeleted: { $ne: true },
      })
      .toArray();

    console.log(`📊 Productos sin fpWarehouse: ${productsWithoutWarehouse.length}\n`);

    if (productsWithoutWarehouse.length === 0) {
      console.log('✅ No hay productos para corregir\n');
      return;
    }

    // Cargar warehouses por país
    const allWarehouses = await warehousesCollection.find({}).toArray();
    const warehousesByCountry = new Map();

    for (const countryDoc of allWarehouses) {
      const defaultWarehouse = countryDoc.warehouses.find(
        (w: any) => w.partnerType === 'default' && !w.isDeleted,
      );
      if (defaultWarehouse) {
        warehousesByCountry.set(countryDoc.countryCode, {
          id: defaultWarehouse._id,
          name: defaultWarehouse.name || 'Default Warehouse',
          countryCode: countryDoc.countryCode,
        });
      }
    }

    let fixed = 0;

    for (const product of productsWithoutWarehouse) {
      console.log(`🔍 Producto: ${product._id} (${product.name || 'Sin nombre'})`);
      console.log(`   Tenant: ${product.tenantName}`);

      // Intentar obtener el país del tenant
      const tenantsCollection = firstPlugDb.collection('tenants');
      const tenant = await tenantsCollection.findOne({ _id: product.tenantId });

      let countryCode = 'AR'; // Default Argentina
      if (tenant?.countryCode) {
        countryCode = tenant.countryCode;
        console.log(`   País del tenant: ${countryCode}`);
      } else {
        console.log(`   ⚠️  Tenant sin país, usando Argentina por defecto`);
      }

      const warehouse = warehousesByCountry.get(countryCode);

      if (!warehouse) {
        console.log(`   ❌ No se encontró warehouse para ${countryCode}\n`);
        continue;
      }

      const fpWarehouseData = {
        warehouseId: warehouse.id,
        warehouseCountryCode: countryCode,
        warehouseName: warehouse.name,
        assignedAt: new Date(),
        status: 'STORED',
      };

      console.log(`   ✅ Asignando warehouse: ${warehouse.name} (${countryCode})`);

      // Actualizar en global_products
      await globalProductsCollection.updateOne(
        { _id: product._id },
        {
          $set: {
            fpWarehouse: fpWarehouseData,
            inFpWarehouse: true,
          },
        },
      );

      // Actualizar en tenant products collection
      const tenantDbName = `tenant_${product.tenantName}`;
      const tenantDb = client.db(tenantDbName);
      const tenantProductsCollection = tenantDb.collection('products');

      const tenantProduct = await tenantProductsCollection.findOne({
        _id: product.originalProductId,
      });

      if (tenantProduct) {
        await tenantProductsCollection.updateOne(
          { _id: product.originalProductId },
          {
            $set: {
              fpWarehouse: fpWarehouseData,
            },
          },
        );
        console.log(`   ✅ Actualizado en tenant products\n`);
      } else {
        console.log(`   ⚠️  Producto no encontrado en tenant products\n`);
      }

      fixed++;
    }

    console.log(`✅ Total productos corregidos: ${fixed}\n`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('🔌 Conexión cerrada');
  }
}

if (require.main === module) {
  fixMissingFpWarehouse().catch(console.error);
}

export { fixMissingFpWarehouse };

