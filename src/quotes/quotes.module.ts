import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { QuotesService } from './quotes.service';
import { QuotesCoordinatorService } from './quotes-coordinator.service';
import { QuotesController } from './quotes.controller';
import { QuoteSchema } from './schemas/quote.schema';
import { SlackModule } from '../slack/slack.module';
import { HistoryModule } from '../history/history.module';
import { TenantConnectionService } from '../infra/db/tenant-connection.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: 'Quote',
        schema: QuoteSchema,
      },
    ]),
    SlackModule,
    HistoryModule,
  ],
  providers: [QuotesService, QuotesCoordinatorService, TenantConnectionService],
  controllers: [QuotesController],
  exports: [QuotesService, QuotesCoordinatorService],
})
export class QuotesModule {}
