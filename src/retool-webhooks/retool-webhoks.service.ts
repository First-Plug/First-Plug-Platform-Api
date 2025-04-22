import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import mongoose from 'mongoose';
import { SERVICES } from 'src/common/constants/services-tokens';
import { TenantConnectionService } from 'src/common/providers/tenant-connection.service';
import { MemberSchema } from 'src/members/schemas/member.schema';
import { ProductSchema } from 'src/products/schemas/product.schema';
import { SHIPMENT_STATUS } from 'src/shipments/interface/shipment.interface';
import { IShipmentsService } from 'src/shipments/interface/shipments-service.interface';
import { ShipmentSchema } from 'src/shipments/schema/shipment.schema';
import { IProductsService } from 'src/products/interfaces/products-service.interface';

@Injectable()
export class RetoolWebhooksService {
  constructor(
    private tenantConnectionService: TenantConnectionService,
    @Inject(SERVICES.SHIPMENTS)
    private readonly shipmentsService: IShipmentsService,
    @Inject(SERVICES.PRODUCTS)
    private readonly productsService: IProductsService,
  ) {}

  async updateShipmentStatusWebhook(body: {
    tenantName: string;
    shipmentId: string;
    newStatus: string;
  }) {
    const { tenantName, shipmentId, newStatus } = body;

    if (newStatus === 'Cancelled') {
      console.log('🚨 Ejecutando cancelShipmentAndUpdateProducts...');
      return this.shipmentsService.cancelShipmentAndUpdateProducts(
        shipmentId,
        tenantName,
      );
    }

    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantName);

    const ShipmentModel =
      connection.models.Shipment ||
      connection.model('Shipment', ShipmentSchema, 'shipments');

    const shipment = await ShipmentModel.findById(shipmentId);
    if (!shipment) throw new NotFoundException('Shipment no encontrado');

    this.validateStatusTransition(shipment.shipment_status, newStatus);

    const statusChanged = shipment.shipment_status !== newStatus;
    shipment.shipment_status = newStatus;

    if (statusChanged && newStatus === 'On The Way') {
      console.log('📸 Generando snapshot de productos...');
      await this.createSnapshots(shipment, connection);
    }

    if (statusChanged && newStatus === 'Received') {
      if (
        shipment.shipment_status !== 'On The Way' &&
        shipment.shipment_status !== 'In Preparation'
      ) {
        throw new BadRequestException(
          'Solo se puede marcar como Received un shipment que estaba In Preparation o On The Way',
        );
      }

      console.log('📥 Procesando productos para status Received...');
      for (const productId of shipment.products) {
        await this.shipmentsService.updateProductOnShipmentReceived(
          productId.toString(),
          tenantName,
          shipment.origin,
        );
      }
    }

    await shipment.save();

    return {
      message: 'Shipment actualizado correctamente',
      shipment,
    };
  }

  private validateStatusTransition(currentStatus: string, newStatus: string) {
    if (!SHIPMENT_STATUS.includes(newStatus as any)) {
      throw new BadRequestException(`Estado inválido: ${newStatus}`);
    }

    if (
      currentStatus === 'On Hold - Missing Data' &&
      newStatus !== 'Cancelled'
    ) {
      throw new BadRequestException(
        'Solo se puede cancelar un shipment con datos incompletos',
      );
    }

    if (currentStatus === 'On The Way' || currentStatus === 'Received') {
      throw new BadRequestException(
        'No se puede modificar un shipment ya enviado o recibido',
      );
    }
  }

  private async findProductsForSnapshot(
    productIds: mongoose.Types.ObjectId[],
    connection: mongoose.Connection,
  ) {
    const ProductModel =
      connection.models.Product ||
      connection.model('Product', ProductSchema, 'products');

    const MemberModel =
      connection.models.Member ||
      connection.model('Member', MemberSchema, 'members');

    const products = await ProductModel.find({
      _id: { $in: productIds },
    });

    if (products.length < productIds.length) {
      const remainingIds = productIds.filter(
        (id) => !products.some((p) => p._id.equals(id)),
      );

      const members = await MemberModel.find({
        'products._id': { $in: remainingIds },
      });

      members.forEach((member) => {
        member.products.forEach((p) => {
          if (remainingIds.some((id) => id.equals(p._id))) {
            products.push(p);
          }
        });
      });
    }

    return products;
  }

  private async createSnapshots(
    shipment: any,
    connection: mongoose.Connection,
  ) {
    const products = await this.findProductsForSnapshot(
      shipment.products,
      connection,
    );

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

  async updateShipmentFromRetool(body: {
    tenantName: string;
    shipmentId: string;
    newStatus?: string;
    shipment_type?: string;
    trackingURL?: string;
  }) {
    console.log('📥 Datos recibidos desde Retool:', body);
    const { tenantName, shipmentId, newStatus, shipment_type, trackingURL } =
      body;
    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantName);

    const ShipmentModel =
      connection.models.Shipment ||
      connection.model('Shipment', ShipmentSchema, 'shipments');

    const shipment = await ShipmentModel.findById(shipmentId);
    if (!shipment) throw new NotFoundException('Shipment no encontrado');

    if (newStatus) {
      await this.updateShipmentStatusWebhook({
        tenantName,
        shipmentId,
        newStatus,
      });
    }

    const fieldsUpdated: string[] = [];

    if (shipment_type) {
      shipment.shipment_type = shipment_type;
      fieldsUpdated.push('shipment_type');
    }

    if (trackingURL) {
      shipment.trackingURL = trackingURL;
      fieldsUpdated.push('trackingURL');
    }

    if (fieldsUpdated.length > 0) {
      await shipment.save();
    }

    return {
      message: `Shipment actualizado correctamente: ${fieldsUpdated.join(', ')}`,
      shipment,
    };
  }

  async updateShipmentPriceWebhook(body: {
    tenantName: string;
    shipmentId: string;
    price: { amount: number; currencyCode: string };
  }) {
    const { tenantName, shipmentId, price } = body;
    console.log('📥 Datos recibidos para price desde Retool:', body);

    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantName);

    const ShipmentModel =
      connection.models.Shipment ||
      connection.model('Shipment', ShipmentSchema, 'shipments');

    const shipment = await ShipmentModel.findById(shipmentId);
    if (!shipment) throw new NotFoundException('Shipment no encontrado');

    shipment.price = price;
    await shipment.save();

    return {
      message: `Shipment actualizado correctamente: price`,
      shipment,
    };
  }
}
