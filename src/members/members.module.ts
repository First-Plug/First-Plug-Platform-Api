import { forwardRef, MiddlewareConsumer, Module } from '@nestjs/common';
import { MembersController } from './members.controller';
import { TenantsMiddleware } from '../common/middlewares/tenants.middleware';
import { tenantModels } from '../common/providers/tenant-models-provider';
import { FeatureModule } from 'src/feature/feature.module';

@Module({
  imports: [forwardRef(() => FeatureModule)],
  controllers: [MembersController],
  providers: [tenantModels.memberModel],
  exports: [tenantModels.memberModel],
})
export class MembersModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantsMiddleware).forRoutes(MembersController);
  }
}
