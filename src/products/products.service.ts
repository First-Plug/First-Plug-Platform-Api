import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Model, ObjectId, Types } from 'mongoose';
import { ProductDocument, ProductSchema } from './schemas/product.schema';
import { CreateProductDto, UpdateProductDto } from './dto';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { BadRequestException } from '@nestjs/common';
import { MembersService } from 'src/members/members.service';
import { TenantsService } from 'src/tenants/tenants.service';
import { Attribute } from './interfaces/product.interface';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import {
  MemberDocument,
  MemberSchema,
} from 'src/members/schemas/member.schema';
import { Response } from 'express';
import { Parser } from 'json2csv';

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
    private readonly tenantsService: TenantsService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

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
      const connection = this.connection.useDb(tenantDbName);

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
        const connection = this.connection.useDb(tenantDbName);

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

  async create(createProductDto: CreateProductDto, tenantName: string) {
    const normalizedProduct = this.normalizeProductData(createProductDto);
    const { assignedEmail, serialNumber, price, ...rest } = normalizedProduct;

    const recoverableConfig =
      await this.getRecoverableConfigForTenant(tenantName);

    const isRecoverable =
      createProductDto.recoverable !== undefined
        ? createProductDto.recoverable
        : recoverableConfig.get(createProductDto.category) ?? false;

    if (serialNumber && serialNumber.trim() !== '') {
      await this.validateSerialNumber(serialNumber);
    }

    const createData = {
      ...rest,
      serialNumber: serialNumber?.trim() || undefined,
      recoverable: isRecoverable,
      ...(price?.amount !== undefined && price?.currencyCode ? { price } : {}),
    };

    let assignedMember = '';

    if (assignedEmail) {
      const member = await this.memberService.assignProduct(
        assignedEmail,
        createData,
      );

      if (member) {
        assignedMember = this.getFullName(member);
        return member.products.at(-1);
      }
    }

    const newProduct = await this.productRepository.create({
      ...createData,
      assignedEmail,
      assignedMember: assignedMember || this.getFullName(createProductDto),
      recoverable: isRecoverable,
    });

    return newProduct;
  }

  async bulkCreate(createProductDtos: CreateProductDto[], tenantName: string) {
    const session = await this.connection.startSession();
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
      session.endSession();

      return createdProducts;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      if (error instanceof BadRequestException) {
        throw new BadRequestException(`Serial Number already exists`);
      } else {
        throw new InternalServerErrorException();
      }
    }
  }

  async tableGrouping() {
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
  ) {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      for (const { id, product } of productsToUpdate) {
        const updateProductDto = { ...product };

        await this.update(id, { ...updateProductDto }, tenantName);
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
  ) {
    if (updateProductDto.assignedEmail === 'none') {
      updateProductDto.assignedEmail = '';
    }
    return this.update(id, updateProductDto, tenantName);
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
      assignedEmail: updateProductDto.assignedEmail,
      assignedMember: updateProductDto.assignedMember,
      acquisitionDate:
        updateProductDto.acquisitionDate || product.acquisitionDate,
      location: updateProductDto.location || product.location,
      isDeleted: product.isDeleted,
      lastAssigned: lastAssigned,
    };
    newMember.products.push(updateData);
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
      isDeleted: product.isDeleted,
    };
    await this.productRepository.create([updateData], { session });
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

    if (
      product.assignedEmail &&
      !(await this.memberService.findByEmailNotThrowError(
        product.assignedEmail,
      ))
    ) {
      updatedFields.lastAssigned = product.assignedEmail;
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
    }
  }

  async update(
    id: ObjectId,
    updateProductDto: UpdateProductDto,
    tenantName: string,
  ) {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const product = await this.productRepository
        .findById(id)
        .session(session);

      if (product) {
        await this.getRecoverableConfigForTenant(tenantName);

        // let isRecoverable: boolean;

        const isRecoverable =
          updateProductDto.recoverable !== undefined
            ? updateProductDto.recoverable
            : product.recoverable;

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

        // Caso en que el producto tiene un assignedEmail desconocido y se deben actualizar los atributos
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
            await this.handleUnknownEmailUpdate(session, product, {
              ...updateProductDto,
              recoverable: isRecoverable,
            });
          } else if (
            updateProductDto.assignedEmail &&
            updateProductDto.assignedEmail !== 'none'
          ) {
            await this.handleUnknownEmailToMemberUpdate(session, product, {
              ...updateProductDto,
              recoverable: isRecoverable,
            });
          } else {
            await this.updateProductAttributes(
              session,
              product,
              { ...updateProductDto, recoverable: isRecoverable },
              'products',
            );
          }
        } else {
          // Manejar la reasignación del producto
          if (
            updateProductDto.assignedEmail &&
            updateProductDto.assignedEmail !== 'none' &&
            updateProductDto.assignedEmail !== product.assignedEmail
          ) {
            const newMember = await this.memberService.findByEmailNotThrowError(
              updateProductDto.assignedEmail,
            );
            if (newMember) {
              await this.moveToMemberCollection(
                session,
                product,
                newMember,
                { ...updateProductDto, recoverable: isRecoverable },
                product.assignedEmail || '',
              );
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
          // const recoverableConfig =
          await this.getRecoverableConfigForTenant(tenantName);
          const isRecoverable =
            updateProductDto.recoverable !== undefined
              ? updateProductDto.recoverable
              : memberProduct.product.recoverable;

          if (
            updateProductDto.assignedEmail &&
            updateProductDto.assignedEmail !== member.email
          ) {
            const newMember = await this.memberService.findByEmailNotThrowError(
              updateProductDto.assignedEmail,
            );
            if (newMember) {
              await this.moveToMemberCollection(
                session,
                memberProduct.product as ProductDocument,
                newMember,
                { ...updateProductDto, recoverable: isRecoverable },
                member.email,
              );
            } else {
              throw new NotFoundException(
                `Member with email "${updateProductDto.assignedEmail}" not found`,
              );
            }
          } else if (updateProductDto.assignedEmail === '') {
            await this.handleProductUnassignment(
              session,
              memberProduct.product as ProductDocument,
              { ...updateProductDto, recoverable: isRecoverable },
              member,
            );
          } else {
            await this.updateProductAttributes(
              session,
              memberProduct.product as ProductDocument,
              { ...updateProductDto, recoverable: isRecoverable },
              'members',
              member,
            );
          }
          console.log('Datos recibidos para actualización:', updateProductDto);
          console.log('Producto actual en la base de datos:', product);

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
      await this.moveToProductsCollection(
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

  async softDelete(id: ObjectId) {
    const session = await this.connection.startSession();
    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        session.startTransaction();
        const product = await this.productRepository
          .findById(id)
          .session(session);

        if (product) {
          product.status = 'Deprecated';
          product.isDeleted = true;
          await product.save();
          await this.productRepository.softDelete({ _id: id }, { session });

          await session.commitTransaction();
          session.endSession();

          return { message: `Product with id ${id} has been soft deleted` };
        }

        const memberProduct = await this.memberService.getProductByMembers(id);

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

          await session.commitTransaction();
          session.endSession();

          return { message: `Product with id ${id} has been soft deleted` };
        }
        throw new NotFoundException(`Product with id "${id}" not found`);
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
    }));

    const csvParser = new Parser({ fields: csvFields });
    const csvData = csvParser.parse(productsFormatted);

    res.header('Content-Type', 'text/csv');
    res.attachment('products_report.csv');
    res.send(csvData);
  }
}
