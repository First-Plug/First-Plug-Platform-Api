import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TenantsModule } from 'src/tenants/tenants.module';
import { UsersModule } from 'src/users/users.module';
import { UserEnrichmentService } from './user-enrichment.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [TenantsModule, UsersModule, ConfigModule],
  controllers: [AuthController],
  providers: [AuthService, UserEnrichmentService, JwtService],
  exports: [UserEnrichmentService],
})
export class AuthModule {}
