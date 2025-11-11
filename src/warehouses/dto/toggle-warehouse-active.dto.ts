import { IsBoolean, IsNotEmpty } from 'class-validator';

/**
 * DTO para cambiar el estado de activación de un warehouse
 */
export class ToggleWarehouseActiveDto {
  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;
}

