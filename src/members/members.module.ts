import { MiddlewareConsumer, Module, forwardRef } from '@nestjs/common';
import { MembersService } from './members.service';
import { MembersController } from './members.controller';
import { TenantsModule } from '../tenants/tenants.module';
import { TenantsMiddleware } from '../common/middlewares/tenants.middleware';
import { tenantModels } from '../common/providers/tenant-models-provider';
import { JwtService } from '@nestjs/jwt';
import { TeamsModule } from 'src/teams/teams.module';
import { ProductsModule } from 'src/products/products.module';
import { TeamsService } from 'src/teams/teams.service';
import { ProductsService } from 'src/products/products.service';

@Module({
  imports: [
    TenantsModule,
    forwardRef(() => TeamsModule),
    forwardRef(() => ProductsModule),
  ],
  controllers: [MembersController],
  providers: [
    MembersService,
    ProductsService,
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
