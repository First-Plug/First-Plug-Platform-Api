import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import {
  GlobalProduct,
  GlobalProductDocument,
} from 'src/products/schemas/global-product.schema';
import { TenantModelRegistry } from 'src/infra/db/tenant-model-registry';

interface WarehouseDataUpdate {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  email?: string;
  phone?: string;
  contactPerson?: string;
}

interface SyncResult {
  globalProductsUpdated: number;
  tenantProductsUpdated: number;
  affectedTenants: number;
  totalProductsUpdated: number;
  errors?: string[];
}

@Injectable()
export class WarehouseProductSyncService {
  private readonly logger = new Logger(WarehouseProductSyncService.name);

  constructor(
    @InjectModel(GlobalProduct.name, 'firstPlug')
    private globalProductModel: Model<GlobalProductDocument>,
    @InjectConnection('firstPlug')
    private firstPlugConnection: Connection,
    private readonly tenantModelRegistry: TenantModelRegistry,
  ) {}

  /**
   * Sincronizar datos de warehouse a todos los productos que estén almacenados en ese warehouse
   */
  async syncWarehouseDataToProducts(
    warehouseId: string,
    countryCode: string,
    newData: WarehouseDataUpdate,
    updatedFields: string[],
  ): Promise<SyncResult> {
    const result: SyncResult = {
      globalProductsUpdated: 0,
      tenantProductsUpdated: 0,
      affectedTenants: 0,
      totalProductsUpdated: 0,
      errors: [],
    };

    try {
      this.logger.log(
        `🔄 Starting warehouse data sync for warehouse ${warehouseId}`,
        {
          warehouseId,
          countryCode,
          updatedFields,
          newData,
        },
      );

      // 1. Actualizar productos en la colección global
      const globalResult = await this.syncGlobalProducts(
        warehouseId,
        newData,
        updatedFields,
      );
      result.globalProductsUpdated = globalResult;

      // 2. Obtener lista de tenants que tienen productos en este warehouse
      const affectedTenants =
        await this.getTenantsWithProductsInWarehouse(warehouseId);
      result.affectedTenants = affectedTenants.length;

      this.logger.log(
        `📋 Found ${affectedTenants.length} tenants with products in warehouse ${warehouseId}`,
        { tenants: affectedTenants },
      );

      // 3. Actualizar productos en cada tenant
      for (const tenantName of affectedTenants) {
        try {
          const tenantResult = await this.syncTenantProducts(
            tenantName,
            warehouseId,
            newData,
            updatedFields,
          );
          result.tenantProductsUpdated += tenantResult;
        } catch (error) {
          const errorMsg = `Failed to sync products for tenant ${tenantName}: ${error.message}`;
          this.logger.error(errorMsg, error.stack);
          result.errors?.push(errorMsg);
        }
      }

      result.totalProductsUpdated =
        result.globalProductsUpdated + result.tenantProductsUpdated;

      this.logger.log(
        `✅ Warehouse data sync completed for warehouse ${warehouseId}`,
        result,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `❌ Failed to sync warehouse data for warehouse ${warehouseId}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Actualizar productos en la colección global
   */
  private async syncGlobalProducts(
    warehouseId: string,
    newData: WarehouseDataUpdate,
    updatedFields: string[],
  ): Promise<number> {
    try {
      // Construir el objeto de actualización solo con los campos que cambiaron
      const updateObject: any = {};

      updatedFields.forEach((field) => {
        if (field === 'name' && newData.name !== undefined) {
          updateObject['fpWarehouse.warehouseName'] = newData.name;
        }
        // Agregar otros campos si es necesario en el futuro
      });

      if (Object.keys(updateObject).length === 0) {
        this.logger.debug('No relevant fields to update in global products');
        return 0;
      }

      const result = await this.globalProductModel.updateMany(
        {
          'fpWarehouse.warehouseId': warehouseId,
          location: 'FP warehouse',
          isDeleted: { $ne: true },
        },
        {
          $set: {
            ...updateObject,
            updatedAt: new Date(),
            lastSyncedAt: new Date(),
          },
        },
      );

      this.logger.log(
        `📦 Updated ${result.modifiedCount} products in global collection`,
        { warehouseId, updateObject },
      );

      return result.modifiedCount;
    } catch (error) {
      this.logger.error('Failed to sync global products', error.stack);
      throw error;
    }
  }

  /**
   * Obtener lista de tenants que tienen productos en este warehouse
   */
  private async getTenantsWithProductsInWarehouse(
    warehouseId: string,
  ): Promise<string[]> {
    try {
      const tenants = await this.globalProductModel.distinct('tenantName', {
        'fpWarehouse.warehouseId': warehouseId,
        location: 'FP warehouse',
        isDeleted: { $ne: true },
      });

      return tenants.filter((tenant) => tenant && tenant.trim() !== '');
    } catch (error) {
      this.logger.error('Failed to get affected tenants', error.stack);
      throw error;
    }
  }

  /**
   * Actualizar productos en la colección de un tenant específico
   */
  private async syncTenantProducts(
    tenantName: string,
    warehouseId: string,
    newData: WarehouseDataUpdate,
    updatedFields: string[],
  ): Promise<number> {
    try {
      // Construir el objeto de actualización
      const updateObject: any = {};

      updatedFields.forEach((field) => {
        if (field === 'name' && newData.name !== undefined) {
          updateObject['fpWarehouse.warehouseName'] = newData.name;
        }
        // Agregar otros campos si es necesario en el futuro
      });

      if (Object.keys(updateObject).length === 0) {
        return 0;
      }

      // Obtener modelo de productos del tenant
      const ProductModel =
        await this.tenantModelRegistry.getProductModel(tenantName);

      const result = await ProductModel.updateMany(
        {
          'fpWarehouse.warehouseId': warehouseId,
          location: 'FP warehouse',
          isDeleted: { $ne: true },
        },
        {
          $set: {
            ...updateObject,
            updatedAt: new Date(),
          },
        },
      );

      this.logger.log(
        `🏢 Updated ${result.modifiedCount} products for tenant ${tenantName}`,
        { tenantName, warehouseId, updateObject },
      );

      return result.modifiedCount;
    } catch (error) {
      this.logger.error(
        `Failed to sync products for tenant ${tenantName}`,
        error.stack,
      );
      throw error;
    }
  }
}
