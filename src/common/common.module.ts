import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { GlobalConnectionProvider } from './providers/global-connection.provider';
import { TenantConnectionService } from './providers/tenant-connection.service';
import { tenantConnectionProvider } from './providers/tenant-connection.provider';
import { ParseMongoIdPipe } from './pipes/parse-mongo-id.pipe';

@Global()
@Module({
  imports: [
    ConfigModule,
    JwtModule.register({
      secret: process.env.JWTSECRETKEY,
      signOptions: { expiresIn: '1d' },
    }),
  ],
  providers: [
    GlobalConnectionProvider,
    TenantConnectionService,
    tenantConnectionProvider,
    ParseMongoIdPipe,
  ],
  exports: [
    GlobalConnectionProvider,
    TenantConnectionService,
    tenantConnectionProvider,
    JwtModule,
    ParseMongoIdPipe,
  ],
})
export class CommonModule {}
