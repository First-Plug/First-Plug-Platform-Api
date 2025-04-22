import { Module } from '@nestjs/common';
import { ProductsModule } from 'src/products/products.module';
import { MembersModule } from 'src/members/members.module';
import { ShipmentsModule } from 'src/shipments/shipments.module';
import { OrdersModule } from 'src/orders/orders.module';
import { TeamsModule } from 'src/teams/teams.module';
import { HistoryModule } from 'src/history/history.module';
import { RetoolWebhooksModule } from 'src/retool-webhooks/retool-webhooks.module';
import { SERVICES } from 'src/common/constants/services-tokens';
import { MembersService } from 'src/members/members.service';
import { ProductsService } from 'src/products/products.service';
import { TeamsService } from 'src/teams/teams.service';
import { ShipmentsService } from 'src/shipments/shipments.service';
import { HistoryService } from 'src/history/history.service';
import { TenantsService } from 'src/tenants/tenants.service';

@Module({
  imports: [
    ProductsModule,
    MembersModule,
    ShipmentsModule,
    OrdersModule,
    TeamsModule,
    HistoryModule,
    RetoolWebhooksModule,
  ],
  providers: [
    { provide: SERVICES.HISTORY, useClass: HistoryService },
    { provide: SERVICES.MEMBERS, useClass: MembersService },
    { provide: SERVICES.PRODUCTS, useClass: ProductsService },
    { provide: SERVICES.SHIPMENTS, useClass: ShipmentsService },
    { provide: SERVICES.TEAMS, useClass: TeamsService },
    { provide: SERVICES.TENANTS, useClass: TenantsService },
  ],
  exports: [
    ProductsModule,
    MembersModule,
    ShipmentsModule,
    OrdersModule,
    TeamsModule,
    HistoryModule,
    RetoolWebhooksModule,
  ],
})
export class FeatureModule {}
