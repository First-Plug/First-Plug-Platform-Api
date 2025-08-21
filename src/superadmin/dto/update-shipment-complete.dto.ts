import { IsOptional, IsString, IsNumber, IsEnum } from 'class-validator';

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
  @IsEnum([
    'In Preparation',
    'Ready to Ship',
    'Shipped',
    'In Transit',
    'Out for Delivery',
    'Delivered',
    'Exception',
    'Cancelled',
    'On Hold - Missing Data',
  ])
  shipment_status?: string;

  // Permitir otros campos adicionales
  [key: string]: any;
}
