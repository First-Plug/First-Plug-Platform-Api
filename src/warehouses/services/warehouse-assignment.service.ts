import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Warehouse, WarehouseDocument } from '../schemas/warehouse.schema';
import { countryCodes } from '../../shipments/helpers/countryCodes';

export interface WarehouseAssignmentResult {
  success: boolean;
  warehouseId?: string;
  warehouseCountryCode?: string;
  warehouseName?: string;
  country?: string;
  message: string;
  requiresSlackNotification?: boolean;
  slackMessage?: string;
}

@Injectable()
export class WarehouseAssignmentService {
  private readonly logger = new Logger(WarehouseAssignmentService.name);

  constructor(
    @InjectModel(Warehouse.name, 'firstPlug')
    private warehouseModel: Model<WarehouseDocument>,
  ) {}

  /**
   * Asignar un producto a un warehouse basado en el país de origen
   */
  async assignProductToWarehouse(
    originCountry: string,
    tenantName: string,
    productId: string,
    productCategory: string,
  ): Promise<WarehouseAssignmentResult> {
    try {
      // 1. Determinar código de país
      const countryCode = this.getCountryCode(originCountry);
      if (!countryCode) {
        return {
          success: false,
          message: `Unknown country: ${originCountry}`,
          requiresSlackNotification: true,
          slackMessage: `🚨 Unknown country detected: "${originCountry}" for tenant ${tenantName}. Please add this country to the system.`,
        };
      }

      // 2. Buscar warehouse activo en ese país
      const countryDoc = await this.warehouseModel.findOne({
        countryCode,
        hasActiveWarehouse: true,
      });

      if (!countryDoc) {
        return {
          success: false,
          message: `No warehouse found for country: ${originCountry} (${countryCode})`,
          requiresSlackNotification: true,
          slackMessage: `🏭 No warehouse available in ${originCountry} (${countryCode}) for tenant ${tenantName}. Product ${productId} (${productCategory}) needs warehouse assignment. Please set up a partner in this country.`,
        };
      }

      // 3. Encontrar el warehouse activo
      const activeWarehouse = countryDoc.warehouses.find(
        (w) => w.isActive && !w.isDeleted,
      );

      if (!activeWarehouse) {
        return {
          success: false,
          message: `No active warehouse in ${originCountry}`,
          requiresSlackNotification: true,
          slackMessage: `⚠️ Country ${originCountry} has warehouses but none are active for tenant ${tenantName}. Product ${productId} (${productCategory}) cannot be assigned. Please activate a warehouse.`,
        };
      }

      // 4. Asignación exitosa
      this.logger.log(
        `✅ Product ${productId} assigned to warehouse ${activeWarehouse.name} in ${originCountry}`,
      );

      return {
        success: true,
        warehouseId: activeWarehouse._id.toString(),
        warehouseCountryCode: countryCode,
        warehouseName: activeWarehouse.name || 'Unnamed Warehouse',
        country: originCountry,
        message: `Product assigned to ${activeWarehouse.name || 'Unnamed Warehouse'} in ${originCountry}`,
      };
    } catch (error) {
      this.logger.error(`Error assigning product to warehouse:`, error);
      return {
        success: false,
        message: `Error during warehouse assignment: ${error.message}`,
        requiresSlackNotification: true,
        slackMessage: `🔥 Error assigning product ${productId} for tenant ${tenantName}: ${error.message}`,
      };
    }
  }

  /**
   * Obtener código de país desde el nombre
   */
  private getCountryCode(countryName: string): string | null {
    // Buscar exacto primero
    if (countryCodes[countryName]) {
      return countryCodes[countryName];
    }

    // Buscar case-insensitive
    const lowerCountryName = countryName.toLowerCase();
    for (const [name, code] of Object.entries(countryCodes)) {
      if (name.toLowerCase() === lowerCountryName) {
        return code;
      }
    }

    return null;
  }

  /**
   * Validar si un país tiene warehouse activo
   */
  async validateCountryHasActiveWarehouse(countryName: string): Promise<{
    hasWarehouse: boolean;
    countryCode?: string;
    warehouseId?: string;
    warehouseName?: string;
  }> {
    const countryCode = this.getCountryCode(countryName);
    if (!countryCode) {
      return { hasWarehouse: false };
    }

    const countryDoc = await this.warehouseModel.findOne({
      countryCode,
      hasActiveWarehouse: true,
    });

    if (!countryDoc) {
      return { hasWarehouse: false, countryCode };
    }

    const activeWarehouse = countryDoc.warehouses.find(
      (w) => w.isActive && !w.isDeleted,
    );

    if (!activeWarehouse) {
      return { hasWarehouse: false, countryCode };
    }

    return {
      hasWarehouse: true,
      countryCode,
      warehouseId: activeWarehouse._id.toString(),
      warehouseName: activeWarehouse.name || 'Unnamed Warehouse',
    };
  }

  /**
   * Obtener lista de países sin warehouses activos
   */
  async getCountriesWithoutActiveWarehouses(): Promise<string[]> {
    const allCountries = Object.keys(countryCodes);
    const countriesWithWarehouses = await this.warehouseModel
      .find({
        hasActiveWarehouse: true,
      })
      .select('country');

    const countriesWithActiveWarehouses = countriesWithWarehouses.map(
      (doc) => doc.country,
    );

    return allCountries.filter(
      (country) => !countriesWithActiveWarehouses.includes(country),
    );
  }
}
