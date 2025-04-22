import { MiddlewareConsumer, Module } from '@nestjs/common';
import { MembersController } from './members.controller';
import { TenantsMiddleware } from '../common/middlewares/tenants.middleware';
import { tenantModels } from '../common/providers/tenant-models-provider';

@Module({
  controllers: [MembersController],
  providers: [tenantModels.memberModel],
  exports: [tenantModels.memberModel],
})
export class MembersModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantsMiddleware).forRoutes(MembersController);
  }
}
