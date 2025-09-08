import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import mongoose, { ClientSession, Connection, Model, Types } from 'mongoose';
import { ShipmentDocument, ShipmentSchema } from './schema/shipment.schema';
import { TenantConnectionService } from 'src/infra/db/tenant-connection.service';
import { TenantsService } from 'src/tenants/tenants.service';
import { TenantUserAdapterService } from 'src/common/services/tenant-user-adapter.service';
import { countryCodes } from 'src/shipments/helpers/countryCodes';
import { ProductDocument } from 'src/products/schemas/product.schema';
import {
  ShipmentMetadata,
  ShipmentMetadataSchema,
} from 'src/shipments/schema/shipment-metadata.schema';
import { OrderNumberGenerator } from 'src/shipments/helpers/order-number.util';
import { UpdateShipmentDto } from 'src/shipments/dto/update.shipment.dto';
import { HistoryService } from 'src/history/history.service';
import { recordShipmentHistory } from 'src/shipments/helpers/recordShipmentHistory';
import { CreateShipmentMessageToSlack } from './helpers/create-message-to-slack';
import { SlackService } from '../slack/slack.service';
import { LogisticsService } from 'src/logistics/logistics.sevice';
import { OfficesService } from '../offices/offices.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class ShipmentsService {
  private readonly logger = new Logger(ShipmentsService.name);
  constructor(
    private readonly tenantConnectionService: TenantConnectionService,
    private readonly tenantsService: TenantsService,
    private readonly tenantUserAdapter: TenantUserAdapterService,
    @Inject('SHIPMENT_METADATA_MODEL')
    private readonly shipmentMetadataRepository: Model<ShipmentMetadata>,
    private readonly historyService: HistoryService,
    private readonly slackService: SlackService,
    @Inject(forwardRef(() => LogisticsService))
    private readonly logisticsService: LogisticsService,
    private readonly officesService: OfficesService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Obtiene información del usuario para incluir en mensajes de Slack
   */
  private async getUserInfoFromUserId(userId: string): Promise<
    | {
        userName: string;
        userEmail: string;
        userPhone: string;
      }
    | undefined
  > {
    try {
      const user = await this.usersService.findById(userId);
      if (!user) {
        console.log('⚠️ Usuario no encontrado para Slack:', { userId });
        return undefined;
      }

      return {
        userName:
          `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Usuario',
        userEmail: user.email || '',
        userPhone: user.phone || '',
      };
    } catch (error) {
      console.error('❌ Error obteniendo info de usuario para Slack:', error);
      return undefined;
    }
  }

  public getShipmentModel(tenantConnection): Model<ShipmentDocument> {
    if (tenantConnection.models.Shipment) {
      return tenantConnection.models.Shipment;
    }
    return tenantConnection.model('Shipment', ShipmentSchema);
  }

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

  async findAll(tenantId: string) {
    await new Promise((resolve) => process.nextTick(resolve));

    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantId);
    const ShipmentModel = this.getShipmentModel(connection);

    return await ShipmentModel.find().sort({ createdAt: -1 }).exec();
  }

  async findAllReadOnlyIfExists(tenantId: string) {
    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantId);

    const exists = await connection.db
      .listCollections({ name: 'shipments' }, { nameOnly: true })
      .hasNext();

    if (!exists) return [];

    const docs = await connection.db
      .collection('shipments')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return docs;
  }

  private getCountryCode(country: string): string {
    if (country === 'Our office') {
      return 'OO';
    }

    return countryCodes[country] || 'XX';
  }

  public getLocationCode(
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
      // ✅ Obtener datos de la colección offices en lugar del tenant
      const office = await this.officesService.getDefaultOffice(tenantId);
      if (!office)
        throw new NotFoundException(
          `Default office not found for tenant ${tenantId}`,
        );

      return {
        name: 'Our office',
        code: 'OO',
        details: {
          address: office.address || '',
          apartment: office.apartment || '',
          city: office.city || '',
          state: office.state || '',
          country: office.country || '',
          zipCode: office.zipCode || '',
          phone: office.phone || '',
          email: office.email || '', // ✅ Email de la oficina real
          desirableDate: desirableDate || '',
        },
      };
    }

    if (
      (location === 'Employee' ||
        !['Our office', 'FP warehouse'].includes(location)) &&
      assignedEmail
    ) {
      return this.logisticsService.getMemberLocationInfo(
        tenantId,
        assignedEmail,
        desirableDate,
      );
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

  public async getProductLocationDataFromSnapshots(
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
    providedProduct?: ProductDocument,
    providedConnection?: Connection,
  ): Promise<{
    shipment: ShipmentDocument;
    isConsolidated: boolean;
    oldSnapshot?: Partial<ShipmentDocument>;
  }> {
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

    const {
      origin,
      destination,
      orderOrigin,
      orderDestination,
      originDetails,
      destinationDetails,
      destinationComplete,
      originComplete,
    } = await this.logisticsService.getShipmentPreparationData(
      productId,
      tenantName,
      actionType,
      originDate,
      destinationDate,
      oldData,
      newData,
      providedProduct,
      providedConnection, // ✅ FIX: Pasar la conexión proporcionada
    );

    const shipmentStatus =
      destinationComplete && originComplete
        ? 'In Preparation'
        : 'On Hold - Missing Data';

    // ✅ FIX: Usar la conexión proporcionada si existe (misma que creó la session)
    const connection =
      providedConnection ||
      (await this.tenantConnectionService.getTenantConnection(tenantName));
    const ShipmentModel = this.getShipmentModel(connection);
    const productObjectId = new mongoose.Types.ObjectId(productId);

    const existingShipment = await ShipmentModel.findOne({
      origin,
      destination,
      shipment_status: { $in: ['In Preparation', 'On Hold - Missing Data'] },
      'originDetails.desirableDate': originDetails?.desirableDate || null,
      'destinationDetails.desirableDate':
        destinationDetails?.desirableDate || null,
      isDeleted: { $ne: true },
    }).session(session || null);

    if (existingShipment) {
      if (!existingShipment.products.includes(productObjectId)) {
        const oldSnapshot = JSON.parse(JSON.stringify(existingShipment));
        existingShipment.products.push(productObjectId);
        existingShipment.quantity_products = existingShipment.products.length;

        await existingShipment.save({ session });

        if (existingShipment.shipment_status === 'In Preparation' && session) {
          await this.logisticsService.updateProductStatusToInTransit(
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

    // ✅ FIX: Usar session en create para evitar conflictos de MongoClient
    const newShipmentArray = await ShipmentModel.create(
      [
        {
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
        },
      ],
      { session: session || undefined },
    );

    const newShipment = newShipmentArray[0]; // ✅ FIX: Extraer el primer elemento del array

    const originEmail = oldData?.assignedEmail || '';
    const destinationEmail = newData?.assignedEmail || '';

    if (
      ['In Preparation', 'On The Way', 'On Hold - Missing Data'].includes(
        shipmentStatus,
      )
    ) {
      await this.logisticsService.markActiveShipmentTargets(
        productId,
        tenantName,
        origin,
        destination,
        originEmail,
        destinationEmail,
        session,
        connection, // ✅ FIX: Pasar la misma conexión
      );
    }

    await this.finalizeOrderNumber(
      connection,
      orderNumberGenerator.getCurrent(),
      session ?? undefined,
    );

    // ✅ FIX: Ya no necesitamos save() porque create() ya guardó el documento
    // await newShipment.save();

    if (shipmentStatus === 'In Preparation' && session) {
      await this.logisticsService.updateProductStatusToInTransit(
        productId,
        connection,
        session,
      );
    }

    return { shipment: newShipment, isConsolidated: false };
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

      await this.logisticsService.addProductsAndSnapshotsToShipment(
        consolidable,
        shipment.products,
        tenantName,
      );

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
      if (consolidable.shipment_status === 'In Preparation') {
        // ✅ Obtener información del usuario desde el JWT
        const userInfo = await this.getUserInfoFromUserId(userId);

        const slackMessage = CreateShipmentMessageToSlack({
          shipment: consolidable,
          tenantName,
          isOffboarding: false,
          status: 'Consolidated',
          ourOfficeEmail: ourOfficeEmail,
          deletedShipmentOrderId: shipment.order_id,
          userInfo: userInfo,
        });
        await this.slackService.sendMessage(slackMessage);
      }

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
        await this.logisticsService.isShipmentDetailsComplete(shipment);

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
          await this.logisticsService.updateProductStatusToInTransit(
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
        // ✅ Obtener información del usuario desde el JWT
        const userInfo = await this.getUserInfoFromUserId(userId);

        const missingDataMessage = CreateShipmentMessageToSlack({
          shipment,
          tenantName,
          isOffboarding: false,
          status: 'Missing Data',
          previousShipment: originalShipment,
          ourOfficeEmail: ourOfficeEmail,
          userInfo: userInfo,
        });
        await this.slackService.sendMessage(missingDataMessage);
      } else if (shipment.shipment_status === 'In Preparation') {
        //TODO: Status update
        // ✅ Obtener información del usuario desde el JWT
        const userInfo = await this.getUserInfoFromUserId(userId);

        const slackMessage = CreateShipmentMessageToSlack({
          shipment,
          tenantName,
          isOffboarding: false,
          status: 'Updated',
          previousShipment: originalShipment,
          ourOfficeEmail: ourOfficeEmail,
          userInfo: userInfo,
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

  async cancel(
    shipmentId: string,
    tenantName: string,
  ): Promise<ShipmentDocument> {
    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantName);
    const ShipmentModel = this.getShipmentModel(connection);
    const shipment = await ShipmentModel.findById(shipmentId);

    if (!shipment) {
      throw new NotFoundException(`Shipment ${shipmentId} not found`);
    }

    if (
      shipment.shipment_status !== 'In Preparation' &&
      shipment.shipment_status !== 'On Hold - Missing Data'
    ) {
      throw new BadRequestException(
        `Cannot cancel shipment with status: ${shipment.shipment_status}`,
      );
    }

    shipment.shipment_status = 'Cancelled';
    await shipment.save();

    return shipment;
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

    let products = options?.providedProducts;

    if (!products) {
      const productIds = shipment.products.map(
        (id) => new Types.ObjectId(id.toString()),
      );
      console.log(
        '📦 Intentando buscar productos por ID en getProductsWithContext:',
        productIds.map((p) => p.toString()),
      );
      products = await this.logisticsService.getProductsWithContext(
        productIds,
        connection.name,
      );
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

  public hasSnapshotChanged(oldSnapshot: any, newSnapshot: any): boolean {
    const simpleFieldsToCompare = [
      'status',
      'location',
      'assignedEmail',
      'assignedMember',
      'fp_shipment',
      'productCondition',
      'serialNumber',
      'category',
      'name',
      'additionalInfo',
    ];

    for (const field of simpleFieldsToCompare) {
      const oldValue = oldSnapshot?.[field];
      const newValue = newSnapshot?.[field];
      if (oldValue !== newValue) {
        return true;
      }
    }

    const oldPrice = oldSnapshot?.price || {};
    const newPrice = newSnapshot?.price || {};

    if (
      oldPrice.amount !== newPrice.amount ||
      oldPrice.currencyCode !== newPrice.currencyCode
    ) {
      return true;
    }

    return false;
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
