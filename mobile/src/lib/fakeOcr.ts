import type {ReceiptItem} from './split.ts';

export type ScannedReceipt = {items: Omit<ReceiptItem, 'people'>[]; tax: number; tip: number; itemized: boolean};

type Sample = {merchant: string; amount: number; category: string; items: [string, number][]; tax: number; tip: number};

// Stand-in for a real OCR service: known demo merchants return exact receipts.
export const SAMPLE_PURCHASES: Sample[] = [
  {
    merchant: 'Juniper',
    amount: 15420,
    category: 'Dinner',
    items: [['Burrata', 1600], ['Margherita pizza', 2200], ['Rigatoni', 2600], ['Branzino', 3400], ['Tiramisu', 1200], ['Sparkling water', 1000]],
    tax: 1020,
    tip: 2400,
  },
  {
    merchant: "Trader Joe's",
    amount: 8647,
    category: 'Groceries',
    items: [['Produce', 1842], ['Frozen meals', 2496], ['Coffee', 999], ['Snacks', 1437], ['Paper towels', 1198], ['Olive oil', 570]],
    tax: 105,
    tip: 0,
  },
  {
    merchant: 'Shell',
    amount: 5230,
    category: 'Gas',
    items: [['Unleaded fuel', 5230]],
    tax: 0,
    tip: 0,
  },
];

const singleLine = (merchant: string, amount: number, seed: string): ScannedReceipt =>
  ({items: [{id: seed + '-1', name: merchant || 'Purchase', amount}], tax: 0, tip: 0, itemized: false});

const cents = (v: unknown) => (Number.isSafeInteger(v) && (v as number) >= 0 ? (v as number) : null);

/**
 * Turns a receipt read elsewhere (the vision model on the server) into board items.
 * Anything malformed, or items + tax + tip that don't equal the charge, falls back to one editable line.
 */
export function fromScan(read: unknown, merchant: string, amount: number, seed: string): ScannedReceipt {
  const r = read as {items?: unknown; tax?: unknown; tip?: unknown} | null;
  const raw = Array.isArray(r?.items) ? (r.items as {name?: unknown; amount?: unknown}[]) : [];
  const items = raw.slice(0, 60).map((i, n) => ({
    id: `${seed}-${n + 1}`,
    name: typeof i?.name === 'string' ? i.name.trim().slice(0, 60) : '',
    amount: cents(i?.amount) ?? 0,
  }));
  const tax = cents(r?.tax);
  const tip = cents(r?.tip);
  if (!items.length || raw.length > 60 || tax === null || tip === null || items.some(i => !i.name || i.amount <= 0)) return singleLine(merchant, amount, seed);
  if (items.reduce((a, i) => a + i.amount, 0) + tax + tip !== amount) return singleLine(merchant, amount, seed);
  return {items, tax, tip, itemized: true};
}

export function scanReceipt(merchant: string, amount: number, seed: string): ScannedReceipt {
  const sample = SAMPLE_PURCHASES.find(s => s.merchant === merchant && s.amount === amount);
  if (!sample) return singleLine(merchant, amount, seed);
  return {
    items: sample.items.map(([name, value], i) => ({id: `${seed}-${i + 1}`, name, amount: value})),
    tax: sample.tax,
    tip: sample.tip,
    itemized: true,
  };
}
