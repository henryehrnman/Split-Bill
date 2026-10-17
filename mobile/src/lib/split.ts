import {allocate, money} from './money.ts';

export type UserId = string;
export type Shares = Record<UserId, number>;
export type ReceiptItem = {id: string; name: string; amount: number; people: UserId[]};
export type SplitMethod = 'equal' | 'percent' | 'amount' | 'items';
export type SplitInput =
  | {method: 'equal'; participants: UserId[]}
  | {method: 'percent'; percents: Record<UserId, number>}
  | {method: 'amount'; amounts: Record<UserId, number>}
  | {method: 'items'; items: ReceiptItem[]; tax: number; tip: number};

export type SplitResult = {
  shares: Shares;
  error: string;
  breakdown?: Record<UserId, {items: number; tax: number; tip: number}>;
};

const zero = (members: UserId[]) => Object.fromEntries(members.map(m => [m, 0])) as Shares;
const toShares = (members: UserId[], values: number[]) =>
  Object.fromEntries(members.map((m, i) => [m, values[i]])) as Shares;

// Shares always use group member order so extra cents land deterministically.
export function computeSplit(members: UserId[], total: number, input: SplitInput): SplitResult {
  const fail = (error: string): SplitResult => ({shares: zero(members), error});
  if (!Number.isSafeInteger(total) || total <= 0) return fail('The charge amount is invalid.');

  if (input.method === 'equal') {
    const people = new Set(input.participants);
    if (!people.size) return fail('Include at least one person.');
    if ([...people].some(p => !members.includes(p))) return fail('Only group members can share a charge.');
    return {shares: toShares(members, allocate(total, members.map(m => (people.has(m) ? 1 : 0)))), error: ''};
  }

  if (input.method === 'percent') {
    const weights = members.map(m => input.percents[m] ?? 0);
    if (weights.some(w => !Number.isFinite(w) || w < 0)) return fail('Percentages cannot be negative.');
    if (Math.abs(weights.reduce((a, b) => a + b, 0) - 100) > 0.00001) return fail('Percentages must total 100%.');
    return {shares: toShares(members, allocate(total, weights)), error: ''};
  }

  if (input.method === 'amount') {
    const values = members.map(m => input.amounts[m] ?? 0);
    if (values.some(v => !Number.isSafeInteger(v) || v < 0)) return fail('Enter valid amounts.');
    const sum = values.reduce((a, b) => a + b, 0);
    if (sum !== total) {
      const gap = total - sum;
      return fail(`Amounts must total ${money(total)}. ${gap > 0 ? money(gap) + ' left to assign.' : money(-gap) + ' over.'}`);
    }
    return {shares: toShares(members, values), error: ''};
  }

  const {items, tax, tip} = input;
  if (!items.length) return fail('Add at least one item.');
  if (![tax, tip].every(v => Number.isSafeInteger(v) && v >= 0)) return fail('Tax and tip must be valid amounts.');
  let base = members.map(() => 0);
  let itemTotal = 0;
  for (const item of items) {
    if (!item.name.trim() || !Number.isSafeInteger(item.amount) || item.amount <= 0) {
      return fail('Give every item a name and a positive amount.');
    }
    const people = new Set(item.people);
    if (!people.size || people.size !== item.people.length || [...people].some(p => !members.includes(p))) {
      return fail(`Assign “${item.name}” to at least one person.`);
    }
    itemTotal += item.amount;
    const parts = allocate(item.amount, members.map(m => (people.has(m) ? 1 : 0)));
    base = base.map((x, i) => x + parts[i]);
  }
  if (itemTotal + tax + tip !== total) {
    return fail(`Items, tax and tip add up to ${money(itemTotal + tax + tip)}, but the charge was ${money(total)}.`);
  }
  const taxes = allocate(tax, base);
  const tips = allocate(tip, base);
  return {
    shares: toShares(members, base.map((x, i) => x + taxes[i] + tips[i])),
    error: '',
    breakdown: Object.fromEntries(members.map((m, i) => [m, {items: base[i], tax: taxes[i], tip: tips[i]}])),
  };
}
