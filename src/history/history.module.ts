import { MiddlewareConsumer, Module } from '@nestjs/common';
import { HistoryService } from './history.service';
import { HistoryController } from './history.controller';
import { TenantsModule } from 'src/tenants/tenants.module';
import { JwtService } from '@nestjs/jwt';
import { tenantModels } from 'src/common/providers/tenant-models-provider';
import { TenantsMiddleware } from 'src/common/middlewares/tenants.middleware';

@Module({
  imports: [TenantsModule],
  controllers: [HistoryController],
  providers: [
    HistoryService,
    tenantModels.historyModel,
    JwtService,
    tenantModels.teamModel,
  ],
  exports: [HistoryService, tenantModels.historyModel],
})
export class HistoryModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantsMiddleware).forRoutes(HistoryController);
  }
}
