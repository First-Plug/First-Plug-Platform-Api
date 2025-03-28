import { createZodDto } from '@anatine/zod-nestjs';
import { DashboardSchemaZod } from '../validations/update-dashboard.zod';

export class UpdateDashboardSchemaDto extends createZodDto(
  DashboardSchemaZod,
) {}
