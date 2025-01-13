export function updateProductPrice(
  currentPrice: { amount: number; currencyCode: string } | undefined,
  newPrice: { amount?: number; currencyCode?: string } | undefined,
): { amount: number; currencyCode: string } | undefined {
  if (newPrice?.amount !== undefined && newPrice?.currencyCode !== undefined) {
    return {
      amount: newPrice.amount,
      currencyCode: newPrice.currencyCode,
    };
  } else if (currentPrice && !newPrice) {
    return currentPrice;
  } else {
    return undefined;
  }
}
