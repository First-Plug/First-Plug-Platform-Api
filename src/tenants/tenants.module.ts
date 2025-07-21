import { Module } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Tenant, TenantSchema } from './schemas/tenant.schema';
import { tenantConnectionProvider } from 'src/infra/db/tenant-connection.provider';
import { TenantsController } from './tenants.controller';
import { JwtService } from '@nestjs/jwt';
import { TenantConnectionService } from 'src/infra/db/tenant-connection.service';
import { TenantUserAdapterService } from '../common/services/tenant-user-adapter.service';
import { TenantEndpointsAdapterService } from '../common/services/tenant-endpoints-adapter.service';
import { UsersModule } from '../users/users.module';
import { OfficesModule } from '../offices/offices.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Tenant.name,
        schema: TenantSchema,
      },
    ]),
    UsersModule, // Para acceder a UsersService
    OfficesModule, // Para acceder a OfficesService
  ],
  controllers: [TenantsController],
  providers: [
    TenantsService,
    TenantConnectionService,
    tenantConnectionProvider,
    JwtService,
    TenantUserAdapterService, // Adaptador existente
    TenantEndpointsAdapterService, // Nuevo adaptador
  ],
  exports: [
    TenantsService,
    TenantConnectionService,
    tenantConnectionProvider,
    TenantUserAdapterService, // Exportar para otros módulos
    TenantEndpointsAdapterService, // Exportar para otros módulos
  ],
})
export class TenantsModule {}
