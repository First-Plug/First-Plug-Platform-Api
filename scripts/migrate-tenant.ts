import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { Model } from 'mongoose';
import { Tenant } from '../src/tenants/schemas/tenant.schema';
import { User } from '../src/users/schemas/user.schema';
// import { Office } from '../src/offices/schemas/office.schema';
import { TenantModelRegistry } from '../src/infra/db/tenant-model-registry';
import { getModelToken } from '@nestjs/mongoose';

interface MigrationResult {
  success: boolean;
  tenantId: string;
  tenantName: string;
  createdUser?: any;
  createdOffice?: any;
  updatedTenant?: any;
  error?: string;
}

async function migrateTenant(tenantName: string): Promise<MigrationResult> {
  console.log(`🚀 Iniciando migración para tenant: ${tenantName}`);

  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    // Obtener modelos
    const tenantModel = app.get<Model<Tenant>>(getModelToken(Tenant.name));
    const userModel = app.get<Model<User>>(getModelToken(User.name));
    const tenantModelRegistry = app.get(TenantModelRegistry);

    // 1. Buscar tenant viejo (usar any para acceder a campos del modelo viejo)
    const oldTenant: any = await tenantModel.findOne({ tenantName });
    if (!oldTenant) {
      throw new Error(`No se encontró tenant con nombre: ${tenantName}`);
    }

    console.log(`📋 Tenant encontrado:`, {
      id: oldTenant._id,
      name: oldTenant.name,
      email: oldTenant.email,
    });

    // 2. Verificar si ya está migrado
    const existingUser = await userModel.findOne({ email: oldTenant.email });
    if (existingUser) {
      throw new Error(`Usuario ya migrado: ${oldTenant.email}`);
    }

    // 3. Crear usuario en users collection
    console.log(`👤 Creando usuario...`);
    const newUser = await userModel.create({
      firstName: oldTenant.name || 'Usuario',
      lastName: '',
      email: oldTenant.email,
      accountProvider: oldTenant.accountProvider || 'credentials',
      password: oldTenant.password,
      salt: oldTenant.salt,
      tenantId: oldTenant._id,
      tenantName: oldTenant.tenantName, // Para compatibilidad con JWT
      widgets: oldTenant.widgets || [],
      phone: '', // Datos personales vacíos
      address: '',
      apartment: '',
      city: '',
      state: '',
      country: '',
      zipCode: '',
      image: oldTenant.image || '',
      status: 'active',
      isActive: true,
      isDeleted: false,
    });

    console.log(`✅ Usuario creado:`, {
      id: newUser._id,
      email: newUser.email,
      firstName: newUser.firstName,
    });

    // 4. Crear oficina en tenant DB
    console.log(`🏢 Creando oficina en DB del tenant...`);
    const OfficeModel = await tenantModelRegistry.getOfficeModel(tenantName);

    const newOffice = await OfficeModel.create({
      name: `${oldTenant.name} - Oficina Principal`,
      email: oldTenant.email,
      phone: oldTenant.phone || '',
      country: oldTenant.country || '',
      city: oldTenant.city || '',
      state: oldTenant.state || '',
      zipCode: oldTenant.zipCode || '',
      address: oldTenant.address || '',
      apartment: oldTenant.apartment || '',
      tenantId: oldTenant._id,
      isDefault: true,
      isActive: true,
      isDeleted: false,
    });

    console.log(`✅ Oficina creada:`, {
      id: newOffice._id,
      name: newOffice.name,
      address: newOffice.address,
    });

    // 5. Limpiar tenant (mantener solo datos corporativos)
    console.log(`🧹 Limpiando tenant...`);
    const updatedTenant = await tenantModel.findByIdAndUpdate(
      oldTenant._id,
      {
        $unset: {
          // Remover datos de usuario
          email: 1,
          password: 1,
          salt: 1,
          accountProvider: 1,
          widgets: 1,
          // Remover datos de oficina
          phone: 1,
          country: 1,
          city: 1,
          state: 1,
          zipCode: 1,
          address: 1,
          apartment: 1,
        },
        $set: {
          // Actualizar datos corporativos
          name: `${oldTenant.name} Company`, // Nombre de la empresa
          createdBy: newUser._id,
          isActive: true,
        },
      },
      { new: true },
    );

    if (!updatedTenant) {
      throw new Error('Error actualizando tenant');
    }

    console.log(`✅ Tenant limpiado:`, {
      id: updatedTenant._id,
      name: updatedTenant.name,
      createdBy: (updatedTenant as any).createdBy,
    });

    await app.close();

    return {
      success: true,
      tenantId: oldTenant._id.toString(),
      tenantName: oldTenant.tenantName,
      createdUser: {
        id: newUser._id,
        email: newUser.email,
        firstName: newUser.firstName,
      },
      createdOffice: {
        id: newOffice._id,
        name: newOffice.name,
        address: newOffice.address,
      },
      updatedTenant: {
        id: updatedTenant._id,
        name: updatedTenant.name,
      },
    };
  } catch (error) {
    await app.close();
    return {
      success: false,
      tenantId: '',
      tenantName,
      error: error.message,
    };
  }
}

// Script principal
async function main() {
  const tenantName = process.argv[2];

  if (!tenantName) {
    console.error('❌ Uso: npm run migrate:tenant <tenantName>');
    console.error('❌ Ejemplo: npm run migrate:tenant mechi_test');
    process.exit(1);
  }

  console.log(`🎯 Migrando tenant: ${tenantName}`);
  console.log(`⚠️  ADVERTENCIA: Esta operación modificará la base de datos`);
  console.log(`⚠️  Asegúrate de tener un backup antes de continuar`);

  const result = await migrateTenant(tenantName);

  if (result.success) {
    console.log(`\n🎉 MIGRACIÓN EXITOSA:`);
    console.log(`✅ Tenant: ${result.tenantName}`);
    console.log(`✅ Usuario creado: ${result.createdUser.email}`);
    console.log(`✅ Oficina creada: ${result.createdOffice.name}`);
    console.log(`✅ Tenant actualizado: ${result.updatedTenant.name}`);
  } else {
    console.log(`\n💥 MIGRACIÓN FALLÓ:`);
    console.log(`❌ Tenant: ${result.tenantName}`);
    console.log(`❌ Error: ${result.error}`);
  }
}

main().catch(console.error);
