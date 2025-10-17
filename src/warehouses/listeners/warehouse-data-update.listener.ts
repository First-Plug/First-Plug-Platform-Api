import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventTypes } from 'src/infra/event-bus/types';
import { WarehouseDataUpdatedEvent } from 'src/infra/event-bus/warehouse-data-update.event';
import { WarehouseProductSyncService } from '../services/warehouse-product-sync.service';

@Injectable()
export class WarehouseDataUpdateListener {
  private readonly logger = new Logger(WarehouseDataUpdateListener.name);
  private processedEvents = new Set<string>();

  constructor(
    private readonly warehouseProductSyncService: WarehouseProductSyncService,
  ) {}

  @OnEvent(EventTypes.WAREHOUSE_DATA_UPDATED)
  async handleWarehouseDataUpdated(event: WarehouseDataUpdatedEvent) {
    try {
      // Evitar procesamiento duplicado
      const eventKey = `${event.warehouseId}-${event.timestamp.getTime()}`;
      if (this.processedEvents.has(eventKey)) {
        this.logger.debug(`Event already processed: ${eventKey}`);
        return;
      }

      this.processedEvents.add(eventKey);

      // Limpiar eventos antiguos después de 30 segundos
      setTimeout(() => {
        this.processedEvents.delete(eventKey);
      }, 30000);

      this.logger.log(
        `🔄 [WAREHOUSE DATA UPDATE] Processing warehouse update for ${event.warehouseId}`,
        {
          warehouseId: event.warehouseId,
          countryCode: event.countryCode,
          updatedFields: event.updatedFields,
          timestamp: event.timestamp.toISOString(),
        },
      );

      // Sincronizar productos en todas las colecciones
      const result = await this.warehouseProductSyncService.syncWarehouseDataToProducts(
        event.warehouseId,
        event.countryCode,
        event.newData,
        event.updatedFields,
      );

      this.logger.log(
        `✅ [WAREHOUSE DATA UPDATE] Sync completed for warehouse ${event.warehouseId}`,
        {
          globalProductsUpdated: result.globalProductsUpdated,
          tenantProductsUpdated: result.tenantProductsUpdated,
          affectedTenants: result.affectedTenants,
          totalProductsUpdated: result.totalProductsUpdated,
        },
      );
    } catch (error) {
      this.logger.error(
        `❌ [WAREHOUSE DATA UPDATE] Failed to sync warehouse data for ${event.warehouseId}`,
        {
          error: error.message,
          stack: error.stack,
          warehouseId: event.warehouseId,
          countryCode: event.countryCode,
        },
      );
    }
  }
}
