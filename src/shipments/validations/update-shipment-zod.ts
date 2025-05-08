import { z } from 'zod';
import { createZodDto } from '@anatine/zod-nestjs';

export const UpdateShipmentSchemaZod = z.object({
  desirableDateOrigin: z.string().optional(),
  desirableDateDestination: z.string().optional(),
  newDestination: z.string().optional(),
  newAssignedEmail: z.string().email().optional(),
  newAssignedMember: z.string().optional(),
});

export class UpdateShipmentDto extends createZodDto(UpdateShipmentSchemaZod) {}
