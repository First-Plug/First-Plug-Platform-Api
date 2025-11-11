import { CreateHistoryDto } from 'src/history/dto/create-history.dto';
import { HistoryService } from 'src/history/history.service';
import { AssetHistoryFormatter } from 'src/history/helpers/history-formatters.helper';
import { ProductDocument } from '../schemas/product.schema';
import {
  HistoryActionType,
  HistoryContext,
  HistoryData,
} from 'src/history/types/history.types';

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
  newMemberCountry?: string, // 🏳️ Country code del member destino
  oldMemberCountry?: string, // 🏳️ Country code del member origen
) {
  let oldData: any = null;
  let newData: any = null;

  // 🎯 Para CREATE: Solo newData (formato completo)
  if (actionType === 'create') {
    if (newProduct) {
      newData = AssetHistoryFormatter.formatAssetData(
        newProduct,
        newProduct.assignedMember,
        undefined,
        newMemberCountry,
      );
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
      oldData = AssetHistoryFormatter.formatAssetData(
        oldProduct,
        oldProduct.assignedMember,
        undefined,
        oldMemberCountry,
      );
    }
  }
  // 🔄 Para otros casos (relocate, assign, etc.): Formato completo
  else {
    if (oldProduct) {
      oldData = AssetHistoryFormatter.formatAssetData(
        oldProduct,
        oldProduct.assignedMember,
        undefined,
        oldMemberCountry,
      );
    }
    if (newProduct) {
      newData = AssetHistoryFormatter.formatAssetData(
        newProduct,
        newProduct.assignedMember,
        undefined,
        newMemberCountry,
      );
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

/**
 * 🎯 Helper para decidir qué función de history usar
 * Recomienda usar Enhanced para nuevos desarrollos, Original para compatibilidad
 */
export const AssetHistoryHelper = {
  /**
   * 📦 Usar función original (compatible con registros legacy)
   * Recomendado para: migraciones, compatibilidad hacia atrás
   */
  useOriginal: recordAssetHistory,

  /**
   * 🚀 Usar función Enhanced (formato nuevo con más detalles)
   * Recomendado para: nuevos desarrollos, funcionalidades que requieren location details
   */
  useEnhanced: recordEnhancedAssetHistory,

  /**
   * 🤔 Decidir automáticamente qué función usar basado en contexto
   */
  auto: async (
    historyService: HistoryService,
    actionType: HistoryActionType,
    userId: string,
    oldProduct: ProductDocument | null,
    newProduct: ProductDocument | null,
    context?: HistoryContext,
    options?: {
      preferEnhanced?: boolean;
      memberCountry?: string;
      oldMemberCountry?: string;
    },
  ) => {
    // Si se especifica preferencia por Enhanced y se tienen los datos necesarios
    if (options?.preferEnhanced && (oldProduct || newProduct)) {
      return recordEnhancedAssetHistory(
        historyService,
        actionType,
        userId,
        oldProduct,
        newProduct,
        context,
        options.memberCountry,
        options.oldMemberCountry,
      );
    }

    // Fallback a función original con datos normalizados
    const oldData = oldProduct ? normalizeSerialForHistory(oldProduct) : null;
    const newData = newProduct ? normalizeSerialForHistory(newProduct) : null;

    return recordAssetHistory(
      historyService,
      actionType,
      userId,
      oldData,
      newData,
      context,
    );
  },
};
