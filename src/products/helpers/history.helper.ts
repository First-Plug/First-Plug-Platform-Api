import { CreateHistoryDto } from 'src/history/dto/create-history.dto';
import { HistoryService } from 'src/history/history.service';

type HistoryActionType =
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

type HistoryContext = 'single-product' | 'shipment-merge';

type HistoryData = Record<string, any> | Record<string, any>[] | null;

export async function recordAssetHistory(
  historyService: HistoryService,
  actionType: HistoryActionType,
  userId: string,
  oldData: HistoryData,
  newData: HistoryData,
  context?: HistoryContext,
) {
  const payload: CreateHistoryDto = {
    actionType,
    itemType: 'assets',
    userId,
    changes: {
      oldData,
      newData,
      ...(context ? { context } : {}),
    },
  };

  await historyService.create(payload);
}
