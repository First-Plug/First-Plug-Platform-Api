import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventTypes } from 'src/common/events/types';
import { MemberAddressUpdatedEvent } from 'src/common/events/member-address-update.event';
import { ShipmentsService } from '../shipments.service';

@Injectable()
export class MemberAddressUpdatedListener {
  private readonly logger = new Logger(MemberAddressUpdatedListener.name);

  constructor(private readonly shipmentsService: ShipmentsService) {}

  @OnEvent(EventTypes.MEMBER_ADDRESS_UPDATED)
  async handleMemberAddressUpdated(event: MemberAddressUpdatedEvent) {
    try {
      this.logger.debug(
        `Processing address update for member: ${event.memberEmail}`,
      );
      const userId = event.userId || 'system';
      await this.shipmentsService.checkAndUpdateShipmentsForMember(
        event.memberEmail,
        event.tenantName,
        userId,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process member update for ${event.memberEmail}`,
        error.stack,
      );
    }
  }
}
