import { Injectable, NotFoundException } from '@nestjs/common';
import mongoose from 'mongoose';
import { TenantConnectionService } from 'src/common/providers/tenant-connection.service';
import { ProductSchema } from 'src/products/schemas/product.schema';
// import { ShipmentStatus } from 'src/shipments/interfaces/shipment.interface';
import { ShipmentSchema } from 'src/shipments/schemas/shipment.schema';
import { ShipmentsService } from 'src/shipments/shipments.service';

@Injectable()
export class RetoolWebhooksService {
  constructor(
    private tenantConnectionService: TenantConnectionService,
    private readonly shipmentsService: ShipmentsService,
  ) {}

  async updateShipmentStatusWebhook(body: {
    tenantName: string;
    shipmentId: string;
    newStatus: string;
  }) {
    const { tenantName, shipmentId, newStatus } = body;
    console.log('📌 Tenant recibido:', tenantName);

    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantName);
    console.log('📌 Conexión apunta a DB:', connection.name);

    const ShipmentModel =
      connection.models.ShipmentForRetool ||
      connection.model('ShipmentForRetool', ShipmentSchema, 'shipments');

    console.log(
      '📦 ShipmentModel apunta a colección:',
      ShipmentModel.collection.name,
    );

    const ProductModel =
      connection.models.Product ||
      connection.model('Product', ProductSchema, 'products');

    console.log('📦 ID recibido:', shipmentId);
    console.log('📦 Nuevo estado:', newStatus);
    console.log('📦 Modelos disponibles:', Object.keys(connection.models));
    console.log('📦 ShipmentID es tipo:', typeof shipmentId);
    console.log('📦 ShipmentID recibido:', shipmentId);

    const objectId = new mongoose.Types.ObjectId(shipmentId);
    console.log('📦 ObjectId generado manualmente:', objectId);

    const shipment = await ShipmentModel.findOne({ _id: objectId });
    console.log('📦 Shipment encontrado:', shipment);

    if (!shipment) {
      throw new NotFoundException('Shipment no encontrado');
    }

    const statusChanged = shipment.shipment_status !== newStatus;
    shipment.shipment_status = newStatus;

    if (statusChanged && newStatus === 'On The Way') {
      const products = await ProductModel.find({
        _id: { $in: shipment.products },
      });

      shipment.snapshots = products.map((product) => ({
        _id: product._id,
        name: product.name,
        category: product.category,
        attributes: product.attributes,
        status: product.status,
        recoverable: product.recoverable,
        serialNumber: product.serialNumber || '',
        assignedEmail: product.assignedEmail,
        assignedMember: product.assignedMember,
        lastAssigned: product.lastAssigned,
        acquisitionDate: product.acquisitionDate,
        location: product.location,
        price: product.price,
        additionalInfo: product.additionalInfo,
        productCondition: product.productCondition,
        fp_shipment: product.fp_shipment,
      }));
    }

    await shipment.save();

    return {
      message: 'Shipment actualizado correctamente con snapshots',
      shipment,
    };
  }
}
