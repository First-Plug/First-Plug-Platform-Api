import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TenantsModule } from 'src/tenants/tenants.module';
import { UsersModule } from 'src/users/users.module';
import { UserEnrichmentService } from './user-enrichment.service';
import { TenantUserAdapterService } from '../common/services/tenant-user-adapter.service';
import { OfficesModule } from '../offices/offices.module';
import { JwtService } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [TenantsModule, UsersModule, OfficesModule, ConfigModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    UserEnrichmentService,
    TenantUserAdapterService,
    JwtService,
  ],
  exports: [UserEnrichmentService],
})
export class AuthModule {}
