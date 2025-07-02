export class ProductUpdatedEvent {
  constructor(
    public readonly productId: string,
    public readonly tenantName: string,
  ) {}
}
