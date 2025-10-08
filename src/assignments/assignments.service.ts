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
import { WarehouseAssignmentService } from 'src/warehouses/services/warehouse-assignment.service';

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
    private readonly warehouseAssignmentService: WarehouseAssignmentService,
    @Inject(forwardRef(() => UsersService))
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
        this.logger.warn(`Member not found: ${memberEmail}`);
        return null;
      }

      if (!member.country) {
        this.logger.warn(
          `No country found for member ${memberEmail} (member exists but country field is empty)`,
        );
        return null;
      }

      this.logger.log(
        `✅ Found country for member ${memberEmail}: ${member.country}`,
      );
      return member.country;
    } catch (error) {
      this.logger.error(
        `Error getting member origin country for ${memberEmail}:`,
        error,
      );
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
    this.logger.log(
      `🔄 [determineWarehouseStatus] Product ${product._id || 'unknown'}: status=${product.status}, fp_shipment=${product.fp_shipment}, activeShipment=${product.activeShipment}, location=${product.location}, isComingToWarehouse=${isComingToWarehouse}`,
    );

    // Si el producto tiene shipment activo
    if (product.fp_shipment === true || product.activeShipment === true) {
      const status = isComingToWarehouse ? 'IN_TRANSIT_IN' : 'IN_TRANSIT_OUT';
      this.logger.log(
        `📦 [determineWarehouseStatus] Product has active shipment → ${status}`,
      );
      return status;
    }

    // Si el producto está disponible y no tiene shipment activo
    if (product.status === 'Available' && !product.activeShipment) {
      this.logger.log(
        `✅ [determineWarehouseStatus] Product is Available and no active shipment → STORED`,
      );
      return 'STORED';
    }

    // Si el producto está en tránsito hacia el warehouse
    if (
      (product.status === 'In Transit' ||
        product.status === 'In Transit - Missing Data') &&
      product.location === 'FP warehouse'
    ) {
      this.logger.log(
        `🚚 [determineWarehouseStatus] Product in transit to FP warehouse → IN_TRANSIT_IN`,
      );
      return 'IN_TRANSIT_IN';
    }

    // Default: STORED
    this.logger.log(`🏪 [determineWarehouseStatus] Default case → STORED`);
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

      // Si se proporciona memberEmail directamente (más confiable), usar ese
      if (memberEmail) {
        originCountry = await this.getMemberOriginCountry(
          memberEmail,
          tenantName,
        );
      }

      // Si no se proporcionó memberEmail, intentar con lastAssigned
      if (!originCountry && product.lastAssigned) {
        originCountry = await this.getMemberOriginCountry(
          product.lastAssigned,
          tenantName,
        );
      }

      // Si no tiene lastAssigned pero tiene assignedEmail actual, usar ese
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
        this.logger.error(
          `❌ [assignWarehouseIfNeeded] ${assignmentResult.message}`,
        );
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
      this.logger.error(
        `Error assigning warehouse for product ${product._id}:`,
        error,
      );
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
  ): Promise<void> {
    try {
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

        serialNumber: product.serialNumber || undefined,
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
          product.fpWarehouse.warehouseName
            ? {
                warehouseId: product.fpWarehouse.warehouseId as any,
                warehouseCountryCode: product.fpWarehouse.warehouseCountryCode,
                warehouseName: product.fpWarehouse.warehouseName,
                assignedAt: product.fpWarehouse.assignedAt,
                status:
                  product.fpWarehouse.status === 'IN_TRANSIT'
                    ? 'IN_TRANSIT_IN'
                    : (product.fpWarehouse.status as any),
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

    console.log(`🧪 Found ${products.length} products to assign...`);

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

    const { serialNumber, price, productCondition, fp_shipment, ...rest } =
      createProductDto;

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
    };

    member.products.push(productData);
    await member.save({ session });

    // 🔄 SYNC: Sincronizar producto asignado a colección global
    if (tenantName) {
      // Crear objeto producto completo para sincronización
      const productForSync = {
        _id: new Types.ObjectId(), // Generar ID nuevo
        ...productData,
        updatedAt: new Date(),
      };

      await this.syncProductToGlobal(
        productForSync,
        tenantName,
        'members', // Producto está en colección members
        {
          memberId: member._id as any,
          memberEmail: member.email,
          memberName: `${member.firstName} ${member.lastName}`,
          assignedAt: new Date(),
        },
      );
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
          console.log(
            `Member ${member.email} has no products or products is not an array`,
          );
          return [];
        }

        return (member.products || []).map((p: any) => ({
          ...JSON.parse(JSON.stringify(p)),
          assignedEmail: member.email,
          assignedMember: `${member.firstName} ${member.lastName}`,
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
    console.log('🔍 Buscando producto en products:', productId);
    if (!product) {
      console.log(
        '🪵 ID recibido en Logistics antes de getProductByMembers desde getProductForReassign:',
        productId,
        typeof productId,
        productId instanceof Types.ObjectId,
      );
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
  ) {
    const newMember = await this.membersService.findByEmailNotThrowError(
      updateProductDto.assignedEmail!,
    );

    if (!newMember) {
      throw new NotFoundException(
        `Member with email "${updateProductDto.assignedEmail}" not found`,
      );
    }

    await this.moveToMemberCollection(
      session,
      product,
      newMember,
      updateProductDto,
      product.assignedEmail || '',
      tenantName,
      providedConnection, // ✅ FIX: Pasar la conexión proporcionada
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

    if (updatedFields.assignedEmail === '') {
      updatedFields.lastAssigned = product.assignedEmail;
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

  public async moveToMemberCollection(
    session: any,
    product: ProductDocument,
    newMember: MemberDocument,
    updateProductDto: UpdateProductDto,
    lastAssigned: string,
    tenantName?: string,
    providedConnection?: Connection,
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
  }

  // Metodo para mover un producto de un miembro a la colección de productos
  public async moveToProductsCollection(
    session: any,
    product: ProductDocument,
    member: MemberDocument,
    updateProductDto: UpdateProductDto,
    connection: Connection,
    tenantName?: string,
  ) {
    this.logger.log('📍 Origen: member -> Destino: products');
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
    this.logger.log(
      `🏭 [moveToProductsCollection] Checking warehouse assignment for location: ${updateProductDto.location}`,
    );

    console.log(`🔍 [moveToProductsCollection] DEBUG - updateProductDto:`, {
      location: updateProductDto.location,
      actionType: updateProductDto.actionType,
      assignedEmail: updateProductDto.assignedEmail,
    });
    console.log(`🔍 [moveToProductsCollection] DEBUG - product:`, {
      _id: product._id,
      lastAssigned: product.lastAssigned,
      assignedEmail: product.assignedEmail,
    });
    console.log(`🔍 [moveToProductsCollection] DEBUG - member:`, {
      email: member.email,
      country: member.country,
    });

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
      lastAssigned: member.email,
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
    };
    const productModel = connection.model(Product.name, ProductSchema);

    this.logger.log(
      `📦 [moveToProductsCollection] Creating product with data: ${JSON.stringify(
        {
          _id: updateData._id,
          location: updateData.location,
          lastAssigned: updateData.lastAssigned,
        },
      )}`,
    );

    const createdProducts = await productModel.create([updateData], {
      session,
    });
    console.log('✅ Producto movido a colección de productos');

    // 🔄 SYNC: Sincronizar producto movido a products collection
    this.logger.log(
      `🔄 [moveToProductsCollection] Starting sync to global collection...`,
    );
    this.logger.log(
      `🔄 [moveToProductsCollection] tenantName: ${tenantName}, createdProducts.length: ${createdProducts.length}`,
    );

    // 🌐 SINCRONIZACIÓN SIMPLE: Siempre sincronizar
    if (tenantName && createdProducts.length > 0) {
      this.logger.log(
        `🔄 [moveToProductsCollection] Syncing product ${updateData._id} to global collection`,
      );

      try {
        await this.syncProductToGlobal(
          createdProducts[0],
          tenantName,
          'products',
          undefined,
        );
        this.logger.log(
          `✅ [moveToProductsCollection] Product ${updateData._id} synced successfully to global collection`,
        );
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
    console.log('🧪 updateProductAttributes');
    console.log('🧪 updateProductDto:', updateProductDto);
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
    console.log(
      '🧾 Fin de updateProductAttributes — no se registró history acá',
    );
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
  ): Promise<ProductDocument | Product> {
    const index = member.products.findIndex(
      (p) => p._id!.toString() === productId.toString(),
    );
    if (index === -1) {
      throw new NotFoundException('Product not found in member');
    }

    Object.assign(member.products[index], updatedFields);
    await member.save();

    return member.products[index];
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
    if (product.activeShipment) {
      throw new BadRequestException(
        'This product is currently part of an active shipment and cannot be modified.',
      );
    }

    const productCopy = { ...product.toObject() };
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
        productCopy,
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
      }

      await this.moveToMemberCollection(
        session,
        product,
        newMember,
        { ...updateDto, recoverable: isRecoverable },
        product.assignedEmail || '',
        tenantName,
        connection, // ✅ FIX: Pasar la conexión
      );

      await this.recordAssetHistoryIfNeeded(
        updateDto.actionType,
        productCopy,
        {
          ...product.toObject(),
          assignedEmail: newMember.email,
          assignedMember: `${newMember.firstName} ${newMember.lastName}`,
          status: updateDto.status,
        },
        userId,
      );

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
    await this.updateProductAttributes(
      session,
      product,
      { ...updateDto, recoverable: isRecoverable },
      'products',
    );

    return {
      updatedProduct: product,
    };
  }

  private async recordAssetHistoryIfNeeded(
    actionType: HistoryActionType | undefined,
    oldData: any,
    newData: any,
    userId: string,
  ) {
    console.log('📜 recordAssetHistoryIfNeeded → userId:', userId);
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

    const productCopy = { ...memberProduct.product };
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

    return await this.handleMemberProductAssignmentChanges(
      product as ProductDocument,
      member,
      updateProductDto,
      tenantName,
      userId,
      ourOfficeEmail,
      session,
      isRecoverable,
      productCopy,
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

      await this.moveToMemberCollection(
        session,
        product as ProductDocument,
        newMember,
        { ...updateDto, recoverable: isRecoverable },
        product.assignedEmail || '',
        tenantName,
        connection, // ✅ FIX: Pasar la conexión
      );

      await this.recordAssetHistoryIfNeeded(
        updateDto.actionType,
        oldProductData,
        {
          ...product,
          assignedEmail: newMember.email,
          assignedMember: `${newMember.firstName} ${newMember.lastName}`,
          status: updateDto.status,
        },
        userId,
      );

      return { shipment: shipment ?? undefined, updatedProduct: product };
    }

    // 🧩 Caso: Return a Our office o FP warehouse
    const isReturnOrReassignToGeneral =
      ['return', 'reassign'].includes(updateDto.actionType || '') &&
      (!updateDto.assignedEmail || updateDto.assignedEmail === 'none') &&
      ['Our office', 'FP warehouse'].includes(updateDto.location || '');

    if (isReturnOrReassignToGeneral) {
      console.log('🔁 Caso: Return o Reassign a', updateDto.location);

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
      );
      const updatedProduct = unassigned?.[0];
      if (!updatedProduct) throw new Error('Failed to unassign product');

      // 🏭 WAREHOUSE ASSIGNMENT: Si location es "FP warehouse", asignar warehouse
      if (updateDto.location === 'FP warehouse') {
        this.logger.log(
          `🏭 [handleProductFromProductsCollection] Product moving to FP warehouse, assigning warehouse`,
        );

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
          this.logger.log(
            `🏭 [handleProductFromProductsCollection] Warehouse fields applied: ${JSON.stringify(warehouseFields.fpWarehouse)}`,
          );
        }
      }

      let shipment: ShipmentDocument | null = null;

      if (updateDto.fp_shipment && updatedProduct) {
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
            },
            {
              location: updateDto.location,
              assignedEmail: updateDto.assignedEmail,
              assignedMember: updateDto.assignedMember,
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

      if (!userId)
        throw new Error('❌ userId is undefined antes de crear history');
      await this.recordAssetHistoryIfNeeded(
        updateDto.actionType,
        oldProductData,
        {
          ...updatedProduct,
          status: updateDto.status,
          location: updateDto.location,
        },
        userId,
      );

      return {
        shipment: shipment ?? undefined,
        updatedProduct,
      };
    }

    // 🧩 Caso: Actualización sin cambio de dueño
    const updated = await this.updateEmbeddedProduct(member, product._id!, {
      ...updateDto,
      recoverable: isRecoverable,
    } as Partial<ProductDocument>);

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
      );
      return created;
    } else {
      const updated = await this.updateProductAttributes(
        session,
        product,
        updateProductDto,
        'products',
        undefined,
        // tenantName,
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
    }>,
    userId: string,
    tenantName: string,
    ourOfficeEmail: string,
  ): Promise<{ message: string }> {
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

      for (const item of data) {
        const product = item.product;

        let actionType: 'assign' | 'reassign' | 'return' | 'relocate';
        let location: 'Employee' | 'FP warehouse' | 'Our office';

        if (item.relocation === 'New employee') {
          actionType = 'reassign';
          location = 'Employee';
        } else {
          actionType = 'return';
          location =
            item.relocation === 'My office' ? 'Our office' : 'FP warehouse';
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

        console.log('🧪 En offboardMember → userId:', userId);
        const result = await this.productsService.update(
          product._id,
          updateDto,
          tenantName,
          userId,
          ourOfficeEmail,
        );

        updatedProducts.push(result.updatedProduct);
        historyNewData.push({
          productId: product._id,
          newLocation: updateDto.location,
          assignedEmail: updateDto.assignedEmail,
          assignedMember: updateDto.assignedMember,
        });
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
            })),
          },
          newData: {
            products: historyNewData,
          },
        },
      });

      await session.commitTransaction();
      return { message: 'Offboarding completed successfully' };
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
      this.logger.debug(
        `✅ Bulk reassign completed for ${items.length} products in tenant ${tenantName}`,
      );

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
}
