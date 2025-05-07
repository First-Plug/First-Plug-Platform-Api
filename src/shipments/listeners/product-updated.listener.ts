import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventTypes } from 'src/common/events/types';
import { ProductUpdatedEvent } from 'src/common/events/product-updated.event';
import { ShipmentsService } from '../shipments.service';

@Injectable()
export class ProductUpdatedListener {
  private readonly logger = new Logger(ProductUpdatedListener.name);

  constructor(private readonly shipmentsService: ShipmentsService) {}

  @OnEvent(EventTypes.PRODUCT_ADDRESS_UPDATED)
  async handleProductUpdated(event: ProductUpdatedEvent) {
    try {
      this.logger.debug(
        `Processing product update for product: ${event.productId}`,
      );

      await this.shipmentsService.updateSnapshotsForProduct(
        event.productId,
        event.tenantName,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update snapshots for product ${event.productId}`,
        error.stack,
      );
    }
  }
}
