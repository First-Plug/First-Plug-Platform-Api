import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Product, ProductDocument } from 'src/products/schemas/product.schema';
import { Member, MemberDocument } from 'src/members/schemas/member.schema';
import { Model, Schema, Types } from 'mongoose';
import { HistoryService } from 'src/history/history.service';
import { SlackService } from 'src/slack/slack.service';
import { ClientSession, ObjectId } from 'mongoose';
import { CreateProductDto } from 'src/products/dto/create-product.dto';
import { MembersService } from 'src/members/members.service';
import { Status } from 'src/products/interfaces/product.interface';
import { ProductsService } from 'src/products/products.service';
import { TenantConnectionService } from 'src/infra/db/tenant-connection.service';
import { UpdateProductDto } from 'src/products/dto';
import { TenantsService } from 'src/tenants/tenants.service';

@Injectable()
export class AssignmentsService {
  private readonly logger = new Logger(AssignmentsService.name);

  constructor(
    // @Inject('PRODUCT_MODEL') private readonly productModel: Model<Product>,
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
  ) {}

  public async assignProductsToMemberByEmail(
    memberEmail: string,
    memberFullName: string,
    session: ClientSession,
  ): Promise<ProductDocument[]> {
    const productsToUpdate = await this.productRepository
      .find({ assignedEmail: memberEmail })
      .session(session);

    for (const product of productsToUpdate) {
      product.assignedMember = memberFullName;
      await product.save({ session });
      await this.productRepository
        .deleteOne({ _id: product._id })
        .session(session);
    }

    return productsToUpdate;
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

  async getAllProductsWithMembers() {
    const members = await this.memberModel.find();

    return members.flatMap((member) => member.products || []);
  }

  async getProductByMembers(id: ObjectId, session?: ClientSession) {
    const members = await this.memberModel.find().session(session || null);

    for (const member of members) {
      const products = member.products || [];
      const product = products.find(
        (product) => product._id!.toString() === id.toString(),
      );

      if (product) {
        return { member, product };
      }
    }
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

  async getProductForReassign(productId: ObjectId) {
    let product: Product | ProductDocument | null =
      await this.productsService.findById(productId);
    let currentMember: MemberDocument | null = null;
    let isUnknownEmail = false;

    if (!product) {
      const memberProduct = await this.getProductByMembers(productId);
      if (!memberProduct) {
        throw new NotFoundException(`Product with id "${productId}" not found`);
      }
      product = await this.productsService.findById(productId);
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

  async getProductForAssign(productId: ObjectId) {
    const product = await this.productsService.findById(productId);
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
    );

    return newMember;
  }

  public async handleUnknownEmailUpdate(
    session: any,
    product: ProductDocument,
    updateProductDto: UpdateProductDto,
    // tenantName: string,
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
    // tenantName?: string,
  ) {
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

    await this.productsService.findByIdAndDelete(product._id!, { session });
  }

  // Metodo para mover un producto de un miembro a la colección de productos
  public async moveToProductsCollection(
    session: any,
    product: ProductDocument,
    member: MemberDocument,
    updateProductDto: UpdateProductDto,
    // tenantName?: string,
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
    console.log(
      '🧪 Status seteado en moveToMemberCollection:',
      updateProductDto.status,
    );
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
    const createdProducts = await this.productRepository.create([updateData], {
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
    // tenantName?: string,
  ) {
    const updatedFields = this.productsService.getUpdatedFields(
      product,
      updateProductDto,
    );
    updatedFields.status = updateProductDto.status ?? product.status;

    if (currentLocation === 'products') {
      await this.productsService.updateOne(
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

  async validateProductAvailability(productId: string) {
    const id = new Types.ObjectId(
      productId,
    ) as unknown as Schema.Types.ObjectId;
    const found = await this.productsService.findProductById(id);

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
    actionType?: string,
  ) {
    switch (actionType) {
      case 'assign':
      case 'reassign':
      case 'relocate':
      case 'return':
      case 'offboarding':
        if (!product._id) throw new BadRequestException('Product ID missing');
        await this.validateProductAvailability(product._id.toString());
        break;
    }
  }

  async findByEmailNotThrowError(email: string) {
    return await this.membersService.findByEmailNotThrowError(email);
  }
}
