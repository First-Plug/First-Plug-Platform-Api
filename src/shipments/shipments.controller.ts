import {
  Controller,
  Patch,
  Param,
  UseGuards,
  Query,
  Get,
  Req,
} from '@nestjs/common';
import { ShipmentsService } from './shipments.service';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { ShipmentDocument } from 'src/shipments/schema/shipment.schema';
import { ParseMongoIdPipe } from 'src/common/pipes/parse-mongo-id.pipe';
import { Types } from 'mongoose';
import { Request } from 'express';

@Controller('shipments')
@UseGuards(JwtGuard)
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Patch(':id/cancel')
  async cancelShipment(
    @Param('id') shipmentId: string,
    @Query('tenant') tenantId: string,
  ): Promise<ShipmentDocument> {
    return this.shipmentsService.cancelShipmentAndUpdateProducts(
      shipmentId,
      tenantId,
    );
  }

  @Get()
  async getShipments(@Req() req: Request) {
    const tenantName = req.user.tenantName;
    return this.shipmentsService.getShipments(tenantName);
  }

  @Get(':id')
  async getShipmentById(
    @Param('id', ParseMongoIdPipe) id: Types.ObjectId,
    @Req() req: Request,
  ) {
    const tenantName = req.user.tenantName;
    return this.shipmentsService.getShipmentById(id, tenantName);
  }

  @Patch(':id/soft-delete')
  async softDeleteShipment(
    @Param('id', ParseMongoIdPipe) id: Types.ObjectId,
    @Req() req: Request,
  ) {
    const tenantName = req.user.tenantName;
    return this.shipmentsService.softDeleteShipment(id, tenantName);
  }
}
