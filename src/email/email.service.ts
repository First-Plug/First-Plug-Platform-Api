/**
 * Email Service
 * Servicio transversal para envío de emails transaccionales
 * Completamente desacoplado de servicios raíz
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Resend } from 'resend';
import { z } from 'zod';
import { EmailConfigService } from './email.config';
import { EmailTemplate } from './templates/email.template';
import {
  EmailProps,
  EmailSendResponse,
  EmailNotificationType,
} from './email.types';

/**
 * Schema de validación para email
 */
const EmailSchema = z.object({
  to: z.string().email('Email inválido'),
  props: z.object({
    recipientName: z.string().min(1),
    recipientEmail: z.string().email(),
    tenantName: z.string().min(1),
    type: z.nativeEnum(EmailNotificationType),
    title: z.string().min(1),
    description: z.string().min(1),
    buttonText: z.string().optional(),
    buttonUrl: z.string().url().optional(),
    additionalInfo: z.record(z.any()).optional(),
  }),
});

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;

  constructor(private emailConfig: EmailConfigService) {
    // No inicializar Resend aquí, hacerlo de forma lazy
  }

  /**
   * Obtiene la instancia de Resend (lazy initialization)
   */
  private getResendClient(): Resend {
    if (!this.resend) {
      const config = this.emailConfig.getResendConfig();
      if (!config.apiKey) {
        throw new Error('RESEND_API_KEY no configurado');
      }
      this.resend = new Resend(config.apiKey);
    }
    return this.resend;
  }

  /**
   * Envía un email transaccional inmediato
   * @param to Email del destinatario
   * @param props Props del email (tipo, título, descripción, etc)
   * @returns Respuesta del envío
   */
  async sendImmediate(
    to: string,
    props: EmailProps,
  ): Promise<EmailSendResponse> {
    try {
      // Validar que la API key esté configurada
      const config = this.emailConfig.getResendConfig();
      if (!config.apiKey) {
        this.logger.warn(
          'RESEND_API_KEY no configurado. Email no será enviado en desarrollo.',
        );
        return {
          success: false,
          error: 'RESEND_API_KEY no configurado',
          timestamp: new Date(),
        };
      }

      // Validar inputs
      const validated = EmailSchema.parse({ to, props });

      // Validar email
      this.validateEmail(validated.to);

      // Renderizar template
      const html = EmailTemplate.render(validated.props);
      const text = EmailTemplate.renderText(validated.props);

      // Obtener cliente de Resend
      const resend = this.getResendClient();

      // Enviar email principal
      const response = await resend.emails.send({
        from: `${config.fromName} <${config.fromEmail}>`,
        to: validated.to,
        subject: validated.props.title,
        html,
        text,
      });

      // Si hay error en Resend
      if (response.error) {
        this.logger.error(
          `Error sending email to ${validated.to}:`,
          response.error,
        );

        // En modo test, intentar enviar al email de prueba si el principal falla
        if (this.emailConfig.isTestMode()) {
          const testRecipient = this.emailConfig.getTestRecipient();
          try {
            this.logger.log(
              `Attempting to send test email to ${testRecipient} instead...`,
            );
            const testResponse = await resend.emails.send({
              from: `${config.fromName} <${config.fromEmail}>`,
              to: testRecipient!,
              subject: `[TEST - Original: ${validated.to}] ${validated.props.title}`,
              html,
              text,
            });

            if (!testResponse.error) {
              this.logger.log(
                `Test email sent successfully to ${testRecipient} (messageId: ${testResponse.data?.id})`,
              );
              return {
                success: true,
                messageId: testResponse.data?.id,
                timestamp: new Date(),
                note: `Email sent to test recipient (${testRecipient}) instead of ${validated.to}`,
              };
            }
          } catch (testError) {
            this.logger.error('Error sending test email:', testError);
          }
        }

        return {
          success: false,
          error: response.error.message,
          timestamp: new Date(),
        };
      }

      // Enviar copia a email de prueba si está configurado
      if (this.emailConfig.isTestMode()) {
        const testRecipient = this.emailConfig.getTestRecipient();
        try {
          await resend.emails.send({
            from: `${config.fromName} <${config.fromEmail}>`,
            to: testRecipient!,
            subject: `[TEST COPY] ${validated.props.title}`,
            html,
            text,
          });
        } catch (testError) {
          this.logger.warn('Could not send test copy:', testError);
          // No fallar si no se puede enviar la copia de prueba
        }
      }

      // Log de éxito
      this.logger.log(
        `Email sent successfully to ${validated.to} (messageId: ${response.data?.id})`,
      );

      return {
        success: true,
        messageId: response.data?.id,
        timestamp: new Date(),
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.logger.error('Validation error:', error.errors);
        throw new BadRequestException(`Invalid email data: ${error.message}`);
      }

      this.logger.error('Unexpected error sending email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Valida que el email sea válido
   */
  private validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestException(`Invalid email format: ${email}`);
    }
  }
}
