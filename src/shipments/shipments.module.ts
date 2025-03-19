import { forwardRef, MiddlewareConsumer, Module } from '@nestjs/common';
import { ShipmentsService } from './shipments.service';
import { ShipmentsController } from './shipments.controller';
import { TenantsModule } from 'src/tenants/tenants.module';
import { TenantsMiddleware } from 'src/common/middlewares/tenants.middleware';
import { JwtService } from '@nestjs/jwt';
import { ProductsModule } from 'src/products/products.module';
import { MembersModule } from 'src/members/members.module';
import { tenantModels } from 'src/common/providers/tenant-models-provider';
import { TeamsModule } from 'src/teams/teams.module';
import { HistoryModule } from 'src/history/history.module';
// import { TenantConnectionService } from 'src/common/providers/tenant-connection.service';

@Module({
  imports: [
    TenantsModule,
    forwardRef(() => ProductsModule),
    forwardRef(() => MembersModule),
    forwardRef(() => HistoryModule),
    forwardRef(() => TeamsModule),
  ],
  controllers: [ShipmentsController],
  providers: [
    ShipmentsService,
    tenantModels.shipmentModel,
    tenantModels.shipmentMetadataModel,
    // TenantConnectionService,
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
