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
import { TenantConnectionService } from 'src/infra/db/tenant-connection.service';
import { MembersService } from 'src/members/members.service';
import { TenantsService } from 'src/tenants/tenants.service';
import { ProductsService } from 'src/products/products.service';
import { countryCodes } from 'src/shipments/helpers/countryCodes';
import { GlobalConnectionProvider } from 'src/infra/db/global-connection.provider';
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
import { AddressData } from 'src/infra/event-bus/tenant-address-update.event';
import { UpdateShipmentDto } from 'src/shipments/dto/update.shipment.dto';
import { HistoryService } from 'src/history/history.service';
import { recordShipmentHistory } from 'src/shipments/helpers/recordShipmentHistory';
import { CreateShipmentMessageToSlack } from './helpers/create-message-to-slack';
import { SlackService } from '../slack/slack.service';

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
    private readonly historyService: HistoryService,
    private readonly slackService: SlackService,
  ) {}

  async findShipmentPage(
    shipmentId: string,
    size: number,
    tenantId: string,
  ): Promise<{ page: number }> {
    await new Promise((resolve) => process.nextTick(resolve));

    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantId);
    const ShipmentModel = this.getShipmentModel(connection);

    const shipment = await ShipmentModel.findById(shipmentId).exec();
    if (!shipment) {
      throw new NotFoundException(`Shipment with ID ${shipmentId} not found`);
    }

    const position = await ShipmentModel.countDocuments({
      _id: { $gt: shipment._id },
    }).exec();

    const page = Math.floor(position / size) + 1;

    return { page };
  }

  async findAll(page: number, size: number, tenantId: string) {
    await new Promise((resolve) => process.nextTick(resolve));
    const skip = (page - 1) * size;

    const dateFilter: any = {};

    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantId);
    const ShipmentModel = this.getShipmentModel(connection);

    const [data, totalCount] = await Promise.all([
      ShipmentModel.find(dateFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(size)
        .exec(),
      ShipmentModel.countDocuments(dateFilter).exec(),
    ]);

    return {
      data,
      totalCount,
      totalPages: Math.ceil(totalCount / size),
    };
  }

  public getShipmentModel(tenantConnection): Model<ShipmentDocument> {
    if (tenantConnection.models.Shipment) {
      return tenantConnection.models.Shipment;
    }

    return tenantConnection.model('Shipment', ShipmentSchema);
  }

  private getCountryCode(country: string): string {
    if (country === 'Our office') {
      return 'OO';
    }

    return countryCodes[country] || 'XX';
  }

  private getLocationCode(
    locationName: string,
    locationDetails?: Record<string, any>,
  ): string {
    if (locationName === 'FP warehouse') return 'FP';
    if (locationName === 'Our office') return 'OO';

    return locationDetails?.country
      ? this.getCountryCode(locationDetails.country)
      : 'XX';
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
      return {
        name: 'FP warehouse',
        code: 'FP',
        details: {
          desirableDate: desirableDate || '',
        },
      };
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

    if (
      (location === 'Employee' ||
        !['Our office', 'FP warehouse'].includes(location)) &&
      assignedEmail
    ) {
      const connection =
        await this.tenantConnectionService.getTenantConnection(tenantId);

      const MemberModel =
        connection.models.Member ||
        connection.model('Member', MemberSchema, 'members');

      const member = await MemberModel.findOne({
        email: assignedEmail.trim().toLowerCase(),
      });

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
          assignedEmail: member.email,
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

  private generateOrderId(
    orderOrigin: string,
    orderDestination: string,
    orderNumber: number,
  ): string {
    if (!orderOrigin || !orderDestination || orderNumber === undefined) {
      throw new Error('❌ Parámetros inválidos para generar el Order ID');
    }

    const originCode =
      orderOrigin.length === 2
        ? orderOrigin
        : this.getLocationCode(orderOrigin);
    const destinationCode =
      orderDestination.length === 2
        ? orderDestination
        : this.getLocationCode(orderDestination);

    const orderNumberFormatted = orderNumber.toString().padStart(4, '0');
    return `${originCode}${destinationCode}${orderNumberFormatted}`;
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

    return {
      origin: originInfo.name,
      destination: destinationInfo.name,
      orderOrigin: originInfo.code,
      orderDestination: destinationInfo.code,
      originLocation,
      destinationLocation,
    };
  }

  // por el momento lo pongo aca, pero despues solo en assignments

  public async isAddressComplete(
    product: Partial<Product>,
    tenantName: string,
  ): Promise<boolean> {
    if (product.location === 'FP warehouse') {
      return true;
    }

    if (product.location === 'Employee') {
      const member = await this.membersService.findByEmailNotThrowError(
        product.assignedEmail!,
      );
      if (!member) return false;

      return !!(
        member.country &&
        member.city &&
        member.zipCode &&
        member.address &&
        // member.apartment &&
        member.personalEmail &&
        member.phone &&
        member.dni
      );
    }

    if (product.location === 'Our office') {
      const tenant = await this.tenantsService.getByTenantName(tenantName);

      if (!tenant) return false;

      return !!(
        tenant.country &&
        tenant.city &&
        tenant.state &&
        tenant.zipCode &&
        tenant.address &&
        // tenant.apartment &&
        tenant.phone
      );
    }

    return false;
  }

  async findOrCreateShipment(
    productId: string,
    actionType: string,
    tenantName: string,
    userId: string,
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
  ): Promise<{
    shipment: ShipmentDocument;
    isConsolidated: boolean;
    oldSnapshot?: Partial<ShipmentDocument>;
  }> {
    console.log('findorcreateshipment called with userId:', userId);
    if (!userId) {
      throw new Error('❌ User ID is required');
    }
    const originDate =
      desirableOriginDate instanceof Date
        ? desirableOriginDate.toISOString()
        : desirableOriginDate;

    const destinationDate =
      desirableDestinationDate instanceof Date
        ? desirableDestinationDate.toISOString()
        : desirableDestinationDate;

    const found = await this.productsService.findProductById(
      new Types.ObjectId(productId) as unknown as Schema.Types.ObjectId,
      tenantName,
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

    const {
      origin,
      destination,
      orderOrigin,
      orderDestination,
      originLocation,
      destinationLocation,
    } = await this.getProductLocationDataFromSnapshots(
      productId,
      tenantName,
      actionType,
      oldData,
      newData,
      originDate,
      destinationDate,
    );

    const originDetails = ['create', 'bulkCreate'].includes(actionType)
      ? undefined
      : await this.getLocationInfo(
          originLocation,
          tenantName,
          oldData?.assignedEmail || '',
          oldData?.assignedMember || '',
          originDate,
        ).then((res) => res.details);

    const destinationDetails = await this.getLocationInfo(
      destinationLocation,
      tenantName,
      newData?.assignedEmail || '',
      newData?.assignedMember || '',
      destinationDate,
    ).then((res) => res.details);

    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantName);
    const ShipmentModel = this.getShipmentModel(connection);

    const existingShipment = await ShipmentModel.findOne({
      origin,
      destination,
      shipment_status: { $in: ['In Preparation', 'On Hold - Missing Data'] },
      'originDetails.desirableDate': originDetails?.desirableDate || null,
      'destinationDetails.desirableDate':
        destinationDetails?.desirableDate || null,
      isDeleted: { $ne: true },
    }).session(session || null);

    const productObjectId = new mongoose.Types.ObjectId(productId);

    if (existingShipment) {
      if (!existingShipment.products.includes(productObjectId)) {
        const oldSnapshot = JSON.parse(JSON.stringify(existingShipment));
        existingShipment.products.push(productObjectId);
        existingShipment.quantity_products = existingShipment.products.length;

        await existingShipment.save({ session });

        if (existingShipment.shipment_status === 'In Preparation' && session) {
          await this.updateProductStatusToInTransit(
            productId,
            connection,
            session,
          );
        }
        return {
          shipment: existingShipment,
          isConsolidated: true,
          oldSnapshot,
        };
      }
      return { shipment: existingShipment, isConsolidated: true };
    }

    const destinationComplete = await this.isAddressComplete(
      { ...product, location: destinationLocation, assignedEmail },
      tenantName,
    );

    const originComplete = await this.isAddressComplete(
      {
        ...product,
        location: originLocation,
        assignedEmail: oldData?.assignedEmail || '',
      },
      tenantName,
    );

    const shipmentStatus =
      destinationComplete && originComplete
        ? 'In Preparation'
        : 'On Hold - Missing Data';

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

    const newShipment = await ShipmentModel.create({
      order_id,
      tenant: tenantName,
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

    const originEmail = oldData?.assignedEmail || '';
    const destinationEmail = newData?.assignedEmail || '';

    if (
      ['In Preparation', 'On The Way', 'On Hold - Missing Data'].includes(
        shipmentStatus,
      )
    ) {
      await this.markActiveShipmentTargets(
        productId,
        tenantName,
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

    // await this.historyService.create({
    //   actionType: 'create',
    //   itemType: 'shipments',
    //   userId: userId,
    //   changes: {
    //     oldData: null,
    //     newData: newShipment,
    //   },
    // });
    await newShipment.save();
    if (shipmentStatus === 'In Preparation' && session) {
      await this.updateProductStatusToInTransit(productId, connection, session);
    }
    return { shipment: newShipment, isConsolidated: false };
  }

  async getProductByIdIncludingMembers(
    connection: Connection,
    productId: string,
    session?: ClientSession,
  ): Promise<ProductDocument | null> {
    const ProductModel =
      connection.models.Product ||
      connection.model('Product', ProductSchema, 'products');

    const product = await ProductModel.findById(productId).session(
      session || null,
    );
    if (product) return product;

    const MemberModel =
      connection.models.Member ||
      connection.model('Member', MemberSchema, 'members');

    const member = await MemberModel.findOne({
      'products._id': productId,
    }).session(session || null);
    const memberProduct = member?.products?.find(
      (p: any) => p._id.toString() === productId,
    );
    return memberProduct || null;
  }

  async findConsolidateAndUpdateShipment(
    shipmentId: string,
    updateDto: UpdateShipmentDto,
    tenantName: string,
    userId: string,
    ourOfficeEmail: string,
  ): Promise<{
    message: string;
    consolidatedInto?: string;
    shipment: ShipmentDocument;
  }> {
    await new Promise((resolve) => process.nextTick(resolve));
    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantName);
    const ShipmentModel = this.getShipmentModel(connection);

    const shipment = await ShipmentModel.findById(shipmentId);
    if (!shipment || shipment.isDeleted) {
      throw new NotFoundException(
        `Shipment ${shipmentId} not found or deleted.`,
      );
    }

    const originalShipment = { ...shipment.toObject() };
    let wasModified = false;

    const { desirableDateOrigin, desirableDateDestination } = updateDto;

    if (desirableDateOrigin && shipment.originDetails) {
      shipment.originDetails.desirableDate = desirableDateOrigin;
      wasModified = true;
    }

    if (desirableDateDestination && shipment.destinationDetails) {
      shipment.destinationDetails.desirableDate = desirableDateDestination;
      wasModified = true;
    }

    const consolidable = await ShipmentModel.findOne({
      _id: { $ne: shipment._id },
      origin: shipment.origin,
      destination: shipment.destination,
      'originDetails.desirableDate':
        shipment.originDetails?.desirableDate ?? null,
      'destinationDetails.desirableDate':
        shipment.destinationDetails?.desirableDate ?? null,
      shipment_status: { $in: ['In Preparation', 'On Hold - Missing Data'] },
      isDeleted: { $ne: true },
    });

    if (consolidable) {
      const productIds = shipment.products.map((p) => p.toString());
      console.log('🔍 Productos en el shipment a consolidar:', productIds);

      const existingSnapshotIds =
        consolidable.snapshots?.map((s) => s._id.toString()) || [];

      for (const productId of shipment.products) {
        const objectId = new Types.ObjectId(productId);

        if (!consolidable.products.some((p) => p.equals(objectId))) {
          consolidable.products.push(objectId);
        } else {
          console.log(
            `🔁 Producto ${productId} ya estaba en shipment consolidable`,
          );
        }

        const product = await this.getProductByIdIncludingMembers(
          connection,
          productId.toString(),
        );

        if (!product) {
          console.log(
            `⚠️ Producto ${productId} no encontrado ni en products ni en miembros`,
          );
          continue;
        }
        if (!product._id) {
          console.warn(`⚠️ Producto ${productId} no tiene _id, se omite`);
          continue;
        }

        if (!existingSnapshotIds.includes(product._id.toString())) {
          const snapshot = this.buildSnapshot(
            product as ProductDocument & { _id: Types.ObjectId },
          );
          consolidable.snapshots = consolidable.snapshots || [];
          consolidable.snapshots.push(snapshot);
        } else {
          console.log(
            `📸 Snapshot ya existe para producto ${product._id}, no se duplica`,
          );
        }
      }

      consolidable.markModified('snapshots');
      consolidable.quantity_products = consolidable.products.length;
      await consolidable.save();

      shipment.isDeleted = true;
      await shipment.save();

      await recordShipmentHistory(
        this.historyService,
        'consolidate',
        userId,
        originalShipment,
        consolidable.toObject(),
        'shipment-merge',
      );
      // Enviar mensaje a Slack para Consolidated
      const slackMessage = CreateShipmentMessageToSlack({
        shipment: consolidable,
        tenantName,
        isOffboarding: false,
        status: 'Consolidated',
        ourOfficeEmail: ourOfficeEmail,
        deletedShipmentOrderId: shipment.order_id,
      });
      await this.slackService.sendMessage(slackMessage);

      await recordShipmentHistory(
        this.historyService,
        'delete',
        userId,
        originalShipment,
        { ...shipment.toObject(), isDeleted: true },
      );

      return {
        message: `The pickup and/or delivery date has been successfully updated. This product is now consolidated into Shipment ID: ${consolidable.order_id}`,
        consolidatedInto: consolidable._id.toString(),
        shipment: consolidable,
      };
    }
    if (wasModified) {
      const isReady =
        this.areShipmentDetailsComplete(
          shipment.originDetails,
          shipment.origin,
        ) &&
        this.areShipmentDetailsComplete(
          shipment.destinationDetails,
          shipment.destination,
        );

      const oldStatus = shipment.shipment_status;
      shipment.shipment_status = isReady
        ? 'In Preparation'
        : 'On Hold - Missing Data';

      await shipment.save();

      await recordShipmentHistory(
        this.historyService,
        'update',
        userId,
        originalShipment,
        shipment.toObject(),
      );

      if (
        oldStatus !== shipment.shipment_status &&
        shipment.shipment_status === 'In Preparation'
      ) {
        const session = await connection.startSession();
        for (const productId of shipment.products) {
          await this.updateProductStatusToInTransit(
            productId.toString(),
            connection,
            session,
          );
        }
      }

      if (
        oldStatus === 'In Preparation' &&
        shipment.shipment_status === 'On Hold - Missing Data'
      ) {
        // TODO: Si cambio a missing data se envia este mensaje
        const missingDataMessage = CreateShipmentMessageToSlack({
          shipment,
          tenantName,
          isOffboarding: false,
          status: 'Missing Data',
          previousShipment: originalShipment,
          ourOfficeEmail: ourOfficeEmail,
        });
        await this.slackService.sendMessage(missingDataMessage);
      } else {
        //TODO: Status update
        const slackMessage = CreateShipmentMessageToSlack({
          shipment,
          tenantName,
          isOffboarding: false,
          status: 'Updated',
          previousShipment: originalShipment,
          ourOfficeEmail: ourOfficeEmail,
        });
        await this.slackService.sendMessage(slackMessage);
      }

      return {
        message: 'Shipment updated successfully',
        shipment,
      };
    }
    return {
      message: 'No changes were made to the shipment',
      shipment,
    };
  }
  //TODO: Nahue status
  /* aca es el fin del update de un shipment, 
  a esta altura tener el shipment actualizado, por lo que si las fechas cambiaron en un shipment que
  estaba in preparation, calculo que tenes que reenviar el mensaje de slack.
  tambien se consolida un shipment con otro cuando se cambian fechas y coincide con otro.
  Por lo tanto tendras que avisar si el shipment estaba in preparation y ahora se le sumo un nuevo producto
  tambien es donde se borra el shipment que se consolido con el otro */

  buildSnapshot(product: ProductDocument & { _id: Types.ObjectId }) {
    return {
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
    };
  }

  private areShipmentDetailsComplete(
    details?: Record<string, string>,
    locationName?: string,
  ): boolean {
    if (!details) return false;

    if (locationName === 'FP warehouse') return true;

    if (locationName === 'Our office') {
      const requiredFields = [
        'address',
        'city',
        'state',
        'country',
        'zipCode',
        'phone',
      ];
      const result = requiredFields.every((field) => !!details[field]);
      if (!result) {
        console.log('🛑 Origin (Our office) está incompleto:', {
          missing: requiredFields.filter((f) => !details[f]),
          details,
        });
      }
      return result;
    }

    const requiredFields = [
      'address',
      'city',
      'country',
      'zipCode',
      'phone',
      'personalEmail',
      'dni',
    ];
    const result = requiredFields.every((field) => !!details[field]);
    if (!result) {
      console.log('🛑 Destination (Employee) está incompleto:', {
        missing: requiredFields.filter((f) => !details[f]),
        details,
      });
    }
    return result;
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
    userId: string,
    ourOfficeEmail: string,
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

    const originalShipment = { ...shipment.toObject() };

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

    if (!userId) {
      console.warn(
        '⚠️ userId no definido, se omitirá el registro en el historial',
      );
    } else {
      await recordShipmentHistory(
        this.historyService,
        'cancel',
        userId,
        originalShipment,
        shipment.toObject(),
      );
    }

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
          'Cancelled',
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
              // status: embeddedProduct.status,
              assignedEmail: embeddedProduct.assignedEmail,
              productCondition: embeddedProduct.productCondition,
            },
            tenantId,
            undefined,
            'Cancelled',
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

    //TODO: Status cancel
    const slackMessage = CreateShipmentMessageToSlack({
      shipment,
      tenantName: tenantId,
      isOffboarding: false,
      status: 'Cancelled',
      ourOfficeEmail: ourOfficeEmail,
    });
    await this.slackService.sendMessage(slackMessage);

    if (shipment.originDetails?.assignedEmail) {
      await this.clearMemberActiveShipmentFlagIfNoOtherShipments(
        shipment.originDetails.assignedEmail,
        tenantId,
      );
    }

    if (shipment.destinationDetails?.assignedEmail) {
      await this.clearMemberActiveShipmentFlagIfNoOtherShipments(
        shipment.destinationDetails.assignedEmail,
        tenantId,
      );
    }

    //TODO: Nahue status
    /* este es el fin del cancel de un shipment, en este punto vas a tener 
    el shipment cancelado con su status cancel + el status del producti actualizado + los flags de
    active shipment en false para producto o member involucrado */
    return shipment;
  }

  private async markActiveShipmentTargets(
    productId: string,
    tenantName: string,
    origin: string,
    destination: string,
    originEmail?: string,
    destinationEmail?: string,
    session?: ClientSession | null,
  ) {
    console.log('📍 Marking active shipment targets:', {
      origin,
      destination,
      originEmail,
      destinationEmail,
    });

    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantName);

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

      if (!['Our office', 'FP warehouse'].includes(origin) && originEmail) {
        console.log('📤 Marking origin member as active:', originEmail);
        await MemberModel.updateOne(
          { email: originEmail },
          { $set: { activeShipment: true } },
          { session: useSession },
        );
      }

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
    const MemberModel =
      connection.models.Member ||
      connection.model('Member', MemberSchema, 'members');

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
      console.log(
        `✅ Producto actualizado (colección Products): ${product._id}`,
      );
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
            location: 'Employee',
            assignedEmail: embeddedProduct.assignedEmail,
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

        console.log(`✅ Producto actualizado (colección Member): ${productId}`);
      }
    }
  }

  async clearMemberActiveShipmentFlagIfNoOtherShipments(
    memberEmail: string,
    tenantId: string,
  ) {
    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantId);
    const ShipmentModel = connection.model('Shipment');
    if (typeof memberEmail !== 'string') {
      console.warn(
        `❌ Email inválido recibido en clearMemberActiveShipmentFlagIfNoOtherShipments:`,
        memberEmail,
      );
      return;
    }
    const normalizedEmail = memberEmail.trim().toLowerCase();

    const memberStillInvolved = await ShipmentModel.exists({
      shipment_status: {
        $in: ['In Preparation', 'On Hold - Missing Data', 'On The Way'],
      },
      $or: [
        { origin: normalizedEmail },
        { destination: normalizedEmail },
        { 'originDetails.assignedEmail': normalizedEmail },
        { 'destinationDetails.assignedEmail': normalizedEmail },
      ],
      isDeleted: { $ne: true },
    });

    console.log(
      `🔎 Checking active shipments for ${normalizedEmail} => ${
        memberStillInvolved ? 'STILL INVOLVED' : 'CAN BE CLEARED'
      }`,
    );

    if (!memberStillInvolved) {
      const MemberModel = connection.model('Member');

      const result = await MemberModel.updateOne(
        { email: normalizedEmail },
        { $set: { activeShipment: false } },
      );

      if (result.matchedCount === 0) {
        console.warn(
          `⚠️ No se encontró ningún member con email: ${normalizedEmail}`,
        );
      } else if (result.modifiedCount === 0) {
        console.warn(
          `ℹ️ El member con email ${normalizedEmail} ya tenía activeShipment en false`,
        );
      } else {
        console.log(
          `✅ activeShipment flag set to false for ${normalizedEmail}`,
        );
      }
    }
  }

  // async findOrCreateShipmentsForBulk(
  //   products: ProductDocument[],
  //   tenantId: string,
  //   session: mongoose.ClientSession,
  // ): Promise<ShipmentDocument[]> {
  //   const connection =
  //     await this.tenantConnectionService.getTenantConnection(tenantId);
  //   const ShipmentModel = this.getShipmentModel(connection);

  //   const createdOrUpdatedShipments: ShipmentDocument[] = [];
  //   const shipmentCache = new Map<string, ShipmentDocument>();

  //   const shipmentsToSave: ShipmentDocument[] = [];

  //   const orderNumberGenerator = await this.initializeOrderNumberGenerator(
  //     connection,
  //     session,
  //   );

  //   for (const product of products) {
  //     if (!product._id) continue;

  //     const assignedEmail = product.assignedEmail || '';
  //     const assignedMember = product.assignedMember || '';

  //     const destinationInfo = await this.getLocationInfo(
  //       product.location || '',
  //       tenantId,
  //       assignedEmail,
  //       assignedMember,
  //       undefined,
  //     );

  //     const desirableDate = destinationInfo.details?.desirableDate || '';
  //     const destinationName = destinationInfo.name;
  //     const destinationDetails = destinationInfo.details;

  //     const shipmentKey = `XX-${destinationName}-${desirableDate}`;

  //     let shipment: ShipmentDocument | null | undefined =
  //       shipmentCache.get(shipmentKey);

  //     if (!shipment) {
  //       shipment = await ShipmentModel.findOne({
  //         origin: 'XX',
  //         destination: destinationName,
  //         shipment_status: {
  //           $in: ['In Preparation', 'On Hold - Missing Data'],
  //         },
  //         'destinationDetails.desirableDate': desirableDate,
  //       }).session(session);

  //       if (!shipment) {
  //         const destinationComplete =
  //           await this.productsService.isAddressComplete(
  //             {
  //               ...product.toObject(),
  //               location: product.location,
  //               assignedEmail,
  //             },
  //             tenantId,
  //           );

  //         const shipmentStatus = destinationComplete
  //           ? 'In Preparation'
  //           : 'On Hold - Missing Data';

  //         const orderId = this.generateOrderId(
  //           'XX',
  //           destinationInfo.code,
  //           orderNumberGenerator.getNext(),
  //         );

  //         shipment = new ShipmentModel({
  //           order_id: orderId,
  //           tenant: tenantId,
  //           quantity_products: 0,
  //           shipment_status: shipmentStatus,
  //           shipment_type: 'TBC',
  //           origin: 'XX',
  //           destination: destinationName,
  //           destinationDetails,
  //           products: [],
  //           type: 'shipments',
  //           order_date: new Date(),
  //           price: { amount: null, currencyCode: 'TBC' },
  //         });

  //         shipmentsToSave.push(shipment);
  //       }

  //       shipmentCache.set(shipmentKey, shipment);
  //     }

  //     if (!(product._id instanceof Types.ObjectId)) {
  //       throw new Error(`Invalid ObjectId: ${product._id}`);
  //     }

  //     const productObjectId = product._id as Types.ObjectId;

  //     if (
  //       !shipment.products.some((p: Types.ObjectId) =>
  //         p.equals(productObjectId),
  //       )
  //     ) {
  //       shipment.products.push(productObjectId);
  //       shipment.quantity_products = shipment.products.length;
  //       // await shipment.save({ session });
  //       if (!shipmentsToSave.includes(shipment)) {
  //         shipmentsToSave.push(shipment);
  //       }
  //     }

  //     createdOrUpdatedShipments.push(shipment);

  //     await this.markActiveShipmentTargets(
  //       product._id.toString(),
  //       tenantId,
  //       'XX',
  //       destinationName,
  //       '',
  //       assignedEmail,
  //     );
  //   }
  //   for (const shipment of shipmentsToSave) {
  //     await shipment.save({ session });
  //   }
  //   await this.finalizeOrderNumber(
  //     connection,
  //     orderNumberGenerator.getCurrent(),
  //     session,
  //   );

  //   return createdOrUpdatedShipments;
  // }

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

  // async updateShipmentStatusAndProductsToInPreparation(
  //   shipmentId: Types.ObjectId,
  //   tenantName: string,
  // ) {
  //   await new Promise((resolve) => process.nextTick(resolve));
  //   const connection =
  //     await this.tenantConnectionService.getTenantConnection(tenantName);
  //   const ShipmentModel = this.getShipmentModel(connection);
  //   const ProductModel = this.getProductModel(connection);
  //   const MemberModel = connection.model<MemberDocument>('Member');

  //   const shipment = await ShipmentModel.findById(shipmentId);
  //   if (!shipment) {
  //     throw new NotFoundException(`Shipment with id "${shipmentId}" not found`);
  //   }

  //   shipment.shipment_status = 'In Preparation';
  //   await shipment.save();

  //   for (const productId of shipment.products) {
  //     const product = await ProductModel.findById(productId);

  //     if (product) {
  //       if (product.status === 'In Transit - Missing Data') {
  //         product.status = 'In Transit';
  //         await product.save();
  //       }
  //     } else {
  //       const memberWithProduct = await MemberModel.findOne({
  //         'products._id': productId,
  //       });

  //       const embeddedProduct = memberWithProduct?.products.find(
  //         (p) => p._id?.toString() === productId.toString(),
  //       );

  //       if (
  //         embeddedProduct &&
  //         embeddedProduct.status === 'In Transit - Missing Data'
  //       ) {
  //         await MemberModel.updateOne(
  //           { 'products._id': productId },
  //           {
  //             $set: {
  //               'products.$.status': 'In Transit',
  //             },
  //           },
  //         );
  //       }
  //     }
  //   }

  //   return shipment;
  // }

  async checkAndUpdateShipmentsForOurOffice(
    tenantName: string,
    oldAddress: AddressData,
    newAddress: AddressData,
    userId: string,
    ourOfficeEmail: string,
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

        const shipments = await ShipmentModel.find({
          $or: [{ origin: 'Our office' }, { destination: 'Our office' }],
          shipment_status: {
            $in: ['In Preparation', 'On Hold - Missing Data'],
          },
          isDeleted: { $ne: true },
        }).session(session);

        for (const shipment of shipments) {
          let updated = false;

          if (shipment.origin === 'Our office') {
            const desirableDate = shipment.originDetails?.desirableDate || '';

            const updatedOriginDetails = {
              address: newAddress.address || '',
              city: newAddress.city || '',
              state: newAddress.state || '',
              country: newAddress.country || '',
              zipCode: newAddress.zipCode || '',
              apartment: newAddress.apartment || '',
              phone: newAddress.phone || '',
              desirableDate: desirableDate,
            };

            await ShipmentModel.updateOne(
              { _id: shipment._id },
              {
                $set: {
                  'originDetails.address': updatedOriginDetails.address,
                  'originDetails.city': updatedOriginDetails.city,
                  'originDetails.state': updatedOriginDetails.state,
                  'originDetails.country': updatedOriginDetails.country,
                  'originDetails.zipCode': updatedOriginDetails.zipCode,
                  'originDetails.apartment': updatedOriginDetails.apartment,
                  'originDetails.phone': updatedOriginDetails.phone,
                  'originDetails.desirableDate':
                    updatedOriginDetails.desirableDate,
                },
              },
              { session },
            );

            updated = true;
          }

          if (shipment.destination === 'Our office') {
            const desirableDate =
              shipment.destinationDetails?.desirableDate || '';

            const updatedDestinationDetails = {
              address: newAddress.address || '',
              city: newAddress.city || '',
              state: newAddress.state || '',
              country: newAddress.country || '',
              zipCode: newAddress.zipCode || '',
              apartment: newAddress.apartment || '',
              phone: newAddress.phone || '',
              desirableDate: desirableDate,
            };

            await ShipmentModel.updateOne(
              { _id: shipment._id },
              {
                $set: {
                  'destinationDetails.address':
                    updatedDestinationDetails.address,
                  'destinationDetails.city': updatedDestinationDetails.city,
                  'destinationDetails.state': updatedDestinationDetails.state,
                  'destinationDetails.country':
                    updatedDestinationDetails.country,
                  'destinationDetails.zipCode':
                    updatedDestinationDetails.zipCode,
                  'destinationDetails.apartment':
                    updatedDestinationDetails.apartment,
                  'destinationDetails.phone': updatedDestinationDetails.phone,
                  'destinationDetails.desirableDate':
                    updatedDestinationDetails.desirableDate,
                },
              },
              { session },
            );

            updated = true;
          }

          if (updated) {
            const refreshedShipment = await ShipmentModel.findById(
              shipment._id,
            ).session(session);

            if (refreshedShipment) {
              console.log('📋 Refreshed shipment details:', {
                originDetails: refreshedShipment.originDetails,
                destinationDetails: refreshedShipment.destinationDetails,
              });

              await this.updateShipmentStatusOnAddressComplete(
                refreshedShipment,
                connection,
                session,
                userId,
                tenantName,
                ourOfficeEmail,
              );
            }
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
    userId: string,
    ourOfficeEmail: string,
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
          shipment_status: {
            $in: ['In Preparation', 'On Hold - Missing Data'],
          },
        }).session(session);

        this.logger.debug(`Found ${shipments.length} shipments to update`);

        for (const shipment of shipments) {
          let updated = false;

          const memberDetails = {
            address: member.address || '',
            apartment: member.apartment || '',
            city: member.city || '',
            country: member.country || '',
            zipCode: member.zipCode || '',
            phone: member.phone || '',
            personalEmail: member.personalEmail || '',
            assignedEmail: member.email,
            dni: `${member.dni || ''}`,
            contactName: fullName,
          };

          const desirableDateOrigin =
            shipment.originDetails?.desirableDate || '';
          const desirableDateDest =
            shipment.destinationDetails?.desirableDate || '';

          if (shipment.origin === fullName) {
            const updatedShipment = await ShipmentModel.findOneAndUpdate(
              { _id: shipment._id },
              {
                $set: {
                  originDetails: {
                    ...memberDetails,
                    desirableDate: desirableDateOrigin,
                  },
                },
              },
              { session, new: true },
            );

            shipment.originDetails = updatedShipment?.originDetails;
            updated = true;
            this.logger.debug(
              `Updated origin details for shipment ${shipment._id}`,
            );
          }

          if (shipment.destination === fullName) {
            const updatedShipment = await ShipmentModel.findOneAndUpdate(
              { _id: shipment._id },
              {
                $set: {
                  destinationDetails: {
                    ...memberDetails,
                    desirableDate: desirableDateDest,
                  },
                },
              },
              { session, new: true },
            );

            shipment.destinationDetails = updatedShipment?.destinationDetails;
            updated = true;
            this.logger.debug(
              `Updated destination details for shipment ${shipment._id}`,
            );
          }

          if (updated) {
            const refreshedShipment = await ShipmentModel.findById(
              shipment._id,
            ).session(session);
            if (refreshedShipment) {
              await this.updateShipmentOnAddressComplete(
                refreshedShipment,
                connection,
                session,
                userId,
                tenantName,
                ourOfficeEmail,
              );
            }
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

  public async createSnapshots(
    shipment: ShipmentDocument,
    connection: mongoose.Connection,
    options?: {
      providedProducts?: ProductDocument[];
      force?: boolean;
    },
  ) {
    console.log(
      `📸 createSnapshots() called for shipment ${shipment._id} with products:`,
      shipment.products.map((p) => p.toString()),
    );
    const ProductModel =
      connection.models.Product ||
      connection.model('Product', ProductSchema, 'products');

    const MemberModel =
      connection.models.Member ||
      connection.model('Member', MemberSchema, 'members');

    let products = options?.providedProducts;

    if (!products) {
      const productIds = shipment.products.map(
        (id) => new Types.ObjectId(id.toString()),
      );

      products = await ProductModel.find({
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
              const enriched = {
                ...(p.toObject?.() ?? p),
                assignedEmail: member.email,
                assignedMember: `${member.firstName} ${member.lastName}`,
              };
              products!.push(enriched as unknown as ProductDocument);
            }
          });
        });
      }
    }

    shipment.snapshots = shipment.snapshots || [];

    const existingSnapshotMap = new Map(
      shipment.snapshots.map((s) => [s._id.toString(), s]),
    );

    for (const product of products) {
      if (!product._id) continue;
      const idStr = product._id.toString();

      const newSnapshot = this.buildSnapshot(
        product as ProductDocument & { _id: Types.ObjectId },
      );

      const existingSnapshot = existingSnapshotMap.get(idStr);

      if (!existingSnapshot) {
        shipment.snapshots.push(newSnapshot);
      } else {
        const hasChanged = this.hasSnapshotChanged(
          existingSnapshot,
          newSnapshot,
        );
        if (hasChanged) {
          Object.assign(existingSnapshot, newSnapshot);
          console.log(
            `✏️ Snapshot actualizado para producto ${product._id}`,
            newSnapshot,
          );
        } else {
          console.log(
            `🔁 No hay cambios en el snapshot de ${product._id}, se mantiene igual.`,
          );
        }
      }
    }

    await shipment.save();
  }

  async updateSnapshotsForProduct(
    productId: string,
    tenantName: string,
  ): Promise<void> {
    await new Promise((resolve) => process.nextTick(resolve));
    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantName);

    const ProductModel =
      connection.models.Product || connection.model('Product', ProductSchema);
    const MemberModel =
      connection.models.Member || connection.model('Member', MemberSchema);

    const product = await ProductModel.findById(productId);
    let isActiveShipment = false;

    let productData: any = null;

    if (product) {
      isActiveShipment = product.activeShipment === true;
      productData = product;
    } else {
      const member = await MemberModel.findOne({
        'products._id': new Types.ObjectId(productId),
      });
      if (member) {
        const memberProduct = member.products.find(
          (p) => p._id?.toString() === productId,
        );
        if (memberProduct) {
          isActiveShipment = memberProduct.activeShipment === true;
          productData = memberProduct;
        }
      }
    }

    if (!isActiveShipment) {
      console.log(
        `ℹ️ Product ${productId} is not part of an active shipment, skipping snapshot update`,
      );
      return;
    }

    if (!productData) {
      console.log(`❌ Product data not found for ${productId}`);
      return;
    }

    const ShipmentModel =
      connection.models.Shipment ||
      connection.model('Shipment', ShipmentSchema, 'shipments');

    const shipments = await ShipmentModel.find({
      products: new Types.ObjectId(productId),
      shipment_status: { $in: ['On Hold - Missing Data', 'In Preparation'] },
    });

    if (shipments.length === 0) {
      console.log(`ℹ️ No updatable shipments found for product ${productId}`);
      return;
    }

    const updatedSnapshot = {
      _id: productData._id,
      name: productData.name || '',
      category: productData.category || '',
      attributes: productData.attributes || [],
      status: productData.status || 'In Transit',
      recoverable: productData.recoverable || false,
      serialNumber: productData.serialNumber || '',
      assignedEmail: productData.assignedEmail || '',
      assignedMember: productData.assignedMember || '',
      lastAssigned: productData.lastAssigned || '',
      acquisitionDate: productData.acquisitionDate || '',
      location: productData.location || '',
      price: productData.price || { amount: null, currencyCode: 'TBC' },
      additionalInfo: productData.additionalInfo || '',
      productCondition: productData.productCondition || 'Optimal',
      fp_shipment: productData.fp_shipment || false,
    };

    for (const shipment of shipments) {
      const snapshotIndex = shipment.snapshots?.findIndex(
        (s) => s._id.toString() === productId,
      );

      if (snapshotIndex !== undefined && snapshotIndex >= 0) {
        const existingSnapshot = shipment.snapshots[snapshotIndex];
        const hasChanges = this.hasSnapshotChanged(
          existingSnapshot,
          updatedSnapshot,
        );

        if (hasChanges) {
          console.log(
            `✏️ Updating snapshot for ${productId} in shipment ${shipment._id} with:`,
            JSON.stringify(updatedSnapshot, null, 2),
          );
          shipment.snapshots[snapshotIndex] = updatedSnapshot;
          await shipment.save();
        } else {
          console.log(
            `🔁 No snapshot changes for product ${productId} in shipment ${shipment._id}`,
          );
        }
      } else {
        await shipment.populate('snapshots');
        const alreadyExists = shipment.snapshots.some(
          (s) => s._id.toString() === productId,
        );
        if (!alreadyExists) {
          console.log(
            `➕ Pushing new snapshot for product ${productId} in shipment ${shipment._id}`,
          );
          if (!alreadyExists) {
            const snapshotToPush = updatedSnapshot;
            console.log(
              `📦 Pushing NEW snapshot for ${productId} into shipment ${shipment._id}:`,
              JSON.stringify(snapshotToPush, null, 2),
            );
            shipment.snapshots.push(updatedSnapshot);
            await shipment.save();
          }
        } else {
          console.log(
            `⚠️ Snapshot already exists for product ${productId} in shipment ${shipment._id}, skipping push`,
          );
        }
      }
    }
  }

  private hasSnapshotChanged(oldSnapshot: any, newSnapshot: any): boolean {
    const fieldsToCompare = [
      'status',
      'location',
      'assignedEmail',
      'assignedMember',
      'fp_shipment',
      'productCondition',
      'serialNumber',
      'category',
    ];

    return fieldsToCompare.some((key) => oldSnapshot[key] !== newSnapshot[key]);
  }

  private async updateShipmentOnAddressComplete(
    shipment: ShipmentDocument,
    connection: mongoose.Connection,
    session: ClientSession,
    userId: string,
    tenantId: string,
    ourOfficeEmail: string,
  ) {
    try {
      const originalShipment = { ...shipment.toObject() };
      const ShipmentModel = connection.model<ShipmentDocument>('Shipment');

      const freshShipment = await ShipmentModel.findById(shipment._id).session(
        session,
      );
      if (!freshShipment) {
        throw new NotFoundException(`Shipment ${shipment._id} not found`);
      }

      shipment = freshShipment;

      const orderNumber = parseInt(shipment.order_id.slice(-4));

      const originCode = this.getLocationCode(
        shipment.origin,
        shipment.originDetails,
      );
      const destinationCode = this.getLocationCode(
        shipment.destination,
        shipment.destinationDetails,
      );

      const newOrderId = `${originCode}${destinationCode}${orderNumber.toString().padStart(4, '0')}`;

      const hasCodesForOrderId =
        originCode !== 'XX' && destinationCode !== 'XX';

      const originComplete = this.areShipmentDetailsComplete(
        shipment.originDetails,
        shipment.origin,
      );
      const destinationComplete = this.areShipmentDetailsComplete(
        shipment.destinationDetails,
        shipment.destination,
      );

      const isNowComplete = originComplete && destinationComplete;
      const wasInPreparation = shipment.shipment_status === 'In Preparation';

      if (newOrderId !== shipment.order_id && hasCodesForOrderId) {
        await ShipmentModel.updateOne(
          { _id: shipment._id },
          { $set: { order_id: newOrderId } },
          { session },
        );
        shipment.order_id = newOrderId;
      }

      let newStatus = shipment.shipment_status;

      if (
        isNowComplete &&
        shipment.shipment_status === 'On Hold - Missing Data'
      ) {
        newStatus = 'In Preparation';

        for (const productId of shipment.products) {
          await this.updateProductStatusToInTransit(
            productId.toString(),
            connection,
            session,
          );
        }

        await session.commitTransaction();
        await session.startTransaction();

        await this.historyService.create({
          actionType: 'update',
          itemType: 'shipments',
          userId,
          changes: {
            oldData: originalShipment,
            newData: { ...originalShipment, shipment_status: newStatus },
          },
        });

        console.log('📸 Generating product snapshots...');
        await this.createSnapshots(shipment, connection);
      }

      if (wasInPreparation && !isNowComplete) {
        newStatus = 'On Hold - Missing Data';

        const updatedProducts: ProductDocument[] = [];

        for (const productId of shipment.products) {
          const updatedProduct = await this.updateProductStatusToMissingData(
            productId.toString(),
            connection,
            session,
          );
          if (updatedProduct) {
            updatedProducts.push(updatedProduct);
          }
        }

        await this.createSnapshots(shipment, connection, {
          providedProducts: updatedProducts,
          force: true,
        });

        await this.historyService.create({
          actionType: 'update',
          itemType: 'shipments',
          userId,
          changes: {
            oldData: originalShipment,
            newData: { ...originalShipment, shipment_status: newStatus },
          },
        });
      }

      if (newStatus !== shipment.shipment_status) {
        await ShipmentModel.updateOne(
          { _id: shipment._id },
          {
            $set: {
              shipment_status: newStatus,
              snapshots: shipment.snapshots,
            },
          },
          { session },
        );
      }

      // TODO: Status On Hold - Missing Data
      if (
        newStatus === 'In Preparation' &&
        isNowComplete &&
        !wasInPreparation
      ) {
        const slackMessage = CreateShipmentMessageToSlack({
          shipment: shipment,
          tenantName: tenantId,
          isOffboarding: false,
          status: 'Updated',
          previousShipment: originalShipment,
          ourOfficeEmail: ourOfficeEmail,
        });
        await this.slackService.sendMessage(slackMessage);
      }

      if (
        newStatus === 'On Hold - Missing Data' &&
        wasInPreparation &&
        !isNowComplete
      ) {
        const slackMessage = CreateShipmentMessageToSlack({
          shipment: shipment,
          tenantName: tenantId,
          isOffboarding: false,
          status: 'Missing Data',
          ourOfficeEmail: ourOfficeEmail,
        });
        await this.slackService.sendMessage(slackMessage);
      }

      console.log('📋 Final shipment status:', newStatus);
      return newStatus;
    } catch (error) {
      console.error('❌ Error updating shipment:', error);
      throw error;
    }
  }

  private async updateProductStatusToMissingData(
    productId: string,
    connection: mongoose.Connection,
    session: ClientSession,
  ): Promise<ProductDocument | null> {
    const ProductModel =
      connection.models.Product || connection.model('Product', ProductSchema);

    const MemberModel =
      connection.models.Member || connection.model('Member', MemberSchema);

    const product = await ProductModel.findById(productId).session(session);

    if (product && product.status === 'In Transit') {
      product.status = 'In Transit - Missing Data';
      await product.save({ session });
      return product;
    }

    const updateResult = await MemberModel.updateOne(
      {
        'products._id': new Types.ObjectId(productId),
        'products.status': 'In Transit',
      },
      {
        $set: { 'products.$.status': 'In Transit - Missing Data' },
      },
      { session },
    );

    if (updateResult.modifiedCount > 0) {
      const member = await MemberModel.findOne({
        'products._id': new Types.ObjectId(productId),
      }).session(session);

      const foundProduct = member?.products.find((p) =>
        p._id.equals(productId),
      );

      if (foundProduct) {
        const original = { ...(foundProduct.toObject?.() ?? foundProduct) };

        const enrichedProduct = {
          ...original,
          status: 'In Transit - Missing Data',
          assignedEmail: member.email,
          assignedMember: `${member.firstName} ${member.lastName}`,
        };

        return enrichedProduct as ProductDocument;
      }
    }

    return null;
  }

  private async updateShipmentStatusOnAddressComplete(
    shipment: ShipmentDocument,
    connection: mongoose.Connection,
    session: ClientSession,
    userId: string,
    tenantName: string,
    ourOfficeEmail: string,
  ) {
    try {
      const ShipmentModel = connection.model<ShipmentDocument>('Shipment');

      const orderNumber = parseInt(shipment.order_id.slice(-4));
      const originCode = this.getLocationCode(
        shipment.origin,
        shipment.originDetails,
      );
      const destinationCode = this.getLocationCode(
        shipment.destination,
        shipment.destinationDetails,
      );
      const originalShipment = { ...shipment.toObject() };
      const newOrderId = `${originCode}${destinationCode}${orderNumber.toString().padStart(4, '0')}`;

      if (
        newOrderId !== shipment.order_id &&
        originCode !== 'XX' &&
        destinationCode !== 'XX'
      ) {
        await ShipmentModel.updateOne(
          { _id: shipment._id },
          { $set: { order_id: newOrderId } },
          { session },
        );
      }

      const originComplete = this.areShipmentDetailsComplete(
        shipment.originDetails,
        shipment.origin,
      );
      const destinationComplete = this.areShipmentDetailsComplete(
        shipment.destinationDetails,
        shipment.destination,
      );
      const wasInPreparation = shipment.shipment_status === 'In Preparation';
      const isNowComplete = originComplete && destinationComplete;

      let newStatus = shipment.shipment_status;

      if (
        shipment.shipment_status === 'On Hold - Missing Data' &&
        isNowComplete
      ) {
        newStatus = 'In Preparation';

        const updatedProducts: ProductDocument[] = [];

        for (const productId of shipment.products) {
          await this.updateProductStatusToInTransit(
            productId.toString(),
            connection,
            session,
          );

          const product = await this.getProductByIdIncludingMembers(
            connection,
            productId.toString(),
            session,
          );

          if (product) {
            updatedProducts.push(product);
          }
        }

        console.log('📸 Generating upgraded product snapshots...');
        await this.createSnapshots(shipment, connection, {
          providedProducts: updatedProducts,
          force: true,
        });
      }

      if (wasInPreparation && !isNowComplete) {
        newStatus = 'On Hold - Missing Data';

        const updatedProducts: ProductDocument[] = [];

        for (const productId of shipment.products) {
          const updatedProduct = await this.updateProductStatusToMissingData(
            productId.toString(),
            connection,
            session,
          );
          if (updatedProduct) {
            updatedProducts.push(updatedProduct);
          }
        }

        console.log('📸 Generating downgrade product snapshots...');
        await this.createSnapshots(shipment, connection, {
          providedProducts: updatedProducts,
          force: true,
        });
      }

      if (newStatus !== shipment.shipment_status) {
        await ShipmentModel.updateOne(
          { _id: shipment._id },
          {
            $set: {
              shipment_status: newStatus,
              snapshots: shipment.snapshots,
            },
          },
          { session },
        );
        await this.historyService.create({
          actionType: 'update',
          itemType: 'shipments',
          userId,
          changes: {
            oldData: originalShipment,
            newData: {
              ...originalShipment,
              shipment_status: newStatus,
              order_id: newOrderId,
              snapshots: shipment.snapshots,
            },
          },
        });
      }

      // TODO: Status On Hold - Missing Data
      if (
        newStatus === 'On Hold - Missing Data' &&
        shipment.shipment_status !== 'On Hold - Missing Data'
      ) {
        const slackMessage = CreateShipmentMessageToSlack({
          shipment: shipment,
          tenantName: tenantName,
          isOffboarding: false,
          status: 'Missing Data',
          ourOfficeEmail: ourOfficeEmail,
        });
        await this.slackService.sendMessage(slackMessage);
      }

      if (
        newStatus === 'In Preparation' &&
        shipment.shipment_status !== 'In Preparation'
      ) {
        const slackMessage = CreateShipmentMessageToSlack({
          shipment: shipment,
          tenantName: tenantName,
          isOffboarding: false,
          status: 'Updated',
          previousShipment: originalShipment,
          ourOfficeEmail: ourOfficeEmail,
        });
        await this.slackService.sendMessage(slackMessage);
      }

      console.log('📋 Final shipment status:', newStatus);
      return newStatus;
    } catch (error) {
      console.error(
        '❌ Error in updateShipmentStatusOnAddressComplete:',
        error,
      );
      throw error;
    }
  }

  private async updateProductStatusToInTransit(
    productId: string,
    connection: mongoose.Connection,
    session: ClientSession,
  ): Promise<void> {
    try {
      const ProductModel =
        connection.models.Product || connection.model('Product', ProductSchema);

      const MemberModel =
        connection.models.Member || connection.model('Member', MemberSchema);

      const product = await ProductModel.findById(productId).session(session);

      if (product) {
        if (product.status === 'In Transit - Missing Data') {
          product.status = 'In Transit';
          await product.save({ session });
        }
        return;
      }

      const updateResult = await MemberModel.updateOne(
        {
          'products._id': new Types.ObjectId(productId),
          'products.status': 'In Transit - Missing Data',
        },
        {
          $set: { 'products.$.status': 'In Transit' },
        },
        { session },
      );

      if (updateResult.modifiedCount > 0) {
        console.log(
          `✅ Updated product status in Member collection: ${productId}`,
        );
      } else {
        console.log(
          `ℹ️ Product ${productId} status was not 'In Transit - Missing Data' or not found`,
        );
      }
    } catch (error) {
      console.error(`❌ Error updating product ${productId} status:`, error);
      throw error;
    }
  }

  async getShipmentByProductId(
    productId: string,
    tenantName: string,
  ): Promise<ShipmentDocument | null> {
    await new Promise((resolve) => process.nextTick(resolve));
    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantName);
    const ShipmentModel = this.getShipmentModel(connection);

    const shipment = await ShipmentModel.findOne({
      products: new Types.ObjectId(productId),
      shipment_status: {
        $in: ['In Preparation', 'On Hold - Missing Data', 'On The Way'],
      },
      isDeleted: { $ne: true },
    }).sort({ createdAt: -1 });

    return shipment;
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

  async getShipmentsByMemberEmail(
    memberEmail: string,
    tenantName: string,
    activeOnly: boolean = true,
  ): Promise<ShipmentDocument[]> {
    await new Promise((resolve) => process.nextTick(resolve));
    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantName);
    const ShipmentModel = this.getShipmentModel(connection);

    // Intentamos encontrar al miembro para obtener su nombre completo
    const member =
      await this.membersService.findByEmailNotThrowError(memberEmail);
    let fullName = '';

    if (member) {
      fullName = `${member.firstName} ${member.lastName}`;
    }

    // Construimos la consulta
    const query: any = {
      $or: [
        { 'originDetails.assignedEmail': memberEmail },
        { 'destinationDetails.assignedEmail': memberEmail },
      ],
      isDeleted: { $ne: true },
    };

    // Si encontramos al miembro, también buscamos por su nombre completo
    if (fullName) {
      query.$or.push({ origin: fullName });
      query.$or.push({ destination: fullName });
    }

    if (activeOnly) {
      query.shipment_status = {
        $in: ['In Preparation', 'On Hold - Missing Data', 'On The Way'],
      };
    }

    console.log(
      'Buscando shipments con query:',
      JSON.stringify(query, null, 2),
    );

    return ShipmentModel.find(query).sort({ createdAt: -1 });
  }
}
