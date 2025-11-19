import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
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
import { recordEnhancedAssetHistory } from './helpers/history.helper';
import { GlobalProductSyncService } from './services/global-product-sync.service';
import { EventsGateway } from 'src/infra/event-bus/events.gateway';

export interface ProductModel
  extends Model<ProductDocument>,
    SoftDeleteModel<ProductDocument> {}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  /**
   * Helper para sincronizar producto a colección global
   * No falla la operación principal si hay error en sincronización
   */
  private async syncProductToGlobal(
    product: ProductDocument | any,
    tenantName: string,
    sourceCollection: 'products' | 'members' = 'products',
    memberData?: {
      memberId: Types.ObjectId;
      memberEmail: string;
      memberName: string;
      assignedAt?: Date;
    },
    fpWarehouseData?: {
      warehouseId: Types.ObjectId;
      warehouseCountryCode: string;
      warehouseName: string;
      assignedAt?: Date;
      status?: 'STORED' | 'IN_TRANSIT_IN' | 'IN_TRANSIT_OUT';
    },
  ): Promise<void> {
    try {
      // 🔍 [DEBUG] Log para verificar datos de office antes de sincronizar
      console.log(
        `🔄 [SYNC] Sincronizando producto ${product.name} (${product._id}):`,
        {
          location: product.location,
          hasOffice: !!product.office,
          officeData: product.office,
          sourceCollection,
          hasMemberData: !!memberData,
          hasFpWarehouseData: !!fpWarehouseData,
        },
      );
      await this.globalProductSyncService.syncProduct({
        tenantId: tenantName, // Se corregirá automáticamente en GlobalProductSyncService
        tenantName: tenantName,
        originalProductId: product._id as any,
        sourceCollection: sourceCollection,

        // Datos básicos del producto
        name: product.name || '',
        category: product.category,
        status: product.status,
        location: product.location || 'FP warehouse',

        // Convertir atributos a formato string
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

        // Datos del member si aplica
        memberData: memberData,

        // Datos del warehouse si aplica
        fpWarehouse: fpWarehouseData,

        // Datos del office si aplica
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

        sourceUpdatedAt: (product as any).updatedAt || new Date(),
      });
    } catch (error) {
      this.logger.error(
        `❌ Error syncing product ${product._id} to global:`,
        error,
      );
      // No lanzar error para no fallar la operación principal
    }
  }

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
    private readonly globalProductSyncService: GlobalProductSyncService,
    private readonly eventsGateway: EventsGateway,
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

    // � [DEBUG] Log completo del DTO recibido del frontend
    console.log(
      '📦 [CREATE] DTO recibido del frontend:',
      JSON.stringify(createProductDto, null, 2),
    );

    // �🚫 Validación: Los usuarios normales no pueden crear productos iniciales en FP warehouse
    // (Los movimientos/updates a FP warehouse sí están permitidos)
    if (createProductDto.location === 'FP warehouse') {
      throw new BadRequestException(
        'FP warehouse location is not allowed for initial product creation. Please use "Our office" instead.',
      );
    }

    const ProductModel =
      await this.tenantModelRegistry.getProductModel(tenantName);
    const normalizedProduct = this.normalizeProductData(createProductDto);

    // 🔍 [DEBUG] Log después de normalización
    console.log(
      '🔄 [CREATE] Producto normalizado:',
      JSON.stringify(normalizedProduct, null, 2),
    );

    const {
      assignedEmail,
      serialNumber,
      price,
      productCondition,
      officeId,
      ...rest
    } = normalizedProduct;

    // 🔍 [DEBUG] Log de campos extraídos
    console.log('📋 [CREATE] Campos extraídos:', {
      assignedEmail,
      serialNumber,
      productCondition,
      officeId,
      location: rest.location,
    });

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

    // Construir objeto office si officeId está presente y location es "Our office"
    let officeData = {};
    console.log('🏢 [CREATE] Office assignment check:', {
      location,
      officeId,
      hasOfficeId: !!officeId,
    });

    if (officeId && location === 'Our office') {
      console.log('🏢 [CREATE] Building office object for officeId:', officeId);
      officeData = await this.assignmentsService.buildOfficeObject(
        officeId as string,
        tenantName,
      );
      console.log('🏢 [CREATE] Office data built:', officeData);
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
      ...officeData, // Incluir datos de oficina si existen
    };

    let assignedMember = '';

    if (assignedEmail) {
      const member = await this.assignmentsService.assignProduct(
        assignedEmail,
        createData,
        undefined, // session
        tenantName, // ✅ FIX: Pasar tenantName para sincronización global
      );

      if (member) {
        assignedMember = this.getFullName(member);

        // 📜 HISTORY: Crear registro con formato completo incluyendo country
        const createdProduct = member.products.at(-1) as ProductDocument;
        await recordEnhancedAssetHistory(
          this.historyService,
          'create',
          userId,
          null, // oldProduct
          createdProduct, // newProduct
          undefined, // context
          member.country, // newMemberCountry
          undefined, // oldMemberCountry
        );

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

    // 🔄 SYNC: Sincronizar producto creado a colección global
    await this.syncProductToGlobal(newProduct, tenantName, 'products');

    // 📜 HISTORY: Registrar creación con formato mejorado
    await recordEnhancedAssetHistory(
      this.historyService,
      'create',
      userId,
      null, // oldProduct
      newProduct, // newProduct
    );

    return newProduct;
  }

  async bulkCreate(
    createProductDtos: CreateProductDto[],
    tenantName: string,
    userId: string,
    options?: { isCSVUpload?: boolean },
  ) {
    await new Promise((resolve) => process.nextTick(resolve));

    // ✅ CSV Support: Manejar campos adicionales para CSV
    const isCSVUpload = options?.isCSVUpload === true;

    if (!isCSVUpload) {
      // 🚫 Solo para UI Form: Validación de FP warehouse
      // (Los movimientos/updates a FP warehouse sí están permitidos)
      const fpWarehouseProducts = createProductDtos.filter(
        (dto) => dto.location === 'FP warehouse',
      );
      if (fpWarehouseProducts.length > 0) {
        throw new BadRequestException(
          'FP warehouse location is not allowed for initial product creation via UI Form. Please use "Our office" instead.',
        );
      }
    }

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
        (product) => product.serialNumber && product.serialNumber.trim() !== '',
      );

      const seenSerialNumbers = new Set<string>();
      const duplicates = new Set<string>();

      productsWithSerialNumbers.forEach((product) => {
        if (product.serialNumber && product.serialNumber.trim() !== '') {
          if (seenSerialNumbers.has(product.serialNumber)) {
            duplicates.add(product.serialNumber);
          } else {
            seenSerialNumbers.add(product.serialNumber);
          }
        }
      });

      if (duplicates.size > 0) {
        throw new BadRequestException(
          `Serial Number already exists: ${Array.from(duplicates).join(', ')}`,
        );
      }

      for (const product of normalizedProducts) {
        const { serialNumber, category, recoverable, productCondition } =
          product;

        // 🔧 Si no viene productCondition en CSV, usar 'Optimal' como default
        if (!productCondition) {
          product.productCondition = 'Optimal';
        }

        const isRecoverable =
          recoverable !== undefined
            ? recoverable
            : recoverableConfig.get(category) || false;

        product.recoverable = isRecoverable;

        if (serialNumber && serialNumber.trim() !== '') {
          await this.validateSerialNumber(serialNumber, tenantName);
        }
      }

      const createData = await Promise.all(
        normalizedProducts.map(async (product) => {
          const { serialNumber, officeId, country, officeName, ...rest } =
            product as any;

          // 🏢 Manejar asignación de oficinas
          let officeData = {};
          let fpWarehouseData = {};

          if (product.location === 'Our office') {
            if (isCSVUpload && country && officeName) {
              // 📝 CSV: Delegar al servicio transversal AssignmentsService
              const officeAssignment =
                await this.assignmentsService.handleCSVOfficeAssignment(
                  country,
                  officeName,
                  tenantName,
                  userId,
                );

              officeData = officeAssignment;
            } else {
              // 🖥️ UI Form: Usar officeId o oficina default
              const officeAssignment =
                await this.assignmentsService.handleOfficeAssignment(
                  officeId as string,
                  product.location,
                  undefined, // currentOffice
                  tenantName,
                );
              officeData = officeAssignment;
            }
          } else if (
            product.location === 'FP warehouse' &&
            isCSVUpload &&
            country
          ) {
            // 🏭 CSV: Delegar al servicio transversal AssignmentsService
            const warehouseAssignment =
              await this.assignmentsService.handleCSVWarehouseAssignment(
                country,
                tenantName,
                userId,
                product.category || 'Unknown',
              );

            fpWarehouseData = warehouseAssignment;
          }

          const baseProduct =
            serialNumber && serialNumber.trim() !== ''
              ? { ...rest, serialNumber }
              : rest;

          const finalProduct = {
            ...baseProduct,
            ...officeData,
            ...fpWarehouseData,
          };

          return finalProduct;
        }),
      );

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
      // Map para guardar relación producto-miembro para sincronización
      const productMemberMap = new Map<
        string,
        { memberId: any; memberEmail: string; memberName: string }
      >();
      // Map para guardar relación producto-warehouse para sincronización
      const productWarehouseMap = new Map<
        string,
        {
          warehouseId: Types.ObjectId;
          warehouseCountryCode: string;
          warehouseName: string;
          assignedAt: Date;
          status: 'STORED' | 'IN_TRANSIT_IN' | 'IN_TRANSIT_OUT';
        }
      >();

      // 🗺️ Poblar productWarehouseMap para productos con FP warehouse
      productsWithIds.forEach((product) => {
        if (product.location === 'FP warehouse' && product.fpWarehouse) {
          const productIdStr = product._id.toString();
          productWarehouseMap.set(productIdStr, {
            warehouseId: product.fpWarehouse.warehouseId,
            warehouseCountryCode: product.fpWarehouse.warehouseCountryCode,
            warehouseName: product.fpWarehouse.warehouseName,
            assignedAt: product.fpWarehouse.assignedAt,
            status: product.fpWarehouse.status,
          });
        }
      });

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

            // Guardar relación para sincronización usando el _id original del producto
            // El product._id es el que se generó en la línea 449 y es el que se usa en la colección
            const productIdStr = product._id.toString();
            productMemberMap.set(productIdStr, {
              memberId: member._id,
              memberEmail: member.email,
              memberName: this.getFullName(member),
            });
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

      // 🔄 SYNC: Sincronizar productos creados en bulk a colección global

      for (const product of createdProducts) {
        try {
          // Determinar sourceCollection basado en si tiene assignedEmail
          const sourceCollection = product.assignedEmail
            ? 'members'
            : 'products';

          // Obtener memberData si el producto está asignado
          const productId = product._id?.toString();
          const memberInfo = productId
            ? productMemberMap.get(productId)
            : undefined;

          // Obtener fpWarehouseData si el producto está en FP warehouse
          const warehouseInfo = productId
            ? productWarehouseMap.get(productId)
            : undefined;

          // Sincronizar con memberData y/o fpWarehouseData según corresponda
          if (memberInfo && warehouseInfo) {
            await this.syncProductToGlobal(
              product,
              tenantName,
              sourceCollection,
              {
                memberId: memberInfo.memberId,
                memberEmail: memberInfo.memberEmail,
                memberName: memberInfo.memberName,
                assignedAt: new Date(),
              },
              warehouseInfo,
            );
          } else if (memberInfo) {
            await this.syncProductToGlobal(
              product,
              tenantName,
              sourceCollection,
              {
                memberId: memberInfo.memberId,
                memberEmail: memberInfo.memberEmail,
                memberName: memberInfo.memberName,
                assignedAt: new Date(),
              },
            );
          } else if (warehouseInfo) {
            await this.syncProductToGlobal(
              product,
              tenantName,
              sourceCollection,
              undefined, // no memberData
              warehouseInfo,
            );
          } else {
            await this.syncProductToGlobal(
              product,
              tenantName,
              sourceCollection,
            );
          }
        } catch (error) {
          this.logger.error(
            `❌ [bulkCreate] Error syncing product ${product._id} to global collection:`,
            error,
          );
          // No fallar el bulk create si falla la sincronización
        }
      }

      // 📜 HISTORY: Registrar el historial con formato completo incluyendo country
      // Crear un mapa de email -> country para evitar múltiples consultas
      const memberCountryMap = new Map<string, string>();
      for (const [, memberInfo] of productMemberMap.entries()) {
        if (memberInfo.memberEmail) {
          const member = await this.simpleFindByEmail(
            memberInfo.memberEmail,
            tenantName,
          );
          if (member?.country) {
            memberCountryMap.set(memberInfo.memberEmail, member.country);
          }
        }
      }

      const { AssetHistoryFormatter } = await import(
        '../history/helpers/history-formatters.helper'
      );

      const formattedProducts = createdProducts.map((product) => {
        // Obtener country del member si está asignado
        const memberCountry = product.assignedEmail
          ? memberCountryMap.get(product.assignedEmail)
          : undefined;

        return AssetHistoryFormatter.formatAssetData(
          product,
          product.assignedMember,
          undefined, // context
          memberCountry, // country del member
        );
      });

      await this.historyService.create({
        actionType: 'bulk-create',
        itemType: 'assets',
        userId: userId,
        changes: {
          oldData: null,
          newData: formattedProducts,
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
    }).lean();

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

        // Calcular countryCode y officeName según la ubicación del producto
        let countryCode: string | null = null;
        let officeName: string | null = null;

        if (location === 'Employee') {
          // Para productos asignados a empleados, usar el country del member
          const memberData = (product as any).memberData;
          countryCode = memberData?.country || null;
        } else if (location === 'FP warehouse') {
          // Para productos en warehouse, usar warehouseCountryCode
          const fpWarehouse = (product as any).fpWarehouse;
          countryCode = fpWarehouse?.warehouseCountryCode || null;
        } else if (location === 'Our office') {
          // Para productos en oficina, usar officeCountryCode y officeName
          const office = (product as any).office;
          countryCode = office?.officeCountryCode || null;
          officeName = office?.officeName || null;
        }

        // Debug: verificar si el producto tiene office cuando location es "Our office"
        if (location === 'Our office') {
          // console.log('🏢 Producto Our office:', {
          //   productId: _id,
          //   hasOffice: !!(product as any).office,
          //   countryCode,
          //   officeKeys: (product as any).office
          //     ? Object.keys((product as any).office)
          //     : 'null',
          // });
        }
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

        let shipmentStatus: string | null = null;

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

          // Obtener el status del shipment para productos con activeShipment = true
          shipmentStatus =
            await this.logisticsService.getShipmentStatusByProductId(
              _id.toString(),
              tenantName,
            );
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
          shipmentStatus,
          // Solo el countryCode según la ubicación
          countryCode,
          // Solo el officeName cuando location es "Our office"
          officeName,
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

            // 🎯 FIX: Solo agrupar por características VISUALES (brand, model, color, screen)
            // NO incluir processor, ram, storage que son specs internas
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

  async findByIdAndDelete(
    tenantName: string,
    id: ObjectId,
    options?: any,
    providedConnection?: Connection,
  ) {
    // ✅ FIX: Usar la conexión proporcionada si existe (misma que creó la session)
    const connection =
      providedConnection ||
      (await this.connectionService.getTenantConnection(tenantName));
    const ProductModel = connection.model(Product.name, ProductSchema);
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
    console.log(`🔁 [reassignProduct] DEBUG - Product ID: ${id}`);
    console.log(`🔁 [reassignProduct] DEBUG - updateProductDto:`, {
      location: updateProductDto.location,
      assignedEmail: updateProductDto.assignedEmail,
      fp_shipment: updateProductDto.fp_shipment,
      actionType: updateProductDto.actionType,
      officeId: updateProductDto.officeId,
    });

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

        // 🏭 PRESERVAR fpWarehouse: No sobrescribir con null si el producto está en FP warehouse
        if (
          key === 'fpWarehouse' &&
          updateProductDto[key] === null &&
          product.location === 'FP warehouse'
        ) {
          console.log(
            '⚠️ Producto en FP warehouse, preservando fpWarehouse existente',
          );
          continue;
        }

        // 👤 PRESERVAR memberData: No sobrescribir con null si el producto tiene member asignado
        if (
          key === 'memberData' &&
          updateProductDto[key] === null &&
          product.assignedMember
        ) {
          console.log(
            '⚠️ Producto con member asignado, preservando memberData existente',
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

      // 📸 HISTORY: Capturar estado original ANTES de cualquier modificación
      const originalProduct = JSON.parse(
        JSON.stringify(
          (product as any).toObject ? (product as any).toObject() : product,
        ),
      );

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

      // 🎯 FIX: Capturar serialNumber original ANTES de cualquier modificación
      const originalSerialNumber = product.serialNumber;

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

      // 🎯 FIX: Manejar serialNumber vacío para AMBAS ubicaciones
      if (updateProductDto.serialNumber === '') {
        if (location === 'products') {
          await ProductModel.updateOne(
            { _id: product._id },
            { $unset: { serialNumber: '' } },
          );
          product.serialNumber = undefined;
          // Para products, limpiar el campo para que no se incluya en updatedFields
          updateProductDto.serialNumber = undefined;
        } else if (location === 'members') {
          // Para members, mantener como null para que llegue a updateEmbeddedProduct
          updateProductDto.serialNumber = null;
        }
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
      // 🎯 FIX: Manejar serialNumber null solo para products (members lo necesita en updatedFields)
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
          tenantName, // 🎯 Pasar tenantName para sincronización
        );
      }

      // 🔄 SYNC: Sincronizar producto actualizado a colección global
      if (productUpdated) {
        const sourceCollection =
          location === 'members' ? 'members' : 'products';
        let memberData: any = undefined;

        if (location === 'members' && member) {
          memberData = {
            memberId: member._id as any,
            memberEmail: member.email,
            memberName: `${member.firstName} ${member.lastName}`,
            assignedAt: (productUpdated as any).assignedAt || member.updatedAt,
          };
        }

        // 🎯 FIX: Indicar si se debe eliminar serialNumber de global
        // Detectar si el producto TENÍA serialNumber pero ahora no lo tiene
        const hadSerialNumber =
          originalSerialNumber !== undefined &&
          originalSerialNumber !== null &&
          originalSerialNumber !== '';
        const hasSerialNumber =
          productUpdated.serialNumber !== undefined &&
          productUpdated.serialNumber !== null &&
          productUpdated.serialNumber !== '';
        const shouldRemoveSerialNumber = hadSerialNumber && !hasSerialNumber;

        await this.assignmentsService.syncProductToGlobal(
          productUpdated,
          tenantName,
          sourceCollection,
          memberData,
          shouldRemoveSerialNumber, // 🎯 Nuevo parámetro
        );
      }

      if (!userId)
        throw new Error('❌ userId is undefined antes de crear history');

      // 📜 HISTORY: Registrar actualización con formato mejorado
      await recordEnhancedAssetHistory(
        this.historyService,
        'update',
        userId,
        originalProduct as ProductDocument, // ✅ producto original (antes de modificaciones)
        productUpdated as ProductDocument, // ✅ producto actualizado
      );

      if (isInActiveShipment && product?._id) {
        const shipmentSummary =
          await this.logisticsService.getShipmentSummaryByProductId(
            product._id.toString(),
            tenantName,
          );

        const editableStatuses = ['In Preparation', 'On Hold - Missing Data'];

        if (
          shipmentSummary &&
          editableStatuses.includes(shipmentSummary.shipmentStatus)
        ) {
          console.log(
            `📦 Shipment editable (${shipmentSummary.shipmentStatus}) → Emitiendo evento`,
          );
          this.eventEmitter.emit(EventTypes.PRODUCT_ADDRESS_UPDATED, {
            productId: product._id.toString(),
            tenantName,
          });
        } else {
          console.log(
            '🚫 No se emitió evento: shipment no editable o inexistente',
          );
        }
      }

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

  async update(
    id: ObjectId,
    updateProductDto: UpdateProductDto,
    tenantName: string,
    userId: string,
    ourOfficeEmail: string,
    session?: ClientSession,
    connection?: Connection,
  ) {
    console.log(`🔄 [update] DEBUG - Product ID: ${id}`);
    console.log(`🔄 [update] DEBUG - updateProductDto:`, {
      location: updateProductDto.location,
      assignedEmail: updateProductDto.assignedEmail,
      fp_shipment: updateProductDto.fp_shipment,
      actionType: updateProductDto.actionType,
      officeId: updateProductDto.officeId,
    });

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
      await this.normalizeFpShipmentFlag(
        id,
        updateProductDto,
        internalConnection,
        internalSession,
        tenantName,
      );

      // ✅ FIX: Usar la conexión interna en lugar de obtener una nueva
      const ProductModel = internalConnection.model(
        Product.name,
        ProductSchema,
      );

      const product = await ProductModel.findById(id).session(internalSession);

      if (!product) {
        console.error(
          '❌ Producto no encontrado en ProductModel con id:',
          id.toString(),
        );
      }

      // ✅ VALIDACIÓN: No permitir actualizar productos con shipment "On The Way"
      if (product && product.activeShipment) {
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

      // � RESINCRONIZACIÓN FINAL: Para productos con fp_shipment
      // NOTA: No resincronizar si el producto viene de moveToProductsCollection (reassign/return desde member)
      // porque ya se sincronizó en ese método
      const isFromMemberCollection =
        updateProductDto.actionType === 'reassign' ||
        updateProductDto.actionType === 'return';

      if (
        updateProductDto.fp_shipment &&
        result.updatedProduct &&
        !isFromMemberCollection
      ) {
        try {
          // Buscar el producto en la colección local para obtener el status final correcto
          const ProductModel = internalConnection.model(
            'Product',
            ProductSchema,
          );
          const localProduct = await ProductModel.findById(
            result.updatedProduct._id,
          );

          if (localProduct) {
            // Resincronizar con el status correcto después del shipment
            await this.assignmentsService.syncProductToGlobal(
              localProduct,
              tenantName,
              'products',
              undefined,
            );
          }
        } catch (error) {
          this.logger.error(
            `❌ [ProductsService] Final re-sync failed for product ${result.updatedProduct._id}:`,
            error,
          );
        }
      } else if (isFromMemberCollection) {
        this.logger.log(
          `⏭️ [ProductsService] Skipping final re-sync for product ${result.updatedProduct?._id} - already synced in moveToProductsCollection`,
        );
      }

      const response = {
        message: `Product with id "${id}" updated successfully`,
        shipment: result.shipment ?? null,
        updatedProduct: result.updatedProduct ?? null,
      };

      console.log('✅ [ProductsService.update] Returning response:', {
        hasShipment: !!response.shipment,
        hasUpdatedProduct: !!response.updatedProduct,
        productId: response.updatedProduct?._id,
        shipmentId: response.shipment?._id,
      });

      return response;
    } catch (error) {
      if (startedTransaction) {
        await internalSession.abortTransaction();
        internalSession.endSession();
      }

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
    // ✅ FIX: Usar la conexión proporcionada en lugar de obtener una nueva
    const ProductModel = connection.model(Product.name, ProductSchema);
    console.log('tenantName', tenantName);
    if (updateProductDto.fp_shipment === undefined) {
      const existingProduct =
        await ProductModel.findById(productId).session(session);

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
        // ✅ FIX: Usar la misma conexión para obtener el ProductModel
        const ProductModel = connection.model(
          Product.name,
          ProductSchema,
        ) as any;
        console.log(
          `🔍 [softDelete] Looking for product ${id} in products collection`,
        );
        const product = await ProductModel.findById(id).session(session);
        const changes: {
          oldData: Product | null;
          newData: Product | null;
        } = {
          oldData: null,
          newData: null,
        };

        if (product) {
          console.log(
            `✅ [softDelete] Product ${id} found in products collection`,
          );

          // ✅ VALIDACIÓN: No permitir eliminar productos con active shipment
          if (product.activeShipment) {
            console.error(
              `❌ [softDelete] Cannot delete product ${id} - has active shipment`,
            );
            throw new BadRequestException(
              'Cannot delete product that is part of an active shipment',
            );
          }

          product.status = 'Deprecated';
          product.lastSerialNumber = product.serialNumber || undefined;
          product.serialNumber = undefined;
          product.isDeleted = true;
          product.deletedAt = new Date(); // ✅ FIX: Establecer fecha de eliminación

          await product.save();

          await ProductModel.softDelete({ _id: id }, { session });

          // 🔄 SYNC: Marcar producto como eliminado en colección global

          await this.globalProductSyncService.markProductAsDeleted(
            tenantName, // Se corregirá automáticamente en GlobalProductSyncService
            id as any,
            product.lastSerialNumber, // Pasar el lastSerialNumber para sincronización
          );

          changes.oldData = product;
        } else {
          const memberProduct =
            await this.assignmentsService.getProductByMembers(
              id,
              connection,
              session,
            );
          console.log(
            `🔍 [softDelete] Member product search result: ${memberProduct ? 'Found' : 'Not found'}`,
          );

          if (memberProduct && memberProduct.product) {
            // ✅ VALIDACIÓN: No permitir eliminar productos con active shipment
            if (memberProduct.product.activeShipment) {
              throw new BadRequestException(
                'Cannot delete product that is part of an active shipment',
              );
            }

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
                  serialNumber: undefined,
                  lastSerialNumber: memberProduct.product.serialNumber,
                  lastAssigned: memberProduct.member.email,
                  status: 'Deprecated',
                  deletedAt: new Date(), // ✅ FIX: Establecer fecha de eliminación
                },
              ],
              { session },
            );

            await ProductModel.softDelete({ _id: id }, { session });

            // 🔄 SYNC: Marcar producto como eliminado en colección global

            await this.globalProductSyncService.markProductAsDeleted(
              tenantName,
              id as any,
              memberProduct.product.serialNumber || undefined, // Pasar el serialNumber original
            );

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

        // 📜 HISTORY: Crear registro con formato completo incluyendo country
        let memberCountry: string | undefined;

        // Si el producto estaba asignado a un member, obtener su country
        if (changes.oldData?.assignedEmail) {
          try {
            const member = await this.simpleFindByEmail(
              changes.oldData.assignedEmail,
              tenantName,
            );
            memberCountry = member?.country;
          } catch (error) {
            console.warn(
              'Could not find member for country in delete history:',
              error,
            );
          }
        }

        // Para productos en FP warehouse o Our office, el country ya está en fpWarehouse.warehouseCountryCode o office.officeCountryCode
        // El AssetHistoryFormatter.formatAssetData() se encargará de extraerlo automáticamente

        await recordEnhancedAssetHistory(
          this.historyService,
          'delete',
          userId,
          changes.oldData as ProductDocument, // oldProduct
          null, // newProduct
          undefined, // context
          undefined, // newMemberCountry
          memberCountry, // oldMemberCountry
        );

        await session.commitTransaction();

        session.endSession();

        // 🔔 Notificar al cliente mediante websocket sobre la eliminación del producto
        const tenant = await this.tenantsService.getByTenantName(tenantName);
        if (tenant && tenant._id) {
          this.eventsGateway.notifyTenant(
            tenant.tenantName.toString(),
            'data-changed',
            {
              data: {
                productId: id.toString(),
                message: `Product with id ${id} has been soft deleted`,
                timestamp: new Date().toISOString(),
              },
            },
          );
          this.logger.log(
            `🔔 Websocket notification sent for deleted product ${id} to tenant ${tenant._id}`,
          );
        }

        return { message: `Product with id ${id} has been soft deleted` };
      } catch (error) {
        console.error(`❌ [softDelete] Error deleting product ${id}:`, error);

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
