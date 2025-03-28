import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import mongoose, { Connection, Model, Schema, Types } from 'mongoose';
import {
  Shipment,
  ShipmentDocument,
  ShipmentSchema,
} from './schema/shipment.schema';
import { TenantConnectionService } from 'src/common/providers/tenant-connection.service';
import { MembersService } from 'src/members/members.service';
import { TenantsService } from 'src/tenants/tenants.service';
import { ProductsService } from 'src/products/products.service';
import { countryCodes } from 'src/shipments/helpers/countryCodes';
import { GlobalConnectionProvider } from 'src/common/providers/global-connection.provider';
import { ShipmentGlobalMetadataSchema } from 'src/common/schema/shipment-global-metadata.schema';
import {
  Product,
  ProductDocument,
  ProductSchema,
} from 'src/products/schemas/product.schema';
import {
  MemberDocument,
  MemberSchema,
} from 'src/members/schemas/member.schema';
import { Status } from 'src/products/interfaces/product.interface';

@Injectable()
export class ShipmentsService {
  constructor(
    private readonly globalConnectionProvider: GlobalConnectionProvider,
    private readonly tenantConnectionService: TenantConnectionService,
    private readonly membersService: MembersService,

    private readonly tenantsService: TenantsService,
    @Inject(forwardRef(() => ProductsService))
    private readonly productsService: ProductsService,
  ) {
    console.log(
      '🚚 ShipmentsService cargado - tenantConnectionService:',
      !!tenantConnectionService,
    );
  }

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
    desirableDate?: string,
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
          desirableDate: desirableDate || '',
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
          desirableDate: desirableDate || '',
        },
      };
    }

    return { name: assignedMember || 'Unknown', code: 'XX' };
  }

  private async getNextOrderNumber(): Promise<number> {
    const ShipmentMetadata = this.getShipmentGlobalMetadataModel();
    const docId = 'globalOrderCounter';

    const updated = await ShipmentMetadata.findOneAndUpdate(
      { _id: docId },
      { $inc: { currentValue: 1 } },
      { new: true },
    );

    if (!updated) {
      const created = await ShipmentMetadata.create({
        _id: docId,
        currentValue: 1,
      });
      return created.currentValue;
    }

    return updated.currentValue;
  }

  async getProductLocationData(
    productId: Product | string,
    tenantId: string,
    actionType?: string,
    desirableOriginDate?: string,
    desirableDestinationDate?: string,
  ): Promise<{
    product: Product;
    origin: string;
    destination: string;
    orderOrigin: string;
    orderDestination: string;
    assignedEmail: string;
    originLocation: string;
    destinationLocation: string;
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
          desirableOriginDate,
        );

    const destinationInfo = await this.getLocationInfo(
      product.location || '',
      tenantId,
      assignedEmail,
      assignedMember,
      desirableDestinationDate,
    );

    return {
      product,
      origin: originInfo.name,
      destination: destinationInfo.name,
      orderOrigin: originInfo.code,
      orderDestination: destinationInfo.code,
      assignedEmail: assignedEmail || '',
      originLocation: isCreating ? 'XX' : product.location || '',
      destinationLocation: product.location || '',
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
    desirableDestinationDate?: string,
  ): Promise<ShipmentDocument> {
    const found = await this.productsService.findProductById(
      new Types.ObjectId(productId) as unknown as Schema.Types.ObjectId,
    );
    if (!found?.product) {
      throw new NotFoundException(`Product ${productId} not found.`);
    }
    const product = found.product;
    const assignedEmail = product.assignedEmail || found.member?.email || '';

    const {
      origin,
      destination,
      orderOrigin,
      orderDestination,
      originLocation,
      destinationLocation,
    } = await this.getProductLocationData(
      productId,
      tenantId,
      actionType,
      undefined,
      desirableDestinationDate,
    );

    const originDetails = ['create', 'bulkCreate'].includes(actionType)
      ? undefined
      : await this.getLocationInfo(
          originLocation,
          tenantId,
          assignedEmail,
          product.assignedMember,
          undefined,
        ).then((res) => res.details);

    const destinationDetails = await this.getLocationInfo(
      destinationLocation,
      tenantId,
      assignedEmail,
      product.assignedMember,
      desirableDestinationDate,
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
      { ...product, location: destinationLocation, assignedEmail },
      tenantId,
    );
    const originComplete = ['create', 'bulkCreate'].includes(actionType)
      ? true
      : await this.productsService.isAddressComplete(
          { ...product, location: originLocation, assignedEmail },
          tenantId,
        );

    const shipmentStatus =
      destinationComplete && originComplete
        ? 'In Preparation'
        : 'On Hold - Missing Data';

    const orderNumber = await this.getNextOrderNumber();
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

    if (['In Preparation', 'On The Way'].includes(shipmentStatus)) {
      await this.markActiveShipmentTargets(
        productId,
        tenantId,
        origin,
        destination,
        assignedEmail,
      );
    }

    return newShipment;
  }

  private getProductModel(connection: Connection): Model<ProductDocument> {
    if (connection.models.Product) {
      return connection.models.Product;
    }

    return connection.model<ProductDocument>('Product', ProductSchema);
  }

  async cancelShipmentAndUpdateProducts(
    shipmentId: string,
    tenantId: string,
  ): Promise<ShipmentDocument> {
    console.log('🚨 [CANCEL SHIPMENT] Start for', shipmentId);

    await new Promise((resolve) => process.nextTick(resolve));
    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantId);
    const ShipmentModel = this.getShipmentModel(connection);
    const ProductModel = this.getProductModel(connection);

    const shipment = await ShipmentModel.findById(shipmentId);
    if (!shipment) {
      throw new NotFoundException(`Shipment ${shipmentId} not found`);
    }

    if (
      shipment.shipment_status !== 'In Preparation' &&
      shipment.shipment_status !== 'On Hold - Missing Data'
    ) {
      console.log(
        '❌ Shipment status invalid for cancellation:',
        shipment.shipment_status,
      );
      throw new BadRequestException(
        `Cannot cancel shipment with status: ${shipment.shipment_status}`,
      );
    }

    shipment.shipment_status = 'Cancelled';
    await shipment.save();
    console.log('✅ Shipment cancelled');

    for (const productId of shipment.products) {
      console.log('📦 Processing product:', productId.toString());

      const product = await ProductModel.findById(productId);

      let newStatus: Status;
      let embeddedProduct: Product | undefined;
      if (product) {
        product.fp_shipment = false;

        newStatus = await this.productsService.determineProductStatus(
          {
            ...product.toObject(),
            fp_shipment: false,
          },
          tenantId,
          undefined,
          shipment.origin,
        );

        product.status = newStatus;
        product.activeShipment = false;
        await product.save();

        console.log(`✅ Product updated from Product collection:`, {
          id: product._id,
          status: newStatus,
        });
      } else {
        console.log(
          '⚠️ Product not found in Product collection, trying in Member',
        );

        const MemberModel =
          connection.models.Member ||
          connection.model<MemberDocument>('Member', MemberSchema, 'members');
        const memberWithProduct = await MemberModel.findOne({
          'products._id': productId,
        });

        const embeddedProduct = memberWithProduct?.products.find(
          (p) => p._id?.toString() === productId.toString(),
        );

        if (embeddedProduct) {
          newStatus = await this.productsService.determineProductStatus(
            {
              fp_shipment: false,
              location: embeddedProduct.location,
              status: embeddedProduct.status,
              assignedEmail: embeddedProduct.assignedEmail,
              productCondition: embeddedProduct.productCondition,
            },
            tenantId,
            undefined,
            shipment.origin,
          );

          await MemberModel.updateOne(
            { 'products._id': productId },
            {
              $set: {
                'products.$.fp_shipment': false,
                'products.$.status': newStatus,
                'products.$.activeShipment': false,
              },
            },
          );

          console.log(`✅ Product updated from Member collection:`, {
            id: embeddedProduct._id,
            status: newStatus,
          });
        } else {
          console.log('❌ Product not found in Member collection either');
        }
      }

      await this.clearActiveShipmentFlagsIfNoOtherShipments(
        productId.toString(),
        tenantId,
        product?.assignedEmail || embeddedProduct?.assignedEmail,
      );
    }
    return shipment;
  }

  private async markActiveShipmentTargets(
    productId: string,
    tenantName: string,
    origin: string,
    destination: string,
    memberEmail?: string,
  ) {
    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantName);

    const ProductModel = connection.model<ProductDocument>(
      'Product',
      ProductSchema,
    );
    const MemberModel = connection.model<MemberDocument>(
      'Member',
      MemberSchema,
    );

    const updatedProduct = await ProductModel.findByIdAndUpdate(productId, {
      activeShipment: true,
    });

    if (!updatedProduct) {
      await MemberModel.updateOne(
        { 'products._id': productId },
        { $set: { 'products.$.activeShipment': true } },
      );
    }

    if (!['Our office', 'FP warehouse'].includes(origin) && memberEmail) {
      await MemberModel.updateOne(
        { email: memberEmail },
        { activeShipment: true },
      );
    }

    if (!['Our office', 'FP warehouse'].includes(destination) && memberEmail) {
      await MemberModel.updateOne(
        { email: memberEmail },
        { activeShipment: true },
      );
    }
  }

  private async clearActiveShipmentFlagsIfNoOtherShipments(
    productId: string,
    tenantName: string,
    memberEmail?: string,
  ) {
    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantName);

    const ProductModel = connection.model<ProductDocument>('Product');
    const MemberModel = connection.model<MemberDocument>('Member');
    const ShipmentModel = connection.model<Shipment>('Shipment');

    const activeShipmentsForProduct = await ShipmentModel.countDocuments({
      products: new Types.ObjectId(productId),
      shipment_status: { $in: ['In Preparation', 'On The Way'] },
    });
    console.log(
      `🔎 Active shipments for product ${productId}:`,
      activeShipmentsForProduct,
    );

    if (activeShipmentsForProduct === 0) {
      const updatedProduct = await ProductModel.findByIdAndUpdate(productId, {
        activeShipment: false,
      });

      if (updatedProduct) {
        console.log(
          `✅ Product ${productId} - activeShipment set to false in Products collection`,
        );
      } else {
        const updateRes = await MemberModel.updateOne(
          { 'products._id': new Types.ObjectId(productId) },
          { $set: { 'products.$.activeShipment': false } },
        );
        console.log(
          `🔁 Product ${productId} - activeShipment set to false in Member`,
          updateRes,
        );
      }
    }

    console.log('📬 memberEmail recibido:', memberEmail);

    if (!memberEmail) {
      const member = await MemberModel.findOne({
        'products._id': new Types.ObjectId(productId),
      });
      if (member) {
        memberEmail = member.email;
      }
    }

    // ✅ Si lo conseguimos, verificamos si tiene otros shipments activos
    if (memberEmail) {
      const member = await MemberModel.findOne({ email: memberEmail });

      if (!member) {
        console.log(`❌ No se encontró el member con email ${memberEmail}`);
        return;
      }

      const fullName = `${member.firstName} ${member.lastName}`;

      const activeShipmentsForMember = await ShipmentModel.countDocuments({
        shipment_status: { $in: ['In Preparation', 'On The Way'] },
        $or: [{ origin: fullName }, { destination: fullName }],
      });

      console.log(
        `🔎 Active shipments for member ${fullName}: ${activeShipmentsForMember}`,
      );

      if (activeShipmentsForMember === 0) {
        console.log(`✅ Setting activeShipment: false for member ${fullName}`);
        const result = await MemberModel.updateOne(
          { email: memberEmail },
          { activeShipment: false },
        );
        console.log('🧾 Member update result:', result);
      }
    }
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

    const orderNumber = await this.getNextOrderNumber();
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
