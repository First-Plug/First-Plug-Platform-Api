import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventTypes } from '../../infra/event-bus/types';
import { TenantAddressUpdatedEvent } from '../../infra/event-bus/tenant-address-update.event';
import { ShipmentsService } from '../shipments.service';

@Injectable()
export class TenantAddressUpdatedListener {
  private readonly logger = new Logger(TenantAddressUpdatedListener.name);

  constructor(private readonly shipmentsService: ShipmentsService) {}

  @OnEvent(EventTypes.TENANT_ADDRESS_UPDATED)
  async handleTenantAddressUpdated(event: TenantAddressUpdatedEvent) {
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
      await this.shipmentsService.checkAndUpdateShipmentsForOurOffice(
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
