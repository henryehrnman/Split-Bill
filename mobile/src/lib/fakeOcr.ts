import type {ReceiptItem} from './split.ts';

export type ReceiptDraft = {items: {name: string; amount: number}[]; tax: number; tip: number};
export type ScannedReceipt = {items: Omit<ReceiptItem, 'people'>[]; tax: number; tip: number; itemized: boolean; draft?: ReceiptDraft};

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
 * Discount lines fold into the item above them and $0 lines are dropped. Only a read whose items + tax + tip
 * equal the charge becomes the board; any other usable read is kept as a draft for the payer to fix, and the
 * board stays one editable line until they do.
 */
export function fromScan(read: unknown, merchant: string, amount: number, seed: string): ScannedReceipt {
  const r = read as {items?: unknown; tax?: unknown; tip?: unknown} | null;
  const raw = Array.isArray(r?.items) ? (r.items as {name?: unknown; amount?: unknown}[]) : [];
  const tax = cents(r?.tax);
  const tip = cents(r?.tip);
  if (!raw.length || raw.length > 60 || tax === null || tip === null) return singleLine(merchant, amount, seed);
  const lines: {name: string; amount: number}[] = [];
  for (const i of raw) {
    const name = typeof i?.name === 'string' ? i.name.trim().slice(0, 60) : '';
    const value = Number.isSafeInteger(i?.amount) ? (i.amount as number) : null;
    if (value === null || (!name && value !== 0)) return singleLine(merchant, amount, seed);
    if (value === 0) continue;
    if (value > 0) lines.push({name, amount: value});
    else if (lines.length && lines[lines.length - 1].amount + value > 0) lines[lines.length - 1].amount += value;
    else return singleLine(merchant, amount, seed);
  }
  if (!lines.length) return singleLine(merchant, amount, seed);
  if (lines.reduce((a, i) => a + i.amount, 0) + tax + tip !== amount) return {...singleLine(merchant, amount, seed), draft: {items: lines, tax, tip}};
  return {items: lines.map((i, n) => ({id: `${seed}-${n + 1}`, ...i})), tax, tip, itemized: true};
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
