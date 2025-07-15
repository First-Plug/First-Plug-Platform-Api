export interface AddressData {
  address?: string;
  apartment?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  phone?: string;
  ourOfficeEmail?: string;
}

export class OfficeAddressUpdatedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly oldAddress: AddressData,
    public readonly newAddress: AddressData,
    public readonly updatedAt: Date = new Date(),
    public readonly userId: string,
    public readonly ourOfficeEmail: string,
  ) {}
}
