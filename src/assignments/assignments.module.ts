import { Module, forwardRef } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { MembersModule } from 'src/members/members.module';
import { ProductsModule } from 'src/products/products.module';
import { HistoryModule } from 'src/history/history.module';
import { ShipmentsModule } from 'src/shipments/shipments.module';
import { SlackModule } from 'src/slack/slack.module';
import { tenantModels } from 'src/infra/db/tenant-models-provider';
import { TenantsModule } from 'src/tenants/tenants.module';
import { AssignmentsController } from './assignments.controller';
import { JwtService } from '@nestjs/jwt';
import { TenantModelRegistry } from 'src/infra/db/tenant-model-registry';

@Module({
  imports: [
    forwardRef(() => MembersModule),
    forwardRef(() => ProductsModule),
    forwardRef(() => ShipmentsModule),
    HistoryModule,
    SlackModule,
    TenantsModule,
  ],
  controllers: [AssignmentsController],
  providers: [
    TenantModelRegistry,
    AssignmentsService,
    tenantModels.productModel,
    tenantModels.memberModel,
    JwtService,
  ],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
