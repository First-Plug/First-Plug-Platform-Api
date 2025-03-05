export const SHIPMENT_STATUS = [
  'In Preparation',
  'On the Way',
  'Received',
  'Cancelled',
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUS)[number];

export const SHIPMENT_TYPE = ['Courrier', 'Internal', 'TBC'] as const;

export type ShipmentType = (typeof SHIPMENT_TYPE)[number];
