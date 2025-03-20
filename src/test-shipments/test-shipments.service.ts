import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { TenantConnectionService } from 'src/common/providers/tenant-connection.service';
import {
  Shipment,
  ShipmentDocument,
  ShipmentSchema,
} from 'src/shipments/schemas/shipment.schema';
// import mongoose from 'mongoose';

@Injectable()
export class TestShipmentsService {
  constructor(private readonly connectionService: TenantConnectionService) {}

  async cancelShipmentAndUpdateProductStatus(
    shipmentId: string,
    tenantName: string,
  ) {
    console.log('✅ Método llamado en TestShipmentsService');
    console.log('📡 this.connectionService:', this.connectionService);

    const connection =
      await this.connectionService.getTenantConnection(tenantName);
    const ShipmentModel =
      connection.models[Shipment.name] ??
      connection.model<ShipmentDocument>(Shipment.name, ShipmentSchema);

    const shipment = await ShipmentModel.findById(shipmentId);
    if (!shipment) {
      throw new NotFoundException(`Shipment with ID ${shipmentId} not found`);
    }

    if (
      shipment.shipment_status !== 'In Preparation' &&
      shipment.shipment_status !== 'On Hold - Missing Data'
    ) {
      throw new BadRequestException(
        `Shipment cannot be cancelled from status '${shipment.shipment_status}'`,
      );
    }

    shipment.shipment_status = 'Cancelled';
    await shipment.save();

    return shipment;
  }

  async listCollections(tenantName: string) {
    console.log('📌 listCollections() llamado con tenant:', tenantName);
    console.log('📡 this.connectionService:', this.connectionService);

    if (!this.connectionService?.getTenantConnection) {
      console.log('🚨 NO EXISTE getTenantConnection');
      return 'ERROR: getTenantConnection no está definido';
    }

    const connection =
      await this.connectionService.getTenantConnection(tenantName);
    console.log('📡 Conexión obtenida:', connection);

    if (!connection?.db) {
      console.log('🚨 Conexión no tiene .db');
      return 'ERROR: conexión inválida o vacía';
    }

    const collections = await connection.db.listCollections().toArray();
    return collections.map((c) => c.name);
  }
}
