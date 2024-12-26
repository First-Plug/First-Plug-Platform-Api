import { z } from 'zod';

export const CreateHistorySchema = z.object({
  actionType: z.enum(['create', 'update', 'delete', 'bulk-delete']),
  userId: z.string().min(1, 'User ID is required'),
  itemType: z.string().min(1, 'Item type is required'),
  changes: z
    .object({
      oldData: z.union([z.record(z.any()), z.array(z.record(z.any()))]),
      newData: z.union([z.record(z.any()), z.array(z.record(z.any()))]),
    })
    .refine(
      (data) =>
        (Array.isArray(data.oldData) && data.oldData.length > 0) ||
        (!Array.isArray(data.oldData) &&
          Object.keys(data.oldData).length > 0) ||
        (Array.isArray(data.newData) && data.newData.length > 0) ||
        (!Array.isArray(data.newData) && Object.keys(data.newData).length > 0),
      {
        message:
          'Both oldData and newData must contain at least one key or one object',
      },
    ),
});
