import { forwardRef, MiddlewareConsumer, Module } from '@nestjs/common';
import { ShipmentsService } from './shipments.service';
import { ShipmentsController } from './shipments.controller';
import { tenantConnectionProvider } from 'src/infra/db/tenant-connection.provider';
import { TenantsModule } from '../tenants/tenants.module';
import { tenantModels } from '../infra/db/tenant-models-provider';
import { Shipment, ShipmentSchema } from './schema/shipment.schema';
import { JwtService } from '@nestjs/jwt';
// import { MembersModule } from 'src/members/members.module';
// import { ProductsModule } from 'src/products/products.module';
import { OfficeAddressUpdatedListener } from 'src/shipments/listeners/office-address-update.listener';
import { MemberAddressUpdatedListener } from 'src/shipments/listeners/member-address-update.listener';
import { ProductUpdatedListener } from 'src/shipments/listeners/product-updated.listener';
import { HistoryModule } from 'src/history/history.module';
import { TenantsMiddleware } from 'src/common/middlewares/tenants.middleware';
import { SlackModule } from '../slack/slack.module';
import { LogisticsModule } from 'src/logistics/logistics.module';

@Module({
  imports: [
    TenantsModule,
    // forwardRef(() => MembersModule),
    // forwardRef(() => ProductsModule),
    forwardRef(() => HistoryModule),
    SlackModule,
    forwardRef(() => LogisticsModule),
  ],
  controllers: [ShipmentsController],
  providers: [
    ShipmentsService,
    OfficeAddressUpdatedListener,
    MemberAddressUpdatedListener,
    ProductUpdatedListener,
    JwtService,
    tenantConnectionProvider,
    {
      provide: 'SHIPMENT_MODEL',
      useFactory: (tenantConnection) => {
        return tenantConnection.model(Shipment.name, ShipmentSchema);
      },
      inject: ['TENANT_CONNECTION'],
    },
    ...Object.values(tenantModels),
    tenantModels.shipmentMetadataModel,
  ],
  exports: [ShipmentsService, tenantModels.shipmentMetadataModel],
})
export class ShipmentsModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantsMiddleware).forRoutes(ShipmentsController);
  }
}
