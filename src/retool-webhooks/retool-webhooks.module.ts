import { Module } from '@nestjs/common';
import { RetoolWebhooksController } from './retool-webhooks.controller';
import { RetoolWebhooksService } from './retool-webhooks.service';

import { ProductsModule } from '../products/products.module';
import { MembersModule } from '../members/members.module';
import { TenantsModule } from 'src/tenants/tenants.module';
import { tenantModels } from 'src/common/providers/tenant-models-provider';

@Module({
  imports: [
    TenantsModule,
    // forwardRef(() => ShipmentsModule),
    ProductsModule,
    MembersModule,
  ],
  controllers: [RetoolWebhooksController],
  providers: [
    RetoolWebhooksService,
    tenantModels.shipmentModel,
    tenantModels.shipmentMetadataModel,
    tenantModels.productModel,
    tenantModels.memberModel,
    // {
    //   provide: 'SHIPMENT_MODEL',
    //   useFactory: async (tenantConnection: Connection) => {
    //     return tenantConnection.model(Shipment.name, ShipmentSchema);
    //   },
    //   inject: ['TENANT_CONNECTION'],
    // },
  ],
  exports: [RetoolWebhooksService],
})
export class RetoolWebhooksModule {}
