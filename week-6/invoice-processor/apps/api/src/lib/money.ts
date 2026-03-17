export function toCents(amount: number) {
  return Math.round(amount * 100);
}

export function fromCents(amountInCents: number) {
  return amountInCents / 100;
}

