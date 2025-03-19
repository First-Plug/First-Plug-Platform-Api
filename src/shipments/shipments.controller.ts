import { Controller, Param, Patch, Query } from '@nestjs/common';
import { ShipmentsService } from './shipments.service';

@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Patch(':id/cancel')
  cancelShipment(@Param('id') id: string, @Query('tenant') tenantName: string) {
    return this.shipmentsService.cancelShipmentAndUpdateProductStatus(
      id,
      tenantName,
    );
  }
}

// import { Controller, UseGuards } from '@nestjs/common';
// import { ShipmentsService } from './shipments.service';
// import { JwtGuard } from 'src/auth/guard/jwt.guard';

// @Controller('shipments')
// @UseGuards(JwtGuard)
// export class ShipmentsController {
//   constructor(private readonly shipmentsService: ShipmentsService) {}

//   // @Patch(':id/cancel')
//   // cancelShipment(@Param('id') id: string, @Query('tenant') tenantName: string) {
//   //   return this.shipmentsService.cancelShipmentAndUpdateProductStatus(
//   //     id,
//   //     tenantName,
//   //   );
//   // }

//   // @Patch(':id/received')
//   // async markReceived(
//   //   @Param('id') id: string,
//   //   @Query('tenant') tenantName: string,
//   // ) {
//   //   return this.shipmentsService.markShipmentAsReceivedAndUpdateProductStatus(
//   //     id,
//   //     tenantName,
//   //   );
//   // }
//   // @Patch(':id/status')
//   // async updateStatus(
//   //   @Param('id') shipmentId: string,
//   //   @Body('status') newStatus: ShipmentStatus,
//   // ) {
//   //   return this.shipmentsService.updateShipmentStatus(shipmentId, newStatus);
//   // }
//   // @Post()
//   // async create(
//   //   @Body() createShipmentDto: CreateShipmentDto,
//   //   @Res() res: Response,
//   // ) {
//   //   const createdCount = await this.shipmentsService.create(createShipmentDto);

//   //   res.status(HttpStatus.CREATED).json({
//   //     message: `Bulk create successful: ${createdCount} documents inserted successfully.`,
//   //   });
//   // }

//   // @Post('/bulkcreate')
//   // async bulkcreate(
//   //   @Body(new ParseArrayPipe({ items: CreateShipmentDto }))
//   //   createShipmentDto: CreateShipmentDto[],
//   //   @Res() res: Response,
//   // ) {
//   //   const createdCount =
//   //     await this.shipmentsService.bulkCreate(createShipmentDto);

//   //   res.status(HttpStatus.CREATED).json({
//   //     message: `Bulk create successful: ${createdCount} documents inserted successfully out of ${createShipmentDto.length}.`,
//   //   });
//   // }

//   // @Get()
//   // findAll() {
//   //   return this.shipmentsService.findAll();
//   // }

//   // @Get(':id')
//   // findById(@Param('id', ParseMongoIdPipe) id: ObjectId) {
//   //   return this.shipmentsService.findById(id);
//   // }

//   // @Patch(':id')
//   // update(
//   //   @Param('id', ParseMongoIdPipe) id: ObjectId,
//   //   @Body() updateShipmentDto: UpdateShipmentDto,
//   // ) {
//   //   return this.shipmentsService.update(id, updateShipmentDto);
//   // }

//   // @Delete(':id')
//   // remove(@Param('id', ParseMongoIdPipe) id: ObjectId) {
//   //   return this.shipmentsService.remove(id);
//   // }
// }
