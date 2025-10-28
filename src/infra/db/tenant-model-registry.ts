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
import { Office, OfficeSchema } from 'src/offices/schemas/office.schema';
import { Model, Types } from 'mongoose';
import { Connection } from 'mongoose';

// centralizo el acceso a los modelos por tenant
// reducir duplicacion de llamar por metodo a getTenantConnection
//
@Injectable()
export class TenantModelRegistry {
  private initializedOffices = new Set<string>(); // Track which tenants have initialized offices

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

  async getOfficeModel(tenantName: string) {
    const connection =
      await this.connectionService.getTenantConnection(tenantName);
    const model = connection.model(Office.name, OfficeSchema);

    // 🚫 TEMPORAL: Deshabilitado - No crear oficina "Main Office" automáticamente
    // Obligar al usuario a crear oficinas manualmente
    // await this.ensureMainOfficeExists(tenantName, model);

    return model;
  }

  async getConnection(tenantName: string) {
    return this.connectionService.getTenantConnection(tenantName);
  }

  getProductModelFromConnection(connection: Connection) {
    return connection.model(Product.name, ProductSchema);
  }

  getMemberModelFromConnection(connection: Connection) {
    return connection.model(Member.name, MemberSchema);
  }

  /**
   * Asegura que existe una oficina "Main Office" para el tenant
   * Se ejecuta solo la primera vez que se accede al modelo de offices de un tenant
   */
  private async ensureMainOfficeExists(
    tenantName: string,
    OfficeModel: Model<any>,
  ): Promise<void> {
    // Si ya inicializamos este tenant, no hacer nada
    if (this.initializedOffices.has(tenantName)) {
      return;
    }

    try {
      // Verificar si ya existe una oficina default
      const existingOffice = await OfficeModel.findOne({
        isDefault: true,
        isDeleted: false,
      });

      if (existingOffice) {
        // Ya existe una oficina default, marcar como inicializado
        this.initializedOffices.add(tenantName);
        return;
      }

      // Generar un tenantId temporal usando ObjectId
      const tempTenantId = new Types.ObjectId().toString();

      // Crear la oficina "Main Office"
      const mainOfficeData = {
        name: 'Main Office',
        isDefault: true,
        email: '',
        phone: '',
        country: '',
        city: '',
        state: '',
        zipCode: '',
        address: '',
        apartment: '',
        tenantId: tempTenantId,
        isActive: true,
        isDeleted: false,
      };

      await OfficeModel.create(mainOfficeData);

      // Marcar como inicializado
      this.initializedOffices.add(tenantName);
    } catch (error) {
      console.error(
        `❌ Error creando oficina "Main Office" para tenant ${tenantName}:`,
        error.message,
      );
      // No marcar como inicializado si hubo error, para intentar de nuevo la próxima vez
    }
  }
}
