import { IsArray, IsString } from 'class-validator';

export class GetShipmentsCrossTenantDto {
  @IsArray()
  @IsString({ each: true })
  tenantNames: string[];
}
