export interface AddressData {
  address?: string;
  apartment?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  phone?: string;
  personalEmail?: string;
  dni?: string;
}

export class MemberAddressUpdatedEvent {
  constructor(
    public readonly memberEmail: string,
    public readonly tenantName: string,
    public readonly oldAddress: AddressData,
    public readonly newAddress: AddressData,
    public readonly updatedAt: Date = new Date(),
  ) {}
}
