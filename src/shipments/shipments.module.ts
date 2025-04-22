import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ShipmentsService } from './shipments.service';
import { ShipmentsController } from './shipments.controller';
import { tenantModels } from '../common/providers/tenant-models-provider';
import { TenantsMiddleware } from 'src/common/middlewares/tenants.middleware';
import { TenantAddressUpdatedListener } from 'src/shipments/listeners/tenant-address-update.listener';

@Module({
  controllers: [ShipmentsController],
  providers: [
    ShipmentsService,
    TenantAddressUpdatedListener,
    tenantModels.shipmentModel,
    tenantModels.shipmentMetadataModel,
  ],
  exports: [ShipmentsService, tenantModels.shipmentMetadataModel],
})
export class ShipmentsModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantsMiddleware).forRoutes(ShipmentsController);
  }
}
