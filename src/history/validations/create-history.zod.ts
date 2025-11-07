import { z } from 'zod';
import { HistoryActionType } from '../types/history.types';

// Re-export for backward compatibility
export { HistoryActionType };

export const CreateHistorySchema = z.object({
  actionType: z.enum([
    'create',
    'update',
    'delete',
    'bulk-delete',
    'bulk-create',
    'offboarding',
    'return',
    'relocate',
    'assign',
    'reassign',
    'unassign',
    'cancel',
    'consolidate',
  ]),
  userId: z.string().min(1, 'User ID is required'),
  itemType: z.enum(['members', 'teams', 'assets', 'shipments', 'offices']),
  changes: z
    .object({
      oldData: z.union([
        z.record(z.any()),
        z.array(z.record(z.any())),
        z.null(),
      ]),
      newData: z.union([
        z.record(z.any()),
        z.array(z.record(z.any())),
        z.null(),
      ]),
      context: z
        .enum([
          'single-product',
          'shipment-merge',
          'member-address-update',
          // 🔄 Legacy contexts from production (for backward compatibility)
          'setup-default-office',
          'office-address-update',
        ])
        .optional(),
      // ✅ Permitir nonRecoverableProducts para delete de oficinas
      nonRecoverableProducts: z
        .array(
          z.object({
            serialNumber: z.string(),
            name: z.string(),
            brand: z.string(),
            model: z.string(),
          }),
        )
        .optional(),
    })
    .passthrough() // ✅ Permite campos adicionales no definidos
    .refine(
      (data) =>
        (Array.isArray(data.oldData) && data.oldData.length > 0) ||
        (!Array.isArray(data.oldData) &&
          data.oldData !== null &&
          Object.keys(data.oldData).length > 0) ||
        (Array.isArray(data.newData) && data.newData.length > 0) ||
        (!Array.isArray(data.newData) &&
          data.newData !== null &&
          Object.keys(data.newData).length > 0),
      {
        message:
          'Both oldData and newData must contain at least one key or one object',
      },
    ),
});
