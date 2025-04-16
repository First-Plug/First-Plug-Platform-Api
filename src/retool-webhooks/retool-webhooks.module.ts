import { Module } from '@nestjs/common';
import { RetoolWebhooksController } from './retool-webhooks.controller';
import { TenantsModule } from 'src/tenants/tenants.module';
import { ShipmentsModule } from 'src/shipments/shipments.module';
import { ProductsModule } from 'src/products/products.module';
import { RetoolWebhooksService } from 'src/retool-webhooks/retool-webhoks.service';

@Module({
  imports: [TenantsModule, ShipmentsModule, ProductsModule],
  controllers: [RetoolWebhooksController],
  providers: [RetoolWebhooksService],
})
export class RetoolWebhooksModule {}
