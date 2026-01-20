/**
 * Email Types and Interfaces
 * Tipos de notificaciones y estructuras de datos para el servicio de email
 */

/**
 * Tipos de notificaciones soportadas en Fase 1
 */
export enum EmailNotificationType {
  USER_ENABLED = 'USER_ENABLED',
  SHIPMENT_CREATED = 'SHIPMENT_CREATED',
  SHIPMENT_ON_WAY = 'SHIPMENT_ON_WAY',
  SHIPMENT_RECEIVED = 'SHIPMENT_RECEIVED',
  SHIPMENT_CANCELLED = 'SHIPMENT_CANCELLED',
  QUOTE_CREATED = 'QUOTE_CREATED',
  QUOTE_CANCELLED = 'QUOTE_CANCELLED',
  OFFBOARDING = 'OFFBOARDING',
}

/**
 * Props base para todos los emails
 */
export interface BaseEmailProps {
  recipientName: string;
  recipientEmail: string;
  tenantName: string;
}

/**
 * Props específicas por tipo de notificación
 */
export interface EmailProps extends BaseEmailProps {
  type: EmailNotificationType;
  title: string;
  description: string;
  buttonText?: string;
  buttonUrl?: string;
  additionalInfo?: Record<string, any>;
}

/**
 * Respuesta de envío de email
 */
export interface EmailSendResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: Date;
  note?: string;
}

/**
 * Configuración de Resend
 */
export interface ResendConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
}
