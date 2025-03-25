import { MiddlewareConsumer, Module, forwardRef } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { tenantModels } from '../common/providers/tenant-models-provider';
import { TenantsMiddleware } from '../common/middlewares/tenants.middleware';
import { TenantsModule } from '../tenants/tenants.module';
import { JwtService } from '@nestjs/jwt';
import { MembersModule } from 'src/members/members.module';
import { HistoryModule } from 'src/history/history.module';
import { ShipmentsModule } from '../shipments/shipments.module';

@Module({
  imports: [
    TenantsModule,
    MembersModule,
    forwardRef(() => MembersModule),
    forwardRef(() => ShipmentsModule),
    HistoryModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService, tenantModels.productModel, JwtService],
  exports: [ProductsService, tenantModels.productModel],
})
export class ProductsModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantsMiddleware).forRoutes(ProductsController);
  }
}
