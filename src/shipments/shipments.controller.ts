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

  @Patch(':id/cancel')
  async cancelShipment(
    @Param('id') shipmentId: string,
    @Request() req: any,
  ): Promise<ShipmentDocument> {
    const tenantId = req.user.tenantName;
    return this.shipmentsService.cancelShipmentAndUpdateProducts(
      shipmentId,
      tenantId,
    );
  }
  @Patch(':id')
  async updateShipment(
    @Param('id') shipmentId: string,
    @Body() updateDto: UpdateShipmentDto,
    @Request() req: any,
  ): Promise<ShipmentDocument> {
    const tenantId = req.user.tenantName;
    return this.shipmentsService.findConsolidateAndUpdateShipment(
      shipmentId,
      updateDto,
      tenantId,
    );
  }
}
