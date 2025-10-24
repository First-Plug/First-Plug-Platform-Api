import { Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { OfficesService } from '../../offices/offices.service';
import { ACTIVE_SHIPMENT_STATUSES } from '../interface/shipment.interface';

/**
 * Servicio Transversal para coordinar actualizaciones entre Shipments y Offices
 *
 * Responsabilidades:
 * - Actualizar flags de oficinas cuando cambian estados de shipments
 * - Mantener consistencia entre shipments "On The Way" y flags activeShipments
 * - Desacoplar ShipmentsService de OfficesService
 */
@Injectable()
export class ShipmentOfficeCoordinatorService {
  private readonly logger = new Logger(ShipmentOfficeCoordinatorService.name);

  constructor(private readonly officesService: OfficesService) {}

  /**
   * Actualiza flags de oficinas cuando un shipment cambia de estado
   */
  async handleShipmentStatusChange(
    originOfficeId: Types.ObjectId | null,
    destinationOfficeId: Types.ObjectId | null,
    oldStatus: string,
    newStatus: string,
    tenantName: string,
  ): Promise<void> {
    const statusesOfInterest = ACTIVE_SHIPMENT_STATUSES;
    const shouldUpdate =
      statusesOfInterest.includes(oldStatus as any) ||
      statusesOfInterest.includes(newStatus as any);

    if (!shouldUpdate) {
      this.logger.log(
        `📦 [handleShipmentStatusChange] Status change not relevant for office flags: ${oldStatus} → ${newStatus}`,
      );
      return;
    }

    try {
      await this.officesService.updateActiveShipmentsFlagsForShipment(
        originOfficeId,
        destinationOfficeId,
        tenantName,
      );

      this.logger.log(
        `✅ [handleShipmentStatusChange] Office flags updated for status change: ${oldStatus} → ${newStatus}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ [handleShipmentStatusChange] Error updating office flags:`,
        error,
      );
    }
  }

  /**
   * Actualiza flags de oficinas cuando se crea un shipment
   */
  async handleShipmentCreated(
    originOfficeId: Types.ObjectId | null,
    destinationOfficeId: Types.ObjectId | null,
    status: string,
    tenantName: string,
  ): Promise<void> {
    const activeStatuses = ACTIVE_SHIPMENT_STATUSES;

    if (activeStatuses.includes(status as any)) {
      try {
        await this.officesService.updateActiveShipmentsFlagsForShipment(
          originOfficeId,
          destinationOfficeId,
          tenantName,
        );

        this.logger.log(
          `✅ [handleShipmentCreated] Office flags updated for new shipment with status: ${status}`,
        );
      } catch (error) {
        this.logger.error(
          `❌ [handleShipmentCreated] Error updating office flags:`,
          error,
        );
      }
    }
  }

  /**
   * Actualiza flags de oficinas cuando se cancela un shipment
   */
  async handleShipmentCancelled(
    originOfficeId: Types.ObjectId | null,
    destinationOfficeId: Types.ObjectId | null,
    tenantName: string,
  ): Promise<void> {
    try {
      await this.officesService.updateActiveShipmentsFlagsForShipment(
        originOfficeId,
        destinationOfficeId,
        tenantName,
      );

      this.logger.log(
        `✅ [handleShipmentCancelled] Office flags updated after shipment cancellation`,
      );
    } catch (error) {
      this.logger.error(
        `❌ [handleShipmentCancelled] Error updating office flags:`,
        error,
      );
    }
  }
}
