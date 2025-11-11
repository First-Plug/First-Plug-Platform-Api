#!/usr/bin/env ts-node

/**
 * FASE 2 SIMPLE: Migrar productos de Members a Global (sin NestJS)
 *
 * Script simplificado que migra productos de members directamente con MongoDB
 */

import { config } from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';

// Cargar variables de entorno
config();

async function runSimpleMigration() {
  const args = process.argv.slice(2);
  const tenantArg = args.find((arg) => arg.startsWith('--tenant='));

  if (!tenantArg) {
    console.error('❌ Error: Debes especificar --tenant=NOMBRE_TENANT');
    console.log(
      'Uso: npm run migrate:members-to-global-simple -- --tenant=mechi_test',
    );
    return;
  }

  const tenantName = tenantArg.split('=')[1];

  if (!tenantName) {
    console.error('❌ Error: Nombre de tenant vacío');
    return;
  }

  console.log(
    `🚀 FASE 2 SIMPLE: Migrando productos de members para tenant ${tenantName}`,
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
    const membersCollection = tenantDb.collection('members');

    // 3. Conectar a la base de datos global
    const globalProductsCollection = firstPlugDb.collection('global_products');

    // 1. Contar members con productos
    const membersWithProducts = await membersCollection
      .find({
        'products.0': { $exists: true },
        isDeleted: { $ne: true },
      })
      .toArray();

    console.log(`👥 Members con productos: ${membersWithProducts.length}`);

    // 2. Contar total de productos
    let totalProducts = 0;
    for (const member of membersWithProducts) {
      totalProducts += member.products?.length || 0;
    }

    console.log(`📦 Total productos en members: ${totalProducts}`);

    if (totalProducts === 0) {
      console.log('✅ No hay productos en members para migrar');
      return;
    }

    // 3. Migrar productos de cada member
    let migrated = 0;
    const errors: string[] = [];

    for (const member of membersWithProducts) {
      if (!member.products || member.products.length === 0) continue;

      console.log(
        `👤 Migrando productos de ${member.firstName} ${member.lastName} (${member.products.length} productos)`,
      );

      for (const product of member.products) {
        try {
          // Preparar documento para global_products
          const globalProduct = {
            // === DATOS DEL TENANT ===
            tenantId: new ObjectId(tenant._id),
            tenantName: tenantName,

            // === REFERENCIA ORIGINAL ===
            originalProductId: new ObjectId(product._id),
            sourceCollection: 'members',

            // === DATOS DEL PRODUCTO ===
            name: product.name || '',
            category: product.category,
            status: product.status,
            location: 'Employee', // Siempre Employee en members

            // Convertir atributos a formato string
            attributes:
              product.attributes?.map((attr: any) => ({
                key: attr.key,
                value: String(attr.value),
              })) || [],

            serialNumber: product.serialNumber || null,
            assignedEmail: member.email,
            assignedMember: `${member.firstName} ${member.lastName}`,
            ...(product.lastAssigned !== undefined && {
              lastAssigned: product.lastAssigned,
            }),
            acquisitionDate: product.acquisitionDate,
            price: product.price,
            additionalInfo: product.additionalInfo,
            productCondition: product.productCondition,
            recoverable: product.recoverable,
            fp_shipment: product.fp_shipment || false,
            activeShipment: product.activeShipment || false,
            imageUrl: product.imageUrl,
            isDeleted: false,

            // === DATOS DE ASIGNACIÓN ===
            memberData: {
              memberId: new ObjectId(member._id),
              memberEmail: member.email,
              memberName: `${member.firstName} ${member.lastName}`,
              assignedAt: product.assignedAt || member.updatedAt || new Date(),
            },

            fpWarehouse: null, // No está en warehouse

            // === CAMPOS CALCULADOS ===
            isComputer: product.category === 'Computer',
            inFpWarehouse: false,
            isAssigned: true,

            // === METADATOS ===
            lastSyncedAt: new Date(),
            sourceUpdatedAt:
              product.updatedAt || member.updatedAt || new Date(),
            createdAt: product.createdAt || member.createdAt || new Date(),
            updatedAt: new Date(),
          };

          // Verificar si ya existe (evitar duplicados)
          const existing = await globalProductsCollection.findOne({
            tenantId: new ObjectId(tenant._id),
            originalProductId: new ObjectId(product._id),
            sourceCollection: 'members',
          });

          if (existing) {
            // Actualizar existente
            await globalProductsCollection.updateOne(
              { _id: existing._id },
              { $set: globalProduct },
            );
          } else {
            // Insertar nuevo
            await globalProductsCollection.insertOne(globalProduct);
          }

          migrated++;

          if (migrated % 10 === 0) {
            console.log(`📦 Migrados ${migrated}/${totalProducts} productos`);
          }
        } catch (error) {
          const errorMsg = `Error migrando producto ${product._id} de member ${member.email}: ${error.message}`;
          console.error(`❌ ${errorMsg}`);
          errors.push(errorMsg);
        }
      }
    }

    console.log(`✅ FASE 2 COMPLETADA:`);
    console.log(`   - Total members: ${membersWithProducts.length}`);
    console.log(`   - Total productos: ${totalProducts}`);
    console.log(`   - Migrados: ${migrated}`);
    console.log(`   - Errores: ${errors.length}`);

    if (errors.length > 0) {
      console.log('\n❌ Errores encontrados:');
      errors.forEach((error) => console.log(`   - ${error}`));
    }

    // 4. Verificar resultado
    const globalCount = await globalProductsCollection.countDocuments({
      tenantId: new ObjectId(tenant._id),
      sourceCollection: 'members',
    });

    console.log(
      `🔍 Verificación: ${globalCount} productos de members en global_products`,
    );

    if (globalCount >= migrated) {
      console.log(
        '🎉 ¡Migración exitosa! Productos de members migrados a global',
      );
    } else {
      console.log(
        `⚠️ Advertencia: Esperábamos al menos ${migrated} pero tenemos ${globalCount}`,
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
