// Transport-free server logic for the rpc Edge Function. index.ts wires it to Supabase; the tests wire it to memory.
// Runs unchanged in Deno and Node 24 (explicit .ts imports, plain TypeScript).
import * as d from '../_shared/domain.ts';
import type {Db, User} from '../_shared/domain.ts';
import {seed} from '../_shared/seed.ts';

export type Links = Record<string, string>; // Supabase auth user id -> domain user id
export type State = {db: Db; links: Links; version: number};

export interface Store {
  /** The single app_state row, or null before the first request. */
  load(): Promise<State | null>;
  /** Compare-and-set on version. Resolves false when someone else wrote first (also when creating a row that already exists). */
  save(next: {db: Db; links: Links}, expectedVersion: number | null): Promise<boolean>;
}

export type Options = {demo: boolean; now?: () => number};
export type Reply = {status: number; body: unknown};

const MAX_ATTEMPTS = 6;
const DEMO_ONLY = new Set(['resolveDisputes', 'skipAhead', 'reset']);
const READ_ONLY = new Set(['fetch', 'searchUsers']);

type Ctx = {db: Db; actor: d.Db['users'][number]['id']; t: number};
type Method = (c: Ctx, a: any[]) => unknown;

// Same names and argument order as mobile/src/lib/api.ts, minus the leading actor (it comes from the JWT).
const methods: Record<string, Method> = {
  fetch: () => undefined,
  searchUsers: ({db, actor}, [query, exclude]) => d.searchUsers(db, String(query ?? ''), [actor, ...(Array.isArray(exclude) ? exclude : [])]).map(publicUser),
  createGroup: ({db, actor, t}, [input]) => void d.createGroup(db, actor, input, t),
  respondInvite: ({db, actor, t}, [groupId, accept]) => d.respondInvite(db, actor, groupId, !!accept, t),
  deposit: ({db, actor, t}, [groupId, amount]) => d.deposit(db, actor, groupId, amount, t),
  withdraw: ({db, actor, t}, [groupId, amount]) => d.withdraw(db, actor, groupId, amount, t),
  setAutoDeposit: ({db, actor}, [groupId, on]) => d.setAutoDeposit(db, actor, groupId, !!on),
  setFailTopUps: ({db, actor}, [groupId, on]) => d.setFailTopUps(db, actor, groupId, !!on),
  setSingleOpenCharge: ({db, actor}, [groupId, on]) => d.setSingleOpenCharge(db, actor, groupId, !!on),
  setDefaultSplit: ({db, actor}, [groupId, split]) => d.setDefaultSplit(db, actor, groupId, split),
  proposeBudget: ({db, actor, t}, [groupId, amount]) => d.proposeBudget(db, actor, groupId, amount, t),
  respondBudget: ({db, actor}, [proposalId, accept]) => d.respondBudget(db, actor, proposalId, !!accept),
  addToWallet: ({db, actor}, [cardId, wallet]) => d.addToWallet(db, actor, cardId, wallet),
  setCardFrozen: ({db, actor}, [cardId, frozen]) => d.setCardFrozen(db, actor, cardId, !!frozen),
  purchase: ({db, actor, t}, [groupId, input]) => void d.purchase(db, actor, groupId, input, t),
  scanReceipt: ({db, actor, t}, [chargeId]) => void d.scanReceipt(db, actor, chargeId, t),
  updateReceipt: ({db, actor}, [chargeId, input]) => d.updateReceipt(db, actor, chargeId, input),
  toggleClaim: ({db, actor}, [chargeId, itemId]) => d.toggleClaim(db, actor, chargeId, itemId),
  setLocked: ({db, actor, t}, [chargeId, locked]) => d.setLocked(db, actor, chargeId, !!locked, t),
  suggestItemEdit: ({db, actor, t}, [chargeId, itemId, targetId]) => d.suggestItemEdit(db, actor, chargeId, itemId, targetId, t),
  respondItemEdit: ({db, actor, t}, [chargeId, editId, accept]) => d.respondItemEdit(db, actor, chargeId, editId, !!accept, t),
  proposeSplit: ({db, actor, t}, [chargeId, input]) => d.proposeSplit(db, actor, chargeId, input, t),
  sendDefaultSplit: ({db, actor, t}, [chargeId]) => d.sendDefaultSplit(db, actor, chargeId, t),
  acceptSplit: ({db, actor, t}, [chargeId]) => d.acceptSplit(db, actor, chargeId, t),
  fileChargeback: ({db, actor, t}, [chargeId]) => d.fileChargeback(db, actor, chargeId, t),
  // Demo controls (DEMO_MODE only).
  reset: () => undefined, // handled in handle()
  resolveDisputes: ({db, t}, [groupId]) => d.resolveDisputes(db, groupId, t),
  skipAhead: ({db}, [days]) => {
    if (!Number.isFinite(days) || days < 0 || days > 400) throw new d.ApiError('Skip between 0 and 400 days.');
    db.clockOffset += days * d.DAY;
  },
};

const publicUser = (u: User) => ({id: u.id, name: u.name, initials: u.initials, tone: u.tone, handle: u.handle, email: u.email, phone: u.phone});

/** The Db as one caller may see it: their groups, the people in them, their own cards, ledger and notifications. */
export function viewFor(db: Db, userId: string): Db {
  const groups = db.groups.filter(g => g.members.some(m => m.userId === userId));
  const groupIds = new Set(groups.map(g => g.id));
  const people = new Set<string>([userId]);
  for (const g of groups) for (const m of g.members) people.add(m.userId);
  return {
    ...db,
    users: db.users.filter(u => people.has(u.id)),
    groups,
    cards: db.cards.filter(c => c.userId === userId),
    // A draft the cardholder has not sent yet is theirs alone.
    charges: db.charges.filter(c => groupIds.has(c.groupId) && (c.sentAt !== null || c.cardholderId === userId)),
    budgetProposals: db.budgetProposals.filter(p => groupIds.has(p.groupId)),
    ledger: db.ledger.filter(e => e.userId === userId),
    notifications: db.notifications.filter(n => n.userId === userId),
  };
}

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function createUser(db: Db, input: any): User {
  const name = text(input?.name, 60);
  const handle = text(input?.handle, 30).toLowerCase().replace(/^@/, '');
  const email = text(input?.email, 120).toLowerCase();
  const phone = text(input?.phone, 30);
  if (!name) throw new d.ApiError('Enter your name.');
  if (!/^[a-z0-9._]{3,30}$/.test(handle)) throw new d.ApiError('Handles are 3-30 letters, numbers, dots or underscores.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new d.ApiError('Enter a valid email.');
  if (db.users.some(u => u.handle.toLowerCase() === handle)) throw new d.ApiError('That handle is taken.');
  if (db.users.some(u => u.email.toLowerCase() === email)) throw new d.ApiError('That email already has an account.');
  const parts = name.split(/\s+/);
  const initials = ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0][1] ?? '')).toUpperCase();
  db.seq += 1;
  const user: User = {id: `u_${handle.replace(/[^a-z0-9]/g, '')}_${db.seq}`, name, initials, tone: db.users.length % 5, handle, email, phone};
  db.users.push(user);
  return user;
}

const ok = (body: unknown): Reply => ({status: 200, body});
const fail = (status: number, error: string, code?: string): Reply => ({status, body: {error, code}});

/**
 * One rpc call. `authId` is the verified Supabase user id from the JWT (null when unauthenticated).
 * The body is {method, args, actor?}; `actor` is only honoured in demo mode for seeded users nobody has linked to a login.
 */
export async function handle(store: Store, authId: string | null, body: any, opts: Options): Promise<Reply> {
  const method = typeof body?.method === 'string' ? body.method : '';
  const args = Array.isArray(body?.args) ? body.args : [];
  const clock = opts.now ?? Date.now;
  const isCreate = method === 'createUser';
  if (!isCreate && !Object.hasOwn(methods, method)) return fail(400, 'Unknown method.', 'bad_method');
  if (DEMO_ONLY.has(method) && !opts.demo) return fail(403, 'Demo controls are off.', 'demo_off');
  if (!authId && !opts.demo) return fail(401, 'Sign in first.', 'unauthenticated');

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const loaded = await store.load();
    const base: State = loaded ?? {db: seed(clock()), links: {}, version: 0};
    const expected = loaded ? loaded.version : null;
    const db = clone(base.db);
    const links = {...base.links};

    // Who is calling: the JWT decides. Never the body, except the demo escape hatch.
    let actor = authId ? links[authId] ?? null : null;
    if (!actor && opts.demo && typeof body?.actor === 'string' && !Object.values(links).includes(body.actor) && db.users.some(u => u.id === body.actor)) actor = body.actor;

    try {
      const t = clock() + db.clockOffset;
      d.tick(db, t);
      let result: unknown;
      if (isCreate) {
        if (!authId) return fail(401, 'Sign in first.', 'unauthenticated');
        if (links[authId]) return fail(409, 'You already have a profile.', 'has_profile');
        const user = createUser(db, args[0]);
        links[authId] = user.id;
        actor = user.id;
      } else {
        if (method === 'reset') {
          const fresh = seed(clock());
          Object.assign(db, fresh);
          for (const k of Object.keys(links)) delete links[k];
          actor = actor && db.users.some(u => u.id === actor) ? actor : null;
        } else if (!actor) {
          return fail(403, 'Finish setting up your profile.', 'no_profile');
        } else {
          result = methods[method]({db, actor, t}, args);
        }
      }

      const changed = !loaded || !READ_ONLY.has(method) || JSON.stringify(db) !== JSON.stringify(base.db);
      if (changed && !(await store.save({db, links}, expected))) continue; // lost the race: reload and replay
      return ok(READ_ONLY.has(method) && method === 'searchUsers' ? result : {db: actor ? viewFor(db, actor) : null, viewerId: actor});
    } catch (e) {
      if (e instanceof d.ApiError) return fail(400, e.message, 'rule');
      throw e;
    }
  }
  return fail(503, 'The server is busy. Try again.', 'busy');
}
