import { Injectable, NotFoundException } from '@nestjs/common';
import { Connection } from 'mongoose';
import { User } from '../schemas/user.schema';
import { TenantsService } from 'src/tenants/tenants.service';
import { TenantConnectionService } from 'src/infra/db/tenant-connection.service';

@Injectable()
export class UserAccessService {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly connectionService: TenantConnectionService,
  ) {}

  async getTenantName(user: User): Promise<string> {
    if (!user.tenantId) {
      throw new NotFoundException('User has no tenant assigned');
    }

    const tenant = await this.tenantsService.getTenantById(
      user.tenantId.toString(),
    );
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant.tenantName;
  }

  async getTenantConnection(user: User): Promise<Connection> {
    const tenantName = await this.getTenantName(user);
    return this.connectionService.getTenantConnection(tenantName);
  }
}
