import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Warehouse,
  WarehouseDocument,
  WarehouseItem,
} from './schemas/warehouse.schema';
import { CreateWarehouseDto, UpdateWarehouseDto } from './dto';
import {
  DEFAULT_COMMUNICATION_CHANNEL,
  DEFAULT_PARTNER_TYPE,
} from './constants/warehouse.constants';

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
   * Actualizar un warehouse específico
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

      // Si se quiere activar este warehouse, desactivar los demás
      if (updateWarehouseDto.isActive) {
        countryDoc.warehouses.forEach((w, index) => {
          if (index !== warehouseIndex && !w.isDeleted) {
            w.isActive = false;
          }
        });
      }

      // Actualizar el warehouse
      const warehouse = countryDoc.warehouses[warehouseIndex];
      Object.assign(warehouse, updateWarehouseDto, { updatedAt: new Date() });

      await countryDoc.save();

      this.logger.log(`✅ Warehouse updated in ${country}: ${warehouse.name}`);
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
   * Activar un warehouse específico (desactiva los demás del país)
   */
  async activateWarehouse(
    country: string,
    warehouseId: string,
  ): Promise<WarehouseItem> {
    try {
      return await this.updateWarehouse(country, warehouseId, {
        isActive: true,
      });
    } catch (error) {
      this.logger.error(
        `Error activating warehouse ${warehouseId} in ${country}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Soft delete de un warehouse
   */
  async deleteWarehouse(country: string, warehouseId: string): Promise<void> {
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

      // Soft delete
      warehouse.isDeleted = true;
      warehouse.deletedAt = new Date();
      warehouse.isActive = false; // También desactivar

      await countryDoc.save();

      this.logger.log(
        `✅ Warehouse soft deleted in ${country}: ${warehouse.name}`,
      );
    } catch (error) {
      this.logger.error(
        `Error deleting warehouse ${warehouseId} in ${country}:`,
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
        return warehouse?.isRealPartner || false;
      } else {
        const activeWarehouse =
          await this.findActiveWarehouseByCountry(country);
        return activeWarehouse?.isRealPartner || false;
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
        canal: DEFAULT_COMMUNICATION_CHANNEL, // Default canal de comunicación
        isActive: false, // Inactivo hasta que se actualice con datos reales
        additionalInfo: '', // Vacío - será completado por SuperAdmin
        partnerType: DEFAULT_PARTNER_TYPE,
        isRealPartner: false, // No es partner real hasta que se actualice
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
   * Verificar si un país tiene al menos un warehouse real (no placeholder)
   */
  async hasRealPartner(country: string): Promise<boolean> {
    try {
      const countryDoc = await this.findByCountry(country);
      if (!countryDoc) return false;

      return countryDoc.warehouses.some((w) => !w.isDeleted && w.isRealPartner);
    } catch (error) {
      this.logger.error(`Error checking if country has real partner:`, error);
      return false;
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
