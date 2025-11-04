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
import { CountryHelper } from 'src/common/helpers/country.helper';
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
import { EventsGateway } from '../infra/event-bus/events.gateway';
import { ShipmentOfficeCoordinatorService } from './services/shipment-office-coordinator.service';

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
    private readonly eventsGateway: EventsGateway,
    public readonly shipmentOfficeCoordinator: ShipmentOfficeCoordinatorService,
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
    // Usar el helper centralizado para validación y normalización
    const normalized = CountryHelper.validateAndNormalize(country);
    if (normalized) {
      return normalized;
    }

    // Casos especiales para compatibilidad durante migración
    if (country === 'Our office') {
      return 'OO';
    }

    // Fallback para códigos no válidos
    return 'XX';
  }

  public getLocationCode(
    locationName: string,
    locationDetails?: Record<string, any>,
    officeId?: string,
  ): string {
    if (locationName === 'FP warehouse') return 'FP';
    if (locationName === 'Our office') return 'OO';

    // ✅ FIX: Si tiene officeId, es una oficina específica, usar código "OO"
    if (officeId) return 'OO';

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
    officeId?: string,
    warehouseCountryCode?: string,
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
          country: warehouseCountryCode || '', // 🏭 Incluir countryCode del warehouse
        },
      };
    }

    if (location === 'Our office') {
      let office;

      // Si se proporciona officeId específico, usar esa oficina
      if (officeId) {
        office = await this.officesService.findByIdAndTenant(
          new Types.ObjectId(officeId),
          tenantId,
        );
        if (!office) {
          throw new NotFoundException(
            `Office with id ${officeId} not found for tenant ${tenantId}`,
          );
        }
      } else {
        // Fallback a oficina default para compatibilidad
        office = await this.officesService.getDefaultOffice(tenantId);
        if (!office) {
          throw new BadRequestException(
            `No default office found for tenant ${tenantId}. Please create an office first or specify an officeId.`,
          );
        }
      }

      return {
        name: office.name, // ✅ FIX: Usar el nombre específico de la oficina
        code: 'OO',
        details: {
          address: office.address || '',
          apartment: office.apartment || '',
          city: office.city || '',
          state: office.state || '',
          country: office.country || '',
          zipCode: office.zipCode || '',
          phone: office.phone || '',
          email: office.email || '',
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
    originOfficeId?: string,
    destinationOfficeId?: string,
  ): string {
    if (!orderOrigin || !orderDestination || orderNumber === undefined) {
      throw new Error('❌ Parámetros inválidos para generar el Order ID');
    }

    const originCode =
      orderOrigin.length === 2
        ? orderOrigin
        : this.getLocationCode(orderOrigin, undefined, originOfficeId);
    const destinationCode =
      orderDestination.length === 2
        ? orderDestination
        : this.getLocationCode(
            orderDestination,
            undefined,
            destinationOfficeId,
          );

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
      officeId?: string;
    },
    newData?: {
      location?: string;
      assignedEmail?: string;
      assignedMember?: string;
      officeId?: string;
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
      oldData?.officeId,
    );

    const destinationInfo = await this.getLocationInfo(
      destinationLocation,
      tenantId,
      newData?.assignedEmail || '',
      newData?.assignedMember || '',
      desirableDestinationDate,
      newData?.officeId,
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
      officeId?: string;
      warehouseCountryCode?: string; // 🏭 Agregar warehouseCountryCode para FP warehouse
    },
    newData?: {
      location?: string;
      assignedEmail?: string;
      assignedMember?: string;
      officeId?: string;
      warehouseCountryCode?: string; // 🏭 Agregar warehouseCountryCode para FP warehouse
    },
    providedProduct?: ProductDocument,
    providedConnection?: Connection,
  ): Promise<{
    shipment: ShipmentDocument;
    isConsolidated: boolean;
    oldSnapshot?: Partial<ShipmentDocument>;
    officeIds?: {
      originOfficeId?: mongoose.Types.ObjectId;
      destinationOfficeId?: mongoose.Types.ObjectId;
    };
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
      originLocation,
      destinationLocation,
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
      oldData?.officeId,
      newData?.officeId,
    );

    // 🏢 Determinar officeIds para el shipment
    let shipmentOriginOfficeId: mongoose.Types.ObjectId | undefined;
    let shipmentDestinationOfficeId: mongoose.Types.ObjectId | undefined;

    // Si origin es "Our office", obtener el officeId
    if (originLocation === 'Our office') {
      if (oldData?.officeId) {
        shipmentOriginOfficeId = new mongoose.Types.ObjectId(oldData.officeId);
      } else {
        // Fallback a oficina default
        const defaultOffice =
          await this.officesService.getDefaultOffice(tenantName);
        if (defaultOffice) {
          shipmentOriginOfficeId = defaultOffice._id;
        } else {
          throw new BadRequestException(
            `No default office found for tenant ${tenantName}. Cannot create shipment from "Our office" without specifying an officeId.`,
          );
        }
      }
    }

    // Si destination es "Our office", obtener el officeId
    if (destinationLocation === 'Our office') {
      if (newData?.officeId) {
        shipmentDestinationOfficeId = new mongoose.Types.ObjectId(
          newData.officeId,
        );
      } else {
        // Fallback a oficina default
        const defaultOffice =
          await this.officesService.getDefaultOffice(tenantName);
        if (defaultOffice) {
          shipmentDestinationOfficeId = defaultOffice._id;
        } else {
          throw new BadRequestException(
            `No default office found for tenant ${tenantName}. Cannot create shipment to "Our office" without specifying an officeId.`,
          );
        }
      }
    }

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
          ...(shipmentOriginOfficeId && {
            originOfficeId: shipmentOriginOfficeId,
          }),
          ...(shipmentDestinationOfficeId && {
            destinationOfficeId: shipmentDestinationOfficeId,
          }),
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

    try {
      this.eventsGateway.notifyTenant('superadmin', 'shipments-superadmin', {
        shipmentId: newShipment._id.toString(),
        orderId: newShipment.order_id,
        tenantName,
        status: newShipment.shipment_status,
        origin: newShipment.origin,
        destination: newShipment.destination,
        quantityProducts: newShipment.quantity_products,
        createdAt: newShipment.order_date,
        isNewShipment: true,
      });
      console.log(
        `🔔 WebSocket notification sent for new shipment: ${newShipment.order_id}`,
      );
    } catch (error) {
      console.error(
        '❌ Error sending WebSocket notification for new shipment:',
        error,
      );
    }

    return {
      shipment: newShipment,
      isConsolidated: false,
      // Devolver los IDs de oficinas para actualizar flags después del commit
      officeIds: {
        originOfficeId: newShipment.originOfficeId
          ? new mongoose.Types.ObjectId(newShipment.originOfficeId.toString())
          : undefined,
        destinationOfficeId: newShipment.destinationOfficeId
          ? new mongoose.Types.ObjectId(
              newShipment.destinationOfficeId.toString(),
            )
          : undefined,
      },
    };
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

    // ✅ Validar que el shipment esté en un estado actualizable
    if (
      shipment.shipment_status !== 'In Preparation' &&
      shipment.shipment_status !== 'On Hold - Missing Data'
    ) {
      throw new BadRequestException(
        `Cannot update shipment with status: ${shipment.shipment_status}`,
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
      shipment.products.map((p) => p.toString());

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

      // 🔔 Notificar a superadmin sobre la consolidación del shipment
      try {
        this.eventsGateway.notifyTenant(tenantName, 'shipment-consolidated', {
          consolidatedShipmentId: consolidable._id.toString(),
          consolidatedOrderId: consolidable.order_id,
          deletedShipmentId: shipment._id.toString(),
          deletedOrderId: shipment.order_id,
          tenantName,
          status: consolidable.shipment_status,
          origin: consolidable.origin,
          destination: consolidable.destination,
          quantityProducts: consolidable.quantity_products,
          updatedAt: new Date(),
          isConsolidated: true,
        });
        console.log(
          `🔔 WebSocket notification sent for consolidated shipment: ${consolidable.order_id}`,
        );
      } catch (error) {
        console.error(
          '❌ Error sending WebSocket notification for consolidated shipment:',
          error,
        );
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
      const newStatus = isReady ? 'In Preparation' : 'On Hold - Missing Data';
      shipment.shipment_status = newStatus;

      await shipment.save();

      // 🏢 UPDATE: Coordinar actualización de flags de oficinas si el estado cambió
      if (oldStatus !== newStatus) {
        const originOfficeId = shipment.originOfficeId
          ? new mongoose.Types.ObjectId(shipment.originOfficeId.toString())
          : null;
        const destinationOfficeId = shipment.destinationOfficeId
          ? new mongoose.Types.ObjectId(shipment.destinationOfficeId.toString())
          : null;

        await this.shipmentOfficeCoordinator.handleShipmentStatusChange(
          originOfficeId,
          destinationOfficeId,
          oldStatus,
          newStatus,
          tenantName,
        );
      }

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
            tenantName,
          );
        }
      }

      // 🔔 Notificar a superadmin sobre la actualización del shipment
      try {
        this.eventsGateway.notifyTenant(tenantName, 'shipment-updated', {
          shipmentId: shipment._id.toString(),
          orderId: shipment.order_id,
          tenantName,
          oldStatus,
          newStatus: shipment.shipment_status,
          origin: shipment.origin,
          destination: shipment.destination,
          quantityProducts: shipment.quantity_products,
          updatedAt: new Date(),
          isUpdated: true,
        });
        console.log(
          `🔔 WebSocket notification sent for updated shipment: ${shipment.order_id}`,
        );
      } catch (error) {
        console.error(
          '❌ Error sending WebSocket notification for updated shipment:',
          error,
        );
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

    // 🏢 UPDATE: Coordinar actualización de flags de oficinas después de cancelación
    const originOfficeId = shipment.originOfficeId
      ? new mongoose.Types.ObjectId(shipment.originOfficeId.toString())
      : null;
    const destinationOfficeId = shipment.destinationOfficeId
      ? new mongoose.Types.ObjectId(shipment.destinationOfficeId.toString())
      : null;

    await this.shipmentOfficeCoordinator.handleShipmentCancelled(
      originOfficeId,
      destinationOfficeId,
      tenantName,
    );

    return shipment;
  }

  async getShipments(tenantName: string) {
    await new Promise((resolve) => process.nextTick(resolve));
    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantName);
    const ShipmentModel = this.getShipmentModel(connection);

    const shipments = await ShipmentModel.find({ isDeleted: false }).sort({
      createdAt: -1,
    });

    // 🌍 TRANSFORM: Reemplazar "FP warehouse" con country code del warehouse
    const transformedShipments = await Promise.all(
      shipments.map(async (shipment) => {
        const shipmentObj = shipment.toObject();

        // Agregar warehouseCountryCode cuando location === "FP warehouse"
        if (shipmentObj.snapshots && Array.isArray(shipmentObj.snapshots)) {
          for (let i = 0; i < shipmentObj.snapshots.length; i++) {
            const snapshot = shipmentObj.snapshots[i];
            if (snapshot.location === 'FP warehouse') {
              // Usar el products array para obtener el country code
              const productId = shipmentObj.products?.[i]?.toString();
              if (productId) {
                const countryCode = await this.getWarehouseCountryCode(
                  productId,
                  tenantName,
                  connection,
                );
                if (countryCode) {
                  // ✅ AGREGAR campo warehouseCountryCode, NO reemplazar location
                  (snapshot as any).warehouseCountryCode = countryCode;
                }
              }
            }
          }
        }

        return shipmentObj;
      }),
    );

    return transformedShipments;
  }

  /**
   * 🌍 Helper para obtener el country code del warehouse de un producto
   */
  private async getWarehouseCountryCode(
    productId: string,
    tenantName: string,
    connection: Connection,
  ): Promise<string | null> {
    try {
      const ProductModel = connection.model('Product');
      const product = await ProductModel.findById(productId);

      if (product?.fpWarehouse?.warehouseCountryCode) {
        return product.fpWarehouse.warehouseCountryCode;
      }

      return null;
    } catch (error) {
      console.error(
        `Error getting warehouse country code for product ${productId}:`,
        error,
      );
      return null;
    }
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
