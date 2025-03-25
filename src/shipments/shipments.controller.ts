import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ShipmentsService } from './shipments.service';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { ShipmentDocument } from 'src/shipments/schema/shipment.schema';

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

  @Post()
  async createShipment(@Req() req, @Body() shipmentData: any) {
    const tenantName = req.user.tenantName;

    const {
      productId,
      actionType,
      newDestinationLocation,
      newAssignedEmail,

      quantity_products,
      shipment_type,
      trackingURL,
    } = shipmentData;

    const shipmentPayload = {
      productId,
      quantity_products,
      shipment_type,
      trackingURL,
    };

    return this.shipmentsService.createShipment(
      tenantName,
      shipmentPayload,
      actionType,
      newDestinationLocation,
      newAssignedEmail,
    );
  }

  @Get(':id')
  async getShipment(@Req() req, @Param('id') shipmentId: string) {
    const tenantName = req.user.tenantName;
    return this.shipmentsService.getShipmentById(tenantName, shipmentId);
  }

  @Patch(':id/status')
  async updateShipmentStatus(
    @Req() req,
    @Param('id') shipmentId: string,
    @Body('shipment_status') newStatus: string,
  ) {
    const tenantName = req.user.tenantName;
    return this.shipmentsService.updateShipmentStatus(
      tenantName,
      shipmentId,
      newStatus,
    );
  }
}
