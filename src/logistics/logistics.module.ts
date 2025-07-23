import { Module, forwardRef } from '@nestjs/common';
import { LogisticsService } from './logistics.sevice';
import { TenantDbModule } from 'src/infra/db/tenant-db.module';
import { TenantModelRegistry } from 'src/infra/db/tenant-model-registry';
import { ShipmentsModule } from 'src/shipments/shipments.module';
import { SlackModule } from 'src/slack/slack.module';
import { HistoryModule } from 'src/history/history.module';
import { JwtService } from '@nestjs/jwt';
import { MembersModule } from 'src/members/members.module';
import { TenantsModule } from 'src/tenants/tenants.module';
import { ProductsModule } from 'src/products/products.module';
import { OfficesModule } from '../offices/offices.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TenantDbModule,
    OfficesModule,
    UsersModule,
    forwardRef(() => ShipmentsModule),
    forwardRef(() => MembersModule),
    forwardRef(() => TenantsModule),
    forwardRef(() => ProductsModule),
    SlackModule,
    HistoryModule,
  ],
  providers: [TenantModelRegistry, LogisticsService, JwtService],
  exports: [LogisticsService],
})
export class LogisticsModule {}
