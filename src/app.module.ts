import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { TenantsModule } from './tenants/tenants.module';
import { EnvConfiguration, ZodEnvironmentsSchema } from './config';
import { ProductsModule } from './products/products.module';
import { MembersModule } from './members/members.module';
import { OrdersModule } from './orders/orders.module';
import { AuthModule } from './auth/auth.module';
import { TeamsModule } from './teams/teams.module';
import { SlackModule } from 'nestjs-slack-webhook';
import { HistoryModule } from './history/history.module';
import { ShipmentsModule } from 'src/shipments/shipments.module';
import { CommonModule } from 'src/common/common.module';
import { RetoolWebhooksModule } from 'src/retool-webhooks/retool-webhooks.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TenantDbModule } from 'src/infra/db/tenant-db.module';
import { AssignmentsModule } from 'src/assignments/assignments.module';
import { LogisticsModule } from 'src/logistics/logistics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [EnvConfiguration],
      validate: (env) => ZodEnvironmentsSchema.parse(env),
    }),
    EventEmitterModule.forRoot(),
    CommonModule,
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config) => ({
        uri: config.get('database.connectionString'),
        maxPoolSize: 10,
        minPoolSize: 1,
      }),
      inject: [ConfigService],
    }),
    SlackModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config) => ({
        url: config.get('server.slackWebhookUrl'),
      }),
      inject: [ConfigService],
    }),
    TenantDbModule,
    TenantsModule,
    ProductsModule,
    forwardRef(() => MembersModule),
    OrdersModule,
    AuthModule,
    forwardRef(() => TeamsModule),
    HistoryModule,
    ShipmentsModule,
    RetoolWebhooksModule,
    AssignmentsModule,
    LogisticsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
