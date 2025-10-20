import { MiddlewareConsumer, Module, forwardRef } from '@nestjs/common';
import { HistoryService } from './history.service';
import { HistoryController } from './history.controller';
import { TenantsModule } from 'src/tenants/tenants.module';
import { UsersModule } from 'src/users/users.module';
import { JwtService } from '@nestjs/jwt';
import { tenantModels } from 'src/infra/db/tenant-models-provider';
import { TenantsMiddleware } from 'src/common/middlewares/tenants.middleware';

@Module({
  imports: [forwardRef(() => TenantsModule), forwardRef(() => UsersModule)],
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
