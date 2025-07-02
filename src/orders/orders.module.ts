import { MiddlewareConsumer, Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { TenantsModule } from 'src/tenants/tenants.module';
import { tenantModels } from 'src/infra/db/tenant-models-provider';
import { TenantsMiddleware } from 'src/common/middlewares/tenants.middleware';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [TenantsModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    tenantModels.orderModel,
    tenantModels.memberModel,
    JwtService,
  ],
})
export class OrdersModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantsMiddleware).forRoutes(OrdersController);
  }
}
