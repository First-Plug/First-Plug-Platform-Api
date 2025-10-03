import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Warehouse, WarehouseDocument } from '../schemas/warehouse.schema';
import {
  WarehouseMetrics,
  WarehouseMetricsDocument,
} from '../schemas/warehouse-metrics.schema';

export interface WarehouseMetricsResult {
  countryCode: string;
  country: string;
  warehouseId: string;
  warehouseName: string;
  isActive: boolean;
  totalProducts: number;
  computers: number;
  otherProducts: number;
  distinctTenants: number;
}

export interface TenantMetricsDetail {
  tenantId: string;
  tenantName: string;
  companyName: string;
  computers: number;
  otherProducts: number;
  totalProducts: number;
}

@Injectable()
export class WarehouseMetricsService {
  private readonly logger = new Logger(WarehouseMetricsService.name);

  constructor(
    @InjectModel(Warehouse.name, 'firstPlug')
    private warehouseModel: Model<WarehouseDocument>,
    @InjectModel(WarehouseMetrics.name, 'firstPlug')
    private warehouseMetricsModel: Model<WarehouseMetricsDocument>,
  ) {}

  // ==================== MÉTODOS DE ACTUALIZACIÓN INCREMENTAL ====================

  /**
   * Actualizar métricas cuando se agrega un producto al warehouse
   */
  async updateMetricsOnProductAdd(
    warehouseId: Types.ObjectId | string,
    tenantId: Types.ObjectId | string,
    tenantName: string,
    companyName: string,
    isComputer: boolean,
  ): Promise<void> {
    try {
      const warehouseObjectId =
        typeof warehouseId === 'string'
          ? new Types.ObjectId(warehouseId)
          : warehouseId;
      const tenantObjectId =
        typeof tenantId === 'string' ? new Types.ObjectId(tenantId) : tenantId;

      // Incrementar métricas del tenant específico
      const result = await this.warehouseMetricsModel.updateOne(
        {
          warehouseId: warehouseObjectId,
          'tenantMetrics.tenantId': tenantObjectId,
        },
        {
          $inc: {
            totalProducts: 1,
            totalComputers: isComputer ? 1 : 0,
            totalOtherProducts: isComputer ? 0 : 1,
            'tenantMetrics.$.totalProducts': 1,
            'tenantMetrics.$.computers': isComputer ? 1 : 0,
            'tenantMetrics.$.otherProducts': isComputer ? 0 : 1,
          },
          $set: {
            'tenantMetrics.$.lastUpdated': new Date(),
            lastCalculated: new Date(),
          },
        },
      );

      // Si no se actualizó ningún documento, el tenant no existe en el array
      if (result.matchedCount === 0) {
        // Verificar si el documento del warehouse existe
        const existingMetrics = await this.warehouseMetricsModel.findOne({
          warehouseId: warehouseObjectId,
        });

        if (existingMetrics) {
          // El warehouse existe, solo agregar el tenant
          await this.warehouseMetricsModel.updateOne(
            { warehouseId: warehouseObjectId },
            {
              $inc: {
                totalProducts: 1,
                totalComputers: isComputer ? 1 : 0,
                totalOtherProducts: isComputer ? 0 : 1,
                totalTenants: 1,
              },
              $push: {
                tenantMetrics: {
                  tenantId: tenantObjectId,
                  tenantName,
                  companyName,
                  totalProducts: 1,
                  computers: isComputer ? 1 : 0,
                  otherProducts: isComputer ? 0 : 1,
                  lastUpdated: new Date(),
                },
              },
              $set: {
                lastCalculated: new Date(),
              },
            },
          );
        } else {
          // El warehouse NO existe, necesitamos crear el documento completo con información del warehouse
          // Obtener información del warehouse desde la colección warehouses
          const warehousesCollection =
            this.warehouseMetricsModel.db.collection('warehouses');
          const warehouseDoc = await warehousesCollection.findOne({
            'warehouses._id': warehouseObjectId,
          });

          let countryCode = 'AR';
          let country = 'Argentina';
          let warehouseName = 'Default Warehouse';
          let partnerType = 'default';
          let isActive = false;

          if (warehouseDoc) {
            const warehouse = warehouseDoc.warehouses.find(
              (w: any) => w._id.toString() === warehouseObjectId.toString(),
            );
            if (warehouse) {
              countryCode = warehouseDoc.countryCode;
              country = warehouseDoc.country;
              warehouseName = warehouse.name || 'Default Warehouse';
              partnerType = warehouse.partnerType || 'default';
              isActive = warehouse.isActive || false;
            }
          }

          // Crear documento completo
          await this.warehouseMetricsModel.updateOne(
            { warehouseId: warehouseObjectId },
            {
              $setOnInsert: {
                warehouseId: warehouseObjectId,
                countryCode,
                country,
                warehouseName,
                partnerType,
                isActive,
              },
              $inc: {
                totalProducts: 1,
                totalComputers: isComputer ? 1 : 0,
                totalOtherProducts: isComputer ? 0 : 1,
                totalTenants: 1,
              },
              $push: {
                tenantMetrics: {
                  tenantId: tenantObjectId,
                  tenantName,
                  companyName,
                  totalProducts: 1,
                  computers: isComputer ? 1 : 0,
                  otherProducts: isComputer ? 0 : 1,
                  lastUpdated: new Date(),
                },
              },
              $set: {
                lastCalculated: new Date(),
              },
            },
            { upsert: true },
          );
        }
      }

      this.logger.debug(
        `✅ Metrics updated: +1 product to warehouse ${warehouseId} for tenant ${tenantName}`,
      );
    } catch (error) {
      this.logger.error(
        `Error updating metrics on product add: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Actualizar métricas cuando se remueve un producto del warehouse
   */
  async updateMetricsOnProductRemove(
    warehouseId: Types.ObjectId | string,
    tenantId: Types.ObjectId | string,
    isComputer: boolean,
  ): Promise<void> {
    try {
      const warehouseObjectId =
        typeof warehouseId === 'string'
          ? new Types.ObjectId(warehouseId)
          : warehouseId;
      const tenantObjectId =
        typeof tenantId === 'string' ? new Types.ObjectId(tenantId) : tenantId;

      // Decrementar métricas del tenant específico
      await this.warehouseMetricsModel.updateOne(
        {
          warehouseId: warehouseObjectId,
          'tenantMetrics.tenantId': tenantObjectId,
        },
        {
          $inc: {
            totalProducts: -1,
            totalComputers: isComputer ? -1 : 0,
            totalOtherProducts: isComputer ? 0 : -1,
            'tenantMetrics.$.totalProducts': -1,
            'tenantMetrics.$.computers': isComputer ? -1 : 0,
            'tenantMetrics.$.otherProducts': isComputer ? 0 : -1,
          },
          $set: {
            'tenantMetrics.$.lastUpdated': new Date(),
            lastCalculated: new Date(),
          },
        },
      );

      // Limpiar tenant si ya no tiene productos
      await this.warehouseMetricsModel.updateOne(
        { warehouseId: warehouseObjectId },
        {
          $pull: {
            tenantMetrics: { totalProducts: { $lte: 0 } },
          },
        },
      );

      // Recalcular totalTenants
      const metricsDoc = await this.warehouseMetricsModel.findOne({
        warehouseId: warehouseObjectId,
      });
      if (metricsDoc) {
        await this.warehouseMetricsModel.updateOne(
          { warehouseId: warehouseObjectId },
          {
            $set: {
              totalTenants: metricsDoc.tenantMetrics.length,
            },
          },
        );
      }

      this.logger.debug(
        `✅ Metrics updated: -1 product from warehouse ${warehouseId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error updating metrics on product remove: ${error.message}`,
        error.stack,
      );
    }
  }

  // ==================== MÉTODOS DE LECTURA ====================

  /**
   * Obtener métricas de un warehouse específico
   */
  async getWarehouseMetrics(
    warehouseId: Types.ObjectId | string,
  ): Promise<WarehouseMetricsDocument | null> {
    try {
      const warehouseObjectId =
        typeof warehouseId === 'string'
          ? new Types.ObjectId(warehouseId)
          : warehouseId;

      return await this.warehouseMetricsModel.findOne({
        warehouseId: warehouseObjectId,
      });
    } catch (error) {
      this.logger.error(`Error getting warehouse metrics: ${error.message}`);
      return null;
    }
  }

  /**
   * Obtener métricas de todos los warehouses
   */
  async getAllWarehouseMetrics(): Promise<WarehouseMetricsDocument[]> {
    try {
      return await this.warehouseMetricsModel.find({});
    } catch (error) {
      this.logger.error(
        `Error getting all warehouse metrics: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Obtener detalle de tenants para un warehouse específico
   */
  async getWarehouseTenantDetails(
    warehouseId: Types.ObjectId | string,
  ): Promise<TenantMetricsDetail[]> {
    try {
      const warehouseObjectId =
        typeof warehouseId === 'string'
          ? new Types.ObjectId(warehouseId)
          : warehouseId;

      const metrics = await this.warehouseMetricsModel.findOne({
        warehouseId: warehouseObjectId,
      });

      if (!metrics || !metrics.tenantMetrics) {
        return [];
      }

      return metrics.tenantMetrics.map((tm) => ({
        tenantId: tm.tenantId.toString(),
        tenantName: tm.tenantName,
        companyName: tm.companyName || tm.tenantName,
        computers: tm.computers,
        otherProducts: tm.otherProducts,
        totalProducts: tm.totalProducts,
      }));
    } catch (error) {
      this.logger.error(
        `Error getting warehouse tenant details: ${error.message}`,
      );
      return [];
    }
  }

  // ==================== MÉTODOS DE INICIALIZACIÓN ====================

  /**
   * Inicializar o actualizar métricas de un warehouse con información del warehouse
   */
  async initializeWarehouseMetrics(
    warehouseId: Types.ObjectId | string,
    countryCode: string,
    country: string,
    warehouseName: string,
    partnerType: string,
    isActive: boolean,
  ): Promise<void> {
    try {
      const warehouseObjectId =
        typeof warehouseId === 'string'
          ? new Types.ObjectId(warehouseId)
          : warehouseId;

      await this.warehouseMetricsModel.updateOne(
        { warehouseId: warehouseObjectId },
        {
          $setOnInsert: {
            warehouseId: warehouseObjectId,
            countryCode,
            country,
            warehouseName,
            partnerType,
            isActive,
            totalProducts: 0,
            totalComputers: 0,
            totalOtherProducts: 0,
            totalTenants: 0,
            tenantMetrics: [],
            lastCalculated: new Date(),
          },
        },
        { upsert: true },
      );

      this.logger.log(
        `✅ Warehouse metrics initialized for ${warehouseName} (${warehouseId})`,
      );
    } catch (error) {
      this.logger.error(
        `Error initializing warehouse metrics: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Recalcular métricas de un warehouse desde cero
   * (útil para corregir inconsistencias)
   */
  async recalculateWarehouseMetrics(
    warehouseId: Types.ObjectId | string,
    products: Array<{
      tenantId: Types.ObjectId | string;
      tenantName: string;
      companyName: string;
      isComputer: boolean;
    }>,
  ): Promise<void> {
    try {
      const warehouseObjectId =
        typeof warehouseId === 'string'
          ? new Types.ObjectId(warehouseId)
          : warehouseId;

      // Agrupar productos por tenant
      const tenantMap = new Map<
        string,
        {
          tenantId: Types.ObjectId;
          tenantName: string;
          companyName: string;
          computers: number;
          otherProducts: number;
          totalProducts: number;
        }
      >();

      for (const product of products) {
        const tenantObjectId =
          typeof product.tenantId === 'string'
            ? new Types.ObjectId(product.tenantId)
            : product.tenantId;
        const tenantKey = tenantObjectId.toString();

        if (!tenantMap.has(tenantKey)) {
          tenantMap.set(tenantKey, {
            tenantId: tenantObjectId,
            tenantName: product.tenantName,
            companyName: product.companyName,
            computers: 0,
            otherProducts: 0,
            totalProducts: 0,
          });
        }

        const tenantMetrics = tenantMap.get(tenantKey)!;
        tenantMetrics.totalProducts++;
        if (product.isComputer) {
          tenantMetrics.computers++;
        } else {
          tenantMetrics.otherProducts++;
        }
      }

      // Calcular totales
      const tenantMetrics = Array.from(tenantMap.values()).map((tm) => ({
        tenantId: tm.tenantId,
        tenantName: tm.tenantName,
        companyName: tm.companyName,
        totalProducts: tm.totalProducts,
        computers: tm.computers,
        otherProducts: tm.otherProducts,
        lastUpdated: new Date(),
      }));

      const totalProducts = products.length;
      const totalComputers = products.filter((p) => p.isComputer).length;
      const totalOtherProducts = totalProducts - totalComputers;
      const totalTenants = tenantMap.size;

      // Actualizar documento
      await this.warehouseMetricsModel.updateOne(
        { warehouseId: warehouseObjectId },
        {
          $set: {
            totalProducts,
            totalComputers,
            totalOtherProducts,
            totalTenants,
            tenantMetrics,
            lastCalculated: new Date(),
          },
        },
        { upsert: true },
      );

      this.logger.log(
        `✅ Warehouse metrics recalculated for ${warehouseId}: ${totalProducts} products, ${totalTenants} tenants`,
      );
    } catch (error) {
      this.logger.error(
        `Error recalculating warehouse metrics: ${error.message}`,
        error.stack,
      );
    }
  }
}
