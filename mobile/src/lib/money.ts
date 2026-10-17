export const money = (c: number) => (c < 0 ? '-$' : '$') + (Math.abs(c) / 100).toFixed(2);

// Decimal money input is parsed to integer cents; reject hidden fractional cents.
export function cents(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ''] = value.trim().split('.');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(result) && result <= 10000000 ? result : null;
}

export const toInput = (c: number) => (c / 100).toFixed(2);

// Largest-remainder allocation; ties go to the earliest index so results are stable.
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);
  const raw = weights.map(w => (total * w) / sum);
  const out = raw.map(Math.floor);
  raw
    .map((x, i) => ({i, r: x - out[i]}))
    .sort((a, b) => b.r - a.r || a.i - b.i)
    .slice(0, total - out.reduce((a, b) => a + b, 0))
    .forEach(x => out[x.i]++);
  return out;
}
