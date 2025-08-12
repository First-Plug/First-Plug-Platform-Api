import {
  Controller,
  Patch,
  Param,
  UseGuards,
  Query,
  Get,
  Request,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { ShipmentsService } from './shipments.service';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { ShipmentDocument } from 'src/shipments/schema/shipment.schema';
import { UpdateShipmentDto } from 'src/shipments/validations/update-shipment-zod';
import { LogisticsService } from 'src/logistics/logistics.sevice';
import { OfficesService } from '../offices/offices.service';

@Controller('shipments')
@UseGuards(JwtGuard)
export class ShipmentsController {
  constructor(
    private readonly shipmentsService: ShipmentsService,
    private readonly logisticsService: LogisticsService,
    private readonly officesService: OfficesService,
  ) {}

  @Get()
  async getAllShipments(@Request() req: any) {
    const tenantId = req.user.tenantName;

    // El frontend hace paginación client-side, necesita todos los shipments
    return this.shipmentsService.getShipments(tenantId);
  }

  @Get('paginated')
  async paginatedShipmentsWithMetadata(
    @Query('page') page: string = '1',
    @Query('size') size: string = '10',
    @Request() req: any,
  ) {
    const tenantId = req.user.tenantName;
    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(size, 10) || 10;

    // Devuelve la estructura completa con metadata de paginación
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

    // Obtener email de oficina en lugar de email personal
    const ourOfficeEmail =
      await this.officesService.getDefaultOfficeEmail(tenantId);

    return this.logisticsService.cancelShipmentWithConsequences(
      shipmentId,
      tenantId,
      userId,
      ourOfficeEmail || req.user.email, // Fallback al email personal si no hay oficina
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

    // Obtener email de oficina en lugar de email personal
    const ourOfficeEmail =
      await this.officesService.getDefaultOfficeEmail(tenantId);

    return this.shipmentsService.findConsolidateAndUpdateShipment(
      shipmentId,
      updateDto,
      tenantId,
      userId,
      ourOfficeEmail || req.user.email, // Fallback al email personal si no hay oficina
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

    const shipments = await this.logisticsService.getShipmentsByMemberEmail(
      email,
      tenantId,
      isActiveOnly,
    );

    if (shipments.length === 0) {
      return { message: `No shipments found for member with email ${email}` };
    }

    return shipments;
  }

  @Get('find-page/:shipmentId')
  async findShipmentPage(
    @Param('shipmentId') shipmentId: string,
    @Query('size', ParseIntPipe) size: number,
    @Request() req: any,
  ) {
    const tenantId = req.user.tenantName;
    return this.shipmentsService.findShipmentPage(shipmentId, size, tenantId);
  }
}
