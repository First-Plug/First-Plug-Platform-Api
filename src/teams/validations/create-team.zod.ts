import { z } from 'zod';

export const TeamSchemaZod = z.object({
  name: z.string().min(1).trim(),
  color: z.string().optional(),
});
