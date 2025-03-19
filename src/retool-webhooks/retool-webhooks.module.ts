import { forwardRef, Module } from '@nestjs/common';
import { RetoolWebhooksController } from './retool-webhooks.controller';
import { RetoolWebhooksService } from './retool-webhooks.service';
import { ShipmentsModule } from '../shipments/shipments.module';
import { ProductsModule } from '../products/products.module';
import { MembersModule } from '../members/members.module';
import { TenantsModule } from 'src/tenants/tenants.module';
import { Connection } from 'mongoose';
import {
  Shipment,
  ShipmentSchema,
} from 'src/shipments/schemas/shipment.schema';

@Module({
  imports: [
    forwardRef(() => ShipmentsModule),
    ProductsModule,
    MembersModule,
    TenantsModule,
  ],
  controllers: [RetoolWebhooksController],
  providers: [
    RetoolWebhooksService,
    {
      provide: 'SHIPMENT_MODEL',
      useFactory: async (tenantConnection: Connection) => {
        return tenantConnection.model(Shipment.name, ShipmentSchema);
      },
      inject: ['TENANT_CONNECTION'],
    },
  ],
  exports: [RetoolWebhooksService],
})
export class RetoolWebhooksModule {}
