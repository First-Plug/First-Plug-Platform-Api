import { Injectable, Logger } from '@nestjs/common';
import { GlobalProductSyncService } from '../../products/services/global-product-sync.service';
import { WarehousesService } from '../../warehouses/warehouses.service';

export interface GlobalWarehouseMetrics {
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

export interface GlobalCountryMetrics {
  countryCode: string;
  country: string;
  totalProducts: number;
  computers: number;
  nonComputers: number;
  distinctTenants: number;
  activeWarehouses: number;
}

/**
 * Servicio de SuperAdmin para métricas globales de warehouses
 * Conecta warehouses con productos globales para generar reportes
 */
@Injectable()
export class GlobalWarehouseMetricsService {
  private readonly logger = new Logger(GlobalWarehouseMetricsService.name);

  constructor(
    private readonly globalProductSyncService: GlobalProductSyncService,
    private readonly warehousesService: WarehousesService,
  ) {}

  /**
   * Obtener métricas completas de un warehouse específico
   */
  async getWarehouseMetrics(
    countryCode: string,
    warehouseId: string,
  ): Promise<GlobalWarehouseMetrics | null> {
    try {
      // 1. Obtener información del warehouse desde WarehousesService
      const warehouseInfo = await this.warehousesService.findWarehouseById(
        countryCode,
        warehouseId,
      );

      if (!warehouseInfo) {
        this.logger.warn(
          `Warehouse ${warehouseId} not found in ${countryCode}`,
        );
        return null;
      }

      // 2. Obtener métricas de productos desde GlobalProductSyncService
      const productMetrics =
        await this.globalProductSyncService.getWarehouseMetrics(warehouseId);

      // 3. Combinar información de ambos servicios
      return {
        countryCode,
        country: warehouseInfo.country,
        warehouseId,
        warehouseName: warehouseInfo.name,
        isActive: warehouseInfo.isActive,
        totalProducts: productMetrics.total,
        computers: productMetrics.computers,
        nonComputers: productMetrics.nonComputers,
        distinctTenants: productMetrics.distinctTenants,
      };
    } catch (error) {
      this.logger.error(
        `Error getting warehouse metrics for ${warehouseId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Obtener métricas de todos los warehouses activos
   */
  async getAllWarehouseMetrics(): Promise<GlobalWarehouseMetrics[]> {
    try {
      // 1. Obtener todos los warehouses activos
      const activeWarehouses =
        await this.warehousesService.findAllActiveWarehouses();

      const results: GlobalWarehouseMetrics[] = [];

      // 2. Para cada warehouse, obtener sus métricas
      for (const warehouse of activeWarehouses) {
        const metrics = await this.getWarehouseMetrics(
          warehouse.countryCode,
          warehouse.warehouseId,
        );

        if (metrics) {
          results.push(metrics);
        }
      }

      return results;
    } catch (error) {
      this.logger.error('Error getting all warehouse metrics:', error);
      return [];
    }
  }

  /**
   * Obtener métricas por país
   */
  async getCountryMetrics(
    countryCode: string,
  ): Promise<GlobalCountryMetrics | null> {
    try {
      // 1. Obtener información del país desde WarehousesService
      const countryInfo =
        await this.warehousesService.findByCountryCode(countryCode);

      if (!countryInfo) {
        this.logger.warn(`Country ${countryCode} not found`);
        return null;
      }

      // 2. Obtener métricas de productos desde GlobalProductSyncService
      const productMetrics =
        await this.globalProductSyncService.getCountryMetrics(countryCode);

      // 3. Contar warehouses activos
      const activeWarehouses = countryInfo.warehouses.filter(
        (w) => w.isActive && !w.isDeleted,
      ).length;

      return {
        countryCode,
        country: countryInfo.country,
        totalProducts: productMetrics.total,
        computers: productMetrics.computers,
        nonComputers: productMetrics.nonComputers,
        distinctTenants: productMetrics.distinctTenants,
        activeWarehouses,
      };
    } catch (error) {
      this.logger.error(
        `Error getting country metrics for ${countryCode}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Obtener estadísticas globales del sistema
   */
  async getGlobalOverview(): Promise<{
    totalProducts: number;
    totalTenants: number;
    productsInWarehouses: number;
    assignedProducts: number;
    availableProducts: number;
    totalCountries: number;
    totalActiveWarehouses: number;
  }> {
    try {
      // 1. Estadísticas de productos
      const productStats = await this.globalProductSyncService.getGlobalStats();

      // 2. Estadísticas de warehouses
      const allWarehouses = await this.warehousesService.findAll();
      const totalCountries = allWarehouses.length;
      const totalActiveWarehouses = allWarehouses.reduce(
        (count, country) =>
          count +
          country.warehouses.filter((w) => w.isActive && !w.isDeleted).length,
        0,
      );

      return {
        ...productStats,
        totalCountries,
        totalActiveWarehouses,
      };
    } catch (error) {
      this.logger.error('Error getting global overview:', error);
      return {
        totalProducts: 0,
        totalTenants: 0,
        productsInWarehouses: 0,
        assignedProducts: 0,
        availableProducts: 0,
        totalCountries: 0,
        totalActiveWarehouses: 0,
      };
    }
  }

  /**
   * Obtener métricas de productos por categoría
   */
  async getProductCategoryMetrics(): Promise<
    Array<{
      category: string;
      total: number;
      inWarehouses: number;
      assigned: number;
      available: number;
    }>
  > {
    try {
      // Esta funcionalidad se puede implementar más adelante
      // agregando métodos específicos en GlobalProductSyncService
      this.logger.warn('Product category metrics not implemented yet');
      return [];
    } catch (error) {
      this.logger.error('Error getting product category metrics:', error);
      return [];
    }
  }
}
