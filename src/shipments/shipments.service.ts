import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import mongoose, { Model, Schema, Types } from 'mongoose';
import { ShipmentDocument, ShipmentSchema } from './schema/shipment.schema';
import { TenantConnectionService } from 'src/common/providers/tenant-connection.service';
import { MembersService } from 'src/members/members.service';
import { TenantsService } from 'src/tenants/tenants.service';
import { ProductsService } from 'src/products/products.service';
import { countryCodes } from 'src/shipments/helpers/countryCodes';
import { GlobalConnectionProvider } from 'src/common/providers/global-connection.provider';
import { ShipmentGlobalMetadataSchema } from 'src/common/schema/shipment-global-metadata.schema';
import { Product } from 'src/products/schemas/product.schema';

@Injectable()
export class ShipmentsService {
  constructor(
    private globalConnectionProvider: GlobalConnectionProvider,
    private tenantConnectionService: TenantConnectionService,
    private membersService: MembersService,

    private tenantsService: TenantsService,
    @Inject(forwardRef(() => ProductsService))
    private productsService: ProductsService,
  ) {}

  private getShipmentModel(tenantConnection): Model<ShipmentDocument> {
    if (tenantConnection.models.Shipment) {
      return tenantConnection.models.Shipment;
    }

    return tenantConnection.model('Shipment', ShipmentSchema);
  }

  private getShipmentGlobalMetadataModel(): Model<any> {
    const globalConnection = this.globalConnectionProvider.getConnection();
    return (
      globalConnection.models.ShipmentGlobalMetadata ||
      globalConnection.model(
        'ShipmentGlobalMetadata',
        ShipmentGlobalMetadataSchema,
      )
    );
  }

  private getCountryCode(countryName: string): string {
    return countryCodes[countryName] || 'XX';
  }

  private async getLocationInfo(
    location: string,
    tenantId: string,
    assignedEmail?: string,
    assignedMember?: string,
  ): Promise<{
    name: string;
    code: string;
    details?: Record<string, string>;
  }> {
    if (location === 'FP warehouse') {
      return { name: 'FP warehouse', code: 'FP' };
    }

    if (location === 'Our office') {
      const tenant = await this.tenantsService.getTenantById(tenantId);
      if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found`);

      return {
        name: 'Our office',
        code: 'OO',
        details: {
          address: tenant.address || '',
          apartment: tenant.apartment || '',
          city: tenant.city || '',
          state: tenant.state || '',
          country: tenant.country || '',
          zipCode: tenant.zipCode || '',
          phone: tenant.phone || '',
        },
      };
    }

    if (location === 'Employee' && assignedEmail) {
      const member =
        await this.membersService.findByEmailNotThrowError(assignedEmail);
      if (!member)
        throw new NotFoundException(`Member ${assignedEmail} not found`);

      return {
        name: `${member.firstName} ${member.lastName}`,
        code: this.getCountryCode(member.country || ''),
        details: {
          address: member.address || '',
          city: member.city || '',
          country: member.country || '',
          zipCode: member.zipCode || '',
          apartment: member.apartment || '',
          contactName: `${member.firstName} ${member.lastName}`,
          phone: member.phone || '',
          personalEmail: member.personalEmail || '',
          dni: `${member.dni || ''}`,
        },
      };
    }

    return { name: assignedMember || 'Unknown', code: 'XX' };
  }

  private async getNextOrderNumber(tenantName: string): Promise<number> {
    const ShipmentMetadata = this.getShipmentGlobalMetadataModel();
    const metadata = await ShipmentMetadata.findOneAndUpdate(
      { _id: `orderNumber_${tenantName}` },
      { $inc: { currentValue: 1 } },
      { upsert: true, new: true },
    ).exec();

    return metadata.currentValue;
  }

  async getProductLocationData(
    productId: Product | string,
    tenantId: string,
    actionType?: string,
  ): Promise<{
    product: Product;
    origin: string;
    destination: string;
    orderOrigin: string;
    orderDestination: string;
    assignedEmail: string;
  }> {
    const productIdStr =
      typeof productId === 'string' ? productId : productId._id?.toString();
    if (!productIdStr) throw new BadRequestException(`Invalid product ID`);

    const found = await this.productsService.findProductById(
      new Types.ObjectId(productIdStr) as unknown as Schema.Types.ObjectId,
    );
    if (!found || !found.product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    const product = found.product;
    const assignedEmail = product.assignedEmail || found.member?.email || '';
    const assignedMember = product.assignedMember || '';

    const isCreating = this.isCreatingAction(actionType);

    const originInfo = isCreating
      ? { name: 'XX', code: 'XX' }
      : await this.getLocationInfo(
          product.location || '',
          tenantId,
          assignedEmail,
          assignedMember,
        );

    const destinationInfo = await this.getLocationInfo(
      product.location || '',
      tenantId,
      assignedEmail,
      assignedMember,
    );

    return {
      product,
      origin: originInfo.name,
      destination: destinationInfo.name,
      orderOrigin: originInfo.code,
      orderDestination: destinationInfo.code,
      assignedEmail: assignedEmail || '',
    };
  }

  private generateOrderId(
    orderOrigin: string,
    orderDestination: string,
    orderNumber: number,
  ): string {
    const orderNumberFormatted = orderNumber.toString().padStart(4, '0');
    return `${orderOrigin}${orderDestination}${orderNumberFormatted}`;
  }

  private isCreatingAction(actionType?: string): boolean {
    console.log('🧠 isCreatingAction llamado con:', actionType);
    return actionType === 'create' || actionType === 'bulkCreate';
  }

  async findById(
    shipmentId: string,
    tenantId: string,
  ): Promise<ShipmentDocument | null> {
    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantId);
    const ShipmentModel = this.getShipmentModel(connection);

    return ShipmentModel.findById(shipmentId).exec();
  }

  async findOrCreateShipment(
    productId: string,
    actionType: string,
    tenantId: string,
    session: mongoose.ClientSession | null = null,
  ): Promise<ShipmentDocument> {
    const found = await this.productsService.findProductById(
      new Types.ObjectId(productId) as unknown as Schema.Types.ObjectId,
    );
    if (!found?.product) {
      throw new NotFoundException(`Product ${productId} not found.`);
    }
    const product = found.product;
    const assignedEmail = product.assignedEmail || found.member?.email || '';

    const { origin, destination, orderOrigin, orderDestination } =
      await this.getProductLocationData(productId, actionType);

    const originDetails = ['create', 'bulkCreate'].includes(actionType)
      ? undefined
      : await this.getLocationInfo(origin, tenantId, assignedEmail).then(
          (res) => res.details,
        );
    const destinationDetails = await this.getLocationInfo(
      destination,
      tenantId,
      assignedEmail,
    ).then((res) => res.details);

    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantId);
    const ShipmentModel = this.getShipmentModel(connection);

    const existingShipment = await ShipmentModel.findOne({
      origin,
      destination,
      shipment_status: { $in: ['In Preparation', 'On Hold - Missing Data'] },
      'originDetails.desirableDate': originDetails?.desirableDate || null,
      'destinationDetails.desirableDate':
        destinationDetails?.desirableDate || null,
    }).session(session);

    const productObjectId = new mongoose.Types.ObjectId(productId);

    if (existingShipment) {
      if (!existingShipment.products.includes(productObjectId)) {
        existingShipment.products.push(productObjectId);
        existingShipment.quantity_products = existingShipment.products.length;
        await existingShipment.save({ session });
      }
      return existingShipment;
    }

    const destinationComplete = await this.productsService.isAddressComplete(
      { ...product, location: destination, assignedEmail },
      tenantId,
    );
    const originComplete = ['create', 'bulkCreate'].includes(actionType)
      ? true
      : await this.productsService.isAddressComplete(
          { ...product, location: origin, assignedEmail },
          tenantId,
        );

    const shipmentStatus =
      destinationComplete && originComplete
        ? 'In Preparation'
        : 'On Hold - Missing Data';

    const orderNumber = await this.getNextOrderNumber(tenantId);
    const order_id = this.generateOrderId(
      orderOrigin,
      orderDestination,
      orderNumber,
    );

    const newShipment = await ShipmentModel.create({
      order_id,
      tenant: tenantId,
      quantity_products: 1,
      shipment_status: shipmentStatus,
      shipment_type: 'TBC',
      origin,
      originDetails,
      destination,
      destinationDetails,
      products: [productObjectId],
      type: 'shipments',
      order_date: new Date(),
      price: { amount: null, currencyCode: 'TBC' },
    });

    return newShipment;
  }

  async createShipment(
    tenantName: string,
    shipmentData: any,
    actionType: string,
    newDestinationLocation: string,
    newAssignedEmail?: string,
  ): Promise<ShipmentDocument> {
    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantName);
    const ShipmentModel = this.getShipmentModel(connection);

    const found = await this.productsService.findProductById(
      shipmentData.productId,
    );
    if (!found || !found.product)
      throw new NotFoundException(
        `Product ${shipmentData.productId} not found`,
      );

    const product = found.product;

    const assignedEmail = product.assignedEmail || found.member?.email;

    const isCreating = ['create', 'bulkCreate'].includes(actionType);

    const originInfo = isCreating
      ? { name: 'XX', code: 'XX' }
      : await this.getLocationInfo(
          product.location || '',
          tenantName,
          assignedEmail,
        );

    const destinationInfo = await this.getLocationInfo(
      newDestinationLocation,
      tenantName,
      newAssignedEmail,
    );

    const orderNumber = await this.getNextOrderNumber(tenantName);
    const orderId = this.generateOrderId(
      originInfo.code,
      destinationInfo.code,
      orderNumber,
    );

    const shipmentToCreate = {
      ...shipmentData,
      order_id: orderId,
      tenant: tenantName,
      origin: originInfo.name,
      destination: destinationInfo.name,
      originDetails: originInfo.details,
      destinationDetails: destinationInfo.details,
      shipment_status: 'In Preparation',
    };

    return ShipmentModel.create(shipmentToCreate);
  }

  async getShipmentById(
    tenantName: string,
    shipmentId: string,
  ): Promise<ShipmentDocument> {
    const tenantConnection =
      await this.tenantConnectionService.getTenantConnection(tenantName);
    const Shipment = tenantConnection.model('Shipment');

    return Shipment.findById(shipmentId).exec();
  }

  async updateShipmentStatus(
    tenantName: string,
    shipmentId: string,
    newStatus: string,
  ): Promise<ShipmentDocument> {
    const tenantConnection =
      await this.tenantConnectionService.getTenantConnection(tenantName);
    const Shipment = tenantConnection.model('Shipment');

    return Shipment.findByIdAndUpdate(
      shipmentId,
      { shipment_status: newStatus },
      { new: true },
    ).exec();
  }

  async deleteShipment(
    tenantName: string,
    shipmentId: string,
  ): Promise<ShipmentDocument> {
    const tenantConnection =
      await this.tenantConnectionService.getTenantConnection(tenantName);
    const Shipment = tenantConnection.model('Shipment');

    return Shipment.findByIdAndDelete(shipmentId).exec();
  }
}
