import { createZodDto } from '@anatine/zod-nestjs';
import { CreateOfficeSchemaZod } from '../validations/create-office.zod';

export class CreateOfficeDto extends createZodDto(CreateOfficeSchemaZod) {}
