import { CreateHistoryDto } from 'src/history/dto/create-history.dto';
import { HistoryService } from 'src/history/history.service';
import { AssetHistoryFormatter } from 'src/history/helpers/history-formatters.helper';
import { ProductDocument } from '../schemas/product.schema';

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

/**
 * 📦 Registrar history de assets con formato mejorado
 * NUEVO: Incluye detalles de location (office name/country, warehouse country, etc.)
 */
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

/**
 * 📦 Registrar history de assets con formato mejorado (NUEVA FUNCIÓN)
 * Incluye detalles específicos de location según tus lineamientos
 */
export async function recordEnhancedAssetHistory(
  historyService: HistoryService,
  actionType: HistoryActionType,
  userId: string,
  oldProduct: ProductDocument | null,
  newProduct: ProductDocument | null,
  context?: HistoryContext,
) {
  let oldData: any = null;
  let newData: any = null;

  // 🎯 Para CREATE: Solo newData (formato completo)
  if (actionType === 'create') {
    if (newProduct) {
      newData = AssetHistoryFormatter.formatAssetData(newProduct);
    }
  }
  // 🔍 Para UPDATE: Solo campos que cambiaron
  else if (actionType === 'update' && oldProduct && newProduct) {
    const changes = AssetHistoryFormatter.getChangedFields(
      oldProduct.toObject ? oldProduct.toObject() : oldProduct,
      newProduct.toObject ? newProduct.toObject() : newProduct,
    );

    oldData = changes.oldData;
    newData = changes.newData;
  }
  // 🗑️ Para DELETE: Solo oldData (formato completo)
  else if (actionType === 'delete') {
    if (oldProduct) {
      oldData = AssetHistoryFormatter.formatAssetData(oldProduct);
    }
  }
  // 🔄 Para otros casos (relocate, assign, etc.): Formato completo
  else {
    if (oldProduct) {
      oldData = AssetHistoryFormatter.formatAssetData(oldProduct);
    }
    if (newProduct) {
      newData = AssetHistoryFormatter.formatAssetData(newProduct);
    }
  }

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

export const normalizeSerialForHistory = (product: any) => {
  if (!product) return null;
  const plain = product.toObject?.() ?? product;
  return {
    ...plain,
    serialNumber: plain.serialNumber || plain.lastSerialNumber || null,
  };
};
