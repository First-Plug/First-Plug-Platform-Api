/**
 * 🔍 Legacy Record Detector
 * Detecta si un registro de history es legacy (producción) o nuevo (desarrollo)
 * basado en múltiples criterios de estructura y contenido
 */

import { LegacyDetectionCriteria } from '../types/history.types';

export class LegacyRecordDetector {
  /**
   * 🎯 Fecha de corte para considerar registros como legacy
   * Ajustar esta fecha según cuando se haga el deploy de la nueva estructura
   */
  private static readonly MIGRATION_CUTOFF_DATE = new Date(
    '2024-12-01T00:00:00Z',
  );

  /**
   * 🔍 Contexts que solo existían en producción (legacy)
   */
  private static readonly LEGACY_CONTEXTS = [
    'setup-default-office',
    'office-address-update',
  ];

  /**
   * 🎯 Función principal para detectar si un registro es legacy
   */
  static isLegacyRecord(record: any): boolean {
    if (!record) return false;

    const criteria = this.analyzeLegacyCriteria(record);

    // Un registro es legacy si cumple CUALQUIERA de estos criterios:
    return (
      criteria.hasLegacyContext || // Tiene context que solo existía en producción
      criteria.createdBefore || // Fue creado antes de la migración
      criteria.hasUnformattedAssetData || // Assets sin formatear (estructura vieja)
      criteria.lacksWarehouseCountryCode || // No tiene warehouseCountryCode en FP warehouse
      criteria.hasSimpleOfficeDelete // Office delete sin nonRecoverableProducts
    );
  }

  /**
   * 🔍 Analizar criterios específicos para detección legacy
   */
  static analyzeLegacyCriteria(record: any): LegacyDetectionCriteria & {
    hasUnformattedAssetData: boolean;
    lacksWarehouseCountryCode: boolean;
    hasSimpleOfficeDelete: boolean;
    createdBefore: boolean;
  } {
    const createdAt = record.createdAt
      ? new Date(record.createdAt)
      : new Date();

    return {
      // Context legacy
      hasLegacyContext: this.hasLegacyContext(record),

      // Timestamp anterior a migración
      createdBefore: createdAt < this.MIGRATION_CUTOFF_DATE,

      // Assets sin formatear (estructura completa vs selectiva)
      hasUnformattedAssetData: this.hasUnformattedAssetData(record),

      // FP warehouse sin warehouseCountryCode
      lacksWarehouseCountryCode: this.lacksWarehouseCountryCode(record),

      // Office delete simple (sin nonRecoverableProducts)
      hasSimpleOfficeDelete: this.hasSimpleOfficeDelete(record),

      // Campos requeridos para interface
      hasFormattedData: this.hasFormattedData(record),
      hasWarehouseCountryCode: this.hasWarehouseCountryCode(record),
    };
  }

  /**
   * 🔍 Verificar si tiene context legacy
   */
  private static hasLegacyContext(record: any): boolean {
    const context = record.changes?.context;
    return context && this.LEGACY_CONTEXTS.includes(context);
  }

  /**
   * 🔍 Verificar si assets tienen estructura sin formatear (legacy)
   */
  private static hasUnformattedAssetData(record: any): boolean {
    if (record.itemType !== 'assets') return false;

    const { oldData, newData } = record.changes || {};

    // En registros legacy, los assets tienen TODOS los campos del producto
    // En registros nuevos, solo tienen campos específicos o formateados

    // Verificar oldData
    if (oldData && this.isUnformattedAssetData(oldData)) return true;

    // Verificar newData
    if (newData && this.isUnformattedAssetData(newData)) return true;

    return false;
  }

  /**
   * 🔍 Verificar si un objeto de asset data es sin formatear (legacy)
   */
  private static isUnformattedAssetData(data: any): boolean {
    if (!data || typeof data !== 'object') return false;

    // Registros legacy tienen campos internos de MongoDB
    const hasMongoFields =
      data._id || data.__v || data.createdAt || data.updatedAt;

    // Registros legacy tienen TODOS los campos del producto
    const hasAllProductFields =
      data.hasOwnProperty('name') &&
      data.hasOwnProperty('category') &&
      data.hasOwnProperty('serialNumber') &&
      data.hasOwnProperty('location') &&
      data.hasOwnProperty('status') &&
      data.hasOwnProperty('recoverable') &&
      data.hasOwnProperty('attributes') &&
      data.hasOwnProperty('acquisitionDate');

    // Registros nuevos tienen estructura más selectiva y limpia
    const hasSelectiveFields =
      Object.keys(data).length < 10 && // Menos campos
      !hasMongoFields; // Sin campos internos de MongoDB

    return hasMongoFields || (hasAllProductFields && !hasSelectiveFields);
  }

  /**
   * 🔍 Verificar si carece de warehouseCountryCode en FP warehouse
   */
  private static lacksWarehouseCountryCode(record: any): boolean {
    const { oldData, newData } = record.changes || {};

    // Verificar en oldData
    if (this.hasFPWarehouseWithoutCountryCode(oldData)) return true;

    // Verificar en newData
    if (this.hasFPWarehouseWithoutCountryCode(newData)) return true;

    return false;
  }

  /**
   * 🔍 Verificar si tiene FP warehouse sin country code
   */
  private static hasFPWarehouseWithoutCountryCode(data: any): boolean {
    if (!data) return false;

    // Si es array, verificar cada elemento
    if (Array.isArray(data)) {
      return data.some((item) => this.hasFPWarehouseWithoutCountryCode(item));
    }

    // Si es objeto con location "FP warehouse" pero sin warehouseCountryCode
    if (data.location === 'FP warehouse' && !data.warehouseCountryCode) {
      return true;
    }

    return false;
  }

  /**
   * 🔍 Verificar si es office delete simple (sin nonRecoverableProducts)
   */
  private static hasSimpleOfficeDelete(record: any): boolean {
    if (record.itemType !== 'offices' || record.actionType !== 'delete') {
      return false;
    }

    const { oldData } = record.changes || {};

    // Legacy: office delete no tiene nonRecoverableProducts
    // Nuevo: office delete tiene nonRecoverableProducts array
    return oldData && !oldData.hasOwnProperty('nonRecoverableProducts');
  }

  /**
   * 🔍 Verificar si tiene datos formateados (nuevo)
   */
  private static hasFormattedData(record: any): boolean {
    return !this.hasUnformattedAssetData(record);
  }

  /**
   * 🔍 Verificar si tiene warehouseCountryCode (nuevo)
   */
  private static hasWarehouseCountryCode(record: any): boolean {
    return !this.lacksWarehouseCountryCode(record);
  }
}
