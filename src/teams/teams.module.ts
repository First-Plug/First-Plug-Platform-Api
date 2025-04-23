import { forwardRef, MiddlewareConsumer, Module } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { TeamsController } from './teams.controller';
import { tenantModels } from '../common/providers/tenant-models-provider';
import { TenantsMiddleware } from 'src/common/middlewares/tenants.middleware';
import { FeatureModule } from 'src/feature/feature.module';

@Module({
  imports: [forwardRef(() => FeatureModule)],
  controllers: [TeamsController],
  providers: [TeamsService, tenantModels.teamModel],
  exports: [TeamsService, tenantModels.teamModel],
})
export class TeamsModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantsMiddleware).forRoutes(TeamsController);
  }
}
