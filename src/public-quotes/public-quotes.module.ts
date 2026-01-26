import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PublicQuotesService } from './public-quotes.service';
import { PublicQuotesCoordinatorService } from './public-quotes-coordinator.service';
import { PublicQuotesController } from './public-quotes.controller';
import { SlackModule } from '../slack/slack.module';
import { RateLimitHelper } from './helpers/rate-limit.helper';
import { SlackHelper } from './helpers/slack.helper';
import { DatabaseHelper } from './helpers/database.helper';
import { PublicQuoteSchema } from './schemas/public-quote.schema';

@Module({
  imports: [
    SlackModule,
    // Conexión a la BD superior (firstPlug en dev, main en prod)
    MongooseModule.forFeature(
      [
        {
          name: 'PublicQuote',
          schema: PublicQuoteSchema,
        },
      ],
      'firstPlug', // Nombre de la conexión para BD superior
    ),
  ],
  providers: [
    PublicQuotesService,
    PublicQuotesCoordinatorService,
    RateLimitHelper,
    SlackHelper,
    DatabaseHelper,
  ],
  controllers: [PublicQuotesController],
  exports: [
    PublicQuotesService,
    PublicQuotesCoordinatorService,
    RateLimitHelper,
    SlackHelper,
    DatabaseHelper,
  ],
})
export class PublicQuotesModule {}
