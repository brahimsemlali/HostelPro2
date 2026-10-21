// One definition of "money received" for every screen (dashboard, payments,
// booking detail, guest profile, night audit). Only completed payments count;
// refunds are stored as positive amounts with type 'refund' and subtract.

export type PaymentLike = { amount: number; type: string; status?: string | null }

export function signedAmount(p: PaymentLike): number {
  return p.type === 'refund' ? -p.amount : p.amount
}

/** Net amount received: completed payments and deposits minus completed refunds. */
export function netReceived(payments: readonly PaymentLike[] | null | undefined): number {
  return round2((payments ?? []).filter((p) => !p.status || p.status === 'completed').reduce((s, p) => s + signedAmount(p), 0))
}

/** What the guest still owes (negative = overpaid, i.e. a refund is due). */
export function balanceDue(
  totalPrice: number,
  extras: readonly { quantity: number; unit_price: number }[] | null | undefined,
  payments: readonly PaymentLike[] | null | undefined,
): number {
  const extrasTotal = (extras ?? []).reduce((s, e) => s + e.quantity * e.unit_price, 0)
  return round2(totalPrice + extrasTotal - netReceived(payments))
}

/** Round to centimes so float sums never show a phantom 0,01 MAD. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100
}
