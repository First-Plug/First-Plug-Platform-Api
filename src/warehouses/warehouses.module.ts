import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WarehousesService } from './warehouses.service';
import { Warehouse, WarehouseSchema } from './schemas/warehouse.schema';
import {
  WarehouseMetrics,
  WarehouseMetricsSchema,
} from './schemas/warehouse-metrics.schema';
import { WarehouseAssignmentService } from './services/warehouse-assignment.service';
import { WarehouseMetricsService } from './services/warehouse-metrics.service';

@Module({
  imports: [
    MongooseModule.forFeature(
      [
        { name: Warehouse.name, schema: WarehouseSchema },
        { name: WarehouseMetrics.name, schema: WarehouseMetricsSchema },
      ],
      'firstPlug',
    ),
  ],
  providers: [
    WarehousesService,
    WarehouseAssignmentService,
    WarehouseMetricsService,
  ],
  exports: [
    WarehousesService,
    WarehouseAssignmentService,
    WarehouseMetricsService,
  ],
})
export class WarehousesModule {}
