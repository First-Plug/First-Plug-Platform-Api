import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  IsNumber,
} from 'class-validator';
import {
  ShipmentStatus,
  ShipmentType,
  SHIPMENT_STATUS,
} from '../../../shipments/interface/shipment.interface';

export class UpdateShipmentDto {
  @IsOptional()
  @IsEnum(SHIPMENT_STATUS, {
    message: `shipment_status must be one of: ${SHIPMENT_STATUS.join(', ')}`,
  })
  shipment_status?: ShipmentStatus;

  @IsOptional()
  @IsEnum(['TBC', 'Outbound', 'Inbound', 'Internal'])
  shipment_type?: ShipmentType;

  @IsOptional()
  @IsString()
  trackingURL?: string;

  @IsOptional()
  @IsString()
  origin?: string;

  @IsOptional()
  @IsString()
  destination?: string;

  @IsOptional()
  @IsObject()
  originDetails?: Record<string, string>;

  @IsOptional()
  @IsObject()
  destinationDetails?: Record<string, string>;

  @IsOptional()
  @IsObject()
  price?: {
    amount: number;
    currencyCode: string;
  };

  @IsOptional()
  @IsNumber()
  quantity_products?: number;
}
