import { MiddlewareConsumer, Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { QuotesService } from './quotes.service';
import { QuotesCoordinatorService } from './quotes-coordinator.service';
import { QuotesController } from './quotes.controller';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { AttachmentsCoordinatorService } from './attachments-coordinator.service';
import { SlackModule } from '../slack/slack.module';
import { HistoryModule } from '../history/history.module';
import { StorageModule } from '../storage/storage.module';
import { AttachmentsModule } from '../attachments/attachments.module';
import { TenantConnectionService } from '../infra/db/tenant-connection.service';
import { TenantsModule } from '../tenants/tenants.module';
import { tenantModels } from '../infra/db/tenant-models-provider';
import { TenantsMiddleware } from '../common/middlewares/tenants.middleware';

@Module({
  imports: [
    SlackModule,
    HistoryModule,
    TenantsModule,
    StorageModule,
    AttachmentsModule,
  ],
  providers: [
    QuotesService,
    QuotesCoordinatorService,
    AttachmentsService,
    AttachmentsCoordinatorService,
    TenantConnectionService,
    JwtService,
    tenantModels.quoteModel,
  ],
  controllers: [QuotesController, AttachmentsController],
  exports: [
    QuotesService,
    QuotesCoordinatorService,
    AttachmentsService,
    AttachmentsCoordinatorService,
  ],
})
export class QuotesModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantsMiddleware)
      .forRoutes(QuotesController, AttachmentsController);
  }
}
