import { Injectable, Logger } from '@nestjs/common';
import { ProductDocument } from '../schemas/product.schema';

export interface LocationChangeParams {
  currentLocation: 'Employee' | 'FP warehouse' | 'Our office';
  newLocation: 'Employee' | 'FP warehouse' | 'Our office';
  currentAssignedEmail?: string;
  currentLastAssigned?: string;
  currentFpWarehouse?: {
    warehouseCountryCode?: string;
    warehouseName?: string;
  };
  actionType?: 'assign' | 'reassign' | 'return' | 'relocate' | 'offboarding';
}

@Injectable()
export class LastAssignedHelper {
  private readonly logger = new Logger(LastAssignedHelper.name);

  /**
   * Calcula el valor de lastAssigned basado en el movimiento del producto
   *
   * REGLAS:
   * 1. Si sale de Employee → preservar email del member
   * 2. Si sale de FP warehouse → preservar "FP warehouse - {countryCode}"
   * 3. Si sale de Our office → preservar "Our office"
   * 4. Si no hay cambio de ubicación → mantener lastAssigned actual
   */
  calculateLastAssigned(params: LocationChangeParams): string | undefined {
    const {
      currentLocation,
      newLocation,
      currentAssignedEmail,
      currentLastAssigned,
      currentFpWarehouse,
      actionType,
    } = params;

    this.logger.log(`🔄 Calculating lastAssigned:`, {
      currentLocation,
      newLocation,
      currentAssignedEmail,
      currentLastAssigned,
      currentFpWarehouse,
      actionType,
    });

    // Si no hay cambio de ubicación, mantener lastAssigned actual
    if (currentLocation === newLocation) {
      return currentLastAssigned;
    }

    // CASO 1: Sale de Employee (member) → preservar email del member
    if (currentLocation === 'Employee' && newLocation !== 'Employee') {
      const lastAssigned = currentAssignedEmail || currentLastAssigned;

      return lastAssigned;
    }

    // CASO 2: Sale de FP warehouse → preservar warehouse info
    if (currentLocation === 'FP warehouse' && newLocation !== 'FP warehouse') {
      const warehouseInfo =
        this.formatWarehouseLastAssigned(currentFpWarehouse);

      return warehouseInfo || currentLastAssigned;
    }

    // CASO 3: Sale de Our office → preservar "Our office"
    if (currentLocation === 'Our office' && newLocation !== 'Our office') {
      return 'Our office';
    }

    // CASO 4: Otros casos → mantener lastAssigned actual

    return currentLastAssigned;
  }

  /**
   * Formatea la información del warehouse para lastAssigned
   */
  private formatWarehouseLastAssigned(fpWarehouse?: {
    warehouseCountryCode?: string;
    warehouseName?: string;
  }): string | undefined {
    if (!fpWarehouse?.warehouseCountryCode) {
      return undefined;
    }

    return `FP warehouse - ${fpWarehouse.warehouseCountryCode}`;
  }

  /**
   * Extrae información de ubicación desde un producto
   */
  extractLocationInfo(product: ProductDocument): {
    location: 'Employee' | 'FP warehouse' | 'Our office';
    assignedEmail?: string;
    lastAssigned?: string;
    fpWarehouse?: {
      warehouseCountryCode?: string;
      warehouseName?: string;
    };
  } {
    return {
      location: product.location as 'Employee' | 'FP warehouse' | 'Our office',
      assignedEmail: product.assignedEmail,
      lastAssigned: product.lastAssigned,
      fpWarehouse: product.fpWarehouse
        ? {
            warehouseCountryCode: product.fpWarehouse.warehouseCountryCode,
            warehouseName: product.fpWarehouse.warehouseName,
          }
        : undefined,
    };
  }

  /**
   * Calcula lastAssigned para un producto específico durante una actualización
   */
  calculateForProductUpdate(
    currentProduct: ProductDocument,
    newLocation: 'Employee' | 'FP warehouse' | 'Our office',
    actionType?: 'assign' | 'reassign' | 'return' | 'relocate' | 'offboarding',
  ): string | undefined {
    const currentInfo = this.extractLocationInfo(currentProduct);

    return this.calculateLastAssigned({
      currentLocation: currentInfo.location,
      newLocation,
      currentAssignedEmail: currentInfo.assignedEmail,
      currentLastAssigned: currentInfo.lastAssigned,
      currentFpWarehouse: currentInfo.fpWarehouse,
      actionType,
    });
  }
}
