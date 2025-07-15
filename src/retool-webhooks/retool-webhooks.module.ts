import { Module } from '@nestjs/common';
import { RetoolWebhooksController } from './retool-webhooks.controller';
import { TenantsModule } from 'src/tenants/tenants.module';
import { ShipmentsModule } from 'src/shipments/shipments.module';
import { ProductsModule } from 'src/products/products.module';
import { RetoolWebhooksService } from 'src/retool-webhooks/retool-webhoks.service';
import { EventsGateway } from 'src/infra/event-bus/events.gateway';
import { LogisticsModule } from 'src/logistics/logistics.module';

@Module({
  imports: [TenantsModule, ShipmentsModule, ProductsModule, LogisticsModule],
  controllers: [RetoolWebhooksController],
  providers: [RetoolWebhooksService, EventsGateway],
})
export class RetoolWebhooksModule {}
