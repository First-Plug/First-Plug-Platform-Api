import {
  Controller,
  // Get,
  // Post,
  // Body,
  // Patch,
  // Param,
  // Delete,
  // Res,
  // HttpStatus,
  // ParseArrayPipe,
  UseGuards,
} from '@nestjs/common';
import { ShipmentsService } from './shipments.service';
// import { CreateShipmentDto } from './dto/create-shipment.dto';
// import { UpdateShipmentDto } from './dto/update-shipment.dto';
// import { Response } from 'express';
// import { ParseMongoIdPipe } from 'src/common/pipes/parse-mongo-id.pipe';
// import { ObjectId } from 'mongoose';
import { JwtGuard } from 'src/auth/guard/jwt.guard';

@Controller('shipments')
@UseGuards(JwtGuard)
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  // @Post()
  // async create(
  //   @Body() createShipmentDto: CreateShipmentDto,
  //   @Res() res: Response,
  // ) {
  //   const createdCount = await this.shipmentsService.create(createShipmentDto);

  //   res.status(HttpStatus.CREATED).json({
  //     message: `Bulk create successful: ${createdCount} documents inserted successfully.`,
  //   });
  // }

  // @Post('/bulkcreate')
  // async bulkcreate(
  //   @Body(new ParseArrayPipe({ items: CreateShipmentDto }))
  //   createShipmentDto: CreateShipmentDto[],
  //   @Res() res: Response,
  // ) {
  //   const createdCount =
  //     await this.shipmentsService.bulkCreate(createShipmentDto);

  //   res.status(HttpStatus.CREATED).json({
  //     message: `Bulk create successful: ${createdCount} documents inserted successfully out of ${createShipmentDto.length}.`,
  //   });
  // }

  // @Get()
  // findAll() {
  //   return this.shipmentsService.findAll();
  // }

  // @Get(':id')
  // findById(@Param('id', ParseMongoIdPipe) id: ObjectId) {
  //   return this.shipmentsService.findById(id);
  // }

  // @Patch(':id')
  // update(
  //   @Param('id', ParseMongoIdPipe) id: ObjectId,
  //   @Body() updateShipmentDto: UpdateShipmentDto,
  // ) {
  //   return this.shipmentsService.update(id, updateShipmentDto);
  // }

  // @Delete(':id')
  // remove(@Param('id', ParseMongoIdPipe) id: ObjectId) {
  //   return this.shipmentsService.remove(id);
  // }
}
