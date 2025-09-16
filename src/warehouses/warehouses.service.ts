import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Warehouse,
  WarehouseDocument,
  WarehouseItem,
} from './schemas/warehouse.schema';
import { CreateWarehouseDto, UpdateWarehouseDto } from './dto';
import { DEFAULT_PARTNER_TYPE } from './constants/warehouse.constants';

@Injectable()
export class WarehousesService {
  private readonly logger = new Logger(WarehousesService.name);

  constructor(
    @InjectModel(Warehouse.name)
    private warehouseModel: Model<WarehouseDocument>,
  ) {}

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
   * Activar un warehouse específico (solo si está completo)
   */
  async activateWarehouse(
    country: string,
    warehouseId: string,
  ): Promise<{
    activated: boolean;
    message: string;
    deactivatedWarehouses?: string[];
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
      };

      this.logger.log(`✅ ${result.message}`);
      if (deactivatedWarehouses.length > 0) {
        this.logger.log(
          `📋 Deactivated warehouses: ${deactivatedWarehouses.join(', ')}`,
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
