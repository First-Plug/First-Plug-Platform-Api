import { MiddlewareConsumer, Module } from '@nestjs/common';
import { HistoryService } from './history.service';
import { HistoryController } from './history.controller';
import { tenantModels } from 'src/common/providers/tenant-models-provider';
import { TenantsMiddleware } from 'src/common/middlewares/tenants.middleware';

@Module({
  imports: [],
  controllers: [HistoryController],
  providers: [
    HistoryService,
    tenantModels.historyModel,
    tenantModels.teamModel,
  ],
  exports: [HistoryService, tenantModels.historyModel],
})
export class HistoryModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantsMiddleware).forRoutes(HistoryController);
  }
}
