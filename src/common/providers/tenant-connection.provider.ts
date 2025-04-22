import { REQUEST } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { TenantConnectionService } from './tenant-connection.service';
import * as jwt from 'jsonwebtoken';

export const tenantConnectionProvider = {
  provide: 'TENANT_CONNECTION',

  useFactory: async (
    request: any,
    connection: Connection,
    tenantConnectionService: TenantConnectionService,
  ) => {
    console.log(
      '🌐 tenantConnectionProvider - request.tenantName:',
      request.tenantName,
    );
    const authorizationHeader = request.headers?.authorization || '';
    const token = authorizationHeader.split(' ')[1];

    let tenantName: string | undefined;

    if (token) {
      try {
        const payload: any = jwt.verify(token, process.env.JWTSECRETKEY!);
        tenantName = payload.tenantName;
      } catch (error) {
        console.warn('⚠️ Token inválido o expirado.', error.message);
      }
    }

    console.log('🌐 tenantConnectionProvider - tenantName:', tenantName);

    if (!tenantName) {
      console.warn('🌐 No tenantName detected, using invited database!');
      return connection.useDb('invited');
    }

    return tenantConnectionService.getTenantConnection(tenantName);
  },
  inject: [REQUEST, getConnectionToken(), TenantConnectionService],
};
