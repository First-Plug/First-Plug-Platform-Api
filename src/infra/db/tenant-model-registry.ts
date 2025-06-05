import { Injectable } from '@nestjs/common';
import { Product, ProductSchema } from 'src/products/schemas/product.schema';
import { Member, MemberSchema } from 'src/members/schemas/member.schema';
import { Shipment, ShipmentSchema } from 'src/shipments/schema/shipment.schema';
import { TenantConnectionService } from 'src/infra/db/tenant-connection.service';

// centralizo el acceso a los modelos por tenant
// reducir duplicacion de llamar por metodo a getTenantConnection
//
@Injectable()
export class TenantModelRegistry {
  constructor(private readonly connectionService: TenantConnectionService) {}

  async getProductModel(tenantName: string) {
    const connection =
      await this.connectionService.getTenantConnection(tenantName);
    return connection.model(Product.name, ProductSchema);
  }

  async getMemberModel(tenantName: string) {
    const connection =
      await this.connectionService.getTenantConnection(tenantName);
    return connection.model(Member.name, MemberSchema);
  }

  async getShipmentModel(tenantName: string) {
    const connection =
      await this.connectionService.getTenantConnection(tenantName);
    return connection.model(Shipment.name, ShipmentSchema);
  }
}
