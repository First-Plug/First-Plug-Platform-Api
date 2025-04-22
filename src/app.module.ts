import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { TenantsModule } from './tenants/tenants.module';
import { EnvConfiguration, ZodEnvironmentsSchema } from './config';
import { AuthModule } from './auth/auth.module';
import { SlackModule } from 'nestjs-slack-webhook';
import { CommonModule } from 'src/common/common.module';
import { TenantsMiddleware } from 'src/common/middlewares/tenants.middleware';
import { FeatureModule } from './feature/feature.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

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

    AuthModule,
    TenantsModule,
    FeatureModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantsMiddleware)
      .forRoutes(
        { path: '/dashboard', method: RequestMethod.ALL },
        { path: '/settings', method: RequestMethod.ALL },
        { path: '/home/(.*)', method: RequestMethod.ALL },
      );
  }
}
