/**
 * ⚠️ NOTA: No necesitamos un schema separado para Quotes
 *
 * Reutilizamos ShipmentMetadataSchema que ya existe en el proyecto.
 * En la colección 'shipmentmetadata' guardamos:
 *
 * {
 *   _id: "orderCounter",
 *   lastOrderNumber: 1000
 * }
 *
 * {
 *   _id: "quote_counter",
 *   lastQuoteNumber: 500
 * }
 *
 * Ambos registros en la MISMA colección.
 * Ver: src/shipments/schema/shipment-metadata.schema.ts
 */

export { ShipmentMetadataSchema as QuoteMetadataSchema } from '../../shipments/schema/shipment-metadata.schema';
export type { ShipmentMetadata as QuoteMetadata } from '../../shipments/schema/shipment-metadata.schema';
