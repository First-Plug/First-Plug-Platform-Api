import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Product,
  ProductDocument,
  ProductSchema,
} from 'src/products/schemas/product.schema';
import {
  Member,
  MemberDocument,
  MemberSchema,
} from 'src/members/schemas/member.schema';
import mongoose, { Model, Schema, Types, ObjectId, Connection } from 'mongoose';
import { HistoryService } from 'src/history/history.service';
import { SlackService } from 'src/slack/slack.service';
import { ClientSession } from 'mongoose';
import { CreateProductDto } from 'src/products/dto/create-product.dto';
import { MembersService } from 'src/members/members.service';
import { Status } from 'src/products/interfaces/product.interface';
import { ProductsService } from 'src/products/products.service';
import { TenantConnectionService } from 'src/infra/db/tenant-connection.service';
import { UpdateProductDto } from 'src/products/dto';
import { TenantsService } from 'src/tenants/tenants.service';
import { TenantUserAdapterService } from 'src/common/services/tenant-user-adapter.service';
import { HistoryActionType } from 'src/history/validations/create-history.zod';
import { UsersService } from 'src/users/users.service';
import { recordEnhancedAssetHistory } from 'src/products/helpers/history.helper';
import { ShipmentDocument } from 'src/shipments/schema/shipment.schema';
import { BulkReassignDto } from 'src/assignments/dto/bulk-reassign.dto';
import { TenantModelRegistry } from 'src/infra/db/tenant-model-registry';
import { LogisticsService } from 'src/logistics/logistics.sevice';
import { ensureObjectId } from './utils/ensureObjectId';
import {
  CurrencyCode,
  CURRENCY_CODES,
} from 'src/products/validations/create-product.zod';
import { GlobalProductSyncService } from 'src/products/services/global-product-sync.service';
import { LastAssignedHelper } from 'src/products/helpers/last-assigned.helper';
import { WarehouseAssignmentService } from 'src/warehouses/services/warehouse-assignment.service';
import { OfficesService } from 'src/offices/offices.service';
import { CSVOfficeCoordinatorService } from 'src/products/services/csv-office-coordinator.service';

@Injectable()
export class AssignmentsService {
  private readonly logger = new Logger(AssignmentsService.name);

  constructor(
    @Inject('MEMBER_MODEL') private readonly memberModel: Model<Member>,
    private readonly connectionService: TenantConnectionService,
    private readonly tenantsService: TenantsService,
    private readonly tenantUserAdapter: TenantUserAdapterService,
    private readonly historyService: HistoryService,
    private readonly slackService: SlackService,
    @Inject(forwardRef(() => MembersService))
    private readonly membersService: MembersService,
    @Inject(forwardRef(() => ProductsService))
    private readonly productsService: ProductsService,
    @Inject('PRODUCT_MODEL')
    private readonly productRepository: Model<Product>,
    private readonly tenantModelRegistry: TenantModelRegistry,
    @Inject(forwardRef(() => LogisticsService))
    private readonly logisticsService: LogisticsService,
    private readonly globalProductSyncService: GlobalProductSyncService,
    private readonly lastAssignedHelper: LastAssignedHelper,
    private readonly warehouseAssignmentService: WarehouseAssignmentService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => OfficesService))
    private readonly officesService: OfficesService,
    private readonly csvOfficeCoordinatorService: CSVOfficeCoordinatorService,
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

  /**
   * Helper para obtener el país de origen de un member por email
   */
  private async getMemberOriginCountry(
    memberEmail: string,
    tenantName: string,
  ): Promise<string | null> {
    try {
      const MemberModel =
        await this.tenantModelRegistry.getMemberModel(tenantName);

      const member = await MemberModel.findOne({ email: memberEmail }).lean();

      if (!member) {
        return null;
      }

      if (!member.country) {
        return null;
      }

      return member.country;
    } catch (error) {
      return null;
    }
  }

  /**
   * Determinar el status correcto del warehouse basado en el estado del producto
   */
  private determineWarehouseStatus(
    product: any,
    isComingToWarehouse: boolean = true,
  ): 'STORED' | 'IN_TRANSIT_IN' | 'IN_TRANSIT_OUT' {
    // Si el producto tiene shipment activo
    if (product.fp_shipment === true || product.activeShipment === true) {
      const status = isComingToWarehouse ? 'IN_TRANSIT_IN' : 'IN_TRANSIT_OUT';

      return status;
    }

    // Si el producto está disponible y no tiene shipment activo
    if (product.status === 'Available' && !product.activeShipment) {
      return 'STORED';
    }

    // Si el producto está en tránsito hacia el warehouse
    if (
      (product.status === 'In Transit' ||
        product.status === 'In Transit - Missing Data') &&
      product.location === 'FP warehouse'
    ) {
      return 'IN_TRANSIT_IN';
    }

    // Default: STORED

    return 'STORED';
  }

  /**
   * Helper para asignar warehouse cuando location cambia a "FP warehouse"
   * @param memberEmail - Email del member de origen (opcional, si se conoce)
   * @param userName - Nombre del usuario que realiza la acción (para notificaciones)
   * @param action - Tipo de acción: assign, reassign, return
   */
  private async assignWarehouseIfNeeded(
    updateDto: UpdateProductDto,
    product: any,
    tenantName: string,
    memberEmail?: string,
    userName?: string,
    action?: 'assign' | 'reassign' | 'return',
  ): Promise<any> {
    // Solo procesar si location cambia a "FP warehouse"
    if (updateDto.location !== 'FP warehouse') {
      return {};
    }

    try {
      // 1. Determinar país de origen
      let originCountry: string | null = null;

      // 🏢 PRIORIDAD 1: Si el producto viene de "Our office", usar el país de la oficina PRIMERO
      if (
        product.location === 'Our office' &&
        product.office?.officeCountryCode
      ) {
        originCountry = product.office.officeCountryCode;
      }

      // PRIORIDAD 2: Si se proporciona memberEmail directamente (más confiable), usar ese
      if (!originCountry && memberEmail) {
        originCountry = await this.getMemberOriginCountry(
          memberEmail,
          tenantName,
        );
      }

      // PRIORIDAD 3: Si no se proporcionó memberEmail, intentar con lastAssigned
      if (!originCountry && product.lastAssigned) {
        originCountry = await this.getMemberOriginCountry(
          product.lastAssigned,
          tenantName,
        );
      }

      // PRIORIDAD 4: Si no tiene lastAssigned pero tiene assignedEmail actual, usar ese
      if (!originCountry && product.assignedEmail) {
        originCountry = await this.getMemberOriginCountry(
          product.assignedEmail,
          tenantName,
        );
      }

      // Si no se puede determinar el país, usar Argentina por defecto
      if (!originCountry) {
        originCountry = 'Argentina';
      }

      // 2. 🔄 USAR SERVICIO TRANSVERSAL - WarehouseAssignmentService con notificación

      const assignmentResult =
        await this.warehouseAssignmentService.assignProductToWarehouseWithNotification(
          originCountry,
          tenantName,
          product._id.toString(),
          product.category || 'Unknown',
          userName || 'Unknown User',
          action || 'assign',
          1,
        );

      if (!assignmentResult.success || !assignmentResult.warehouseId) {
        return {};
      }

      // 3. Crear esquema fpWarehouse con datos del servicio transversal
      // 🔄 DETERMINAR STATUS CORRECTO basado en el estado del producto
      const warehouseStatus = this.determineWarehouseStatus(
        { ...product, ...updateDto }, // Combinar datos actuales con updates
        true, // isComingToWarehouse = true (producto viene hacia warehouse)
      );

      const fpWarehouseData = {
        warehouseId: assignmentResult.warehouseId,
        warehouseCountryCode: assignmentResult.warehouseCountryCode!,
        warehouseName: assignmentResult.warehouseName!,
        assignedAt: new Date(),
        status: warehouseStatus,
      };

      // Log si se envió notificación Slack
      if (assignmentResult.requiresSlackNotification) {
        this.logger.log(
          `📢 [assignWarehouseIfNeeded] Slack notification: ${assignmentResult.slackMessage}`,
        );
      }

      return { fpWarehouse: fpWarehouseData };
    } catch (error) {
      return {};
    }
  }

  /**
   * Helper method para sincronizar producto a la colección global
   * No falla la operación principal si hay error en sincronización
   */
  public async syncProductToGlobal(
    product: ProductDocument | any,
    tenantName: string,
    sourceCollection: 'products' | 'members' = 'products',
    memberData?: {
      memberId: Types.ObjectId;
      memberEmail: string;
      memberName: string;
      assignedAt?: Date;
    },
    shouldRemoveSerialNumber?: boolean, // 🎯 Nuevo parámetro
  ): Promise<void> {
    try {
      // 🔒 VERIFICAR SI YA FUE SINCRONIZADO: Evitar duplicados
      if ((product as any)._alreadySyncedToGlobal) {
        return;
      }
      await this.globalProductSyncService.syncProduct({
        tenantId: tenantName,
        tenantName: tenantName,
        originalProductId: product._id as any,
        sourceCollection,

        // Datos básicos del producto
        name: product.name || '',
        category: product.category,
        status: product.status,
        location: product.location || 'Our office',

        // Atributos convertidos al formato correcto
        attributes:
          product.attributes?.map((attr: any) => ({
            key: attr.key,
            value: String(attr.value),
          })) || [],

        // 🎯 FIX: Manejar serialNumber según si se debe eliminar o no
        serialNumber: shouldRemoveSerialNumber ? null : product.serialNumber,
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
        isDeleted: product.isDeleted || false,

        // Datos de warehouse si existen
        fpWarehouse:
          product.fpWarehouse &&
          product.fpWarehouse.warehouseId &&
          product.fpWarehouse.warehouseCountryCode &&
          product.fpWarehouse.warehouseName !== undefined // ✅ FIX: Permitir warehouseName vacío
            ? {
                warehouseId: product.fpWarehouse.warehouseId as any,
                warehouseCountryCode: product.fpWarehouse.warehouseCountryCode,
                warehouseName: product.fpWarehouse.warehouseName || '', // ✅ FIX: Fallback a string vacío
                assignedAt: product.fpWarehouse.assignedAt,
                status:
                  product.fpWarehouse.status === 'IN_TRANSIT'
                    ? 'IN_TRANSIT_IN'
                    : (product.fpWarehouse.status as any),
              }
            : undefined,

        // Datos de office si existen
        office:
          product.office &&
          product.office.officeId &&
          product.office.officeCountryCode &&
          product.office.officeName
            ? {
                officeId: product.office.officeId as any,
                officeCountryCode: product.office.officeCountryCode,
                officeName: product.office.officeName,
                assignedAt: product.office.assignedAt,
                isDefault: product.office.isDefault,
              }
            : undefined,

        // Datos del member si está asignado
        memberData,

        // Metadatos
        createdBy: product.createdBy,
        sourceUpdatedAt: product.updatedAt || new Date(),
      });
    } catch (error) {
      // Log el error pero no fallar la operación principal
      this.logger.error(
        `❌ [syncProductToGlobal] Failed to sync product ${product._id} to global collection for tenant ${tenantName}:`,
        error,
      );
      // Opcional: Aquí podrías agregar el producto a una cola de retry
    }
  }

  public async assignProductsToMemberByEmail(
    memberEmail: string,
    memberFullName: string,
    session: ClientSession,
    tenantName: string,
  ): Promise<ProductDocument[]> {
    const connection =
      await this.connectionService.getTenantConnection(tenantName);
    const ProductModel = connection.model(Product.name, ProductSchema);

    const productsToUpdate = await ProductModel.find({
      assignedEmail: memberEmail,
    }).session(session);

    if (!productsToUpdate.length) return [];

    const productIds = productsToUpdate.map((p) => p._id);

    await ProductModel.updateMany(
      { _id: { $in: productIds } },
      { $set: { assignedMember: memberFullName } },
      { session },
    );

    // 🔄 SYNC: Actualizar productos en global collection con memberData
    // Estos productos ya existían en global pero sin memberData (unknown email)
    // Ahora que se creó el member, actualizamos con memberData completa
    for (const product of productsToUpdate) {
      try {
        await this.globalProductSyncService.syncProduct({
          tenantId: tenantName,
          tenantName: tenantName,
          originalProductId: new Types.ObjectId(product._id!.toString()),
          sourceCollection: 'products', // Aún están en products collection
          name: product.name || '',
          category: product.category,
          status: product.status,
          location: product.location || 'FP warehouse',
          attributes:
            product.attributes?.map((attr: any) => ({
              key: attr.key,
              value: String(attr.value),
            })) || [],
          serialNumber: product.serialNumber || undefined,
          assignedEmail: memberEmail,
          assignedMember: memberFullName,
          lastAssigned: product.lastAssigned,
          acquisitionDate: product.acquisitionDate,
          price: product.price,
          additionalInfo: product.additionalInfo,
          productCondition: product.productCondition,
          recoverable: product.recoverable,
          fp_shipment: product.fp_shipment,
          activeShipment: product.activeShipment,
          fpWarehouse: product.fpWarehouse
            ? {
                warehouseId: new Types.ObjectId(
                  product.fpWarehouse.warehouseId!.toString(),
                ),
                warehouseCountryCode: product.fpWarehouse.warehouseCountryCode!,
                warehouseName: product.fpWarehouse.warehouseName!,
                assignedAt: product.fpWarehouse.assignedAt,
                status: this.determineWarehouseStatus(product, true),
              }
            : undefined,
          // 👤 AHORA SÍ: Agregar memberData porque el member existe
          memberData: {
            memberId: new Types.ObjectId(), // Se actualizará cuando se mueva a members
            memberEmail: memberEmail,
            memberName: memberFullName,
            assignedAt: new Date(),
          },
          sourceUpdatedAt:
            (product as any).updatedAt instanceof Date
              ? (product as any).updatedAt
              : new Date(),
        });
      } catch (error) {
        this.logger.error(
          `❌ [assignProductsToMemberByEmail] Error updating global sync for product ${product._id}:`,
          error,
        );
      }
    }

    await ProductModel.deleteMany({ _id: { $in: productIds } }).session(
      session,
    );

    return productsToUpdate;
  }

  public async assignAndDetachProductsFromPool(
    member: MemberDocument,
    fullName: string,
    session: ClientSession,
    tenantName: string,
  ): Promise<ProductDocument[]> {
    const connection =
      await this.connectionService.getTenantConnection(tenantName);
    const ProductModel = connection.model(Product.name, ProductSchema);

    const products = await ProductModel.find({
      assignedEmail: member.email,
    }).session(session);

    if (!products.length) return [];

    const reassignedProducts: ProductDocument[] = [];

    for (const product of products) {
      const productData = product.toObject() as Record<string, any>;
      const cloned = new ProductModel({
        ...productData,
        assignedMember: fullName,
      });

      reassignedProducts.push(cloned);

      const alreadyExists = member.products.some(
        (p) => p._id && p._id.toString() === product._id.toString(),
      );

      if (!alreadyExists) {
        member.products.push(cloned);
      }
    }

    await member.save({ session });

    // 🔄 SYNC: Actualizar productos en global collection - ahora están en members collection
    for (const product of reassignedProducts) {
      try {
        await this.globalProductSyncService.syncProduct({
          tenantId: tenantName,
          tenantName: tenantName,
          originalProductId: new Types.ObjectId(product._id!.toString()),
          sourceCollection: 'members', // AHORA están en members collection
          name: product.name || '',
          category: product.category,
          status: product.status,
          location: 'Employee', // Siempre Employee en members
          attributes:
            product.attributes?.map((attr: any) => ({
              key: attr.key,
              value: String(attr.value),
            })) || [],
          serialNumber: product.serialNumber || undefined,
          assignedEmail: member.email,
          assignedMember: fullName,
          lastAssigned: product.lastAssigned,
          acquisitionDate: product.acquisitionDate,
          price: product.price,
          additionalInfo: product.additionalInfo,
          productCondition: product.productCondition,
          recoverable: product.recoverable,
          fp_shipment: product.fp_shipment,
          activeShipment: product.activeShipment,
          fpWarehouse: product.fpWarehouse
            ? {
                warehouseId: new Types.ObjectId(
                  product.fpWarehouse.warehouseId!.toString(),
                ),
                warehouseCountryCode: product.fpWarehouse.warehouseCountryCode!,
                warehouseName: product.fpWarehouse.warehouseName!,
                assignedAt: product.fpWarehouse.assignedAt,
                status: this.determineWarehouseStatus(product, false), // false = producto puede estar saliendo
              }
            : undefined,
          // 👤 MEMBERDATA COMPLETA: Ahora con memberId real
          memberData: {
            memberId: member._id as any,
            memberEmail: member.email,
            memberName: fullName,
            assignedAt: new Date(),
          },
          sourceUpdatedAt:
            (product as any).updatedAt instanceof Date
              ? (product as any).updatedAt
              : new Date(),
        });
      } catch (error) {
        this.logger.error(
          `❌ [assignAndDetachProductsFromPool] Error updating global sync for product ${product._id}:`,
          error,
        );
      }
    }

    const productIds = products.map((p) => p._id);

    await ProductModel.deleteMany({ _id: { $in: productIds } }).session(
      session,
    );

    return reassignedProducts;
  }

  async findProductBySerialNumber(serialNumber: string) {
    if (!serialNumber || serialNumber.trim() === '') {
      return null;
    }
    const member = await this.memberModel.findOne({
      'products.serialNumber': serialNumber,
    });
    return member
      ? member.products.find((product) => product.serialNumber === serialNumber)
      : null;
  }

  async assignProduct(
    email: string,
    createProductDto: CreateProductDto,
    session?: ClientSession,
    tenantName?: string,
  ) {
    const member = await this.membersService.findByEmailNotThrowError(email);

    if (!member) return null;

    const {
      serialNumber,
      price,
      productCondition,
      fp_shipment,
      officeId,
      ...rest
    } = createProductDto;

    const location = 'Employee';

    let status: Status = 'Delivered';

    if (fp_shipment) {
      const isComplete = !!(
        member.country &&
        member.city &&
        member.zipCode &&
        member.address &&
        member.email &&
        member.phone &&
        member.dni
      );

      status = isComplete ? 'In Transit' : 'In Transit - Missing Data';
    }

    const productData = {
      ...rest,
      serialNumber: serialNumber?.trim() || undefined,
      productCondition: productCondition || 'Optimal',
      assignedMember: `${member.firstName} ${member.lastName}`,
      assignedEmail: email,
      location,
      status,
      ...(price?.amount !== undefined && price?.currencyCode
        ? { price: { amount: price.amount, currencyCode: price.currencyCode } }
        : {}),
      fp_shipment: !!fp_shipment,
      // Agregar objeto office si está presente
      ...(officeId && tenantName
        ? await this.buildOfficeObject(officeId as string, tenantName as string)
        : {}),
    };

    member.products.push(productData);
    await member.save({ session });

    // 🔄 SYNC: Sincronizar producto asignado a colección global
    if (tenantName) {
      // Buscar el producto recién guardado para obtener su _id generado
      const savedProduct = member.products[member.products.length - 1];

      if (savedProduct && savedProduct._id) {
        await this.syncProductToGlobal(
          savedProduct,
          tenantName,
          'members', // Producto está en colección members
          {
            memberId: member._id as any,
            memberEmail: member.email,
            memberName: `${member.firstName} ${member.lastName}`,
            assignedAt: new Date(),
          },
        );
      } else {
        this.logger.error(
          `❌ [assignProduct] Could not sync product - no _id found after save`,
        );
      }
    }

    return member;
  }

  async getAllProductsWithMembers(
    connection: Connection,
  ): Promise<ProductDocument[]> {
    try {
      const MemberModel = connection.model<MemberDocument>(
        'Member',
        MemberSchema,
      );
      const members = await MemberModel.find({ isDeleted: false });

      const productsFromMembers = members.flatMap((member) => {
        if (!member.products || !Array.isArray(member.products)) {
          return [];
        }

        return (member.products || []).map((p: any) => ({
          ...JSON.parse(JSON.stringify(p)),
          assignedEmail: member.email,
          assignedMember: `${member.firstName} ${member.lastName}`,
          // Agregar datos del member para poder calcular countryCode
          memberData: {
            memberId: member._id,
            memberEmail: member.email,
            memberName: `${member.firstName} ${member.lastName}`,
            country: member.country, // ✅ Incluir country del member
            city: member.city,
            address: member.address,
            phone: member.phone,
          },
        }));
      });

      return productsFromMembers;
    } catch (error) {
      console.error('Error in getAllProductsWithMembers:', error);
      return [];
    }
  }

  async getProductByMembers(
    id: ObjectId,
    connection: Connection,
    session?: ClientSession,
  ) {
    const castedId = ensureObjectId(id);

    const MemberModel = connection.model(Member.name, MemberSchema);

    const member = await MemberModel.findOne({
      'products._id': castedId,
    }).session(session || null);

    if (!member) return null;

    const product = member.products.find(
      (p) => p._id && p._id.toString() === castedId.toString(),
    );

    if (!product) return null;

    return { member, product };
  }

  async deleteProductFromMember(
    memberId: ObjectId,
    productId: ObjectId,
    session?: ClientSession,
  ) {
    try {
      const member = await this.memberModel
        .findById(memberId)
        .session(session || null);

      if (!member) {
        throw new Error(`Member with id ${memberId} not found`);
      }

      member.products = member.products.filter(
        (product) => product?._id?.toString() !== productId.toString(),
      );

      await member.save({ session });
    } catch (error) {
      throw error;
    }
  }

  async processOffboardingProducts(
    productsToUpdate: Array<{ id: ObjectId; product: any }>,
    tenantName: string,
    userId: string,
    ourOfficeEmail: string,
  ) {
    return this.productsService.updateMultipleProducts(
      productsToUpdate,
      tenantName,
      userId,
      ourOfficeEmail,
    );
  }

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
      // Usar el adaptador para obtener datos de la oficina
      const tenant = await this.tenantUserAdapter.getByTenantName(tenantName);

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

  public filterMembers(
    members: MemberDocument[],
    currentEmail: string | null,
    includeNone: boolean = false,
  ) {
    const filteredMembers = members
      .filter((member) => member.email !== currentEmail && !member.$isDeleted())
      .map((member) => ({
        email: member.email,
        name: `${member.firstName} ${member.lastName}`,
        team: member.team,
      }));
    if (includeNone) {
      filteredMembers.push({
        email: 'none',
        name: 'None',
        team: undefined as Types.ObjectId | undefined,
      });
    }
    return filteredMembers;
  }

  async getProductForReassign(
    productId: ObjectId,
    tenantName: string,
    connection: Connection,
    session?: ClientSession,
  ) {
    let product: Product | ProductDocument | null =
      await this.productsService.findById(productId, tenantName);
    let currentMember: MemberDocument | null = null;
    let isUnknownEmail = false;

    if (!product) {
      const memberProduct = await this.getProductByMembers(
        productId,
        connection,
        session,
      );
      if (!memberProduct) {
        throw new NotFoundException(`Product with id "${productId}" not found`);
      }
      product = await this.productsService.findById(productId, tenantName);
      currentMember = memberProduct.member as MemberDocument;
    } else {
      if (product.assignedEmail) {
        currentMember = await this.membersService.findByEmailNotThrowError(
          product.assignedEmail,
        );
        if (!currentMember) {
          isUnknownEmail = true;
        }
      }
    }

    const members = await this.membersService.findAll();
    let options;

    if (isUnknownEmail) {
      options = this.filterMembers(members, null);
    } else {
      options = this.filterMembers(members, product?.assignedEmail || null);
    }

    return { product, options, currentMember };
  }

  async getProductForAssign(productId: ObjectId, tenantName: string) {
    const product = await this.productsService.findById(productId, tenantName);
    if (!product) {
      throw new NotFoundException(`Product with id "${productId}" not found`);
    }

    const members = await this.membersService.findAll();

    const options = this.filterMembers(members, null);

    return { product, options };
  }

  public async handleUnknownEmailToMemberUpdate(
    session: any,
    product: ProductDocument,
    updateProductDto: UpdateProductDto,
    tenantName: string,
    providedConnection?: Connection,
    userId?: string,
  ) {
    const newMember = await this.membersService.findByEmailNotThrowError(
      updateProductDto.assignedEmail!,
    );

    if (!newMember) {
      throw new NotFoundException(
        `Member with email "${updateProductDto.assignedEmail}" not found`,
      );
    }

    // 🔄 Calcular lastAssigned correctamente usando el helper
    const calculatedLastAssigned =
      await this.calculateLastAssignedWithOfficeInfo(
        product,
        'Employee', // newLocation
        tenantName,
        updateProductDto.actionType as
          | 'assign'
          | 'reassign'
          | 'return'
          | 'relocate'
          | 'offboarding',
      );

    await this.moveToMemberCollection(
      session,
      product,
      newMember,
      updateProductDto,
      calculatedLastAssigned || '',
      tenantName,
      providedConnection, // ✅ FIX: Pasar la conexión proporcionada
      userId, // ✅ FIX: Pasar userId para history
      undefined, // oldMemberCountry (no aplica - producto viene de products collection)
    );

    return newMember;
  }

  public async handleUnknownEmailUpdate(
    session: any,
    product: ProductDocument,
    updateProductDto: UpdateProductDto,
    tenantName: string,
    userId?: string,
  ) {
    const updatedFields = this.productsService.getUpdatedFields(
      product,
      updateProductDto,
    );

    // 🏭 WAREHOUSE ASSIGNMENT: Si location cambia a "FP warehouse", asignar warehouse
    // NOTA: Solo llamar aquí si NO se va a llamar en handleProductFromProductsCollection
    let warehouseFields = {};
    if (
      updateProductDto.location === 'FP warehouse' &&
      !updateProductDto.actionType
    ) {
      // Solo asignar warehouse aquí si no es una acción específica (return/reassign)
      // Las acciones específicas se manejan en handleProductFromProductsCollection
      // Obtener información del usuario para el mensaje de Slack
      const userInfo = userId
        ? await this.getUserInfoFromUserId(userId)
        : undefined;
      const userName =
        userInfo?.userEmail || (userId ? `User ${userId}` : 'Unknown User');

      warehouseFields = await this.assignWarehouseIfNeeded(
        updateProductDto,
        product,
        tenantName,
        undefined, // memberEmail - no disponible en este contexto
        userName, // userName con email real
        'assign', // action por defecto
      );
    }

    // Agregar campos de warehouse a updatedFields si existen
    Object.assign(updatedFields, warehouseFields);

    // 🏢 OFFICE HANDLING: Construir objeto office si officeId está presente y location es "Our office"
    if (
      updateProductDto.officeId &&
      updateProductDto.location === 'Our office'
    ) {
      const officeData = await this.buildOfficeObject(
        updateProductDto.officeId as string,
        tenantName,
      );
      Object.assign(updatedFields, officeData);
    }

    if (updatedFields.assignedEmail === '') {
      updatedFields.lastAssigned =
        await this.calculateLastAssignedWithOfficeInfo(
          product,
          updateProductDto.location as
            | 'Employee'
            | 'FP warehouse'
            | 'Our office',
          tenantName || '',
          updateProductDto.actionType as
            | 'assign'
            | 'reassign'
            | 'return'
            | 'relocate'
            | 'offboarding',
        );
    }

    updatedFields.fp_shipment =
      updateProductDto.fp_shipment ?? product.fp_shipment;

    await this.productsService.updateOne(
      tenantName,
      { _id: product._id },
      { $set: updatedFields },
      { session, runValidators: true, new: true, omitUndefined: true },
    );

    return updatedFields;
  }

  private async removeProductFromMember(
    session: any,
    product: ProductDocument,
    memberEmail: string,
  ) {
    const member =
      await this.membersService.findByEmailNotThrowError(memberEmail);
    if (member) {
      const productIndex = member.products.findIndex(
        (prod) => prod._id!.toString() === product._id!.toString(),
      );
      if (productIndex !== -1) {
        member.products.splice(productIndex, 1);
        await member.save({ session });
      }
    }
  }

  /**
   * Transfiere un producto directamente de un member a otro member
   * (sin pasar por la colección products)
   */
  public async transferProductBetweenMembers(
    session: any,
    product: ProductDocument,
    currentMember: MemberDocument,
    newMember: MemberDocument,
    updateProductDto: UpdateProductDto,
    lastAssigned: string,
    tenantName: string,
  ): Promise<void> {
    // 1. Remover producto del member actual
    const productIndex = currentMember.products.findIndex(
      (prod) => prod._id!.toString() === product._id!.toString(),
    );

    if (productIndex === -1) {
      throw new Error('Product not found in current member');
    }

    currentMember.products.splice(productIndex, 1);

    // 2. Crear datos actualizados del producto
    const updateData = {
      _id: product._id,
      name: updateProductDto.name || product.name,
      category: product.category,
      attributes: updateProductDto.attributes || product.attributes,
      status: updateProductDto.status ?? product.status,
      price:
        updateProductDto.price?.amount != null &&
        updateProductDto.price?.currencyCode
          ? {
              amount: updateProductDto.price.amount,
              currencyCode: updateProductDto.price.currencyCode,
            }
          : product.price?.amount != null && product.price.currencyCode
            ? {
                amount: product.price.amount,
                currencyCode: product.price.currencyCode,
              }
            : undefined,
      recoverable:
        updateProductDto.recoverable !== undefined
          ? updateProductDto.recoverable
          : product.recoverable,
      serialNumber: updateProductDto.serialNumber || product.serialNumber,
      assignedEmail: updateProductDto.assignedEmail,
      assignedMember: updateProductDto.assignedMember,
      acquisitionDate:
        updateProductDto.acquisitionDate || product.acquisitionDate,
      location: updateProductDto.location || product.location,
      additionalInfo: updateProductDto.additionalInfo || product.additionalInfo,
      productCondition:
        updateProductDto.productCondition !== undefined
          ? updateProductDto.productCondition
          : product.productCondition,
      fp_shipment: updateProductDto.fp_shipment ?? product.fp_shipment,
      activeShipment: updateProductDto.fp_shipment ?? product.fp_shipment,
      isDeleted: product.isDeleted,
      lastAssigned: lastAssigned, // ✅ Usar el lastAssigned calculado correctamente
      // Agregar objeto office si está presente o si location es "Our office"
      ...(await this.handleOfficeAssignment(
        updateProductDto.officeId as string,
        updateProductDto.location,
        product.office,
        tenantName,
      )),
    };

    // 3. Agregar producto al nuevo member
    newMember.products.push(updateData);

    // 4. Actualizar activeShipment si es necesario
    if (updateProductDto.fp_shipment) {
      newMember.activeShipment = true;
    }

    // 5. Guardar ambos members
    await currentMember.save({ session });
    await newMember.save({ session });

    // 6. Sincronizar a global collection
    if (tenantName) {
      await this.syncProductToGlobal(updateData, tenantName, 'members', {
        memberId: newMember._id as any,
        memberEmail: newMember.email,
        memberName: `${newMember.firstName} ${newMember.lastName}`,
        assignedAt: new Date(),
      });
    }
  }

  public async moveToMemberCollection(
    session: any,
    product: ProductDocument,
    newMember: MemberDocument,
    updateProductDto: UpdateProductDto,
    lastAssigned: string,
    tenantName?: string,
    providedConnection?: Connection,
    userId?: string,
    oldMemberCountry?: string,
  ) {
    if (!tenantName) {
      throw new Error('tenantName is required to find and delete a product');
    }

    await this.productsService.findByIdAndDelete(
      tenantName,
      product._id!,
      { session },
      providedConnection, // ✅ FIX: Pasar la conexión proporcionada
    );
    if (product.assignedEmail) {
      await this.removeProductFromMember(
        session,
        product,
        product.assignedEmail,
      );
    }

    const updateData = {
      _id: product._id,
      name: updateProductDto.name || product.name,
      category: product.category,
      attributes: updateProductDto.attributes || product.attributes,
      status: updateProductDto.status ?? product.status,
      // recoverable: product.recoverable,
      price:
        updateProductDto.price?.amount != null &&
        updateProductDto.price?.currencyCode
          ? {
              amount: updateProductDto.price.amount,
              currencyCode: updateProductDto.price.currencyCode,
            }
          : product.price?.amount != null && product.price.currencyCode
            ? {
                amount: product.price.amount,
                currencyCode: product.price.currencyCode,
              }
            : undefined,
      recoverable:
        updateProductDto.recoverable !== undefined
          ? updateProductDto.recoverable
          : product.recoverable,
      serialNumber: updateProductDto.serialNumber || product.serialNumber,
      assignedEmail: updateProductDto.assignedEmail,
      assignedMember: updateProductDto.assignedMember,
      acquisitionDate:
        updateProductDto.acquisitionDate || product.acquisitionDate,
      location: updateProductDto.location || product.location,
      additionalInfo: updateProductDto.additionalInfo || product.additionalInfo,
      productCondition:
        updateProductDto.productCondition !== undefined
          ? updateProductDto.productCondition
          : product.productCondition,
      fp_shipment: updateProductDto.fp_shipment ?? product.fp_shipment,
      activeShipment: updateProductDto.fp_shipment ?? product.fp_shipment,
      isDeleted: product.isDeleted,
      lastAssigned: lastAssigned,
      // Agregar objeto office si está presente o si location es "Our office"
      ...(await this.handleOfficeAssignment(
        updateProductDto.officeId as string,
        updateProductDto.location,
        product.office,
        tenantName,
      )),
      // 🧹 CLEANUP: Limpiar objetos warehouse/office cuando se mueve a Employee
      ...this.handleLocationObjectCleanup(updateProductDto.location, product),
    };

    newMember.products.push(updateData);

    if (updateProductDto.fp_shipment) {
      newMember.activeShipment = true;
    }
    await newMember.save({ session });

    await this.productsService.findByIdAndDelete(tenantName, product._id!, {
      session,
    });

    // 🔄 SYNC: Sincronizar producto movido a member
    if (tenantName) {
      await this.syncProductToGlobal(
        updateData,
        tenantName,
        'members', // Ahora está en colección members
        {
          memberId: newMember._id as any,
          memberEmail: newMember.email,
          memberName: `${newMember.firstName} ${newMember.lastName}`,
          assignedAt: new Date(),
        },
      );
    }

    // 📜 HISTORY: Crear registro con información completa DESPUÉS de mover a member
    if (updateProductDto.actionType && userId) {
      try {
        await this.recordEnhancedAssetHistoryIfNeeded(
          updateProductDto.actionType as HistoryActionType,
          product,
          updateData as any,
          userId,
          newMember.country,
          oldMemberCountry,
        );

        console.log('✅ [moveToMemberCollection] History created successfully');
      } catch (error) {
        this.logger.error(
          '❌ Error creating history in moveToMemberCollection:',
          error,
        );
      }
    }
  }

  // Metodo para mover un producto de un miembro a la colección de productos
  public async moveToProductsCollection(
    session: any,
    product: ProductDocument,
    member: MemberDocument,
    updateProductDto: UpdateProductDto,
    connection: Connection,
    tenantName?: string,
    userId?: string,
  ) {
    console.log(userId, 'userId');
    const productIndex = member.products.findIndex(
      (prod) => prod._id!.toString() === product._id!.toString(),
    );
    if (productIndex !== -1) {
      member.products.splice(productIndex, 1);
      await member.save({ session });
    } else {
      throw new Error('Product not found in member collection');
    }

    // 🏭 WAREHOUSE ASSIGNMENT: Si location es "FP warehouse", asignar warehouse

    // 🚫 NO asignar warehouse aquí - se hará en handleProductFromProductsCollection
    // para evitar duplicados. Solo preparar los campos vacíos.
    const warehouseFields = {};

    const updateData = {
      _id: product._id,
      name: updateProductDto.name || product.name,
      category: product.category,
      attributes: updateProductDto.attributes || product.attributes,
      status: updateProductDto.status || product.status,
      // recoverable: product.recoverable,
      recoverable:
        updateProductDto.recoverable !== undefined
          ? updateProductDto.recoverable
          : product.recoverable,
      serialNumber: updateProductDto.serialNumber || product.serialNumber,
      assignedEmail: '',
      assignedMember: '',
      lastAssigned: await this.calculateLastAssignedWithOfficeInfo(
        product,
        updateProductDto.location as 'Employee' | 'FP warehouse' | 'Our office',
        tenantName || '',
        updateProductDto.actionType as
          | 'assign'
          | 'reassign'
          | 'return'
          | 'relocate'
          | 'offboarding',
      ),
      acquisitionDate:
        updateProductDto.acquisitionDate || product.acquisitionDate,
      location: updateProductDto.location || product.location,
      productCondition:
        updateProductDto.productCondition !== undefined
          ? updateProductDto.productCondition
          : product.productCondition,
      fp_shipment: updateProductDto.fp_shipment ?? product.fp_shipment,
      activeShipment: updateProductDto.fp_shipment ?? product.fp_shipment,
      isDeleted: product.isDeleted,
      price:
        updateProductDto.price?.amount != null &&
        updateProductDto.price?.currencyCode
          ? {
              amount: updateProductDto.price.amount,
              currencyCode: updateProductDto.price.currencyCode,
            }
          : product.price?.amount != null && product.price.currencyCode
            ? {
                amount: product.price.amount,
                currencyCode: product.price.currencyCode,
              }
            : undefined,
      // Agregar campos de warehouse si existen
      ...warehouseFields,
      // Agregar objeto office si está presente o si location es "Our office"
      ...(await this.handleOfficeAssignment(
        updateProductDto.officeId as string,
        updateProductDto.location,
        product.office,
        tenantName as string,
      )),
      // 🧹 CLEANUP: Limpiar objetos warehouse/office según movimiento de ubicación
      ...this.handleLocationObjectCleanup(updateProductDto.location, product),
    };
    const productModel = connection.model(Product.name, ProductSchema);

    const createdProducts = await productModel.create([updateData], {
      session,
    });

    // 🌐 SINCRONIZACIÓN SIMPLE: Siempre sincronizar
    if (tenantName && createdProducts.length > 0) {
      try {
        await this.syncProductToGlobal(
          createdProducts[0],
          tenantName,
          'products',
          undefined,
        );

        // 🔒 MARCAR COMO SINCRONIZADO: Evitar sincronizaciones adicionales en este flujo
        (createdProducts[0] as any)._alreadySyncedToGlobal = true;
      } catch (error) {
        this.logger.error(
          `❌ [moveToProductsCollection] Error syncing product ${updateData._id} to global collection:`,
          error,
        );
      }
    } else {
      this.logger.warn(
        `⚠️ [moveToProductsCollection] Sync skipped - tenantName: ${tenantName}, createdProducts.length: ${createdProducts.length}`,
      );
    }

    // 📜 HISTORY: NO crear aquí - se creará en handleProductFromMemberCollection después de asignar warehouse
    console.log(
      '📜 [moveToProductsCollection] History creation deferred to handleProductFromMemberCollection',
    );

    return createdProducts;
  }

  public async updateProductAttributes(
    session: any,
    product: ProductDocument,
    updateProductDto: UpdateProductDto,
    currentLocation: 'products' | 'members',
    member?: MemberDocument,
    tenantName?: string,
  ) {
    if (!tenantName) {
      throw new Error('tenantName is required to find and delete a product');
    }

    const updatedFields = this.productsService.getUpdatedFields(
      product,
      updateProductDto,
    );
    updatedFields.status = updateProductDto.status ?? product.status;

    if (currentLocation === 'products') {
      await this.productsService.updateOne(
        tenantName,
        { _id: product._id },
        { $set: updatedFields },
        { session, runValidators: true, new: true, omitUndefined: true },
      );
    } else if (currentLocation === 'members' && member) {
      const productIndex = member.products.findIndex(
        (prod) => prod._id!.toString() === product._id!.toString(),
      );
      if (
        product.fp_shipment === true &&
        updatedFields.activeShipment === false
      ) {
        delete updatedFields.activeShipment;
      }
      if (productIndex !== -1) {
        Object.assign(member.products[productIndex], updatedFields);
        await member.save({ session });
      }
    }
  }

  async validateProductAvailability(productId: string, tenantName: string) {
    const id = new Types.ObjectId(
      productId,
    ) as unknown as Schema.Types.ObjectId;
    const found = await this.productsService.findProductById(id, tenantName);

    const product =
      found.product ||
      found.member?.products.find(
        (p) => p._id?.toString() === productId.toString(),
      );

    if (!product) throw new NotFoundException('Product not found');

    if (product.activeShipment) {
      throw new BadRequestException(
        'This product is part of an active shipment and cannot be moved or modified.',
      );
    }
  }

  public async handleProductUpdateByActionType(
    session: ClientSession,
    product: ProductDocument,
    updateDto: UpdateProductDto,
    tenantName: string,
    userId: string,
    tenantname: string,
    actionType?: string,
  ) {
    switch (actionType) {
      case 'assign':
      case 'reassign':
      case 'relocate':
      case 'return':
      case 'offboarding':
        if (!product._id) throw new BadRequestException('Product ID missing');
        await this.validateProductAvailability(
          product._id.toString(),
          tenantName,
        );
        break;
    }
  }

  async findByEmailNotThrowError(
    email: string,
    connection?: Connection,
    session?: ClientSession,
    tenantName?: string,
  ): Promise<MemberDocument | null> {
    const normalizedEmail = email.trim().toLowerCase();

    if (session && !connection) {
      throw new Error('Cannot use session without explicit connection');
    }

    // Caso preferido: con connection
    if (connection) {
      const MemberModel = connection.model(Member.name, MemberSchema);
      const query = MemberModel.findOne({ email: normalizedEmail });
      return session ? query.session(session).exec() : query.exec();
    }

    // Fallback: solo tenantName
    if (tenantName && !session) {
      const MemberModel =
        await this.tenantModelRegistry.getMemberModel(tenantName);
      return MemberModel.findOne({ email: normalizedEmail }).exec();
    }

    throw new Error('Missing connection or tenantName to resolve MemberModel');
  }

  // llamo a este metodo en update entity para los productos en la coleccion de members
  async updateEmbeddedProduct(
    member: MemberDocument,
    productId: ObjectId,
    updatedFields: Partial<ProductDocument>,
    tenantName?: string, // 🎯 Agregar tenantName para sincronización
  ): Promise<ProductDocument | Product> {
    const index = member.products.findIndex(
      (p) => p._id!.toString() === productId.toString(),
    );
    if (index === -1) {
      throw new NotFoundException('Product not found in member');
    }

    // 🎯 FIX: Manejar campos undefined/null eliminándolos explícitamente
    Object.keys(updatedFields).forEach((key) => {
      const value = updatedFields[key as keyof Partial<ProductDocument>];

      if (value === undefined || (key === 'serialNumber' && value === null)) {
        // Eliminar la key del producto embebido
        delete (member.products[index] as any)[key];
      } else {
        // Asignar el valor normalmente
        (member.products[index] as any)[key] = value;
      }
    });

    // 🎯 FIX: Si se eliminó serialNumber, usar $unset en MongoDB
    const fieldsToUnset: any = {};
    Object.keys(updatedFields).forEach((key) => {
      const value = updatedFields[key as keyof Partial<ProductDocument>];
      if (value === undefined || (key === 'serialNumber' && value === null)) {
        fieldsToUnset[`products.${index}.${key}`] = '';
      }
    });

    if (Object.keys(fieldsToUnset).length > 0) {
      await this.memberModel.updateOne(
        { _id: member._id },
        { $unset: fieldsToUnset },
      );

      // 🎯 FIX: Recargar el member después del $unset
      const reloadedMember = await this.memberModel.findById(member._id);
      if (reloadedMember) {
        member.products = reloadedMember.products;
      }
    } else {
      await member.save();
    }

    // 🎯 FIX: Sincronizar a global DESPUÉS del $unset
    if (tenantName) {
      // Recargar el member para obtener el producto actualizado
      const updatedMember = await this.memberModel.findById(member._id);
      if (updatedMember) {
        const updatedProduct = updatedMember.products.find(
          (p) => p._id!.toString() === productId.toString(),
        );

        if (updatedProduct) {
          await this.syncProductToGlobal(
            updatedProduct,
            tenantName,
            'members',
            {
              memberId: member._id as any,
              memberEmail: member.email,
              memberName: `${member.firstName} ${member.lastName}`,
              assignedAt: new Date(),
            },
          );
        }
      }
    }

    return member.products[index];
  }

  /**
   * Método simple para cambios de ubicación dentro de la colección products
   * Maneja: FP warehouse ↔ Our office (sin movimiento entre colecciones)
   */
  async handleProductLocationChangeWithinProducts(
    product: ProductDocument,
    updateDto: UpdateProductDto,
    tenantName: string,
    userId: string,
    ourOfficeEmail: string,
    session: ClientSession,
    connection: Connection,
  ): Promise<{
    shipment?: ShipmentDocument;
    updatedProduct?: ProductDocument;
  }> {
    this.logger.log(
      `🔄 [handleProductLocationChangeWithinProducts] Moving product ${product._id} from ${product.location} to ${updateDto.location}`,
    );

    const isRecoverable = this.productsService.getEffectiveRecoverableValue(
      updateDto,
      product.recoverable ?? false,
    );

    // 📜 HISTORY: Se registrará después de obtener el producto actualizado

    // 📊 STATUS LOGIC: Determinar el status basado en la ubicación y condición
    const statusLogic = await this.productsService.determineProductStatus(
      {
        location: updateDto.location || product.location,
        assignedEmail: updateDto.assignedEmail || product.assignedEmail,
        productCondition:
          updateDto.productCondition || product.productCondition,
      },
      tenantName,
    );

    // Preparar campos actualizados básicos
    const updatedFields = this.productsService.getUpdatedFields(product, {
      ...updateDto,
      recoverable: isRecoverable,
    });
    updatedFields.status = statusLogic;

    // 📍 LAST ASSIGNED: Calcular lastAssigned basado en la nueva ubicación
    const calculatedLastAssigned =
      await this.calculateLastAssignedWithOfficeInfo(
        product,
        updateDto.location!, // newLocation
        tenantName,
        updateDto.actionType as
          | 'assign'
          | 'reassign'
          | 'return'
          | 'relocate'
          | 'offboarding',
      );

    if (calculatedLastAssigned) {
      updatedFields.lastAssigned = calculatedLastAssigned;
      this.logger.log(
        `📍 [handleProductLocationChangeWithinProducts] Updated lastAssigned: ${calculatedLastAssigned}`,
      );
    }

    // 🏢 OFFICE ASSIGNMENT: Si se mueve a "Our office", agregar objeto office
    if (updateDto.location === 'Our office' && updateDto.officeId) {
      const officeData = await this.buildOfficeObject(
        updateDto.officeId as string,
        tenantName,
      );
      if (officeData.office) {
        Object.assign(updatedFields, { office: officeData.office });
        this.logger.log(
          `🏢 [handleProductLocationChangeWithinProducts] Office data prepared: ${JSON.stringify(officeData.office)}`,
        );
      }
    }

    // 🏭 WAREHOUSE ASSIGNMENT: Si se mueve a "FP warehouse", agregar objeto warehouse
    if (updateDto.location === 'FP warehouse') {
      const userInfo = userId
        ? await this.getUserInfoFromUserId(userId)
        : undefined;
      const userName =
        userInfo?.userEmail || (userId ? `User ${userId}` : 'Unknown User');

      // 🏢 IMPORTANTE: Si el producto viene de "Our office", NO pasar memberEmail
      // para que use el país de la oficina en lugar del lastAssigned
      const memberEmailForWarehouse =
        product.location === 'Our office'
          ? undefined
          : product.lastAssigned || product.assignedEmail;

      const warehouseFields = await this.assignWarehouseIfNeeded(
        updateDto,
        product,
        tenantName,
        memberEmailForWarehouse,
        userName,
        updateDto.actionType === 'return' ? 'return' : 'reassign',
      );

      if (warehouseFields.fpWarehouse) {
        Object.assign(updatedFields, {
          fpWarehouse: warehouseFields.fpWarehouse,
        });
        this.logger.log(
          `🏭 [handleProductLocationChangeWithinProducts] Warehouse data prepared: ${JSON.stringify(warehouseFields.fpWarehouse)}`,
        );
      }
    }

    // 🧹 CLEANUP: Preparar operaciones de limpieza usando $unset
    const cleanupFields = this.getLocationCleanupForUnset(
      updateDto.location,
      product,
    );

    // 💾 ACTUALIZAR PRODUCTO: Usar $set y $unset para limpiar campos correctamente
    const ProductModel = connection.model(Product.name, ProductSchema);
    const updateOperations: any = { $set: updatedFields };

    if (Object.keys(cleanupFields).length > 0) {
      updateOperations.$unset = cleanupFields;
      this.logger.log(
        `🧹 [handleProductLocationChangeWithinProducts] Cleanup fields to unset: ${JSON.stringify(cleanupFields)}`,
      );
    }

    const updatedProduct = await ProductModel.findOneAndUpdate(
      { _id: product._id },
      updateOperations,
      { session, runValidators: true, new: true },
    );

    if (!updatedProduct) {
      throw new NotFoundException(
        `Product with id "${product._id}" not found after update`,
      );
    }

    // 📜 HISTORY: Se crea en moveToProductsCollection con información completa
    // await this.recordEnhancedAssetHistoryIfNeeded(
    //   updateDto.actionType as HistoryActionType,
    //   product, // producto original
    //   updatedProduct, // producto actualizado
    //   userId,
    //   undefined, // no member country for generic updates
    // );

    // 🔄 SYNC FINAL: Sincronizar producto actualizado a colección global
    try {
      await this.syncProductToGlobal(
        updatedProduct,
        tenantName,
        'products',
        undefined,
      );
    } catch (error) {
      this.logger.error(
        `❌ [handleProductLocationChangeWithinProducts] Error syncing to global:`,
        error,
      );
    }

    // 🚢 SHIPMENT CREATION: Si fp_shipment es true, crear shipment
    let shipment: ShipmentDocument | null = null;

    if (updateDto.fp_shipment) {
      if (!('price' in updateDto) || updateDto.price == null) {
        const price = product.price;
        if (
          price?.amount !== undefined &&
          price?.currencyCode &&
          CURRENCY_CODES.includes(price.currencyCode as CurrencyCode)
        ) {
          updateDto.price = {
            amount: price.amount,
            currencyCode: price.currencyCode as CurrencyCode,
          };
        }
      }

      shipment = await this.logisticsService.tryCreateShipmentIfNeeded(
        product, // ✅ Usar el producto ORIGINAL para determinar origen correcto
        updateDto,
        tenantName,
        session,
        userId,
        ourOfficeEmail,
        connection,
      );
    } else {
      console.log(
        `🚢 [handleProductLocationChangeWithinProducts] fp_shipment is false, skipping shipment creation`,
      );
    }

    this.logger.log(
      `✅ [handleProductLocationChangeWithinProducts] Successfully moved product ${product._id} from ${product.location} to ${updateDto.location}`,
    );

    // 📜 HISTORY: Crear registro con información completa
    if (updateDto.actionType && updatedProduct) {
      try {
        await this.recordEnhancedAssetHistoryIfNeeded(
          updateDto.actionType as HistoryActionType,
          product, // producto original (con office/warehouse anterior)
          updatedProduct, // producto actualizado (con office/warehouse nuevo)
          userId,
          undefined, // newMemberCountry (no aplica para office/warehouse)
          undefined, // oldMemberCountry (no aplica para office/warehouse)
        );
      } catch (error) {
        this.logger.error(
          '❌ Error creating history in handleProductLocationChangeWithinProducts:',
          error,
        );
      }
    }

    return {
      updatedProduct: updatedProduct,
      shipment: shipment || undefined,
    };
  }

  async handleProductFromProductsCollection(
    product: ProductDocument,
    updateDto: UpdateProductDto,
    tenantName: string,
    userId: string,
    ourOfficeEmail: string,
    session: ClientSession,
    connection: Connection,
  ): Promise<{
    shipment?: ShipmentDocument;
    updatedProduct?: ProductDocument;
  }> {
    this.logger.log(
      `🔄 [handleProductFromProductsCollection] Starting - Product: ${product._id}, Current location: ${product.location}, Target location: ${updateDto.location}`,
    );
    if (product.activeShipment) {
      throw new BadRequestException(
        'This product is currently part of an active shipment and cannot be modified.',
      );
    }

    // 🔄 LOCATION CHANGE: Si se mueve entre FP warehouse ↔ Our office (misma colección)
    // 🏢 OFFICE CHANGE: O si cambia de oficina dentro de "Our office"
    const hasLocationChange =
      updateDto.location && updateDto.location !== product.location;
    const hasOfficeChange =
      updateDto.location === 'Our office' &&
      product.location === 'Our office' &&
      updateDto.officeId &&
      updateDto.officeId !== product.office?.officeId?.toString();

    if (hasLocationChange || hasOfficeChange) {
      if (
        (product.location === 'FP warehouse' &&
          updateDto.location === 'Our office') ||
        (product.location === 'Our office' &&
          updateDto.location === 'FP warehouse') ||
        hasOfficeChange // 🏢 Cambio de oficina dentro de "Our office"
      ) {
        return await this.handleProductLocationChangeWithinProducts(
          product,
          updateDto,
          tenantName,
          userId,
          ourOfficeEmail,
          session,
          connection,
        );
      }
    }

    const isRecoverable = this.productsService.getEffectiveRecoverableValue(
      updateDto,
      product.recoverable ?? false,
    );

    this.productsService.updatePriceIfProvided(product, updateDto);
    if (!('price' in updateDto) || updateDto.price == null) {
      const price = product.price;
      if (
        price?.currencyCode &&
        CURRENCY_CODES.includes(price.currencyCode as CurrencyCode)
      ) {
        updateDto.price = {
          amount: price.amount,
          currencyCode: price.currencyCode as CurrencyCode,
        };
      } else {
        updateDto.price = null;
      }
    }

    // 🧩 CASO: Email inválido
    const memberExists = product.assignedEmail
      ? await this.findByEmailNotThrowError(product.assignedEmail)
      : null;

    if (
      product.assignedEmail &&
      !memberExists &&
      (!updateDto.assignedEmail ||
        updateDto.assignedEmail === product.assignedEmail)
    ) {
      const updated = await this.handleUnknownEmailUpdate(
        session,
        product,
        {
          ...updateDto,
          recoverable: isRecoverable,
        },
        tenantName,
        userId, // ✅ FIX: Pasar userId para notificaciones warehouse
      );

      await this.recordAssetHistoryIfNeeded(
        updateDto.actionType,
        product.toObject(), // usar producto original
        updated,
        userId,
      );

      return {
        updatedProduct: updated,
      };
    }

    // 🧩 CASO: asignar a nuevo miembro
    const isReassignment =
      updateDto.assignedEmail &&
      updateDto.assignedEmail !== 'none' &&
      updateDto.assignedEmail !== product.assignedEmail;

    if (isReassignment) {
      const newMember = await this.findByEmailNotThrowError(
        updateDto.assignedEmail!,
        connection,
        session,
        tenantName,
      );

      if (!newMember) {
        throw new NotFoundException(
          `Member with email "${updateDto.assignedEmail}" not found`,
        );
      }

      let shipment: ShipmentDocument | null = null;

      if (updateDto.fp_shipment) {
        if (!('price' in updateDto) || updateDto.price == null) {
          const price = product.price;
          if (
            price?.amount !== undefined &&
            price?.currencyCode &&
            CURRENCY_CODES.includes(price.currencyCode as CurrencyCode)
          ) {
            updateDto.price = {
              amount: price.amount,
              currencyCode: price.currencyCode as CurrencyCode,
            };
          }
        }

        shipment = await this.logisticsService.tryCreateShipmentIfNeeded(
          product,
          updateDto,
          tenantName,
          session,
          userId,
          ourOfficeEmail,
          connection, // ✅ FIX: Pasar la conexión
        );
      } else {
        console.log(
          `🚢 [handleProductFromProductsCollection] fp_shipment is false, skipping shipment creation`,
        );
      }

      // Calcular lastAssigned usando el helper con información de oficina
      const calculatedLastAssigned =
        await this.calculateLastAssignedWithOfficeInfo(
          product,
          'Employee', // newLocation
          tenantName,
          updateDto.actionType as
            | 'assign'
            | 'reassign'
            | 'return'
            | 'relocate'
            | 'offboarding',
        );

      await this.moveToMemberCollection(
        session,
        product,
        newMember,
        { ...updateDto, recoverable: isRecoverable },
        calculatedLastAssigned || '',
        tenantName,
        connection, // ✅ FIX: Pasar la conexión
        userId, // ✅ FIX: Pasar userId para history
        undefined, // oldMemberCountry (no aplica - producto viene de products collection)
      );

      // � Obtener el producto actualizado desde la colección de members
      await this.membersService.findByEmailNotThrowError(newMember.email);

      // 📜 HISTORY: Se crea en moveToProductsCollection con información completa
      // await this.recordEnhancedAssetHistoryIfNeeded(
      //   updateDto.actionType as HistoryActionType,
      //   product, // producto original
      //   newProductData as ProductDocument, // ✅ Producto construido manualmente
      //   userId,
      //   newMember.country, // 🏳️ Country code del member para mostrar bandera
      // );

      return {
        shipment: shipment ?? undefined,
        updatedProduct: product,
      };
    }

    // 🧩 CASO: actualización normal (mismo dueño)
    updateDto.status = await this.productsService.determineProductStatus(
      {
        fp_shipment: updateDto.fp_shipment ?? product.fp_shipment,
        location: updateDto.location || product.location,
        assignedEmail: updateDto.assignedEmail,
        productCondition:
          updateDto.productCondition || product.productCondition,
      },
      tenantName,
    );

    // Preparar campos actualizados
    const updatedFields = this.productsService.getUpdatedFields(product, {
      ...updateDto,
      recoverable: isRecoverable,
    });
    updatedFields.status = updateDto.status ?? product.status;

    // Actualizar producto usando la conexión proporcionada y obtener el producto actualizado
    const ProductModel = connection.model(Product.name, ProductSchema);
    const updatedProduct = await ProductModel.findOneAndUpdate(
      { _id: product._id },
      { $set: updatedFields },
      { session, runValidators: true, new: true, omitUndefined: true },
    );

    if (!updatedProduct) {
      throw new NotFoundException(
        `Product with id "${product._id}" not found after update`,
      );
    }

    // 🏢 OFFICE ASSIGNMENT: Si location es "Our office", asignar office
    if (updateDto.location === 'Our office' && updateDto.officeId) {
      const officeData = await this.buildOfficeObject(
        updateDto.officeId as string,
        tenantName,
      );

      // Aplicar los campos de office al producto actualizado
      if (officeData.office) {
        Object.assign(updatedProduct, {
          office: officeData.office,
        });

        // 💾 GUARDAR EL PRODUCTO: Necesario para persistir los campos de la oficina
        await updatedProduct.save({ session });

        this.logger.log(
          `🏢 [handleProductFromProductsCollection] Office fields applied: ${JSON.stringify(officeData.office)}`,
        );
      }
    }

    // 🧹 CLEANUP: Limpiar objetos warehouse/office según movimiento de ubicación
    const cleanupFields = this.handleLocationObjectCleanup(
      updateDto.location,
      product, // Usar el producto original para comparar la ubicación anterior
    );
    if (Object.keys(cleanupFields).length > 0) {
      Object.assign(updatedProduct, cleanupFields);
      await updatedProduct.save({ session });
      this.logger.log(
        `🧹 [handleProductFromProductsCollection] Cleanup applied: ${JSON.stringify(cleanupFields)}`,
      );
    }

    // 🔄 SYNC FINAL: Sincronizar producto actualizado a colección global
    if (tenantName) {
      try {
        // Remover la marca de sincronización para forzar la actualización final
        delete (updatedProduct as any)._alreadySyncedToGlobal;

        await this.syncProductToGlobal(
          updatedProduct,
          tenantName,
          'products',
          undefined,
        );

        this.logger.log(
          `🔄 [handleProductFromProductsCollection] Final sync completed for product ${updatedProduct._id}`,
        );
      } catch (error) {
        this.logger.error(
          `❌ [handleProductFromProductsCollection] Error in final sync:`,
          error,
        );
      }
    }

    // 📜 HISTORY: Crear registro con información completa DESPUÉS de asignar warehouse/office
    if (updateDto.actionType) {
      try {
        console.log(
          '📜 [handleProductFromProductsCollection] Creating history:',
          {
            actionType: updateDto.actionType,
            userId: userId,
            productId: product._id,
            oldLocation: product.location,
            newLocation: updateDto.location,
            hasWarehouse: !!updatedProduct.fpWarehouse,
            hasOffice: !!updatedProduct.office,
          },
        );

        await this.recordEnhancedAssetHistoryIfNeeded(
          updateDto.actionType as HistoryActionType,
          product, // ✅ Producto original
          updatedProduct, // ✅ Producto final con warehouse/office asignado
          userId,
          undefined, // newMemberCountry (no aplica)
          undefined, // oldMemberCountry (no aplica para products collection)
        );

        console.log(
          '✅ [handleProductFromProductsCollection] History created successfully',
        );
      } catch (error) {
        this.logger.error(
          '❌ Error creating history in handleProductFromProductsCollection:',
          error,
        );
      }
    }

    return {
      updatedProduct: updatedProduct,
    };
  }

  private async recordAssetHistoryIfNeeded(
    actionType: HistoryActionType | undefined,
    oldData: any,
    newData: any,
    userId: string,
  ) {
    if (!userId) {
      throw new Error('❌ userId is missing in recordAssetHistoryIfNeeded');
    }
    if (!actionType) return;

    await this.historyService.create({
      actionType,
      itemType: 'assets',
      userId,
      changes: {
        oldData,
        newData,
      },
    });
  }

  /**
   * 📦 Registrar history de assets con formato mejorado (NUEVO MÉTODO)
   * Incluye detalles específicos de location según tus lineamientos
   */
  private async recordEnhancedAssetHistoryIfNeeded(
    actionType: HistoryActionType | undefined,
    oldProduct: ProductDocument | null,
    newProduct: ProductDocument | null,
    userId: string,
    newMemberCountry?: string, // 🏳️ Country code del member destino
    oldMemberCountry?: string, // 🏳️ Country code del member origen
  ) {
    if (!userId) {
      throw new Error(
        '❌ userId is missing in recordEnhancedAssetHistoryIfNeeded',
      );
    }
    if (!actionType) return;

    // 🔄 Para member-to-member, necesitamos pasar ambos countries
    await recordEnhancedAssetHistory(
      this.historyService,
      actionType,
      userId,
      oldProduct,
      newProduct,
      undefined, // context
      newMemberCountry, // 🏳️ Country code del member destino
      oldMemberCountry, // 🏳️ Country code del member origen
    );
  }

  async handleProductFromMemberCollection(
    id: ObjectId,
    updateProductDto: UpdateProductDto,
    tenantName: string,
    userId: string,
    ourOfficeEmail: string,
    session: ClientSession,
    connection: Connection,
  ): Promise<{
    shipment?: ShipmentDocument;
    updatedProduct?: ProductDocument;
  }> {
    this.logger.log(
      `🔄 [handleProductFromMemberCollection] Starting - Product ID: ${id}, Target location: ${updateProductDto.location}`,
    );
    const memberProduct = await this.getProductByMembers(
      id,
      connection,
      session,
    );

    if (!memberProduct) {
      console.error('❌ Producto no encontrado en member');
      throw new NotFoundException(`Product with id "${id}" not found`);
    }

    // ✅ VALIDACIÓN: No permitir actualizar productos con shipment "On The Way"
    if (memberProduct.product.activeShipment) {
      const shipmentStatus =
        await this.logisticsService.getShipmentStatusByProductId(
          id.toString(),
          tenantName,
        );
      if (shipmentStatus === 'On The Way') {
        throw new BadRequestException(
          'Cannot update product with shipment On The Way',
        );
      }
    }

    const { product, member } = memberProduct;

    const isRecoverable = this.productsService.getEffectiveRecoverableValue(
      updateProductDto,
      memberProduct.product.recoverable ?? false,
    );

    await this.productsService.updatePriceIfProvided(
      memberProduct.product as ProductDocument,
      updateProductDto,
    );

    if (!('price' in updateProductDto)) {
      updateProductDto.price = {
        amount: memberProduct.product.price?.amount,
        currencyCode: memberProduct.product.price?.currencyCode as CurrencyCode,
      };
    }

    if (updateProductDto.productCondition === 'Unusable') {
      updateProductDto.status = 'Unavailable';
    }

    if (updateProductDto.fp_shipment !== true) {
      await this.productsService.setNonShipmentStatus(updateProductDto);
    }

    // 🔄 Construir oldProductData correctamente con datos completos
    const productData = (memberProduct.product as any).toObject
      ? (memberProduct.product as any).toObject()
      : memberProduct.product;

    const oldProductData = {
      ...productData, // ✅ Usar el producto completo desde memberProduct
      assignedEmail: member.email,
      assignedMember: `${member.firstName} ${member.lastName}`,
      location: 'Employee',
    };

    return await this.handleMemberProductAssignmentChanges(
      product as ProductDocument,
      member,
      updateProductDto,
      tenantName,
      userId,
      ourOfficeEmail,
      session,
      isRecoverable,
      oldProductData, // ✅ Datos completos del producto original
      connection,
    );
  }

  async handleMemberProductAssignmentChanges(
    product: ProductDocument,
    member: MemberDocument,
    updateDto: UpdateProductDto,
    tenantName: string,
    userId: string,
    ourOfficeEmail: string,
    session: ClientSession,
    isRecoverable: boolean,
    oldProductData: Partial<ProductDocument>,
    connection: Connection,
  ): Promise<{
    shipment?: ShipmentDocument;
    updatedProduct?: ProductDocument;
  }> {
    // 🧩 Caso: Reasignación a otro miembro
    if (
      updateDto.assignedEmail &&
      updateDto.assignedEmail !== product.assignedEmail &&
      updateDto.assignedEmail !== 'none'
    ) {
      const newMember = await this.findByEmailNotThrowError(
        updateDto.assignedEmail,
        connection,
        session,
      );
      if (!newMember) {
        throw new NotFoundException(
          `Member with email "${updateDto.assignedEmail}" not found`,
        );
      }

      let shipment: ShipmentDocument | null = null;

      if (updateDto.fp_shipment) {
        if (!('price' in updateDto) || updateDto.price == null) {
          const price = product.price;
          if (
            price?.amount !== undefined &&
            price?.currencyCode &&
            CURRENCY_CODES.includes(price.currencyCode as CurrencyCode)
          ) {
            updateDto.price = {
              amount: price.amount,
              currencyCode: price.currencyCode as CurrencyCode,
            };
          }
        }

        shipment = await this.logisticsService.tryCreateShipmentIfNeeded(
          product as ProductDocument,
          updateDto,
          tenantName,
          session,
          userId,
          ourOfficeEmail,
          connection, // ✅ FIX: Pasar la conexión
        );
        updateDto.status = product.status;
      } else {
        updateDto.status = await this.productsService.determineProductStatus(
          {
            fp_shipment: false,
            location: updateDto.location || product.location,
            assignedEmail: updateDto.assignedEmail,
            productCondition:
              updateDto.productCondition || product.productCondition,
          },
          tenantName,
        );
      }

      // Calcular lastAssigned usando el helper con información de oficina
      const calculatedLastAssigned =
        await this.calculateLastAssignedWithOfficeInfo(
          product as ProductDocument,
          'Employee', // newLocation
          tenantName,
          updateDto.actionType as
            | 'assign'
            | 'reassign'
            | 'return'
            | 'relocate'
            | 'offboarding',
        );

      await this.moveToMemberCollection(
        session,
        product as ProductDocument,
        newMember,
        { ...updateDto, recoverable: isRecoverable },
        calculatedLastAssigned || '',
        tenantName,
        connection, // ✅ FIX: Pasar la conexión
        userId, // ✅ FIX: Pasar userId para history
        member.country, // ✅ FIX: Pasar country del member origen para history
      );

      // 📜 HISTORY: Se crea en moveToProductsCollection con información completa
      // await this.recordEnhancedAssetHistoryIfNeeded(
      //   updateDto.actionType as HistoryActionType,
      //   oldProductData as ProductDocument,
      //   newProductData as ProductDocument, // ✅ Producto construido manualmente
      //   userId,
      //   newMember.country, // 🏳️ Country code del member destino
      //   member.country, // 🏳️ Country code del member origen
      // );

      return { shipment: shipment ?? undefined, updatedProduct: product };
    }

    // 🧩 Caso: Return a Our office o FP warehouse
    const isReturnOrReassignToGeneral =
      ['return', 'reassign'].includes(updateDto.actionType || '') &&
      (!updateDto.assignedEmail || updateDto.assignedEmail === 'none') &&
      ['Our office', 'FP warehouse'].includes(updateDto.location || '');

    if (isReturnOrReassignToGeneral) {
      if (!userId)
        throw new Error(
          '❌ userId is undefined antes de mllamar a handleProductUnassignment',
        );
      const calculatedStatus =
        await this.productsService.determineProductStatus(
          {
            fp_shipment: updateDto.fp_shipment,
            location: updateDto.location,
            assignedEmail: updateDto.assignedEmail,
            productCondition: product.productCondition,
          },
          tenantName,
          updateDto.actionType,
          updateDto.status,
        );

      const unassigned = await this.handleProductUnassignment(
        session,
        product,
        { ...updateDto, recoverable: isRecoverable, status: calculatedStatus },
        connection,
        member,
        tenantName, // ✅ FIX: Pasar tenantName para sincronización
        userId, // ✅ FIX: Pasar userId para history
      );
      const updatedProduct = unassigned?.[0];
      if (!updatedProduct) throw new Error('Failed to unassign product');

      // 🏭 WAREHOUSE ASSIGNMENT: Si location es "FP warehouse", asignar warehouse
      if (updateDto.location === 'FP warehouse') {
        // Obtener información del usuario para el mensaje de Slack
        const userInfo = userId
          ? await this.getUserInfoFromUserId(userId)
          : undefined;
        const userName =
          userInfo?.userEmail || (userId ? `User ${userId}` : 'Unknown User');

        const warehouseFields = await this.assignWarehouseIfNeeded(
          updateDto,
          updatedProduct,
          tenantName,
          product.lastAssigned || product.assignedEmail, // memberEmail de origen
          userName, // userName con email real
          updateDto.actionType === 'return' ? 'return' : 'reassign', // action
        );

        // Aplicar los campos de warehouse al producto actualizado
        if (warehouseFields.fpWarehouse) {
          Object.assign(updatedProduct, {
            fpWarehouse: warehouseFields.fpWarehouse,
          });

          // 💾 GUARDAR EL PRODUCTO: Necesario para persistir los campos del warehouse
          await updatedProduct.save({ session });

          // 🔄 SYNC: Sincronización de warehouse se hace al final después del shipment
          // (Comentado para evitar sincronización duplicada - se hace en sync final)

          this.logger.log(
            `🏭 [handleProductFromMemberCollection] Warehouse fields applied, saved and synced: ${JSON.stringify(warehouseFields.fpWarehouse)}`,
          );
        }
      }

      // 🏢 OFFICE ASSIGNMENT: Si location es "Our office", asignar office
      if (updateDto.location === 'Our office' && updateDto.officeId) {
        const officeData = await this.buildOfficeObject(
          updateDto.officeId as string,
          tenantName,
        );

        // Aplicar los campos de office al producto actualizado
        if (officeData.office) {
          Object.assign(updatedProduct, {
            office: officeData.office,
          });

          // 💾 GUARDAR EL PRODUCTO: Necesario para persistir los campos de la oficina
          await updatedProduct.save({ session });

          // 🔄 SYNC: Sincronización de office se hace al final después del shipment
          // (Comentado para evitar sincronización duplicada - se hace en sync final)

          this.logger.log(
            `🏢 [handleProductFromMemberCollection] Office fields applied, saved and synced: ${JSON.stringify(officeData.office)}`,
          );
        }
      }

      // 🧹 CLEANUP: Limpiar objetos warehouse/office según movimiento de ubicación
      const cleanupFields = this.handleLocationObjectCleanup(
        updateDto.location,
        product,
      );
      if (Object.keys(cleanupFields).length > 0) {
        Object.assign(updatedProduct, cleanupFields);
        await updatedProduct.save({ session });
        this.logger.log(
          `🧹 [handleProductFromProductsCollection] Cleanup applied: ${JSON.stringify(cleanupFields)}`,
        );
      }

      let shipment: ShipmentDocument | null = null;

      if (updateDto.fp_shipment && updatedProduct) {
        // 🏭 Calcular warehouseCountryCode para destino antes de crear el shipment
        const destinationWarehouseCountryCode =
          updateDto.location === 'FP warehouse'
            ? await this.logisticsService.getWarehouseCountryCodeForDestination(
                product,
                tenantName,
              )
            : undefined;

        shipment =
          await this.logisticsService.maybeCreateShipmentAndUpdateStatus(
            updatedProduct,
            updateDto,
            tenantName,
            updateDto.actionType!,
            session,
            {
              location: oldProductData.location || product.location,
              assignedEmail:
                oldProductData.assignedEmail || product.assignedEmail,
              assignedMember:
                oldProductData.assignedMember || product.assignedMember,
              officeId: product.office?.officeId?.toString(), // ✅ FIX: Incluir officeId del producto actual
              warehouseCountryCode: product.fpWarehouse?.warehouseCountryCode, // 🏭 Incluir warehouseCountryCode del producto actual
            },
            {
              location: updateDto.location,
              assignedEmail: updateDto.assignedEmail,
              assignedMember: updateDto.assignedMember,
              officeId: updateDto.officeId,
              warehouseCountryCode: destinationWarehouseCountryCode, // 🏭 Usar el valor calculado
            },
            userId,
            ourOfficeEmail,
            connection, // ✅ FIX: Pasar la conexión que creó la session
          );
      }

      if (!updatedProduct.status) {
        throw new Error(
          '❌ updatedProduct.status está undefined después del shipment logic',
        );
      }

      // 🔄 SYNC FINAL: Sincronizar producto con status actualizado después del shipment
      if (
        tenantName &&
        (updateDto.location === 'FP warehouse' ||
          updateDto.location === 'Our office')
      ) {
        try {
          // Remover la marca de sincronización para forzar la actualización final
          delete (updatedProduct as any)._alreadySyncedToGlobal;

          await this.syncProductToGlobal(
            updatedProduct,
            tenantName,
            'products',
            undefined,
          );

          this.logger.log(
            `🔄 [handleProductFromMemberCollection] Final sync completed with updated status: ${updatedProduct.status}`,
          );
        } catch (error) {
          this.logger.error(
            `❌ [handleProductFromMemberCollection] Error in final sync after shipment:`,
            error,
          );
        }
      }

      if (!userId)
        throw new Error('❌ userId is undefined antes de crear history');

      // 📜 HISTORY: Crear registro con información completa DESPUÉS de asignar warehouse/office
      try {
        console.log(
          '📜 [handleProductFromMemberCollection] Creating history:',
          {
            actionType: updateDto.actionType,
            userId: userId,
            productId: product._id,
            oldLocation: product.location,
            newLocation: updateDto.location,
            memberCountry: member.country,
            hasWarehouse: !!updatedProduct.fpWarehouse,
            hasOffice: !!updatedProduct.office,
          },
        );

        await this.recordEnhancedAssetHistoryIfNeeded(
          updateDto.actionType as HistoryActionType,
          product as ProductDocument, // ✅ Producto original desde member collection
          updatedProduct, // ✅ Producto final con warehouse/office asignado
          userId,
          undefined, // newMemberCountry (no aplica)
          member.country, // 🏳️ Country code del member original para mostrar bandera
        );

        console.log(
          '✅ [handleProductFromMemberCollection] History created successfully',
        );
      } catch (error) {
        this.logger.error(
          '❌ Error creating history in handleProductFromMemberCollection:',
          error,
        );
      }

      return {
        shipment: shipment ?? undefined,
        updatedProduct,
      };
    }

    // 🧩 Caso: Actualización sin cambio de dueño
    const updated = await this.updateEmbeddedProduct(
      member,
      product._id!,
      {
        ...updateDto,
        recoverable: isRecoverable,
      } as Partial<ProductDocument>,
      tenantName,
    ); // 🎯 Pasar tenantName

    await this.recordAssetHistoryIfNeeded(
      updateDto.actionType,
      oldProductData,
      updated,
      userId,
    );

    return {
      updatedProduct: updated as ProductDocument,
    };
  }

  // Nueva función para manejar la desasignación del producto
  private async handleProductUnassignment(
    session: any,
    product: ProductDocument,
    updateProductDto: UpdateProductDto,
    connection: Connection,
    currentMember?: MemberDocument,
    tenantName?: string,
    userId?: string,
  ) {
    if (currentMember) {
      console.log('🔁 Llamando a moveToProductsCollection...');
      const created = await this.moveToProductsCollection(
        session,
        product,
        currentMember,
        updateProductDto,
        connection,
        tenantName,
        userId,
      );
      return created;
    } else {
      const updated = await this.updateProductAttributes(
        session,
        product,
        updateProductDto,
        'products',
        undefined,
        tenantName,
      );

      return [updated];
    }
  }

  async offboardMember(
    memberId: ObjectId,
    data: Array<{
      product: any;
      relocation: 'New employee' | 'FP warehouse' | 'My office';
      newMember?: { email: string; fullName: string };
      desirableDate: string | { origin?: string; destination?: string };
      fp_shipment?: boolean;
      officeId?: string; // 🏢 Nuevo campo para oficina específica
    }>,
    userId: string,
    tenantName: string,
    ourOfficeEmail: string,
  ): Promise<{ message: string; lastShipmentCreated?: ObjectId }> {
    const connection =
      await this.connectionService.getTenantConnection(tenantName);
    const session = await connection.startSession();
    session.startTransaction();

    try {
      const member = await this.membersService.findById(memberId, tenantName);
      if (!member)
        throw new NotFoundException(`Member with id ${memberId} not found`);

      const updatedProducts: any[] = [];
      const historyNewData: any[] = [];
      const initialMember = JSON.parse(JSON.stringify(member));
      let lastShipmentCreated: ObjectId | null = null; // 🚢 Rastrear último shipment

      for (const item of data) {
        const product = item.product;

        let actionType: 'assign' | 'reassign' | 'return' | 'relocate';
        let location: 'Employee' | 'FP warehouse' | 'Our office';

        if (item.relocation === 'New employee') {
          actionType = 'reassign';
          location = 'Employee';
        } else {
          actionType = 'return';
          // 🏢 Si se proporciona officeId, siempre usar 'Our office'
          if (item.officeId) {
            location = 'Our office';
          } else {
            location =
              item.relocation === 'My office' ? 'Our office' : 'FP warehouse';
          }
        }

        const status = await this.productsService.determineProductStatus(
          {
            fp_shipment: item.fp_shipment,
            location,
            assignedEmail: item.newMember?.email ?? '',
            productCondition: product.productCondition,
          },
          tenantName,
        );

        const updateDto: UpdateProductDto = {
          name: product.name,
          serialNumber: product.serialNumber,
          assignedEmail: '',
          assignedMember: '',
          desirableDate: item.desirableDate,
          fp_shipment: item.fp_shipment,
          actionType,
          recoverable: product.recoverable,
          productCondition: product.productCondition,
          location,
          status,
          attributes: product.attributes,
          category: product.category,
        };

        if (item.relocation === 'New employee' && item.newMember) {
          updateDto.assignedEmail = item.newMember.email;
          updateDto.assignedMember = item.newMember.fullName;
        }

        // 🏢 Si se proporciona officeId, agregarlo al updateDto para crear el objeto office
        if (item.officeId) {
          updateDto.officeId = item.officeId;
        }

        console.log('🧪 En offboardMember → userId:', userId);
        const result = await this.productsService.update(
          product._id,
          updateDto,
          tenantName,
          userId,
          ourOfficeEmail,
        );

        updatedProducts.push(result.updatedProduct);

        // 🚢 Capturar el ID del último shipment creado
        if (result.shipment?._id) {
          lastShipmentCreated = result.shipment._id;
          console.log('🚢 Shipment creado/consolidado:', {
            productId: product._id.toString(),
            shipmentId: result.shipment._id.toString(),
            origin: result.shipment.origin,
            destination: result.shipment.destination,
            status: result.shipment.shipment_status,
          });
        } else {
          console.log('⏭️ Producto sin shipment:', {
            productId: product._id.toString(),
            relocation: item.relocation,
            fp_shipment: item.fp_shipment,
          });
        }
        // 🏳️ Preparar datos para newData con country y officeName si aplica
        const newDataEntry: any = {
          productId: product._id,
          newLocation: updateDto.location,
          assignedEmail: updateDto.assignedEmail,
          assignedMember: updateDto.assignedMember,
        };

        // Agregar country según la nueva location
        if (updateDto.location === 'Our office') {
          // Para Our office, obtener country y officeName del resultado
          if (result.updatedProduct?.office) {
            newDataEntry.country =
              result.updatedProduct.office.officeCountryCode;
            newDataEntry.officeName = result.updatedProduct.office.officeName;
          }
        } else if (updateDto.location === 'FP warehouse') {
          // Para FP warehouse, obtener country del resultado
          if (result.updatedProduct?.fpWarehouse) {
            newDataEntry.country =
              result.updatedProduct.fpWarehouse.warehouseCountryCode;
          }
        } else if (
          updateDto.location === 'Employee' &&
          updateDto.assignedEmail
        ) {
          // Para Employee, obtener country del member destino
          try {
            const destinationMember = await this.membersService.findByEmail(
              updateDto.assignedEmail,
              session,
            );
            if (destinationMember?.country) {
              newDataEntry.country = destinationMember.country;
            }
          } catch (error) {
            console.warn(
              'Could not find destination member for country in offboarding:',
              error,
            );
          }
        }

        historyNewData.push(newDataEntry);
      }

      await this.membersService.softDeleteMember(memberId, tenantName, true);
      await this.slackService.sendOffboardingMessage(member, data, tenantName);

      const assignedEmail = member.email;

      await this.historyService.create({
        actionType: 'offboarding',
        itemType: 'members',
        userId,
        changes: {
          oldData: {
            ...initialMember,
            products: initialMember.products.map((p) => ({
              ...p,
              lastAssigned: assignedEmail,
              country: member.country, // 🏳️ Agregar country del member en oldData
            })),
          },
          newData: {
            products: historyNewData,
          },
        },
      });

      await session.commitTransaction();

      // 🚢 Log para verificar que se está retornando el shipment
      console.log('✅ Offboarding completado:', {
        memberId: memberId.toString(),
        productsCount: data.length,
        lastShipmentCreated: lastShipmentCreated?.toString() || 'undefined',
      });

      return {
        message: 'Offboarding completed successfully',
        lastShipmentCreated: lastShipmentCreated || undefined,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async bulkReassignProducts(
    items: BulkReassignDto['items'],
    userId: string,
    tenantName: string,
    ourOfficeEmail: string,
  ) {
    await new Promise((resolve) => process.nextTick(resolve));

    const connection =
      await this.connectionService.getTenantConnection(tenantName);
    const session = await connection.startSession();
    session.startTransaction();

    try {
      // Registra las conexiones y sesiones para depuración
      console.log(
        `📊 Connection info: ${connection.name}, readyState: ${connection.readyState}`,
      );
      console.log(
        `📊 Session info: ${session.id}, inTransaction: ${session.inTransaction()}`,
      );

      for (const item of items) {
        const { productId, actionType, ...rest } = item;
        const objectId = new mongoose.Types.ObjectId(productId);

        const updateDto: any = {
          ...rest,
          actionType,
        };

        if (actionType === 'return') {
          updateDto.assignedEmail = '';
          updateDto.assignedMember = '';
          updateDto.location = rest.newLocation;
        }

        // Asegúrate de pasar la conexión correcta
        await this.productsService.updateWithinTransaction(
          objectId,
          updateDto,
          tenantName,
          userId,
          ourOfficeEmail,
          session,
          connection,
        );
      }

      await session.commitTransaction();

      // 🔄 SYNC: Sincronizar productos después de bulk reassign
      // Nota: Los productos individuales ya se sincronizan en updateWithinTransaction,
      // pero agregamos este log para tracking

      return { message: 'Bulk reassign completed successfully' };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async updateProductsMetadataForMember(
    member: MemberDocument,
    oldEmail: string,
    oldFullName: string,
    session: ClientSession,
  ): Promise<void> {
    const newEmail = member.email;
    const newFullName = `${member.firstName} ${member.lastName}`;

    const updatedProducts = member.products.map((product) => {
      if (
        product.assignedEmail === oldEmail &&
        product.assignedMember === oldFullName
      ) {
        product.assignedEmail = newEmail;
        product.assignedMember = newFullName;
      }
      return product;
    });

    member.products = updatedProducts;
    await member.save({ session });
  }

  /**
   * Construir objeto office para un producto (similar a fpWarehouse)
   */
  public async buildOfficeObject(
    officeId: string,
    tenantName: string,
  ): Promise<{ office?: any }> {
    if (!officeId) {
      return {};
    }

    try {
      const office = await this.officesService.findByIdAndTenant(
        new Types.ObjectId(officeId),
        tenantName,
      );

      if (!office) {
        console.warn(
          `⚠️ Office ${officeId} no encontrado para tenant ${tenantName}`,
        );
        return {};
      }

      return {
        office: {
          officeId: office._id,
          officeCountryCode: office.country,
          officeName: office.name,
          assignedAt: new Date(),
          isDefault: office.isDefault,
        },
      };
    } catch (error) {
      console.error('Error construyendo objeto office:', error);
      return {};
    }
  }

  /**
   * Obtener información de oficina para lastAssigned
   */
  private async getOfficeInfoForLastAssigned(
    product: ProductDocument,
    tenantName: string,
  ): Promise<{ officeCountryCode?: string; officeName?: string } | undefined> {
    // Si el producto tiene información de oficina, usarla
    if (product.office?.officeCountryCode && product.office?.officeName) {
      return {
        officeCountryCode: product.office.officeCountryCode,
        officeName: product.office.officeName,
      };
    }

    // Si tiene office.officeId pero no la información completa, buscarla
    if (product.office?.officeId) {
      try {
        const office = await this.officesService.findByIdAndTenant(
          new Types.ObjectId(product.office.officeId.toString()),
          tenantName,
        );

        if (office) {
          return {
            officeCountryCode: office.country,
            officeName: office.name,
          };
        }
      } catch (error) {
        console.warn('Error obteniendo información de oficina:', error);
      }
    }

    return undefined;
  }

  /**
   * Maneja la asignación de oficina: usa officeId proporcionado o oficina default
   */
  public async handleOfficeAssignment(
    officeId: string | undefined,
    location: string | undefined,
    currentOffice: any,
    tenantName: string,
  ): Promise<{ office?: any; officeId?: any }> {
    // Si se proporciona officeId explícitamente, usarlo
    if (officeId && tenantName) {
      const officeData = await this.buildOfficeObject(officeId, tenantName);
      return {
        officeId: officeId as any,
        ...officeData,
      };
    }

    // Si location es "Our office" pero no se proporciona officeId, usar oficina default
    if (location === 'Our office' && tenantName) {
      try {
        const defaultOffice =
          await this.officesService.getDefaultOffice(tenantName);

        if (defaultOffice) {
          const officeData = await this.buildOfficeObject(
            defaultOffice._id.toString(),
            tenantName,
          );
          return {
            officeId: defaultOffice._id,
            ...officeData,
          };
        } else {
          // 🚫 No hay oficina default - lanzar error claro
          throw new BadRequestException(
            'No default office found for this tenant. Please create an office first before assigning products to "Our office".',
          );
        }
      } catch (error) {
        console.error('Error obteniendo oficina default:', error);
        throw error; // Re-lanzar el error para que no se ignore
      }
    }

    // 🔥 FIX: Si location NO es "Our office", NO mantener el objeto office
    // Solo mantener office si location es "Our office"
    if (location === 'Our office' && currentOffice) {
      return { office: currentOffice };
    }

    // Para cualquier otra location (Employee, FP warehouse), no incluir office
    return {};
  }

  /**
   * Calcula lastAssigned con información completa de oficina si es necesario
   */
  private async calculateLastAssignedWithOfficeInfo(
    product: ProductDocument,
    newLocation: 'Employee' | 'FP warehouse' | 'Our office',
    tenantName: string,
    actionType?: 'assign' | 'reassign' | 'return' | 'relocate' | 'offboarding',
  ): Promise<string | undefined> {
    // Si el producto está saliendo de "Our office", obtener información completa
    if (product.location === 'Our office') {
      const officeInfo = await this.getOfficeInfoForLastAssigned(
        product,
        tenantName,
      );

      return this.lastAssignedHelper.calculateForProductUpdateWithOfficeInfo(
        product,
        newLocation,
        officeInfo,
        actionType,
      );
    }

    // Para otros casos, usar el método normal
    return this.lastAssignedHelper.calculateForProductUpdate(
      product,
      newLocation,
      actionType,
    );
  }

  /**
   * Método específico para obtener campos de limpieza para usar con $unset
   * Retorna campos para usar con $unset en MongoDB
   */
  private getLocationCleanupForUnset(
    newLocation: string | undefined,
    currentProduct: any,
  ): { fpWarehouse?: 1; office?: 1 } {
    const cleanupFields: { fpWarehouse?: 1; office?: 1 } = {};

    // Si se mueve DESDE warehouse A office → limpiar fpWarehouse
    if (
      currentProduct.fpWarehouse &&
      currentProduct.location === 'FP warehouse' &&
      newLocation === 'Our office'
    ) {
      cleanupFields.fpWarehouse = 1;
      this.logger.log(
        `🧹 [getLocationCleanupForUnset] Limpiando fpWarehouse: producto se mueve de warehouse a office`,
      );
    }

    // Si se mueve DESDE office A warehouse → limpiar office
    if (
      currentProduct.office &&
      currentProduct.location === 'Our office' &&
      newLocation === 'FP warehouse'
    ) {
      cleanupFields.office = 1;
      this.logger.log(
        `🧹 [getLocationCleanupForUnset] Limpiando office: producto se mueve de office a warehouse`,
      );
    }

    // Si se mueve DESDE warehouse/office A employee → limpiar ambos
    if (
      newLocation === 'Employee' &&
      (currentProduct.location === 'FP warehouse' ||
        currentProduct.location === 'Our office')
    ) {
      if (currentProduct.fpWarehouse) {
        cleanupFields.fpWarehouse = 1;
        this.logger.log(
          `🧹 [getLocationCleanupForUnset] Limpiando fpWarehouse: producto se mueve a employee`,
        );
      }
      if (currentProduct.office) {
        cleanupFields.office = 1;
        this.logger.log(
          `🧹 [getLocationCleanupForUnset] Limpiando office: producto se mueve a employee`,
        );
      }
    }

    return cleanupFields;
  }

  /**
   * Maneja la limpieza de objetos warehouse y office según la nueva ubicación
   * Cuando un producto se mueve entre warehouse↔office, debe limpiar el objeto anterior
   * Retorna campos con undefined para compatibilidad con código existente
   */
  private handleLocationObjectCleanup(
    newLocation: string | undefined,
    currentProduct: any,
  ): { fpWarehouse?: undefined; office?: undefined } {
    const cleanupFields: { fpWarehouse?: undefined; office?: undefined } = {};

    // Si se mueve DESDE warehouse A office → limpiar fpWarehouse
    if (
      currentProduct.fpWarehouse &&
      currentProduct.location === 'FP warehouse' &&
      newLocation === 'Our office'
    ) {
      cleanupFields.fpWarehouse = undefined;
      this.logger.log(
        `🧹 [handleLocationObjectCleanup] Limpiando fpWarehouse: producto se mueve de warehouse a office`,
      );
    }

    // Si se mueve DESDE office A warehouse → limpiar office
    if (
      currentProduct.office &&
      currentProduct.location === 'Our office' &&
      newLocation === 'FP warehouse'
    ) {
      cleanupFields.office = undefined;
      this.logger.log(
        `🧹 [handleLocationObjectCleanup] Limpiando office: producto se mueve de office a warehouse`,
      );
    }

    // Si se mueve DESDE warehouse/office A employee → limpiar ambos
    if (
      newLocation === 'Employee' &&
      (currentProduct.location === 'FP warehouse' ||
        currentProduct.location === 'Our office')
    ) {
      if (currentProduct.fpWarehouse) {
        cleanupFields.fpWarehouse = undefined;
        this.logger.log(
          `🧹 [handleLocationObjectCleanup] Limpiando fpWarehouse: producto se mueve a employee`,
        );
      }
      if (currentProduct.office) {
        cleanupFields.office = undefined;
        this.logger.log(
          `🧹 [handleLocationObjectCleanup] Limpiando office: producto se mueve a employee`,
        );
      }
    }

    return cleanupFields;
  }

  // ==================== CSV METHODS ====================

  /**
   * 🏢 Maneja asignación de oficina para CSV
   * Delega al coordinador específico para CSV
   */
  async handleCSVOfficeAssignment(
    country: string,
    officeName: string,
    tenantName: string,
    userId: string,
  ) {
    const result =
      await this.csvOfficeCoordinatorService.handleOfficeAssignmentForCSV(
        country,
        officeName,
        tenantName,
        userId,
      );

    if (!result.success) {
      throw new BadRequestException(
        `Error assigning office: ${result.message}`,
      );
    }

    return { office: result.office };
  }

  /**
   * 🏭 Maneja asignación de warehouse para CSV
   * Usa el servicio de warehouse assignment existente
   */
  async handleCSVWarehouseAssignment(
    country: string,
    tenantName: string,
    userId: string,
    category: string,
  ) {
    const warehouseAssignment =
      await this.warehouseAssignmentService.assignProductToWarehouseWithNotification(
        country,
        tenantName,
        'temp-product-id', // Se generará el ID real después
        category,
        'CSV User', // userName
        'assign', // action
        1, // productCount
      );

    if (!warehouseAssignment.success || !warehouseAssignment.warehouseId) {
      throw new BadRequestException(
        `Error assigning warehouse for country ${country}: ${warehouseAssignment.message}`,
      );
    }

    return {
      fpWarehouse: {
        warehouseId: warehouseAssignment.warehouseId,
        warehouseCountryCode: warehouseAssignment.warehouseCountryCode!,
        warehouseName: warehouseAssignment.warehouseName!,
        assignedAt: new Date(),
        status: 'STORED',
      },
    };
  }
}
