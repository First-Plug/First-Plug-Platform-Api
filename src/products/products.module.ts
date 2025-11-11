import { MiddlewareConsumer, Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { tenantModels } from '../infra/db/tenant-models-provider';
import { TenantsMiddleware } from '../common/middlewares/tenants.middleware';
import { TenantsModule } from '../tenants/tenants.module';
import { JwtService } from '@nestjs/jwt';
import { HistoryModule } from 'src/history/history.module';
import { ShipmentsModule } from '../shipments/shipments.module';
import { SlackModule } from 'src/slack/slack.module';
import { AssignmentsModule } from 'src/assignments/assignments.module';
import { TenantDbModule } from 'src/infra/db/tenant-db.module';
import { LogisticsModule } from 'src/logistics/logistics.module';
import { WarehousesModule } from 'src/warehouses/warehouses.module';
import {
  GlobalProduct,
  GlobalProductSchema,
} from './schemas/global-product.schema';
import { GlobalProductSyncService } from './services/global-product-sync.service';
import { LastAssignedHelper } from './helpers/last-assigned.helper';
import { EventsGateway } from 'src/infra/event-bus/events.gateway';

@Module({
  imports: [
    TenantsModule,
    TenantDbModule,
    forwardRef(() => AssignmentsModule),
    forwardRef(() => ShipmentsModule),
    HistoryModule,
    SlackModule,
    forwardRef(() => LogisticsModule),
    WarehousesModule,
    // Registrar GlobalProduct en la conexión firstPlug
    MongooseModule.forFeature(
      [
        {
          name: GlobalProduct.name,
          schema: GlobalProductSchema,
        },
      ],
      'firstPlug',
    ),
  ],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    tenantModels.productModel,
    JwtService,
    GlobalProductSyncService,
    LastAssignedHelper,
    EventsGateway,
  ],
  exports: [
    ProductsService,
    tenantModels.productModel,
    GlobalProductSyncService,
    LastAssignedHelper,
  ],
})
export class ProductsModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantsMiddleware).forRoutes(ProductsController);
  }
}
