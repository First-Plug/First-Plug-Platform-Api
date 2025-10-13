import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventTypes } from 'src/infra/event-bus/types';
import { ProductUpdatedEvent } from 'src/infra/event-bus/product-updated.event';
import { LogisticsService } from 'src/logistics/logistics.sevice';

@Injectable()
export class ProductUpdatedListener {
  private readonly logger = new Logger(ProductUpdatedListener.name);
  private processedEvents = new Set<string>();

  constructor(private readonly logisticsService: LogisticsService) {}

  @OnEvent(EventTypes.PRODUCT_ADDRESS_UPDATED)
  async handleProductUpdated(event: ProductUpdatedEvent) {
    try {
      const recentEventKey = `${event.productId}-${Math.floor(Date.now() / 2000)}`;
      if (this.processedEvents.has(recentEventKey)) {
        return;
      }

      this.processedEvents.add(recentEventKey);

      setTimeout(() => {
        this.processedEvents.delete(recentEventKey);
      }, 10000);

      await this.logisticsService.updateSnapshotsForProduct(
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
