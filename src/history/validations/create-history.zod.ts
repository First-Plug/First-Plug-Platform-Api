import { z } from 'zod';

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
  ]),
  userId: z.string().min(1, 'User ID is required'),
  itemType: z.enum(['members', 'teams', 'assets']),
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
    })
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
