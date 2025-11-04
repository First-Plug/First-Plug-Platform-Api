import { CreateHistoryDto } from 'src/history/dto/create-history.dto';
import { HistoryService } from 'src/history/history.service';
import { ShipmentHistoryFormatter } from 'src/history/helpers/history-formatters.helper';
import { ShipmentDocument } from 'src/shipments/schema/shipment.schema';

export async function recordShipmentHistory(
  historyService: HistoryService,
  actionType: 'create' | 'consolidate' | 'update' | 'cancel' | 'delete',
  userId: string,
  oldData: Partial<ShipmentDocument> | null = null,
  newData: Partial<ShipmentDocument> | null = null,
  context?: 'single-product' | 'shipment-merge',
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
  context?: 'single-product' | 'shipment-merge',
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
