import { IsEmail, IsOptional, IsString } from 'class-validator';
import { Provider } from '../schemas/user.schema';

export class CreateUserByProviderDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsString()
  accountProvider: Provider;
}
