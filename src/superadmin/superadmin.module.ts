import { Module, forwardRef } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { SuperAdminController } from './superadmin.controller';
import { SuperAdminService } from './superadmin.service';
import { ShipmentsModule } from '../shipments/shipments.module';
import { TenantDbModule } from '../infra/db/tenant-db.module';
import { TenantsModule } from '../tenants/tenants.module';
import { UsersModule } from '../users/users.module';
import { OfficesModule } from '../offices/offices.module';
import { EventsGateway } from '../infra/event-bus/events.gateway';

@Module({
  imports: [
    TenantDbModule,
    TenantsModule,
    forwardRef(() => ShipmentsModule),
    forwardRef(() => UsersModule),
    forwardRef(() => OfficesModule),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret',
      signOptions: { expiresIn: '48h' },
    }),
  ],
  controllers: [SuperAdminController],
  providers: [SuperAdminService, EventsGateway, JwtService],
  exports: [SuperAdminService],
})
export class SuperAdminModule {}
