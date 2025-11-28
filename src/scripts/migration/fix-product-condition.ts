#!/usr/bin/env ts-node

/**
 * FIX PRODUCT CONDITION: Agregar productCondition a productos sin esta key
 *
 * Script que recorre productos en:
 * 1. Colección 'products' del tenant
 * 2. Colección 'members' del tenant (dentro del array products)
 * 3. Colección 'global_products' (sincroniza cambios)
 *
 * Si un producto no tiene productCondition, agrega 'Optimal' como valor default
 */

import { config } from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';

config();

async function fixProductCondition() {
  const args = process.argv.slice(2);
  const tenantArg = args.find((arg) => arg.startsWith('--tenant='));

  if (!tenantArg) {
    console.error('❌ Error: Debes especificar --tenant=NOMBRE_TENANT');
    console.log(
      'Uso: npm run migrate:fix-product-condition -- --tenant=mechi_test',
    );
    return;
  }

  const tenantName = tenantArg.split('=')[1];

  if (!tenantName) {
    console.error('❌ Error: Nombre de tenant vacío');
    return;
  }

  console.log(
    `🚀 FIX PRODUCT CONDITION: Reparando productos para tenant ${tenantName}`,
  );

  const mongoUri =
    process.env.DB_CONNECTION_STRING ||
    process.env.MONGO_URI ||
    'mongodb://localhost:27017';
  console.log(
    `🔗 Conectando a: ${mongoUri.replace(/\/\/.*:.*@/, '//***:***@')}`,
  );

  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    console.log('✅ Conectado a MongoDB');

    // Determinar BD global
    let globalDbName = 'main';
    if (mongoUri.includes('firstplug-dev')) {
      globalDbName = 'firstPlug';
    }

    console.log(`📂 Base de datos global: ${globalDbName}`);

    const globalDb = client.db(globalDbName);
    const tenantsCollection = globalDb.collection('tenants');

    console.log(`🔍 Buscando tenant: ${tenantName}`);
    const tenant = await tenantsCollection.findOne({ tenantName });

    if (!tenant) {
      console.error(`❌ No se encontró tenant: ${tenantName}`);
      return;
    }

    console.log(
      `✅ Tenant encontrado: ${tenant.tenantName} (ID: ${tenant._id})`,
    );

    const tenantDbName = `tenant_${tenantName}`;
    const tenantDb = client.db(tenantDbName);
    const productsCollection = tenantDb.collection('products');
    const membersCollection = tenantDb.collection('members');
    const globalProductsCollection = globalDb.collection('global_products');

    let totalFixed = 0;
    const productsToUpdate: ObjectId[] = [];

    // 1. Reparar productos en colección 'products'
    console.log('\n📦 Procesando colección "products"...');
    const productsWithoutCondition = await productsCollection
      .find({
        productCondition: { $exists: false },
        isDeleted: { $ne: true },
      })
      .toArray();

    console.log(
      `🔧 Productos sin productCondition: ${productsWithoutCondition.length}`,
    );

    if (productsWithoutCondition.length > 0) {
      const result = await productsCollection.updateMany(
        {
          productCondition: { $exists: false },
          isDeleted: { $ne: true },
        },
        {
          $set: {
            productCondition: 'Optimal',
            updatedAt: new Date(),
          },
        },
      );

      console.log(`✅ Productos actualizados: ${result.modifiedCount}`);
      totalFixed += result.modifiedCount;

      // Guardar IDs para actualizar en global_products
      productsWithoutCondition.forEach((p) => {
        productsToUpdate.push(p._id);
      });
    }

    // 2. Reparar productos en colección 'members'
    console.log('\n👥 Procesando colección "members"...');

    // Traer todos los members y filtrar en JavaScript
    const allMembers = await membersCollection
      .find({
        isDeleted: { $ne: true },
      })
      .toArray();

    // Filtrar members que tienen productos sin productCondition
    const membersWithBrokenProducts = allMembers.filter((member: any) => {
      return (
        member.products &&
        Array.isArray(member.products) &&
        member.products.length > 0 &&
        member.products.some((p: any) => !p.productCondition)
      );
    });

    console.log(
      `👤 Members con productos sin productCondition: ${membersWithBrokenProducts.length}`,
    );

    let memberProductsFixed = 0;
    for (const member of membersWithBrokenProducts) {
      const brokenProducts = member.products?.filter(
        (p: any) => !p.productCondition,
      );

      console.log(`\n  📋 Member ID: ${member._id}`);
      console.log(`     Email: ${member.email}`);
      console.log(`     Total productos: ${member.products?.length || 0}`);
      console.log(
        `     Productos sin productCondition: ${brokenProducts?.length || 0}`,
      );

      if (brokenProducts && brokenProducts.length > 0) {
        brokenProducts.forEach((p: any, idx: number) => {
          console.log(
            `       [${idx + 1}] Producto ID: ${p._id}, Name: ${p.name}, Condition: ${p.productCondition || 'MISSING'}`,
          );
        });
        // Actualizar cada producto en el array
        const updatedProducts = member.products.map((p: any) => {
          if (!p.productCondition) {
            return { ...p, productCondition: 'Optimal' };
          }
          return p;
        });

        const result = await membersCollection.updateOne(
          { _id: member._id },
          {
            $set: {
              products: updatedProducts,
              updatedAt: new Date(),
            },
          },
        );

        if (result.modifiedCount > 0) {
          memberProductsFixed += brokenProducts.length;
          brokenProducts.forEach((p: any) => {
            if (p._id) {
              productsToUpdate.push(p._id);
            }
          });
          console.log(
            `  ✓ Member ${member._id}: ${brokenProducts.length} productos actualizados`,
          );
        }
      }
    }

    console.log(`✅ Productos en members actualizados: ${memberProductsFixed}`);
    totalFixed += memberProductsFixed;

    // 3. Actualizar global_products
    console.log('\n🌍 Sincronizando con global_products...');
    let globalUpdated = 0;

    for (const productId of productsToUpdate) {
      const result = await globalProductsCollection.updateMany(
        {
          originalProductId: productId,
          tenantId: new ObjectId(tenant._id),
          productCondition: { $exists: false },
        },
        {
          $set: {
            productCondition: 'Optimal',
            updatedAt: new Date(),
          },
        },
      );

      globalUpdated += result.modifiedCount;
    }

    console.log(
      `✅ Productos en global_products actualizados: ${globalUpdated}`,
    );

    console.log(`\n🎉 MIGRACIÓN COMPLETADA:`);
    console.log(`   - Total productos reparados: ${totalFixed}`);
    console.log(
      `   - Productos en global_products sincronizados: ${globalUpdated}`,
    );
  } catch (error) {
    console.error('❌ Error en migración:', error);
  } finally {
    await client.close();
    console.log('🔌 Conexión cerrada');
  }
}

if (require.main === module) {
  fixProductCondition().catch(console.error);
}
