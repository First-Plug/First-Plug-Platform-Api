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
import mongoose, { ClientSession, Types } from 'mongoose';
import { ShipmentDocument } from 'src/shipments/schema/shipment.schema';
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
import { countryCodes } from 'src/shipments/helpers/countryCodes';
import { Product } from 'src/products/schemas/product.schema';
import { TenantsService } from 'src/tenants/tenants.service';
import { ProductsService } from 'src/products/products.service';
import { Status } from 'src/products/interfaces/product.interface';
import { AddressData } from 'src/infra/event-bus/tenant-address-update.event';
import { MembersService } from 'src/members/members.service';
import { recordShipmentHistory } from 'src/shipments/helpers/recordShipmentHistory';

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
    @Inject(forwardRef(() => ProductsService))
    private readonly productsService: ProductsService,
    @Inject(forwardRef(() => MembersService))
    private readonly membersService: MembersService,
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
        product,
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
    if (isConsolidated && shipment.shipment_status === 'In Preparation') {
      const slackMessage = CreateShipmentMessageToSlack({
        shipment: shipment,
        tenantName: tenantName,
        isOffboarding: false,
        status: 'Consolidated',
        previousShipment: oldSnapshot,
        ourOfficeEmail: ourOfficeEmail,
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
    providedProduct?: ProductDocument,
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
      (await this.tenantModels
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
      console.log('📦 Processing product (cancel):', productId);

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

        console.log(`✅ Product updated from Product collection:`, {
          id: product._id,
          status,
        });
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

          console.log(`✅ Product updated from Member collection:`, {
            id: productId,
            status,
          });
        } else {
          console.log('❌ Product not found in any collection');
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
  ) {
    console.log('📍 Marking active shipment targets:', {
      origin,
      destination,
      originEmail,
      destinationEmail,
    });

    const connection = await this.tenantModels.getConnection(tenantName);
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
    if (typeof memberEmail !== 'string') {
      console.warn(
        `❌ Email inválido recibido en clearMemberActiveShipmentFlagIfNoOtherShipments:`,
        memberEmail,
      );
      return;
    }

    const normalizedEmail = memberEmail.trim().toLowerCase();
    const connection = await this.tenantModels.getConnection(tenantId);
    const ShipmentModel = await this.tenantModels.getShipmentModel(tenantId);
    const MemberModel =
      this.tenantModels.getMemberModelFromConnection(connection);

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
  ) {
    console.log('🔄 Starting office address update:', {
      tenantName,
      oldAddress,
      newAddress,
    });
    await new Promise((resolve) => process.nextTick(resolve));
    const connection = await this.tenantModels.getConnection(tenantName);
    const ShipmentModel = await this.tenantModels.getShipmentModel(tenantName);
    const session = await connection.startSession();

    try {
      await session.withTransaction(async () => {
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

              await this.shipmentsService.updateShipmentStatusOnAddressComplete(
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
    const connection = await this.tenantModels.getConnection(tenantName);
    const ShipmentModel = await this.tenantModels.getShipmentModel(tenantName);
    const session = await connection.startSession();

    try {
      await session.withTransaction(async () => {
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
              await this.shipmentsService.updateShipmentOnAddressComplete(
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
    console.log('🚨 [CANCEL SHIPMENT] Start for', shipmentId);

    await new Promise((resolve) => process.nextTick(resolve));

    const shipment = await this.shipmentsService.cancel(shipmentId, tenantName);
    const originalShipment = { ...shipment.toObject() };

    if (userId) {
      await recordShipmentHistory(
        this.historyService,
        'cancel',
        userId,
        originalShipment,
        shipment.toObject(),
      );
    } else {
      console.warn(
        '⚠️ userId no definido, se omitirá el registro en el historial',
      );
    }

    await this.cancelAllProductsInShipment(
      shipment.products,
      tenantName,
      // userId (si lo usás internamente)
    );

    const slackMessage = CreateShipmentMessageToSlack({
      shipment,
      tenantName,
      isOffboarding: false,
      status: 'Cancelled',
      ourOfficeEmail,
    });
    await this.slackService.sendMessage(slackMessage);

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

        return enrichedProduct as ProductDocument;
      }
    }

    return null;
  }
}
