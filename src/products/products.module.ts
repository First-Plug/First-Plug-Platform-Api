import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { tenantModels } from '../common/providers/tenant-models-provider';
import { TenantsMiddleware } from '../common/middlewares/tenants.middleware';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, tenantModels.productModel],
  exports: [ProductsService, tenantModels.productModel],
})
export class ProductsModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantsMiddleware).forRoutes(ProductsController);
  }
}
