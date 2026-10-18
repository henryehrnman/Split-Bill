import AsyncStorage from '@react-native-async-storage/async-storage';
import * as d from './domain';
import type {Db, DefaultSplit, Wallet} from './domain';
import type {SplitInput, UserId} from './split';
import {seed} from './seed';
import {accessToken, backendIdentity} from './auth';
import {apiUrl, publishableKey} from './config';
import {createRpcClient, RpcError} from './http';

export type ReceiptPhoto = {data: string; mediaType: string};

// Fake backend: same call shape a real HTTP client will have later, with every rule
// enforced in domain.ts and data persisted on this device.
const STORAGE_KEY = 'splitbill.fake-backend.v6';
const LATENCY_MS = 120;

let db: Db | null = null;
let queue: Promise<unknown> = Promise.resolve();

const clone = (x: Db): Db => JSON.parse(JSON.stringify(x));
const wait = () => new Promise(resolve => setTimeout(resolve, LATENCY_MS));

function decode(raw: string | null): Db | null {
  if (!raw) return null;
  try {
    const x = JSON.parse(raw);
    const lists = ['users', 'groups', 'cards', 'charges', 'budgetProposals', 'ledger', 'notifications'];
    return x && x.version === 6 && lists.every(k => Array.isArray(x[k])) ? (x as Db) : null;
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

function enqueue(fn: () => Promise<Db>): Promise<Db> {
  const run = queue.then(fn);
  queue = run.catch(() => {});
  return run;
}

function mutate(fn: (x: Db, t: number) => void): Promise<Db> {
  return enqueue(async () => {
    const current = await load();
    await wait();
    const next = clone(current);
    const t = now(next);
    d.tick(next, t);
    fn(next, t);
    db = next;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    return next;
  });
}

const fakeApi = {
  fetch: () => mutate(() => {}),
  searchUsers: async (actor: UserId, query: string, exclude: UserId[]) => d.searchUsers(await load(), query, [actor, ...exclude]),
  createGroup: (actor: UserId, input: {name: string; inviteIds: UserId[]; budget: number; periodDays: number}) => mutate((x, t) => void d.createGroup(x, actor, input, t)),
  respondInvite: (actor: UserId, groupId: string, accept: boolean) => mutate((x, t) => d.respondInvite(x, actor, groupId, accept, t)),
  deposit: (actor: UserId, groupId: string, amount: number) => mutate((x, t) => d.deposit(x, actor, groupId, amount, t)),
  withdraw: (actor: UserId, groupId: string, amount: number) => mutate((x, t) => d.withdraw(x, actor, groupId, amount, t)),
  setAutoDeposit: (actor: UserId, groupId: string, on: boolean) => mutate(x => d.setAutoDeposit(x, actor, groupId, on)),
  setFailTopUps: (actor: UserId, groupId: string, on: boolean) => mutate(x => d.setFailTopUps(x, actor, groupId, on)),
  setDefaultSplit: (actor: UserId, groupId: string, split: DefaultSplit) => mutate(x => d.setDefaultSplit(x, actor, groupId, split)),
  setSingleOpenCharge: (actor: UserId, groupId: string, on: boolean) => mutate(x => d.setSingleOpenCharge(x, actor, groupId, on)),
  proposeBudget: (actor: UserId, groupId: string, amount: number) => mutate((x, t) => d.proposeBudget(x, actor, groupId, amount, t)),
  respondBudget: (actor: UserId, proposalId: string, accept: boolean) => mutate(x => d.respondBudget(x, actor, proposalId, accept)),
  addToWallet: (actor: UserId, cardId: string, wallet: Wallet) => mutate(x => d.addToWallet(x, actor, cardId, wallet)),
  setCardFrozen: (actor: UserId, cardId: string, frozen: boolean) => mutate(x => d.setCardFrozen(x, actor, cardId, frozen)),
  purchase: (actor: UserId, groupId: string, input: {merchant: string; amount: number}) => mutate((x, t) => void d.purchase(x, actor, groupId, input, t)),
  scanReceipt: (actor: UserId, chargeId: string, _photo?: ReceiptPhoto) => mutate((x, t) => void d.scanReceipt(x, actor, chargeId, t)),
  updateReceipt: (actor: UserId, chargeId: string, input: {items: {id: string; name: string; amount: number}[]; tax: number; tip: number}) => mutate(x => d.updateReceipt(x, actor, chargeId, input)),
  toggleClaim: (actor: UserId, chargeId: string, itemId: string) => mutate(x => d.toggleClaim(x, actor, chargeId, itemId)),
  setLocked: (actor: UserId, chargeId: string, locked: boolean, expectedReceiptKey?: string) => mutate((x, t) => d.setLocked(x, actor, chargeId, locked, t, expectedReceiptKey)),
  suggestItemEdit: (actor: UserId, chargeId: string, itemId: string, targetId: UserId) => mutate((x, t) => d.suggestItemEdit(x, actor, chargeId, itemId, targetId, t)),
  respondItemEdit: (actor: UserId, chargeId: string, editId: string, accept: boolean) => mutate((x, t) => d.respondItemEdit(x, actor, chargeId, editId, accept, t)),
  proposeSplit: (actor: UserId, chargeId: string, input: SplitInput) => mutate((x, t) => d.proposeSplit(x, actor, chargeId, input, t)),
  sendDefaultSplit: (actor: UserId, chargeId: string) => mutate((x, t) => d.sendDefaultSplit(x, actor, chargeId, t)),
  acceptSplit: (actor: UserId, chargeId: string, expectedProposalId: string) => mutate((x, t) => d.acceptSplit(x, actor, chargeId, t, expectedProposalId)),
  fileChargeback: (actor: UserId, chargeId: string) => mutate((x, t) => d.fileChargeback(x, actor, chargeId, t)),
  // Demo controls with no production equivalent.
  resolveDisputes: (groupId: string) => mutate((x, t) => d.resolveDisputes(x, groupId, t)),
  skipAhead: (days: number) =>
    mutate(x => {
      x.clockOffset += days * d.DAY;
      d.tick(x, now(x));
    }),
  reset: () =>
    enqueue(async () => {
      db = seed(Date.now());
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(db)).catch(() => {});
      return db;
    }),
};

const rpc = createRpcClient({url: apiUrl, publishableKey, getToken: accessToken});
// Vision processing can take longer than ordinary group actions.
const photoRpc = createRpcClient({url: apiUrl, publishableKey, getToken: accessToken, timeoutMs: 60000});
let remoteQueue: Promise<unknown> = Promise.resolve();
let remoteViewer: {identity: ReturnType<typeof backendIdentity>; id: UserId} | null = null;
export const remoteViewerId = () => remoteViewer?.identity === backendIdentity() ? remoteViewer.id : null;

function remoteState(method: string, args: unknown[] = []): Promise<Db> {
  const identity = backendIdentity();
  const check = () => {
    if (identity.demoMode || !identity.userId || backendIdentity() !== identity) throw new RpcError('Your session changed. Please sign in again.', 401, 'session_changed');
  };
  const result = remoteQueue.then(async () => {
    check();
    const client = method === 'scanReceipt' && args[1] ? photoRpc : rpc;
    const state = await client.state(method, args);
    check();
    remoteViewer = {identity, id: state.viewerId};
    return state.db;
  });
  remoteQueue = result.catch(() => {});
  return result;
}

export const createProfile = (profile: {name: string; handle: string; email: string; phone: string}) => remoteState('createUser', [profile]);

// Preserve screen call signatures, but never send the caller-supplied actor over HTTP.
// Demo state remains local; switching mode never copies it into a real account.
const demoOnly = new Set(['reset', 'skipAhead', 'resolveDisputes', 'setFailTopUps']);
export const api: typeof fakeApi = new Proxy(fakeApi, {
  get(target, property: keyof typeof fakeApi) {
    const local = target[property];
    if (typeof local !== 'function') return local;
    return (...args: unknown[]) => {
      if (backendIdentity().demoMode) return (local as (...values: unknown[]) => unknown)(...args);
      if (demoOnly.has(property)) return Promise.reject(new RpcError('This control is available only in demo mode.', 403, 'demo_only'));
      if (property !== 'fetch' && args[0] !== remoteViewerId()) return Promise.reject(new RpcError('Your account changed. Refresh and try again.', 401, 'session_changed'));
      if (property === 'searchUsers') {
        const identity = backendIdentity();
        return rpc.request<d.User[]>('searchUsers', args.slice(1)).then(users => {
          if (identity !== backendIdentity()) throw new RpcError('Your session changed.', 401, 'session_changed');
          if (!Array.isArray(users) || users.some(u => !u || typeof u.id !== 'string' || typeof u.name !== 'string' || typeof u.initials !== 'string' || !Number.isFinite(u.tone))) throw new RpcError('The server returned an invalid search result.');
          return users;
        });
      }
      return remoteState(property, property === 'fetch' ? [] : args.slice(1));
    };
  },
});
