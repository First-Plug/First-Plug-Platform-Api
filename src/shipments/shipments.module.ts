import { forwardRef, Module } from '@nestjs/common';
import { ShipmentsService } from './shipments.service';
import { ShipmentsController } from './shipments.controller';
import { tenantConnectionProvider } from 'src/common/providers/tenant-connection.provider';
import { TenantsModule } from '../tenants/tenants.module';
import { tenantModels } from '../common/providers/tenant-models-provider';
import { Shipment, ShipmentSchema } from './schema/shipment.schema';
import { JwtService } from '@nestjs/jwt';
import { MembersModule } from 'src/members/members.module';
import { ProductsModule } from 'src/products/products.module';

@Module({
  imports: [
    TenantsModule,
    forwardRef(() => MembersModule),
    forwardRef(() => ProductsModule),
  ],
  controllers: [ShipmentsController],
  providers: [
    ShipmentsService,
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
export class ShipmentsModule {}
