import { Module, Global, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GlobalConnectionProvider } from '../infra/db/global-connection.provider';
import { TenantUserAdapterService } from './services/tenant-user-adapter.service';
import { UsersModule } from '../users/users.module';
import { TenantsModule } from '../tenants/tenants.module';
import { OfficesModule } from '../offices/offices.module';

@Global()
@Module({
  imports: [
    ConfigModule,
    forwardRef(() => UsersModule),
    forwardRef(() => TenantsModule),
    forwardRef(() => OfficesModule),
  ],
  providers: [GlobalConnectionProvider, TenantUserAdapterService],
  exports: [GlobalConnectionProvider, TenantUserAdapterService],
})
export class CommonModule {}
