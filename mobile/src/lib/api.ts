import AsyncStorage from '@react-native-async-storage/async-storage';
import * as d from './domain';
import type {Db, DefaultSplit, Wallet} from './domain';
import type {SplitInput, UserId} from './split';
import {seed} from './seed';

// Fake backend: same call shape a real HTTP client will have later, with every rule
// enforced in domain.ts and data persisted on this device.
const STORAGE_KEY = 'splitbill.fake-backend.v2';
const LATENCY_MS = 120;

let db: Db | null = null;
let queue: Promise<unknown> = Promise.resolve();

const clone = (x: Db): Db => JSON.parse(JSON.stringify(x));
const wait = () => new Promise(resolve => setTimeout(resolve, LATENCY_MS));

function decode(raw: string | null): Db | null {
  if (!raw) return null;
  try {
    const x = JSON.parse(raw);
    const lists = ['users', 'groups', 'cards', 'charges', 'buyingPowerProposals', 'ledger'];
    return x && x.version === 2 && lists.every(k => Array.isArray(x[k])) ? (x as Db) : null;
  } catch {
    return null;
  }
}

async function load(): Promise<Db> {
  if (db) return db;
  try {
    db = decode(await AsyncStorage.getItem(STORAGE_KEY));
  } catch {
    db = null;
  }
  db ??= seed(Date.now());
  return db;
}

export const now = (x: Db) => Date.now() + x.clockOffset;

function mutate(fn: (x: Db, t: number) => void): Promise<Db> {
  const run = queue.then(async () => {
    const current = await load();
    await wait();
    const next = clone(current);
    const t = now(next);
    d.enforceDeadlines(next, t);
    fn(next, t);
    db = next;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    return next;
  });
  queue = run.catch(() => {});
  return run;
}

export const api = {
  async fetch(): Promise<Db> {
    return mutate(() => {});
  },
  createGroup: (actor: UserId, input: {name: string; memberIds: UserId[]; buyingPower: number}) => mutate((x, t) => void d.createGroup(x, actor, input, t)),
  joinGroup: (actor: UserId, groupId: string) => mutate((x, t) => d.joinGroup(x, actor, groupId, t)),
  deposit: (actor: UserId, groupId: string, amount: number) => mutate((x, t) => d.deposit(x, actor, groupId, amount, t)),
  withdraw: (actor: UserId, groupId: string, amount: number) => mutate((x, t) => d.withdraw(x, actor, groupId, amount, t)),
  setAutoDeposit: (actor: UserId, groupId: string, on: boolean) => mutate((x, t) => d.setAutoDeposit(x, actor, groupId, on, t)),
  setFailTopUps: (actor: UserId, groupId: string, on: boolean) => mutate(x => d.setFailTopUps(x, actor, groupId, on)),
  setDefaultSplit: (actor: UserId, groupId: string, split: DefaultSplit) => mutate(x => d.setDefaultSplit(x, actor, groupId, split)),
  proposeBuyingPower: (actor: UserId, groupId: string, amount: number) => mutate((x, t) => d.proposeBuyingPower(x, actor, groupId, amount, t)),
  respondBuyingPower: (actor: UserId, proposalId: string, accept: boolean) => mutate((x, t) => d.respondBuyingPower(x, actor, proposalId, accept, t)),
  addToWallet: (actor: UserId, cardId: string, wallet: Wallet) => mutate(x => d.addToWallet(x, actor, cardId, wallet)),
  setCardFrozen: (actor: UserId, cardId: string, frozen: boolean) => mutate(x => d.setCardFrozen(x, actor, cardId, frozen)),
  purchase: (actor: UserId, groupId: string, input: {merchant: string; amount: number}) => mutate((x, t) => void d.purchase(x, actor, groupId, input, t)),
  scanReceipt: (actor: UserId, chargeId: string) => mutate((x, t) => void d.scanReceipt(x, actor, chargeId, t)),
  proposeSplit: (actor: UserId, chargeId: string, input: SplitInput) => mutate((x, t) => d.proposeSplit(x, actor, chargeId, input, t)),
  acceptSplit: (actor: UserId, chargeId: string) => mutate((x, t) => d.acceptSplit(x, actor, chargeId, t)),
  fileChargeback: (actor: UserId, chargeId: string) => mutate((x, t) => d.fileChargeback(x, actor, chargeId, t)),
  // Demo controls with no production equivalent.
  resolveDisputes: (groupId: string) => mutate((x, t) => d.resolveDisputes(x, groupId, t)),
  skipAhead: (days: number) =>
    mutate(x => {
      x.clockOffset += days * d.DAY;
      d.enforceDeadlines(x, now(x));
    }),
  async reset(): Promise<Db> {
    const run = queue.then(async () => {
      db = seed(Date.now());
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(db)).catch(() => {});
      return db;
    });
    queue = run.catch(() => {});
    return run;
  },
};
