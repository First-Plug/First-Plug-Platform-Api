/**
 * Canales de comunicación disponibles para warehouses
 */
export const COMMUNICATION_CHANNELS = ['whatsapp', 'slack', 'mail', 'phone'] as const;
export type CommunicationChannel = (typeof COMMUNICATION_CHANNELS)[number];

/**
 * Tipos de partner disponibles
 */
export const PARTNER_TYPES = ['partner', 'own', 'temporary', 'default'] as const;
export type PartnerType = (typeof PARTNER_TYPES)[number];

/**
 * Canal de comunicación por defecto
 */
export const DEFAULT_COMMUNICATION_CHANNEL: CommunicationChannel = 'whatsapp';

/**
 * Tipo de partner por defecto
 */
export const DEFAULT_PARTNER_TYPE: PartnerType = 'default';
