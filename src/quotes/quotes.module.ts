import { MiddlewareConsumer, Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { QuotesService } from './quotes.service';
import { QuotesCoordinatorService } from './quotes-coordinator.service';
import { QuotesController } from './quotes.controller';
import { SlackModule } from '../slack/slack.module';
import { HistoryModule } from '../history/history.module';
import { TenantConnectionService } from '../infra/db/tenant-connection.service';
import { TenantsModule } from '../tenants/tenants.module';
import { tenantModels } from '../infra/db/tenant-models-provider';
import { TenantsMiddleware } from '../common/middlewares/tenants.middleware';

@Module({
  imports: [SlackModule, HistoryModule, TenantsModule],
  providers: [
    QuotesService,
    QuotesCoordinatorService,
    TenantConnectionService,
    JwtService,
    tenantModels.quoteModel,
  ],
  controllers: [QuotesController],
  exports: [QuotesService, QuotesCoordinatorService],
})
export class QuotesModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantsMiddleware).forRoutes(QuotesController);
  }
}
