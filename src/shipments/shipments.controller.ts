import {
  Controller,
  Patch,
  Param,
  UseGuards,
  Query,
  Get,
  Request,
  Body,
} from '@nestjs/common';
import { ShipmentsService } from './shipments.service';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { ShipmentDocument } from 'src/shipments/schema/shipment.schema';
import { UpdateShipmentDto } from 'src/shipments/validations/update-shipment-zod';

@Controller('shipments')
@UseGuards(JwtGuard)
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Get()
  async paginatedShipments(
    @Query('page') page: string = '1',
    @Query('size') size: string = '10',
    @Request() req: any,
  ) {
    const tenantId = req.user.tenantName;
    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(size, 10) || 10;

    return this.shipmentsService.findAll(pageNumber, pageSize, tenantId);
  }

  @Get('by-product/:productId')
  async getShipmentByProductId(
    @Param('productId') productId: string,
    @Request() req: any,
  ): Promise<ShipmentDocument | { message: string }> {
    const tenantId = req.user.tenantName;

    const shipment = await this.shipmentsService.getShipmentByProductId(
      productId,
      tenantId,
    );

    if (!shipment) {
      return { message: `No active shipment found for product ${productId}` };
    }

    return shipment;
  }

  @Patch(':id/cancel')
  async cancelShipment(
    @Param('id') shipmentId: string,
    @Request() req: any,
  ): Promise<ShipmentDocument> {
    const tenantId = req.user.tenantName;
    const { userId } = req;
    return this.shipmentsService.cancelShipmentAndUpdateProducts(
      shipmentId,
      tenantId,
      userId,
    );
  }

  @Patch(':id')
  async updateShipment(
    @Param('id') shipmentId: string,
    @Body() updateDto: UpdateShipmentDto,
    @Request() req: any,
  ): Promise<{
    message: string;
    consolidatedInto?: string;
    shipment: ShipmentDocument;
  }> {
    const tenantId = req.user.tenantName;
    const { userId } = req;
    console.log('🔐 User ID in request:', userId);
    return this.shipmentsService.findConsolidateAndUpdateShipment(
      shipmentId,
      updateDto,
      tenantId,
      userId,
    );
  }

  @Get('by-member-email/:email')
  async getShipmentsByMemberEmail(
    @Param('email') email: string,
    @Query('activeOnly') activeOnly: string = 'true',
    @Request() req: any,
  ): Promise<ShipmentDocument[] | { message: string }> {
    const tenantId = req.user.tenantName;
    const isActiveOnly = activeOnly.toLowerCase() === 'true';

    const shipments = await this.shipmentsService.getShipmentsByMemberEmail(
      email,
      tenantId,
      isActiveOnly,
    );

    if (shipments.length === 0) {
      return { message: `No shipments found for member with email ${email}` };
    }

    return shipments;
  }
}
