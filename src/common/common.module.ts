import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GlobalConnectionProvider } from './providers/global-connection.provider';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [GlobalConnectionProvider],
  exports: [GlobalConnectionProvider],
})
export class CommonModule {}
