import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventTypes } from 'src/common/events/types';
import { ProductUpdatedEvent } from 'src/common/events/product-updated.event';
import { ShipmentsService } from '../shipments.service';

@Injectable()
export class ProductUpdatedListener {
  private readonly logger = new Logger(ProductUpdatedListener.name);
  private processedEvents = new Set<string>();

  constructor(private readonly shipmentsService: ShipmentsService) {}

  @OnEvent(EventTypes.PRODUCT_ADDRESS_UPDATED)
  async handleProductUpdated(event: ProductUpdatedEvent) {
    try {
      const recentEventKey = `${event.productId}-${Math.floor(Date.now() / 2000)}`;
      if (this.processedEvents.has(recentEventKey)) {
        this.logger.debug(
          `Skipping duplicate event for product: ${event.productId}`,
        );
        return;
      }

      this.processedEvents.add(recentEventKey);

      setTimeout(() => {
        this.processedEvents.delete(recentEventKey);
      }, 10000);

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
