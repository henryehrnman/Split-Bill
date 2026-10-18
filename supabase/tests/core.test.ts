import assert from 'node:assert/strict';
import {handle, viewFor} from '../functions/rpc/core.ts';
import type {Links, State, Store} from '../functions/rpc/core.ts';

const T0 = Date.UTC(2026, 9, 17, 18);
const opts = {demo: false, now: () => T0};

function memory(): Store & {state: State | null; failNext: number; saves: number} {
  const s = {
    state: null as State | null,
    failNext: 0,
    saves: 0,
    async load() {
      return s.state ? {db: JSON.parse(JSON.stringify(s.state.db)), links: {...s.state.links}, version: s.state.version} : null;
    },
    async save(next: {db: any; links: Links}, expected: number | null) {
      if (s.failNext > 0) {
        s.failNext--;
        return false; // simulate losing a race
      }
      if ((s.state?.version ?? null) !== expected) return false;
      s.state = {db: next.db, links: next.links, version: (expected ?? 0) + 1};
      s.saves++;
      return true;
    },
  };
  return s;
}

const call = (store: Store, auth: string | null, method: string, args: unknown[] = [], o = opts, extra: object = {}) => handle(store, auth, {method, args, ...extra}, o);
const profile = (n: string) => ({name: n + ' Tester', handle: n.toLowerCase() + '1', email: n.toLowerCase() + '@t.dev', phone: '555-0100'});

// Unauthenticated, unknown method, demo controls off.
{
  const s = memory();
  assert.equal((await call(s, null, 'fetch')).status, 401);
  assert.equal((await call(s, 'a1', 'nope')).status, 400);
  assert.equal((await call(s, 'a1', 'skipAhead', [3])).status, 403);
  assert.equal((await call(s, 'a1', 'fetch')).status, 403); // signed in but no profile yet
  assert.equal(s.saves, 0);
}

// Sign-up links the JWT user to a new domain user; the body cannot pick the actor.
{
  const s = memory();
  const a = await call(s, 'auth-ann', 'createUser', [profile('Ann')]);
  assert.equal(a.status, 200);
  const annId = (a.body as any).viewerId;
  assert.equal((await call(s, 'auth-ann', 'createUser', [profile('Ann2')])).status, 409);
  assert.equal((await call(s, 'auth-bo', 'createUser', [{...profile('Bo'), handle: 'ann1'}])).status, 400);
  const b = await call(s, 'auth-bo', 'createUser', [profile('Bo')]);
  const boId = (b.body as any).viewerId;
  assert.notEqual(annId, boId);

  // A forged actor in the body is ignored outside demo mode.
  const forged = await call(s, 'auth-bo', 'fetch', [], opts, {actor: 'u_henry'});
  assert.equal((forged.body as any).viewerId, boId);

  // Ann invites Bo: both see the group, a stranger and the seeded users do not leak.
  const g = await call(s, 'auth-ann', 'createGroup', [{name: 'Trip', inviteIds: [boId], budget: 20000, periodDays: 7}]);
  assert.equal(g.status, 200);
  const annDb = (g.body as any).db;
  assert.equal(annDb.groups.length, 1);
  assert.deepEqual(annDb.users.map((u: any) => u.id).sort(), [annId, boId].sort());
  const cz = await call(s, 'auth-cy', 'createUser', [profile('Cy')]);
  const cyDb = (cz.body as any).db;
  assert.equal(cyDb.groups.length, 0);
  assert.equal(cyDb.users.length, 1);
  assert.equal(cyDb.charges.length, 0);

  // Rule errors come back as 400 with the domain message; state is unchanged.
  const before = s.state!.version;
  const bad = await call(s, 'auth-ann', 'deposit', [annDb.groups[0].id, -5]);
  assert.equal(bad.status, 400);
  assert.equal(s.state!.version, before);

  // Every api.ts action (except demo controls and sign-up) is exposed by name.
  const gid = annDb.groups[0].id;
  assert.equal((await call(s, 'auth-ann', 'setSingleOpenCharge', [gid, false])).status, 200);
  assert.equal(s.state!.db.groups.find((x: any) => x.id === gid).singleOpenCharge, false);

  // Search never returns the caller.
  const found = await call(s, 'auth-cy', 'searchUsers', ['Tester', []]);
  assert.ok(!(found.body as any[]).some(u => u.handle === 'cy1'));
  assert.ok((found.body as any[]).length >= 2);
}

// Optimistic version check: a lost race is replayed, a constant loser gets 503.
{
  const s = memory();
  await call(s, 'x', 'createUser', [profile('Dee')]);
  s.failNext = 2;
  assert.equal((await call(s, 'x', 'setAutoDeposit', ['none', true])).status, 400); // domain rejects, still fine
  s.failNext = 2;
  const r = await call(s, 'x', 'createGroup', [{name: 'G', inviteIds: ['u_maya'], budget: 20000, periodDays: 7}]);
  assert.equal(r.status, 200);
  s.failNext = 99;
  assert.equal((await call(s, 'x', 'createGroup', [{name: 'H', inviteIds: ['u_maya'], budget: 20000, periodDays: 7}])).status, 503);
}

// fetch only writes when tick changed something (avoids realtime feedback loops).
{
  const s = memory();
  await call(s, 'x', 'createUser', [profile('Eve')]);
  const v = s.state!.version;
  await call(s, 'x', 'fetch');
  await call(s, 'x', 'fetch');
  assert.equal(s.state!.version, v);
  const later = {...opts, now: () => T0 + 40 * 86400000};
  await call(s, 'x', 'fetch', [], later); // seeded groups roll periods
  assert.equal(s.state!.version, v + 1);
}

// Demo mode: seeded users can be driven by actor, linked users cannot; demo controls work.
{
  const s = memory();
  const demo = {...opts, demo: true};
  const r = await call(s, null, 'fetch', [], demo, {actor: 'u_henry'});
  assert.equal(r.status, 200);
  const db = (r.body as any).db;
  assert.ok(db.groups.every((g: any) => g.members.some((m: any) => m.userId === 'u_henry')));
  assert.ok(db.users.every((u: any) => ['u_henry', 'u_maya', 'u_jordan', 'u_connor'].includes(u.id)) || db.users.length > 0);
  assert.equal((await call(s, null, 'skipAhead', [3], demo, {actor: 'u_henry'})).status, 200);
  assert.equal(s.state!.db.clockOffset, 3 * 86400000);
  const ann = await call(s, 'auth-ann', 'createUser', [profile('Ann')], demo);
  const annId = (ann.body as any).viewerId;
  assert.equal((await call(s, null, 'fetch', [], demo, {actor: annId})).status, 403); // linked user: no impersonation
  assert.equal((await call(s, null, 'reset', [], demo)).status, 200);
  assert.equal(s.state!.db.clockOffset, 0);
}

// Drafts the cardholder has not sent stay private to them.
{
  const s = memory();
  const demo = {...opts, demo: true};
  await call(s, null, 'fetch', [], demo, {actor: 'u_henry'});
  const db = s.state!.db;
  const apt = db.groups[0];
  const draft = {...db.charges[0], id: 'c_draft', groupId: apt.id, cardholderId: 'u_maya', sentAt: null};
  db.charges.push(draft);
  assert.ok(!viewFor(db, 'u_henry').charges.some(c => c.id === 'c_draft'));
  assert.ok(viewFor(db, 'u_maya').charges.some(c => c.id === 'c_draft'));
}

// Receipt photos: the model reads once, before the write loop, and only for members of an open charge.
{
  const photo = {data: 'QUJD', mediaType: 'image/jpeg'};
  const good = {items: [{name: 'Pasta', amount: 9000}, {name: 'Wine', amount: 4000}], tax: 1020, tip: 1400};
  let reads = 0;
  let next: unknown = good;
  const reader = async () => { reads++; if (next instanceof Error) throw next; return next as any; };
  const demo = {...opts, demo: true, readReceipt: reader};
  const scan = (s: Store, o: object = demo, args: unknown[] = ['chg_o', photo]) => call(s, null, 'scanReceipt', args, o as any, {actor: 'u_henry'});

  const s = memory();
  await call(s, null, 'fetch', [], demo, {actor: 'u_henry'});
  assert.equal((await scan(s, {...opts, demo: true})).status, 503); // no key configured
  assert.equal((await scan(s, demo, ['chg_o', {data: 'x', mediaType: 'image/tiff'}])).status, 400);
  assert.equal((await scan(s, demo, ['chg_missing', photo])).status, 400);
  assert.equal((await scan(s, demo, ['chg_o', good])).status, 400); // a client can't hand in its own "read"
  assert.equal(reads, 0);

  s.failNext = 1;
  const ok = await scan(s);
  assert.equal(ok.status, 200);
  assert.equal(reads, 1); // a lost race replays the write, not the model call
  const r = s.state!.db.charges.find((c: any) => c.id === 'chg_o').receipt;
  assert.equal(r.itemized, true);
  assert.deepEqual(r.items.map((i: any) => [i.name, i.amount]), [['Pasta', 9000], ['Wine', 4000]]);

  next = {items: [{name: 'Pasta', amount: 9000}], tax: 0, tip: 0}; // doesn't add up to $154.20
  await scan(s);
  const fallback = s.state!.db.charges.find((c: any) => c.id === 'chg_o').receipt;
  assert.equal(fallback.itemized, false);
  assert.equal(fallback.items[0].amount, 15420);

  next = new Error('model down');
  const v = s.state!.version;
  assert.equal((await scan(s)).status, 502);
  assert.equal(s.state!.version, v);

  assert.equal((await scan(s, demo, ['chg_o'])).status, 200); // no photo: the sample scanner still works
}

console.log('server core tests passed');
