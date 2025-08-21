import { IsString, IsNotEmpty, IsMongoId } from 'class-validator';

export class AssignTenantDto {
  @IsString()
  @IsNotEmpty()
  @IsMongoId()
  tenantId: string;
}
