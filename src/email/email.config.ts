/**
 * Email Configuration
 * Carga y valida la configuración de Resend desde variables de entorno
 */

import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ResendConfig } from './email.types';

/**
 * Schema de validación para configuración de email
 */
const EmailConfigSchema = z.object({
  RESEND_API_KEY: z
    .string()
    .optional()
    .default('')
    .refine((val) => val === '' || val.length > 0, {
      message: 'RESEND_API_KEY debe ser válido si se proporciona',
    }),
  EMAIL_FROM: z
    .string()
    .email('EMAIL_FROM debe ser un email válido')
    .default('onboarding@resend.dev'),
  EMAIL_FROM_NAME: z.string().default('FirstPlug'),
  // Email de prueba para desarrollo (enviar copia de todos los emails)
  EMAIL_TEST_RECIPIENT: z.string().email().optional(),
});

@Injectable()
export class EmailConfigService {
  private config: ResendConfig;
  private testRecipient?: string;

  constructor() {
    this.loadAndValidateConfig();
  }

  /**
   * Carga y valida la configuración desde variables de entorno
   */
  private loadAndValidateConfig(): void {
    const envConfig = {
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      EMAIL_FROM: process.env.EMAIL_FROM,
      EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME,
      EMAIL_TEST_RECIPIENT: process.env.EMAIL_TEST_RECIPIENT,
    };

    try {
      const validated = EmailConfigSchema.parse(envConfig);

      this.config = {
        apiKey: validated.RESEND_API_KEY,
        fromEmail: validated.EMAIL_FROM,
        fromName: validated.EMAIL_FROM_NAME,
      };

      this.testRecipient = validated.EMAIL_TEST_RECIPIENT;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Email config validation failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Obtiene la configuración de Resend
   */
  getResendConfig(): ResendConfig {
    return this.config;
  }

  /**
   * Obtiene el email de prueba (si está configurado)
   */
  getTestRecipient(): string | undefined {
    return this.testRecipient;
  }

  /**
   * Verifica si está en modo de prueba
   */
  isTestMode(): boolean {
    return !!this.testRecipient;
  }
}
