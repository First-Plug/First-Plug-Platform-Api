/**
 * 🔧 Asset History Compatibility Layer
 * Normaliza registros legacy de assets para que sean compatibles con el frontend
 * sin romper la funcionalidad existente
 */

import { LegacyRecordDetector } from './legacy-detector.helper';

export class AssetHistoryCompatibility {
  /**
   * 🎯 Normalizar registro de asset para el frontend
   * Detecta si es legacy y aplica las transformaciones necesarias
   */
  static normalizeAssetRecordForFrontend(record: any): any {
    if (!record || record.itemType !== 'assets') {
      return record; // No es asset, devolver sin cambios
    }

    if (!LegacyRecordDetector.isLegacyRecord(record)) {
      return record; // Ya está en formato nuevo, devolver sin cambios
    }

    // Es legacy, aplicar normalización
    const normalizedRecord = { ...record };

    if (normalizedRecord.changes) {
      normalizedRecord.changes = {
        ...normalizedRecord.changes,
        oldData: this.normalizeLegacyAssetData(
          normalizedRecord.changes.oldData,
        ),
        newData: this.normalizeLegacyAssetData(
          normalizedRecord.changes.newData,
        ),
      };
    }

    return normalizedRecord;
  }

  /**
   * 🔧 Normalizar datos de asset legacy a formato esperado por frontend
   */
  private static normalizeLegacyAssetData(data: any): any {
    if (!data) return data;

    // Si es array, normalizar cada elemento
    if (Array.isArray(data)) {
      return data.map((item) => this.normalizeLegacyAssetData(item));
    }

    if (typeof data !== 'object') return data;

    // Crear objeto normalizado sin campos internos de MongoDB
    const normalized: any = {};

    // 🎯 Campos esenciales que siempre se incluyen
    const essentialFields = [
      'name',
      'category',
      'serialNumber',
      'location',
      'status',
      'assignedEmail',
      'assignedMember',
    ];

    // 📋 Campos opcionales que se incluyen si existen
    const optionalFields = [
      'recoverable',
      'productCondition',
      'price',
      'acquisitionDate',
      'additionalInfo',
      'lastAssigned',
      'country', // 🏳️ Country code para mostrar banderas
    ];

    // Incluir campos esenciales
    essentialFields.forEach((field) => {
      if (data.hasOwnProperty(field)) {
        normalized[field] = data[field];
      }
    });

    // Incluir campos opcionales si existen
    optionalFields.forEach((field) => {
      if (
        data.hasOwnProperty(field) &&
        data[field] !== null &&
        data[field] !== undefined
      ) {
        normalized[field] = data[field];
      }
    });

    // 🏷️ Mantener attributes como array (el frontend lo espera así)
    if (data.attributes && Array.isArray(data.attributes)) {
      normalized.attributes = data.attributes; // Mantener como array original
    }

    // 🌍 Agregar country code para Employee locations si es posible
    if (data.location === 'Employee' && data.assignedMember) {
      // Intentar extraer country code del member name si está disponible
      const countryCode = this.extractCountryCodeFromMember(
        data.assignedMember,
      );
      if (countryCode) {
        normalized.memberCountryCode = countryCode;
      }
    }

    // 🏭 Para FP warehouse, mantener location simple (sin transformar en legacy)
    if (data.location === 'FP warehouse') {
      normalized.location = 'FP warehouse';
      // No agregar warehouseCountryCode en registros legacy
    }

    return normalized;
  }

  /**
   * 🌍 Intentar extraer country code del nombre del member
   * Esto es un best-effort, puede no funcionar siempre
   */
  private static extractCountryCodeFromMember(
    memberName: string,
  ): string | null {
    if (!memberName || typeof memberName !== 'string') return null;

    // Patrones comunes que podrían indicar país
    // Esto es heurístico y puede no ser 100% preciso
    const patterns = [
      /\(([A-Z]{2})\)$/, // "John Doe (AR)"
      /\[([A-Z]{2})\]$/, // "John Doe [AR]"
      /-([A-Z]{2})$/, // "John Doe-AR"
      /_([A-Z]{2})$/, // "John Doe_AR"
    ];

    for (const pattern of patterns) {
      const match = memberName.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null; // No se pudo extraer
  }

  /**
   * 🎯 Normalizar múltiples registros de assets
   */
  static normalizeAssetRecordsForFrontend(records: any[]): any[] {
    if (!Array.isArray(records)) return records;

    return records.map((record) =>
      this.normalizeAssetRecordForFrontend(record),
    );
  }

  /**
   * 🔍 Verificar si un registro de asset necesita normalización
   */
  static needsNormalization(record: any): boolean {
    return (
      record &&
      record.itemType === 'assets' &&
      LegacyRecordDetector.isLegacyRecord(record)
    );
  }
}
