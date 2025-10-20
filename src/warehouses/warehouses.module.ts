import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WarehousesService } from './warehouses.service';
import { Warehouse, WarehouseSchema } from './schemas/warehouse.schema';
import { WarehouseAssignmentService } from './services/warehouse-assignment.service';
import { WarehouseProductSyncService } from './services/warehouse-product-sync.service';
import { WarehouseDataUpdateListener } from './listeners/warehouse-data-update.listener';
import { SlackModule } from '../slack/slack.module';
import { TenantDbModule } from '../infra/db/tenant-db.module';
import {
  GlobalProduct,
  GlobalProductSchema,
} from '../products/schemas/global-product.schema';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Warehouse.name, schema: WarehouseSchema }],
      'firstPlug',
    ),
    MongooseModule.forFeature(
      [{ name: GlobalProduct.name, schema: GlobalProductSchema }],
      'firstPlug',
    ),
    SlackModule,
    TenantDbModule,
  ],
  providers: [
    WarehousesService,
    WarehouseAssignmentService,
    WarehouseProductSyncService,
    WarehouseDataUpdateListener,
  ],
  exports: [
    WarehousesService,
    WarehouseAssignmentService,
    WarehouseProductSyncService,
  ],
})
export class WarehousesModule {}
