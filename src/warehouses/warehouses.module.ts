import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WarehousesService } from './warehouses.service';
import { Warehouse, WarehouseSchema } from './schemas/warehouse.schema';
import { WarehouseAssignmentService } from './services/warehouse-assignment.service';
import { GlobalIndexService } from './services/global-index.service';
import { WarehouseMetricsService } from './services/warehouse-metrics.service';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Warehouse.name, schema: WarehouseSchema }],
      'firstPlug',
    ),
  ],
  providers: [
    WarehousesService,
    WarehouseAssignmentService,
    GlobalIndexService,
    WarehouseMetricsService,
  ],
  exports: [
    WarehousesService,
    WarehouseAssignmentService,
    GlobalIndexService,
    WarehouseMetricsService,
  ],
})
export class WarehousesModule {}
