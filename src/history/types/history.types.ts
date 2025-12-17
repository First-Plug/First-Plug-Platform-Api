/**
 * 📋 Tipos compartidos para el sistema de History/Activity
 * Centraliza las definiciones para evitar duplicación y mantener consistencia
 */

export type HistoryActionType =
  | 'create'
  | 'update'
  | 'delete'
  | 'bulk-delete'
  | 'bulk-create'
  | 'offboarding'
  | 'return'
  | 'relocate'
  | 'assign'
  | 'reassign'
  | 'unassign'
  | 'cancel'
  | 'consolidate';

export type HistoryContext =
  | 'single-product'
  | 'shipment-merge'
  | 'member-address-update'
  // 🔄 Legacy contexts from production (for backward compatibility)
  | 'setup-default-office'
  | 'office-address-update';

export type HistoryItemType =
  | 'members'
  | 'teams'
  | 'assets'
  | 'shipments'
  | 'offices'
  | 'quotes';

export type HistoryData = Record<string, any> | Record<string, any>[] | null;

/**
 * 🔍 Interface para detectar registros legacy vs nuevos
 */
export interface LegacyDetectionCriteria {
  hasLegacyContext: boolean;
  hasFormattedData: boolean;
  createdBefore: boolean;
  hasWarehouseCountryCode: boolean;
}
