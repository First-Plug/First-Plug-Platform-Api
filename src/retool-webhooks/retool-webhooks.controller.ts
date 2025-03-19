import { Controller, Post, Body } from '@nestjs/common';
import { RetoolWebhooksService } from './retool-webhooks.service';
import { ShipmentStatus } from 'src/shipments/interfaces/shipment.interface';

@Controller('retool-webhooks')
export class RetoolWebhooksController {
  constructor(private readonly retoolService: RetoolWebhooksService) {}

  @Post('update-shipment-status')
  async updateShipmentStatusFromRetool(
    @Body()
    body: {
      tenantName: string;
      shipmentId: string;
      newStatus: ShipmentStatus;
    },
  ) {
    return this.retoolService.updateShipmentStatusWebhook(body);
  }
}
