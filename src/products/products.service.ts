import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
  forwardRef,
  // forwardRef,
} from '@nestjs/common';
import { ClientSession, Model, ObjectId, Schema, Types } from 'mongoose';
import {
  Product,
  ProductDocument,
  ProductSchema,
} from './schemas/product.schema';
import { CreateProductDto, UpdateProductDto } from './dto';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { BadRequestException } from '@nestjs/common';
import { MembersService } from 'src/members/members.service';
import { TenantsService } from 'src/tenants/tenants.service';
import { Attribute, Condition, Status } from './interfaces/product.interface';
import {
  MemberDocument,
  MemberSchema,
} from 'src/members/schemas/member.schema';
import { Response } from 'express';
import { Parser } from 'json2csv';
import { HistoryService } from 'src/history/history.service';
import { updateProductPrice } from './helpers/update-price.helper';
import { TenantConnectionService } from 'src/common/providers/tenant-connection.service';
import { ShipmentsService } from 'src/shipments/shipments.service';
import { ModuleRef } from '@nestjs/core';

export interface ProductModel
  extends Model<ProductDocument>,
    SoftDeleteModel<ProductDocument> {}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  constructor(
    @Inject('PRODUCT_MODEL')
    private readonly productRepository: ProductModel,
    private readonly memberService: MembersService,
    private tenantsService: TenantsService,
    private readonly historyService: HistoryService,
    private readonly connectionService: TenantConnectionService,

    @Inject(forwardRef(() => ShipmentsService))
    private readonly shipmentsService: ShipmentsService,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit() {
    this.tenantsService = this.moduleRef.get(TenantsService, { strict: false });
    console.log('🧩 TenantsService loaded manually:', !!this.tenantsService);
  }
  private normalizeProductData(product: CreateProductDto) {
    return {
      ...product,
      name: product.name
        ?.trim()
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase()),
      assignedEmail: product.assignedEmail
        ? product.assignedEmail.toLowerCase()
        : undefined,
    };
  }

  private getFullName(member: any): string {
    if (member && member.firstName && member.lastName) {
      return `${member.firstName} ${member.lastName}`;
    }
    return '';
  }

  private async validateSerialNumber(serialNumber: string) {
    if (!serialNumber || serialNumber.trim() === '') {
      return;
    }

    const productWithSameSerialNumber = await this.productRepository.findOne({
      serialNumber,
    });
    const memberProductWithSameSerialNumber =
      await this.memberService.findProductBySerialNumber(serialNumber);

    if (productWithSameSerialNumber || memberProductWithSameSerialNumber) {
      throw new BadRequestException('Serial Number already exists');
    }
  }

  async migratePriceForTenant(tenantName: string) {
    try {
      const tenantDbName = `tenant_${tenantName}`;
      const connection =
        await this.connectionService.getTenantConnection(tenantName);

      // Definir modelos
      const ProductModel = connection.model<ProductDocument>(
        'Product',
        ProductSchema,
      );
      const MemberModel = connection.model<MemberDocument>(
        'Member',
        MemberSchema,
      );

      const defaultPrice = {
        amount: 0,
        currencyCode: 'USD',
      };

      const unassignedProducts = await ProductModel.find({
        price: { $exists: false },
      });
      for (const product of unassignedProducts) {
        product.price = defaultPrice;
        await product.save();
        this.logger.log(
          `Updated unassigned product ${product._id} in ${tenantDbName} with price: ${JSON.stringify(defaultPrice)}`,
        );
      }

      const members = await MemberModel.find();
      for (const member of members) {
        let updated = false;
        for (const product of member.products) {
          if (!product.price) {
            product.price = defaultPrice;
            updated = true;
          }
        }
        if (updated) {
          await member.save();
          this.logger.log(
            `Updated products in member ${member._id} in ${tenantDbName} with price: ${JSON.stringify(defaultPrice)}`,
          );
        }
      }

      return {
        message: `Migrated price field for unassigned products and assigned products in members for tenant ${tenantDbName}`,
      };
    } catch (error) {
      this.logger.error('Failed to migrate price field', error);
      throw new InternalServerErrorException(
        'Failed to migrate price field for the specified tenant',
      );
    }
  }

  async migratePriceForAllTenant() {
    try {
      const tenants = await this.tenantsService.findAllTenants();
      const defaultPrice = {
        amount: 0,
        currencyCode: 'USD',
      };

      for (const tenant of tenants) {
        const tenantDbName = `tenant_${tenant.tenantName}`;
        const connection = await this.connectionService.getTenantConnection(
          tenant.tenantName,
        );

        const ProductModel = connection.model<ProductDocument>(
          'Product',
          ProductSchema,
        );
        const MemberModel = connection.model<MemberDocument>(
          'Member',
          MemberSchema,
        );

        const unassignedProducts = await ProductModel.find({
          price: { $exists: false },
        });
        for (const product of unassignedProducts) {
          product.price = defaultPrice;
          await product.save();
          this.logger.log(
            `Updated unassigned product ${product._id} in ${tenantDbName} with price: ${JSON.stringify(defaultPrice)}`,
          );
        }
        const members = await MemberModel.find();
        for (const member of members) {
          let updated = false;
          for (const product of member.products) {
            if (!product.price) {
              product.price = defaultPrice;
              updated = true;
            }
          }
          if (updated) {
            await member.save();
            this.logger.log(
              `Updated products in member ${member._id} in ${tenantDbName} with price: ${JSON.stringify(defaultPrice)}`,
            );
          }
        }
      }
      return {
        message: 'Migrated price field for all tenants',
      };
    } catch (error) {
      this.logger.error('Failed to migrate price field', error);
      throw new InternalServerErrorException(
        'Failed to migrate price field for all tenants',
      );
    }
  }

  private async getRecoverableConfigForTenant(
    tenantName: string,
  ): Promise<Map<string, boolean>> {
    await new Promise((resolve) => process.nextTick(resolve));
    const user = await this.tenantsService.getByTenantName(tenantName);

    if (user && user.isRecoverableConfig) {
      return user.isRecoverableConfig;
    }
    console.log(
      `No se encontró la configuración de isRecoverable para el tenant: ${tenantName}`,
    );
    return new Map([
      ['Merchandising', false],
      ['Computer', true],
      ['Monitor', true],
      ['Audio', true],
      ['Peripherals', true],
      ['Other', true],
    ]);
  }

  isCreatingAction(actionType?: string): boolean {
    return actionType === 'create' || actionType === 'bulkCreate';
  }

  public async isAddressComplete(
    product: Partial<Product>,
    tenantName: string,
  ): Promise<boolean> {
    if (product.location === 'FP warehouse') {
      return true;
    }

    if (product.location === 'Employee') {
      const member = await this.memberService.findByEmailNotThrowError(
        product.assignedEmail!,
      );
      if (!member) return false;

      return !!(
        member.country &&
        member.city &&
        member.zipCode &&
        member.address &&
        member.apartment &&
        member.personalEmail &&
        member.phone &&
        member.dni
      );
    }

    if (product.location === 'Our office') {
      //  Obtener datos del tenant
      const tenant = await this.tenantsService.getByTenantName(tenantName);

      if (!tenant) return false;

      return !!(
        tenant.country &&
        tenant.city &&
        tenant.state &&
        tenant.zipCode &&
        tenant.address &&
        tenant.apartment &&
        tenant.phone
      );
    }

    return false;
  }

  public async determineProductStatus(
    product: Partial<Product>,
    tenantName: string,
    actionType?: string,
    origin?: string,
  ): Promise<Status> {
    console.log('🧪 Status evaluation:', {
      fp_shipment: product.fp_shipment,
      assignedEmail: product.assignedEmail,
      location: product.location,
      productCondition: product.productCondition,
    });
    if (product.productCondition === 'Unusable') {
      return 'Unavailable';
    }

    // ✅ Luego, si NO participa en shipment
    if (!product.fp_shipment) {
      if (product.assignedEmail && product.location === 'Employee') {
        return 'Delivered';
      } else if (
        ['FP warehouse', 'Our office'].includes(product.location ?? '')
      ) {
        return 'Available';
      } else {
        return 'Unavailable'; // Datos incompletos o inválidos
      }
    }

    const isCreating = this.isCreatingAction(actionType);

    const destinationIsComplete = await this.isAddressComplete(
      { ...product, location: product.location },
      tenantName,
    );

    const originIsComplete = isCreating
      ? true
      : await this.isAddressComplete(
          { ...product, location: origin },
          tenantName,
        );

    return destinationIsComplete && originIsComplete
      ? 'In Transit'
      : 'In Transit - Missing Data';
  }

  async create(
    createProductDto: CreateProductDto,
    tenantName: string,
    userId: string,
  ) {
    const normalizedProduct = this.normalizeProductData(createProductDto);
    const { assignedEmail, serialNumber, price, productCondition, ...rest } =
      normalizedProduct;

    const recoverableConfig =
      await this.getRecoverableConfigForTenant(tenantName);

    const isRecoverable =
      createProductDto.recoverable !== undefined
        ? createProductDto.recoverable
        : recoverableConfig.get(createProductDto.category) ?? false;

    if (serialNumber && serialNumber.trim() !== '') {
      await this.validateSerialNumber(serialNumber);
    }

    let location = rest.location || createProductDto.location;
    let status = rest.status || 'Available';

    if (productCondition === 'Unusable') {
      status = 'Unavailable';
    } else {
      if (assignedEmail && assignedEmail !== 'none') {
        location = 'Employee';
        status = 'Delivered';
      } else if (['FP warehouse', 'Our office'].includes(location)) {
        status = 'Available';
      }
    }

    const createData = {
      ...rest,
      recoverable: isRecoverable,
      serialNumber: serialNumber?.trim() || undefined,
      productCondition: productCondition || 'Optimal',
      additionalInfo: createProductDto.additionalInfo?.trim() || undefined,
      location,
      status,
      ...(price?.amount !== undefined && price?.currencyCode ? { price } : {}),
    };

    let assignedMember = '';
    console.log('createData before assigning:', createData);
    if (assignedEmail) {
      const member = await this.memberService.assignProduct(
        assignedEmail,
        createData,
      );

      if (member) {
        assignedMember = this.getFullName(member);

        await this.historyService.create({
          actionType: 'create',
          itemType: 'assets',
          userId: userId,
          changes: {
            oldData: null,
            newData: member.products.at(-1) as Product,
          },
        });

        return member.products.at(-1);
      }
    }

    const newProduct = await this.productRepository.create({
      ...createData,
      assignedEmail,
      assignedMember: assignedMember || this.getFullName(createProductDto),
      recoverable: isRecoverable,
      productCondition: createData.productCondition,
    });
    console.log('newProduct', newProduct);
    await this.historyService.create({
      actionType: 'create',
      itemType: 'assets',
      userId: userId,
      changes: {
        oldData: null,
        newData: newProduct,
      },
    });

    return newProduct;
  }

  async bulkCreate(
    createProductDtos: CreateProductDto[],
    tenantName: string,
    userId: string,
  ) {
    await new Promise((resolve) => process.nextTick(resolve));
    const connection =
      await this.connectionService.getTenantConnection(tenantName);
    const session = await connection.startSession();
    session.startTransaction();

    try {
      const normalizedProducts = createProductDtos.map(
        this.normalizeProductData,
      );

      const recoverableConfig =
        await this.getRecoverableConfigForTenant(tenantName);

      const productsWithSerialNumbers = normalizedProducts.filter(
        (product) => product.serialNumber,
      );
      const seenSerialNumbers = new Set<string>();
      const duplicates = new Set<string>();

      productsWithSerialNumbers.forEach((product) => {
        if (product.serialNumber) {
          if (seenSerialNumbers.has(product.serialNumber)) {
            duplicates.add(product.serialNumber);
          } else {
            seenSerialNumbers.add(product.serialNumber);
          }
        }
      });

      if (duplicates.size > 0) {
        throw new BadRequestException(`Serial Number already exists`);
      }

      for (const product of normalizedProducts) {
        const { serialNumber, category, recoverable } = product;

        product.productCondition = 'Optimal';

        const isRecoverable =
          recoverable !== undefined
            ? recoverable
            : recoverableConfig.get(category) || false;

        product.recoverable = isRecoverable;

        if (serialNumber && serialNumber.trim() !== '') {
          await this.validateSerialNumber(serialNumber);
        }
      }

      const createData = normalizedProducts.map((product) => {
        const { serialNumber, ...rest } = product;
        return serialNumber && serialNumber.trim() !== ''
          ? { ...rest, serialNumber }
          : rest;
      });

      const productsWithIds = createData.map((product) => {
        return {
          ...product,
          _id: new Types.ObjectId(),
        };
      });

      const productsWithoutAssignedEmail = productsWithIds.filter(
        (product) => !product.assignedEmail,
      );

      const productsWithAssignedEmail = productsWithIds.filter(
        (product) => product.assignedEmail,
      );

      const createdProducts: ProductDocument[] = [];

      const assignProductPromises = productsWithAssignedEmail.map(
        async (product) => {
          if (product.assignedEmail) {
            const member = await this.memberService.findByEmailNotThrowError(
              product.assignedEmail,
            );

            if (member) {
              const productDocument = new this.productRepository(
                product,
              ) as ProductDocument;
              productDocument.assignedMember = this.getFullName(member);
              member.products.push(productDocument);
              await member.save({ session });
              await this.productRepository
                .deleteOne({ _id: product._id })
                .session(session);
              createdProducts.push(productDocument);
            } else {
              const createdProduct = await this.productRepository.create(
                [product],
                { session },
              );
              createdProducts.push(...createdProduct);
            }
          }
        },
      );

      const insertManyPromise = this.productRepository.insertMany(
        productsWithoutAssignedEmail,
        { session },
      );

      const createdProductsWithoutAssignedEmail = await insertManyPromise;
      createdProducts.push(...createdProductsWithoutAssignedEmail);

      await Promise.all(assignProductPromises);

      await session.commitTransaction();

      // Registrar el historial
      await this.historyService.create({
        actionType: 'bulk-create',
        itemType: 'assets',
        userId: userId,
        changes: {
          oldData: null,
          newData: createdProducts,
        },
      });

      session.endSession();

      return createdProducts;
    } catch (error) {
      console.log(error);

      await session.abortTransaction();

      session.endSession();

      if (error instanceof BadRequestException) {
        throw new BadRequestException(`Serial Number already exists`);
      } else {
        throw new InternalServerErrorException();
      }
    } finally {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      session.endSession();
    }
  }

  async tableGrouping() {
    await new Promise((resolve) => process.nextTick(resolve));
    const productsFromRepository = await this.productRepository.find({
      isDeleted: false,
    });

    const productsFromMembers =
      await this.memberService.getAllProductsWithMembers();

    const allProducts = [...productsFromRepository, ...productsFromMembers];

    const productsWithFilteredAttributes = allProducts.map((product) => {
      const {
        _id,
        category,
        name,
        attributes,
        status,
        acquisitionDate,
        assignedEmail,
        assignedMember,
        deleteAt,
        isDeleted,
        lastAssigned,
        location,
        recoverable,
        serialNumber,
        price,
        productCondition,
        additionalInfo,
      } = product;
      const filteredAttributes = attributes.filter(
        (attribute: Attribute) =>
          attribute.key !== 'keyboardLanguage' && attribute.key !== 'gpu',
      );

      return {
        _id,
        category,
        name,
        attributes,
        status,
        acquisitionDate,
        assignedEmail,
        assignedMember,
        deleteAt,
        isDeleted,
        lastAssigned,
        location,
        recoverable,
        serialNumber,
        filteredAttributes,
        price,
        productCondition,
        additionalInfo,
      };
    });

    const groupedProducts = productsWithFilteredAttributes.reduce(
      (acc, product) => {
        let key: string;

        switch (product.category) {
          case 'Merchandising':
            const colorValue = product.attributes.find(
              (attr) => attr.key === 'color',
            )?.value;
            key = JSON.stringify({
              category: product.category,
              name: product.name,
              color: colorValue,
            });
            break;

          case 'Computer':
            const computerBrand = product.filteredAttributes.find(
              (attr) => attr.key === 'brand',
            )?.value;
            const computerModel = product.filteredAttributes.find(
              (attr) => attr.key === 'model',
            )?.value;
            const computerProcessor = product.filteredAttributes.find(
              (attr) => attr.key === 'processor',
            )?.value;
            const computerRam = product.filteredAttributes.find(
              (attr) => attr.key === 'ram',
            )?.value;
            const computerStorage = product.filteredAttributes.find(
              (attr) => attr.key === 'storage',
            )?.value;
            const computerScreen = product.filteredAttributes.find(
              (attr) => attr.key === 'screen',
            )?.value;

            key = JSON.stringify({
              category: product.category,
              brand: computerBrand,
              model: computerModel,
              name: computerModel === 'Other' ? product.name : undefined,
              processor: computerProcessor,
              ram: computerRam,
              storage: computerStorage,
              screen: computerScreen,
            });
            break;

          case 'Monitor':
            const monitorBrand = product.filteredAttributes.find(
              (attr) => attr.key === 'brand',
            )?.value;
            const monitorModel = product.filteredAttributes.find(
              (attr) => attr.key === 'model',
            )?.value;
            const monitorScreen = product.filteredAttributes.find(
              (attr) => attr.key === 'screen',
            )?.value;

            key = JSON.stringify({
              category: product.category,
              brand: monitorBrand,
              model: monitorModel,
              name: monitorModel === 'Other' ? product.name : undefined,
              screen: monitorScreen,
            });
            break;

          case 'Audio':
            const audioBrand = product.filteredAttributes.find(
              (attr) => attr.key === 'brand',
            )?.value;
            const audioModel = product.filteredAttributes.find(
              (attr) => attr.key === 'model',
            )?.value;

            key = JSON.stringify({
              category: product.category,
              brand: audioBrand,
              model: audioModel,
              name: audioModel === 'Other' ? product.name : undefined,
            });
            break;

          case 'Peripherals':
            const peripheralsBrand = product.filteredAttributes.find(
              (attr) => attr.key === 'brand',
            )?.value;
            const peripheralsModel = product.filteredAttributes.find(
              (attr) => attr.key === 'model',
            )?.value;

            key = JSON.stringify({
              category: product.category,
              brand: peripheralsBrand,
              model: peripheralsModel,
              name: peripheralsModel === 'Other' ? product.name : undefined,
            });
            break;

          case 'Other':
            const otherBrand = product.filteredAttributes.find(
              (attr) => attr.key === 'brand',
            )?.value;
            const otherModel = product.filteredAttributes.find(
              (attr) => attr.key === 'model',
            )?.value;

            key = JSON.stringify({
              category: product.category,
              brand: otherBrand,
              model: otherModel,
              name: otherModel === 'Other' ? product.name : undefined,
            });
            break;

          default:
            key = JSON.stringify({
              category: product.category,
              name: product.name,
            });
            break;
        }

        if (!acc[key]) {
          acc[key] = {
            category: product.category,
            products: [],
          };
        }

        acc[key].products.push(product);
        return acc;
      },
      {},
    );

    const result = Object.values(groupedProducts);

    // return result;
    // Ordenar los productos: primero los de categoría "Computer" y luego el resto por orden alfabético de categoría

    const sortedResult = result
      // @ts-expect-error as @ts-ignore
      .filter((group) => group.category === 'Computer')
      .concat(
        result
          // @ts-expect-error as @ts-ignore
          .filter((group) => group.category !== 'Computer')
          // @ts-expect-error as @ts-ignore
          .sort((a, b) => a.category.localeCompare(b.category)),
      );

    return sortedResult;
  }

  async findById(id: ObjectId) {
    await new Promise((resolve) => process.nextTick(resolve));
    const product = await this.productRepository.findById(id);

    if (product) {
      if (product.isDeleted) {
        throw new NotFoundException(`Product with id "${id}" not found`);
      }

      return product;
    }

    const memberProduct = await this.memberService.getProductByMembers(id);

    if (memberProduct?.product) {
      if (memberProduct?.product.isDeleted) {
        throw new NotFoundException(`Product with id "${id}" not found`);
      }

      return memberProduct.product;
    }

    throw new NotFoundException(`Product with id "${id}" not found`);
  }

  private filterMembers(
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
    let product: ProductDocument | null =
      await this.productRepository.findById(productId);
    let currentMember: MemberDocument | null = null;
    let isUnknownEmail = false;

    if (!product) {
      const memberProduct =
        await this.memberService.getProductByMembers(productId);
      if (!memberProduct) {
        throw new NotFoundException(`Product with id "${productId}" not found`);
      }
      product = memberProduct.product as ProductDocument;
      currentMember = memberProduct.member as MemberDocument;
    } else {
      if (product.assignedEmail) {
        currentMember = await this.memberService.findByEmailNotThrowError(
          product.assignedEmail,
        );
        if (!currentMember) {
          isUnknownEmail = true;
        }
      }
    }

    const members = await this.memberService.findAll();
    let options;

    if (isUnknownEmail) {
      options = this.filterMembers(members, null);
    } else {
      options = this.filterMembers(members, product?.assignedEmail || null);
    }

    return { product, options, currentMember };
  }

  async getProductForAssign(productId: ObjectId) {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new NotFoundException(`Product with id "${productId}" not found`);
    }

    const members = await this.memberService.findAll();

    const options = this.filterMembers(members, null);

    return { product, options };
  }

  async updateMultipleProducts(
    productsToUpdate: { id: ObjectId; product: any }[],
    tenantName: string,
    userId: string,
  ) {
    const connection =
      await this.connectionService.getTenantConnection(tenantName);
    const session = await connection.startSession();
    session.startTransaction();

    try {
      for (const { id, product } of productsToUpdate) {
        const updateProductDto = { ...product };

        await this.update(id, { ...updateProductDto }, tenantName, userId);
      }

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async reassignProduct(
    id: ObjectId,
    updateProductDto: UpdateProductDto,
    tenantName: string,
    userId: string,
  ) {
    if (updateProductDto.assignedEmail === 'none') {
      updateProductDto.assignedEmail = '';
    }
    return this.update(id, updateProductDto, tenantName, userId);
  }

  private getUpdatedFields(
    product: ProductDocument,
    updateProductDto: UpdateProductDto,
  ) {
    const updatedFields: any = {};
    for (const key in updateProductDto) {
      if (
        updateProductDto[key] !== undefined &&
        updateProductDto[key] !== product[key]
      ) {
        updatedFields[key] = updateProductDto[key];
      }
    }
    return updatedFields;
  }

  // Método específico para manejar el caso de mover un producto con email desconocido a un miembro
  private async handleUnknownEmailToMemberUpdate(
    session: any,
    product: ProductDocument,
    updateProductDto: UpdateProductDto,
  ) {
    const newMember = await this.memberService.findByEmailNotThrowError(
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

  // Método específico para manejar actualizaciones de emails desconocidos
  private async handleUnknownEmailUpdate(
    session: any,
    product: ProductDocument,
    updateProductDto: UpdateProductDto,
  ) {
    const updatedFields = this.getUpdatedFields(product, updateProductDto);

    if (updatedFields.assignedEmail === '') {
      updatedFields.lastAssigned = product.assignedEmail;
    }

    await this.productRepository.updateOne(
      { _id: product._id },
      { $set: updatedFields },
      { session, runValidators: true, new: true, omitUndefined: true },
    );

    return updatedFields;
  }

  // Método para eliminar un producto de un miembro
  private async removeProductFromMember(
    session: any,
    product: ProductDocument,
    memberEmail: string,
  ) {
    const member =
      await this.memberService.findByEmailNotThrowError(memberEmail);
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

  // Método para mover un producto de la colección de products al array de products de un miembro
  private async moveToMemberCollection(
    session: any,
    product: ProductDocument,
    newMember: MemberDocument,
    updateProductDto: UpdateProductDto,
    lastAssigned: string,
  ) {
    // Eliminar el producto del miembro anterior
    if (product.assignedEmail) {
      await this.removeProductFromMember(
        session,
        product,
        product.assignedEmail,
      );
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
      activeShipment: updateProductDto.fp_shipment
        ? true
        : product.activeShipment,
      isDeleted: product.isDeleted,
      lastAssigned: lastAssigned,
    };
    newMember.products.push(updateData);
    if (updateProductDto.fp_shipment) {
      newMember.activeShipment = true;
    }
    await newMember.save({ session });

    await this.productRepository
      .findByIdAndDelete(product._id)
      .session(session);
  }

  // Metodo para mover un producto de un miembro a la colección de productos
  private async moveToProductsCollection(
    session: any,
    product: ProductDocument,
    member: MemberDocument,
    updateProductDto: UpdateProductDto,
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
      activeShipment: updateProductDto.fp_shipment
        ? true
        : product.activeShipment,
      isDeleted: product.isDeleted,
    };
    return await this.productRepository.create([updateData], { session });
  }

  // Método para actualizar los atributos del producto
  private async updateProductAttributes(
    session: any,
    product: ProductDocument,
    updateProductDto: UpdateProductDto,
    currentLocation: 'products' | 'members',
    member?: MemberDocument,
  ) {
    const updatedFields = this.getUpdatedFields(product, updateProductDto);
    updatedFields.status = updateProductDto.status ?? product.status;

    if (
      product.assignedEmail &&
      !(await this.memberService.findByEmailNotThrowError(
        product.assignedEmail,
      ))
    ) {
      updatedFields.lastAssigned = product.assignedEmail;
    }
    updatedFields.fp_shipment =
      updateProductDto.fp_shipment ?? product.fp_shipment;

    if (updateProductDto.fp_shipment) {
      updatedFields.activeShipment = true;
    }

    if (currentLocation === 'products') {
      await this.productRepository.updateOne(
        { _id: product._id },
        { $set: updatedFields },
        { session, runValidators: true, new: true, omitUndefined: true },
      );
    } else if (currentLocation === 'members' && member) {
      const productIndex = member.products.findIndex(
        (prod) => prod._id!.toString() === product._id!.toString(),
      );
      if (productIndex !== -1) {
        Object.assign(member.products[productIndex], updatedFields);
        await member.save({ session });
      }
      console.log('🧪 Campos actualizados en producto:', updatedFields);
    }
  }

  async updateEntity(
    id: ObjectId,
    updateProductDto: UpdateProductDto,
    config: { tenantName: string; userId: string },
  ) {
    await new Promise((resolve) => process.nextTick(resolve));
    const { tenantName, userId } = config;

    try {
      const { member, product } = await this.findProductById(id);

      const currentLocation = member ? 'members' : 'products';

      const productCopy = JSON.parse(JSON.stringify(product));

      await this.getRecoverableConfigForTenant(tenantName);

      const isRecoverable =
        updateProductDto.recoverable !== undefined
          ? updateProductDto.recoverable
          : product.recoverable;

      if (updateProductDto.price === null) {
        await this.productRepository.updateOne(
          { _id: product._id },
          { $unset: { price: '' } },
        );
        product.price = undefined;
      } else {
        product.price = updateProductPrice(
          product.price,
          updateProductDto.price,
        );
      }

      if (updateProductDto.serialNumber === '' && !member) {
        await this.productRepository.updateOne(
          { _id: product._id },
          { $unset: { serialNumber: '' } },
        );
        product.serialNumber = undefined;
      }

      const updatedFields = this.getUpdatedFields(product as ProductDocument, {
        ...updateProductDto,
        recoverable: isRecoverable,
      });

      if (updateProductDto.price === null) {
        delete updatedFields.price;
      }

      if (updateProductDto.serialNumber === null && !member) {
        delete updatedFields.serialNumber;
      }

      let productUpdated;

      if (currentLocation === 'products') {
        productUpdated = await this.productRepository.findOneAndUpdate(
          { _id: product._id },
          { $set: updatedFields },
          { runValidators: true, new: true, omitUndefined: true },
        );
      } else if (currentLocation === 'members' && member) {
        const productIndex = member.products.findIndex(
          (prod) => prod._id!.toString() === product._id!.toString(),
        );

        if (productIndex !== -1) {
          Object.assign(member.products[productIndex], updatedFields);

          if (updateProductDto.price === null) {
            member.products[productIndex].price = undefined;
          }

          const serialNumber = member.products[productIndex].serialNumber;

          if (serialNumber) {
            const isDuplicateInMembers =
              await this.memberService.validateSerialNumber(
                serialNumber,
                product._id as ObjectId,
              );

            const isDuplicateInMember = member.products.some(
              (product) =>
                product.serialNumber === serialNumber &&
                product._id !== member.products[productIndex]._id,
            );

            const isDuplicateInProducts = await this.productRepository.exists({
              serialNumber: serialNumber,
              _id: { $ne: product._id },
            });

            if (
              isDuplicateInMembers ||
              isDuplicateInProducts ||
              isDuplicateInMember
            ) {
              throw { code: 11000 };
            }
          }

          if (updateProductDto.serialNumber === '') {
            member.products[productIndex].serialNumber = undefined;
          }

          await member.save();
          productUpdated = member.products[productIndex];
        }
      }

      await this.historyService.create({
        actionType: 'update',
        itemType: 'assets',
        userId: userId,
        changes: {
          oldData: productCopy,
          newData: productUpdated,
        },
      });

      return { message: `Product with id "${id}" updated successfully` };
    } catch (error) {
      console.log('❌ Error in updateEntity:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      if (error?.code === 11000) {
        throw new BadRequestException('Serial Number already exists');
      }

      throw new InternalServerErrorException('Unexpected error occurred.');
    }
  }

  async validateProductAvailability(productId: string) {
    const id = new Types.ObjectId(
      productId,
    ) as unknown as Schema.Types.ObjectId;
    const found = await this.findProductById(id);

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

  private async handleProductUpdateByActionType(
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

  private async maybeCreateShipmentAndUpdateStatus(
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
  ) {
    if (!updateDto.fp_shipment || !actionType) return;

    const newStatus = await this.determineProductStatus(
      {
        fp_shipment: updateDto.fp_shipment,
        location: updateDto.location,
        assignedEmail: updateDto.assignedEmail,
        productCondition: updateDto.productCondition,
      },
      tenantName,
      actionType,
    );
    updateDto.status = newStatus;

    const desirableDateOrigin =
      typeof updateDto.desirableDate === 'object'
        ? updateDto.desirableDate.origin || ''
        : '';
    const desirableDateDestination =
      typeof updateDto.desirableDate === 'string'
        ? updateDto.desirableDate
        : updateDto.desirableDate?.destination || '';

    await this.shipmentsService.findOrCreateShipment(
      product._id!.toString(),
      actionType,
      tenantName,
      session,
      desirableDateDestination,
      desirableDateOrigin,
      oldData,
      newData,
    );
  }

  async update(
    id: ObjectId,
    updateProductDto: UpdateProductDto,
    tenantName: string,
    userId: string,
  ) {
    await new Promise((resolve) => process.nextTick(resolve));
    const connection =
      await this.connectionService.getTenantConnection(tenantName);
    const session = await connection.startSession();
    session.startTransaction();

    const { actionType } = updateProductDto;

    try {
      const product = await this.productRepository
        .findById(id)
        .session(session);

      if (product) {
        if (product.activeShipment) {
          throw new BadRequestException(
            'This product is currently part of an active shipment and cannot be modified.',
          );
        }
        await this.handleProductUpdateByActionType(
          session,
          product,
          updateProductDto,
          tenantName,
          userId,
          actionType,
        );
        await this.getRecoverableConfigForTenant(tenantName);

        const isRecoverable =
          updateProductDto.recoverable !== undefined
            ? updateProductDto.recoverable
            : product.recoverable;

        const productCopy = { ...product.toObject() };

        if (updateProductDto.productCondition === 'Unusable') {
          updateProductDto.status = 'Unavailable';
        } else if (
          updateProductDto.assignedEmail &&
          updateProductDto.assignedEmail !== 'none'
        ) {
          updateProductDto.location = 'Employee';
          updateProductDto.status = 'Delivered';
        } else if (
          updateProductDto.assignedEmail === 'none' &&
          (updateProductDto.productCondition as Condition) !== 'Unusable'
        ) {
          if (
            !['FP warehouse', 'Our office'].includes(updateProductDto.location)
          ) {
            throw new BadRequestException(
              'When unassigned, location must be FP warehouse or Our office.',
            );
          }
          updateProductDto.status = 'Available';
        }

        if (
          updateProductDto.price?.amount !== undefined &&
          updateProductDto.price?.currencyCode !== undefined
        ) {
          product.price = {
            amount: updateProductDto.price.amount,
            currencyCode: updateProductDto.price.currencyCode,
          };
        } else if (product.price && !updateProductDto.price) {
        } else {
          product.price = undefined;
        }

        if (
          product.assignedEmail &&
          !(await this.memberService.findByEmailNotThrowError(
            product.assignedEmail,
          ))
        ) {
          if (
            !updateProductDto.assignedEmail ||
            updateProductDto.assignedEmail === product.assignedEmail
          ) {
            const updateProduct = await this.handleUnknownEmailUpdate(
              session,
              product,
              {
                ...updateProductDto,
                recoverable: isRecoverable,
              },
            );

            if (actionType) {
              await this.historyService.create({
                actionType: actionType,
                itemType: 'assets',
                userId: userId,
                changes: {
                  oldData: {
                    ...product,
                  },
                  newData: {
                    ...updateProduct,
                  },
                },
              });
            }
          } else if (
            updateProductDto.assignedEmail &&
            updateProductDto.assignedEmail !== 'none'
          ) {
            const newMember = await this.handleUnknownEmailToMemberUpdate(
              session,
              product,
              {
                ...updateProductDto,
                recoverable: isRecoverable,
              },
            );

            if (actionType) {
              await this.historyService.create({
                actionType: actionType,
                itemType: 'assets',
                userId: userId,
                changes: {
                  oldData: {
                    ...product,
                  },
                  newData: {
                    assignedEmail: newMember.email,
                    assignedMember: `${newMember.firstName} ${newMember.lastName}`,
                  },
                },
              });
            }
          } else {
            await this.updateProductAttributes(
              session,
              product,
              { ...updateProductDto, recoverable: isRecoverable },
              'products',
            );
          }
        } else {
          if (
            updateProductDto.assignedEmail &&
            updateProductDto.assignedEmail !== 'none' &&
            updateProductDto.assignedEmail !== product.assignedEmail
          ) {
            const newMember = await this.memberService.findByEmailNotThrowError(
              updateProductDto.assignedEmail,
            );

            if (newMember) {
              const lastMember = product.assignedEmail;

              await this.maybeCreateShipmentAndUpdateStatus(
                product,
                updateProductDto,
                tenantName,
                actionType!,
                session,
                {
                  location: product.location,
                  assignedEmail: product.assignedEmail,
                  assignedMember: product.assignedMember,
                },
                {
                  location: updateProductDto.location,
                  assignedEmail: updateProductDto.assignedEmail,
                  assignedMember: updateProductDto.assignedMember,
                },
              );

              await this.moveToMemberCollection(
                session,
                product,
                newMember,
                { ...updateProductDto, recoverable: isRecoverable },
                product.assignedEmail || '',
              );

              // Registrar reassign & assign
              if (actionType) {
                await this.historyService.create({
                  actionType: actionType,
                  itemType: 'assets',
                  userId: userId,
                  changes: {
                    oldData: productCopy,
                    newData: {
                      ...product.toObject(),
                      assignedEmail: newMember.email,
                      assignedMember:
                        newMember.firstName + ' ' + newMember.lastName,
                      location: updateProductDto.location,
                      status: updateProductDto.status,
                      lastAssigned: lastMember,
                    },
                  },
                });
              }
            } else {
              throw new NotFoundException(
                `Member with email "${updateProductDto.assignedEmail}" not found`,
              );
            }
          } else if (
            updateProductDto.assignedEmail === '' &&
            product.assignedEmail !== ''
          ) {
            await this.handleProductUnassignment(session, product, {
              ...updateProductDto,
              recoverable: isRecoverable,
            });

            await this.maybeCreateShipmentAndUpdateStatus(
              product,
              updateProductDto,
              tenantName,
              actionType!,
              session,
              {
                location: product.location,
                assignedEmail: product.assignedEmail,
                assignedMember: product.assignedMember,
              },
              {
                location: updateProductDto.location ?? product.location,
                assignedEmail:
                  updateProductDto.assignedEmail ?? product.assignedEmail,
                assignedMember:
                  updateProductDto.assignedMember ?? product.assignedMember,
              },
            );
          } else {
            await this.updateProductAttributes(
              session,
              product,
              { ...updateProductDto, recoverable: isRecoverable },
              'products',
            );
          }
        }

        await session.commitTransaction();
        session.endSession();
        return { message: `Product with id "${id}" updated successfully` };
      } else {
        const memberProduct = await this.memberService.getProductByMembers(
          id,
          session,
        );

        if (memberProduct?.product) {
          const member = memberProduct.member;
          await this.getRecoverableConfigForTenant(tenantName);

          const isRecoverable =
            updateProductDto.recoverable !== undefined
              ? updateProductDto.recoverable
              : memberProduct.product.recoverable;

          const productCopy = { ...memberProduct.product };

          if (updateProductDto.productCondition === 'Unusable') {
            updateProductDto.status = 'Unavailable';
          } else if (
            updateProductDto.assignedEmail &&
            updateProductDto.assignedEmail !== 'none'
          ) {
            updateProductDto.location = 'Employee';
            if (!updateProductDto.fp_shipment) {
              updateProductDto.status = 'Delivered';
            }
          } else if (
            updateProductDto.assignedEmail === 'none' &&
            (updateProductDto.productCondition as Condition) !== 'Unusable'
          ) {
            if (
              !['FP warehouse', 'Our office'].includes(
                updateProductDto.location,
              )
            ) {
              throw new BadRequestException(
                'When unassigned, location must be FP warehouse or Our office.',
              );
            }
            updateProductDto.status = 'Available';
          }

          if (
            updateProductDto.assignedEmail &&
            updateProductDto.assignedEmail !== member.email
          ) {
            const newMember = await this.memberService.findByEmailNotThrowError(
              updateProductDto.assignedEmail,
            );
            if (newMember) {
              const lastMember = member.email;

              await this.maybeCreateShipmentAndUpdateStatus(
                memberProduct.product as ProductDocument,
                updateProductDto,
                tenantName,
                actionType!,
                session,
                {
                  location: memberProduct.product.location,
                  assignedEmail: memberProduct.product.assignedEmail,
                  assignedMember: memberProduct.product.assignedMember,
                },
                {
                  location:
                    updateProductDto.location ?? memberProduct.product.location,
                  assignedEmail:
                    updateProductDto.assignedEmail ??
                    memberProduct.product.assignedEmail,
                  assignedMember:
                    updateProductDto.assignedMember ??
                    memberProduct.product.assignedMember,
                },
              );

              await this.moveToMemberCollection(
                session,
                memberProduct.product as ProductDocument,
                newMember,
                { ...updateProductDto, recoverable: isRecoverable },
                member.email,
              );

              // Registrar relocate
              if (actionType) {
                await this.historyService.create({
                  actionType: actionType,
                  itemType: 'assets',
                  userId: userId,
                  changes: {
                    oldData: productCopy,
                    newData: {
                      ...memberProduct.product,
                      assignedEmail: newMember.email,
                      assignedMember:
                        newMember.firstName + ' ' + newMember.lastName,
                      lastAssigned: lastMember,
                    },
                  },
                });
              }
            } else {
              throw new NotFoundException(
                `Member with email "${updateProductDto.assignedEmail}" not found`,
              );
            }
          } else if (updateProductDto.assignedEmail === '') {
            await this.maybeCreateShipmentAndUpdateStatus(
              memberProduct.product as ProductDocument,
              updateProductDto,
              tenantName,
              actionType!,
              session,
              {
                location: 'Employee',
                assignedEmail: member.email,
                assignedMember: `${member.firstName} ${member.lastName}`,
              },
              {
                location: updateProductDto.location || 'FP warehouse',
                assignedEmail: '',
                assignedMember: '',
              },
            );
            const updateProduct = await this.handleProductUnassignment(
              session,
              memberProduct.product as ProductDocument,
              { ...updateProductDto, recoverable: isRecoverable },
              member,
            );

            // Registrar return
            if (actionType) {
              await this.historyService.create({
                actionType: actionType,
                itemType: 'assets',
                userId: userId,
                changes: {
                  oldData: productCopy,
                  newData: updateProduct?.length ? updateProduct[0] : {},
                },
              });
            }
          } else {
            await this.updateProductAttributes(
              session,
              memberProduct.product as ProductDocument,
              { ...updateProductDto, recoverable: isRecoverable },
              'members',
              member,
            );

            await this.maybeCreateShipmentAndUpdateStatus(
              memberProduct.product as ProductDocument,
              updateProductDto,
              tenantName,
              actionType!,
              session,
              {
                location: memberProduct.product.location,
                assignedEmail: memberProduct.product.assignedEmail,
                assignedMember: memberProduct.product.assignedMember,
              },
              {
                location:
                  updateProductDto.location ?? memberProduct.product.location,
                assignedEmail:
                  updateProductDto.assignedEmail ??
                  memberProduct.product.assignedEmail,
                assignedMember:
                  updateProductDto.assignedMember ??
                  memberProduct.product.assignedMember,
              },
            );
          }

          await session.commitTransaction();
          session.endSession();
          return { message: `Product with id "${id}" updated successfully` };
        } else {
          throw new NotFoundException(`Product with id "${id}" not found`);
        }
      }
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  // Nueva función para manejar la desasignación del producto
  private async handleProductUnassignment(
    session: any,
    product: ProductDocument,
    updateProductDto: UpdateProductDto,
    currentMember?: MemberDocument,
  ) {
    if (currentMember) {
      return await this.moveToProductsCollection(
        session,
        product,
        currentMember,
        updateProductDto,
      );
    } else {
      await this.updateProductAttributes(
        session,
        product,
        updateProductDto,
        'products',
      );
    }
  }

  async softDelete(id: ObjectId, userId: string, tenantName: string) {
    const connection =
      await this.connectionService.getTenantConnection(tenantName);
    const session = await connection.startSession();
    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        session.startTransaction();

        const product = await this.productRepository
          .findById(id)
          .session(session);
        const changes: {
          oldData: Product | null;
          newData: Product | null;
        } = {
          oldData: null,
          newData: null,
        };

        if (product) {
          product.status = 'Deprecated';
          product.isDeleted = true;
          await product.save();
          await this.productRepository.softDelete({ _id: id }, { session });

          changes.oldData = product;
        } else {
          const memberProduct =
            await this.memberService.getProductByMembers(id);

          if (memberProduct && memberProduct.product) {
            await this.productRepository.create(
              [
                {
                  _id: memberProduct.product._id,
                  name: memberProduct.product.name,
                  attributes: memberProduct.product.attributes,
                  category: memberProduct.product.category,
                  assignedEmail: memberProduct.product.assignedEmail,
                  assignedMember: memberProduct.product.assignedMember,
                  acquisitionDate: memberProduct.product.acquisitionDate,
                  deleteAt: memberProduct.product.deleteAt,
                  isDeleted: true,
                  location: memberProduct.product.location,
                  recoverable: memberProduct.product.recoverable,
                  serialNumber: memberProduct.product.serialNumber,
                  lastAssigned: memberProduct.member.email,
                  status: 'Deprecated',
                },
              ],
              { session },
            );

            await this.productRepository.softDelete({ _id: id }, { session });

            const memberId = memberProduct.member._id;
            await this.memberService.deleteProductFromMember(
              memberId,
              id,
              session,
            );

            changes.oldData = memberProduct.product;
          } else {
            throw new NotFoundException(`Product with id "${id}" not found`);
          }
        }

        await this.historyService.create({
          actionType: 'delete',
          itemType: 'assets',
          userId,
          changes,
        });

        await session.commitTransaction();
        session.endSession();

        return { message: `Product with id ${id} has been soft deleted` };
      } catch (error) {
        console.error(
          `Error en softDelete para el producto con id ${id}:`,
          error,
        );

        if (error.message.includes('catalog changes')) {
          retries++;
          console.log(`Reintento ${retries}/${maxRetries} para softDelete`);
          await session.abortTransaction();
          continue;
        }

        await session.abortTransaction();
        session.endSession();
        throw error;
      }
    }

    throw new InternalServerErrorException(
      `Failed to soft delete product after ${maxRetries} retries`,
    );
  }

  private getAttributeValue(attributes: Attribute[], key: string): string {
    const attribute = attributes.find((attr) => attr.key === key);
    return attribute && typeof attribute.value === 'string'
      ? attribute.value
      : '';
  }

  private formatDate(date: string | Date | undefined | null): string {
    if (!date) return '';
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) return '';
    const day = String(parsedDate.getDate()).padStart(2, '0');
    const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const year = parsedDate.getFullYear();
    return `${day}/${month}/${year}`;
  }

  async getDeprecatedProducts(): Promise<ProductDocument[]> {
    return this.productRepository.find({
      status: 'Deprecated',
      isDeleted: true,
    });
  }

  async exportProductsCsv(res: Response) {
    const allProducts = (await this.tableGrouping()) as {
      products: ProductDocument[];
    }[];

    const deprecatedProducts = await this.getDeprecatedProducts();

    const products = allProducts
      .map((group) => group.products)
      .flat()
      .concat(deprecatedProducts);

    const csvFields = [
      { label: 'Category', value: 'category' },
      { label: 'Recoverable', value: 'recoverable' },
      { label: 'Name', value: 'name' },
      { label: 'Acquisition Date', value: 'acquisitionDate' },
      { label: 'Brand', value: 'brand' },
      { label: 'Model', value: 'model' },
      { label: 'Color', value: 'color' },
      { label: 'Screen', value: 'screen' },
      { label: 'Keyboard Language', value: 'keyboardLanguage' },
      { label: 'Processor', value: 'processor' },
      { label: 'RAM', value: 'ram' },
      { label: 'Storage', value: 'storage' },
      { label: 'GPU', value: 'gpu' },
      { label: 'Serial Number', value: 'serialNumber' },
      { label: 'Assigned Member', value: 'assignedMember' },
      { label: 'Assigned Email', value: 'assignedEmail' },
      { label: 'Location', value: 'location' },
      { label: 'Status', value: 'status' },
      { label: 'Price', value: 'price' },
      { label: 'Product Condition', value: 'productCondition' },
      { label: 'Additional Info', value: 'additionalInfo' },
    ];

    const productsFormatted = products.map((product) => ({
      category: product.category,
      recoverable: product.recoverable ? 'yes' : 'no',
      name: product.name,
      acquisitionDate: this.formatDate(new Date(product.acquisitionDate || '')),
      brand: this.getAttributeValue(product.attributes, 'brand'),
      model: this.getAttributeValue(product.attributes, 'model'),
      color: this.getAttributeValue(product.attributes, 'color'),
      screen: this.getAttributeValue(product.attributes, 'screen'),
      keyboardLanguage: this.getAttributeValue(
        product.attributes,
        'keyboardLanguage',
      ),
      processor: this.getAttributeValue(product.attributes, 'processor'),
      ram: this.getAttributeValue(product.attributes, 'ram'),
      storage: this.getAttributeValue(product.attributes, 'storage'),
      gpu: this.getAttributeValue(product.attributes, 'gpu'),
      serialNumber: product.serialNumber,
      assignedMember: product.assignedMember,
      assignedEmail: product.assignedEmail,
      location: product.location,
      status: product.status,
      price: product.price
        ? `${product.price.amount} ${product.price.currencyCode}`
        : '',
      productCondition: product.productCondition,
      additionalInfo: product.additionalInfo,
    }));

    const csvParser = new Parser({ fields: csvFields });
    const csvData = csvParser.parse(productsFormatted);

    res.header('Content-Type', 'text/csv');
    res.attachment('products_report.csv');
    res.send(csvData);
  }

  async findProductById(id: Schema.Types.ObjectId) {
    try {
      const product = await this.productRepository.findById(id);

      if (!product) {
        const member = await this.memberService.getProductByMembers(id);

        if (!member) {
          throw new NotFoundException(`Product with id "${id}" not found`);
        }

        return member;
      }

      return { member: null, product };
    } catch (error) {
      throw error;
    }
  }
}
