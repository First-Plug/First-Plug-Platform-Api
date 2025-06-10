import { Injectable } from '@nestjs/common';
import { Product, ProductSchema } from 'src/products/schemas/product.schema';
import { Member, MemberSchema } from 'src/members/schemas/member.schema';
import {
  Shipment,
  ShipmentDocument,
  ShipmentSchema,
} from 'src/shipments/schema/shipment.schema';
import { TenantConnectionService } from 'src/infra/db/tenant-connection.service';
import { Team, TeamSchema } from 'src/teams/schemas/team.schema';
import { History, HistorySchema } from 'src/history/schemas/history.schema';
import { Model } from 'mongoose';

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

  async getShipmentModel(tenantName: string): Promise<Model<ShipmentDocument>> {
    const connection =
      await this.connectionService.getTenantConnection(tenantName);
    const modelName = Shipment.name;

    return (
      (connection.models[modelName] as Model<ShipmentDocument>) ||
      connection.model<ShipmentDocument>(modelName, ShipmentSchema)
    );
  }

  async getTeamModel(tenantName: string) {
    const connection =
      await this.connectionService.getTenantConnection(tenantName);
    return connection.model(Team.name, TeamSchema);
  }

  async getHistoryModel(tenantName: string) {
    const connection =
      await this.connectionService.getTenantConnection(tenantName);
    return connection.model(History.name, HistorySchema);
  }

  async getConnection(tenantName: string) {
    return this.connectionService.getTenantConnection(tenantName);
  }
}
