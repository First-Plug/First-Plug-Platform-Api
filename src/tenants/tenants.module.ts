import { Module } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Tenant, TenantSchema } from './schemas/tenant.schema';
import { tenantConnectionProvider } from 'src/infra/db/tenant-connection.provider';
import { TenantsController } from './tenants.controller';
import { JwtService } from '@nestjs/jwt';
import { TenantConnectionService } from 'src/infra/db/tenant-connection.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Tenant.name,
        schema: TenantSchema,
      },
    ]),
  ],
  controllers: [TenantsController],
  providers: [
    TenantsService,
    TenantConnectionService,
    tenantConnectionProvider,
    JwtService,
  ],
  exports: [TenantsService, TenantConnectionService, tenantConnectionProvider],
})
export class TenantsModule {}
