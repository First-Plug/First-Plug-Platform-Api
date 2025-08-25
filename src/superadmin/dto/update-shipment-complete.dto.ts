import { IsOptional, IsString, IsNumber, IsEnum } from 'class-validator';
import { SHIPMENT_STATUS } from '../../shipments/interface/shipment.interface';

export class UpdateShipmentCompleteDto {
  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  trackingUrl?: string;

  @IsOptional()
  @IsString()
  courier?: string;

  @IsOptional()
  @IsEnum(SHIPMENT_STATUS, {
    message: `shipment_status must be one of: ${SHIPMENT_STATUS.join(', ')}`,
  })
  shipment_status?: string;

  // Permitir otros campos adicionales
  [key: string]: any;
}
