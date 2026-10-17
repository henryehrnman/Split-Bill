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

export function scanReceipt(merchant: string, amount: number, seed: string): ScannedReceipt {
  const sample = SAMPLE_PURCHASES.find(s => s.merchant === merchant && s.amount === amount);
  if (!sample) return {items: [{id: seed + '-1', name: merchant || 'Purchase', amount}], tax: 0, tip: 0, itemized: false};
  return {
    items: sample.items.map(([name, value], i) => ({id: `${seed}-${i + 1}`, name, amount: value})),
    tax: sample.tax,
    tip: sample.tip,
    itemized: true,
  };
}
