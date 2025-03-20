import { forwardRef, MiddlewareConsumer, Module } from '@nestjs/common';
import { ShipmentsService } from './shipments.service';
import { ShipmentsController } from './shipments.controller';
import { TenantsModule } from 'src/tenants/tenants.module';
import { TenantsMiddleware } from 'src/common/middlewares/tenants.middleware';
import { JwtService } from '@nestjs/jwt';
import { ProductsModule } from 'src/products/products.module';
import { MembersModule } from 'src/members/members.module';
import { tenantModels } from 'src/common/providers/tenant-models-provider';

@Module({
  imports: [
    TenantsModule,
    forwardRef(() => ProductsModule),
    forwardRef(() => MembersModule),
  ],
  controllers: [ShipmentsController],
  providers: [
    ShipmentsService,
    tenantModels.shipmentModel,
    tenantModels.shipmentMetadataModel,
    JwtService,
  ],
  exports: [
    ShipmentsService,
    tenantModels.shipmentModel,
    tenantModels.shipmentMetadataModel,
  ],
})
export class ShipmentsModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantsMiddleware).forRoutes(ShipmentsController);
  }
}
