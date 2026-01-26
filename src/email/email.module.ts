/**
 * Email Module
 * Módulo transversal para envío de emails transaccionales
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';
import { EmailConfigService } from './email.config';

@Module({
  imports: [ConfigModule],
  providers: [EmailService, EmailConfigService],
  exports: [EmailService],
})
export class EmailModule {}
