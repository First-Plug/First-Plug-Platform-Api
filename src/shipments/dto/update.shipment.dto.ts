import { createZodDto } from '@anatine/zod-nestjs';
import { UpdateShipmentSchemaZod } from '../validations/update-shipment-zod';

export class UpdateShipmentDto extends createZodDto(UpdateShipmentSchemaZod) {}
