import { createZodDto } from '@anatine/zod-nestjs';
import { UpdateOfficeSchemaZod } from '../validations/create-office.zod';

export class UpdateOfficeDto extends createZodDto(UpdateOfficeSchemaZod) {}
