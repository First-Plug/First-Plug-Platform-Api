export class BulkReassignItemDto {
  productId: string;

  actionType: 'relocate' | 'return';

  newAssignedEmail?: string;
  newAssignedMember?: string;

  newLocation?: 'Our office' | 'FP warehouse';

  // Campo para especificar la oficina cuando newLocation = 'Our office'
  officeId?: string;

  fp_shipment: boolean;

  desirableDate?: {
    origin?: string;
    destination?: string;
  };
}

export class BulkReassignDto {
  items: BulkReassignItemDto[];
}
