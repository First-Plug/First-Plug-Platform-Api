import { MiddlewareConsumer, Module, forwardRef } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { TeamsController } from './teams.controller';
import { tenantModels } from '../infra/db/tenant-models-provider';
import { TenantsModule } from 'src/tenants/tenants.module';
import { TenantsMiddleware } from 'src/common/middlewares/tenants.middleware';
import { JwtService } from '@nestjs/jwt';
import { MembersModule } from 'src/members/members.module';
import { HistoryModule } from 'src/history/history.module';

@Module({
  imports: [TenantsModule, forwardRef(() => MembersModule), HistoryModule],
  controllers: [TeamsController],
  providers: [TeamsService, tenantModels.teamModel, JwtService],
  exports: [tenantModels.teamModel],
})
export class TeamsModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantsMiddleware).forRoutes(TeamsController);
  }
}
