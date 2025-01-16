export function updateProductPrice(
  currentPrice: { amount: number; currencyCode: string } | undefined,
  newPrice: { amount?: number; currencyCode?: string } | null | undefined,
): { amount: number; currencyCode: string } | undefined {
  if (newPrice === null || newPrice === undefined) {
    return undefined;
  }

  if (newPrice.amount !== undefined && newPrice.currencyCode !== undefined) {
    return {
      amount: newPrice.amount,
      currencyCode: newPrice.currencyCode,
    };
  }

  if (currentPrice && !newPrice) {
    return currentPrice;
  }

  return undefined;
}
