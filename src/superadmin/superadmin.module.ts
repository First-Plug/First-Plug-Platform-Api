import { Module, forwardRef } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { SuperAdminController } from './superadmin.controller';
import { SuperAdminService } from './superadmin.service';
import { ShipmentsModule } from '../shipments/shipments.module';
import { TenantDbModule } from '../infra/db/tenant-db.module';
import { TenantsModule } from '../tenants/tenants.module';
import { UsersModule } from '../users/users.module';
import { OfficesModule } from '../offices/offices.module';
import { LogisticsModule } from '../logistics/logistics.module';
import { EventsGateway } from '../infra/event-bus/events.gateway';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { InitializeWarehousesScript } from '../warehouses/scripts/initialize-warehouses.script';
import { ProductsModule } from '../products/products.module';
import { GlobalWarehouseMetricsService } from './services/global-warehouse-metrics.service';

@Module({
  imports: [
    TenantDbModule,
    TenantsModule,
    WarehousesModule,
    ProductsModule, // Para acceder a GlobalProductSyncService
    forwardRef(() => ShipmentsModule),
    forwardRef(() => UsersModule),
    forwardRef(() => OfficesModule),
    forwardRef(() => LogisticsModule),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret',
      signOptions: { expiresIn: '48h' },
    }),
  ],
  controllers: [SuperAdminController],
  providers: [
    SuperAdminService,
    EventsGateway,
    JwtService,
    InitializeWarehousesScript,
    GlobalWarehouseMetricsService, // Servicio de métricas globales
  ],
  exports: [SuperAdminService],
})
export class SuperAdminModule {}
