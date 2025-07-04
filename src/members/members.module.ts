import { MiddlewareConsumer, Module, forwardRef } from '@nestjs/common';
import { MembersService } from './members.service';
import { MembersController } from './members.controller';
import { TenantsModule } from '../tenants/tenants.module';
import { TenantsMiddleware } from '../common/middlewares/tenants.middleware';
import { tenantModels } from '../infra/db/tenant-models-provider';
import { JwtService } from '@nestjs/jwt';
import { TeamsModule } from 'src/teams/teams.module';
import { TeamsService } from 'src/teams/teams.service';
import { HistoryModule } from 'src/history/history.module';
import { ShipmentsModule } from 'src/shipments/shipments.module';
import { SlackModule } from 'src/slack/slack.module';
import { AssignmentsModule } from 'src/assignments/assignments.module';
import { LogisticsModule } from 'src/logistics/logistics.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    EventEmitterModule,
    TenantsModule,
    forwardRef(() => AssignmentsModule),
    forwardRef(() => TeamsModule),
    forwardRef(() => ShipmentsModule),
    forwardRef(() => LogisticsModule),
    HistoryModule,
    SlackModule,
  ],
  controllers: [MembersController],
  providers: [
    MembersService,
    tenantModels.memberModel,
    JwtService,
    TeamsService,
  ],
  exports: [MembersService, tenantModels.memberModel],
})
export class MembersModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantsMiddleware).forRoutes(MembersController);
  }
}
