import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Warehouse, WarehouseDocument } from '../schemas/warehouse.schema';
import { GlobalIndexService } from './global-index.service';

export interface WarehouseMetricsResult {
  countryCode: string;
  country: string;
  warehouseId: string;
  warehouseName: string;
  isActive: boolean;
  totalProducts: number;
  computers: number;
  nonComputers: number;
  distinctTenants: number;
}

@Injectable()
export class WarehouseMetricsService {
  private readonly logger = new Logger(WarehouseMetricsService.name);

  constructor(
    @InjectModel(Warehouse.name, 'firstPlug')
    private warehouseModel: Model<WarehouseDocument>,
    private globalIndexService: GlobalIndexService,
  ) {}

  /**
   * Obtener métricas para un warehouse específico
   */
  async getWarehouseMetrics(
    countryCode: string,
    warehouseId: string,
  ): Promise<WarehouseMetricsResult | null> {
    try {
      // 1. Obtener información del warehouse
      const warehouseDoc = await this.warehouseModel.findOne({ countryCode });
      if (!warehouseDoc) {
        this.logger.warn(
          `Warehouse not found for country code: ${countryCode}`,
        );
        return null;
      }

      const warehouse = warehouseDoc.warehouses.find(
        (w) => w._id.toString() === warehouseId,
      );
      if (!warehouse) {
        this.logger.warn(
          `Warehouse ${warehouseId} not found in ${countryCode}`,
        );
        return null;
      }

      // 2. Obtener métricas del índice global
      const metrics =
        await this.globalIndexService.getWarehouseMetrics(warehouseId);

      return {
        countryCode,
        country: warehouseDoc.country,
        warehouseId,
        warehouseName: warehouse.name || 'Unnamed Warehouse',
        isActive: warehouse.isActive,
        totalProducts: metrics.total,
        computers: metrics.computers,
        nonComputers: metrics.nonComputers,
        distinctTenants: metrics.distinctTenants,
      };
    } catch (error) {
      this.logger.error(`Error getting warehouse metrics:`, error);
      return null;
    }
  }

  /**
   * Obtener métricas para todos los warehouses activos
   */
  async getAllWarehouseMetrics(): Promise<WarehouseMetricsResult[]> {
    try {
      const activeWarehouses = await this.warehouseModel.find({
        hasActiveWarehouse: true,
      });

      const results: WarehouseMetricsResult[] = [];

      for (const countryDoc of activeWarehouses) {
        const activeWarehouse = countryDoc.warehouses.find(
          (w) => w.isActive && !w.isDeleted,
        );

        if (activeWarehouse) {
          const metrics = await this.getWarehouseMetrics(
            countryDoc.countryCode,
            activeWarehouse._id.toString(),
          );

          if (metrics) {
            results.push(metrics);
          }
        }
      }

      return results;
    } catch (error) {
      this.logger.error(`Error getting all warehouse metrics:`, error);
      return [];
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
      return await this.globalIndexService.getCountryMetrics(countryCode);
    } catch (error) {
      this.logger.error(`Error getting country metrics:`, error);
      return { total: 0, computers: 0, nonComputers: 0, distinctTenants: 0 };
    }
  }
}
