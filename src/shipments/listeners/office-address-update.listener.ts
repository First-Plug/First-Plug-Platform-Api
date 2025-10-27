import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventTypes } from '../../infra/event-bus/types';
import { OfficeAddressUpdatedEvent } from '../../infra/event-bus/office-address-update.event';
import { LogisticsService } from 'src/logistics/logistics.sevice';

@Injectable()
export class OfficeAddressUpdatedListener {
  private readonly logger = new Logger(OfficeAddressUpdatedListener.name);

  constructor(private readonly logisticsService: LogisticsService) {}

  @OnEvent(EventTypes.OFFICE_ADDRESS_UPDATED)
  async handleTenantAddressUpdated(event: OfficeAddressUpdatedEvent) {
    try {
      if (!event.newAddress || !event.oldAddress) {
        this.logger.error('Missing address data in event');
        return;
      }

      console.log(
        '📍 [EVENT LISTENER] Received OFFICE_ADDRESS_UPDATED event:',
        {
          tenantName: event.tenantName,
          officeId: event.officeId,
          officeName: event.officeName,
          isDefault: event.isDefault,
          timestamp: new Date().toISOString(),
        },
      );

      const userId = event.userId;
      const ourOfficeEmail = event.ourOfficeEmail;
      await this.logisticsService.checkAndUpdateShipmentsForOurOffice(
        event.tenantName,
        event.oldAddress,
        event.newAddress,
        userId,
        ourOfficeEmail,
        event.officeId,
        event.officeName,
      );
    } catch (error) {
      this.logger.error('Error handling office address update:', error);
      throw error;
    }
  }
}
