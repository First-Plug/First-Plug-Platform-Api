import { Controller, Post, Body, Patch } from '@nestjs/common';
import { RetoolWebhooksService } from 'src/retool-webhooks/retool-webhoks.service';
import {
  ShipmentStatus,
  ShipmentType,
} from 'src/shipments/interface/shipment.interface';

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

  @Patch('update-shipment-details')
  async updateShipmentDetailsFromRetool(
    @Body()
    body: {
      tenantName: string;
      shipmentId: string;
      newStatus?: ShipmentStatus;
      shipment_type?: ShipmentType;
      trackingURL?: string;
    },
  ) {
    console.log('📩 Llamada PATCH recibida con body:', body);
    return this.retoolService.updateShipmentFromRetool(body);
  }

  @Patch('update-shipment-price')
  async updateShipmentPriceFromRetool(
    @Body()
    body: {
      tenantName: string;
      shipmentId: string;
      price: { amount: number; currencyCode: string };
    },
  ) {
    console.log('📩 Llamada PATCH recibida con body:', body);
    return this.retoolService.updateShipmentPriceWebhook(body);
  }
}
