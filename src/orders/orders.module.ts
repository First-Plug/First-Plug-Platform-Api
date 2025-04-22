import { MiddlewareConsumer, Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { TenantsModule } from 'src/tenants/tenants.module';
import { tenantModels } from 'src/common/providers/tenant-models-provider';
import { TenantsMiddleware } from 'src/common/middlewares/tenants.middleware';
import { JwtModule } from '@nestjs/jwt';
// import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [TenantsModule, JwtModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    tenantModels.orderModel,
    tenantModels.memberModel,
    // JwtService,
  ],
})
export class OrdersModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantsMiddleware).forRoutes(OrdersController);
  }
}
