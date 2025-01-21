import { createZodDto } from '@anatine/zod-nestjs';

import { CreateHistorySchema } from '../validations/create-history.zod';

export class CreateHistoryDto extends createZodDto(CreateHistorySchema) {}
