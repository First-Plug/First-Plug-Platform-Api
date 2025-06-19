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
import { HistoryActionType } from 'src/history/validations/create-history.zod';
import { ShipmentDocument } from 'src/shipments/schema/shipment.schema';
import { BulkReassignDto } from 'src/assignments/dto/bulk-reassign.dto';
import { TenantModelRegistry } from 'src/infra/db/tenant-model-registry';
import { LogisticsService } from 'src/logistics/logistics.sevice';

@Injectable()
export class AssignmentsService {
  private readonly logger = new Logger(AssignmentsService.name);

  constructor(
    @Inject('MEMBER_MODEL') private readonly memberModel: Model<Member>,
    private readonly connectionService: TenantConnectionService,
    private readonly tenantsService: TenantsService,
    private readonly historyService: HistoryService,
    private readonly slackService: SlackService,
    @Inject(forwardRef(() => MembersService))
    private readonly membersService: MembersService,
    @Inject(forwardRef(() => ProductsService))
    private readonly productsService: ProductsService,
    @Inject('PRODUCT_MODEL')
    private readonly productRepository: Model<Product>,
    private readonly tenantModelRegistry: TenantModelRegistry,
    private readonly logisticsService: LogisticsService,
  ) {}

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

    const productIds = products.map((p) => p._id);

    console.log(
      `✅ Member updated. Deleting ${productIds.length} products from pool...`,
    );

    await ProductModel.deleteMany({ _id: { $in: productIds } }).session(
      session,
    );

    console.log(`✅ Products deleted from pool.`);

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
    const MemberModel = connection.model(Member.name, MemberSchema);

    const member = await MemberModel.findOne({ 'products._id': id }).session(
      session || null,
    );

    if (!member) return null;

    const product = (
      member.products as mongoose.Types.DocumentArray<ProductDocument>
    ).id(id);

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
      console.log('🔍 Buscando producto en members:', productId);
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
    );

    return newMember;
  }

  public async handleUnknownEmailUpdate(
    session: any,
    product: ProductDocument,
    updateProductDto: UpdateProductDto,
    tenantName: string,
  ) {
    const updatedFields = this.productsService.getUpdatedFields(
      product,
      updateProductDto,
    );

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
  ) {
    if (!tenantName) {
      throw new Error('tenantName is required to find and delete a product');
    }

    await this.productsService.findByIdAndDelete(tenantName, product._id!, {
      session,
    });
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
  }

  // Metodo para mover un producto de un miembro a la colección de productos
  public async moveToProductsCollection(
    session: any,
    product: ProductDocument,
    member: MemberDocument,
    updateProductDto: UpdateProductDto,
    // tenantName?: string,
    connection: Connection,
  ) {
    const productIndex = member.products.findIndex(
      (prod) => prod._id!.toString() === product._id!.toString(),
    );
    if (productIndex !== -1) {
      member.products.splice(productIndex, 1);
      await member.save({ session });
    } else {
      throw new Error('Product not found in member collection');
    }

    const updateData = {
      _id: product._id,
      name: updateProductDto.name || product.name,
      category: product.category,
      attributes: updateProductDto.attributes || product.attributes,
      status: updateProductDto.status,
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
    };
    const productModel = connection.model(Product.name, ProductSchema);
    const createdProducts = await productModel.create([updateData], {
      session,
    });

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
        shipment = await this.logisticsService.tryCreateShipmentIfNeeded(
          product,
          updateDto,
          tenantName,
          session,
          userId,
          ourOfficeEmail,
        );
      }

      await this.moveToMemberCollection(
        session,
        product,
        newMember,
        { ...updateDto, recoverable: isRecoverable },
        product.assignedEmail || '',
        tenantName,
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
    console.log(
      '📌 handleProductFromMemberCollection: checking model connection',
    );
    const memberProduct = await this.getProductByMembers(
      id,
      connection,
      session,
    );

    if (!memberProduct) {
      throw new NotFoundException(`Product with id "${id}" not found`);
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
        shipment = await this.logisticsService.tryCreateShipmentIfNeeded(
          product as ProductDocument,
          updateDto,
          tenantName,
          session,
          userId,
          ourOfficeEmail,
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
      );
      const updatedProduct = unassigned?.[0];
      if (!updatedProduct) throw new Error('Failed to unassign product');

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
    // tenantName?: string,
  ) {
    if (currentMember) {
      console.log('🔁 Llamando a moveToProductsCollection...');
      const created = await this.moveToProductsCollection(
        session,
        product,
        currentMember,
        updateProductDto,
        // tenantName,
        connection,
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
