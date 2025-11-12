import { Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { OfficesService } from '../../offices/offices.service';
import { TenantsService } from '../../tenants/tenants.service';
import { OfficeNormalizationHelper } from '../../common/helpers/office-normalization.helper';
import { CountryHelper } from '../../common/helpers/country.helper';

/**
 * 🏢 CSV Office Coordinator Service
 * Servicio transversal para coordinar la creación/búsqueda de oficinas desde CSV
 * Maneja los 4 escenarios de oficinas según los requerimientos
 */

export interface OfficeAssignmentResult {
  success: boolean;
  officeId?: string;
  office?: {
    officeId: Types.ObjectId;
    officeCountryCode: string;
    officeName: string;
    assignedAt: Date;
    isDefault: boolean;
  };
  message?: string;
  wasCreated?: boolean;
}

@Injectable()
export class CSVOfficeCoordinatorService {
  private readonly logger = new Logger(CSVOfficeCoordinatorService.name);

  constructor(
    private readonly officesService: OfficesService,
    private readonly tenantsService: TenantsService,
  ) {}

  /**
   * Maneja la asignación de oficina para productos CSV
   * Implementa los 4 escenarios:
   * a. país nuevo + nombre nuevo → crear oficina nueva
   * b. país nuevo + nombre existente → crear oficina nueva
   * c. país existente + nombre nuevo → crear oficina nueva
   * d. país existente + nombre existente → usar oficina existente
   */
  async handleOfficeAssignmentForCSV(
    country: string,
    officeName: string,
    tenantName: string,
    userId: string,
  ): Promise<OfficeAssignmentResult> {
    try {
      // 1. Validar inputs
      if (!country || !officeName || !tenantName) {
        return {
          success: false,
          message: 'Country, office name, and tenant name are required',
        };
      }

      // 2. Normalizar datos
      const normalizedCountry = CountryHelper.normalizeCountryCode(country);

      // 3. Validar país
      if (!CountryHelper.isValidCountryCode(normalizedCountry)) {
        return {
          success: false,
          message: `Invalid country code: ${country}. Must be a valid ISO 3166-1 alpha-2 code.`,
        };
      }

      // 4. Validar nombre de oficina
      if (!OfficeNormalizationHelper.isValidOfficeName(officeName)) {
        return {
          success: false,
          message: `Invalid office name: ${officeName}`,
        };
      }

      this.logger.log(
        `🔍 [handleOfficeAssignmentForCSV] Searching for office: ${officeName} in ${normalizedCountry} for tenant ${tenantName}`,
      );

      // 5. Buscar oficina existente (case-insensitive, sin tildes)
      const existingOffice = await this.findExistingOffice(
        normalizedCountry,
        officeName,
        tenantName,
      );

      if (existingOffice) {
        // ESCENARIO D: país existente + nombre existente → usar oficina existente
        this.logger.log(
          `✅ [handleOfficeAssignmentForCSV] Found existing office: ${existingOffice.name} (${existingOffice._id})`,
        );

        return {
          success: true,
          officeId: existingOffice._id.toString(),
          office: {
            officeId: existingOffice._id,
            officeCountryCode: existingOffice.country,
            officeName: existingOffice.name,
            assignedAt: new Date(),
            isDefault: existingOffice.isDefault,
          },
          message: `Using existing office: ${existingOffice.name}`,
          wasCreated: false,
        };
      }

      // ESCENARIOS A, B, C: crear oficina nueva
      this.logger.log(
        `🏗️ [handleOfficeAssignmentForCSV] Creating new office: ${officeName} in ${normalizedCountry}`,
      );

      const newOffice = await this.createNewOffice(
        normalizedCountry,
        officeName,
        tenantName,
        userId,
      );

      return {
        success: true,
        officeId: newOffice._id.toString(),
        office: {
          officeId: newOffice._id,
          officeCountryCode: newOffice.country,
          officeName: newOffice.name,
          assignedAt: new Date(),
          isDefault: newOffice.isDefault,
        },
        message: `Created new office: ${newOffice.name}`,
        wasCreated: true,
      };
    } catch (error) {
      this.logger.error(
        `❌ [handleOfficeAssignmentForCSV] Error handling office assignment:`,
        error,
      );
      return {
        success: false,
        message: `Error handling office assignment: ${error.message}`,
      };
    }
  }

  /**
   * Busca una oficina existente usando normalización
   */
  private async findExistingOffice(
    country: string,
    officeName: string,
    tenantName: string,
  ) {
    try {
      const offices = await this.officesService.findAllByTenantName(tenantName);

      // Buscar oficina que coincida en país y nombre (normalizado)
      return offices.find((office) => {
        const countryMatch = office.country === country;
        const nameMatch = OfficeNormalizationHelper.areOfficeNamesEquivalent(
          office.name,
          officeName,
        );
        return countryMatch && nameMatch;
      });
    } catch (error) {
      this.logger.error(
        `❌ [findExistingOffice] Error searching for office:`,
        error,
      );
      return null;
    }
  }

  /**
   * Crea una nueva oficina
   */
  private async createNewOffice(
    country: string,
    officeName: string,
    tenantName: string,
    userId: string,
  ) {
    // Obtener tenant info para crear la oficina
    const tenantInfo = await this.getTenantInfo(tenantName);

    const createOfficeDto = {
      name: officeName.trim(),
      country: country,
      email: '',
      phone: '',
      address: '',
      apartment: '',
      city: '',
      state: '',
      zipCode: '',
      isDefault: false, // Se determinará automáticamente si es la primera
    };

    return await this.officesService.createOffice(
      tenantName,
      tenantInfo.tenantId,
      createOfficeDto,
      userId,
    );
  }

  /**
   * Obtiene información del tenant
   */
  private async getTenantInfo(
    tenantName: string,
  ): Promise<{ tenantId: Types.ObjectId }> {
    const tenant = await this.tenantsService.getByTenantName(tenantName);
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantName}`);
    }
    return {
      tenantId: tenant._id,
    };
  }
}
