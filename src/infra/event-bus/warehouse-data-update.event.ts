export class WarehouseDataUpdatedEvent {
  constructor(
    public readonly warehouseId: string,
    public readonly countryCode: string,
    public readonly oldData: {
      name?: string;
      address?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      email?: string;
      phone?: string;
      contactPerson?: string;
    },
    public readonly newData: {
      name?: string;
      address?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      email?: string;
      phone?: string;
      contactPerson?: string;
    },
    public readonly updatedFields: string[],
    public readonly timestamp: Date = new Date(),
  ) {}
}
