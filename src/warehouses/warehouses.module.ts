import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WarehousesService } from './warehouses.service';
import { Warehouse, WarehouseSchema } from './schemas/warehouse.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Warehouse.name, schema: WarehouseSchema }
    ])
  ],
  providers: [WarehousesService],
  exports: [WarehousesService],
})
export class WarehousesModule {}
