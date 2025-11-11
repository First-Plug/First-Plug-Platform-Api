import { Injectable, Logger } from '@nestjs/common';
import { WarehousesService } from '../warehouses.service';
import { countryCodes } from '../../shipments/helpers/countryCodes';

@Injectable()
export class InitializeWarehousesScript {
  private readonly logger = new Logger(InitializeWarehousesScript.name);

  constructor(private readonly warehousesService: WarehousesService) {}

  /**
   * Inicializar todos los países con warehouses vacíos
   * Usa el archivo countryCodes.ts existente
   */
  async initializeAllCountries(): Promise<void> {
    try {
      this.logger.log('🚀 Starting warehouses initialization for all countries...');
      
      const countries = Object.keys(countryCodes);
      let successCount = 0;
      let skipCount = 0;
      let errorCount = 0;

      for (const country of countries) {
        try {
          const countryCode = countryCodes[country];
          
          // Verificar si ya existe
          const existingCountry = await this.warehousesService.findByCountry(country);
          if (existingCountry) {
            this.logger.log(`⏭️  Country ${country} already exists, skipping...`);
            skipCount++;
            continue;
          }

          // Inicializar país completo
          await this.warehousesService.initializeCountry(country, countryCode);
          successCount++;
          
          this.logger.log(`✅ Initialized: ${country} (${countryCode})`);
        } catch (error) {
          errorCount++;
          this.logger.error(`❌ Failed to initialize ${country}:`, error.message);
        }
      }

      this.logger.log(`
🎉 Warehouses initialization completed!
📊 Summary:
   ✅ Successfully initialized: ${successCount} countries
   ⏭️  Already existed (skipped): ${skipCount} countries  
   ❌ Failed: ${errorCount} countries
   📦 Total countries processed: ${countries.length}
      `);

    } catch (error) {
      this.logger.error('💥 Fatal error during warehouses initialization:', error);
      throw error;
    }
  }

  /**
   * Inicializar un país específico
   */
  async initializeCountry(country: string): Promise<void> {
    try {
      const countryCode = countryCodes[country];
      if (!countryCode) {
        throw new Error(`Country code not found for: ${country}`);
      }

      await this.warehousesService.initializeCountry(country, countryCode);
      this.logger.log(`✅ Country ${country} initialized successfully`);
    } catch (error) {
      this.logger.error(`❌ Failed to initialize country ${country}:`, error);
      throw error;
    }
  }

  /**
   * Verificar el estado de inicialización
   */
  async checkInitializationStatus(): Promise<{
    totalCountries: number;
    initializedCountries: number;
    missingCountries: string[];
    countriesWithRealPartners: number;
  }> {
    try {
      const allCountries = Object.keys(countryCodes);
      const initializedWarehouses = await this.warehousesService.findAll();
      
      const initializedCountryNames = initializedWarehouses.map(w => w.country);
      const missingCountries = allCountries.filter(
        country => !initializedCountryNames.includes(country)
      );

      let countriesWithRealPartners = 0;
      for (const warehouse of initializedWarehouses) {
        const hasRealPartner = await this.warehousesService.hasRealPartner(warehouse.country);
        if (hasRealPartner) {
          countriesWithRealPartners++;
        }
      }

      const status = {
        totalCountries: allCountries.length,
        initializedCountries: initializedCountryNames.length,
        missingCountries,
        countriesWithRealPartners,
      };

      this.logger.log(`
📊 Warehouses Initialization Status:
   🌍 Total countries in system: ${status.totalCountries}
   ✅ Countries initialized: ${status.initializedCountries}
   ❌ Missing countries: ${status.missingCountries.length}
   🏢 Countries with real partners: ${status.countriesWithRealPartners}
   📦 Countries with default warehouses only: ${status.initializedCountries - status.countriesWithRealPartners}
      `);

      if (status.missingCountries.length > 0) {
        this.logger.log(`Missing countries: ${status.missingCountries.join(', ')}`);
      }

      return status;
    } catch (error) {
      this.logger.error('Error checking initialization status:', error);
      throw error;
    }
  }
}
