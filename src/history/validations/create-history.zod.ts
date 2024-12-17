import { z } from 'zod';

export const CreateHistorySchema = z.object({
  actionType: z.string().min(1, 'Action type is required'),
  userId: z.string().min(1, 'User ID is required'),
  itemType: z.string().min(1, 'Item type is required'),
  changes: z
    .object({
      oldData: z.record(z.any()),
      newData: z.record(z.any()),
    })
    .required()
    .refine(
      (data) =>
        Object.keys(data.oldData).length > 0 ||
        Object.keys(data.newData).length > 0,
      {
        message: 'Both oldData and newData must contain at least one key',
      },
    ),
});
