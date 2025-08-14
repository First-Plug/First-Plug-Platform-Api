import { ArrayNotEmpty, IsArray, IsMongoId } from 'class-validator';

export class AssignTenantToUsersDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  userIds: string[];

  @IsMongoId()
  tenantId: string;
}
