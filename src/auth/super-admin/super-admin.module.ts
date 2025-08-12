import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminService } from './super-admin.service';
import { SuperAdminAuditInterceptor } from './interceptors/super-admin-audit.interceptor';
import { User, UserSchema } from '../../users/schemas/user.schema';
import { Tenant, TenantSchema } from '../../tenants/schemas/tenant.schema';
import { TenantConnectionService } from '../../infra/db/tenant-connection.service';
import { TenantModelRegistry } from '../../infra/db/tenant-model-registry';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Tenant.name, schema: TenantSchema },
    ]),
  ],
  controllers: [SuperAdminController],
  providers: [
    SuperAdminService,
    SuperAdminAuditInterceptor,
    TenantConnectionService,
    TenantModelRegistry,
    JwtService,
  ],
  exports: [SuperAdminService],
})
export class SuperAdminModule {}
