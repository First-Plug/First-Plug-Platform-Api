import { Injectable, Logger } from '@nestjs/common';
import { GlobalProductSyncService } from '../../products/services/global-product-sync.service';
import { WarehousesService } from '../../warehouses/warehouses.service';

export interface GlobalWarehouseMetrics {
  countryCode: string;
  country: string;
  warehouseId: string;
  warehouseName: string;
  partnerType: string;
  isActive: boolean;
  totalProducts: number;
  computers: number;
  otherProducts: number;
  distinctTenants: number;
}

export interface GlobalWarehouseMetricsWithDetails
  extends GlobalWarehouseMetrics {
  // Datos completos del warehouse para edición
  address: string;
  apartment: string;
  city: string;
  state: string;
  zipCode: string;
  email: string;
  phone: string;
  contactPerson: string;
  canal: string;
  additionalInfo: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantMetricsDetail {
  tenantId: string;
  tenantName: string;
  companyName: string;
  computers: number;
  otherProducts: number;
  totalProducts: number;
}

export interface WarehouseWithTenants
  extends GlobalWarehouseMetricsWithDetails {
  tenants: TenantMetricsDetail[];
  hasStoredProducts: boolean; // Para habilitar/deshabilitar acciones (ej: no borrar si tiene productos)
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
 * Usa agregaciones en tiempo real desde global_products
 */
@Injectable()
export class GlobalWarehouseMetricsService {
  private readonly logger = new Logger(GlobalWarehouseMetricsService.name);

  constructor(
    private readonly globalProductSyncService: GlobalProductSyncService,
    private readonly warehousesService: WarehousesService,
  ) {}

  /**
   * Obtener métricas completas de un warehouse específico (usa agregaciones en tiempo real)
   */
  async getWarehouseMetrics(
    countryCode: string,
    warehouseId: string,
  ): Promise<GlobalWarehouseMetrics | null> {
    try {
      // Obtener métricas en tiempo real
      const metrics =
        await this.warehousesService.getWarehouseMetricsRealTime(warehouseId);

      if (!metrics) {
        this.logger.warn(
          `Warehouse metrics not found for ${warehouseId} in ${countryCode}`,
        );
        return null;
      }

      return {
        countryCode: metrics.countryCode,
        country: metrics.country,
        warehouseId: metrics.warehouseId,
        warehouseName: metrics.warehouseName,
        partnerType: metrics.partnerType || 'FirstPlug',
        isActive: metrics.isActive,
        totalProducts: metrics.totalProducts,
        computers: metrics.totalComputers,
        otherProducts: metrics.totalOtherProducts,
        distinctTenants: metrics.totalTenants,
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
   * Obtener métricas de todos los warehouses (usa agregaciones en tiempo real)
   */
  async getAllWarehouseMetrics(): Promise<GlobalWarehouseMetrics[]> {
    try {
      // Obtener todas las métricas en tiempo real
      const allMetrics =
        await this.warehousesService.getAllWarehouseMetricsRealTime();

      return allMetrics.map((metrics) => ({
        countryCode: metrics.countryCode,
        country: metrics.country,
        warehouseId: metrics.warehouseId,
        warehouseName: metrics.warehouseName,
        partnerType: metrics.partnerType || 'FirstPlug',
        isActive: metrics.isActive,
        totalProducts: metrics.totalProducts,
        computers: metrics.totalComputers,
        otherProducts: metrics.totalOtherProducts,
        distinctTenants: metrics.totalTenants,
      }));
    } catch (error) {
      this.logger.error('Error getting all warehouse metrics:', error);
      return [];
    }
  }

  /**
   * Obtener TODOS los warehouses CON detalle de tenants
   * Incluye warehouses con y sin productos
   * Ordenados: primero los que tienen productos, luego los vacíos
   * OPTIMIZADO: Una sola query para warehouses con productos
   */
  async getAllWarehousesWithTenants(): Promise<WarehouseWithTenants[]> {
    try {
      // 1. Obtener métricas de warehouses que TIENEN productos (rápido)
      const warehousesWithProducts =
        await this.warehousesService.getAllWarehouseMetricsRealTime();

      // Crear Map para búsqueda rápida por warehouseId
      const metricsMap = new Map(
        warehousesWithProducts.map((m) => [m.warehouseId, m]),
      );

      // 2. Obtener TODOS los países con sus warehouses
      const allCountries = await this.warehousesService.findAll();

      const warehousesWithTenants: WarehouseWithTenants[] = [];

      // 3. Iterar sobre cada país y cada warehouse
      for (const countryDoc of allCountries) {
        for (const warehouse of countryDoc.warehouses) {
          // Saltar warehouses eliminados
          if (warehouse.isDeleted) {
            continue;
          }

          const warehouseId = warehouse._id.toString();
          const metrics = metricsMap.get(warehouseId);

          // 4. Si tiene métricas (tiene productos), usar esos datos + datos completos del warehouse
          if (metrics) {
            warehousesWithTenants.push({
              countryCode: metrics.countryCode,
              country: metrics.country,
              warehouseId: metrics.warehouseId,
              warehouseName: metrics.warehouseName,
              partnerType: metrics.partnerType || 'FirstPlug',
              isActive: metrics.isActive,
              totalProducts: metrics.totalProducts,
              computers: metrics.totalComputers,
              otherProducts: metrics.totalOtherProducts,
              distinctTenants: metrics.totalTenants,
              // Datos completos del warehouse
              address: warehouse.address || '',
              apartment: warehouse.apartment || '',
              city: warehouse.city || '',
              state: warehouse.state || '',
              zipCode: warehouse.zipCode || '',
              email: warehouse.email || '',
              phone: warehouse.phone || '',
              contactPerson: warehouse.contactPerson || '',
              canal: warehouse.canal || '',
              additionalInfo: warehouse.additionalInfo || '',
              isDeleted: warehouse.isDeleted || false,
              createdAt: warehouse.createdAt,
              updatedAt: warehouse.updatedAt,
              tenants: metrics.tenantMetrics,
              hasStoredProducts: true, // Tiene productos almacenados
            });
          } else {
            // 5. Si no tiene productos, crear entrada con datos completos del warehouse
            warehousesWithTenants.push({
              countryCode: countryDoc.countryCode,
              country: countryDoc.country,
              warehouseId: warehouseId,
              warehouseName: warehouse.name || 'Default Warehouse',
              partnerType: warehouse.partnerType || 'FirstPlug',
              isActive: warehouse.isActive,
              totalProducts: 0,
              computers: 0,
              otherProducts: 0,
              distinctTenants: 0,
              // Datos completos del warehouse
              address: warehouse.address || '',
              apartment: warehouse.apartment || '',
              city: warehouse.city || '',
              state: warehouse.state || '',
              zipCode: warehouse.zipCode || '',
              email: warehouse.email || '',
              phone: warehouse.phone || '',
              contactPerson: warehouse.contactPerson || '',
              canal: warehouse.canal || '',
              additionalInfo: warehouse.additionalInfo || '',
              isDeleted: warehouse.isDeleted || false,
              createdAt: warehouse.createdAt,
              updatedAt: warehouse.updatedAt,
              tenants: [],
              hasStoredProducts: false, // No tiene productos almacenados
            });
          }
        }
      }

      // 6. Ordenar: primero los que tienen productos (descendente por totalProducts)
      warehousesWithTenants.sort((a, b) => {
        if (a.totalProducts > 0 && b.totalProducts === 0) return -1;
        if (a.totalProducts === 0 && b.totalProducts > 0) return 1;
        return b.totalProducts - a.totalProducts;
      });

      return warehousesWithTenants;
    } catch (error) {
      this.logger.error('Error getting all warehouses with tenants:', error);
      return [];
    }
  }

  /**
   * Obtener detalle de tenants para un warehouse específico
   */
  async getWarehouseTenantDetails(
    warehouseId: string,
  ): Promise<TenantMetricsDetail[]> {
    try {
      const metrics =
        await this.warehousesService.getWarehouseMetricsRealTime(warehouseId);

      if (!metrics) {
        return [];
      }

      return metrics.tenantMetrics;
    } catch (error) {
      this.logger.error(
        `Error getting warehouse tenant details for ${warehouseId}:`,
        error,
      );
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
