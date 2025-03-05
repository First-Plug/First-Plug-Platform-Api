import {
  IsEnum,
  IsString,
  IsOptional,
  IsNumber,
  MinLength,
  IsDate,
  IsObject,
} from 'class-validator';
import {
  SHIPMENT_STATUS,
  SHIPMENT_TYPE,
  ShipmentStatus,
  ShipmentType,
} from '../interfaces/shipment.interface';

export class CreateShipmentDto {
  @IsString()
  @MinLength(1)
  order_id: string;

  @IsNumber()
  quantity_products: number;

  @IsDate()
  order_date: Date;

  @IsEnum(SHIPMENT_TYPE)
  shipment_type: ShipmentType;

  @IsOptional()
  @IsString()
  trackingURL?: string;

  @IsEnum(SHIPMENT_STATUS)
  shipment_status: ShipmentStatus;

  @IsObject()
  @IsOptional()
  price?: {
    amount: number;
    currencyCode: string;
  };

  @IsString()
  @MinLength(1)
  origin: string;

  @IsString()
  @MinLength(1)
  destination: string;
}
