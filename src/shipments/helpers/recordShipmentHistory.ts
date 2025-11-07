import { CreateHistoryDto } from 'src/history/dto/create-history.dto';
import { HistoryService } from 'src/history/history.service';
import { ShipmentHistoryFormatter } from 'src/history/helpers/history-formatters.helper';
import { ShipmentDocument } from 'src/shipments/schema/shipment.schema';
import { HistoryContext } from 'src/history/types/history.types';

export async function recordShipmentHistory(
  historyService: HistoryService,
  actionType: 'create' | 'consolidate' | 'update' | 'cancel' | 'delete',
  userId: string,
  oldData: Partial<ShipmentDocument> | null = null,
  newData: Partial<ShipmentDocument> | null = null,
  context?: HistoryContext,
) {
  const historyPayload: CreateHistoryDto = {
    actionType,
    itemType: 'shipments',
    userId,
    changes: {
      oldData,
      newData,
      context,
    },
  };

  if (oldData) {
    historyPayload.changes['oldData'] = oldData;
  }

  if (newData) {
    historyPayload.changes['newData'] = newData;
  }

  await historyService.create(historyPayload);
}

/**
 * 🚢 Registrar history de shipments con formato mejorado (NUEVA FUNCIÓN)
 * Incluye detalles específicos de origin/destination según tus lineamientos
 */
export async function recordEnhancedShipmentHistory(
  historyService: HistoryService,
  actionType: 'create' | 'consolidate' | 'update' | 'cancel' | 'delete',
  userId: string,
  oldShipment: ShipmentDocument | null = null,
  newShipment: ShipmentDocument | null = null,
  context?: HistoryContext,
  locationData?: {
    origin?: {
      officeName?: string;
      officeCountry?: string;
      warehouseCountry?: string;
      warehouseName?: string;
      memberName?: string;
      memberCountry?: string;
    };
    destination?: {
      officeName?: string;
      officeCountry?: string;
      warehouseCountry?: string;
      warehouseName?: string;
      memberName?: string;
      memberCountry?: string;
    };
  },
) {
  let oldData: any = null;
  let newData: any = null;

  if (oldShipment) {
    oldData = ShipmentHistoryFormatter.formatShipmentData(
      oldShipment,
      locationData?.origin,
      locationData?.destination,
    );
  }

  if (newShipment) {
    newData = ShipmentHistoryFormatter.formatShipmentData(
      newShipment,
      locationData?.origin,
      locationData?.destination,
    );
  }

  const historyPayload: CreateHistoryDto = {
    actionType,
    itemType: 'shipments',
    userId,
    changes: {
      oldData,
      newData,
      context,
    },
  };

  await historyService.create(historyPayload);
}

/**
 * 🎯 Helper para decidir qué función de shipment history usar
 * Recomienda usar Enhanced para nuevos desarrollos, Original para compatibilidad
 */
export const ShipmentHistoryHelper = {
  /**
   * 📦 Usar función original (compatible con registros legacy)
   * Recomendado para: migraciones, compatibilidad hacia atrás
   */
  useOriginal: recordShipmentHistory,

  /**
   * 🚀 Usar función Enhanced (formato nuevo con location details)
   * Recomendado para: nuevos desarrollos, funcionalidades que requieren origin/destination details
   */
  useEnhanced: recordEnhancedShipmentHistory,

  /**
   * 🤔 Decidir automáticamente qué función usar basado en contexto
   */
  auto: async (
    historyService: HistoryService,
    actionType: 'create' | 'consolidate' | 'update' | 'cancel' | 'delete',
    userId: string,
    oldShipment: ShipmentDocument | null = null,
    newShipment: ShipmentDocument | null = null,
    context?: HistoryContext,
    options?: {
      preferEnhanced?: boolean;
      locationData?: {
        origin?: {
          officeName?: string;
          officeCountry?: string;
          warehouseCountry?: string;
          warehouseName?: string;
          memberName?: string;
          memberCountry?: string;
        };
        destination?: {
          officeName?: string;
          officeCountry?: string;
          warehouseCountry?: string;
          warehouseName?: string;
          memberName?: string;
          memberCountry?: string;
        };
      };
    },
  ) => {
    // Si se especifica preferencia por Enhanced y se tienen location data
    if (options?.preferEnhanced && options.locationData) {
      return recordEnhancedShipmentHistory(
        historyService,
        actionType,
        userId,
        oldShipment,
        newShipment,
        context,
        options.locationData,
      );
    }

    // Fallback a función original
    return recordShipmentHistory(
      historyService,
      actionType,
      userId,
      oldShipment,
      newShipment,
      context,
    );
  },
};
