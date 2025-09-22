import { Injectable, Logger } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection, Types } from 'mongoose';
import {
  GlobalProduct,
  GlobalProductDocument,
} from '../schemas/global-product.schema';

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
    @InjectConnection('firstPlug')
    private firstPlugConnection: Connection,
  ) {}

  /**
   * Sincronizar un producto con la colección global
   */
  async syncProduct(params: SyncProductParams): Promise<void> {
    try {
      // Obtener el producto existente para comparar ubicaciones
      const existingProduct = await this.globalProductModel.findOne({
        tenantId: params.tenantId,
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
        tenantId: params.tenantId,
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
        fpWarehouse: params.fpWarehouse,
        memberData: params.memberData,

        // Metadatos
        sourceUpdatedAt: params.sourceUpdatedAt || new Date(),
        lastSyncedAt: new Date(),
      };

      await this.globalProductModel.updateOne(
        {
          tenantId: params.tenantId,
          originalProductId: params.originalProductId,
        },
        { $set: updateData },
        { upsert: true },
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
      await this.globalProductModel.updateOne(
        { tenantId, originalProductId },
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
    const synced = 0; // Placeholder - será reasignado cuando se implemente

    try {
      this.logger.log(`🔄 Starting sync for tenant ${tenantName}`);

      // TODO: Implementar conexión a tenant DB
      // Por ahora es un placeholder que necesita:
      // 1. TenantConnectionService para conectar a tenant DB
      // 2. ProductSchema y MemberSchema para los modelos
      // 3. Lógica para mapear datos del tenant al formato global

      this.logger.warn(`⚠️ syncTenantProducts not fully implemented yet`);
      this.logger.warn(
        `   This method needs TenantConnectionService integration`,
      );
      this.logger.warn(`   Use syncProduct() for individual product sync`);

      return { synced, errors };
    } catch (error) {
      this.logger.error(`❌ Error syncing tenant ${tenantName}:`, error);
      errors.push(`Tenant sync failed: ${error.message}`);
      return { synced, errors };
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
   * Calcular el valor de lastAssigned basado en cambios de ubicación
   */
  private calculateLastAssigned(
    existingProduct: GlobalProductDocument,
    newParams: SyncProductParams,
  ): string | undefined {
    const oldLocation = existingProduct.location;
    const newLocation = newParams.location;

    // Si no cambió la ubicación, mantener el lastAssigned actual
    if (oldLocation === newLocation) {
      return newParams.lastAssigned || existingProduct.lastAssigned;
    }

    // Si sale de un warehouse, registrar el warehouse como lastAssigned
    if (
      oldLocation === 'FP warehouse' &&
      existingProduct.fpWarehouse?.warehouseCountryCode
    ) {
      const countryCode = existingProduct.fpWarehouse.warehouseCountryCode;
      return `FP warehouse - ${countryCode}`;
    }

    // Si sale de Employee, registrar el email del member como lastAssigned
    if (oldLocation === 'Employee' && existingProduct.assignedEmail) {
      return existingProduct.assignedEmail;
    }

    // Para otros casos, usar el valor proporcionado o mantener el existente
    return newParams.lastAssigned || existingProduct.lastAssigned;
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
