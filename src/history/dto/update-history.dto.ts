import { createZodDto } from '@anatine/zod-nestjs';

import { UpdateHistorySchema } from '../validations/update-history.zod';

export class UpdateHistoryDto extends createZodDto(UpdateHistorySchema) {}
