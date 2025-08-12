import { IsString, IsOptional, IsEnum, IsObject, IsNumber } from 'class-validator';
import { ShipmentStatus, ShipmentType } from '../../../shipments/interface/shipment.interface';

export class UpdateShipmentDto {
  @IsOptional()
  @IsEnum(['In Preparation', 'On Hold - Missing Data', 'On The Way', 'Delivered', 'Cancelled'])
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
