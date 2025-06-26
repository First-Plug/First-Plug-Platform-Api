import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
  forwardRef,
  Inject,
} from '@nestjs/common';
import mongoose, {
  ClientSession,
  Connection,
  Model,
  ObjectId,
  Schema,
  Types,
} from 'mongoose';
import {
  Product,
  ProductDocument,
  ProductSchema,
} from './schemas/product.schema';
import { CreateProductDto, UpdateProductDto } from './dto';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { BadRequestException } from '@nestjs/common';
import { TenantsService } from 'src/tenants/tenants.service';
import { Attribute, Status } from './interfaces/product.interface';
import { MemberDocument } from 'src/members/schemas/member.schema';
import { Response } from 'express';
import { Parser } from 'json2csv';
import { HistoryService } from 'src/history/history.service';
import { updateProductPrice } from './helpers/update-price.helper';
import { TenantConnectionService } from 'src/infra/db/tenant-connection.service';
import { ModuleRef } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SlackService } from 'src/slack/slack.service';
import { AssignmentsService } from 'src/assignments/assignments.service';
import { EventTypes } from 'src/infra/event-bus/types';
import { TenantModelRegistry } from 'src/infra/db/tenant-model-registry';
import { LogisticsService } from 'src/logistics/logistics.sevice';

export interface ProductModel
  extends Model<ProductDocument>,
    SoftDeleteModel<ProductDocument> {}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  constructor(
    private readonly tenantModelRegistry: TenantModelRegistry,
    private tenantsService: TenantsService,
    private readonly historyService: HistoryService,
    private readonly connectionService: TenantConnectionService,
    private readonly moduleRef: ModuleRef,
    private readonly eventEmitter: EventEmitter2,
    private readonly slackService: SlackService,
    private readonly assignmentsService: AssignmentsService,
    @Inject(forwardRef(() => LogisticsService))
    private readonly logisticsService: LogisticsService,
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

  private async validateSerialNumber(serialNumber: string, tenantName: string) {
    if (!serialNumber || serialNumber.trim() === '') {
      return;
    }
    const ProductModel =
      await this.tenantModelRegistry.getProductModel(tenantName);
    const productWithSameSerialNumber = await ProductModel.findOne({
      serialNumber,
    });
    const memberProductWithSameSerialNumber =
      await this.assignmentsService.findProductBySerialNumber(serialNumber);

    if (productWithSameSerialNumber || memberProductWithSameSerialNumber) {
      throw new BadRequestException('Serial Number already exists');
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

  public async determineProductStatus(
    params: {
      fp_shipment?: boolean;
      location?: string;
      assignedEmail?: string;
      productCondition?: string;
    },
    tenantId: string,
    actionType?: string,
    shipmentStatus?: string,
  ): Promise<Status> {
    if (params.fp_shipment === true) {
      if (shipmentStatus) {
        switch (shipmentStatus) {
          case 'In Preparation':
          case 'On The Way':
            return 'In Transit';
          case 'On Hold - Missing Data':
            return 'In Transit - Missing Data';
          case 'Cancelled':
          case 'Received':
            if (params.location === 'Employee' && params.assignedEmail) {
              return 'Delivered';
            }
            break;
        }
      }

      if (params.location === 'Employee' && params.assignedEmail) {
        const member = await this.assignmentsService.findByEmailNotThrowError(
          params.assignedEmail,
          undefined,
          undefined,
          tenantId,
        );
        if (
          member?.address &&
          member.country &&
          member.city &&
          member.zipCode
        ) {
          return 'In Transit';
        } else {
          return 'In Transit - Missing Data';
        }
      }

      if (
        params.location === 'Our office' ||
        params.location === 'FP warehouse'
      ) {
        return 'In Transit';
      }

      return 'In Transit - Missing Data';
    }

    if (params.productCondition === 'Unusable') {
      return 'Unavailable';
    }

    if (params.assignedEmail && params.location === 'Employee') {
      return 'Delivered';
    }

    if (
      params.location === 'FP warehouse' ||
      params.location === 'Our office'
    ) {
      console.log('🧪 Status fallback logic (no shipment):', {
        location: params.location,
        assignedEmail: params.assignedEmail,
        productCondition: params.productCondition,
      });
      return 'Available';
    }

    console.log('🧪 Checking delivered logic:', {
      location: params.location,
      assignedEmail: params.assignedEmail,
      condition: params.productCondition,
    });

    return 'Available';
  }

  async create(
    createProductDto: CreateProductDto,
    tenantName: string,
    userId: string,
  ) {
    await new Promise((resolve) => process.nextTick(resolve));
    const ProductModel =
      await this.tenantModelRegistry.getProductModel(tenantName);
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
      await this.validateSerialNumber(serialNumber, tenantName);
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
      const member = await this.assignmentsService.assignProduct(
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

    const newProduct = await ProductModel.create({
      ...createData,
      assignedEmail,
      assignedMember: assignedMember || this.getFullName(createProductDto),
      recoverable: isRecoverable,
      productCondition: createData.productCondition,
    });

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
    const connection = await this.tenantModelRegistry.getConnection(tenantName);
    const ProductModel = connection.model(Product.name, ProductSchema);
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
          await this.validateSerialNumber(serialNumber, tenantName);
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
          const member = await this.simpleFindByEmail(
            product.assignedEmail!,
            tenantName,
          );

          if (member) {
            const productDocument = new ProductModel(
              product,
            ) as ProductDocument;
            productDocument.assignedMember = this.getFullName(member);
            member.products.push(productDocument);
            await member.save({ session });
            await ProductModel.deleteOne({ _id: product._id }).session(session);
            createdProducts.push(productDocument);
          } else {
            const createdProduct = await ProductModel.create([product], {
              session,
            });
            createdProducts.push(...createdProduct);
          }
        },
      );

      const inserted = await ProductModel.insertMany(
        productsWithoutAssignedEmail,
        { session },
      );
      createdProducts.push(...inserted);
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

      // session.endSession();

      return createdProducts;
    } catch (error) {
      console.error('💥 Error en bulkCreate:', error);
      if (session.inTransaction()) await session.abortTransaction();

      if (error instanceof BadRequestException) {
        throw new BadRequestException('Serial Number already exists');
      } else {
        throw new InternalServerErrorException();
      }
    } finally {
      await session.endSession();
    }
  }

  async simpleFindByEmail(email: string, tenantName: string) {
    const MemberModel =
      await this.tenantModelRegistry.getMemberModel(tenantName);
    return MemberModel.findOne({ email: email.trim().toLowerCase() });
  }

  async tableGrouping(tenantName: string) {
    await new Promise((resolve) => process.nextTick(resolve));

    const ProductModel =
      await this.tenantModelRegistry.getProductModel(tenantName);
    const tenantConnection = ProductModel.db;

    const productsFromRepository = await ProductModel.find({
      isDeleted: false,
    });

    const productsFromMembers =
      await this.assignmentsService.getAllProductsWithMembers(tenantConnection);

    const allProducts = [...productsFromRepository, ...productsFromMembers];

    const productsWithFilteredAttributes = await Promise.all(
      allProducts.map(async (product) => {
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
          activeShipment,
        } = product;
        const filteredAttributes = attributes.filter(
          (attribute: Attribute) =>
            attribute.key !== 'keyboardLanguage' && attribute.key !== 'gpu',
        );

        let shipmentOrigin: string | null = null;
        let shipmentDestination: string | null = null;
        let shipmentId: string | null = null;

        // if (activeShipment && _id) {
        //   const tenantConnection =
        //     await this.connectionService.getTenantConnection(tenantName);
        //   const ShipmentModel =
        //     this.shipmentsService.getShipmentModel(tenantConnection);

        //   const shipment = await ShipmentModel.findOne({
        //     products: new mongoose.Types.ObjectId(_id.toString()),
        //     shipment_status: {
        //       $in: ['In Preparation', 'On Hold - Missing Data', 'On The Way'],
        //     },
        //     isDeleted: { $ne: true },
        //   }).lean();

        //   if (shipment) {
        //     shipmentOrigin = shipment.origin;
        //     shipmentDestination = shipment.destination;
        //     shipmentId = shipment._id.toString();
        //   }
        // }

        if (activeShipment && _id) {
          const shipmentSummary =
            await this.logisticsService.getShipmentSummaryByProductId(
              _id.toString(),
              tenantName,
            );

          if (shipmentSummary) {
            shipmentId = shipmentSummary.shipmentId;
            shipmentOrigin = shipmentSummary.shipmentOrigin;
            shipmentDestination = shipmentSummary.shipmentDestination;
          }
        }

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
          shipmentOrigin,
          shipmentDestination,
          shipmentId,
        };
      }),
    );

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

  async findProductAndLocationById(
    id: ObjectId,
    tenantName: string,
  ): Promise<{
    product: Product | ProductDocument;
    location: 'products' | 'members';
    member?: MemberDocument;
    tenantName: string;
  }> {
    await new Promise((resolve) => process.nextTick(resolve));

    const ProductModel =
      await this.tenantModelRegistry.getProductModel(tenantName);
    console.log('[🔍] Buscando producto por ID:', id, 'en ProductModel');
    const product = await ProductModel.findById(id);
    console.log('[✅] Resultado en ProductModel:', product?._id?.toString());
    if (product?.isDeleted) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }

    if (product) {
      if (product.isDeleted) {
        console.warn('[⚠️] Producto encontrado pero marcado como eliminado');
        throw new NotFoundException(`Product with id "${id}" not found`);
      }
      return { product, location: 'products', tenantName };
    }

    const connection = await this.tenantModelRegistry.getConnection(tenantName);
    console.log(
      '🪵 ID recibido en Logistics antes de getProductByMembers desde findProductAndLocationById:',
      id,
      typeof id,
      id instanceof Types.ObjectId,
    );

    const memberProduct = await this.assignmentsService.getProductByMembers(
      id,
      connection,
    );

    if (memberProduct?.product.isDeleted) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }

    if (memberProduct?.product) {
      return {
        product: memberProduct.product,
        location: 'members',
        member: memberProduct.member,
        tenantName,
      };
    }

    throw new NotFoundException(`Product with id "${id}" not found`);
  }

  async findById(
    id: ObjectId,
    tenantName: string,
  ): Promise<Product | ProductDocument> {
    const { product } = await this.findProductAndLocationById(id, tenantName);
    return product;
  }

  async updateOne(tenantName: string, filter: any, update: any, options: any) {
    const ProductModel =
      await this.tenantModelRegistry.getProductModel(tenantName);
    return ProductModel.updateOne(filter, update, options);
  }

  async findByIdAndDelete(tenantName: string, id: ObjectId, options?: any) {
    const ProductModel =
      await this.tenantModelRegistry.getProductModel(tenantName);
    return ProductModel.findByIdAndDelete(id, options);
  }

  async updateMultipleProducts(
    productsToUpdate: { id: ObjectId; product: any }[],
    tenantName: string,
    userId: string,
    ourOfficeEmail: string,
  ) {
    const connection =
      await this.connectionService.getTenantConnection(tenantName);
    const session = await connection.startSession();
    session.startTransaction();

    try {
      for (const { id, product } of productsToUpdate) {
        const updateProductDto = { ...product };

        await this.update(
          id,
          { ...updateProductDto },
          tenantName,
          userId,
          ourOfficeEmail,
          session,
          connection,
        );
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
    ourOfficeEmail: string,
  ) {
    if (updateProductDto.assignedEmail === 'none') {
      updateProductDto.assignedEmail = '';
    }
    return this.update(
      id,
      updateProductDto,
      tenantName,
      userId,
      ourOfficeEmail,
    );
  }

  public getUpdatedFields(
    product: ProductDocument,
    updateProductDto: UpdateProductDto,
  ) {
    const updatedFields: any = {};
    for (const key in updateProductDto) {
      if (
        updateProductDto[key] !== undefined &&
        updateProductDto[key] !== product[key]
      ) {
        // Si el producto está en shipment activo, no actualizar el status
        if (key === 'status' && product.fp_shipment === true) {
          console.log(
            '⚠️ Producto en shipment activo, ignorando cambio de status',
          );
          continue;
        }

        if (
          key === 'activeShipment' &&
          product.fp_shipment === true &&
          updateProductDto[key] === false
        ) {
          console.log(
            '⚠️ Producto en shipment activo, ignorando cambio de activeShipment a false',
          );
          continue;
        }

        updatedFields[key] = updateProductDto[key];
      }
    }

    if (
      updateProductDto.activeShipment !== undefined &&
      product.fp_shipment !== true
    ) {
      updatedFields.activeShipment = updateProductDto.activeShipment;
    } else if (
      product.fp_shipment === true &&
      updateProductDto.activeShipment === false
    ) {
      console.log(
        '⚠️ Ignorando override de activeShipment=false por estar en shipment activo',
      );

      delete updatedFields.activeShipment;
    }

    if (product.fp_shipment === true) {
      updatedFields.activeShipment = true;
    }

    return updatedFields;
  }

  // REFACTOR UNA PARTE TIENE QUE IR A ASSIGNMENTS SERVICE
  async updateEntity(
    id: ObjectId,
    updateProductDto: UpdateProductDto,
    config: { tenantName: string; userId: string },
  ) {
    await new Promise((resolve) => process.nextTick(resolve));
    const ProductModel = await this.tenantModelRegistry.getProductModel(
      config.tenantName,
    );
    const { tenantName, userId } = config;

    try {
      const { member, product, location } =
        await this.findProductAndLocationById(id, tenantName);
      const productCopy = JSON.parse(JSON.stringify(product));
      const isInActiveShipment = product.fp_shipment === true;

      if (isInActiveShipment) {
        console.log(
          '⚠️ Producto en shipment activo, aplicando reglas especiales',
        );

        if (updateProductDto.fp_shipment === false) {
          console.log('⚠️ Ignorando cambio a fp_shipment=false');
          updateProductDto.fp_shipment = true;
        }

        if (
          updateProductDto.status &&
          !['In Transit', 'In Transit - Missing Data'].includes(product.status)
        ) {
          updateProductDto.status = product.status;
        }
      }

      await this.getRecoverableConfigForTenant(tenantName);
      const isRecoverable =
        updateProductDto.recoverable !== undefined
          ? updateProductDto.recoverable
          : product.recoverable;

      if (updateProductDto.price === null) {
        await ProductModel.updateOne(
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

      if (updateProductDto.serialNumber === '' && location === 'products') {
        await ProductModel.updateOne(
          { _id: product._id },
          { $unset: { serialNumber: '' } },
        );
        product.serialNumber = undefined;
      }

      if (
        updateProductDto.serialNumber &&
        updateProductDto.serialNumber !== product.serialNumber
      ) {
        await this.validateSerialNumber(
          updateProductDto.serialNumber,
          tenantName,
        );
      }

      const updatedFields = this.getUpdatedFields(product as ProductDocument, {
        ...updateProductDto,
        recoverable: isRecoverable,
      });

      if (isInActiveShipment && updatedFields.status) {
        delete updatedFields.status;
      }

      if (updateProductDto.price === null) {
        delete updatedFields.price;
      }
      if (updateProductDto.serialNumber === null && location === 'products') {
        delete updatedFields.serialNumber;
      }

      if (
        updateProductDto.activeShipment !== undefined &&
        product.fp_shipment !== true
      ) {
        updatedFields.activeShipment = updateProductDto.activeShipment;
      } else if (
        product.fp_shipment === true &&
        updateProductDto.activeShipment === false
      ) {
        console.log(
          '⚠️ Ignorando override de activeShipment=false por estar en shipment activo',
        );
      }

      let productUpdated;

      if (location === 'products') {
        productUpdated = await ProductModel.findOneAndUpdate(
          { _id: product._id },
          { $set: updatedFields },
          { runValidators: true, new: true, omitUndefined: true },
        );
      } else if (location === 'members' && member) {
        if (product.fp_shipment) updatedFields.activeShipment = true;

        if (!product._id) {
          throw new BadRequestException('Product is missing _id');
        }
        productUpdated = await this.assignmentsService.updateEmbeddedProduct(
          member,
          product._id,
          updatedFields,
        );
      }
      console.log('🧾 Llamando a historyService.create con userId:', userId);
      if (!userId)
        throw new Error('❌ userId is undefined antes de crear history');
      await this.historyService.create({
        actionType: 'update',
        itemType: 'assets',
        userId: userId,
        changes: {
          oldData: productCopy,
          newData: productUpdated,
        },
      });

      return {
        message: `Product with id "${id}" updated successfully`,
      };
    } catch (error) {
      console.log('❌ Error in updateEntity:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });

      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error?.code === 11000) {
        throw new BadRequestException('Serial Number already exists');
      }

      throw new InternalServerErrorException('Unexpected error occurred.');
    }
  }

  // public async maybeCreateShipmentAndUpdateStatus(
  //   product: ProductDocument,
  //   updateDto: UpdateProductDto,
  //   tenantName: string,
  //   actionType: string,
  //   session: ClientSession,
  //   oldData: {
  //     location?: string;
  //     assignedEmail?: string;
  //     assignedMember?: string;
  //   },
  //   newData: {
  //     location?: string;
  //     assignedEmail?: string;
  //     assignedMember?: string;
  //   },
  //   userId: string,
  //   ourOfficeEmail: string,
  // ): Promise<ShipmentDocument | null> {
  //   console.log(
  //     'called user id from maybeCreateShipmentAndUpdateStatus',
  //     userId,
  //   );
  //   if (!updateDto.fp_shipment || !actionType) return null;

  //   const desirableDateOrigin =
  //     typeof updateDto.desirableDate === 'object'
  //       ? updateDto.desirableDate.origin || ''
  //       : '';
  //   const desirableDateDestination =
  //     typeof updateDto.desirableDate === 'string'
  //       ? updateDto.desirableDate
  //       : updateDto.desirableDate?.destination || '';

  //   const connection =
  //     await this.connectionService.getTenantConnection(tenantName);

  //   const { shipment, isConsolidated, oldSnapshot } =
  //     await this.shipmentsService.findOrCreateShipment(
  //       product._id!.toString(),
  //       actionType,
  //       tenantName,
  //       userId,
  //       session,
  //       desirableDateDestination,
  //       desirableDateOrigin,
  //       oldData,
  //       newData,
  //     );

  //   if (!shipment || !shipment._id) {
  //     console.error('❌ Failed to create shipment or shipment has no ID');
  //     return null;
  //   }

  //   product.activeShipment = true;
  //   product.fp_shipment = true;
  //   await product.save({ session });

  //   if (session.inTransaction()) {
  //     await session.commitTransaction();
  //     session.startTransaction();
  //   }

  //   const newStatus =
  //     shipment.shipment_status === 'On Hold - Missing Data'
  //       ? 'In Transit - Missing Data'
  //       : 'In Transit';

  //   product.status = newStatus;
  //   updateDto.status = newStatus;

  //   await product.save({ session });

  //   await this.shipmentsService.createSnapshots(shipment, connection, {
  //     providedProducts: [product],
  //   });

  //   console.log('[HISTORY DEBUG]', {
  //     actionType: isConsolidated ? 'consolidate' : 'create',
  //     userId,
  //     oldSnapshot,
  //     newData: shipment,
  //   });

  //   await this.historyService.create({
  //     actionType: isConsolidated ? 'consolidate' : 'create',
  //     itemType: 'shipments',
  //     userId,

  //     changes: {
  //       oldData: isConsolidated ? oldSnapshot ?? null : null,
  //       newData: shipment,
  //       context: isConsolidated ? 'single-product' : undefined,
  //     },
  //   });

  //   // TODO: Status New Shipment
  //   if (shipment.shipment_status === 'In Preparation' && !isConsolidated) {
  //     const slackMessage = CreateShipmentMessageToSlack({
  //       shipment: shipment,
  //       tenantName: tenantName,
  //       isOffboarding: false,
  //       status: 'New',
  //       ourOfficeEmail: ourOfficeEmail,
  //     });
  //     await this.slackService.sendMessage(slackMessage);
  //   }

  //   //TODO: Status consolidate
  //   if (isConsolidated) {
  //     const slackMessage = CreateShipmentMessageToSlack({
  //       shipment: shipment,
  //       tenantName: tenantName,
  //       isOffboarding: false,
  //       status: 'Consolidated',
  //       previousShipment: oldSnapshot,
  //       ourOfficeEmail: ourOfficeEmail,
  //     });

  //     await this.slackService.sendMessage(slackMessage);
  //   }

  //   return shipment;
  // }

  async update(
    id: ObjectId,
    updateProductDto: UpdateProductDto,
    tenantName: string,
    userId: string,
    ourOfficeEmail: string,
    session?: ClientSession,
    connection?: Connection,
  ) {
    await new Promise((resolve) => process.nextTick(resolve));

    const internalConnection =
      connection ??
      (await this.connectionService.getTenantConnection(tenantName));
    const internalSession =
      session ?? (await internalConnection.startSession());

    const startedTransaction = !session;
    if (startedTransaction) {
      internalSession.startTransaction();
    }

    try {
      console.log('🔄 [update] ID recibido:', id.toString());
      console.log('🔄 [update] DTO recibido:', updateProductDto);
      await this.normalizeFpShipmentFlag(
        id,
        updateProductDto,
        internalConnection,
        internalSession,
        tenantName,
      );
      console.log('🧩 Buscando producto por ID en ProductModel...');

      const ProductModel =
        await this.tenantModelRegistry.getProductModel(tenantName);
      console.log('🧩 Obtenido ProductModel para tenant:', tenantName);
      console.error(
        '❌ Producto no encontrado en ProductModel con id:',
        id.toString(),
      );
      const product = await ProductModel.findById(id).session(internalSession);

      const result = product
        ? await this.assignmentsService.handleProductFromProductsCollection(
            product,
            updateProductDto,
            tenantName,
            userId,
            ourOfficeEmail,
            internalSession,
            internalConnection,
          )
        : await this.assignmentsService.handleProductFromMemberCollection(
            id,
            updateProductDto,
            tenantName,
            userId,
            ourOfficeEmail,
            internalSession,
            internalConnection,
          );

      if (startedTransaction) {
        await internalSession.commitTransaction();
        internalSession.endSession();
      }

      return {
        message: `Product with id "${id}" updated successfully`,
        shipment: result.shipment ?? null,
        updatedProduct: result.updatedProduct ?? null,
      };
    } catch (error) {
      if (startedTransaction) {
        await internalSession.abortTransaction();
        internalSession.endSession();
      }
      console.error('❌ Error en update:', error.message, error.stack);
      throw error;
    }
  }

  public async normalizeFpShipmentFlag(
    productId: ObjectId,
    updateProductDto: UpdateProductDto,
    connection: Connection,
    session: ClientSession,
    tenantName: string,
  ): Promise<void> {
    const ProductModel =
      await this.tenantModelRegistry.getProductModel(tenantName);

    if (updateProductDto.fp_shipment === undefined) {
      const existingProduct = await ProductModel.findById(productId);

      if (existingProduct) {
        updateProductDto.fp_shipment = existingProduct.fp_shipment === true;
      } else {
        console.log(
          '🪵 ID recibido en Logistics antes de getProductByMembers desde normalizeFpShipmentFlag:',
          productId,
          typeof productId,
          productId instanceof Types.ObjectId,
        );

        const memberProduct = await this.assignmentsService.getProductByMembers(
          productId,
          connection,
          session,
        );
        updateProductDto.fp_shipment =
          memberProduct?.product?.fp_shipment === true;
      }
    } else if (updateProductDto.fp_shipment === false) {
      const existingProduct = await ProductModel.findById(productId);

      if (existingProduct?.fp_shipment === true) {
        updateProductDto.fp_shipment = true;
      } else {
        console.log(
          '🪵 ID recibido en Logistics antes de getProductByMembers desde normalizeFpShipmentFlag dos:',
          productId,
          typeof productId,
          productId instanceof Types.ObjectId,
        );

        const memberProduct = await this.assignmentsService.getProductByMembers(
          productId,
          connection,
          session,
        );
        if (memberProduct?.product?.fp_shipment === true) {
          updateProductDto.fp_shipment = true;
        }
      }
    }
  }

  public updatePriceIfProvided(
    product: ProductDocument,
    updateProductDto: UpdateProductDto,
  ): void {
    const hasValidPrice =
      updateProductDto.price?.amount !== undefined &&
      updateProductDto.price?.currencyCode !== undefined;

    if (hasValidPrice) {
      product.price = {
        amount: updateProductDto.price!.amount!,
        currencyCode: updateProductDto.price!.currencyCode!,
      };
    } else if (product.price && !updateProductDto.price) {
    } else {
      product.price = undefined;
    }
  }

  public getEffectiveRecoverableValue(
    updateProductDto: UpdateProductDto,
    currentRecoverable: boolean,
  ): boolean {
    return updateProductDto.recoverable !== undefined
      ? updateProductDto.recoverable
      : currentRecoverable;
  }

  async setNonShipmentStatus(updateDto: UpdateProductDto): Promise<void> {
    if (updateDto.assignedEmail && updateDto.assignedEmail !== 'none') {
      updateDto.location = 'Employee';
      updateDto.status = 'Delivered';
    } else if (
      updateDto.assignedEmail === 'none' &&
      updateDto.productCondition !== 'Unusable'
    ) {
      if (!['FP warehouse', 'Our office'].includes(updateDto.location || '')) {
        throw new BadRequestException(
          'When unassigned, location must be FP warehouse or Our office.',
        );
      }
      updateDto.status = 'Available';
    }
  }

  public emitProductUpdatedEvent(productId: string, tenantName: string) {
    console.log(
      `🔔 Emitiendo evento de actualización para producto ${productId} en tenant ${tenantName}`,
    );
    this.eventEmitter.emit(EventTypes.PRODUCT_ADDRESS_UPDATED, {
      productId,
      tenantName,
    });
  }

  // TODO: extraer lógica de recuperación desde miembros y limpieza a AssignmentsService
  // TODO: dividir en helpers internos para mayor trazabilidad y testeabilidad
  async softDelete(id: ObjectId, userId: string, tenantName: string) {
    await new Promise((resolve) => process.nextTick(resolve));
    const connection =
      await this.connectionService.getTenantConnection(tenantName);
    const session = await connection.startSession();
    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        session.startTransaction();
        const ProductModel = (await this.tenantModelRegistry.getProductModel(
          tenantName,
        )) as any;
        const product = await ProductModel.findById(id).session(session);
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
          await ProductModel.softDelete({ _id: id }, { session });

          changes.oldData = product;
        } else {
          console.log(
            '🪵 ID recibido en Logistics antes de getProductByMembers desde softDelete:',
            id,
            typeof id,
            id instanceof Types.ObjectId,
          );
          const memberProduct =
            await this.assignmentsService.getProductByMembers(
              id,
              connection,
              session,
            );

          if (memberProduct && memberProduct.product) {
            await ProductModel.create(
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

            await ProductModel.softDelete({ _id: id }, { session });

            const memberId = memberProduct.member._id;
            await this.assignmentsService.deleteProductFromMember(
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

  async getDeprecatedProducts(tenantName: string): Promise<ProductDocument[]> {
    const ProductModel =
      await this.tenantModelRegistry.getProductModel(tenantName);

    return ProductModel.find({
      status: 'Deprecated',
      isDeleted: true,
    });
  }

  async exportProductsCsv(res: Response, tenantName: string) {
    const allProducts = (await this.tableGrouping(tenantName)) as {
      products: ProductDocument[];
    }[];

    const deprecatedProducts = await this.getDeprecatedProducts(tenantName);

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

  async findProductById(id: Schema.Types.ObjectId, tenantName: string) {
    try {
      const { product, member } = await this.findProductAndLocationById(
        id,
        tenantName,
      );
      return { product, member };
    } catch (error) {
      throw error;
    }
  }

  async updateWithinTransaction(
    id: string | mongoose.Types.ObjectId,
    updateProductDto: UpdateProductDto,
    tenantName: string,
    userId: string,
    ourOfficeEmail: string,
    session: ClientSession,
    connection: Connection,
  ) {
    console.log(
      `🔄 updateWithinTransaction for product ${id} with session ${session.id}`,
    );

    const productModel = connection.model(Product.name, ProductSchema);
    const objectId =
      typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;

    await this.normalizeFpShipmentFlag(
      objectId as unknown as mongoose.Schema.Types.ObjectId,
      updateProductDto,
      connection,
      session,
      tenantName,
    );

    console.log(
      `📊 Using connection: ${connection.name}, readyState: ${connection.readyState}`,
    );
    console.log(
      `📊 Session info: ${session.id}, inTransaction: ${session.inTransaction()}`,
    );

    const product = await productModel.findById(objectId).session(session);

    const result = product
      ? await this.assignmentsService.handleProductFromProductsCollection(
          product,
          updateProductDto,
          tenantName,
          userId,
          ourOfficeEmail,
          session,
          connection,
        )
      : await this.assignmentsService.handleProductFromMemberCollection(
          objectId as unknown as mongoose.Schema.Types.ObjectId,
          updateProductDto,
          tenantName,
          userId,
          ourOfficeEmail,
          session,
          connection,
        );

    return {
      message: `Product with id "${id}" updated successfully`,
      shipment: result.shipment ?? null,
      updatedProduct: result.updatedProduct ?? null,
    };
  }
}
