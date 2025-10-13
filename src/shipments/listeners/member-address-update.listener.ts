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
      console.log(
        '🎯 [EVENT LISTENER] Received MEMBER_ADDRESS_UPDATED event:',
        {
          memberEmail: event.memberEmail,
          tenantName: event.tenantName,
          userId: event.userId,
          timestamp: new Date().toISOString(),
        },
      );

      const userId = event.userId || 'system';
      const ourOfficeEmail = event.ourOfficeEmail;

      console.log(
        '🔄 [EVENT LISTENER] Calling checkAndUpdateShipmentsForMember...',
      );
      await this.logisticsService.checkAndUpdateShipmentsForMember(
        event.memberEmail,
        event.tenantName,
        userId,
        ourOfficeEmail,
      );
      console.log('✅ [EVENT LISTENER] Successfully processed member update');
    } catch (error) {
      console.error(
        '❌ [EVENT LISTENER] Failed to process member update:',
        error,
      );
      this.logger.error(
        `Failed to process member update for ${event.memberEmail}`,
        error.stack,
      );
    }
  }
}
