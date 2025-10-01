import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  GlobalProduct,
  GlobalProductDocument,
} from '../schemas/global-product.schema';
import { TenantConnectionService } from 'src/infra/db/tenant-connection.service';
import { ProductSchema } from '../schemas/product.schema';
import { MemberSchema } from 'src/members/schemas/member.schema';
import { WarehouseMetricsService } from 'src/warehouses/services/warehouse-metrics.service';

export interface SyncProductParams {
  tenantId: string;
  tenantName: string;
  originalProductId: Types.ObjectId;
  sourceCollection: 'products' | 'members';

  // Datos completos del producto
  name: string;
  category: string;
  status: string;
  location: string;
  attributes?: Array<{ key: string; value: string }>;
  serialNumber?: string;
  assignedEmail?: string;
  assignedMember?: string;
  lastAssigned?: string;
  acquisitionDate?: string;
  price?: {
    amount: number;
    currencyCode: string;
  };
  additionalInfo?: string;
  productCondition?: string;
  recoverable?: boolean;
  fp_shipment?: boolean;
  activeShipment?: boolean;
  imageUrl?: string;
  isDeleted?: boolean;
  createdBy?: string;

  // Datos específicos de ubicación
  fpWarehouse?: {
    warehouseId: Types.ObjectId;
    warehouseCountryCode: string;
    warehouseName: string;
    assignedAt?: Date;
    status?: 'STORED' | 'IN_TRANSIT_IN' | 'IN_TRANSIT_OUT';
  };

  memberData?: {
    memberId: Types.ObjectId;
    memberEmail: string;
    memberName: string;
    assignedAt?: Date;
  };

  sourceUpdatedAt?: Date;
}

@Injectable()
export class GlobalProductSyncService {
  private readonly logger = new Logger(GlobalProductSyncService.name);

  constructor(
    @InjectModel(GlobalProduct.name, 'firstPlug')
    private globalProductModel: Model<GlobalProductDocument>,
    private readonly tenantConnectionService: TenantConnectionService,
    private readonly warehouseMetricsService: WarehouseMetricsService,
  ) {}

  /**
   * Sincronizar un producto con la colección global
   */
  async syncProduct(params: SyncProductParams): Promise<void> {
    try {
      // Resolver tenantId real si viene como string
      let resolvedTenantId: any = params.tenantId;

      if (typeof params.tenantId === 'string') {
        // Buscar el tenant real por tenantName
        const tenantsCollection =
          this.globalProductModel.db.collection('tenants');
        const tenant = await tenantsCollection.findOne({
          tenantName: params.tenantId,
        });
        if (tenant) {
          resolvedTenantId = tenant._id;
        } else {
          this.logger.warn(
            `⚠️ [syncProduct] Could not find tenant with tenantName: ${params.tenantId}`,
          );
        }
      }

      // Obtener el producto existente para comparar ubicaciones
      const existingProduct = await this.globalProductModel.findOne({
        tenantId: resolvedTenantId,
        originalProductId: params.originalProductId,
      });

      // Calcular lastAssigned basado en cambios de ubicación
      let calculatedLastAssigned = params.lastAssigned;

      if (existingProduct) {
        calculatedLastAssigned = this.calculateLastAssigned(
          existingProduct,
          params,
        );
      }

      const updateData = {
        tenantId: resolvedTenantId,
        tenantName: params.tenantName,
        originalProductId: params.originalProductId,
        sourceCollection: params.sourceCollection,

        // Datos del producto
        name: params.name,
        category: params.category,
        status: params.status,
        location: params.location,
        attributes: params.attributes || [],
        serialNumber: params.serialNumber,
        assignedEmail: params.assignedEmail,
        assignedMember: params.assignedMember,
        lastAssigned: calculatedLastAssigned,
        acquisitionDate: params.acquisitionDate,
        price: params.price,
        additionalInfo: params.additionalInfo,
        productCondition: params.productCondition,
        recoverable: params.recoverable,
        fp_shipment: params.fp_shipment,
        activeShipment: params.activeShipment,
        imageUrl: params.imageUrl,
        isDeleted: params.isDeleted || false,

        // Datos de ubicación
        // ✅ FIX: Convertir undefined a null para que MongoDB elimine el campo
        fpWarehouse:
          params.fpWarehouse !== undefined ? params.fpWarehouse : null,
        memberData: params.memberData !== undefined ? params.memberData : null,

        // Campos calculados (porque updateOne no dispara pre('save') middleware)
        isComputer: params.category === 'Computer',
        inFpWarehouse: params.location === 'FP warehouse',
        isAssigned: params.location === 'Employee',

        // Metadatos
        sourceUpdatedAt: params.sourceUpdatedAt || new Date(),
        lastSyncedAt: new Date(),
      };

      await this.globalProductModel.updateOne(
        {
          tenantId: resolvedTenantId,
          originalProductId: params.originalProductId,
        },
        { $set: updateData },
        { upsert: true },
      );

      // ==================== ACTUALIZAR MÉTRICAS DE WAREHOUSE ====================
      await this.updateWarehouseMetrics(
        existingProduct,
        params,
        resolvedTenantId,
      );

      this.logger.debug(
        `✅ Synced product ${params.name} from tenant ${params.tenantName}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error syncing product ${params.originalProductId} from tenant ${params.tenantName}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Eliminar producto de la colección global
   */
  async removeProduct(
    tenantId: string,
    originalProductId: Types.ObjectId,
  ): Promise<void> {
    try {
      await this.globalProductModel.deleteOne({
        tenantId,
        originalProductId,
      });

      this.logger.debug(
        `🗑️ Removed product ${originalProductId} from tenant ${tenantId}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error removing product ${originalProductId} from tenant ${tenantId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Marcar producto como eliminado (soft delete)
   */
  async markProductAsDeleted(
    tenantId: string,
    originalProductId: Types.ObjectId,
  ): Promise<void> {
    try {
      // Resolver tenantId real si viene como string
      let resolvedTenantId: any = tenantId;
      if (typeof tenantId === 'string') {
        // Buscar el tenant real por tenantName
        const tenantsCollection =
          this.globalProductModel.db.collection('tenants');
        const tenant = await tenantsCollection.findOne({
          tenantName: tenantId,
        });
        if (tenant) {
          resolvedTenantId = tenant._id;
        }
      }

      await this.globalProductModel.updateOne(
        { tenantId: resolvedTenantId, originalProductId },
        {
          $set: {
            isDeleted: true,
            lastSyncedAt: new Date(),
          },
        },
      );

      this.logger.debug(
        `🗑️ Marked product ${originalProductId} as deleted in tenant ${tenantId}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error marking product as deleted ${originalProductId} from tenant ${tenantId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Sincronizar todos los productos de un tenant
   */
  async syncTenantProducts(tenantName: string): Promise<{
    synced: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let synced = 0;

    try {
      this.logger.log(`🔄 Starting sync for tenant ${tenantName}`);

      // 1. Obtener conexión al tenant
      const tenantConnection =
        await this.tenantConnectionService.getTenantConnection(tenantName);
      const ProductModel = tenantConnection.model('Product', ProductSchema);
      const MemberModel = tenantConnection.model('Member', MemberSchema);

      // 2. Sincronizar productos de la colección 'products'
      const products = await ProductModel.find({ isDeleted: { $ne: true } });
      for (const product of products) {
        try {
          // WAREHOUSE RESOLUTION: Si el producto tiene "FP warehouse", resolver warehouse
          let fpWarehouseData = product.fpWarehouse;

          if (product.location === 'FP warehouse' && !fpWarehouseData) {
            // Intentar resolver warehouse basado en el país del tenant o producto
            fpWarehouseData = await this.resolveWarehouseForProduct(
              product,
              tenantName,
            );
          }

          await this.syncProduct({
            tenantId: tenantName,
            tenantName: tenantName,
            originalProductId: product._id as any,
            sourceCollection: 'products',
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
            fpWarehouse:
              fpWarehouseData &&
              fpWarehouseData.warehouseId &&
              fpWarehouseData.warehouseCountryCode &&
              fpWarehouseData.warehouseName
                ? {
                    warehouseId: fpWarehouseData.warehouseId as any,
                    warehouseCountryCode: fpWarehouseData.warehouseCountryCode,
                    warehouseName: fpWarehouseData.warehouseName,
                    assignedAt: fpWarehouseData.assignedAt,
                    status:
                      fpWarehouseData.status === 'IN_TRANSIT'
                        ? 'IN_TRANSIT_IN'
                        : (fpWarehouseData.status as any),
                  }
                : undefined,
            sourceUpdatedAt: (product as any).updatedAt || new Date(),
          });
          synced++;
        } catch (error) {
          errors.push(`Product ${product._id}: ${error.message}`);
        }
      }

      // 3. Sincronizar productos de la colección 'members'
      const members = await MemberModel.find({
        'products.0': { $exists: true },
      });
      for (const member of members) {
        for (const product of member.products) {
          try {
            await this.syncProduct({
              tenantId: tenantName,
              tenantName: tenantName,
              originalProductId: product._id as any,
              sourceCollection: 'members',
              name: product.name || '',
              category: product.category,
              status: product.status,
              location: 'Employee',
              attributes:
                product.attributes?.map((attr: any) => ({
                  key: attr.key,
                  value: String(attr.value),
                })) || [],
              serialNumber: product.serialNumber || undefined,
              assignedEmail: member.email,
              assignedMember: `${member.firstName} ${member.lastName}`,
              lastAssigned: product.lastAssigned,
              acquisitionDate: product.acquisitionDate,
              price: product.price,
              additionalInfo: product.additionalInfo,
              productCondition: product.productCondition,
              recoverable: product.recoverable,
              fp_shipment: product.fp_shipment,
              activeShipment: product.activeShipment,
              memberData: {
                memberId: member._id as any,
                memberEmail: member.email,
                memberName: `${member.firstName} ${member.lastName}`,
                assignedAt:
                  (product as any).assignedAt || (member as any).updatedAt,
              },
              sourceUpdatedAt:
                (product as any).updatedAt || (member as any).updatedAt,
            });
            synced++;
          } catch (error) {
            errors.push(`Member product ${product._id}: ${error.message}`);
          }
        }
      }

      this.logger.log(`✅ Synced ${synced} products from tenant ${tenantName}`);
      return { synced, errors };
    } catch (error) {
      this.logger.error(`❌ Error syncing tenant ${tenantName}:`, error);
      errors.push(`Tenant sync failed: ${error.message}`);
      return { synced, errors };
    }
  }

  /**
   * Resolver warehouse para productos con "FP warehouse"
   */
  private async resolveWarehouseForProduct(
    product: any,
    tenantName: string,
  ): Promise<any> {
    console.log(tenantName);
    try {
      // Por ahora, devolver null - la lógica de warehouse se implementará después
      // TODO: Integrar con WarehousesService para resolver warehouse por país
      this.logger.debug(
        `⚠️ Product ${product._id} has "FP warehouse" but no warehouse data - will be resolved later`,
      );
      return null;
    } catch (error) {
      this.logger.error(
        `Error resolving warehouse for product ${product._id}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Obtener productos de la colección global con paginación
   */
  async getGlobalProducts(
    limit: number = 100,
    skip: number = 0,
  ): Promise<any[]> {
    try {
      return await this.globalProductModel
        .find()
        .sort({ lastSyncedAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean()
        .exec();
    } catch (error) {
      this.logger.error('Error getting global products:', error);
      throw error;
    }
  }

  /**
   * Obtener total de productos en la colección global
   */
  async getTotalGlobalProducts(): Promise<number> {
    try {
      return await this.globalProductModel.countDocuments();
    } catch (error) {
      this.logger.error('Error counting global products:', error);
      throw error;
    }
  }

  /**
   * Obtener métricas de warehouse
   */
  async getWarehouseMetrics(warehouseId: string): Promise<{
    total: number;
    computers: number;
    nonComputers: number;
    distinctTenants: number;
  }> {
    try {
      const [result] = await this.globalProductModel.aggregate([
        {
          $match: {
            inFpWarehouse: true,
            'fpWarehouse.warehouseId': new Types.ObjectId(warehouseId),
            isDeleted: { $ne: true },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            computers: { $sum: { $cond: ['$isComputer', 1, 0] } },
            nonComputers: { $sum: { $cond: ['$isComputer', 0, 1] } },
            tenants: { $addToSet: '$tenantName' },
          },
        },
        {
          $project: {
            _id: 0,
            total: 1,
            computers: 1,
            nonComputers: 1,
            distinctTenants: { $size: '$tenants' },
          },
        },
      ]);

      return (
        result || {
          total: 0,
          computers: 0,
          nonComputers: 0,
          distinctTenants: 0,
        }
      );
    } catch (error) {
      this.logger.error(`❌ Error getting warehouse metrics:`, error);
      return { total: 0, computers: 0, nonComputers: 0, distinctTenants: 0 };
    }
  }

  /**
   * Obtener métricas por país
   */
  async getCountryMetrics(countryCode: string): Promise<{
    total: number;
    computers: number;
    nonComputers: number;
    distinctTenants: number;
  }> {
    try {
      const [result] = await this.globalProductModel.aggregate([
        {
          $match: {
            inFpWarehouse: true,
            'fpWarehouse.warehouseCountryCode': countryCode,
            isDeleted: { $ne: true },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            computers: { $sum: { $cond: ['$isComputer', 1, 0] } },
            nonComputers: { $sum: { $cond: ['$isComputer', 0, 1] } },
            tenants: { $addToSet: '$tenantName' },
          },
        },
        {
          $project: {
            _id: 0,
            total: 1,
            computers: 1,
            nonComputers: 1,
            distinctTenants: { $size: '$tenants' },
          },
        },
      ]);

      return (
        result || {
          total: 0,
          computers: 0,
          nonComputers: 0,
          distinctTenants: 0,
        }
      );
    } catch (error) {
      this.logger.error(`❌ Error getting country metrics:`, error);
      return { total: 0, computers: 0, nonComputers: 0, distinctTenants: 0 };
    }
  }

  /**
   * Obtener estadísticas generales
   */
  async getGlobalStats(): Promise<{
    totalProducts: number;
    totalTenants: number;
    productsInWarehouses: number;
    assignedProducts: number;
    availableProducts: number;
  }> {
    try {
      const [result] = await this.globalProductModel.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            tenants: { $addToSet: '$tenantName' },
            productsInWarehouses: {
              $sum: { $cond: ['$inFpWarehouse', 1, 0] },
            },
            assignedProducts: {
              $sum: { $cond: ['$isAssigned', 1, 0] },
            },
            availableProducts: {
              $sum: {
                $cond: [{ $eq: ['$location', 'Our office'] }, 1, 0],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            totalProducts: 1,
            totalTenants: { $size: '$tenants' },
            productsInWarehouses: 1,
            assignedProducts: 1,
            availableProducts: 1,
          },
        },
      ]);

      return (
        result || {
          totalProducts: 0,
          totalTenants: 0,
          productsInWarehouses: 0,
          assignedProducts: 0,
          availableProducts: 0,
        }
      );
    } catch (error) {
      this.logger.error(`❌ Error getting global stats:`, error);
      return {
        totalProducts: 0,
        totalTenants: 0,
        productsInWarehouses: 0,
        assignedProducts: 0,
        availableProducts: 0,
      };
    }
  }

  /**
   * Actualizar métricas de warehouse cuando un producto cambia de ubicación
   */
  private async updateWarehouseMetrics(
    existingProduct: GlobalProductDocument | null,
    newParams: SyncProductParams,
    tenantId: Types.ObjectId,
  ): Promise<void> {
    try {
      const oldLocation = existingProduct?.location;
      const newLocation = newParams.location;
      const isComputer = newParams.category === 'Computer';

      // Obtener companyName del tenant
      const tenantsCollection =
        this.globalProductModel.db.collection('tenants');
      const tenant = await tenantsCollection.findOne({ _id: tenantId });
      const companyName = tenant?.name || newParams.tenantName;

      // CASO 1: Producto ENTRA a FP warehouse
      if (newLocation === 'FP warehouse' && oldLocation !== 'FP warehouse') {
        if (newParams.fpWarehouse?.warehouseId) {
          await this.warehouseMetricsService.updateMetricsOnProductAdd(
            newParams.fpWarehouse.warehouseId,
            tenantId,
            newParams.tenantName,
            companyName,
            isComputer,
          );
          this.logger.debug(
            `📊 Metrics updated: Product added to warehouse ${newParams.fpWarehouse.warehouseId}`,
          );
        }
      }

      // CASO 2: Producto SALE de FP warehouse
      if (oldLocation === 'FP warehouse' && newLocation !== 'FP warehouse') {
        if (existingProduct?.fpWarehouse?.warehouseId) {
          await this.warehouseMetricsService.updateMetricsOnProductRemove(
            existingProduct.fpWarehouse.warehouseId as any,
            tenantId,
            existingProduct.isComputer,
          );
          this.logger.debug(
            `📊 Metrics updated: Product removed from warehouse ${existingProduct.fpWarehouse.warehouseId}`,
          );
        }
      }

      // CASO 3: Producto CAMBIA de warehouse (raro, pero posible)
      if (
        oldLocation === 'FP warehouse' &&
        newLocation === 'FP warehouse' &&
        existingProduct?.fpWarehouse?.warehouseId &&
        newParams.fpWarehouse?.warehouseId &&
        existingProduct.fpWarehouse.warehouseId.toString() !==
          newParams.fpWarehouse.warehouseId.toString()
      ) {
        // Remover del warehouse anterior
        await this.warehouseMetricsService.updateMetricsOnProductRemove(
          existingProduct.fpWarehouse.warehouseId as any,
          tenantId,
          existingProduct.isComputer,
        );

        // Agregar al warehouse nuevo
        await this.warehouseMetricsService.updateMetricsOnProductAdd(
          newParams.fpWarehouse.warehouseId,
          tenantId,
          newParams.tenantName,
          companyName,
          isComputer,
        );

        this.logger.debug(
          `📊 Metrics updated: Product moved between warehouses`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error updating warehouse metrics: ${error.message}`,
        error.stack,
      );
      // No lanzar error para no interrumpir la sincronización
    }
  }

  /**
   * Calcular el valor de lastAssigned basado en cambios de ubicación
   *
   * REGLA: lastAssigned debe reflejar el member inmediatamente anterior,
   * no preservar historial completo. Debe ser consistente con la colección
   * de productos del tenant.
   */
  private calculateLastAssigned(
    existingProduct: GlobalProductDocument,
    newParams: SyncProductParams,
  ): string | undefined {
    const oldLocation = existingProduct.location;
    const newLocation = newParams.location;

    // CASO 1: Si sale de Employee (member) hacia cualquier otro lugar
    // → Guardar el email del member como lastAssigned
    if (oldLocation === 'Employee' && newLocation !== 'Employee') {
      return existingProduct.assignedEmail || existingProduct.lastAssigned;
    }

    // CASO 2: Para todos los demás casos (incluyendo asignación a nuevo member)
    // → Usar el valor que viene del tenant (params.lastAssigned)
    // Esto asegura consistencia con la colección de productos del tenant
    return newParams.lastAssigned;
  }

  /**
   * MÉTODO PARA IMPLEMENTAR EN EL FUTURO:
   * Sincronización completa de un tenant con conexión real a su DB
   */
  /*
  async syncTenantProductsComplete(tenantName: string): Promise<{
    synced: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let synced = 0;

    try {
      // 1. Obtener conexión al tenant
      const tenantConnection = await this.tenantConnectionService.getTenantConnection(tenantName);
      const ProductModel = tenantConnection.model('Product', ProductSchema);
      const MemberModel = tenantConnection.model('Member', MemberSchema);

      // 2. Sincronizar productos de la colección 'products'
      const products = await ProductModel.find({ isDeleted: { $ne: true } });
      for (const product of products) {
        try {
          await this.syncProduct({
            tenantId: tenantName,
            tenantName: tenantName,
            originalProductId: product._id,
            sourceCollection: 'products',
            name: product.name,
            category: product.category,
            status: product.status,
            location: product.location,
            attributes: product.attributes || [],
            serialNumber: product.serialNumber,
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
            fpWarehouse: product.fpWarehouse,
            sourceUpdatedAt: product.updatedAt,
          });
          synced++;
        } catch (error) {
          errors.push(`Product ${product._id}: ${error.message}`);
        }
      }

      // 3. Sincronizar productos de la colección 'members'
      const members = await MemberModel.find({ 'products.0': { $exists: true } });
      for (const member of members) {
        for (const product of member.products) {
          try {
            await this.syncProduct({
              tenantId: tenantName,
              tenantName: tenantName,
              originalProductId: product._id,
              sourceCollection: 'members',
              name: product.name,
              category: product.category,
              status: product.status,
              location: 'Employee', // Siempre Employee en members
              attributes: product.attributes || [],
              serialNumber: product.serialNumber,
              assignedEmail: member.email,
              assignedMember: `${member.firstName} ${member.lastName}`,
              lastAssigned: product.lastAssigned,
              acquisitionDate: product.acquisitionDate,
              price: product.price,
              additionalInfo: product.additionalInfo,
              productCondition: product.productCondition,
              recoverable: product.recoverable,
              fp_shipment: product.fp_shipment,
              activeShipment: product.activeShipment,
              memberData: {
                memberId: member._id,
                memberEmail: member.email,
                memberName: `${member.firstName} ${member.lastName}`,
                assignedAt: product.assignedAt || member.updatedAt,
              },
              sourceUpdatedAt: product.updatedAt || member.updatedAt,
            });
            synced++;
          } catch (error) {
            errors.push(`Member product ${product._id}: ${error.message}`);
          }
        }
      }

      this.logger.log(`✅ Synced ${synced} products from tenant ${tenantName}`);
      return { synced, errors };
    } catch (error) {
      this.logger.error(`❌ Error syncing tenant ${tenantName}:`, error);
      errors.push(`Tenant sync failed: ${error.message}`);
      return { synced, errors };
    }
  }
  */
}
