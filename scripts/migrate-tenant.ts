console.log('🔥 SCRIPT INICIADO - Cargando imports...');

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
  migratedUsers?: any[];
  createdOffice?: any;
  updatedTenant?: any;
  error?: string;
}

async function migrateTenant(tenantName: string): Promise<MigrationResult> {
  console.log(`🚀 Iniciando migración para tenant: ${tenantName}`);
  console.log(`📍 Creando contexto de aplicación...`);

  const app = await NestFactory.createApplicationContext(AppModule);
  console.log(`✅ Contexto creado exitosamente`);

  try {
    // Obtener modelos
    console.log(`📦 Obteniendo modelos...`);
    const tenantModel = app.get<Model<Tenant>>(getModelToken(Tenant.name));
    const userModel = app.get<Model<User>>(getModelToken(User.name));
    const tenantModelRegistry = app.get(TenantModelRegistry);
    console.log(`✅ Modelos obtenidos exitosamente`);

    // 1. Buscar tenant viejo (usar any para acceder a campos del modelo viejo)
    console.log(`🔍 Buscando tenant con nombre: ${tenantName}`);
    const oldTenant: any = await tenantModel.findOne({ tenantName });
    if (!oldTenant) {
      console.log(`❌ No se encontró tenant con nombre: ${tenantName}`);
      // Intentar buscar todos los tenants para debug
      const allTenants = await tenantModel.find({}).limit(5);
      console.log(
        `📋 Tenants disponibles:`,
        allTenants.map((t) => ({
          id: t._id,
          tenantName: (t as any).tenantName || 'sin tenantName',
          name: t.name,
        })),
      );
      throw new Error(`No se encontró tenant con nombre: ${tenantName}`);
    }

    console.log(`📋 Tenant encontrado:`, {
      id: oldTenant._id,
      name: oldTenant.name,
      email: oldTenant.email,
      tenantName: oldTenant.tenantName,
    });

    // 2. Buscar TODOS los usuarios viejos con este tenantName
    const oldUsers: any[] = await tenantModel.find({ tenantName });
    if (oldUsers.length === 0) {
      throw new Error(`No se encontraron usuarios para tenant: ${tenantName}`);
    }

    console.log(`📋 Encontrados ${oldUsers.length} usuarios para migrar`);

    // 3. Verificar si ya está migrado (buscar cualquier usuario migrado)
    const existingUser = await userModel.findOne({
      email: { $in: oldUsers.map((u) => u.email) },
    });
    if (existingUser) {
      throw new Error(
        `Tenant ya migrado. Usuario encontrado: ${existingUser.email}`,
      );
    }

    // 4. Migrar TODOS los usuarios
    console.log(`👥 Migrando ${oldUsers.length} usuarios...`);
    const migratedUsers: Array<{
      id: any;
      email: string;
      firstName: string;
    }> = [];

    for (const oldUser of oldUsers) {
      console.log(`👤 Migrando usuario: ${oldUser.email}`);

      const newUser = await userModel.create({
        firstName: oldUser.name?.split(' ')[0] || 'Usuario',
        lastName: oldUser.name?.split(' ').slice(1).join(' ') || '',
        email: oldUser.email,
        accountProvider: oldUser.accountProvider || 'credentials',
        password: oldUser.password,
        salt: oldUser.salt,
        tenantId: oldTenant._id, // Todos apuntan al mismo tenant
        tenantName: oldUser.tenantName,
        widgets: oldUser.widgets || [],
        phone: '', // Datos personales vacíos (para completar después)
        address: '',
        apartment: '',
        city: '',
        state: '',
        country: '',
        zipCode: '',
        image: oldUser.image || '',
        status: 'active',
        isActive: true,
        isDeleted: false,
      });

      migratedUsers.push({
        id: newUser._id,
        email: newUser.email,
        firstName: newUser.firstName,
      });

      console.log(`✅ Usuario migrado: ${newUser.email}`);
    }

    console.log(`✅ ${migratedUsers.length} usuarios migrados exitosamente`);

    // 5. Crear oficina en tenant DB
    console.log(`🏢 Creando oficina en DB del tenant: ${tenantName}`);
    console.log(`📡 Obteniendo modelo de oficina para tenant: ${tenantName}`);
    const OfficeModel = await tenantModelRegistry.getOfficeModel(tenantName);
    console.log(`✅ Modelo de oficina obtenido para tenant: ${tenantName}`);

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
          createdBy: migratedUsers[0]?.id || null, // Primer usuario migrado como creador
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
      migratedUsers: migratedUsers,
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
  try {
    console.log('🚀 INICIANDO SCRIPT DE MIGRACIÓN');
    console.log('📋 Argumentos recibidos:', process.argv);

    const tenantName = process.argv[2];

    if (!tenantName) {
      console.error('❌ Uso: npm run migrate:tenant <tenantName>');
      console.error('❌ Ejemplo: npm run migrate:tenant mechi_test');
      process.exit(1);
    }

    console.log(`🎯 Migrando tenant: ${tenantName}`);
    console.log(`⚠️  ADVERTENCIA: Esta operación modificará la base de datos`);
    console.log(`⚠️  Asegúrate de tener un backup antes de continuar`);

    console.log('📞 Llamando a migrateTenant...');
    const result = await migrateTenant(tenantName);
    console.log('✅ migrateTenant completado, procesando resultado...');

    if (result.success) {
      console.log(`\n🎉 MIGRACIÓN EXITOSA:`);
      console.log(`✅ Tenant: ${result.tenantName}`);
      console.log(`✅ Usuarios migrados: ${result.migratedUsers?.length || 0}`);
      result.migratedUsers?.forEach((user) => {
        console.log(`   - ${user.email} (${user.firstName})`);
      });
      console.log(`✅ Oficina creada: ${result.createdOffice.name}`);
      console.log(`✅ Tenant actualizado: ${result.updatedTenant.name}`);
    } else {
      console.log(`\n💥 MIGRACIÓN FALLÓ:`);
      console.log(`❌ Tenant: ${result.tenantName}`);
      console.log(`❌ Error: ${result.error}`);
    }
  } catch (error) {
    console.error('💥 ERROR CRÍTICO EN MAIN:');
    console.error('❌ Error:', error.message);
    console.error('❌ Stack:', error.stack);
    process.exit(1);
  }
}

main().catch(console.error);
