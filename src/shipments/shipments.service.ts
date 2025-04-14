import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import mongoose, {
  ClientSession,
  Connection,
  Model,
  Schema,
  Types,
} from 'mongoose';
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
import {
  ShipmentMetadata,
  ShipmentMetadataSchema,
} from 'src/shipments/schema/shipment-metadata.schema';
import { OrderNumberGenerator } from 'src/shipments/helpers/order-number.util';

@Injectable()
export class ShipmentsService {
  constructor(
    private readonly globalConnectionProvider: GlobalConnectionProvider,
    private readonly tenantConnectionService: TenantConnectionService,
    @Inject(forwardRef(() => MembersService))
    private readonly membersService: MembersService,
    private readonly tenantsService: TenantsService,
    @Inject(forwardRef(() => ProductsService))
    private readonly productsService: ProductsService,
    @Inject('SHIPMENT_METADATA_MODEL')
    private readonly shipmentMetadataRepository: Model<ShipmentMetadata>,
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

  private getCountryCode(countryName: string): string {
    return countryCodes[countryName] || 'XX';
  }

  public async getLocationInfo(
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
      const tenant = await this.tenantsService.getByTenantName(tenantId);
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

  async initializeOrderNumberGenerator(
    connection: Connection,
    session?: ClientSession | null,
  ): Promise<OrderNumberGenerator> {
    const ShipmentMetadataModel =
      connection.models.ShipmentMetadata ||
      connection.model(
        'ShipmentMetadata',
        ShipmentMetadataSchema,
        'shipmentmetadata',
      );

    const docId = 'orderCounter';
    const existing = await ShipmentMetadataModel.findById(docId).session(
      session ?? null,
    );
    const initial = existing?.lastOrderNumber || 0;
    return new OrderNumberGenerator(initial);
  }

  async finalizeOrderNumber(
    connection: Connection,
    finalNumber: number,
    session?: ClientSession,
  ): Promise<void> {
    const ShipmentMetadataModel =
      connection.models.ShipmentMetadata ||
      connection.model(
        'ShipmentMetadata',
        ShipmentMetadataSchema,
        'shipmentmetadata',
      );

    await ShipmentMetadataModel.findOneAndUpdate(
      { _id: 'orderCounter' },
      { $set: { lastOrderNumber: finalNumber } },
      { upsert: true, session },
    );
  }

  // async getNextOrderNumber(
  //   connection: Connection,
  //   session?: mongoose.ClientSession,
  // ): Promise<number> {
  //   const ShipmentMetadataModel =
  //     connection.models.ShipmentMetadata ||
  //     connection.model(
  //       'ShipmentMetadata',
  //       ShipmentMetadataSchema,
  //       'shipmentmetadata',
  //     );

  //   const docId = 'orderCounter';

  //   const updated = await ShipmentMetadataModel.findOneAndUpdate(
  //     { _id: docId },
  //     { $inc: { lastOrderNumber: 1 } },
  //     { new: true, upsert: true, session },
  //   );

  //   if (!updated || updated.lastOrderNumber === undefined) {
  //     throw new Error('Failed to generate next order number');
  //   }

  //   return updated.lastOrderNumber;
  // }

  async getProductLocationData(
    productId: Product | string,
    tenantId: string,
    actionType?: string,
    overrideAssignedEmail?: string,
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
    const assignedEmail = found.member?.email || product.assignedEmail || '';
    const assignedMember = found.member
      ? `${found.member.firstName} ${found.member.lastName}`
      : product.assignedMember || '';

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
      assignedMember ? 'Employee' : product.location || '',
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
      destinationLocation: assignedMember ? 'Employee' : product.location || '',
    };
  }

  private generateOrderId(
    orderOrigin: string,
    orderDestination: string,
    orderNumber: number,
  ): string {
    if (!orderOrigin || !orderDestination || orderNumber === undefined) {
      throw new Error('❌ Parámetros inválidos para generar el Order ID');
    }
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
    desirableOriginDate?: string,
  ): Promise<ShipmentDocument> {
    console.log('🚚 [INIT] findOrCreateShipment llamado', {
      productId,
      actionType,
      tenantId,
    });
    const found = await this.productsService.findProductById(
      new Types.ObjectId(productId) as unknown as Schema.Types.ObjectId,
    );
    if (!found?.product) {
      throw new NotFoundException(`Product ${productId} not found.`);
    }
    const product = found.product;
    const assignedEmail = found.member?.email || product.assignedEmail || '';
    console.log('📦 Producto encontrado:', { assignedEmail });

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
      assignedEmail,
      desirableOriginDate,
      desirableDestinationDate,
    );
    console.log('📍 Ubicaciones obtenidas:', {
      origin,
      destination,
      originLocation,
      destinationLocation,
    });

    const originDetails = ['create', 'bulkCreate'].includes(actionType)
      ? undefined
      : await this.getLocationInfo(
          originLocation,
          tenantId,
          assignedEmail,
          product.assignedMember,
          desirableOriginDate,
        ).then((res) => res.details);

    console.log('📄 originDetails:', originDetails);

    const destinationDetails = await this.getLocationInfo(
      destinationLocation,
      tenantId,
      assignedEmail,
      product.assignedMember,
      desirableDestinationDate,
    ).then((res) => res.details);

    console.log('📄 destinationDetails:', destinationDetails);

    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantId);
    const ShipmentModel = this.getShipmentModel(connection);
    console.log('🔎 Buscando shipment existente...');
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
      console.log('✅ Shipment existente encontrado');
      if (!existingShipment.products.includes(productObjectId)) {
        console.log('➕ Agregando producto al shipment existente...');
        existingShipment.products.push(productObjectId);
        existingShipment.quantity_products = existingShipment.products.length;
        await existingShipment.save({ session });
        console.log('💾 Shipment existente actualizado');
      }
      return existingShipment;
    }
    console.log('🆕 Creando nuevo shipment...');
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

    // if (!session) {
    //   throw new Error('Session is required to get next order number.');
    // }
    const orderNumberGenerator = await this.initializeOrderNumberGenerator(
      connection,
      session,
    );
    const nextNumber = orderNumberGenerator.getNext();
    const order_id = this.generateOrderId(
      orderOrigin,
      orderDestination,
      nextNumber,
    );

    console.log('📦 Datos del nuevo shipment:', {
      order_id,
      shipmentStatus,
    });

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

    console.log('✅ Shipment creado');

    if (['In Preparation', 'On The Way'].includes(shipmentStatus)) {
      await this.markActiveShipmentTargets(
        productId,
        tenantId,
        origin,
        destination,
        assignedEmail,
      );
    }
    await this.finalizeOrderNumber(
      connection,
      orderNumberGenerator.getCurrent(),
      session ?? undefined,
    );
    console.log('✅ Orden finalizada correctamente');
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

  async updateProductOnShipmentReceived(
    productId: string,
    tenantName: string,
    origin: string,
  ) {
    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantName);
    const ProductModel = this.getProductModel(connection);
    const MemberModel = connection.model<MemberDocument>('Member');

    const product = await ProductModel.findById(productId);

    if (product) {
      product.fp_shipment = false;
      product.activeShipment = false;
      product.status = await this.productsService.determineProductStatus(
        {
          ...product.toObject(),
          fp_shipment: false,
        },
        tenantName,
        undefined,
        origin,
      );
      await product.save();
      console.log(`✅ Product updated (Products collection): ${product._id}`);
      return;
    }

    const memberWithProduct = await MemberModel.findOne({
      'products._id': productId,
    });

    if (memberWithProduct) {
      const embeddedProduct = memberWithProduct.products.find(
        (p) => p._id?.toString() === productId,
      );
      if (embeddedProduct) {
        const newStatus = await this.productsService.determineProductStatus(
          {
            ...embeddedProduct,
            fp_shipment: false,
          },
          tenantName,
          undefined,
          origin,
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
        console.log(`✅ Product updated (Member collection): ${productId}`);
      }
    }
  }

  async findOrCreateShipmentsForBulk(
    products: ProductDocument[],
    tenantId: string,
    session: mongoose.ClientSession,
  ): Promise<ShipmentDocument[]> {
    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantId);
    const ShipmentModel = this.getShipmentModel(connection);

    const createdOrUpdatedShipments: ShipmentDocument[] = [];
    const shipmentCache = new Map<string, ShipmentDocument>();

    const shipmentsToSave: ShipmentDocument[] = [];

    const orderNumberGenerator = await this.initializeOrderNumberGenerator(
      connection,
      session,
    );

    for (const product of products) {
      if (!product._id) continue;

      const assignedEmail = product.assignedEmail || '';
      const assignedMember = product.assignedMember || '';

      const destinationInfo = await this.getLocationInfo(
        product.location || '',
        tenantId,
        assignedEmail,
        assignedMember,
        undefined,
      );

      const desirableDate = destinationInfo.details?.desirableDate || '';
      const destinationName = destinationInfo.name;
      const destinationDetails = destinationInfo.details;

      const shipmentKey = `XX-${destinationName}-${desirableDate}`;

      let shipment: ShipmentDocument | null | undefined =
        shipmentCache.get(shipmentKey);

      if (!shipment) {
        shipment = await ShipmentModel.findOne({
          origin: 'XX',
          destination: destinationName,
          shipment_status: {
            $in: ['In Preparation', 'On Hold - Missing Data'],
          },
          'destinationDetails.desirableDate': desirableDate,
        }).session(session);

        if (!shipment) {
          const destinationComplete =
            await this.productsService.isAddressComplete(
              {
                ...product.toObject(),
                location: product.location,
                assignedEmail,
              },
              tenantId,
            );

          const shipmentStatus = destinationComplete
            ? 'In Preparation'
            : 'On Hold - Missing Data';

          const orderId = this.generateOrderId(
            'XX',
            destinationInfo.code,
            orderNumberGenerator.getNext(),
          );

          shipment = new ShipmentModel({
            order_id: orderId,
            tenant: tenantId,
            quantity_products: 0,
            shipment_status: shipmentStatus,
            shipment_type: 'TBC',
            origin: 'XX',
            destination: destinationName,
            destinationDetails,
            products: [],
            type: 'shipments',
            order_date: new Date(),
            price: { amount: null, currencyCode: 'TBC' },
          });

          shipmentsToSave.push(shipment);
        }

        shipmentCache.set(shipmentKey, shipment);
      }

      if (!(product._id instanceof Types.ObjectId)) {
        throw new Error(`Invalid ObjectId: ${product._id}`);
      }

      const productObjectId = product._id as Types.ObjectId;

      if (
        !shipment.products.some((p: Types.ObjectId) =>
          p.equals(productObjectId),
        )
      ) {
        shipment.products.push(productObjectId);
        shipment.quantity_products = shipment.products.length;
        // await shipment.save({ session });
        if (!shipmentsToSave.includes(shipment)) {
          shipmentsToSave.push(shipment);
        }
      }

      createdOrUpdatedShipments.push(shipment);

      await this.markActiveShipmentTargets(
        product._id.toString(),
        tenantId,
        'XX',
        destinationName,
        assignedEmail,
      );
    }
    for (const shipment of shipmentsToSave) {
      await shipment.save({ session });
    }
    await this.finalizeOrderNumber(
      connection,
      orderNumberGenerator.getCurrent(),
      session,
    );

    return createdOrUpdatedShipments;
  }

  async getShipmentsByMember(memberEmail: string, tenantName: string) {
    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantName);
    const ShipmentModel = this.getShipmentModel(connection);

    const member =
      await this.membersService.findByEmailNotThrowError(memberEmail);
    if (!member) return [];

    const fullName = `${member.firstName} ${member.lastName}`;

    return ShipmentModel.find({
      shipment_status: {
        $in: ['In Preparation', 'On Hold - Missing Data', 'On The Way'],
      },
      $or: [{ origin: fullName }, { destination: fullName }],
    });
  }
}
