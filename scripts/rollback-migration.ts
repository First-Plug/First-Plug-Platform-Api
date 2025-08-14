import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { Model } from 'mongoose';
import { Tenant } from '../src/tenants/schemas/tenant.schema';
import { User } from '../src/users/schemas/user.schema';
import { TenantModelRegistry } from '../src/infra/db/tenant-model-registry';
import { getModelToken } from '@nestjs/mongoose';

async function rollbackMigration(tenantName: string) {
  console.log(`🔄 Iniciando rollback para tenant: ${tenantName}`);
  
  const app = await NestFactory.createApplicationContext(AppModule);
  
  try {
    // Obtener modelos
    const tenantModel = app.get<Model<Tenant>>(getModelToken(Tenant.name));
    const userModel = app.get<Model<User>>(getModelToken(User.name));
    const tenantModelRegistry = app.get(TenantModelRegistry);

    // 1. Buscar tenant
    const tenant = await tenantModel.findOne({ tenantName });
    if (!tenant) {
      throw new Error(`No se encontró tenant: ${tenantName}`);
    }

    // 2. Buscar usuario migrado
    const user = await userModel.findOne({ tenantId: tenant._id });
    if (!user) {
      console.log(`⚠️  No se encontró usuario migrado para ${tenantName}`);
      await app.close();
      return;
    }

    console.log(`📋 Encontrado usuario migrado: ${user.email}`);

    // 3. Buscar oficina en tenant DB
    const OfficeModel = await tenantModelRegistry.getOfficeModel(tenantName);
    const office = await OfficeModel.findOne({ tenantId: tenant._id });

    // 4. Restaurar datos originales en tenant
    console.log(`🔄 Restaurando datos originales...`);
    await tenantModel.findByIdAndUpdate(tenant._id, {
      $set: {
        name: user.firstName,
        email: user.email,
        accountProvider: user.accountProvider,
        password: user.password,
        salt: (user as any).salt,
        widgets: user.widgets,
        phone: office?.phone || '',
        country: office?.country || '',
        city: office?.city || '',
        state: office?.state || '',
        zipCode: office?.zipCode || '',
        address: office?.address || '',
        apartment: office?.apartment || '',
      },
      $unset: {
        createdBy: 1,
      }
    });

    // 5. Eliminar usuario de users collection
    console.log(`🗑️  Eliminando usuario migrado...`);
    await userModel.findByIdAndDelete(user._id);

    // 6. Eliminar oficina de tenant DB
    if (office) {
      console.log(`🗑️  Eliminando oficina...`);
      await OfficeModel.findByIdAndDelete(office._id);
    }

    console.log(`✅ Rollback completado para ${tenantName}`);

  } catch (error) {
    console.error(`❌ Error en rollback: ${error.message}`);
  } finally {
    await app.close();
  }
}

// Script principal
async function main() {
  const tenantName = process.argv[2];
  
  if (!tenantName) {
    console.error('❌ Uso: npm run rollback:migration <tenantName>');
    console.error('❌ Ejemplo: npm run rollback:migration mechi_test');
    process.exit(1);
  }

  console.log(`⚠️  ADVERTENCIA: Esto revertirá la migración de ${tenantName}`);
  console.log(`⚠️  Los datos volverán al formato anterior`);
  
  await rollbackMigration(tenantName);
}

main().catch(console.error);
