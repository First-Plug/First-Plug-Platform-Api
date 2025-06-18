import { Module } from '@nestjs/common';
import { LogisticsService } from './logistics.sevice';
import { TenantDbModule } from 'src/infra/db/tenant-db.module';
import { TenantModelRegistry } from 'src/infra/db/tenant-model-registry';

@Module({
  imports: [TenantDbModule],
  providers: [TenantModelRegistry, LogisticsService],
  exports: [LogisticsService],
})
export class LogisticsModule {}
