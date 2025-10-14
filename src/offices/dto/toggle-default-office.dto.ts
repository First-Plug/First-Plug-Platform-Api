import { createZodDto } from '@anatine/zod-nestjs';
import { ToggleDefaultOfficeSchemaZod } from '../validations/create-office.zod';

export class ToggleDefaultOfficeDto extends createZodDto(ToggleDefaultOfficeSchemaZod) {}
