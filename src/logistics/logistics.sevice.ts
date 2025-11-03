import {
  Injectable,
  Logger,
  forwardRef,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { TenantModelRegistry } from 'src/infra/db/tenant-model-registry';
import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventTypes } from 'src/infra/event-bus/types';

import { MemberAddressUpdatedEvent } from 'src/infra/event-bus/member-address-update.event';
import {
  MemberDocument,
  MemberSchema,
} from 'src/members/schemas/member.schema';
import mongoose, { ClientSession, Types, Connection } from 'mongoose';
import {
  Shipment,
  ShipmentDocument,
  ShipmentSchema,
} from 'src/shipments/schema/shipment.schema';
import { UpdateProductDto } from 'src/products/dto';
import {
  ProductDocument,
  ProductSchema,
} from 'src/products/schemas/product.schema';
import { CreateShipmentMessageToSlack } from 'src/shipments/helpers/create-message-to-slack';
import { SlackService } from 'src/slack/slack.service';
import { ShipmentsService } from 'src/shipments/shipments.service';
import { HistoryService } from 'src/history/history.service';
import { TenantConnectionService } from 'src/infra/db/tenant-connection.service';
import { CountryHelper } from 'src/common/helpers/country.helper';
import { Product } from 'src/products/schemas/product.schema';
import { TenantsService } from 'src/tenants/tenants.service';
import { TenantUserAdapterService } from 'src/common/services/tenant-user-adapter.service';
import { ProductsService } from 'src/products/products.service';
import { OfficesService } from '../offices/offices.service';
import { UsersService } from '../users/users.service';
import { ShipmentOfficeCoordinatorService } from '../shipments/services/shipment-office-coordinator.service';
import { Status } from 'src/products/interfaces/product.interface';
import { AddressData } from 'src/infra/event-bus/tenant-address-update.event';
import { MembersService } from 'src/members/members.service';
import { recordShipmentHistory } from 'src/shipments/helpers/recordShipmentHistory';
import { EventsGateway } from 'src/infra/event-bus/events.gateway';
import { GlobalProductSyncService } from 'src/products/services/global-product-sync.service';

@Injectable()
export class LogisticsService {
  private readonly logger = new Logger(LogisticsService.name);

  constructor(
    private readonly tenantModels: TenantModelRegistry,
    private readonly eventEmitter: EventEmitter2,
    private readonly connectionService: TenantConnectionService,
    @Inject(forwardRef(() => ShipmentsService))
    private readonly shipmentsService: ShipmentsService,
    private readonly historyService: HistoryService,
    private readonly slackService: SlackService,
    private readonly tenantsService: TenantsService,
    private readonly tenantUserAdapter: TenantUserAdapterService,
    @Inject(forwardRef(() => ProductsService))
    private readonly productsService: ProductsService,
    @Inject(forwardRef(() => MembersService))
    private readonly membersService: MembersService,
    private readonly officesService: OfficesService,
    private readonly usersService: UsersService,
    private readonly eventsGateway: EventsGateway,
    private readonly globalProductSyncService: GlobalProductSyncService,
    private readonly shipmentOfficeCoordinator: ShipmentOfficeCoordinatorService,
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

  async validateIfMemberCanBeModified(memberEmail: string, tenantName: string) {
    const ShipmentModel = await this.tenantModels.getShipmentModel(tenantName);

    const shipments = await ShipmentModel.find({
      $or: [
        { origin: { $regex: memberEmail, $options: 'i' } },
        { destination: { $regex: memberEmail, $options: 'i' } },
      ],
      isDeleted: { $ne: true },
    });

    const hasRestrictedStatus = shipments.some(
      (s) => s.shipment_status === 'On The Way',
    );

    if (hasRestrictedStatus) {
      throw new BadRequestException(
        'This member is part of a shipment On The Way and cannot be modified.',
      );
    }
  }

  async handleAddressUpdateIfShipmentActive(
    initialMember: MemberDocument,
    updatedMember: MemberDocument,
    tenantName: string,
    userId: string,
    ourOfficeEmail: string,
  ) {
    this.eventEmitter.emit(
      EventTypes.MEMBER_ADDRESS_UPDATED,
      new MemberAddressUpdatedEvent(
        updatedMember.email,
        tenantName,
        {
          address: initialMember.address || '',
          apartment: initialMember.apartment || '',
          city: initialMember.city || '',
          country: initialMember.country || '',
          zipCode: initialMember.zipCode || '',
          phone: initialMember.phone || '',
          email: initialMember.email || '',
          dni: initialMember.dni?.toString() || '',
          personalEmail: initialMember.personalEmail || '',
        },
        {
          address: updatedMember.address || '',
          apartment: updatedMember.apartment || '',
          city: updatedMember.city || '',
          country: updatedMember.country || '',
          zipCode: updatedMember.zipCode || '',
          phone: updatedMember.phone || '',
          email: updatedMember.email || '',
          dni: updatedMember.dni?.toString() || '',
          personalEmail: updatedMember.personalEmail || '',
        },
        new Date(),
        userId,
        ourOfficeEmail,
      ),
    );
  }

  private hasPersonalDataChanged(
    before: MemberDocument,
    after: MemberDocument,
  ): boolean {
    const sensitiveFields = [
      'address',
      'apartment',
      'city',
      'country',
      'zipCode',
      'phone',
      'email',
      'dni',
      'personalEmail',
    ];

    let hasChanges = false;
    const changes: Array<{ field: string; before: any; after: any }> = [];

    for (const field of sensitiveFields) {
      const beforeVal = before[field];
      const afterVal = after[field];

      const normalizedBefore =
        field === 'dni' && beforeVal !== undefined
          ? beforeVal.toString()
          : beforeVal;

      const normalizedAfter =
        field === 'dni' && afterVal !== undefined
          ? afterVal.toString()
          : afterVal;

      if (normalizedBefore !== normalizedAfter) {
        changes.push({
          field,
          before: normalizedBefore,
          after: normalizedAfter,
        });
        hasChanges = true;
      }
    }

    return hasChanges;
  }

  /**
   * Verifica si se debe emitir el evento de actualización de member
   * (versión pública para usar antes del commit de transacción)
   */
  public shouldEmitMemberUpdateEvent(
    initialMember: MemberDocument,
    updatedMember: MemberDocument,
  ): boolean {
    const modified = this.hasPersonalDataChanged(initialMember, updatedMember);

    if (!modified) {
      return false;
    }

    if (!updatedMember.activeShipment) {
      return false;
    }

    return true;
  }

  async getShipmentSummaryByProductId(productId: string, tenantName: string) {
    const ShipmentModel = await this.tenantModels.getShipmentModel(tenantName);

    const shipment = await ShipmentModel.findOne({
      products: new mongoose.Types.ObjectId(productId),
      shipment_status: {
        $in: ['In Preparation', 'On Hold - Missing Data', 'On The Way'],
      },
      isDeleted: { $ne: true },
    }).lean();

    if (!shipment) return null;

    return {
      shipmentId: shipment._id.toString(),
      shipmentOrigin: shipment.origin,
      shipmentDestination: shipment.destination,
      shipmentStatus: shipment.shipment_status,
    };
  }

  async getShipmentStatusByProductId(
    productId: string,
    tenantName: string,
  ): Promise<string | null> {
    const ShipmentModel = await this.tenantModels.getShipmentModel(tenantName);

    const shipment = await ShipmentModel.findOne({
      products: new mongoose.Types.ObjectId(productId),
      shipment_status: {
        $in: ['In Preparation', 'On Hold - Missing Data', 'On The Way'],
      },
      isDeleted: { $ne: true },
    }).lean();

    return shipment ? shipment.shipment_status : null;
  }

  public async maybeCreateShipmentAndUpdateStatus(
    product: ProductDocument,
    updateDto: UpdateProductDto,
    tenantName: string,
    actionType: string,
    session: ClientSession,
    oldData: {
      location?: string;
      assignedEmail?: string;
      assignedMember?: string;
      officeId?: string; // ✅ FIX: Agregar officeId al tipo
    },
    newData: {
      location?: string;
      assignedEmail?: string;
      assignedMember?: string;
      officeId?: string;
    },
    userId: string,
    ourOfficeEmail: string,
    providedConnection?: Connection,
  ): Promise<ShipmentDocument | null> {
    console.log(
      `🚢 [maybeCreateShipmentAndUpdateStatus] DEBUG - fp_shipment: ${updateDto.fp_shipment}, product.fp_shipment: ${product.fp_shipment}, actionType: ${actionType}`,
    );
    console.log(
      `🚢 [maybeCreateShipmentAndUpdateStatus] DEBUG - oldData:`,
      oldData,
    );
    console.log(
      `🚢 [maybeCreateShipmentAndUpdateStatus] DEBUG - newData:`,
      newData,
    );
    if (!updateDto.fp_shipment || !actionType) return null;

    const desirableDateOrigin =
      typeof updateDto.desirableDate === 'object'
        ? updateDto.desirableDate.origin || ''
        : '';
    const desirableDateDestination =
      typeof updateDto.desirableDate === 'string'
        ? updateDto.desirableDate
        : updateDto.desirableDate?.destination || '';

    const connection =
      providedConnection ||
      (await this.connectionService.getTenantConnection(tenantName));

    const { shipment, isConsolidated, oldSnapshot, officeIds } =
      await this.shipmentsService.findOrCreateShipment(
        product._id!.toString(),
        actionType,
        tenantName,
        userId,
        session,
        desirableDateDestination,
        desirableDateOrigin,
        oldData,
        newData,
        product,
        connection,
      );

    if (!shipment || !shipment._id) {
      console.error('❌ Failed to create shipment or shipment has no ID');
      return null;
    }

    product.activeShipment = true;
    product.fp_shipment = true;
    await product.save({ session });

    if (session.inTransaction()) {
      await session.commitTransaction();
      session.startTransaction();
    }

    // 🏢 UPDATE: Coordinar actualización de flags de oficinas DESPUÉS del commit
    if (
      officeIds &&
      (officeIds.originOfficeId || officeIds.destinationOfficeId)
    ) {
      try {
        await this.shipmentsService.shipmentOfficeCoordinator.handleShipmentCreated(
          officeIds.originOfficeId || null,
          officeIds.destinationOfficeId || null,
          shipment.shipment_status,
          tenantName,
        );
      } catch (error) {
        console.error(
          '❌ Error updating office flags after shipment creation:',
          error,
        );
        // No fallar el proceso principal por este error
      }
    }

    const newStatus =
      shipment.shipment_status === 'On Hold - Missing Data'
        ? 'In Transit - Missing Data'
        : 'In Transit';

    product.status = newStatus;
    updateDto.status = newStatus;

    await product.save({ session });

    // 🌐 SINCRONIZAR A GLOBAL COLLECTION después de actualizar status y activeShipment
    try {
      // ✅ OBTENER PRODUCTO ACTUALIZADO desde la base de datos
      const ProductModel = connection.model(Product.name, ProductSchema);
      const updatedProduct = await ProductModel.findById(product._id).session(
        session,
      );

      if (!updatedProduct) {
        return shipment;
      }

      await this.globalProductSyncService.syncProduct({
        tenantId: tenantName,
        tenantName: tenantName,
        originalProductId: updatedProduct._id as any,
        sourceCollection: 'products',
        name: updatedProduct.name || '',
        category: updatedProduct.category || '',
        status: updatedProduct.status, // ✅ Nuevo status "In Transit"
        location: updatedProduct.location || '',
        attributes: (updatedProduct.attributes || []).map((attr) => ({
          key: attr.key || '',
          value: String(attr.value || ''),
        })),
        serialNumber: updatedProduct.serialNumber || undefined,
        assignedEmail: updatedProduct.assignedEmail,
        assignedMember: updatedProduct.assignedMember,
        lastAssigned: updatedProduct.lastAssigned,
        acquisitionDate: updatedProduct.acquisitionDate,
        price: updatedProduct.price,
        additionalInfo: updatedProduct.additionalInfo,
        productCondition: updatedProduct.productCondition,
        recoverable: updatedProduct.recoverable,
        fp_shipment: updatedProduct.fp_shipment, // ✅ true
        activeShipment: updatedProduct.activeShipment, // ✅ true
        isDeleted: updatedProduct.isDeleted,
        fpWarehouse:
          updatedProduct.fpWarehouse &&
          updatedProduct.fpWarehouse.warehouseId &&
          updatedProduct.fpWarehouse.warehouseCountryCode &&
          updatedProduct.fpWarehouse.warehouseName
            ? {
                warehouseId: updatedProduct.fpWarehouse.warehouseId as any,
                warehouseCountryCode:
                  updatedProduct.fpWarehouse.warehouseCountryCode,
                warehouseName: updatedProduct.fpWarehouse.warehouseName,
                assignedAt: updatedProduct.fpWarehouse.assignedAt,
                status:
                  updatedProduct.fpWarehouse.status === 'IN_TRANSIT'
                    ? 'IN_TRANSIT_IN'
                    : (updatedProduct.fpWarehouse.status as any),
              }
            : undefined,
        office:
          updatedProduct.office &&
          updatedProduct.office.officeId &&
          updatedProduct.office.officeCountryCode &&
          updatedProduct.office.officeName
            ? {
                officeId: updatedProduct.office.officeId as any,
                officeCountryCode: updatedProduct.office.officeCountryCode,
                officeName: updatedProduct.office.officeName,
                assignedAt: updatedProduct.office.assignedAt,
                isDefault: updatedProduct.office.isDefault,
              }
            : undefined,
        sourceUpdatedAt: new Date(),
      });
    } catch (error) {
      console.error(
        `❌ [maybeCreateShipmentAndUpdateStatus] Global sync failed for product ${product._id}:`,
        error,
      );
      // No fallar el proceso principal por este error
    }

    // 🏭 ASIGNAR WAREHOUSE si el destino es FP warehouse
    if (newData?.location === 'FP warehouse') {
      try {
        // Importar AssignmentsService sería dependencia circular, así que usamos ProductsService
        // pero necesitamos una forma de asignar warehouse sin validación de activeShipment
        // Por ahora, solo loggeamos que se necesita warehouse assignment
        // La sincronización global se hará sin fpWarehouse por ahora
      } catch (error) {
        console.error(
          `❌ [maybeCreateShipmentAndUpdateStatus] Error in warehouse assignment:`,
          error,
        );
      }
    }

    await this.shipmentsService.createSnapshots(shipment, connection, {
      providedProducts: [product],
    });

    await this.historyService.create({
      actionType: isConsolidated ? 'consolidate' : 'create',
      itemType: 'shipments',
      userId,

      changes: {
        oldData: isConsolidated ? oldSnapshot ?? null : null,
        newData: shipment,
        context: isConsolidated ? 'single-product' : undefined,
      },
    });

    // TODO: Status New Shipment
    if (shipment.shipment_status === 'In Preparation' && !isConsolidated) {
      const userInfo = await this.getUserInfoFromUserId(userId);

      const slackMessage = CreateShipmentMessageToSlack({
        shipment: shipment,
        tenantName: tenantName,
        isOffboarding: false,
        status: 'New',
        ourOfficeEmail: ourOfficeEmail,
        userInfo: userInfo,
      });
      await this.slackService.sendMessage(slackMessage);
    }

    //TODO: Status consolidate
    if (isConsolidated && shipment.shipment_status === 'In Preparation') {
      const userInfo = await this.getUserInfoFromUserId(userId);

      const slackMessage = CreateShipmentMessageToSlack({
        shipment: shipment,
        tenantName: tenantName,
        isOffboarding: false,
        status: 'Consolidated',
        previousShipment: oldSnapshot,
        ourOfficeEmail: ourOfficeEmail,
        userInfo: userInfo,
      });

      await this.slackService.sendMessage(slackMessage);
    } else if (isConsolidated) {
      console.log(
        `🔇 Consolidated shipment has status "${shipment.shipment_status}", skipping Slack notification.`,
      );
    }

    return shipment;
  }

  async tryCreateShipmentIfNeeded(
    product: ProductDocument,
    updateDto: UpdateProductDto,
    tenantName: string,
    session: ClientSession,
    userId: string,
    ourOfficeEmail: string,
    providedConnection?: Connection,
  ): Promise<ShipmentDocument | null> {
    const result = await this.maybeCreateShipmentAndUpdateStatus(
      product,
      updateDto,
      tenantName,
      updateDto.actionType ?? '',
      session,
      {
        location: product.location,
        assignedEmail: product.assignedEmail,
        assignedMember: product.assignedMember,
        officeId: product.office?.officeId?.toString(), // ✅ FIX: Incluir officeId del producto actual
      },
      {
        location: updateDto.location,
        assignedEmail: updateDto.assignedEmail,
        assignedMember: updateDto.assignedMember,
        officeId: updateDto.officeId,
      },
      userId,
      ourOfficeEmail,
      providedConnection,
    );

    return result;
  }

  async getMemberLocationInfo(
    tenantId: string,
    assignedEmail: string,
    desirableDate?: string,
  ): Promise<{
    name: string;
    code: string;
    details: Record<string, string>;
  }> {
    const memberModel = await this.tenantModels.getMemberModel(tenantId);

    const member = await memberModel.findOne({
      email: assignedEmail.trim().toLowerCase(),
    });

    if (!member) {
      throw new NotFoundException(`Member ${assignedEmail} not found`);
    }

    const fullName = `${member.firstName} ${member.lastName}`;
    const countryCode = this.getCountryCode(member.country || '');

    return {
      name: fullName,
      code: countryCode,
      details: {
        address: member.address || '',
        city: member.city || '',
        country: member.country || '',
        zipCode: member.zipCode || '',
        apartment: member.apartment || '',
        contactName: fullName,
        phone: member.phone || '',
        personalEmail: member.personalEmail || '',
        assignedEmail: member.email,
        dni: `${member.dni || ''}`,
        desirableDate: desirableDate || '',
      },
    };
  }

  public getCountryCode(country: string): string {
    const normalized = CountryHelper.validateAndNormalize(country);
    if (normalized) {
      return normalized;
    }

    if (country === 'Our office') {
      return 'OO';
    }

    return 'XX';
  }

  public async isLocationDataComplete(
    product: Partial<Product>,
    tenantName: string,
    officeId?: string,
  ): Promise<boolean> {
    if (product.location === 'FP warehouse') {
      return true;
    }

    if (product.location === 'Employee') {
      const MemberModel = await this.tenantModels.getMemberModel(tenantName);
      const member = await MemberModel.findOne({
        email: product.assignedEmail?.trim().toLowerCase(),
      });
      if (!member) return false;

      return !!(
        member.country &&
        member.city &&
        member.zipCode &&
        member.address &&
        member.personalEmail &&
        member.phone &&
        member.dni
      );
    }

    if (product.location === 'Our office') {
      let office: any;

      // Si se proporciona officeId específico, usar esa oficina
      if (officeId) {
        office = await this.officesService.findByIdAndTenant(
          new Types.ObjectId(officeId),
          tenantName,
        );
      } else {
        // Fallback a oficina default para compatibilidad
        office = await this.officesService.getDefaultOffice(tenantName);
      }

      if (!office) {
        console.log('❌ Oficina no encontrada:', {
          tenantName,
          officeId,
          useDefault: !officeId,
        });
        return false;
      }

      const isComplete = !!(
        office.country &&
        office.city &&
        office.state &&
        office.zipCode &&
        office.address &&
        office.phone
      );

      if (!isComplete) {
        console.log('❌ Oficina incompleta para "Our office":', {
          tenantName,
          officeId: office._id,
          officeName: office.name,
          isDefault: office.isDefault,
          missing: {
            country: !office.country,
            city: !office.city,
            state: !office.state,
            zipCode: !office.zipCode,
            address: !office.address,
            phone: !office.phone,
          },
          office: {
            country: office.country,
            city: office.city,
            state: office.state,
            zipCode: office.zipCode,
            address: office.address,
            phone: office.phone,
            email: office.email,
          },
        });
      }

      return isComplete;
    }

    return false;
  }

  async getShipmentPreparationData(
    productId: string,
    tenantName: string,
    actionType: string,
    originDate?: string,
    destinationDate?: string,
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
    providedProduct?: ProductDocument,
    providedConnection?: Connection,
  ): Promise<{
    product: Product;
    origin: string;
    destination: string;
    orderOrigin: string;
    orderDestination: string;
    originLocation: string;
    destinationLocation: string;
    originDetails?: Record<string, string>;
    destinationDetails?: Record<string, string>;
    destinationComplete: boolean;
    originComplete: boolean;
    assignedEmail: string;
  }> {
    const product =
      providedProduct ??
      (providedConnection
        ? await providedConnection
            .model(Product.name, ProductSchema)
            .findById(productId)
        : await this.tenantModels
            .getProductModel(tenantName)
            .then((ProductModel) => ProductModel.findById(productId)));

    if (!product) {
      throw new NotFoundException(`Product ${productId} not found.`);
    }
    const assignedEmail = newData?.assignedEmail || product.assignedEmail || '';

    const {
      origin,
      destination,
      orderOrigin,
      orderDestination,
      originLocation,
      destinationLocation,
    } = await this.shipmentsService.getProductLocationDataFromSnapshots(
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
      : await this.shipmentsService
          .getLocationInfo(
            originLocation,
            tenantName,
            oldData?.assignedEmail || '',
            oldData?.assignedMember || '',
            originDate,
            oldData?.officeId,
          )
          .then((res) => res.details);

    const destinationDetails = await this.shipmentsService
      .getLocationInfo(
        destinationLocation,
        tenantName,
        newData?.assignedEmail || '',
        newData?.assignedMember || '',
        destinationDate,
        newData?.officeId,
      )
      .then((res) => res.details);

    const destinationComplete = await this.isLocationDataComplete(
      { ...product, location: destinationLocation, assignedEmail },
      tenantName,
      newData?.officeId,
    );

    const originComplete = await this.isLocationDataComplete(
      {
        ...product,
        location: originLocation,
        assignedEmail: oldData?.assignedEmail || '',
      },
      tenantName,
      oldData?.officeId,
    );

    return {
      product,
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
      assignedEmail,
    };
  }

  async findProductAcrossCollections(
    tenantName: string,
    productId: string,
    session?: ClientSession,
  ): Promise<Product | ProductDocument | null> {
    const connection = await this.tenantModels.getConnection(tenantName);
    const ProductModel =
      this.tenantModels.getProductModelFromConnection(connection);
    const MemberModel =
      this.tenantModels.getMemberModelFromConnection(connection);

    const product = await ProductModel.findById(productId).session(
      session || null,
    );
    if (product) return product;

    const member = await MemberModel.findOne({
      'products._id': productId,
    }).session(session || null);
    const memberProduct = member?.products?.find(
      (p: any) => p._id.toString() === productId,
    );

    return memberProduct || null;
  }

  async addProductsAndSnapshotsToShipment(
    shipment: ShipmentDocument,
    productIds: Types.ObjectId[] | string[],
    tenantName: string,
  ): Promise<void> {
    const existingSnapshotIds =
      shipment.snapshots?.map((s) => s._id.toString()) || [];

    for (const rawId of productIds) {
      const productId = rawId.toString();
      const objectId = new Types.ObjectId(productId);

      if (!shipment.products.some((p) => p.equals(objectId))) {
        shipment.products.push(objectId);
      } else {
        console.log(`🔁 Producto ${productId} ya estaba en shipment`);
      }

      const product = await this.findProductAcrossCollections(
        tenantName,
        productId,
      );

      if (!product) {
        console.warn(`⚠️ Producto ${productId} no encontrado`);
        continue;
      }

      if (!product._id) {
        console.warn(`⚠️ Producto ${productId} no tiene _id, se omite`);
        continue;
      }

      if (!existingSnapshotIds.includes(product._id.toString())) {
        const snapshot = this.shipmentsService.buildSnapshot(
          product as ProductDocument & { _id: Types.ObjectId },
        );

        shipment.snapshots = shipment.snapshots || [];
        shipment.snapshots.push(snapshot);
      } else {
        console.log(`📸 Snapshot ya existe para producto ${product._id}`);
      }
    }
  }

  async isShipmentDetailsComplete(
    shipment: ShipmentDocument,
    tenantName?: string,
  ): Promise<boolean> {
    let originComplete = this.areShipmentDetailsComplete(
      shipment.originDetails,
      shipment.origin,
      shipment.originOfficeId?.toString(),
    );

    let destinationComplete = this.areShipmentDetailsComplete(
      shipment.destinationDetails,
      shipment.destination,
      shipment.destinationOfficeId?.toString(),
    );

    // Si hay officeIds específicos y tenantName, validar que las oficinas existan y estén completas
    if (tenantName) {
      if (shipment.origin === 'Our office' && shipment.originOfficeId) {
        const office = await this.officesService.findByIdAndTenant(
          new Types.ObjectId(shipment.originOfficeId.toString()),
          tenantName,
        );
        if (!office) {
          originComplete = false;
        }
      }

      if (
        shipment.destination === 'Our office' &&
        shipment.destinationOfficeId
      ) {
        const office = await this.officesService.findByIdAndTenant(
          new Types.ObjectId(shipment.destinationOfficeId.toString()),
          tenantName,
        );
        if (!office) {
          destinationComplete = false;
        }
      }
    }

    return originComplete && destinationComplete;
  }

  public areShipmentDetailsComplete(
    details?: Record<string, string>,
    locationName?: string,
    officeId?: string,
  ): boolean {
    if (!details) return false;

    if (locationName === 'FP warehouse') return true;

    // ✅ FIX: Si tiene officeId O es "Our office", validar como oficina
    if (locationName === 'Our office' || officeId) {
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
        console.log(`❌ Oficina incompleta para "${locationName}":`, {
          missing: requiredFields.filter((f) => !details[f]),
          details,
        });
      }
      return result;
    }

    // Validación para empleados (Employee)
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
      console.log('❌ Destination (Employee) está incompleto:', {
        missing: requiredFields.filter((f) => !details[f]),
        details,
      });
    }
    return result;
  }

  async cancelAllProductsInShipment(
    productIds: Types.ObjectId[] | string[],
    tenantName: string,
    // userId: string,
  ): Promise<void> {
    const connection = await this.tenantModels.getConnection(tenantName);
    const ProductModel =
      this.tenantModels.getProductModelFromConnection(connection);
    const MemberModel =
      this.tenantModels.getMemberModelFromConnection(connection);

    for (const rawId of productIds) {
      const productId = rawId.toString();

      const product = await ProductModel.findById(productId);
      let assignedEmail: string | undefined;
      let status: Status | undefined;

      if (product) {
        product.fp_shipment = false;
        product.activeShipment = false;

        status = await this.productsService.determineProductStatus(
          { ...product.toObject(), fp_shipment: false },
          tenantName,
          undefined,
          'Cancelled',
        );

        product.status = status;
        await product.save();
        assignedEmail = product.assignedEmail;

        // 🌐 SINCRONIZAR A GLOBAL COLLECTION - PRESERVANDO DATOS EXISTENTES
        try {
          // Obtener datos existentes del producto global para preservar fpWarehouse y memberData
          const existingGlobalProduct =
            await this.globalProductSyncService.findGlobalProduct(
              tenantName,
              new Types.ObjectId(productId),
            );

          await this.globalProductSyncService.syncProduct({
            tenantId: tenantName,
            tenantName: tenantName,
            originalProductId: new Types.ObjectId(productId),
            sourceCollection: 'products',
            name: product.name || '',
            category: product.category || '',
            status: status,
            location: product.location || '',
            attributes: (product.attributes || []).map((attr) => ({
              key: attr.key || '',
              value: String(attr.value || ''),
            })),
            serialNumber: product.serialNumber || undefined,
            assignedEmail: product.assignedEmail,
            assignedMember: product.assignedMember,
            lastAssigned: product.lastAssigned,
            acquisitionDate: product.acquisitionDate,
            price: product.price,
            additionalInfo: product.additionalInfo,
            productCondition: product.productCondition,
            recoverable: product.recoverable,
            fp_shipment: false,
            activeShipment: false,
            isDeleted: product.isDeleted,
            // 🔄 PRESERVAR fpWarehouse existente si el producto está en FP warehouse
            fpWarehouse:
              product.location === 'FP warehouse'
                ? existingGlobalProduct?.fpWarehouse
                  ? {
                      warehouseId: existingGlobalProduct.fpWarehouse
                        .warehouseId as any,
                      warehouseCountryCode:
                        existingGlobalProduct.fpWarehouse.warehouseCountryCode,
                      warehouseName:
                        existingGlobalProduct.fpWarehouse.warehouseName,
                      assignedAt: existingGlobalProduct.fpWarehouse.assignedAt,
                      status: 'STORED' as const, // Producto cancelado en FP warehouse = STORED
                    }
                  : product.fpWarehouse && product.fpWarehouse.warehouseId
                    ? {
                        warehouseId: product.fpWarehouse.warehouseId as any,
                        warehouseCountryCode:
                          product.fpWarehouse.warehouseCountryCode || '',
                        warehouseName: product.fpWarehouse.warehouseName || '',
                        assignedAt: product.fpWarehouse.assignedAt,
                        status: 'STORED' as const,
                      }
                    : undefined
                : undefined,
            // 🔄 PRESERVAR memberData existente si existe
            memberData: existingGlobalProduct?.memberData
              ? {
                  memberId: existingGlobalProduct.memberData.memberId as any,
                  memberEmail: existingGlobalProduct.memberData.memberEmail,
                  memberName: existingGlobalProduct.memberData.memberName,
                  assignedAt: existingGlobalProduct.memberData.assignedAt,
                }
              : undefined,
          });
        } catch (error) {
          console.error(
            `❌ [cancelAllProductsInShipment] Global sync failed for product ${productId}:`,
            error,
          );
        }
      } else {
        const member = await MemberModel.findOne({
          'products._id': new Types.ObjectId(productId),
        });

        const embeddedProduct = member?.products?.find(
          (p: any) => p._id.toString() === productId,
        );

        if (embeddedProduct) {
          status = await this.productsService.determineProductStatus(
            {
              fp_shipment: false,
              location: embeddedProduct.location,
              assignedEmail: embeddedProduct.assignedEmail,
              productCondition: embeddedProduct.productCondition,
            },
            tenantName,
            undefined,
            'Cancelled',
          );

          await MemberModel.updateOne(
            { 'products._id': new Types.ObjectId(productId) },
            {
              $set: {
                'products.$.fp_shipment': false,
                'products.$.status': status,
                'products.$.activeShipment': false,
              },
            },
          );

          assignedEmail = embeddedProduct.assignedEmail;

          // 🌐 SINCRONIZAR A GLOBAL COLLECTION
          try {
            await this.globalProductSyncService.syncProduct({
              tenantId: tenantName,
              tenantName: tenantName,
              originalProductId: new Types.ObjectId(productId),
              sourceCollection: 'members',
              name: embeddedProduct.name || '',
              category: embeddedProduct.category || '',
              status: status,
              location: embeddedProduct.location || '',
              attributes: (embeddedProduct.attributes || []).map((attr) => ({
                key: attr.key || '',
                value: String(attr.value || ''),
              })),
              serialNumber: embeddedProduct.serialNumber || undefined,
              assignedEmail: embeddedProduct.assignedEmail,
              assignedMember: embeddedProduct.assignedMember,
              lastAssigned: embeddedProduct.lastAssigned,
              acquisitionDate: embeddedProduct.acquisitionDate,
              price: embeddedProduct.price,
              additionalInfo: embeddedProduct.additionalInfo,
              productCondition: embeddedProduct.productCondition,
              recoverable: embeddedProduct.recoverable,
              fp_shipment: false,
              activeShipment: false,
              isDeleted: embeddedProduct.isDeleted,
              fpWarehouse:
                embeddedProduct.fpWarehouse &&
                embeddedProduct.fpWarehouse.warehouseId
                  ? {
                      warehouseId: embeddedProduct.fpWarehouse
                        .warehouseId as any,
                      warehouseCountryCode:
                        embeddedProduct.fpWarehouse.warehouseCountryCode || '',
                      warehouseName:
                        embeddedProduct.fpWarehouse.warehouseName || '',
                      assignedAt: embeddedProduct.fpWarehouse.assignedAt,
                      status:
                        embeddedProduct.fpWarehouse.status === 'IN_TRANSIT'
                          ? undefined
                          : embeddedProduct.fpWarehouse.status,
                    }
                  : undefined,
              memberData: member
                ? {
                    memberId: member._id as any,
                    memberEmail: member.email,
                    memberName: `${member.firstName} ${member.lastName}`,
                    assignedAt: new Date(),
                  }
                : undefined,
            });
          } catch (error) {
            console.error(
              `❌ [cancelAllProductsInShipment] Global sync failed for member product ${productId}:`,
              error,
            );
          }
        } else {
          continue;
        }
      }

      await this.clearActiveShipmentFlagsIfNoOtherShipments(
        productId,
        tenantName,
        assignedEmail,
      );
    }
  }

  public async markActiveShipmentTargets(
    productId: string,
    tenantName: string,
    origin: string,
    destination: string,
    originEmail?: string,
    destinationEmail?: string,
    session?: ClientSession | null,
    providedConnection?: Connection,
  ) {
    const connection =
      providedConnection || (await this.tenantModels.getConnection(tenantName));
    const ProductModel =
      this.tenantModels.getProductModelFromConnection(connection);
    const MemberModel =
      this.tenantModels.getMemberModelFromConnection(connection);

    const useSession = session || (await connection.startSession());
    const isNewSession = !session;

    try {
      if (isNewSession) {
        useSession.startTransaction();
      }

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

  public async clearActiveShipmentFlagsIfNoOtherShipments(
    productId: string,
    tenantName: string,
    memberEmail?: string,
  ) {
    const connection = await this.tenantModels.getConnection(tenantName);

    const ProductModel =
      this.tenantModels.getProductModelFromConnection(connection);
    const MemberModel =
      this.tenantModels.getMemberModelFromConnection(connection);
    const ShipmentModel = connection.model<ShipmentDocument>('Shipment');

    const activeShipmentsForProduct = await ShipmentModel.countDocuments({
      products: new Types.ObjectId(productId),
      shipment_status: {
        $in: ['In Preparation', 'On Hold - Missing Data', 'On The Way'],
      },
      isDeleted: { $ne: true },
    });

    if (activeShipmentsForProduct === 0) {
      const updatedProduct = await ProductModel.findByIdAndUpdate(productId, {
        activeShipment: false,
      });

      if (updatedProduct) {
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
        return;
      }

      const fullName = `${member.firstName} ${member.lastName}`;

      const activeShipmentsForMember = await ShipmentModel.countDocuments({
        shipment_status: {
          $in: ['In Preparation', 'On Hold - Missing Data', 'On The Way'],
        },
        $or: [
          { origin: fullName },
          { destination: fullName },
          { 'originDetails.assignedEmail': memberEmail },
          { 'destinationDetails.assignedEmail': memberEmail },
        ],
        isDeleted: { $ne: true },
      });

      if (activeShipmentsForMember === 0) {
        await MemberModel.updateOne(
          { email: memberEmail },
          { activeShipment: false },
        );
      }
    }
  }

  async updateProductOnShipmentReceived(
    productId: string,
    tenantName: string,
    origin: string,
  ) {
    const connection = await this.tenantModels.getConnection(tenantName);
    const ProductModel =
      this.tenantModels.getProductModelFromConnection(connection);
    const MemberModel =
      this.tenantModels.getMemberModelFromConnection(connection);

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

      // 🌐 SINCRONIZAR A GLOBAL COLLECTION - PRESERVANDO DATOS EXISTENTES
      try {
        // Obtener datos existentes del producto global para preservar fpWarehouse y memberData
        const existingGlobalProduct =
          await this.globalProductSyncService.findGlobalProduct(
            tenantName,
            new Types.ObjectId(productId),
          );

        await this.globalProductSyncService.syncProduct({
          tenantId: tenantName,
          tenantName: tenantName,
          originalProductId: new Types.ObjectId(productId),
          sourceCollection: 'products',
          name: product.name || '',
          category: product.category || '',
          status: product.status,
          location: product.location || '',
          attributes: (product.attributes || []).map((attr) => ({
            key: attr.key || '',
            value: String(attr.value || ''),
          })),
          serialNumber: product.serialNumber || undefined,
          assignedEmail: product.assignedEmail,
          assignedMember: product.assignedMember,
          lastAssigned: product.lastAssigned,
          acquisitionDate: product.acquisitionDate,
          price: product.price,
          additionalInfo: product.additionalInfo,
          productCondition: product.productCondition,
          recoverable: product.recoverable,
          fp_shipment: false,
          activeShipment: false,
          isDeleted: product.isDeleted,
          // 🔄 PRESERVAR fpWarehouse existente si el producto está en FP warehouse
          fpWarehouse:
            product.location === 'FP warehouse'
              ? existingGlobalProduct?.fpWarehouse
                ? {
                    warehouseId: existingGlobalProduct.fpWarehouse
                      .warehouseId as any,
                    warehouseCountryCode:
                      existingGlobalProduct.fpWarehouse.warehouseCountryCode,
                    warehouseName:
                      existingGlobalProduct.fpWarehouse.warehouseName,
                    assignedAt: existingGlobalProduct.fpWarehouse.assignedAt,
                    status: 'STORED' as const, // Producto recibido = STORED
                  }
                : product.fpWarehouse && product.fpWarehouse.warehouseId
                  ? {
                      warehouseId: product.fpWarehouse.warehouseId as any,
                      warehouseCountryCode:
                        product.fpWarehouse.warehouseCountryCode || '',
                      warehouseName: product.fpWarehouse.warehouseName || '',
                      assignedAt: product.fpWarehouse.assignedAt,
                      status: 'STORED' as const,
                    }
                  : undefined
              : undefined,
          // 🔄 PRESERVAR memberData existente si existe
          memberData: existingGlobalProduct?.memberData
            ? {
                memberId: existingGlobalProduct.memberData.memberId as any,
                memberEmail: existingGlobalProduct.memberData.memberEmail,
                memberName: existingGlobalProduct.memberData.memberName,
                assignedAt: existingGlobalProduct.memberData.assignedAt,
              }
            : undefined,
        });
        console.log(
          `🌐 [updateProductOnShipmentReceived] Global sync completed for product ${productId} - fpWarehouse preserved: ${!!existingGlobalProduct?.fpWarehouse}`,
        );
      } catch (error) {
        console.error(
          `❌ [updateProductOnShipmentReceived] Global sync failed for product ${productId}:`,
          error,
        );
      }

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

        // 🌐 SINCRONIZAR A GLOBAL COLLECTION
        try {
          await this.globalProductSyncService.syncProduct({
            tenantId: tenantName,
            tenantName: tenantName,
            originalProductId: new Types.ObjectId(productId),
            sourceCollection: 'members',
            name: embeddedProduct.name || '',
            category: embeddedProduct.category || '',
            status: newStatus,
            location: 'Employee',
            attributes: (embeddedProduct.attributes || []).map((attr) => ({
              key: attr.key || '',
              value: String(attr.value || ''),
            })),
            serialNumber: embeddedProduct.serialNumber || undefined,
            assignedEmail: embeddedProduct.assignedEmail,
            assignedMember: embeddedProduct.assignedMember,
            lastAssigned: embeddedProduct.lastAssigned,
            acquisitionDate: embeddedProduct.acquisitionDate,
            price: embeddedProduct.price,
            additionalInfo: embeddedProduct.additionalInfo,
            productCondition: embeddedProduct.productCondition,
            recoverable: embeddedProduct.recoverable,
            fp_shipment: false,
            activeShipment: false,
            isDeleted: embeddedProduct.isDeleted,
            fpWarehouse:
              embeddedProduct.fpWarehouse &&
              embeddedProduct.fpWarehouse.warehouseId
                ? {
                    warehouseId: embeddedProduct.fpWarehouse.warehouseId as any,
                    warehouseCountryCode:
                      embeddedProduct.fpWarehouse.warehouseCountryCode || '',
                    warehouseName:
                      embeddedProduct.fpWarehouse.warehouseName || '',
                    assignedAt: embeddedProduct.fpWarehouse.assignedAt,
                    status:
                      embeddedProduct.fpWarehouse.status === 'IN_TRANSIT'
                        ? undefined
                        : embeddedProduct.fpWarehouse.status,
                  }
                : undefined,
            memberData: {
              memberId: memberWithProduct._id as any,
              memberEmail: memberWithProduct.email,
              memberName: `${memberWithProduct.firstName} ${memberWithProduct.lastName}`,
              assignedAt: new Date(),
            },
          });
          console.log(
            `🌐 [updateProductOnShipmentReceived] Global sync completed for member product ${productId}`,
          );
        } catch (error) {
          console.error(
            `❌ [updateProductOnShipmentReceived] Global sync failed for member product ${productId}:`,
            error,
          );
        }
      }
    }
  }

  async clearMemberActiveShipmentFlagIfNoOtherShipments(
    memberEmail: string,
    tenantId: string,
  ) {
    if (typeof memberEmail !== 'string') {
      return;
    }

    const normalizedEmail = memberEmail.trim().toLowerCase();
    const connection = await this.tenantModels.getConnection(tenantId);
    const ShipmentModel = await this.tenantModels.getShipmentModel(tenantId);
    const MemberModel =
      this.tenantModels.getMemberModelFromConnection(connection);

    const activeShipments = await ShipmentModel.find({
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

    const memberStillInvolved = activeShipments.length > 0;

    if (!memberStillInvolved) {
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

  async checkAndUpdateShipmentsForOurOffice(
    tenantName: string,
    oldAddress: AddressData,
    newAddress: AddressData,
    userId: string,
    ourOfficeEmail: string,
    officeId?: string,
    newOfficeName?: string,
  ) {
    await new Promise((resolve) => process.nextTick(resolve));
    const connection = await this.tenantModels.getConnection(tenantName);
    const ShipmentModel = await this.tenantModels.getShipmentModel(tenantName);
    const session = await connection.startSession();

    try {
      await session.withTransaction(async () => {
        // Buscar shipments por officeId (ya no buscamos por nombre "Our office")
        const query: any = {
          shipment_status: {
            $in: ['In Preparation', 'On Hold - Missing Data'],
          },
          isDeleted: { $ne: true },
        };

        if (officeId) {
          // Si se proporciona officeId, buscar shipments de esa oficina específica
          query.$or = [
            { originOfficeId: new Types.ObjectId(officeId) },
            { destinationOfficeId: new Types.ObjectId(officeId) },
          ];
        } else {
          // Si no se proporciona officeId, buscar todos los shipments con oficinas
          query.$or = [
            { originOfficeId: { $exists: true } },
            { destinationOfficeId: { $exists: true } },
          ];
        }

        const shipments = await ShipmentModel.find(query).session(session);

        for (const shipment of shipments) {
          let updated = false;

          const originalShipmentData = { ...shipment.toObject() };

          // Actualizar nombre de oficina si se proporciona
          if (newOfficeName && officeId) {
            if (
              shipment.originOfficeId &&
              shipment.originOfficeId.toString() === officeId
            ) {
              shipment.origin = newOfficeName;
              updated = true;
            }
            if (
              shipment.destinationOfficeId &&
              shipment.destinationOfficeId.toString() === officeId
            ) {
              shipment.destination = newOfficeName;
              updated = true;
            }
          }

          // Actualizar detalles de origen si es una oficina
          if (shipment.originOfficeId) {
            const desirableDate = shipment.originDetails?.desirableDate || '';

            const updatedOriginDetails = {
              address: newAddress.address || '',
              city: newAddress.city || '',
              state: newAddress.state || '',
              country: newAddress.country || '',
              zipCode: newAddress.zipCode || '',
              apartment: newAddress.apartment || '',
              phone: newAddress.phone || '',
              email:
                newAddress.ourOfficeEmail ||
                shipment.originDetails?.email ||
                '',
              personalEmail: shipment.originDetails?.personalEmail || '',
              assignedEmail: shipment.originDetails?.assignedEmail || '',
              dni: shipment.originDetails?.dni || '',
              desirableDate: desirableDate,
            };

            shipment.originDetails = updatedOriginDetails;
            updated = true;
          }

          // Actualizar detalles de destino si es una oficina
          if (shipment.destinationOfficeId) {
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
              email:
                newAddress.ourOfficeEmail ||
                shipment.destinationDetails?.email ||
                '',
              personalEmail: shipment.destinationDetails?.personalEmail || '',
              assignedEmail: shipment.destinationDetails?.assignedEmail || '',
              dni: shipment.destinationDetails?.dni || '',
              desirableDate: desirableDate,
            };

            shipment.destinationDetails = updatedDestinationDetails;
            updated = true;
          }

          if (updated) {
            await shipment.save({ session });

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
                originalShipmentData,
              );
            }
          }
        }
      });
    } catch (error) {
      console.error('❌ Error in office address update:', error);
      throw error;
    } finally {
      await session.endSession();
    }

    console.log('✨ Completed office address update');
  }

  async checkAndUpdateShipmentsForMember(
    memberEmail: string,
    tenantName: string,
    userId: string,
    ourOfficeEmail: string,
  ) {
    await new Promise((resolve) => process.nextTick(resolve));
    const connection = await this.tenantModels.getConnection(tenantName);

    const ShipmentModel = connection.model(Shipment.name, ShipmentSchema);
    const session = await connection.startSession();

    try {
      await session.withTransaction(async () => {
        let member = await this.membersService.findByEmailNotThrowError(
          memberEmail,
          connection,
          session,
        );

        if (!member) {
          this.logger.error(`Member ${memberEmail} not found`);
          return;
        }

        const refreshed = await this.membersService.findByEmailNotThrowError(
          memberEmail,
          connection,
          session,
        );
        if (!refreshed) {
          this.logger.error(
            `Member with email ${memberEmail} not found during refresh`,
          );
          return;
        }

        member = refreshed;

        const fullName = `${member.firstName} ${member.lastName}`;

        const shipments = await ShipmentModel.find({
          $or: [{ origin: fullName }, { destination: fullName }],
          shipment_status: {
            $in: ['In Preparation', 'On Hold - Missing Data'],
          },
        }).session(session);

        for (const shipment of shipments) {
          let updated = false;

          const originalShipmentData = { ...shipment.toObject() };

          const desirableDateOrigin =
            shipment.originDetails?.desirableDate || '';
          const desirableDateDest =
            shipment.destinationDetails?.desirableDate || '';

          console.log('📌 DNI recibido:', member.dni, typeof member.dni);

          if (shipment.origin === fullName) {
            const originDetails = {
              address: member.address || '',
              apartment: member.apartment || '',
              city: member.city || '',
              country: member.country || '',
              zipCode: member.zipCode || '',
              phone: member.phone || '',
              personalEmail: member.personalEmail || '',
              assignedEmail: member.email,
              contactName: fullName,
              desirableDate: desirableDateOrigin,
              dni:
                typeof member.dni === 'string' && member.dni.trim() !== ''
                  ? member.dni.trim()
                  : null,
            };

            const updatedShipment = await ShipmentModel.findOneAndUpdate(
              { _id: shipment._id },
              { $set: { originDetails } },
              { session, new: true },
            );

            shipment.originDetails = updatedShipment?.originDetails;
            updated = true;
          }

          if (shipment.destination === fullName) {
            const destinationDetails = {
              address: member.address || '',
              apartment: member.apartment || '',
              city: member.city || '',
              country: member.country || '',
              zipCode: member.zipCode || '',
              phone: member.phone || '',
              personalEmail: member.personalEmail || '',
              assignedEmail: member.email,
              contactName: fullName,
              desirableDate: desirableDateDest,
              dni:
                typeof member.dni === 'string' && member.dni.trim() !== ''
                  ? member.dni.trim()
                  : null,
            };

            const updatedShipment = await ShipmentModel.findOneAndUpdate(
              { _id: shipment._id },
              { $set: { destinationDetails } },
              { session, new: true },
            );

            shipment.destinationDetails = updatedShipment?.destinationDetails;
            updated = true;
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
                originalShipmentData,
              );
            }
          }
        }
      });

      this.eventsGateway.notifyTenant(tenantName, 'shipments-update', {
        message: 'Shipments updated after member address change',
        memberEmail,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async getProductsWithContext(
    productIds: Types.ObjectId[],
    tenantId: string,
  ): Promise<ProductDocument[]> {
    const connection = await this.tenantModels.getConnection(tenantId);
    const ProductModel = await this.tenantModels.getProductModel(tenantId);
    const MemberModel =
      await this.tenantModels.getMemberModelFromConnection(connection);

    const products = await ProductModel.find({
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

      for (const member of members) {
        for (const p of member.products) {
          if (
            p._id &&
            remainingIds.some((id) => id.toString() === p._id!.toString())
          ) {
            const enriched = {
              ...(p as any),
              assignedEmail: member.email,
              assignedMember: `${member.firstName} ${member.lastName}`,
              _id: new Types.ObjectId(p._id.toString()),
            };

            products.push(
              enriched as ProductDocument & { _id: Types.ObjectId },
            );
          }
        }
      }
    }

    return products;
  }

  async cancelShipmentWithConsequences(
    shipmentId: string,
    tenantName: string,
    userId: string,
    ourOfficeEmail: string,
  ): Promise<ShipmentDocument> {
    await new Promise((resolve) => process.nextTick(resolve));

    const connection =
      await this.connectionService.getTenantConnection(tenantName);
    const ShipmentModel = connection.model<ShipmentDocument>(
      'Shipment',
      ShipmentSchema,
    );
    const originalShipment = await ShipmentModel.findById(shipmentId);

    if (!originalShipment) {
      throw new NotFoundException(`Shipment ${shipmentId} not found`);
    }

    const originalShipmentData = { ...originalShipment.toObject() };

    const shipment = await this.shipmentsService.cancel(shipmentId, tenantName);

    if (userId) {
      await recordShipmentHistory(
        this.historyService,
        'cancel',
        userId,
        originalShipmentData,
        shipment.toObject(),
      );
    } else {
      console.warn(
        '⚠️ userId no definido, se omitirá el registro en el historial',
      );
    }

    await this.cancelAllProductsInShipment(shipment.products, tenantName);

    if (originalShipmentData.shipment_status === 'In Preparation') {
      const userInfo = await this.getUserInfoFromUserId(userId);

      const slackMessage = CreateShipmentMessageToSlack({
        shipment,
        tenantName,
        isOffboarding: false,
        status: 'Cancelled',
        ourOfficeEmail,
        userInfo: userInfo,
      });
      await this.slackService.sendMessage(slackMessage);
    } else {
      console.log(
        `🔇 Shipment was in "${originalShipmentData.shipment_status}" status, skipping Slack notification for cancellation.`,
      );
    }

    const originEmail = shipment.originDetails?.assignedEmail;
    const destinationEmail = shipment.destinationDetails?.assignedEmail;

    if (originEmail) {
      await this.clearMemberActiveShipmentFlagIfNoOtherShipments(
        originEmail,
        tenantName,
      );
    }

    if (destinationEmail) {
      await this.clearMemberActiveShipmentFlagIfNoOtherShipments(
        destinationEmail,
        tenantName,
      );
    }

    return shipment;
  }

  async getShipmentsByMember(
    memberEmail: string,
    tenantName: string,
  ): Promise<ShipmentDocument[]> {
    const ShipmentModel = await this.tenantModels.getShipmentModel(tenantName);
    const MemberModel = await this.tenantModels.getMemberModel(tenantName);

    const member = await MemberModel.findOne({
      email: memberEmail,
      isDeleted: { $ne: true },
    });

    if (!member) return [];

    const fullName = `${member.firstName} ${member.lastName}`;

    const query = {
      shipment_status: {
        $in: ['In Preparation', 'On Hold - Missing Data', 'On The Way'],
      },
      $or: [{ origin: fullName }, { destination: fullName }],
    };

    return ShipmentModel.find(query);
  }

  async getShipmentsByMemberEmail(
    memberEmail: string,
    tenantName: string,
    activeOnly: boolean = true,
  ): Promise<ShipmentDocument[]> {
    await new Promise((resolve) => process.nextTick(resolve));

    const ShipmentModel = await this.tenantModels.getShipmentModel(tenantName);
    const MemberModel = await this.tenantModels.getMemberModel(tenantName);

    let fullName = '';
    try {
      const member = await MemberModel.findOne({
        email: memberEmail,
        isDeleted: { $ne: true },
      });
      if (member) {
        fullName = `${member.firstName} ${member.lastName}`;
      }
    } catch (e) {
      console.warn(`No se pudo encontrar al miembro con email: ${memberEmail}`);
    }

    const query: any = {
      $or: [
        { 'originDetails.assignedEmail': memberEmail },
        { 'destinationDetails.assignedEmail': memberEmail },
      ],
      isDeleted: { $ne: true },
    };

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
      '🧭 [Logistics] Buscando shipments por email con query:',
      JSON.stringify(query, null, 2),
    );

    return ShipmentModel.find(query).sort({ createdAt: -1 });
  }

  public async updateProductStatusToMissingData(
    productId: string,
    connection: mongoose.Connection,
    session: ClientSession,
    tenantName?: string,
  ): Promise<ProductDocument | null> {
    const ProductModel =
      connection.models.Product || connection.model('Product', ProductSchema);

    const MemberModel =
      connection.models.Member || connection.model('Member', MemberSchema);

    const product = await ProductModel.findById(productId).session(session);

    if (product && product.status === 'In Transit') {
      product.status = 'In Transit - Missing Data';
      await product.save({ session });

      // 🌐 SINCRONIZAR A GLOBAL COLLECTION
      if (tenantName) {
        try {
          await this.globalProductSyncService.syncProduct({
            tenantId: tenantName,
            tenantName: tenantName,
            originalProductId: new Types.ObjectId(productId),
            sourceCollection: 'products',
            name: product.name || '',
            category: product.category || '',
            status: 'In Transit - Missing Data',
            location: product.location || '',
            attributes: product.attributes || [],
            serialNumber: product.serialNumber,
            assignedEmail: product.assignedEmail,
            assignedMember: product.assignedMember,
            lastAssigned: product.lastAssigned,
            acquisitionDate: product.acquisitionDate,
            price: product.price,
            additionalInfo: product.additionalInfo,
            productCondition: product.productCondition,
            recoverable: product.recoverable,
            fp_shipment: product.fp_shipment,
            activeShipment: product.activeShipment,
            imageUrl: product.imageUrl,
            isDeleted: product.isDeleted,
            fpWarehouse: product.fpWarehouse,
          });
          console.log(
            `🌐 [updateProductStatusToMissingData] Global sync completed for product ${productId}`,
          );
        } catch (error) {
          console.error(
            `❌ [updateProductStatusToMissingData] Global sync failed for product ${productId}:`,
            error,
          );
        }
      }

      return product;
    }
    if (!product) {
      console.log(
        `❌ Producto no encontrado en colección general: ${productId}`,
      );
    }

    console.log('🛠 Intentando updateOne en MemberModel para', productId);
    console.log('🛠 Query:', {
      'products._id': productId,
      'products.status': 'In Transit',
    });

    const memberWithProduct = await MemberModel.findOne({
      'products._id': new Types.ObjectId(productId),
    }).session(session);

    if (!memberWithProduct) {
      return null;
    }

    const targetProduct = memberWithProduct.products.find(
      (p: any) => p._id?.toString() === productId,
    );

    if (!targetProduct) {
      return null;
    }

    if (targetProduct.status !== 'In Transit') {
      return null;
    }

    const updateResult = await this.executeWithRetry(
      () =>
        MemberModel.updateOne(
          {
            'products._id': new Types.ObjectId(productId),
          },
          {
            $set: { 'products.$.status': 'In Transit - Missing Data' },
          },
          { session },
        ),
      `updateProductStatusToMissingData-${productId}`,
    );
    console.log(
      '[🧪] Resultado del updateOne a member.products:',
      updateResult,
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

        // 🌐 SINCRONIZAR A GLOBAL COLLECTION
        if (tenantName) {
          try {
            await this.globalProductSyncService.syncProduct({
              tenantId: tenantName,
              tenantName: tenantName,
              originalProductId: new Types.ObjectId(productId),
              sourceCollection: 'members',
              name: enrichedProduct.name || '',
              category: enrichedProduct.category || '',
              status: 'In Transit - Missing Data',
              location: enrichedProduct.location || '',
              attributes: enrichedProduct.attributes || [],
              serialNumber: enrichedProduct.serialNumber,
              assignedEmail: enrichedProduct.assignedEmail,
              assignedMember: enrichedProduct.assignedMember,
              lastAssigned: enrichedProduct.lastAssigned,
              acquisitionDate: enrichedProduct.acquisitionDate,
              price: enrichedProduct.price,
              additionalInfo: enrichedProduct.additionalInfo,
              productCondition: enrichedProduct.productCondition,
              recoverable: enrichedProduct.recoverable,
              fp_shipment: enrichedProduct.fp_shipment,
              activeShipment: enrichedProduct.activeShipment,
              imageUrl: enrichedProduct.imageUrl,
              isDeleted: enrichedProduct.isDeleted,
              fpWarehouse: enrichedProduct.fpWarehouse,
              memberData: {
                memberId: member._id,
                memberEmail: member.email,
                memberName: `${member.firstName} ${member.lastName}`,
                assignedAt: new Date(),
              },
            });
            console.log(
              `🌐 [updateProductStatusToMissingData] Global sync completed for member product ${productId}`,
            );
          } catch (error) {
            console.error(
              `❌ [updateProductStatusToMissingData] Global sync failed for member product ${productId}:`,
              error,
            );
          }
        }

        return enrichedProduct as ProductDocument;
      }
    }

    return null;
  }

  public async updateProductStatusToInTransit(
    productId: string,
    connection: mongoose.Connection,
    session: ClientSession,
    tenantName?: string,
  ): Promise<ProductDocument | null> {
    try {
      const ProductModel =
        connection.models.Product || connection.model('Product', ProductSchema);

      const MemberModel =
        connection.models.Member || connection.model('Member', MemberSchema);

      const product = await ProductModel.findById(productId).session(session);

      if (product) {
        console.log(
          `⚠️ Producto encontrado en colección general con estado: ${product.status}`,
        );
        if (product.status === 'In Transit - Missing Data') {
          product.status = 'In Transit';
          await product.save({ session });

          // 🌐 SINCRONIZAR A GLOBAL COLLECTION
          if (tenantName) {
            try {
              await this.globalProductSyncService.syncProduct({
                tenantId: tenantName,
                tenantName: tenantName,
                originalProductId: new Types.ObjectId(productId),
                sourceCollection: 'products',
                name: product.name || '',
                category: product.category || '',
                status: 'In Transit',
                location: product.location || '',
                attributes: product.attributes || [],
                serialNumber: product.serialNumber,
                assignedEmail: product.assignedEmail,
                assignedMember: product.assignedMember,
                lastAssigned: product.lastAssigned,
                acquisitionDate: product.acquisitionDate,
                price: product.price,
                additionalInfo: product.additionalInfo,
                productCondition: product.productCondition,
                recoverable: product.recoverable,
                fp_shipment: product.fp_shipment,
                activeShipment: product.activeShipment,
                imageUrl: product.imageUrl,
                isDeleted: product.isDeleted,
                fpWarehouse: product.fpWarehouse,
              });
              console.log(
                `🌐 [updateProductStatusToInTransit] Global sync completed for product ${productId}`,
              );
            } catch (error) {
              console.error(
                `❌ [updateProductStatusToInTransit] Global sync failed for product ${productId}:`,
                error,
              );
            }
          }
        }
        return product;
      }

      console.log(
        `❌ Producto no encontrado en colección general: ${productId}`,
      );

      // Primero verificar que el producto específico tenga el status correcto
      const memberWithProduct = await MemberModel.findOne({
        'products._id': new Types.ObjectId(productId),
      }).session(session);

      if (!memberWithProduct) {
        return null;
      }

      const targetProduct = memberWithProduct.products.find(
        (p) => p._id?.toString() === productId,
      );

      if (!targetProduct) {
        return null;
      }

      if (targetProduct.status !== 'In Transit - Missing Data') {
        return null;
      }

      const updateResult = await this.executeWithRetry(
        () =>
          MemberModel.updateOne(
            {
              'products._id': new Types.ObjectId(productId),
            },
            {
              $set: { 'products.$.status': 'In Transit' },
            },
            { session },
          ),
        `updateProductStatusToInTransit-${productId}`,
      );

      if (updateResult.modifiedCount > 0) {
        console.log(
          `✅ [IN_TRANSIT] Updated product status in Member collection: ${productId}`,
        );

        // Verificar que realmente se actualizó
        const member = await MemberModel.findOne({
          'products._id': new Types.ObjectId(productId),
        }).session(session);

        if (member) {
          const updatedProduct = member.products.find(
            (p) => p._id?.toString() === productId,
          );
          if (updatedProduct) {
            console.log(
              `🔍 [IN_TRANSIT] Status después de actualización: "${updatedProduct.status}"`,
            );
          }
        }

        const foundProduct = member?.products.find(
          (p) => p._id?.toString() === productId.toString(),
        );
        console.log(
          `🔍 [CHECK] Buscando producto con ID: ${productId} entre:`,
          member?.products.map((p) => p._id?.toString()),
        );
        const allMatching = member?.products.filter(
          (p) => p._id?.toString() === productId.toString(),
        );
        console.log(
          `🔍 [MULTI MATCH] Productos que matchean ID ${productId}:`,
          allMatching,
        );

        if (foundProduct) {
          const original = { ...(foundProduct.toObject?.() ?? foundProduct) };

          const enrichedProduct = {
            ...original,
            status: 'In Transit',
            assignedEmail: member.email,
            assignedMember: `${member.firstName} ${member.lastName}`,
          };

          // 🌐 SINCRONIZAR A GLOBAL COLLECTION
          if (tenantName) {
            try {
              await this.globalProductSyncService.syncProduct({
                tenantId: tenantName,
                tenantName: tenantName,
                originalProductId: new Types.ObjectId(productId),
                sourceCollection: 'members',
                name: enrichedProduct.name || '',
                category: enrichedProduct.category || '',
                status: 'In Transit',
                location: enrichedProduct.location || '',
                attributes: enrichedProduct.attributes || [],
                serialNumber: enrichedProduct.serialNumber,
                assignedEmail: enrichedProduct.assignedEmail,
                assignedMember: enrichedProduct.assignedMember,
                lastAssigned: enrichedProduct.lastAssigned,
                acquisitionDate: enrichedProduct.acquisitionDate,
                price: enrichedProduct.price,
                additionalInfo: enrichedProduct.additionalInfo,
                productCondition: enrichedProduct.productCondition,
                recoverable: enrichedProduct.recoverable,
                fp_shipment: enrichedProduct.fp_shipment,
                activeShipment: enrichedProduct.activeShipment,
                imageUrl: enrichedProduct.imageUrl,
                isDeleted: enrichedProduct.isDeleted,
                fpWarehouse: enrichedProduct.fpWarehouse,
                memberData: {
                  memberId: member._id,
                  memberEmail: member.email,
                  memberName: `${member.firstName} ${member.lastName}`,
                  assignedAt: new Date(),
                },
              });
              console.log(
                `🌐 [updateProductStatusToInTransit] Global sync completed for member product ${productId}`,
              );
            } catch (error) {
              console.error(
                `❌ [updateProductStatusToInTransit] Global sync failed for member product ${productId}:`,
                error,
              );
            }
          }

          return enrichedProduct as ProductDocument;
        }
      } else {
        console.log(
          `ℹ️ [IN_TRANSIT] Product ${productId} status in member was not 'In Transit - Missing Data' or not found`,
        );
      }

      return null;
    } catch (error) {
      console.error(`❌ Error updating product ${productId} status:`, error);
      throw error;
    }
  }

  public async updateShipmentStatusOnAddressComplete(
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
      const originCode = this.shipmentsService.getLocationCode(
        shipment.origin,
        shipment.originDetails,
        shipment.originOfficeId?.toString(),
      );
      const destinationCode = this.shipmentsService.getLocationCode(
        shipment.destination,
        shipment.destinationDetails,
        shipment.destinationOfficeId?.toString(),
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
        shipment.originOfficeId?.toString(),
      );
      const destinationComplete = this.areShipmentDetailsComplete(
        shipment.destinationDetails,
        shipment.destination,
        shipment.destinationOfficeId?.toString(),
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
            tenantName,
          );

          const product = await this.findProductAcrossCollections(
            tenantName,
            productId.toString(),
            session,
          );

          if (product) {
            updatedProducts.push(product as ProductDocument);
          }
        }

        await this.shipmentsService.createSnapshots(shipment, connection, {
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
            tenantName,
          );
          if (updatedProduct) {
            updatedProducts.push(updatedProduct);
          }
        }

        console.log('📸 Generating downgrade product snapshots...');
        await this.shipmentsService.createSnapshots(shipment, connection, {
          providedProducts: updatedProducts,
          force: true,
        });
      }

      if (newStatus !== shipment.shipment_status) {
        const oldStatus = shipment.shipment_status;

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

        // 🏢 UPDATE: Coordinar actualización de flags de oficinas si el estado cambió
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

      // TODO: Status On Hold - Missing Data
      if (
        newStatus === 'On Hold - Missing Data' &&
        shipment.shipment_status !== 'On Hold - Missing Data'
      ) {
        // ✅ Obtener información del usuario desde el JWT
        const userInfo = await this.getUserInfoFromUserId(userId);

        const slackMessage = CreateShipmentMessageToSlack({
          shipment: shipment,
          tenantName: tenantName,
          isOffboarding: false,
          status: 'Missing Data',
          ourOfficeEmail: ourOfficeEmail,
          userInfo: userInfo,
        });
        await this.slackService.sendMessage(slackMessage);
      }

      if (
        newStatus === 'In Preparation' &&
        shipment.shipment_status !== 'In Preparation'
      ) {
        // ✅ Obtener información del usuario desde el JWT
        const userInfo = await this.getUserInfoFromUserId(userId);

        const slackMessage = CreateShipmentMessageToSlack({
          shipment: shipment,
          tenantName: tenantName,
          isOffboarding: false,
          status: 'Updated',
          previousShipment: originalShipment,
          ourOfficeEmail: ourOfficeEmail,
          userInfo: userInfo,
        });
        await this.slackService.sendMessage(slackMessage);
      }

      return newStatus;
    } catch (error) {
      console.error(
        '❌ Error in updateShipmentStatusOnAddressComplete:',
        error,
      );
      throw error;
    }
  }

  private hasRelevantDetailsChanged(
    oldOrigin: any,
    newOrigin: any,
    oldDestination: any,
    newDestination: any,
  ): boolean {
    // Solo los campos que realmente se actualizan en la oficina
    const officeRelevantFields = [
      'address',
      'city',
      'state',
      'country',
      'zipCode',
      'apartment',
      'phone',
      'desirableDate',
    ];

    // Para miembros incluimos también campos personales
    const memberRelevantFields = [
      'address',
      'city',
      'country',
      'zipCode',
      'apartment',
      'phone',
      'personalEmail',
      'dni',
      'desirableDate',
    ];

    // Verificar cambios en origin - solo campos relevantes
    const fieldsToCheckOrigin = this.isOfficeLocation(oldOrigin)
      ? officeRelevantFields
      : memberRelevantFields;

    for (const field of fieldsToCheckOrigin) {
      if (oldOrigin?.[field] !== newOrigin?.[field]) {
        return true;
      }
    }

    // Verificar cambios en destination - solo campos relevantes
    const fieldsToCheckDestination = this.isOfficeLocation(oldDestination)
      ? officeRelevantFields
      : memberRelevantFields;

    for (const field of fieldsToCheckDestination) {
      if (oldDestination?.[field] !== newDestination?.[field]) {
        return true;
      }
    }

    return false;
  }

  private isOfficeLocation(details: any): boolean {
    // Determinar si es oficina basado en la presencia de email vs personalEmail
    return details?.email && !details?.personalEmail;
  }

  public async updateShipmentOnAddressComplete(
    shipment: ShipmentDocument,
    connection: mongoose.Connection,
    session: ClientSession,
    userId: string,
    tenantId: string,
    ourOfficeEmail: string,
    originalShipmentData?: any,
  ): Promise<string> {
    try {
      console.log(
        '🔍 [SLACK_DEBUG] originalShipmentData provided:',
        !!originalShipmentData,
      );

      const originalShipment = originalShipmentData || {
        ...shipment.toObject(),
      };

      const detailsChanged = this.hasRelevantDetailsChanged(
        originalShipment.originDetails,
        shipment.originDetails,
        originalShipment.destinationDetails,
        shipment.destinationDetails,
      );

      // Ejecutar la lógica completa de actualización de estado
      const newStatus = await this.updateShipmentStatusOnAddressComplete(
        shipment,
        connection,
        session,
        userId,
        tenantId,
        ourOfficeEmail,
      );

      // Verificar si necesitamos enviar notificación adicional por cambio de detalles
      // (solo si ambos estados son 'In Preparation' y hubo cambios en los detalles)
      if (
        originalShipment.shipment_status === 'In Preparation' &&
        newStatus === 'In Preparation' &&
        detailsChanged
      ) {
        console.log(
          '🔍 [SLACK_DEBUG] ✅ Sending Slack notification for shipment details update',
        );

        const userInfo = await this.getUserInfoFromUserId(userId);

        const slackMessage = CreateShipmentMessageToSlack({
          shipment: shipment,
          tenantName: tenantId,
          isOffboarding: false,
          status: 'Updated',
          previousShipment: originalShipment,
          ourOfficeEmail: ourOfficeEmail,
          userInfo: userInfo,
        });
        await this.slackService.sendMessage(slackMessage);
      } else {
      }

      return newStatus;
    } catch (error) {
      console.error('❌ Error updating shipment:', error);
      throw error;
    }
  }

  async updateSnapshotsForProduct(
    productId: string,
    tenantName: string,
  ): Promise<void> {
    await new Promise((resolve) => process.nextTick(resolve));
    const connection =
      await this.connectionService.getTenantConnection(tenantName);

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

        const hasChanges = this.shipmentsService.hasSnapshotChanged(
          existingSnapshot,
          updatedSnapshot,
        );

        if (hasChanges) {
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

  /**
   * Ejecuta una operación con retry automático en caso de Write Conflicts
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 3,
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Solo reintentar en Write Conflicts
        if (error.code === 112 || error.codeName === 'WriteConflict') {
          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt - 1) * 100; // 100ms, 200ms, 400ms
            console.log(
              `⚠️ Write Conflict en ${operationName} (intento ${attempt}/${maxRetries}). Reintentando en ${delay}ms...`,
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          } else {
            console.error(
              `❌ ${operationName} falló después de ${maxRetries} intentos por Write Conflicts`,
            );
          }
        }

        // Si no es Write Conflict o se agotaron los reintentos, lanzar error
        throw error;
      }
    }

    throw lastError;
  }
}
