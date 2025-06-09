export class BulkReassignItemDto {
  productId: string;

  actionType: 'relocate' | 'return';

  newAssignedEmail?: string;
  newAssignedMember?: string;

  newLocation?: 'Our office' | 'FP warehouse';

  fp_shipment: boolean;

  desirableDate?: {
    origin?: string;
    destination?: string;
  };
}

export class BulkReassignDto {
  items: BulkReassignItemDto[];
}
