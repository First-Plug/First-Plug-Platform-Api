import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
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
import { AddressData } from 'src/common/events/tenant-address-update.event';

// interface SoftDeleteModel<T> extends Model<T> {
//   softDelete(filter: any, options?: any): Promise<any>;
// }

@Injectable()
export class ShipmentsService {
  private readonly logger = new Logger(ShipmentsService.name);
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
  ) {}

  private getShipmentModel(tenantConnection): Model<ShipmentDocument> {
    if (tenantConnection.models.Shipment) {
      return tenantConnection.models.Shipment;
    }

    return tenantConnection.model('Shipment', ShipmentSchema);
  }

  private getCountryCode(country: string): string {
    // Special case for 'Our office'
    if (country === 'Our office') {
      return 'OO';
    }

    return countryCodes[country] || 'XX';
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
    const countryCode = this.getCountryCode(location);
    if (countryCode !== 'XX') {
      return {
        name: location,
        code: countryCode,
        details: {
          country: location,
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

  // private async getProductLocationData(
  //   productId: string,
  //   tenantId: string,
  //   actionType: string,
  //   desirableOriginDate?: string,
  //   desirableDestinationDate?: string,
  // ) {
  //   const found = await this.productsService.findProductById(productId);
  //   if (!found || !found.product) {
  //     throw new NotFoundException(`Product with ID ${productId} not found`);
  //   }

  //   const product = found.product;
  //   const assignedEmail = found.member?.email || product.assignedEmail || '';
  //   const assignedMember = found.member
  //     ? `${found.member.firstName} ${found.member.lastName}`
  //     : product.assignedMember || '';

  //   const originInfo = await this.getLocationInfo(
  //     product.location || '',
  //     tenantId,
  //     assignedEmail,
  //     assignedMember,
  //     desirableOriginDate,
  //   );

  //   const destinationInfo = await this.getLocationInfo(
  //     assignedMember ? 'Employee' : product.location || '',
  //     tenantId,
  //     assignedEmail,
  //     assignedMember,
  //     desirableDestinationDate,
  //   );

  //   return {
  //     product,
  //     origin: originInfo.name,
  //     destination: destinationInfo.name,
  //     orderOrigin: originInfo.code,
  //     orderDestination: destinationInfo.code,
  //     assignedEmail: assignedEmail || '',
  //     originLocation: product.location || '',
  //     destinationLocation: assignedMember ? 'Employee' : product.location || '',
  //   };
  // }

  private generateOrderId(
    orderOrigin: string,
    orderDestination: string,
    orderNumber: number,
  ): string {
    if (!orderOrigin || !orderDestination || orderNumber === undefined) {
      throw new Error('❌ Parámetros inválidos para generar el Order ID');
    }

    // If the input is already a country code (2 letters), use it directly
    const originCode =
      orderOrigin.length === 2
        ? orderOrigin
        : orderOrigin === 'Our office'
          ? 'OO'
          : this.getCountryCode(orderOrigin);

    const destinationCode =
      orderDestination.length === 2
        ? orderDestination
        : orderDestination === 'Our office'
          ? 'OO'
          : this.getCountryCode(orderDestination);

    const orderNumberFormatted = orderNumber.toString().padStart(4, '0');
    return `${originCode}${destinationCode}${orderNumberFormatted}`;
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

  private async getProductLocationDataFromSnapshots(
    productId: string,
    tenantId: string,
    actionType: string,
    oldData?: {
      location?: string;
      assignedEmail?: string;
      assignedMember?: string;
    },
    newData?: {
      location?: string;
      assignedEmail?: string;
      assignedMember?: string;
    },
    desirableOriginDate?: string,
    desirableDestinationDate?: string,
  ) {
    const originLocation = oldData?.location || 'Employee';
    const destinationLocation = newData?.location || 'Employee';

    const originInfo = await this.getLocationInfo(
      originLocation,
      tenantId,
      oldData?.assignedEmail || '',
      oldData?.assignedMember || '',
      desirableOriginDate,
    );

    const destinationInfo = await this.getLocationInfo(
      destinationLocation,
      tenantId,
      newData?.assignedEmail || '',
      newData?.assignedMember || '',
      desirableDestinationDate,
    );
    console.log('📍 Location Info Details:', {
      originInfo,
      destinationInfo,
    });

    return {
      origin: originInfo.name,
      destination: destinationInfo.name,
      orderOrigin: originInfo.code,
      orderDestination: destinationInfo.code,
      originLocation,
      destinationLocation,
    };
  }

  async findOrCreateShipment(
    productId: string,
    actionType: string,
    tenantId: string,
    session?: ClientSession | null,
    desirableDestinationDate?: string | Date,
    desirableOriginDate?: string | Date,
    oldData?: {
      location?: string;
      assignedEmail?: string;
      assignedMember?: string;
    },
    newData?: {
      location?: string;
      assignedEmail?: string;
      assignedMember?: string;
    },
  ): Promise<ShipmentDocument> {
    // Convert dates to strings if they are Date objects
    const originDate =
      desirableOriginDate instanceof Date
        ? desirableOriginDate.toISOString()
        : desirableOriginDate;

    const destinationDate =
      desirableDestinationDate instanceof Date
        ? desirableDestinationDate.toISOString()
        : desirableDestinationDate;

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
    const assignedEmail =
      newData?.assignedEmail ||
      found.member?.email ||
      product.assignedEmail ||
      '';

    console.log('📦 Producto encontrado:', { assignedEmail });

    const {
      origin,
      destination,
      orderOrigin,
      orderDestination,
      originLocation,
      destinationLocation,
    } = await this.getProductLocationDataFromSnapshots(
      productId,
      tenantId,
      actionType,
      oldData,
      newData,
      originDate,
      destinationDate,
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
          oldData?.assignedEmail || '',
          oldData?.assignedMember || '',
          originDate,
        ).then((res) => res.details);

    console.log('📄 originDetails:', originDetails);

    const destinationDetails = await this.getLocationInfo(
      destinationLocation,
      tenantId,
      newData?.assignedEmail || '',
      newData?.assignedMember || '',
      destinationDate,
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
    }).session(session || null);

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
    const originEmail = oldData?.assignedEmail || '';
    const destinationEmail = newData?.assignedEmail || '';

    // Modified condition to include 'On Hold - Missing Data'
    if (
      ['In Preparation', 'On The Way', 'On Hold - Missing Data'].includes(
        shipmentStatus,
      )
    ) {
      console.log('🚢 Creating shipment with emails:', {
        originEmail,
        destinationEmail,
        origin,
        destination,
      });

      await this.markActiveShipmentTargets(
        productId,
        tenantId,
        origin,
        destination,
        originEmail,
        destinationEmail,
        session,
      );
    }
    await this.finalizeOrderNumber(
      connection,
      orderNumberGenerator.getCurrent(),
      session ?? undefined,
    );
    console.log('✅ Orden finalizada correctamente');

    // Determine and update product status using the service method
    const productStatus = await this.productsService.determineProductStatus(
      {
        fp_shipment: true,
        location: destinationLocation,
        assignedEmail: newData?.assignedEmail || '',
        productCondition: product.productCondition,
      },
      tenantId,
      actionType,
      origin,
    );

    const ProductModel = this.getProductModel(connection);
    const productInProducts = await ProductModel.findById(productId).session(
      session || null,
    );

    if (productInProducts) {
      productInProducts.status = productStatus;
      await productInProducts.save({ session: session ?? undefined });
    } else {
      const MemberModel =
        connection.models.Member ||
        connection.model('Member', MemberSchema, 'members');

      await MemberModel.updateOne(
        { 'products._id': productId },
        {
          $set: {
            'products.$.status': productStatus,
          },
        },
        { session: session ?? undefined },
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
    originEmail?: string,
    destinationEmail?: string,
    session?: ClientSession | null, // Modified to accept null
  ) {
    console.log('📍 Marking active shipment targets:', {
      origin,
      destination,
      originEmail,
      destinationEmail,
    });

    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantName);

    // Start a new session if one wasn't provided or is null
    const useSession = session || (await connection.startSession());
    const isNewSession = !session;

    try {
      if (isNewSession) {
        useSession.startTransaction();
      }

      const ProductModel = connection.model<ProductDocument>(
        'Product',
        ProductSchema,
      );
      const MemberModel = connection.model<MemberDocument>(
        'Member',
        MemberSchema,
      );

      // Mark product as having active shipment
      const updatedProduct = await ProductModel.findByIdAndUpdate(
        productId,
        { activeShipment: true },
        { session: useSession },
      );

      if (!updatedProduct) {
        await MemberModel.updateOne(
          { 'products._id': productId },
          { $set: { 'products.$.activeShipment': true } },
          { session: useSession },
        );
      }

      // Handle origin member
      if (!['Our office', 'FP warehouse'].includes(origin) && originEmail) {
        console.log('📤 Marking origin member as active:', originEmail);
        await MemberModel.updateOne(
          { email: originEmail },
          { $set: { activeShipment: true } },
          { session: useSession },
        );
      }

      // Handle destination member
      if (
        !['Our office', 'FP warehouse'].includes(destination) &&
        destinationEmail
      ) {
        console.log(
          '📥 Marking destination member as active:',
          destinationEmail,
        );
        await MemberModel.updateOne(
          { email: destinationEmail },
          { $set: { activeShipment: true } },
          { session: useSession },
        );
      }

      if (isNewSession) {
        await useSession.commitTransaction();
      }
    } catch (error) {
      if (isNewSession) {
        await useSession.abortTransaction();
      }
      throw error;
    } finally {
      if (isNewSession) {
        useSession.endSession();
      }
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
        '',
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

  async getShipments(tenantName: string) {
    await new Promise((resolve) => process.nextTick(resolve));
    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantName);
    const ShipmentModel = this.getShipmentModel(connection);

    return ShipmentModel.find({ isDeleted: false }).sort({ createdAt: -1 });
  }

  async getShipmentById(id: Types.ObjectId, tenantName: string) {
    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantName);
    const ShipmentModel = this.getShipmentModel(connection);

    const shipment = await ShipmentModel.findOne({ _id: id, isDeleted: false });

    if (!shipment) {
      throw new NotFoundException(`Shipment with id "${id}" not found`);
    }

    return shipment;
  }

  // async softDeleteShipment(id: Types.ObjectId, tenantName: string) {
  //   const connection =
  //     await this.tenantConnectionService.getTenantConnection(tenantName);
  //   const ShipmentModel = this.getShipmentModel(connection);

  //   const shipment = await ShipmentModel.findById(id);
  //   if (!shipment) {
  //     throw new NotFoundException(`Shipment with id "${id}" not found`);
  //   }

  //   await ShipmentModel.softDelete({ _id: id });

  //   return {
  //     message: `Shipment with id "${id}" was soft deleted successfully`,
  //   };
  // }

  async updateShipmentStatusAndProductsToInPreparation(
    shipmentId: Types.ObjectId,
    tenantName: string,
  ) {
    await new Promise((resolve) => process.nextTick(resolve));
    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantName);
    const ShipmentModel = this.getShipmentModel(connection);
    const ProductModel = this.getProductModel(connection);
    const MemberModel = connection.model<MemberDocument>('Member');

    const shipment = await ShipmentModel.findById(shipmentId);
    if (!shipment) {
      throw new NotFoundException(`Shipment with id "${shipmentId}" not found`);
    }

    shipment.shipment_status = 'In Preparation';
    await shipment.save();

    for (const productId of shipment.products) {
      const product = await ProductModel.findById(productId);

      if (product) {
        if (product.status === 'In Transit - Missing Data') {
          product.status = 'In Transit';
          await product.save();
        }
      } else {
        const memberWithProduct = await MemberModel.findOne({
          'products._id': productId,
        });

        const embeddedProduct = memberWithProduct?.products.find(
          (p) => p._id?.toString() === productId.toString(),
        );

        if (
          embeddedProduct &&
          embeddedProduct.status === 'In Transit - Missing Data'
        ) {
          await MemberModel.updateOne(
            { 'products._id': productId },
            {
              $set: {
                'products.$.status': 'In Transit',
              },
            },
          );
        }
      }
    }

    return shipment;
  }

  async checkAndUpdateShipmentsForOurOffice(
    tenantName: string,
    oldAddress: AddressData,
    newAddress: AddressData,
  ) {
    console.log('🔄 Starting office address update:', {
      tenantName,
      oldAddress,
      newAddress,
    });
    await new Promise((resolve) => process.nextTick(resolve));
    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantName);

    const session = await connection.startSession();

    try {
      await session.withTransaction(async () => {
        const ShipmentModel = connection.model(
          'Shipment',
          ShipmentSchema,
          'shipments',
        );

        // const ProductModel = this.getProductModel(connection);
        // const MemberModel = connection.model('Member', MemberSchema, 'members');

        console.log('🔍 Searching for shipments with Our office');

        const shipments = await ShipmentModel.find({
          $or: [{ origin: 'Our office' }, { destination: 'Our office' }],
          shipment_status: {
            $in: ['In Preparation', 'On Hold - Missing Data'],
          },
          isDeleted: { $ne: true },
        }).session(session);

        console.log(`📦 Found ${shipments.length} shipments for Our office`);

        for (const shipment of shipments) {
          let updated = false;

          if (shipment.origin === 'Our office') {
            shipment.originDetails = {
              ...(shipment.originDetails || {}),
              ...newAddress,
            };
            updated = true;
          }

          if (shipment.destination === 'Our office') {
            shipment.destinationDetails = {
              ...(shipment.destinationDetails || {}),
              ...newAddress,
            };
            updated = true;
          }

          if (updated) {
            // Update status based on address completion
            await this.updateShipmentOnAddressComplete(
              shipment,
              connection,
              session,
            );

            console.log(`✅ Updated shipment ${shipment._id}`);
          }
        }
      });

      console.log('✨ Completed office address update');
    } catch (error) {
      console.error('❌ Failed to update office shipments:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async checkAndUpdateShipmentsForMember(
    memberEmail: string,
    tenantName: string,
  ) {
    await new Promise((resolve) => process.nextTick(resolve));
    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantName);

    const session = await connection.startSession();
    try {
      await session.withTransaction(async () => {
        const ShipmentModel = connection.model<ShipmentDocument>(
          'Shipment',
          ShipmentSchema,
          'shipments',
        );

        const member =
          await this.membersService.findByEmailNotThrowError(memberEmail);
        if (!member) {
          this.logger.error(`Member ${memberEmail} not found`);
          return;
        }

        const fullName = `${member.firstName} ${member.lastName}`;
        this.logger.debug(`Searching shipments for member: ${fullName}`);

        const shipments = await ShipmentModel.find({
          $or: [{ origin: fullName }, { destination: fullName }],
        }).session(session);

        this.logger.debug(`Found ${shipments.length} shipments to update`);

        for (const shipment of shipments) {
          let updated = false;

          if (shipment.origin === fullName) {
            shipment.originDetails = {
              address: member.address || '',
              apartment: member.apartment || '',
              city: member.city || '',
              country: member.country || '',
              zipCode: member.zipCode || '',
              phone: member.phone || '',
              personalEmail: member.personalEmail || '',
              dni: `${member.dni || ''}`,
            };
            updated = true;
          }

          if (shipment.destination === fullName) {
            shipment.destinationDetails = {
              address: member.address || '',
              apartment: member.apartment || '',
              city: member.city || '',
              country: member.country || '',
              zipCode: member.zipCode || '',
              phone: member.phone || '',
              personalEmail: member.personalEmail || '',
              dni: `${member.dni || ''}`,
            };
            updated = true;
          }

          if (updated) {
            await this.updateShipmentOnAddressComplete(
              shipment,
              connection,
              session,
            );
          }
        }
      });
    } catch (error) {
      this.logger.error('Error updating shipments for member:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  private async createSnapshots(
    shipment: ShipmentDocument,
    connection: mongoose.Connection,
  ) {
    const ProductModel =
      connection.models.Product ||
      connection.model('Product', ProductSchema, 'products');

    const MemberModel =
      connection.models.Member ||
      connection.model('Member', MemberSchema, 'members');

    const productIds = shipment.products.map(
      (id) => new Types.ObjectId(id.toString()),
    );

    const products: ProductDocument[] = await ProductModel.find({
      _id: { $in: productIds },
    });

    if (products.length < productIds.length) {
      const foundIds = new Set(products.map((p) => p._id?.toString()));
      const remainingIds = productIds.filter(
        (id) => !foundIds.has(id.toString()),
      );

      const members = await MemberModel.find({
        'products._id': { $in: remainingIds },
      });

      members.forEach((member) => {
        member.products.forEach((p) => {
          if (p._id && remainingIds.some((id) => id.equals(p._id))) {
            products.push(p as unknown as ProductDocument);
          }
        });
      });
    }

    shipment.snapshots = products
      .filter((p): p is ProductDocument & { _id: Types.ObjectId } => !!p._id)
      .map((product) => ({
        _id: product._id,
        name: product.name,
        category: product.category,
        attributes: product.attributes,
        status: 'In Transit',
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

  private async updateShipmentOnAddressComplete(
    shipment: ShipmentDocument,
    connection: mongoose.Connection,
    session: ClientSession,
  ) {
    try {
      console.log('🔍 Detailed shipment check:', {
        id: shipment._id,
        origin: shipment.origin,
        originDetails: shipment.originDetails,
        destination: shipment.destination,
        destinationDetails: shipment.destinationDetails,
        currentOrderId: shipment.order_id,
      });

      await this.createSnapshots(shipment, connection);

      const hasRequiredOriginFields =
        shipment.origin === 'FP warehouse'
          ? true
          : !!(
              shipment.originDetails &&
              shipment.originDetails.address &&
              shipment.originDetails.city &&
              shipment.originDetails.country &&
              shipment.originDetails.zipCode
            );

      const hasRequiredDestinationFields = !!(
        shipment.destinationDetails &&
        shipment.destinationDetails.address &&
        shipment.destinationDetails.city &&
        shipment.destinationDetails.country &&
        shipment.destinationDetails.zipCode
      );

      if (hasRequiredOriginFields && hasRequiredDestinationFields) {
        console.log(
          '✅ Both addresses are complete, updating status to In Preparation',
        );
        shipment.shipment_status = 'In Preparation';

        // Get country codes and update order_id
        const originCode =
          shipment.origin === 'FP warehouse'
            ? 'FP'
            : shipment.origin === 'Our office'
              ? 'OO'
              : this.getCountryCode(shipment.originDetails?.country || '');

        const destinationCode =
          shipment.destination === 'Our office'
            ? 'OO'
            : this.getCountryCode(shipment.destinationDetails?.country || '');

        const orderNumber = parseInt(shipment.order_id.slice(-4));
        const newOrderId = `${originCode}${destinationCode}${orderNumber.toString().padStart(4, '0')}`;

        console.log('📝 Updating order ID:', {
          oldOrderId: shipment.order_id,
          newOrderId,
          origin: shipment.origin,
          destination: shipment.destination,
          originCode,
          destinationCode,
          destinationCountry: shipment.destinationDetails?.country,
        });

        shipment.order_id = newOrderId;

        const ProductModel = this.getProductModel(connection);
        const MemberModel = connection.model<MemberDocument>('Member');

        for (const productId of shipment.products) {
          const product =
            await ProductModel.findById(productId).session(session);

          if (product) {
            product.status = 'In Transit';
            await product.save({ session });
            console.log(
              `✅ Updated product status in Products collection: ${productId}`,
            );
          } else {
            const memberWithProduct = await MemberModel.findOne(
              { 'products._id': productId },
              null,
              { session },
            );

            if (memberWithProduct) {
              await MemberModel.updateOne(
                { 'products._id': productId },
                { $set: { 'products.$.status': 'In Transit' } },
                { session },
              );
              console.log(
                `✅ Updated product status in Member collection: ${productId}`,
              );
            } else {
              console.log(
                `⚠️ Product ${productId} not found in either collection`,
              );
            }
          }
        }
      } else {
        console.log(
          '⚠️ Missing required address fields, keeping status as On Hold - Missing Data',
        );
        shipment.shipment_status = 'On Hold - Missing Data';
      }

      await shipment.save({ session });
      console.log(
        '💾 Saved shipment with status:',
        shipment.shipment_status,
        'and order_id:',
        shipment.order_id,
      );

      return shipment;
    } catch (error) {
      console.error('❌ Error in updateShipmentOnAddressComplete:', error);
      throw error;
    }
  }
}
