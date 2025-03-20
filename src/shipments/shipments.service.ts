import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from 'src/common/providers/tenant-connection.service';
// import { Connection } from 'mongoose';

@Injectable()
export class ShipmentsService {
  constructor(private readonly connectionService: TenantConnectionService) {
    console.log('📡 this.connectionService:', this.connectionService);
    console.log(
      '📡 typeof getTenantConnection:',
      typeof this.connectionService?.getTenantConnection,
    );
  }

  async testTenantConnection(tenantName: string): Promise<string[]> {
    console.log('🔍 Obteniendo conexión para tenant:', tenantName);
    const connection =
      await this.connectionService.getTenantConnection(tenantName);

    await connection.asPromise(); // ⚠️ fuerza a esperar a que la conexión se establezca

    console.log('✅ Conexión obtenida:', connection.name);
    const collections = await connection.db.listCollections().toArray();
    return collections.map((col) => col.name);
  }
}
