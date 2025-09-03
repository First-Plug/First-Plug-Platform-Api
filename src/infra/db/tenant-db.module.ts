import { Module, forwardRef } from '@nestjs/common';
import { tenantConnectionProvider } from './tenant-connection.provider';
import { TenantModelRegistry } from './tenant-model-registry';
import { TenantsModule } from 'src/tenants/tenants.module';
import { TenantConnectionService } from './tenant-connection.service';

@Module({
  imports: [forwardRef(() => TenantsModule)],
  providers: [
    TenantConnectionService,
    tenantConnectionProvider,
    TenantModelRegistry,
  ],
  exports: [
    TenantModelRegistry,
    tenantConnectionProvider,
    TenantConnectionService,
  ],
})
export class TenantDbModule {}
