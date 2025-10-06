import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection } from 'mongoose';
import {
  Warehouse,
  WarehouseDocument,
  WarehouseItem,
} from './schemas/warehouse.schema';
import { CreateWarehouseDto, UpdateWarehouseDto } from './dto';
import { DEFAULT_PARTNER_TYPE } from './constants/warehouse.constants';
import { countryCodes } from '../shipments/helpers/countryCodes';

@Injectable()
export class WarehousesService {
  private readonly logger = new Logger(WarehousesService.name);

  constructor(
    @InjectModel(Warehouse.name, 'firstPlug')
    private warehouseModel: Model<WarehouseDocument>,
    @InjectConnection('firstPlug') private firstPlugConnection: Connection,
  ) {}

  /**
   * Obtener métricas de un warehouse en tiempo real mediante agregación
   * Reemplaza las métricas pre-calculadas con cálculo directo desde global_products
   */
  async getWarehouseMetricsRealTime(warehouseId: string): Promise<{
    warehouseId: string;
    country: string;
    countryCode: string;
    warehouseName: string;
    partnerType: string;
    isActive: boolean;
    totalProducts: number;
    totalComputers: number;
    totalOtherProducts: number;
    totalTenants: number;
    tenantMetrics: Array<{
      tenantId: string;
      tenantName: string;
      companyName: string;
      totalProducts: number;
      computers: number;
      otherProducts: number;
    }>;
  } | null> {
    try {
      const warehouseObjectId = new Types.ObjectId(warehouseId);

      // 1. Obtener información del warehouse
      const warehouseDoc = await this.warehouseModel.findOne({
        'warehouses._id': warehouseObjectId,
      });

      if (!warehouseDoc) {
        this.logger.warn(`Warehouse ${warehouseId} not found`);
        return null;
      }

      const warehouse = warehouseDoc.warehouses.find(
        (w) => w._id.toString() === warehouseId,
      );

      if (!warehouse) {
        this.logger.warn(
          `Warehouse ${warehouseId} not found in warehouses array`,
        );
        return null;
      }

      // 2. Calcular métricas en tiempo real desde global_products
      const globalProductsCollection =
        this.firstPlugConnection.db.collection('global_products');

      const tenantMetricsResult = await globalProductsCollection
        .aggregate([
          {
            $match: {
              'fpWarehouse.warehouseId': warehouseObjectId,
              inFpWarehouse: true,
              isDeleted: { $ne: true },
            },
          },
          {
            $group: {
              _id: {
                tenantId: '$tenantId',
                tenantName: '$tenantName',
              },
              totalProducts: { $sum: 1 },
              computers: { $sum: { $cond: ['$isComputer', 1, 0] } },
              otherProducts: { $sum: { $cond: ['$isComputer', 0, 1] } },
            },
          },
          {
            $sort: { '_id.tenantName': 1 },
          },
        ])
        .toArray();

      // 3. Obtener companyName de cada tenant
      const tenantsCollection =
        this.firstPlugConnection.db.collection('tenants');
      const tenantIds = tenantMetricsResult.map((t) => t._id.tenantId);
      const tenants = await tenantsCollection
        .find({ _id: { $in: tenantIds } })
        .toArray();

      const tenantMap = new Map(
        tenants.map((t) => [t._id.toString(), t.name || t.tenantName]),
      );

      // 4. Calcular totales
      const totalProducts = tenantMetricsResult.reduce(
        (sum, t) => sum + t.totalProducts,
        0,
      );
      const totalComputers = tenantMetricsResult.reduce(
        (sum, t) => sum + t.computers,
        0,
      );
      const totalOtherProducts = tenantMetricsResult.reduce(
        (sum, t) => sum + t.otherProducts,
        0,
      );

      // 5. Formatear resultado
      return {
        warehouseId,
        country: warehouseDoc.country,
        countryCode: warehouseDoc.countryCode,
        warehouseName: warehouse.name || 'Default Warehouse',
        partnerType: warehouse.partnerType || 'default',
        isActive: warehouse.isActive || false,
        totalProducts,
        totalComputers,
        totalOtherProducts,
        totalTenants: tenantMetricsResult.length,
        tenantMetrics: tenantMetricsResult.map((t) => ({
          tenantId: t._id.tenantId.toString(),
          tenantName: t._id.tenantName,
          companyName:
            tenantMap.get(t._id.tenantId.toString()) || t._id.tenantName,
          totalProducts: t.totalProducts,
          computers: t.computers,
          otherProducts: t.otherProducts,
        })),
      };
    } catch (error) {
      this.logger.error(
        `Error calculating real-time metrics for warehouse ${warehouseId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Obtener métricas de todos los warehouses en tiempo real
   * OPTIMIZADO: Solo calcula métricas para warehouses que tienen productos
   */
  async getAllWarehouseMetricsRealTime(): Promise<
    Array<{
      warehouseId: string;
      country: string;
      countryCode: string;
      warehouseName: string;
      partnerType: string;
      isActive: boolean;
      totalProducts: number;
      totalComputers: number;
      totalOtherProducts: number;
      totalTenants: number;
      tenantMetrics: Array<{
        tenantId: string;
        tenantName: string;
        companyName: string;
        totalProducts: number;
        computers: number;
        otherProducts: number;
      }>;
    }>
  > {
    try {
      // 1. Obtener lista de warehouses que tienen productos (mucho más rápido)
      const globalProductsCollection =
        this.firstPlugConnection.db.collection('global_products');

      const warehousesWithProducts = await globalProductsCollection
        .aggregate([
          {
            $match: {
              inFpWarehouse: true,
              isDeleted: { $ne: true },
            },
          },
          {
            $group: {
              _id: '$fpWarehouse.warehouseId',
            },
          },
        ])
        .toArray();

      const warehouseIds = warehousesWithProducts.map((w) => w._id);

      this.logger.debug(
        `Found ${warehouseIds.length} warehouses with products`,
      );

      // 2. Solo calcular métricas para warehouses que tienen productos
      const allMetrics: Array<{
        warehouseId: string;
        country: string;
        countryCode: string;
        warehouseName: string;
        partnerType: string;
        isActive: boolean;
        totalProducts: number;
        totalComputers: number;
        totalOtherProducts: number;
        totalTenants: number;
        tenantMetrics: Array<{
          tenantId: string;
          tenantName: string;
          companyName: string;
          totalProducts: number;
          computers: number;
          otherProducts: number;
        }>;
      }> = [];

      for (const warehouseId of warehouseIds) {
        const metrics = await this.getWarehouseMetricsRealTime(
          warehouseId.toString(),
        );

        if (metrics) {
          allMetrics.push({
            warehouseId: metrics.warehouseId,
            country: metrics.country,
            countryCode: metrics.countryCode,
            warehouseName: metrics.warehouseName,
            partnerType: metrics.partnerType,
            isActive: metrics.isActive,
            totalProducts: metrics.totalProducts,
            totalComputers: metrics.totalComputers,
            totalOtherProducts: metrics.totalOtherProducts,
            totalTenants: metrics.totalTenants,
            tenantMetrics: metrics.tenantMetrics,
          });
        }
      }

      return allMetrics;
    } catch (error) {
      this.logger.error('Error getting all warehouse metrics:', error);
      return [];
    }
  }

  /**
   * Obtener todos los países con sus warehouses
   */
  async findAll(): Promise<WarehouseDocument[]> {
    try {
      return await this.warehouseModel
        .find({ isDeleted: { $ne: true } })
        .sort({ country: 1 })
        .exec();
    } catch (error) {
      this.logger.error('Error fetching all warehouses:', error);
      throw error;
    }
  }

  /**
   * Obtener warehouses de un país específico
   */
  async findByCountry(country: string): Promise<WarehouseDocument | null> {
    try {
      return await this.warehouseModel
        .findOne({
          country: { $regex: new RegExp(`^${country}$`, 'i') },
          isDeleted: { $ne: true },
        })
        .exec();
    } catch (error) {
      this.logger.error(
        `Error fetching warehouses for country ${country}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Obtener warehouses por código de país
   */
  async findByCountryCode(
    countryCode: string,
  ): Promise<WarehouseDocument | null> {
    try {
      return await this.warehouseModel
        .findOne({
          countryCode: countryCode.toUpperCase(),
          isDeleted: { $ne: true },
        })
        .exec();
    } catch (error) {
      this.logger.error(
        `Error finding warehouses for country code ${countryCode}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Obtener warehouse activo de un país
   */
  async findActiveWarehouseByCountry(
    country: string,
  ): Promise<WarehouseItem | null> {
    try {
      const countryDoc = await this.findByCountry(country);
      if (!countryDoc) return null;

      const activeWarehouse = countryDoc.warehouses.find(
        (w) => w.isActive && !w.isDeleted,
      );

      return activeWarehouse || null;
    } catch (error) {
      this.logger.error(
        `Error fetching active warehouse for country ${country}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Obtener warehouse para asignación de productos (activo o default)
   * Prioriza warehouse activo, pero si no existe, usa el default
   * Si el país no existe, lo crea automáticamente con warehouse default
   * Acepta tanto código de país (AR) como nombre (Argentina)
   */
  async findWarehouseForProductAssignment(
    countryInput: string,
  ): Promise<WarehouseItem | null> {
    try {
      // Primero intentar buscar por código de país
      let countryDoc = await this.findByCountryCode(countryInput);

      // Si no se encuentra por código, intentar por nombre
      if (!countryDoc) {
        countryDoc = await this.findByCountry(countryInput);
      }

      // Si el país no existe, crearlo automáticamente
      if (!countryDoc) {
        this.logger.log(
          `Country ${countryInput} not found, creating automatically...`,
        );

        // Buscar el código y nombre del país
        let countryCode: string;
        let countryName: string;

        // Determinar si el input es código o nombre
        if (countryInput.length === 2) {
          // Es un código de país
          countryCode = countryInput.toUpperCase();
          countryName =
            Object.keys(countryCodes).find(
              (name) => countryCodes[name] === countryCode,
            ) || countryInput;
        } else {
          // Es un nombre de país
          countryName = countryInput;
          countryCode = countryCodes[countryName];
        }

        if (!countryCode) {
          this.logger.error(`Country code not found for: ${countryInput}`);
          return null;
        }

        // Crear el país con warehouse default
        countryDoc = await this.initializeCountry(countryName, countryCode);
      }

      // Primero buscar warehouse activo
      const activeWarehouse = countryDoc.warehouses.find(
        (w) => w.isActive && !w.isDeleted,
      );

      if (activeWarehouse) {
        return activeWarehouse;
      }

      // Si no hay activo, buscar el default (primer warehouse no eliminado)
      const defaultWarehouse = countryDoc.warehouses.find((w) => !w.isDeleted);

      return defaultWarehouse || null;
    } catch (error) {
      this.logger.error(
        `Error fetching warehouse for product assignment in country ${countryInput}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Crear documento de país si no existe
   */
  async createCountryDocument(
    country: string,
    countryCode: string,
  ): Promise<WarehouseDocument> {
    try {
      const newCountryDoc = new this.warehouseModel({
        country,
        countryCode,
        warehouses: [],
        hasActiveWarehouse: false,
      });

      await newCountryDoc.save();
      this.logger.log(
        `✅ Country document created: ${country} (${countryCode})`,
      );
      return newCountryDoc;
    } catch (error) {
      this.logger.error(
        `Error creating country document for ${country}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Crear un nuevo warehouse en un país
   */
  async createWarehouse(
    country: string,
    createWarehouseDto: CreateWarehouseDto,
  ): Promise<WarehouseItem> {
    try {
      const countryDoc = await this.findByCountry(country);

      // Si no existe el documento del país, lanzar error
      if (!countryDoc) {
        throw new NotFoundException(
          `Country document for ${country} not found. Initialize countries first.`,
        );
      }

      // Si se quiere activar este warehouse, desactivar los demás
      if (createWarehouseDto.isActive) {
        countryDoc.warehouses.forEach((w) => {
          if (!w.isDeleted) w.isActive = false;
        });
      }

      // Crear el nuevo warehouse
      const newWarehouse = {
        _id: new Types.ObjectId(),
        ...createWarehouseDto,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as WarehouseItem;

      countryDoc.warehouses.push(newWarehouse);
      await countryDoc.save();

      this.logger.log(
        `✅ Warehouse created in ${country}: ${newWarehouse.name}`,
      );
      return newWarehouse;
    } catch (error) {
      this.logger.error(`Error creating warehouse in ${country}:`, error);
      throw error;
    }
  }

  /**
   * Actualizar un warehouse específico con validaciones inteligentes
   */
  async updateWarehouse(
    country: string,
    warehouseId: string,
    updateWarehouseDto: UpdateWarehouseDto,
  ): Promise<WarehouseItem> {
    try {
      const countryDoc = await this.findByCountry(country);
      if (!countryDoc) {
        throw new NotFoundException(`Country ${country} not found`);
      }

      const warehouseIndex = countryDoc.warehouses.findIndex(
        (w) => w._id.toString() === warehouseId && !w.isDeleted,
      );

      if (warehouseIndex === -1) {
        throw new NotFoundException(
          `Warehouse ${warehouseId} not found in ${country}`,
        );
      }

      // Actualizar el warehouse
      const warehouse = countryDoc.warehouses[warehouseIndex];
      Object.assign(warehouse, updateWarehouseDto, { updatedAt: new Date() });

      // Verificar si el warehouse ahora está completo
      const isComplete = this.isWarehouseComplete(warehouse);

      // Lógica de activación inteligente
      if (isComplete) {
        // Si el warehouse está completo y no hay otro activo, activarlo automáticamente
        const hasActiveWarehouse = countryDoc.warehouses.some(
          (w, index) => index !== warehouseIndex && w.isActive && !w.isDeleted,
        );

        if (!hasActiveWarehouse) {
          warehouse.isActive = true;
          this.logger.log(
            `✅ Warehouse auto-activated (first complete warehouse in ${country})`,
          );
        }
      } else {
        // Si el warehouse no está completo, no puede estar activo
        if (warehouse.isActive) {
          warehouse.isActive = false;

          // Buscar otro warehouse completo para activar
          const bestCandidate = this.findBestActiveCandidate(
            countryDoc.warehouses,
          );
          if (bestCandidate) {
            bestCandidate.isActive = true;
            this.logger.log(
              `✅ Activated alternative warehouse: ${bestCandidate.name}`,
            );
          } else {
            this.logger.warn(
              `⚠️  No complete warehouse available in ${country}`,
            );
          }
        }
      }

      // Si se solicita activación explícita
      if (updateWarehouseDto.isActive === true) {
        if (isComplete) {
          // Desactivar otros warehouses
          countryDoc.warehouses.forEach((w, index) => {
            if (index !== warehouseIndex && !w.isDeleted) {
              w.isActive = false;
            }
          });
          warehouse.isActive = true;
        } else {
          throw new BadRequestException(
            `Cannot activate incomplete warehouse. Missing required fields: ${this.getMissingFields(warehouse).join(', ')}`,
          );
        }
      }

      await countryDoc.save();

      this.logger.log(
        `✅ Warehouse updated in ${country}: ${warehouse.name || 'Unnamed'}`,
      );
      return warehouse;
    } catch (error) {
      this.logger.error(
        `Error updating warehouse ${warehouseId} in ${country}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Obtener campos faltantes de un warehouse
   */
  private getMissingFields(warehouse: WarehouseItem): string[] {
    const requiredFields = ['name', 'address', 'city', 'state', 'zipCode'];
    return requiredFields.filter(
      (field) => !warehouse[field] || warehouse[field].toString().trim() === '',
    );
  }

  /**
   * Soft delete de un warehouse con lógica inteligente
   */
  async deleteWarehouse(
    country: string,
    warehouseId: string,
  ): Promise<{
    deleted: boolean;
    message: string;
    newActiveWarehouse?: string;
    warning?: string;
  }> {
    try {
      const countryDoc = await this.findByCountry(country);
      if (!countryDoc) {
        throw new NotFoundException(`Country ${country} not found`);
      }

      const warehouse = countryDoc.warehouses.find(
        (w) => w._id.toString() === warehouseId && !w.isDeleted,
      );

      if (!warehouse) {
        throw new NotFoundException(
          `Warehouse ${warehouseId} not found in ${country}`,
        );
      }

      const wasActive = warehouse.isActive;

      // Soft delete
      warehouse.isDeleted = true;
      warehouse.deletedAt = new Date();
      warehouse.isActive = false;
      warehouse.updatedAt = new Date();

      const result = {
        deleted: true,
        message: `Warehouse deleted successfully: ${warehouse.name || 'Unnamed'}`,
        newActiveWarehouse: undefined as string | undefined,
        warning: undefined as string | undefined,
      };

      // Si el warehouse eliminado era el activo, buscar reemplazo
      if (wasActive) {
        const bestCandidate = this.findBestActiveCandidate(
          countryDoc.warehouses,
        );

        if (bestCandidate) {
          bestCandidate.isActive = true;
          bestCandidate.updatedAt = new Date();
          result.newActiveWarehouse = bestCandidate.name || 'Unnamed';
          result.message += `. New active warehouse: ${result.newActiveWarehouse}`;
        } else {
          result.warning = `Warning: ${country} now has no active warehouses. Products cannot be assigned to FP warehouse until a warehouse is completed and activated.`;
        }
      }

      await countryDoc.save();

      this.logger.log(`✅ ${result.message}`);
      if (result.warning) {
        this.logger.warn(`⚠️  ${result.warning}`);
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Error deleting warehouse ${warehouseId} in ${country}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Activar un warehouse específico (solo si está completo) con migración automática
   */
  async activateWarehouse(
    country: string,
    warehouseId: string,
  ): Promise<{
    activated: boolean;
    message: string;
    deactivatedWarehouses?: string[];
    migratedProducts?: number;
    affectedTenants?: number;
  }> {
    try {
      const countryDoc = await this.findByCountry(country);
      if (!countryDoc) {
        throw new NotFoundException(`Country ${country} not found`);
      }

      const warehouse = countryDoc.warehouses.find(
        (w) => w._id.toString() === warehouseId && !w.isDeleted,
      );

      if (!warehouse) {
        throw new NotFoundException(
          `Warehouse ${warehouseId} not found in ${country}`,
        );
      }

      if (warehouse.isActive) {
        return {
          activated: false,
          message: 'Warehouse is already active',
        };
      }

      // Verificar si está completo
      if (!this.isWarehouseComplete(warehouse)) {
        throw new BadRequestException(
          `Cannot activate incomplete warehouse. Missing required fields: ${this.getMissingFields(warehouse).join(', ')}`,
        );
      }

      // Desactivar otros warehouses
      const deactivatedWarehouses: string[] = [];
      countryDoc.warehouses.forEach((w) => {
        if (w.isActive && !w.isDeleted && w._id.toString() !== warehouseId) {
          w.isActive = false;
          w.updatedAt = new Date();
          deactivatedWarehouses.push(w.name || 'Unnamed');
        }
      });

      // Activar el warehouse
      warehouse.isActive = true;
      warehouse.updatedAt = new Date();

      await countryDoc.save();

      // 5. Migrar productos automáticamente si había warehouses activos antes
      let migratedProducts = 0;
      let affectedTenants = 0;

      if (deactivatedWarehouses.length > 0) {
        this.logger.log(
          `🔄 Starting automatic product migration to new warehouse...`,
        );

        const migrationResult = await this.migrateProductsToNewWarehouse(
          countryDoc.countryCode,
          warehouseId,
          warehouse.name || 'Unnamed',
        );

        migratedProducts = migrationResult.migratedProducts;
        affectedTenants = migrationResult.affectedTenants;
      }

      const result = {
        activated: true,
        message: `Warehouse activated successfully: ${warehouse.name || 'Unnamed'}`,
        deactivatedWarehouses:
          deactivatedWarehouses.length > 0 ? deactivatedWarehouses : undefined,
        migratedProducts: migratedProducts > 0 ? migratedProducts : undefined,
        affectedTenants: affectedTenants > 0 ? affectedTenants : undefined,
      };

      this.logger.log(`✅ ${result.message}`);
      if (deactivatedWarehouses.length > 0) {
        this.logger.log(
          `📋 Deactivated warehouses: ${deactivatedWarehouses.join(', ')}`,
        );
      }
      if (migratedProducts > 0) {
        this.logger.log(
          `🚚 Migrated ${migratedProducts} products from ${affectedTenants} tenants`,
        );
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Error activating warehouse ${warehouseId} in ${country}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Desactivar un warehouse específico
   */
  async deactivateWarehouse(
    country: string,
    warehouseId: string,
  ): Promise<{
    deactivated: boolean;
    message: string;
    warning?: string;
  }> {
    try {
      const countryDoc = await this.findByCountry(country);
      if (!countryDoc) {
        throw new NotFoundException(`Country ${country} not found`);
      }

      const warehouse = countryDoc.warehouses.find(
        (w) => w._id.toString() === warehouseId && !w.isDeleted,
      );

      if (!warehouse) {
        throw new NotFoundException(
          `Warehouse ${warehouseId} not found in ${country}`,
        );
      }

      if (!warehouse.isActive) {
        return {
          deactivated: false,
          message: 'Warehouse is already inactive',
        };
      }

      // Desactivar el warehouse
      warehouse.isActive = false;
      warehouse.updatedAt = new Date();

      await countryDoc.save();

      const result = {
        deactivated: true,
        message: `Warehouse deactivated successfully: ${warehouse.name || 'Unnamed'}`,
        warning: `Warning: ${country} now has no active warehouses. Products cannot be assigned to FP warehouse until another warehouse is activated.`,
      };

      this.logger.log(`✅ ${result.message}`);
      this.logger.warn(`⚠️  ${result.warning}`);

      return result;
    } catch (error) {
      this.logger.error(
        `Error deactivating warehouse ${warehouseId} in ${country}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Migrar productos de un país a un nuevo warehouse activo
   */
  private async migrateProductsToNewWarehouse(
    countryCode: string,
    newWarehouseId: string,
    newWarehouseName: string,
  ): Promise<{
    migratedProducts: number;
    affectedTenants: number;
    errors?: string[];
  }> {
    try {
      const errors: string[] = [];
      let totalMigratedProducts = 0;
      let affectedTenants = 0;

      // 1. Obtener lista de todas las bases de datos de tenants
      // Nota: Necesitarás implementar este método o inyectar un servicio que lo haga
      const tenantDatabases = await this.getAllTenantDatabases();

      // 2. Migrar productos en cada tenant
      for (const tenantName of tenantDatabases) {
        try {
          const migratedInTenant = await this.migrateProductsInTenant(
            tenantName,
            countryCode,
            newWarehouseId,
            newWarehouseName,
          );

          if (migratedInTenant > 0) {
            totalMigratedProducts += migratedInTenant;
            affectedTenants++;
            this.logger.log(
              `✅ Migrated ${migratedInTenant} products in tenant ${tenantName}`,
            );
          }
        } catch (error) {
          const errorMsg = `Error migrating products in tenant ${tenantName}: ${error.message}`;
          errors.push(errorMsg);
          this.logger.error(errorMsg, error);
        }
      }

      // 3. TODO: Actualizar colección global de productos
      // Esto se implementará con el nuevo GlobalProductSyncService
      this.logger.log(
        '📊 Global product sync will be implemented with new architecture',
      );

      this.logger.log(
        `🎯 Migration completed: ${totalMigratedProducts} products from ${affectedTenants} tenants`,
      );

      return {
        migratedProducts: totalMigratedProducts,
        affectedTenants,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      this.logger.error(`Error during product migration:`, error);
      return {
        migratedProducts: 0,
        affectedTenants: 0,
        errors: [`Migration failed: ${error.message}`],
      };
    }
  }

  /**
   * Migrar productos en un tenant específico
   */
  private async migrateProductsInTenant(
    tenantName: string,
    countryCode: string,
    newWarehouseId: string,
    newWarehouseName: string,
  ): Promise<number> {
    try {
      // Conectar a la base de datos del tenant
      const tenantConnection = this.firstPlugConnection.useDb(tenantName);

      // Verificar si la colección products existe
      const collections = await tenantConnection.db
        .listCollections({ name: 'products' })
        .toArray();
      if (collections.length === 0) {
        this.logger.log(
          `📦 No products collection found in tenant ${tenantName}`,
        );
        return 0;
      }

      // Obtener el modelo de Product para este tenant
      const ProductModel = tenantConnection.model('Product');

      // Actualizar productos que están en FP warehouse en este país
      const result = await ProductModel.updateMany(
        {
          location: 'FP warehouse',
          $or: [
            { 'fpWarehouse.warehouseCountryCode': countryCode },
            // También migrar productos que no tienen fpWarehouse pero están en FP warehouse
            // (productos antiguos antes de implementar fpWarehouse)
            {
              'fpWarehouse.warehouseCountryCode': { $exists: false },
              location: 'FP warehouse',
            },
          ],
        },
        {
          $set: {
            'fpWarehouse.warehouseId': new Types.ObjectId(newWarehouseId),
            'fpWarehouse.warehouseCountryCode': countryCode,
            'fpWarehouse.warehouseName': newWarehouseName,
            'fpWarehouse.assignedAt': new Date(),
            'fpWarehouse.status': 'STORED',
          },
        },
      );

      if (result.modifiedCount > 0) {
        this.logger.log(
          `✅ Migrated ${result.modifiedCount} products in tenant ${tenantName}`,
        );
      }

      return result.modifiedCount;
    } catch (error) {
      this.logger.error(
        `Error migrating products in tenant ${tenantName}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Obtener lista de todas las bases de datos de tenants
   */
  private async getAllTenantDatabases(): Promise<string[]> {
    try {
      // Listar todas las bases de datos y filtrar las de tenants
      const databases = await this.firstPlugConnection.db
        .admin()
        .listDatabases();

      const tenantDbs = databases.databases
        .filter((db) => {
          // Filtrar DBs del sistema
          const systemDbs = ['firstPlug', 'admin', 'local', 'config'];
          return !systemDbs.includes(db.name);
        })
        .map((db) => db.name);

      this.logger.log(
        `📋 Found ${tenantDbs.length} tenant databases: ${tenantDbs.join(', ')}`,
      );
      return tenantDbs;
    } catch (error) {
      this.logger.error('Error getting tenant databases:', error);
      return [];
    }
  }

  /**
   * Verificar si un warehouse tiene datos reales o es placeholder
   */
  async isRealPartner(country: string, warehouseId?: string): Promise<boolean> {
    try {
      if (warehouseId) {
        const countryDoc = await this.findByCountry(country);
        const warehouse = countryDoc?.warehouses.find(
          (w) => w._id.toString() === warehouseId && !w.isDeleted,
        );
        return warehouse?.partnerType !== 'default';
      } else {
        const activeWarehouse =
          await this.findActiveWarehouseByCountry(country);
        return activeWarehouse?.partnerType !== 'default';
      }
    } catch (error) {
      this.logger.error(`Error checking if warehouse is real partner:`, error);
      return false;
    }
  }

  /**
   * Crear warehouse con datos vacíos para inicialización
   * Los datos serán completados posteriormente por SuperAdmin
   */
  async createDefaultWarehouse(country: string): Promise<WarehouseItem> {
    try {
      const countryDoc = await this.findByCountry(country);

      // Si no existe el documento del país, lanzar error
      if (!countryDoc) {
        throw new NotFoundException(
          `Country document for ${country} not found. Initialize countries first.`,
        );
      }

      // Crear warehouse con datos vacíos
      const newWarehouse = {
        _id: new Types.ObjectId(),
        name: '', // Vacío - será completado por SuperAdmin
        address: '', // Vacío - será completado por SuperAdmin
        apartment: '',
        city: '', // Vacío - será completado por SuperAdmin
        state: '', // Vacío - será completado por SuperAdmin
        zipCode: '', // Vacío - será completado por SuperAdmin
        email: '',
        phone: '',
        contactPerson: '',
        canal: '', // Vacío - será completado por SuperAdmin
        isActive: false, // Inactivo hasta que se actualice con datos reales
        additionalInfo: '', // Vacío - será completado por SuperAdmin
        partnerType: DEFAULT_PARTNER_TYPE, // 'default' hasta que se actualice
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as WarehouseItem;

      countryDoc.warehouses.push(newWarehouse);
      await countryDoc.save();

      this.logger.log(
        `✅ Default warehouse created for ${country} with empty data`,
      );
      return newWarehouse;
    } catch (error) {
      this.logger.error(
        `Error creating default warehouse for ${country}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Verificar si un warehouse tiene todos los datos requeridos completos
   */
  private isWarehouseComplete(warehouse: WarehouseItem): boolean {
    const requiredFields = ['name', 'address', 'city', 'state', 'zipCode'];
    return requiredFields.every(
      (field) => warehouse[field] && warehouse[field].toString().trim() !== '',
    );
  }

  /**
   * Verificar si un país tiene al menos un warehouse real (no default)
   */
  async hasRealPartner(country: string): Promise<boolean> {
    try {
      const countryDoc = await this.findByCountry(country);
      if (!countryDoc) return false;

      return countryDoc.warehouses.some(
        (w) => !w.isDeleted && w.partnerType !== 'default',
      );
    } catch (error) {
      this.logger.error(`Error checking if country has real partner:`, error);
      return false;
    }
  }

  /**
   * Encontrar el mejor candidato para ser warehouse activo
   */
  private findBestActiveCandidate(
    warehouses: WarehouseItem[],
  ): WarehouseItem | null {
    const candidates = warehouses.filter(
      (w) => !w.isDeleted && this.isWarehouseComplete(w),
    );

    if (candidates.length === 0) return null;

    // Priorizar por tipo: partner > own > temporary > default
    const priority = { partner: 1, own: 2, temporary: 3, default: 4 };

    return candidates.sort((a, b) => {
      const priorityA = priority[a.partnerType] || 5;
      const priorityB = priority[b.partnerType] || 5;
      return priorityA - priorityB;
    })[0];
  }

  /**
   * Encontrar un warehouse específico por ID
   */
  async findWarehouseById(
    countryCode: string,
    warehouseId: string,
  ): Promise<{
    country: string;
    name: string;
    isActive: boolean;
  } | null> {
    try {
      const countryDoc = await this.findByCountryCode(countryCode);
      if (!countryDoc) return null;

      const warehouse = countryDoc.warehouses.find(
        (w) => w._id.toString() === warehouseId && !w.isDeleted,
      );

      if (!warehouse) return null;

      return {
        country: countryDoc.country,
        name: warehouse.name || 'Unnamed Warehouse',
        isActive: warehouse.isActive,
      };
    } catch (error) {
      this.logger.error(
        `Error finding warehouse ${warehouseId} in ${countryCode}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Obtener todos los warehouses activos del sistema
   */
  async findAllActiveWarehouses(): Promise<
    Array<{
      countryCode: string;
      country: string;
      warehouseId: string;
      warehouseName: string;
    }>
  > {
    try {
      const allCountries = await this.findAll();
      const activeWarehouses: Array<{
        countryCode: string;
        country: string;
        warehouseId: string;
        warehouseName: string;
      }> = [];

      for (const countryDoc of allCountries) {
        const activeWarehouse = countryDoc.warehouses.find(
          (w) => w.isActive && !w.isDeleted,
        );

        if (activeWarehouse) {
          activeWarehouses.push({
            countryCode: countryDoc.countryCode,
            country: countryDoc.country,
            warehouseId: activeWarehouse._id.toString(),
            warehouseName: activeWarehouse.name || 'Unnamed Warehouse',
          });
        }
      }

      return activeWarehouses;
    } catch (error) {
      this.logger.error('Error finding all active warehouses:', error);
      return [];
    }
  }

  /**
   * Inicializar un país completo (documento + warehouse default)
   * Útil para el script de migración
   */
  async initializeCountry(
    country: string,
    countryCode: string,
  ): Promise<WarehouseDocument> {
    try {
      // Verificar si ya existe
      let countryDoc = await this.findByCountry(country);
      if (countryDoc) {
        this.logger.log(
          `Country ${country} already exists, skipping initialization`,
        );
        return countryDoc;
      }

      // Crear documento de país
      countryDoc = await this.createCountryDocument(country, countryCode);

      // Crear warehouse default
      await this.createDefaultWarehouse(country);

      // Recargar el documento para obtener el warehouse creado
      const updatedDoc = await this.findByCountry(country);
      if (!updatedDoc) {
        throw new Error(`Failed to initialize country ${country}`);
      }

      this.logger.log(
        `✅ Country ${country} initialized successfully with default warehouse`,
      );
      return updatedDoc;
    } catch (error) {
      this.logger.error(`Error initializing country ${country}:`, error);
      throw error;
    }
  }
}
