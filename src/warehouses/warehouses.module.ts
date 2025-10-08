import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WarehousesService } from './warehouses.service';
import { Warehouse, WarehouseSchema } from './schemas/warehouse.schema';
import { WarehouseAssignmentService } from './services/warehouse-assignment.service';
import { SlackModule } from '../slack/slack.module';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Warehouse.name, schema: WarehouseSchema }],
      'firstPlug',
    ),
    SlackModule,
  ],
  providers: [WarehousesService, WarehouseAssignmentService],
  exports: [WarehousesService, WarehouseAssignmentService],
})
export class WarehousesModule {}
