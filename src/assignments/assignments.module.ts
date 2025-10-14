import { Module, forwardRef } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { MembersModule } from 'src/members/members.module';
import { ProductsModule } from 'src/products/products.module';
import { HistoryModule } from 'src/history/history.module';
import { ShipmentsModule } from 'src/shipments/shipments.module';
import { SlackModule } from 'src/slack/slack.module';
import { tenantModels } from 'src/infra/db/tenant-models-provider';
import { TenantsModule } from 'src/tenants/tenants.module';
import { AssignmentsController } from './assignments.controller';
import { JwtService } from '@nestjs/jwt';
import { TenantModelRegistry } from 'src/infra/db/tenant-model-registry';
import { LogisticsModule } from 'src/logistics/logistics.module';
import { WarehousesModule } from 'src/warehouses/warehouses.module';
import { OfficesModule } from 'src/offices/offices.module';
import { GlobalProductSyncService } from 'src/products/services/global-product-sync.service';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from 'src/users/users.module';
import {
  GlobalProduct,
  GlobalProductSchema,
} from 'src/products/schemas/global-product.schema';

@Module({
  imports: [
    forwardRef(() => MembersModule),
    forwardRef(() => ProductsModule),
    forwardRef(() => ShipmentsModule),
    forwardRef(() => LogisticsModule),
    forwardRef(() => OfficesModule),
    WarehousesModule,
    HistoryModule,
    SlackModule,
    TenantsModule,
    UsersModule,
    MongooseModule.forFeature(
      [{ name: GlobalProduct.name, schema: GlobalProductSchema }],
      'firstPlug',
    ),
  ],
  controllers: [AssignmentsController],
  providers: [
    TenantModelRegistry,
    AssignmentsService,
    GlobalProductSyncService,
    tenantModels.productModel,
    tenantModels.memberModel,
    JwtService,
  ],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
