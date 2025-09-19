import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Types, Connection, Schema } from 'mongoose';

// Schema para el índice global de productos
export interface GlobalProductIndex {
  _id?: Types.ObjectId;
  tenantId: string;
  productId: Types.ObjectId;
  name?: string;
  category: string;
  status: string;
  location: string;
  inFpWarehouse: boolean;
  warehouseId?: Types.ObjectId;
  warehouseCountryCode?: string;
  warehouseName?: string;
  isComputer: boolean;
  sourceUpdatedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable()
export class GlobalIndexService {
  private readonly logger = new Logger(GlobalIndexService.name);

  constructor(
    @InjectConnection('firstPlug') private firstPlugConnection: Connection,
  ) {}

  /**
   * Sincronizar un producto con el índice global
   */
  async syncProduct(params: {
    tenantId: string;
    productId: Types.ObjectId;
    name?: string;
    category: string;
    status: string;
    location: string;
    fpWarehouse?: {
      warehouseId?: Types.ObjectId;
      warehouseCountryCode?: string;
      warehouseName?: string;
      status?: 'STORED' | 'IN_TRANSIT';
    };
    sourceUpdatedAt?: Date;
  }): Promise<void> {
    try {
      const inFpWarehouse =
        params.location === 'FP warehouse' &&
        params.fpWarehouse?.status === 'STORED';
      const isComputer = params.category === 'Computer';

      // Obtener modelo del índice global
      const IndexModel = this.getGlobalIndexModel();

      await IndexModel.updateOne(
        { tenantId: params.tenantId, productId: params.productId },
        {
          $set: {
            name: params.name,
            category: params.category,
            status: params.status,
            location: params.location,
            inFpWarehouse,
            warehouseId: params.fpWarehouse?.warehouseId,
            warehouseCountryCode: params.fpWarehouse?.warehouseCountryCode,
            warehouseName: params.fpWarehouse?.warehouseName,
            isComputer,
            sourceUpdatedAt: params.sourceUpdatedAt ?? new Date(),
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );

      this.logger.debug(
        `📊 Synced product ${params.productId} from tenant ${params.tenantId} to global index`,
      );
    } catch (error) {
      this.logger.error(
        `Error syncing product ${params.productId} from tenant ${params.tenantId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Eliminar producto del índice global
   */
  async removeFromIndex(
    tenantId: string,
    productId: Types.ObjectId,
  ): Promise<void> {
    try {
      const IndexModel = this.getGlobalIndexModel();
      await IndexModel.deleteOne({ tenantId, productId });

      this.logger.debug(
        `🗑️  Removed product ${productId} from tenant ${tenantId} from global index`,
      );
    } catch (error) {
      this.logger.error(
        `Error removing product ${productId} from tenant ${tenantId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Migrar productos de un warehouse a otro en el índice global
   */
  async migrateWarehouse(
    countryCode: string,
    newWarehouseId: Types.ObjectId,
    newWarehouseName: string,
  ): Promise<number> {
    try {
      const IndexModel = this.getGlobalIndexModel();

      const result = await IndexModel.updateMany(
        {
          inFpWarehouse: true,
          warehouseCountryCode: countryCode,
        },
        {
          $set: {
            warehouseId: newWarehouseId,
            warehouseName: newWarehouseName,
            updatedAt: new Date(),
          },
        },
      );

      this.logger.log(
        `🚚 Migrated ${result.modifiedCount} products to new warehouse in global index`,
      );

      return result.modifiedCount;
    } catch (error) {
      this.logger.error(`Error migrating warehouse in global index:`, error);
      throw error;
    }
  }

  /**
   * Obtener métricas por warehouse
   */
  async getWarehouseMetrics(warehouseId: string): Promise<{
    total: number;
    computers: number;
    nonComputers: number;
    distinctTenants: number;
  }> {
    try {
      const IndexModel = this.getGlobalIndexModel();

      const pipeline = [
        {
          $match: {
            inFpWarehouse: true,
            warehouseId: new Types.ObjectId(warehouseId),
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            computers: { $sum: { $cond: ['$isComputer', 1, 0] } },
            nonComputers: { $sum: { $cond: ['$isComputer', 0, 1] } },
            tenants: { $addToSet: '$tenantId' },
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
      ];

      const [result] = await IndexModel.aggregate(pipeline);
      return (
        result ?? {
          total: 0,
          computers: 0,
          nonComputers: 0,
          distinctTenants: 0,
        }
      );
    } catch (error) {
      this.logger.error(`Error getting warehouse metrics:`, error);
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
      const IndexModel = this.getGlobalIndexModel();

      const pipeline = [
        {
          $match: {
            inFpWarehouse: true,
            warehouseCountryCode: countryCode,
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            computers: { $sum: { $cond: ['$isComputer', 1, 0] } },
            nonComputers: { $sum: { $cond: ['$isComputer', 0, 1] } },
            tenants: { $addToSet: '$tenantId' },
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
      ];

      const [result] = await IndexModel.aggregate(pipeline);
      return (
        result ?? {
          total: 0,
          computers: 0,
          nonComputers: 0,
          distinctTenants: 0,
        }
      );
    } catch (error) {
      this.logger.error(`Error getting country metrics:`, error);
      return { total: 0, computers: 0, nonComputers: 0, distinctTenants: 0 };
    }
  }

  /**
   * Obtener modelo del índice global
   */
  private getGlobalIndexModel() {
    // Definir schema dinámicamente si no existe
    if (!this.firstPlugConnection.models.GlobalProductIndex) {
      const schema = new Schema(
        {
          tenantId: { type: String, required: true },
          productId: { type: Schema.Types.ObjectId, required: true },
          name: { type: String },
          category: { type: String, required: true },
          status: { type: String, required: true },
          location: { type: String, required: true },
          inFpWarehouse: { type: Boolean, default: false },
          warehouseId: { type: Schema.Types.ObjectId },
          warehouseCountryCode: { type: String },
          warehouseName: { type: String },
          isComputer: { type: Boolean, default: false },
          sourceUpdatedAt: { type: Date },
        },
        {
          timestamps: true,
          collection: 'products_index',
        },
      );

      // Índices
      schema.index({ tenantId: 1, productId: 1 }, { unique: true });
      schema.index({ inFpWarehouse: 1, warehouseCountryCode: 1 });
      schema.index({ warehouseId: 1, inFpWarehouse: 1 });
      schema.index({ category: 1, inFpWarehouse: 1 });

      this.firstPlugConnection.model('GlobalProductIndex', schema);
    }

    return this.firstPlugConnection.model('GlobalProductIndex');
  }
}
