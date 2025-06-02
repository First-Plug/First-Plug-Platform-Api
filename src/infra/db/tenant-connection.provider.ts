import { REQUEST } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { TenantConnectionService } from './tenant-connection.service';

export const tenantConnectionProvider = {
  provide: 'TENANT_CONNECTION',
  useFactory: async (
    request: any,
    connection: Connection,
    tenantConnectionService: TenantConnectionService,
  ) => {
    const tenantId = request.tenantName;
    if (!tenantId) {
      return connection.useDb('invited');
    }

    return tenantConnectionService.getTenantConnection(tenantId);
  },
  inject: [REQUEST, getConnectionToken(), TenantConnectionService],
};
