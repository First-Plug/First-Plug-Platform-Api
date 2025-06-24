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
import { MemberDocument } from 'src/members/schemas/member.schema';
import mongoose, { ClientSession, Types } from 'mongoose';
import { ShipmentDocument } from 'src/shipments/schema/shipment.schema';
import { UpdateProductDto } from 'src/products/dto';
import { ProductDocument } from 'src/products/schemas/product.schema';
import { CreateShipmentMessageToSlack } from 'src/shipments/helpers/create-message-to-slack';
import { SlackService } from 'src/slack/slack.service';
import { ShipmentsService } from 'src/shipments/shipments.service';
import { HistoryService } from 'src/history/history.service';
import { TenantConnectionService } from 'src/infra/db/tenant-connection.service';
import { countryCodes } from 'src/shipments/helpers/countryCodes';
import { Product } from 'src/products/schemas/product.schema';
import { TenantsService } from 'src/tenants/tenants.service';

@Injectable()
export class LogisticsService {
  private readonly logger = new Logger(LogisticsService.name);

  constructor(
    private readonly tenantModels: TenantModelRegistry,
    private eventEmitter: EventEmitter2,
    private readonly connectionService: TenantConnectionService,
    @Inject(forwardRef(() => ShipmentsService))
    private readonly shipmentsService: ShipmentsService,
    private readonly historyService: HistoryService,
    private readonly slackService: SlackService,
    private readonly tenantsService: TenantsService,
  ) {}

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
    const modified = this.hasPersonalDataChanged(initialMember, updatedMember);

    if (!modified) return;

    if (!updatedMember.activeShipment) {
      this.logger.debug('No event emitted: member has no active shipment');
      return;
    }

    this.logger.debug('Emitting MEMBER_ADDRESS_UPDATED event');

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
        this.logger.debug(
          `🔄 Campo ${field} ha cambiado: ${normalizedBefore} -> ${normalizedAfter}`,
        );
        return true;
      }
    }

    return false;
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
    };
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
    },
    newData: {
      location?: string;
      assignedEmail?: string;
      assignedMember?: string;
    },
    userId: string,
    ourOfficeEmail: string,
  ): Promise<ShipmentDocument | null> {
    console.log(
      'called user id from maybeCreateShipmentAndUpdateStatus',
      userId,
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
      await this.connectionService.getTenantConnection(tenantName);

    const { shipment, isConsolidated, oldSnapshot } =
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

    const newStatus =
      shipment.shipment_status === 'On Hold - Missing Data'
        ? 'In Transit - Missing Data'
        : 'In Transit';

    product.status = newStatus;
    updateDto.status = newStatus;

    await product.save({ session });

    await this.shipmentsService.createSnapshots(shipment, connection, {
      providedProducts: [product],
    });

    console.log('[HISTORY DEBUG]', {
      actionType: isConsolidated ? 'consolidate' : 'create',
      userId,
      oldSnapshot,
      newData: shipment,
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
      const slackMessage = CreateShipmentMessageToSlack({
        shipment: shipment,
        tenantName: tenantName,
        isOffboarding: false,
        status: 'New',
        ourOfficeEmail: ourOfficeEmail,
      });
      await this.slackService.sendMessage(slackMessage);
    }

    //TODO: Status consolidate
    if (isConsolidated) {
      const slackMessage = CreateShipmentMessageToSlack({
        shipment: shipment,
        tenantName: tenantName,
        isOffboarding: false,
        status: 'Consolidated',
        previousShipment: oldSnapshot,
        ourOfficeEmail: ourOfficeEmail,
      });

      await this.slackService.sendMessage(slackMessage);
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
  ): Promise<ShipmentDocument | null> {
    console.log('tryCreateShipmentIfNeeded called with userId:', userId);
    return await this.maybeCreateShipmentAndUpdateStatus(
      product,
      updateDto,
      tenantName,
      updateDto.actionType ?? '',
      session,
      {
        location: product.location,
        assignedEmail: product.assignedEmail,
        assignedMember: product.assignedMember,
      },
      {
        location: updateDto.location,
        assignedEmail: updateDto.assignedEmail,
        assignedMember: updateDto.assignedMember,
      },
      userId,
      ourOfficeEmail,
    );
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
    if (country === 'Our office') {
      return 'OO';
    }

    return countryCodes[country] || 'XX';
  }

  public async isLocationDataComplete(
    product: Partial<Product>,
    tenantName: string,
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
    },
    newData?: {
      location?: string;
      assignedEmail?: string;
      assignedMember?: string;
    },
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
    const found = await this.tenantModels
      .getProductModel(tenantName)
      .then((ProductModel) => ProductModel.findById(productId).lean());

    if (!found) {
      throw new NotFoundException(`Product ${productId} not found.`);
    }

    const product = found;
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
          )
          .then((res) => res.details);

    const destinationDetails = await this.shipmentsService
      .getLocationInfo(
        destinationLocation,
        tenantName,
        newData?.assignedEmail || '',
        newData?.assignedMember || '',
        destinationDate,
      )
      .then((res) => res.details);

    const destinationComplete = await this.isLocationDataComplete(
      { ...product, location: destinationLocation, assignedEmail },
      tenantName,
    );

    const originComplete = await this.isLocationDataComplete(
      {
        ...product,
        location: originLocation,
        assignedEmail: oldData?.assignedEmail || '',
      },
      tenantName,
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

      // Evitar duplicados en shipment.products
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

      // Agregar snapshot solo si no existe
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
  ): Promise<boolean> {
    const originComplete = this.areShipmentDetailsComplete(
      shipment.originDetails,
      shipment.origin,
    );

    const destinationComplete = this.areShipmentDetailsComplete(
      shipment.destinationDetails,
      shipment.destination,
    );

    return originComplete && destinationComplete;
  }

  public areShipmentDetailsComplete(
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
}
