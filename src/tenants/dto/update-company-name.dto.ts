import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdateCompanyNameDto {
  @IsString()
  @IsNotEmpty({ message: 'Company name is required' })
  @MaxLength(100, { message: 'Company name cannot exceed 100 characters' })
  name: string;
}
