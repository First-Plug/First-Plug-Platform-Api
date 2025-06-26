import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventTypes } from 'src/infra/event-bus/types';
import { MemberAddressUpdatedEvent } from 'src/infra/event-bus/member-address-update.event';
import { LogisticsService } from 'src/logistics/logistics.sevice';

@Injectable()
export class MemberAddressUpdatedListener {
  private readonly logger = new Logger(MemberAddressUpdatedListener.name);

  constructor(private readonly logisticsService: LogisticsService) {}

  @OnEvent(EventTypes.MEMBER_ADDRESS_UPDATED)
  async handleMemberAddressUpdated(event: MemberAddressUpdatedEvent) {
    try {
      this.logger.debug(
        `Processing address update for member: ${event.memberEmail}`,
      );
      const userId = event.userId || 'system';
      const ourOfficeEmail = event.ourOfficeEmail;
      await this.logisticsService.checkAndUpdateShipmentsForMember(
        event.memberEmail,
        event.tenantName,
        userId,
        ourOfficeEmail,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process member update for ${event.memberEmail}`,
        error.stack,
      );
    }
  }
}
