import { CreateHistoryDto } from 'src/history/dto/create-history.dto';
import { HistoryService } from 'src/history/history.service';
import { OfficeHistoryFormatter } from 'src/history/helpers/history-formatters.helper';
import { Office } from '../schemas/office.schema';

type OfficeHistoryActionType = 'create' | 'update' | 'delete';

/**
 * 🏢 Registrar history de oficinas con formato mejorado
 * Incluye name, country y productos no recuperables según tus lineamientos
 */
export async function recordOfficeHistory(
  historyService: HistoryService,
  actionType: OfficeHistoryActionType,
  userId: string,
  oldOffice: Office | null,
  newOffice: Office | null,
  nonRecoverableProducts?: Array<{
    serialNumber: string;
    name: string;
    brand: string;
    model: string;
  }>,
) {
  let oldData: any = null;
  let newData: any = null;

  switch (actionType) {
    case 'create':
      if (newOffice) {
        newData = OfficeHistoryFormatter.formatForCreate(newOffice);
      }
      break;

    case 'update':
      if (oldOffice && newOffice) {
        const formatted = OfficeHistoryFormatter.formatForUpdate(
          oldOffice,
          newOffice,
        );
        oldData = formatted.oldData;
        newData = formatted.newData;
      }
      break;

    case 'delete':
      if (oldOffice) {
        oldData = OfficeHistoryFormatter.formatForDelete(oldOffice);
      }
      break;
  }

  const payload: CreateHistoryDto = {
    actionType,
    itemType: 'offices',
    userId,
    changes: {
      oldData,
      newData,
      // 🎯 nonRecoverableProducts va en el nivel de changes, no dentro de oldData
      ...(nonRecoverableProducts &&
        nonRecoverableProducts.length > 0 && {
          nonRecoverableProducts,
        }),
    },
  };

  await historyService.create(payload);
}
