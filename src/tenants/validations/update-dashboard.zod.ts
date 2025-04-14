import { z } from 'zod';

const WidgetSchema = z.object({
  id: z.string().min(1, { message: 'Widget id is required' }),
  order: z
    .number()
    .int()
    .min(0, { message: 'Order should be a positive integer' }),
});

export const DashboardSchemaZod = z.object({
  widgets: z.array(WidgetSchema).min(1, { message: 'Widgets are required' }),
});
