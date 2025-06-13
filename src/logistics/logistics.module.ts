import { Module } from '@nestjs/common';
import { LogisticsService } from './logistics.sevice';

@Module({
  providers: [LogisticsService],
  exports: [LogisticsService],
})
export class LogisticsModule {}
