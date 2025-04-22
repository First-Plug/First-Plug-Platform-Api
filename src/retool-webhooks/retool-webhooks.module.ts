import { Module } from '@nestjs/common';
import { RetoolWebhooksController } from './retool-webhooks.controller';
import { RetoolWebhooksService } from 'src/retool-webhooks/retool-webhoks.service';

@Module({
  imports: [],
  controllers: [RetoolWebhooksController],
  providers: [RetoolWebhooksService],
})
export class RetoolWebhooksModule {}
