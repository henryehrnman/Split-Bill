import {allocate, money} from './money.ts';
import {computeSplit} from './split.ts';
import type {ReceiptItem, Shares, SplitInput, UserId} from './split.ts';
import {scanReceipt as ocr} from './fakeOcr.ts';

export type Wallet = 'Apple Wallet' | 'Google Wallet';
export type User = {id: UserId; name: string; initials: string; tone: number; handle: string; email: string; phone: string};
export type DefaultSplit = {method: 'equal'} | {method: 'percent'; percents: Record<UserId, number>};
export type Member = {
  userId: UserId;
  status: 'invited' | 'joined';
  balance: number;
  autoDeposit: boolean;
  failTopUps: boolean;
  suspended: boolean;
};
export type Group = {
  id: string;
  name: string;
  createdBy: UserId;
  createdAt: number;
  budget: number;
  periodDays: number;
  periodStart: number;
  members: Member[];
  defaultSplit: DefaultSplit;
  frozen: null | {reason: string; at: number};
};
export type Card = {id: string; groupId: string; userId: UserId; last4: string; wallet: Wallet | null; frozen: boolean};
export type ItemEdit = {id: string; itemId: string; targetId: UserId; action: 'add' | 'remove'; authorId: UserId; createdAt: number};
export type Receipt = {items: ReceiptItem[]; tax: number; tip: number; itemized: boolean; scannedAt: number; locked: UserId[]; edits: ItemEdit[]};
export type Proposal = {id: string; authorId: UserId | null; createdAt: number; input: SplitInput; shares: Shares; acceptedBy: UserId[]};
export type Charge = {
  id: string;
  groupId: string;
  cardholderId: UserId;
  merchant: string;
  amount: number;
  createdAt: number;
  status: 'pending' | 'settled' | 'disputed';
  receipt: Receipt | null;
  proposals: Proposal[];
  settledAt?: number;
  dispute?: {reason: string; at: number};
};
export type BudgetProposal = {id: string; groupId: string; authorId: UserId; amount: number; createdAt: number; acceptedBy: UserId[]};
export type LedgerEntry = {
  id: string;
  groupId: string;
  userId: UserId;
  kind: 'deposit' | 'withdrawal' | 'period-top-up' | 'top-up-failed' | 'charge' | 'debt-recovery' | 'debt-recovery-failed';
  amount: number;
  at: number;
  chargeId?: string;
};
export type Db = {
  version: 3;
  seq: number;
  clockOffset: number;
  users: User[];
  groups: Group[];
  cards: Card[];
  charges: Charge[];
  budgetProposals: BudgetProposal[];
  ledger: LedgerEntry[];
};

export class ApiError extends Error {}

export const DAY = 24 * 60 * 60 * 1000;
export const SPLIT_DEADLINE = 7 * DAY;

const nextId = (db: Db, prefix: string) => `${prefix}_${(++db.seq).toString(36)}`;
const fail = (message: string): never => {
  throw new ApiError(message);
};

// ---------- Reads ----------

export const userById = (db: Db, id: UserId) => db.users.find(u => u.id === id) ?? fail('Unknown user.');
export const groupById = (db: Db, id: string) => db.groups.find(g => g.id === id) ?? fail('Group not found.');
export const chargeById = (db: Db, id: string) => db.charges.find(c => c.id === id) ?? fail('Charge not found.');
export const groupsFor = (db: Db, userId: UserId) => db.groups.filter(g => g.members.some(m => m.userId === userId));
export const memberIds = (g: Group) => g.members.map(m => m.userId);
export const joinedIds = (g: Group) => g.members.filter(m => m.status === 'joined').map(m => m.userId);
export const isActive = (g: Group) => g.members.length >= 2 && g.members.every(m => m.status === 'joined');
export const fundBalance = (g: Group) => g.members.reduce((a, m) => a + m.balance, 0);
export const pendingCharge = (db: Db, groupId: string) => db.charges.find(c => c.groupId === groupId && c.status === 'pending') ?? null;
export const availableFunds = (db: Db, g: Group) => fundBalance(g) - (pendingCharge(db, g.id)?.amount ?? 0);
export const currentProposal = (c: Charge) => c.proposals[c.proposals.length - 1];
export const cardFor = (db: Db, groupId: string, userId: UserId) => db.cards.find(c => c.groupId === groupId && c.userId === userId) ?? null;
export const openBudgetProposal = (db: Db, groupId: string) => db.budgetProposals.find(p => p.groupId === groupId) ?? null;
export const nextPeriodAt = (g: Group) => g.periodStart + g.periodDays * DAY;

export function memberOf(g: Group, userId: UserId) {
  return g.members.find(m => m.userId === userId) ?? fail('You are not a member of this group.');
}

function joinedMember(g: Group, userId: UserId) {
  const m = memberOf(g, userId);
  if (m.status !== 'joined') fail('Accept the invite to this group first.');
  return m;
}

// Each member's equal slice of the per-period budget.
export function shares(g: Group, budget = g.budget): Record<UserId, number> {
  const parts = allocate(budget, g.members.map(() => 1));
  return Object.fromEntries(g.members.map((m, i) => [m.userId, parts[i]]));
}

export type Standing = 'on-track' | 'low' | 'restricted' | 'suspended' | 'invited';
export function standing(g: Group, userId: UserId): Standing {
  const m = memberOf(g, userId);
  if (m.status === 'invited') return 'invited';
  if (m.suspended) return 'suspended';
  if (m.balance <= 0) return 'restricted';
  return m.balance >= shares(g)[userId] ? 'on-track' : 'low';
}

export function searchUsers(db: Db, query: string, exclude: UserId[]) {
  const q = query.trim().toLowerCase().replace(/^@/, '');
  if (q.length < 2) return [];
  const digits = q.replace(/\D/g, '');
  return db.users.filter(u => !exclude.includes(u.id) && (u.handle.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q) || (digits.length >= 3 && u.phone.replace(/\D/g, '').includes(digits))));
}

export function requiredApprovers(p: Proposal) {
  return Object.entries(p.shares).filter(([, v]) => v > 0).map(([k]) => k);
}

export function waitingOn(p: Proposal) {
  return requiredApprovers(p).filter(id => !p.acceptedBy.includes(id));
}

export function spendLimit(db: Db, groupId: string, userId: UserId) {
  const g = groupById(db, groupId);
  if (!isActive(g) || g.frozen) return 0;
  const s = standing(g, userId);
  if (s === 'restricted' || s === 'suspended' || s === 'invited') return 0;
  return Math.max(0, fundBalance(g));
}

export function purchaseBlocker(db: Db, groupId: string, userId: UserId): string | null {
  const g = groupById(db, groupId);
  const card = cardFor(db, groupId, userId);
  if (g.frozen) return `This group is frozen: ${g.frozen.reason}`;
  if (!isActive(g)) return 'Waiting for everyone to accept their invite and make their first deposit.';
  const s = standing(g, userId);
  if (s === 'suspended') return 'Your account is suspended until you repay what you owe the group.';
  if (s === 'restricted') return 'Your balance is $0 or below. Add funds or wait for the next budget period.';
  const pending = pendingCharge(db, groupId);
  if (pending) return `Agree on the split for ${pending.merchant} before the next purchase.`;
  if (!card) return 'You don’t have a card for this group yet.';
  if (card.frozen) return 'Your card is frozen.';
  if (!card.wallet) return 'Add your card to a wallet first.';
  return null;
}

export function defaultInput(g: Group): SplitInput {
  if (g.defaultSplit.method === 'percent') return {method: 'percent', percents: {...g.defaultSplit.percents}};
  return {method: 'equal', participants: memberIds(g)};
}

export function spendSummary(db: Db, groupId: string, now: number, userId?: UserId) {
  const start = new Date(now);
  const monthStart = new Date(start.getFullYear(), start.getMonth(), 1).getTime();
  let month = 0, total = 0, count = 0;
  for (const c of db.charges) {
    if (c.groupId !== groupId || c.status !== 'settled') continue;
    const amount = userId ? currentProposal(c).shares[userId] ?? 0 : c.amount;
    if (userId && !amount) continue;
    total += amount;
    count++;
    if (c.createdAt >= monthStart) month += amount;
  }
  return {month, total, count};
}

export function periodSpend(db: Db, g: Group, userId: UserId) {
  return db.charges
    .filter(c => c.groupId === g.id && c.status === 'settled' && (c.settledAt ?? 0) >= g.periodStart)
    .reduce((a, c) => a + (currentProposal(c).shares[userId] ?? 0), 0);
}

// Itemized split status: what still blocks confirmation.
export function itemBoardStatus(c: Charge) {
  const r = c.receipt;
  if (!r) return {unclaimed: [] as ReceiptItem[], claimants: [] as UserId[], unlocked: [] as UserId[], ready: false};
  const unclaimed = r.items.filter(i => !i.people.length);
  const claimants = [...new Set(r.items.flatMap(i => i.people))];
  const unlocked = claimants.filter(id => !r.locked.includes(id));
  const ready = r.items.length > 0 && !unclaimed.length && !unlocked.length && !r.edits.length;
  return {unclaimed, claimants, unlocked, ready};
}

// ---------- Writes ----------

function ledger(db: Db, entry: Omit<LedgerEntry, 'id'>) {
  db.ledger.unshift({id: nextId(db, 'led'), ...entry});
}

function issueCard(db: Db, groupId: string, userId: UserId) {
  if (cardFor(db, groupId, userId)) return;
  const last4 = String(1000 + ((db.seq * 7919) % 9000)).slice(-4);
  db.cards.push({id: nextId(db, 'card'), groupId, userId, last4, wallet: null, frozen: false});
}

function credit(db: Db, g: Group, m: Member, amount: number, kind: LedgerEntry['kind'], now: number) {
  m.balance += amount;
  if (m.suspended && m.balance >= 0) m.suspended = false;
  ledger(db, {groupId: g.id, userId: m.userId, kind, amount, at: now});
}

export function createGroup(db: Db, actor: UserId, input: {name: string; inviteIds: UserId[]; budget: number; periodDays: number}, now: number) {
  const name = input.name.trim();
  if (!name) fail('Give the group a name.');
  const ids = [actor, ...input.inviteIds.filter(id => id !== actor)];
  if (new Set(ids).size !== ids.length) fail('Each person can only be invited once.');
  ids.forEach(id => userById(db, id));
  if (ids.length < 2) fail('Invite at least one person.');
  if (!Number.isSafeInteger(input.budget) || input.budget < ids.length * 100) fail('Set a budget of at least $1 per person.');
  if (!Number.isInteger(input.periodDays) || input.periodDays < 1 || input.periodDays > 365) fail('Choose a budget period between 1 and 365 days.');
  const g: Group = {
    id: nextId(db, 'grp'),
    name,
    createdBy: actor,
    createdAt: now,
    budget: input.budget,
    periodDays: input.periodDays,
    periodStart: now,
    members: ids.map(userId => ({userId, status: 'invited', balance: 0, autoDeposit: true, failTopUps: false, suspended: false})),
    defaultSplit: {method: 'equal'},
    frozen: null,
  };
  db.groups.push(g);
  respondInvite(db, actor, g.id, true, now);
  return g;
}

export function respondInvite(db: Db, actor: UserId, groupId: string, accept: boolean, now: number) {
  const g = groupById(db, groupId);
  const m = memberOf(g, actor);
  if (m.status === 'joined') fail('You already joined this group.');
  if (!accept) {
    g.members = g.members.filter(x => x.userId !== actor);
    return;
  }
  if (m.failTopUps) fail('Your bank declined the deposit (demo). Turn off failed top-ups to retry.');
  m.status = 'joined';
  credit(db, g, m, shares(g)[actor], 'deposit', now);
  issueCard(db, groupId, actor);
}

export function deposit(db: Db, actor: UserId, groupId: string, amount: number, now: number) {
  const g = groupById(db, groupId);
  const m = joinedMember(g, actor);
  if (!Number.isSafeInteger(amount) || amount <= 0) fail('Enter an amount greater than $0.');
  if (m.failTopUps) fail('Your bank declined the transfer (demo). Turn off failed top-ups to retry.');
  credit(db, g, m, amount, 'deposit', now);
}

export function withdraw(db: Db, actor: UserId, groupId: string, amount: number, now: number) {
  const g = groupById(db, groupId);
  const m = joinedMember(g, actor);
  if (!Number.isSafeInteger(amount) || amount <= 0) fail('Enter an amount greater than $0.');
  const pending = pendingCharge(db, groupId);
  if (pending) fail(`You can withdraw once the ${pending.merchant} split is settled.`);
  if (amount > m.balance) fail(`You can withdraw up to ${money(Math.max(0, m.balance))}.`);
  m.balance -= amount;
  ledger(db, {groupId, userId: actor, kind: 'withdrawal', amount: -amount, at: now});
}

export function setAutoDeposit(db: Db, actor: UserId, groupId: string, on: boolean) {
  joinedMember(groupById(db, groupId), actor).autoDeposit = on;
}

export function setFailTopUps(db: Db, actor: UserId, groupId: string, on: boolean) {
  memberOf(groupById(db, groupId), actor).failTopUps = on;
}

export function setDefaultSplit(db: Db, actor: UserId, groupId: string, split: DefaultSplit) {
  const g = groupById(db, groupId);
  joinedMember(g, actor);
  if (split.method === 'percent') {
    const result = computeSplit(memberIds(g), 10000, {method: 'percent', percents: split.percents});
    if (result.error) fail(result.error);
  }
  g.defaultSplit = split;
}

export function proposeBudget(db: Db, actor: UserId, groupId: string, amount: number, now: number) {
  const g = groupById(db, groupId);
  joinedMember(g, actor);
  if (!isActive(g)) fail('Wait until everyone has joined before changing the budget.');
  if (!Number.isSafeInteger(amount) || amount < g.members.length * 100) fail('Set at least $1 per person.');
  if (amount === g.budget) fail(`The budget is already ${money(amount)}.`);
  db.budgetProposals = db.budgetProposals.filter(p => p.groupId !== groupId);
  const p: BudgetProposal = {id: nextId(db, 'bud'), groupId, authorId: actor, amount, createdAt: now, acceptedBy: [actor]};
  db.budgetProposals.push(p);
  settleBudget(db, p);
}

export function respondBudget(db: Db, actor: UserId, proposalId: string, accept: boolean) {
  const p = db.budgetProposals.find(x => x.id === proposalId) ?? fail('That proposal is no longer open.');
  joinedMember(groupById(db, p.groupId), actor);
  if (!accept) {
    db.budgetProposals = db.budgetProposals.filter(x => x.id !== p.id);
    return;
  }
  if (!p.acceptedBy.includes(actor)) p.acceptedBy.push(actor);
  settleBudget(db, p);
}

// The new budget sets each person's share; the difference is collected at the next period start.
function settleBudget(db: Db, p: BudgetProposal) {
  const g = groupById(db, p.groupId);
  if (!g.members.every(m => p.acceptedBy.includes(m.userId))) return;
  g.budget = p.amount;
  db.budgetProposals = db.budgetProposals.filter(x => x.id !== p.id);
}

export function addToWallet(db: Db, actor: UserId, cardId: string, wallet: Wallet) {
  const card = db.cards.find(c => c.id === cardId && c.userId === actor) ?? fail('Card not found.');
  card.wallet = wallet;
}

export function setCardFrozen(db: Db, actor: UserId, cardId: string, frozen: boolean) {
  const card = db.cards.find(c => c.id === cardId && c.userId === actor) ?? fail('Card not found.');
  card.frozen = frozen;
}

export function purchase(db: Db, actor: UserId, groupId: string, input: {merchant: string; amount: number}, now: number) {
  const g = groupById(db, groupId);
  joinedMember(g, actor);
  const merchant = input.merchant.trim();
  if (!merchant) fail('Enter a merchant name.');
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) fail('Enter a purchase amount.');
  const blocker = purchaseBlocker(db, groupId, actor);
  if (blocker) fail(blocker);
  const limit = spendLimit(db, groupId, actor);
  if (input.amount > limit) fail(`Declined: the group fund only has ${money(limit)} available.`);
  const first = defaultInput(g);
  const charge: Charge = {
    id: nextId(db, 'chg'),
    groupId,
    cardholderId: actor,
    merchant,
    amount: input.amount,
    createdAt: now,
    status: 'pending',
    receipt: null,
    proposals: [{id: nextId(db, 'prop'), authorId: null, createdAt: now, input: first, shares: computeSplit(memberIds(g), input.amount, first).shares, acceptedBy: []}],
  };
  db.charges.unshift(charge);
  return charge;
}

function openCharge(db: Db, actor: UserId, chargeId: string) {
  const c = chargeById(db, chargeId);
  const g = groupById(db, c.groupId);
  joinedMember(g, actor);
  if (c.status !== 'pending') fail('This charge is no longer open.');
  return {c, g};
}

function board(c: Charge) {
  return c.receipt ?? fail('Scan the receipt first.');
}

export function scanReceipt(db: Db, actor: UserId, chargeId: string, now: number) {
  const {c} = openCharge(db, actor, chargeId);
  const scanned = ocr(c.merchant, c.amount, c.id);
  c.receipt = {items: scanned.items.map(i => ({...i, people: []})), tax: scanned.tax, tip: scanned.tip, itemized: scanned.itemized, scannedAt: now, locked: [], edits: []};
  return c.receipt;
}

// Fixing scan mistakes changes everyone's totals, so all locks are released.
export function updateReceipt(db: Db, actor: UserId, chargeId: string, input: {items: {id: string; name: string; amount: number}[]; tax: number; tip: number}) {
  const {c} = openCharge(db, actor, chargeId);
  const r = board(c);
  if (!input.items.length) fail('Keep at least one item.');
  if (input.items.some(i => !i.name.trim() || !Number.isSafeInteger(i.amount) || i.amount <= 0)) fail('Give every item a name and a positive amount.');
  if (![input.tax, input.tip].every(v => Number.isSafeInteger(v) && v >= 0)) fail('Tax and tip must be valid amounts.');
  const total = input.items.reduce((a, i) => a + i.amount, 0) + input.tax + input.tip;
  if (total !== c.amount) fail(`Items, tax and tip add up to ${money(total)}, but the charge was ${money(c.amount)}.`);
  r.items = input.items.map(i => ({id: i.id, name: i.name.trim(), amount: i.amount, people: r.items.find(x => x.id === i.id)?.people ?? []}));
  r.tax = input.tax;
  r.tip = input.tip;
  r.locked = [];
  r.edits = r.edits.filter(e => r.items.some(i => i.id === e.itemId));
}

export function toggleClaim(db: Db, actor: UserId, chargeId: string, itemId: string) {
  const {c} = openCharge(db, actor, chargeId);
  const r = board(c);
  if (r.locked.includes(actor)) fail('Unlock your selection to change it.');
  const item = r.items.find(i => i.id === itemId) ?? fail('Item not found.');
  item.people = item.people.includes(actor) ? item.people.filter(p => p !== actor) : [...item.people, actor];
}

export function setLocked(db: Db, actor: UserId, chargeId: string, locked: boolean, now: number) {
  const {c} = openCharge(db, actor, chargeId);
  const r = board(c);
  r.locked = locked ? [...new Set([...r.locked, actor])] : r.locked.filter(id => id !== actor);
  confirmItemsIfReady(db, c, now);
}

export function suggestItemEdit(db: Db, actor: UserId, chargeId: string, itemId: string, targetId: UserId, now: number) {
  const {c, g} = openCharge(db, actor, chargeId);
  const r = board(c);
  if (targetId === actor) fail('Change your own items directly.');
  joinedMember(g, targetId);
  const item = r.items.find(i => i.id === itemId) ?? fail('Item not found.');
  if (r.edits.some(e => e.itemId === itemId && e.targetId === targetId)) fail('There is already a pending edit for that.');
  r.edits.push({id: nextId(db, 'edit'), itemId, targetId, action: item.people.includes(targetId) ? 'remove' : 'add', authorId: actor, createdAt: now});
}

export function respondItemEdit(db: Db, actor: UserId, chargeId: string, editId: string, accept: boolean, now: number) {
  const {c} = openCharge(db, actor, chargeId);
  const r = board(c);
  const edit = r.edits.find(e => e.id === editId) ?? fail('That edit is no longer pending.');
  if (edit.targetId !== actor) fail('Only the person this edit affects can respond to it.');
  r.edits = r.edits.filter(e => e.id !== editId);
  if (accept) {
    const item = r.items.find(i => i.id === edit.itemId);
    if (item) item.people = edit.action === 'add' ? [...new Set([...item.people, actor])] : item.people.filter(p => p !== actor);
  }
  confirmItemsIfReady(db, c, now);
}

function confirmItemsIfReady(db: Db, c: Charge, now: number) {
  if (!itemBoardStatus(c).ready) return;
  const r = c.receipt!;
  const g = groupById(db, c.groupId);
  const input: SplitInput = {method: 'items', items: r.items.map(i => ({...i, people: [...i.people]})), tax: r.tax, tip: r.tip};
  const result = computeSplit(memberIds(g), c.amount, input);
  if (result.error) return;
  c.proposals.push({id: nextId(db, 'prop'), authorId: null, createdAt: now, input, shares: result.shares, acceptedBy: requiredApprovers({shares: result.shares} as Proposal)});
  settle(db, c, now);
}

export function proposeSplit(db: Db, actor: UserId, chargeId: string, input: SplitInput, now: number) {
  const {c, g} = openCharge(db, actor, chargeId);
  const result = computeSplit(memberIds(g), c.amount, input);
  if (result.error) fail(result.error);
  c.proposals.push({id: nextId(db, 'prop'), authorId: actor, createdAt: now, input, shares: result.shares, acceptedBy: [actor]});
  if (!waitingOn(currentProposal(c)).length) settle(db, c, now);
}

export function acceptSplit(db: Db, actor: UserId, chargeId: string, now: number) {
  const {c} = openCharge(db, actor, chargeId);
  const p = currentProposal(c);
  if (!requiredApprovers(p).includes(actor)) fail('You have no share in this split, so your approval isn’t needed.');
  if (!p.acceptedBy.includes(actor)) p.acceptedBy.push(actor);
  if (!waitingOn(p).length) settle(db, c, now);
}

// Negative balances are recovered from the member's bank; if that fails the member is suspended
// and the shortfall is carried by the rest of the group until repaid.
function settle(db: Db, c: Charge, now: number) {
  const p = currentProposal(c);
  const g = groupById(db, c.groupId);
  for (const m of g.members) {
    const share = p.shares[m.userId] ?? 0;
    if (!share) continue;
    m.balance -= share;
    ledger(db, {groupId: g.id, userId: m.userId, kind: 'charge', amount: -share, at: now, chargeId: c.id});
    if (m.balance >= 0) continue;
    const owed = -m.balance;
    if (m.failTopUps) {
      m.suspended = true;
      ledger(db, {groupId: g.id, userId: m.userId, kind: 'debt-recovery-failed', amount: owed, at: now, chargeId: c.id});
    } else {
      credit(db, g, m, owed, 'debt-recovery', now);
    }
  }
  c.status = 'settled';
  c.settledAt = now;
}

export function fileChargeback(db: Db, actor: UserId, chargeId: string, now: number) {
  const c = chargeById(db, chargeId);
  const g = groupById(db, c.groupId);
  joinedMember(g, actor);
  if (c.status !== 'settled') fail('Only settled charges can be disputed.');
  c.status = 'disputed';
  c.dispute = {reason: 'Chargeback filed — escalated to the dispute center as potential fraud.', at: now};
  g.frozen = {reason: `chargeback on ${c.merchant} is under review.`, at: now};
}

// Demo-only stand-in for the dispute center: support applies the latest proposal and unfreezes.
export function resolveDisputes(db: Db, groupId: string, now: number) {
  const g = groupById(db, groupId);
  if (!g.frozen) fail('This group isn’t frozen.');
  for (const c of db.charges) {
    if (c.groupId !== groupId || c.status !== 'disputed' || c.settledAt) continue;
    const p = currentProposal(c);
    p.acceptedBy = requiredApprovers(p);
    settle(db, c, now);
    c.dispute = {reason: 'Resolved by support using the latest proposed split.', at: now};
  }
  g.frozen = null;
}

// At each period start, auto-refill members are charged up to their share; others top up manually.
export function rollPeriods(db: Db, now: number) {
  for (const g of db.groups) {
    while (now >= nextPeriodAt(g)) {
      g.periodStart = nextPeriodAt(g);
      const owed = shares(g);
      for (const m of g.members) {
        const need = owed[m.userId] - m.balance;
        if (m.status !== 'joined' || !m.autoDeposit || need <= 0) continue;
        if (m.failTopUps) ledger(db, {groupId: g.id, userId: m.userId, kind: 'top-up-failed', amount: need, at: g.periodStart});
        else credit(db, g, m, need, 'period-top-up', g.periodStart);
      }
    }
  }
}

export function enforceDeadlines(db: Db, now: number) {
  for (const c of db.charges) {
    if (c.status !== 'pending' || now - c.createdAt < SPLIT_DEADLINE) continue;
    c.status = 'disputed';
    c.dispute = {reason: 'No split was agreed within 7 days — escalated to the dispute center.', at: now};
    groupById(db, c.groupId).frozen = {reason: `the ${c.merchant} split wasn’t agreed within 7 days.`, at: now};
  }
}

export function tick(db: Db, now: number) {
  rollPeriods(db, now);
  enforceDeadlines(db, now);
}
