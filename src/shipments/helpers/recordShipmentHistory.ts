import { CreateHistoryDto } from 'src/history/dto/create-history.dto';
import { HistoryService } from 'src/history/history.service';
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
