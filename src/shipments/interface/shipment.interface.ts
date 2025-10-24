export const SHIPMENT_STATUS = [
  'On Hold - Missing Data',
  'In Preparation',
  'On The Way',
  'Received',
  'Cancelled',
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUS)[number];

// Status activos para flags de oficinas (todos excepto Received y Cancelled)
export const ACTIVE_SHIPMENT_STATUSES = [
  'On Hold - Missing Data',
  'In Preparation',
  'On The Way',
] as const;

export const SHIPMENT_TYPE = ['Courrier', 'Internal', 'TBC'] as const;

export type ShipmentType = (typeof SHIPMENT_TYPE)[number];
