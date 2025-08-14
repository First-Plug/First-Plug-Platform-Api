import { IsArray, IsString } from 'class-validator';

export class GetOfficesByTenantsDto {
  @IsArray()
  @IsString({ each: true })
  tenantNames: string[];
}
