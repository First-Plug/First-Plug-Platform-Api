import { Controller, Get, Query } from '@nestjs/common';
import { ShipmentsService } from './shipments.service';

@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Get('test-connection')
  testConnection(@Query('tenant') tenant: string) {
    console.log('🚀 Endpoint /test-connection alcanzado con tenant:', tenant);
    return this.shipmentsService.testTenantConnection(tenant);
  }
}
