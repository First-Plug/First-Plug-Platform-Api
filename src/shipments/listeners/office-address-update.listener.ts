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
      this.logger.debug(
        `Processing address update for tenant: ${event.tenantName}`,
        {
          oldAddress: event.oldAddress,
          newAddress: event.newAddress,
        },
      );

      if (!event.newAddress || !event.oldAddress) {
        this.logger.error('Missing address data in event');
        return;
      }
      const userId = event.userId;
      const ourOfficeEmail = event.ourOfficeEmail;
      await this.logisticsService.checkAndUpdateShipmentsForOurOffice(
        event.tenantName,
        event.oldAddress,
        event.newAddress,
        userId,
        ourOfficeEmail,
      );

      this.logger.debug(
        `Successfully processed address update for tenant: ${event.tenantName}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process address update for tenant: ${event.tenantName}`,
        error.stack,
      );
      throw error;
    }
  }
}
