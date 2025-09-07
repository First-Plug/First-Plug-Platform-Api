import {
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SHIPMENT_STATUS } from '../../shipments/interface/shipment.interface';

class PriceDto {
  @IsNumber()
  amount: number;

  @IsString()
  currency: string;
}

export class UpdateShipmentCompleteDto {
  @IsOptional()
  @IsEnum(SHIPMENT_STATUS, {
    message: `shipmentStatus must be one of: ${SHIPMENT_STATUS.join(', ')}`,
  })
  shipment_status?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PriceDto)
  price?: PriceDto;

  @IsOptional()
  @IsString()
  shipment_type?: string;

  @IsOptional()
  @IsString()
  trackingURL?: string;

  // Permitir otros campos adicionales
  [key: string]: any;
}
