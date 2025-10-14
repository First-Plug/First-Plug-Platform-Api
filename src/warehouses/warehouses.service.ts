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
              'fpWarehouse.warehouseId': { $ne: null }, // Filtrar valores null
            },
          },
          {
            $group: {
              _id: '$fpWarehouse.warehouseId',
            },
          },
        ])
        .toArray();

      // Filtrar valores null/undefined antes de mapear
      const warehouseIds = warehousesWithProducts
        .map((w) => w._id)
        .filter((id) => id != null);

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
   * Obtener datos específicos de un warehouse para edición
   */
  async getWarehouseForEdit(
    country: string,
    warehouseId: string,
  ): Promise<{
    warehouse: WarehouseItem;
    country: string;
    countryCode: string;
  } | null> {
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

      return {
        warehouse: warehouse,
        country: countryDoc.country,
        countryCode: countryDoc.countryCode,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching warehouse ${warehouseId} for edit in ${country}:`,
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
   * Actualizar solo los datos de un warehouse (sin cambiar isActive)
   * Para cambiar isActive, usar toggleWarehouseActive()
   */
  async updateWarehouseData(
    country: string,
    warehouseId: string,
    updateData: Partial<WarehouseItem>,
  ): Promise<{
    warehouse: WarehouseItem;
    autoActivated?: boolean;
    message: string;
  }> {
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

      const warehouse = countryDoc.warehouses[warehouseIndex];
      const wasComplete = this.isWarehouseComplete(warehouse);

      // Actualizar solo los datos (sin isActive)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { isActive, ...dataToUpdate } = updateData;
      Object.assign(warehouse, dataToUpdate, { updatedAt: new Date() });

      const isNowComplete = this.isWarehouseComplete(warehouse);
      let autoActivated = false;

      // Si el warehouse se completó y no hay otro activo, activarlo automáticamente
      if (!wasComplete && isNowComplete) {
        const hasActiveWarehouse = countryDoc.warehouses.some(
          (w, index) => index !== warehouseIndex && w.isActive && !w.isDeleted,
        );

        if (!hasActiveWarehouse) {
          warehouse.isActive = true;
          autoActivated = true;
          this.logger.log(
            `✅ Warehouse auto-activated (first complete warehouse in ${country})`,
          );
        }
      }

      // Si el warehouse se volvió incompleto y estaba activo, desactivarlo
      if (wasComplete && !isNowComplete && warehouse.isActive) {
        warehouse.isActive = false;

        // Buscar otro warehouse completo para activar
        const bestCandidate = this.findBestActiveCandidate(
          countryDoc.warehouses.filter((_, i) => i !== warehouseIndex),
        );

        if (bestCandidate) {
          bestCandidate.isActive = true;
          this.logger.log(
            `✅ Activated alternative warehouse: ${bestCandidate.name}`,
          );
        } else {
          this.logger.warn(`⚠️  No complete warehouse available in ${country}`);
        }
      }

      await countryDoc.save();

      const message = autoActivated
        ? `Warehouse updated and auto-activated in ${country}`
        : `Warehouse updated successfully in ${country}`;

      this.logger.log(`✅ ${message}: ${warehouse.name || 'Unnamed'}`);

      return {
        warehouse,
        autoActivated: autoActivated ? true : undefined,
        message,
      };
    } catch (error) {
      this.logger.error(
        `Error updating warehouse data ${warehouseId} in ${country}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Actualizar un warehouse específico con validaciones inteligentes
   * @deprecated Usar updateWarehouseData() para datos y toggleWarehouseActive() para cambiar estado
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
   * Activar un warehouse específico (solo si está completo)
   * Nota: La migración de productos debe ser manejada por un servicio transversal
   */
  async activateWarehouse(
    country: string,
    warehouseId: string,
  ): Promise<{
    activated: boolean;
    message: string;
    deactivatedWarehouses?: string[];
    countryCode?: string;
    warehouseId?: string;
    warehouseName?: string;
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

      const result = {
        activated: true,
        message: `Warehouse activated successfully: ${warehouse.name || 'Unnamed'}`,
        deactivatedWarehouses:
          deactivatedWarehouses.length > 0 ? deactivatedWarehouses : undefined,
        countryCode: countryDoc.countryCode,
        warehouseId: warehouseId,
        warehouseName: warehouse.name || 'Unnamed',
      };

      this.logger.log(`✅ ${result.message}`);
      if (deactivatedWarehouses.length > 0) {
        this.logger.log(
          `📋 Deactivated warehouses: ${deactivatedWarehouses.join(', ')}`,
        );
        this.logger.log(
          `ℹ️  Note: Products migration should be handled by a transversal service (e.g., ProductWarehouseMigrationService)`,
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
   * Toggle del estado isActive de un warehouse con validaciones
   * Este método es específico para cambiar solo el estado de activación
   * Nota: La migración de productos debe ser manejada por un servicio transversal
   */
  async toggleWarehouseActive(
    country: string,
    warehouseId: string,
    isActive: boolean,
  ): Promise<{
    success: boolean;
    message: string;
    warehouse: WarehouseItem;
    deactivatedWarehouses?: string[];
    countryCode?: string;
    warehouseId?: string;
    warehouseName?: string;
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

      // Si ya tiene el estado solicitado
      if (warehouse.isActive === isActive) {
        return {
          success: false,
          message: `Warehouse is already ${isActive ? 'active' : 'inactive'}`,
          warehouse,
        };
      }

      // Si se quiere activar
      if (isActive) {
        // Verificar que esté completo
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

        if (deactivatedWarehouses.length > 0) {
          this.logger.log(
            `ℹ️  Note: Products migration should be handled by a transversal service (e.g., ProductWarehouseMigrationService)`,
          );
        }

        return {
          success: true,
          message: `Warehouse activated successfully in ${country}`,
          warehouse,
          deactivatedWarehouses:
            deactivatedWarehouses.length > 0
              ? deactivatedWarehouses
              : undefined,
          countryCode: countryDoc.countryCode,
          warehouseId: warehouseId,
          warehouseName: warehouse.name || 'Unnamed',
        };
      } else {
        // Si se quiere desactivar
        warehouse.isActive = false;
        warehouse.updatedAt = new Date();

        // Buscar otro warehouse para activar automáticamente
        const bestCandidate = this.findBestActiveCandidate(
          countryDoc.warehouses.filter((w) => w._id.toString() !== warehouseId),
        );

        let warning: string | undefined;
        if (bestCandidate) {
          bestCandidate.isActive = true;
          bestCandidate.updatedAt = new Date();
          this.logger.log(
            `✅ Auto-activated alternative warehouse: ${bestCandidate.name}`,
          );
        } else {
          warning = `Warning: ${country} now has no active warehouses. Products cannot be assigned to FP warehouse until a warehouse is activated.`;
          this.logger.warn(`⚠️  ${warning}`);
        }

        await countryDoc.save();

        return {
          success: true,
          message: `Warehouse deactivated successfully in ${country}`,
          warehouse,
          warning,
        };
      }
    } catch (error) {
      this.logger.error(
        `Error toggling warehouse active state ${warehouseId} in ${country}:`,
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
