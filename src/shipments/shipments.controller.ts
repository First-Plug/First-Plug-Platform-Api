import {
  Controller,
  Patch,
  Param,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import { ShipmentsService } from './shipments.service';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { ShipmentDocument } from 'src/shipments/schema/shipment.schema';
import { Request } from 'express';

@Controller('shipments')
@UseGuards(JwtGuard)
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Patch(':id/cancel')
  async cancelShipment(
    @Param('id') shipmentId: string,
    @Query('tenant') tenantId: string,
    @Req() req: Request,
  ): Promise<ShipmentDocument> {
    return this.shipmentsService.cancelShipmentAndUpdateProducts(
      shipmentId,
      tenantId,
      req.user.userId,
    );
  }
}
