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

import { EventEmitterModule } from '@nestjs/event-emitter';
import { TenantDbModule } from 'src/infra/db/tenant-db.module';
import { AssignmentsModule } from 'src/assignments/assignments.module';
import { LogisticsModule } from 'src/logistics/logistics.module';
import { UsersModule } from 'src/users/users.module';
import { OfficesModule } from 'src/offices/offices.module';
import { SuperAdminModule } from 'src/superadmin/superadmin.module';
import { WarehousesModule } from 'src/warehouses/warehouses.module';
import { QuotesModule } from 'src/quotes/quotes.module';
import { EmailModule } from 'src/email/email.module';

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
    // Conexión con nombre 'firstPlug' que apunta a la misma DB
    MongooseModule.forRootAsync({
      connectionName: 'firstPlug',
      imports: [ConfigModule],
      useFactory: async (config) => ({
        uri: config.get('database.connectionString'), // Misma URI, no cambiar
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
    AssignmentsModule,
    LogisticsModule,
    UsersModule,
    OfficesModule,
    WarehousesModule,
    SuperAdminModule,
    QuotesModule,
    EmailModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
