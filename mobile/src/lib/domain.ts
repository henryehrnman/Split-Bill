import {allocate, money} from './money.ts';
import {computeSplit} from './split.ts';
import type {ReceiptItem, Shares, SplitInput, UserId} from './split.ts';
import {scanReceipt as ocr} from './fakeOcr.ts';

export type Wallet = 'Apple Wallet' | 'Google Wallet';
export type User = {id: UserId; name: string; initials: string; tone: number};
export type DefaultSplit = {method: 'equal'} | {method: 'percent'; percents: Record<UserId, number>};
export type Member = {userId: UserId; joined: boolean; balance: number; autoDeposit: boolean; failTopUps: boolean};
export type Group = {
  id: string;
  name: string;
  createdBy: UserId;
  createdAt: number;
  buyingPower: number;
  members: Member[];
  defaultSplit: DefaultSplit;
  frozen: null | {reason: string; at: number};
};
export type Card = {id: string; groupId: string; userId: UserId; last4: string; wallet: Wallet | null; frozen: boolean};
export type Receipt = {items: ReceiptItem[]; tax: number; tip: number; itemized: boolean; scannedAt: number};
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
export type BuyingPowerProposal = {id: string; groupId: string; authorId: UserId; amount: number; createdAt: number; acceptedBy: UserId[]};
export type LedgerEntry = {
  id: string;
  groupId: string;
  userId: UserId;
  kind: 'deposit' | 'withdrawal' | 'auto-deposit' | 'top-up-failed' | 'charge';
  amount: number;
  at: number;
  chargeId?: string;
};
export type Db = {
  version: 2;
  seq: number;
  clockOffset: number;
  users: User[];
  groups: Group[];
  cards: Card[];
  charges: Charge[];
  buyingPowerProposals: BuyingPowerProposal[];
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
export const isActive = (g: Group) => g.members.every(m => m.joined);
export const fundBalance = (g: Group) => g.members.reduce((a, m) => a + m.balance, 0);
export const pendingCharge = (db: Db, groupId: string) => db.charges.find(c => c.groupId === groupId && c.status === 'pending') ?? null;
export const availableFunds = (db: Db, g: Group) => fundBalance(g) - (pendingCharge(db, g.id)?.amount ?? 0);
export const currentProposal = (c: Charge) => c.proposals[c.proposals.length - 1];
export const cardFor = (db: Db, groupId: string, userId: UserId) => db.cards.find(c => c.groupId === groupId && c.userId === userId) ?? null;
export const openBuyingPowerProposal = (db: Db, groupId: string) => db.buyingPowerProposals.find(p => p.groupId === groupId) ?? null;

export function memberOf(g: Group, userId: UserId) {
  return g.members.find(m => m.userId === userId) ?? fail('You are not a member of this group.');
}

// Each member keeps an equal slice of the group's buying power on deposit.
export function requiredBalances(g: Group, buyingPower = g.buyingPower): Record<UserId, number> {
  const parts = allocate(buyingPower, g.members.map(() => 1));
  return Object.fromEntries(g.members.map((m, i) => [m.userId, parts[i]]));
}

export const inGoodStanding = (g: Group, userId: UserId) => memberOf(g, userId).balance >= requiredBalances(g)[userId];

export function requiredApprovers(p: Proposal) {
  return Object.entries(p.shares).filter(([, v]) => v > 0).map(([k]) => k);
}

export function waitingOn(p: Proposal) {
  return requiredApprovers(p).filter(id => !p.acceptedBy.includes(id));
}

export function spendLimit(db: Db, groupId: string, userId: UserId) {
  const g = groupById(db, groupId);
  if (!isActive(g) || g.frozen) return 0;
  const fund = Math.max(0, fundBalance(g));
  if (inGoodStanding(g, userId)) return fund;
  return Math.max(0, Math.min(memberOf(g, userId).balance, fund));
}

export function purchaseBlocker(db: Db, groupId: string, userId: UserId): string | null {
  const g = groupById(db, groupId);
  const card = cardFor(db, groupId, userId);
  if (g.frozen) return `This group is frozen: ${g.frozen.reason}`;
  if (!isActive(g)) return 'Everyone needs to make their first deposit before the card can be used.';
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

// ---------- Writes ----------

function ledger(db: Db, entry: Omit<LedgerEntry, 'id'>) {
  db.ledger.unshift({id: nextId(db, 'led'), ...entry});
}

function topUp(db: Db, g: Group, m: Member, now: number) {
  const need = requiredBalances(g)[m.userId] - m.balance;
  if (need <= 0) return;
  if (m.failTopUps) return ledger(db, {groupId: g.id, userId: m.userId, kind: 'top-up-failed', amount: need, at: now});
  m.balance += need;
  ledger(db, {groupId: g.id, userId: m.userId, kind: 'auto-deposit', amount: need, at: now});
}

function runAutoDeposits(db: Db, g: Group, now: number) {
  for (const m of g.members) if (m.autoDeposit && m.joined) topUp(db, g, m, now);
}

function issueCard(db: Db, groupId: string, userId: UserId) {
  if (cardFor(db, groupId, userId)) return;
  const last4 = String(1000 + ((db.seq * 7919) % 9000)).slice(-4);
  db.cards.push({id: nextId(db, 'card'), groupId, userId, last4, wallet: null, frozen: false});
}

export function createGroup(db: Db, actor: UserId, input: {name: string; memberIds: UserId[]; buyingPower: number}, now: number) {
  const name = input.name.trim();
  if (!name) fail('Give the group a name.');
  const ids = [actor, ...input.memberIds.filter(id => id !== actor)];
  if (new Set(ids).size !== ids.length) fail('Each person can only be added once.');
  ids.forEach(id => userById(db, id));
  if (ids.length < 2) fail('A group needs at least two people.');
  if (!Number.isSafeInteger(input.buyingPower) || input.buyingPower < ids.length * 100) fail('Set a buying power of at least $1 per person.');
  const g: Group = {
    id: nextId(db, 'grp'),
    name,
    createdBy: actor,
    createdAt: now,
    buyingPower: input.buyingPower,
    members: ids.map(userId => ({userId, joined: false, balance: 0, autoDeposit: false, failTopUps: false})),
    defaultSplit: {method: 'equal'},
    frozen: null,
  };
  db.groups.push(g);
  return g;
}

export function joinGroup(db: Db, actor: UserId, groupId: string, now: number) {
  const g = groupById(db, groupId);
  const m = memberOf(g, actor);
  if (m.joined) fail('You already joined this group.');
  if (m.failTopUps) fail('Your bank declined the deposit (demo). Turn off failed top-ups in your profile to retry.');
  const amount = requiredBalances(g)[actor];
  m.balance += amount;
  m.joined = true;
  ledger(db, {groupId, userId: actor, kind: 'deposit', amount, at: now});
  issueCard(db, groupId, actor);
}

export function deposit(db: Db, actor: UserId, groupId: string, amount: number, now: number) {
  const g = groupById(db, groupId);
  const m = memberOf(g, actor);
  if (!m.joined) fail('Make your first deposit to join the group.');
  if (!Number.isSafeInteger(amount) || amount <= 0) fail('Enter an amount greater than $0.');
  if (m.failTopUps) fail('Your bank declined the transfer (demo). Turn off failed top-ups to retry.');
  m.balance += amount;
  ledger(db, {groupId, userId: actor, kind: 'deposit', amount, at: now});
}

export function withdraw(db: Db, actor: UserId, groupId: string, amount: number, now: number) {
  const g = groupById(db, groupId);
  const m = memberOf(g, actor);
  if (!Number.isSafeInteger(amount) || amount <= 0) fail('Enter an amount greater than $0.');
  if (amount > m.balance) fail(`You can withdraw up to ${money(Math.max(0, m.balance))}.`);
  const pending = pendingCharge(db, groupId);
  if (pending && fundBalance(g) - amount < pending.amount) fail(`The group fund must keep ${money(pending.amount)} for the pending ${pending.merchant} charge.`);
  m.balance -= amount;
  ledger(db, {groupId, userId: actor, kind: 'withdrawal', amount: -amount, at: now});
}

export function setAutoDeposit(db: Db, actor: UserId, groupId: string, on: boolean, now: number) {
  const g = groupById(db, groupId);
  const m = memberOf(g, actor);
  m.autoDeposit = on;
  if (on && m.joined) topUp(db, g, m, now);
}

export function setFailTopUps(db: Db, actor: UserId, groupId: string, on: boolean) {
  memberOf(groupById(db, groupId), actor).failTopUps = on;
}

export function setDefaultSplit(db: Db, actor: UserId, groupId: string, split: DefaultSplit) {
  const g = groupById(db, groupId);
  memberOf(g, actor);
  if (split.method === 'percent') {
    const result = computeSplit(memberIds(g), 10000, {method: 'percent', percents: split.percents});
    if (result.error) fail(result.error);
  }
  g.defaultSplit = split;
}

export function proposeBuyingPower(db: Db, actor: UserId, groupId: string, amount: number, now: number) {
  const g = groupById(db, groupId);
  memberOf(g, actor);
  if (!isActive(g)) fail('Wait until everyone has joined before changing buying power.');
  if (!Number.isSafeInteger(amount) || amount < g.members.length * 100) fail('Set at least $1 per person.');
  if (amount === g.buyingPower) fail(`Buying power is already ${money(amount)}.`);
  db.buyingPowerProposals = db.buyingPowerProposals.filter(p => p.groupId !== groupId);
  const p: BuyingPowerProposal = {id: nextId(db, 'bpp'), groupId, authorId: actor, amount, createdAt: now, acceptedBy: [actor]};
  db.buyingPowerProposals.push(p);
  settleBuyingPower(db, p, now);
}

export function respondBuyingPower(db: Db, actor: UserId, proposalId: string, accept: boolean, now: number) {
  const p = db.buyingPowerProposals.find(x => x.id === proposalId) ?? fail('That proposal is no longer open.');
  memberOf(groupById(db, p.groupId), actor);
  if (!accept) {
    db.buyingPowerProposals = db.buyingPowerProposals.filter(x => x.id !== p.id);
    return;
  }
  if (!p.acceptedBy.includes(actor)) p.acceptedBy.push(actor);
  settleBuyingPower(db, p, now);
}

function settleBuyingPower(db: Db, p: BuyingPowerProposal, now: number) {
  const g = groupById(db, p.groupId);
  if (!g.members.every(m => p.acceptedBy.includes(m.userId))) return;
  g.buyingPower = p.amount;
  db.buyingPowerProposals = db.buyingPowerProposals.filter(x => x.id !== p.id);
  runAutoDeposits(db, g, now);
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
  memberOf(g, actor);
  const merchant = input.merchant.trim();
  if (!merchant) fail('Enter a merchant name.');
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) fail('Enter a purchase amount.');
  const blocker = purchaseBlocker(db, groupId, actor);
  if (blocker) fail(blocker);
  const limit = spendLimit(db, groupId, actor);
  if (input.amount > limit) {
    fail(inGoodStanding(g, actor)
      ? `Declined: the group fund only has ${money(limit)} available.`
      : `Declined: your balance is below your share, so you can only spend your own ${money(limit)} until you top up.`);
  }
  const input0 = defaultInput(g);
  const charge: Charge = {
    id: nextId(db, 'chg'),
    groupId,
    cardholderId: actor,
    merchant,
    amount: input.amount,
    createdAt: now,
    status: 'pending',
    receipt: null,
    proposals: [{id: nextId(db, 'prop'), authorId: null, createdAt: now, input: input0, shares: computeSplit(memberIds(g), input.amount, input0).shares, acceptedBy: []}],
  };
  db.charges.unshift(charge);
  return charge;
}

export function scanReceipt(db: Db, actor: UserId, chargeId: string, now: number) {
  const c = chargeById(db, chargeId);
  memberOf(groupById(db, c.groupId), actor);
  if (c.status !== 'pending') fail('Receipts can only be added while the split is open.');
  const scanned = ocr(c.merchant, c.amount, c.id);
  c.receipt = {items: scanned.items.map(i => ({...i, people: []})), tax: scanned.tax, tip: scanned.tip, itemized: scanned.itemized, scannedAt: now};
  return c.receipt;
}

export function proposeSplit(db: Db, actor: UserId, chargeId: string, input: SplitInput, now: number) {
  const c = chargeById(db, chargeId);
  const g = groupById(db, c.groupId);
  memberOf(g, actor);
  if (c.status !== 'pending') fail('This charge is no longer open for changes.');
  const result = computeSplit(memberIds(g), c.amount, input);
  if (result.error) fail(result.error);
  c.proposals.push({id: nextId(db, 'prop'), authorId: actor, createdAt: now, input, shares: result.shares, acceptedBy: [actor]});
  settleIfAgreed(db, c, now);
}

export function acceptSplit(db: Db, actor: UserId, chargeId: string, now: number) {
  const c = chargeById(db, chargeId);
  memberOf(groupById(db, c.groupId), actor);
  if (c.status !== 'pending') fail('This charge is no longer open.');
  const p = currentProposal(c);
  if (!requiredApprovers(p).includes(actor)) fail('You have no share in this split, so your approval isn’t needed.');
  if (!p.acceptedBy.includes(actor)) p.acceptedBy.push(actor);
  settleIfAgreed(db, c, now);
}

function settleIfAgreed(db: Db, c: Charge, now: number) {
  const p = currentProposal(c);
  if (waitingOn(p).length) return;
  const g = groupById(db, c.groupId);
  for (const m of g.members) {
    const share = p.shares[m.userId] ?? 0;
    if (!share) continue;
    m.balance -= share;
    ledger(db, {groupId: g.id, userId: m.userId, kind: 'charge', amount: -share, at: now, chargeId: c.id});
  }
  c.status = 'settled';
  c.settledAt = now;
  runAutoDeposits(db, g, now);
}

export function fileChargeback(db: Db, actor: UserId, chargeId: string, now: number) {
  const c = chargeById(db, chargeId);
  const g = groupById(db, c.groupId);
  memberOf(g, actor);
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
    c.status = 'pending';
    settleIfAgreedBySupport(db, c, now);
  }
  g.frozen = null;
}

function settleIfAgreedBySupport(db: Db, c: Charge, now: number) {
  const p = currentProposal(c);
  p.acceptedBy = requiredApprovers(p);
  settleIfAgreed(db, c, now);
  c.dispute = {reason: 'Resolved by support using the latest proposed split.', at: now};
}

export function enforceDeadlines(db: Db, now: number) {
  for (const c of db.charges) {
    if (c.status !== 'pending' || now - c.createdAt < SPLIT_DEADLINE) continue;
    c.status = 'disputed';
    c.dispute = {reason: 'No split was agreed within 7 days — escalated to the dispute center.', at: now};
    const g = groupById(db, c.groupId);
    g.frozen = {reason: `the ${c.merchant} split wasn’t agreed within 7 days.`, at: now};
  }
}
