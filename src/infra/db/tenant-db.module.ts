import { Module, forwardRef } from '@nestjs/common';
import { tenantConnectionProvider } from './tenant-connection.provider';
import { TenantModelRegistry } from './tenant-model-registry';
import { TenantsModule } from 'src/tenants/tenants.module';

@Module({
  imports: [forwardRef(() => TenantsModule)],
  providers: [tenantConnectionProvider, TenantModelRegistry],
  exports: [TenantModelRegistry, tenantConnectionProvider],
})
export class TenantDbModule {}
