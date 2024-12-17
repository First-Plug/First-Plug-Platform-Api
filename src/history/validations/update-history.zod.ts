import { z } from 'zod';

export const UpdateHistorySchema = z.object({
  actionType: z.string().min(1, 'Action type is required').optional(),
  userId: z.string().min(1, 'User ID is required').optional(),
  itemType: z.string().min(1, 'Item type is required').optional(),
  changes: z
    .object({
      oldData: z.record(z.any()).optional(),
      newData: z.record(z.any()).optional(),
    })
    .refine(
      (data) =>
        Object.keys(data.oldData || {}).length > 0 ||
        Object.keys(data.newData || {}).length > 0,
      {
        message: 'Both oldData and newData must contain at least one key',
      },
    ),
});
