import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { GlobalProduct } from '../src/products/schemas/global-product.schema';

/**
 * Script para limpiar productos duplicados en la colección global
 * 
 * PROBLEMA:
 * - Algunos productos tienen tenantId como String en lugar de ObjectId
 * - Esto causa duplicados porque el query no encuentra el documento existente
 * 
 * SOLUCIÓN:
 * - Buscar productos con tenantId como String
 * - Convertir tenantId a ObjectId
 * - Eliminar duplicados manteniendo el más reciente
 */

async function cleanupDuplicateGlobalProducts() {
  console.log('🧹 Starting cleanup of duplicate global products...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const globalProductModel = app.get<Model<GlobalProduct>>(
    getModelToken(GlobalProduct.name),
  );

  try {
    // 1. Buscar todos los productos
    const allProducts = await globalProductModel.find({}).lean();
    console.log(`📊 Total products in global collection: ${allProducts.length}\n`);

    // 2. Agrupar por tenantName + originalProductId
    const productGroups = new Map<string, any[]>();
    
    for (const product of allProducts) {
      const key = `${product.tenantName}_${product.originalProductId}`;
      if (!productGroups.has(key)) {
        productGroups.set(key, []);
      }
      productGroups.get(key)!.push(product);
    }

    // 3. Encontrar duplicados
    const duplicates: any[] = [];
    for (const [key, products] of productGroups.entries()) {
      if (products.length > 1) {
        duplicates.push({ key, products });
      }
    }

    console.log(`🔍 Found ${duplicates.length} groups with duplicates:\n`);

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found! Collection is clean.\n');
      await app.close();
      return;
    }

    // 4. Mostrar duplicados
    for (const { key, products } of duplicates) {
      console.log(`\n📦 Group: ${key}`);
      console.log(`   Total duplicates: ${products.length}`);
      
      for (const product of products) {
        const tenantIdType = typeof product.tenantId === 'string' ? 'String' : 'ObjectId';
        console.log(`   - _id: ${product._id}`);
        console.log(`     tenantId: ${product.tenantId} (${tenantIdType})`);
        console.log(`     sourceCollection: ${product.sourceCollection}`);
        console.log(`     location: ${product.location}`);
        console.log(`     lastSyncedAt: ${product.lastSyncedAt}`);
      }
    }

    // 5. Preguntar confirmación (en producción, esto debería ser manual)
    console.log('\n⚠️  CLEANUP STRATEGY:');
    console.log('   - Keep the most recently synced product (latest lastSyncedAt)');
    console.log('   - Delete older duplicates');
    console.log('   - Convert tenantId to ObjectId if needed\n');

    // 6. Realizar limpieza
    let deletedCount = 0;
    let updatedCount = 0;

    for (const { key, products } of duplicates) {
      // Ordenar por lastSyncedAt (más reciente primero)
      products.sort((a, b) => {
        const dateA = a.lastSyncedAt ? new Date(a.lastSyncedAt).getTime() : 0;
        const dateB = b.lastSyncedAt ? new Date(b.lastSyncedAt).getTime() : 0;
        return dateB - dateA;
      });

      const keepProduct = products[0];
      const deleteProducts = products.slice(1);

      console.log(`\n🔧 Processing group: ${key}`);
      console.log(`   ✅ Keeping: ${keepProduct._id} (${keepProduct.sourceCollection}, synced: ${keepProduct.lastSyncedAt})`);

      // Convertir tenantId a ObjectId si es necesario
      if (typeof keepProduct.tenantId === 'string') {
        const tenantsCollection = globalProductModel.db.collection('tenants');
        const tenant = await tenantsCollection.findOne({
          tenantName: keepProduct.tenantName,
        });

        if (tenant) {
          await globalProductModel.updateOne(
            { _id: keepProduct._id },
            { $set: { tenantId: tenant._id } },
          );
          console.log(`   🔄 Updated tenantId to ObjectId: ${tenant._id}`);
          updatedCount++;
        }
      }

      // Eliminar duplicados
      for (const deleteProduct of deleteProducts) {
        await globalProductModel.deleteOne({ _id: deleteProduct._id });
        console.log(`   ❌ Deleted: ${deleteProduct._id} (${deleteProduct.sourceCollection}, synced: ${deleteProduct.lastSyncedAt})`);
        deletedCount++;
      }
    }

    console.log('\n✅ CLEANUP COMPLETE!');
    console.log(`   - Products updated: ${updatedCount}`);
    console.log(`   - Products deleted: ${deletedCount}`);
    console.log(`   - Total products remaining: ${allProducts.length - deletedCount}\n`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await app.close();
  }
}

// Ejecutar script
cleanupDuplicateGlobalProducts()
  .then(() => {
    console.log('🎉 Script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });

