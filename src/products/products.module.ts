import { forwardRef, MiddlewareConsumer, Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { tenantModels } from '../common/providers/tenant-models-provider';
import { TenantsMiddleware } from '../common/middlewares/tenants.middleware';
import { FeatureModule } from 'src/feature/feature.module';

@Module({
  imports: [forwardRef(() => FeatureModule)],
  controllers: [ProductsController],
  providers: [ProductsService, tenantModels.productModel],
  exports: [ProductsService, tenantModels.productModel],
})
export class ProductsModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantsMiddleware).forRoutes(ProductsController);
  }
}
