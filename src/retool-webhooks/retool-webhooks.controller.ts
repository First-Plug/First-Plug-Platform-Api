import { Controller, Post, Body } from '@nestjs/common';
import { RetoolWebhooksService } from 'src/retool-webhooks/retool-webhoks.service';
import { ShipmentStatus } from 'src/shipments/interface/shipment.interface';

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
