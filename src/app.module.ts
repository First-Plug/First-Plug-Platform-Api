import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { TenantsModule } from './tenants/tenants.module';
import { EnvConfiguration, ZodEnvironmentsSchema } from './config';
import { ProductsModule } from './products/products.module';
import { MembersModule } from './members/members.module';
import { OrdersModule } from './orders/orders.module';
import { ShipmentsModule } from './shipments/shipments.module';
import { AuthModule } from './auth/auth.module';
import { TeamsModule } from './teams/teams.module';
import { SlackModule } from 'nestjs-slack-webhook';
import { HistoryModule } from './history/history.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [EnvConfiguration],
      validate: (env) => ZodEnvironmentsSchema.parse(env),
    }),
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
    TenantsModule,
    ProductsModule,
    forwardRef(() => MembersModule),
    OrdersModule,
    ShipmentsModule,
    AuthModule,
    forwardRef(() => TeamsModule),
    HistoryModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
