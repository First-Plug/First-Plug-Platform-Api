import { MiddlewareConsumer, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { OfficesController } from './offices.controller';
import { OfficesService } from './offices.service';
import { TenantDbModule } from '../infra/db/tenant-db.module';
import { TenantsModule } from '../tenants/tenants.module';
import { TenantsMiddleware } from '../common/middlewares/tenants.middleware';
import { tenantModels } from '../infra/db/tenant-models-provider';
import { HistoryModule } from '../history/history.module';

@Module({
  imports: [
    EventEmitterModule,
    TenantDbModule,
    TenantsModule,
    HistoryModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret',
      signOptions: { expiresIn: '48h' },
    }),
  ],
  controllers: [OfficesController],
  providers: [OfficesService, tenantModels.officeModel, JwtService],
  exports: [OfficesService],
})
export class OfficesModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantsMiddleware).forRoutes(OfficesController);
  }
}
