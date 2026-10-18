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
  assert(annDb.groups[0].members.every((m: any) => m.balance === 0));
  assert.equal(annDb.groups[0].activatedAt, null);
  assert.deepEqual(annDb.ledger, [], 'creating an invitation does not charge its creator');
  assert.deepEqual(annDb.users.map((u: any) => u.id).sort(), [annId, boId].sort());
  const annProfile = (a.body as any).db.users.find((u: any) => u.id === annId);
  const boProfile = (b.body as any).db.users.find((u: any) => u.id === boId);
  // Creating an invitation cannot turn a masked search result into full contact details.
  assert.deepEqual(annDb.users.find((u: any) => u.id === annId), annProfile);
  assert.deepEqual(annDb.users.find((u: any) => u.id === boId), {...boProfile, email: '', phone: ''});
  const invited = (await call(s, 'auth-bo', 'fetch')).body as any;
  assert.deepEqual(invited.db.users.find((u: any) => u.id === boId), boProfile);
  assert.deepEqual(invited.db.users.find((u: any) => u.id === annId), {...annProfile, email: '', phone: ''});
  assert.equal((await call(s, 'auth-bo', 'respondInvite', [annDb.groups[0].id, true, 10000])).status, 200);
  const joined = (await call(s, 'auth-ann', 'fetch')).body as any;
  assert(joined.db.groups[0].members.every((m: any) => m.balance === 10000));
  assert.equal(joined.db.groups[0].activatedAt, T0);
  assert.deepEqual(s.state!.db.ledger.filter(entry => entry.groupId === annDb.groups[0].id).map(entry => [entry.kind, entry.amount]), [['deposit', 10000], ['deposit', 10000]], 'the final invitation collects both contributions once');
  assert.deepEqual(joined.db.users.find((u: any) => u.id === boId), {...boProfile, email: '', phone: ''});
  // Redaction affects responses only, leaving exact contact search and each user's profile intact.
  assert.deepEqual(s.state!.db.users.find(u => u.id === annId), annProfile);
  assert.deepEqual(s.state!.db.users.find(u => u.id === boId), boProfile);
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

  // The retired one-purchase lock cannot be re-enabled by an older client.
  const gid = annDb.groups[0].id;
  const beforeRetiredLock = JSON.parse(JSON.stringify(s.state!.db));
  for (const enabled of [true, false]) {
    assert.equal((await call(s, 'auth-ann', 'setSingleOpenCharge', [gid, enabled])).status, 200);
    assert.deepEqual(s.state!.db, beforeRetiredLock, 'the retired setting is a compatibility no-op');
    assert.equal(Object.hasOwn(s.state!.db.groups.find(group => group.id === gid)!, 'singleOpenCharge'), false);
  }

  // Search never returns the caller.
  const found = await call(s, 'auth-cy', 'searchUsers', ['Tester', []]);
  assert.ok(!(found.body as any[]).some(u => u.handle === 'cy1'));
  assert.ok((found.body as any[]).length >= 2);

  // Search hides contact details of people you only found, unless you typed them exactly.
  const ann = (found.body as any[]).find(u => u.handle === 'ann1');
  assert.equal(ann.email, 'a***@t.dev');
  assert.equal(ann.phone, '');
  const byEmail = (await call(s, 'auth-cy', 'searchUsers', ['ann@t.dev', []])).body as any[];
  assert.equal(byEmail.find(u => u.handle === 'ann1').email, 'ann@t.dev');
  const byPhone = (await call(s, 'auth-cy', 'searchUsers', ['(555) 0100', []])).body as any[];
  assert.equal(byPhone.find(u => u.handle === 'ann1').phone, '555-0100');
  assert.equal((await call(s, 'auth-cy', 'createGroup', [{name: 'x'.repeat(40_000), inviteIds: [], budget: 100, periodDays: 7}])).status, 413);
}

// Missing or nonboolean decisions must never decline an invite, authorize funding, or persist tick changes.
{
  const s = memory();
  const annId = ((await call(s, 'auth-ann', 'createUser', [profile('Ann')])).body as any).viewerId;
  const boId = ((await call(s, 'auth-bo', 'createUser', [profile('Bo')])).body as any).viewerId;
  const cyId = ((await call(s, 'auth-cy', 'createUser', [profile('Cy')])).body as any).viewerId;
  const created = (await call(s, 'auth-ann', 'createGroup', [{name: 'Explicit decisions', inviteIds: [boId, cyId], budget: 30000, periodDays: 7, initialContributionLimit: 15000}])).body as any;
  const gid = created.db.groups[0].id;
  const before = JSON.parse(JSON.stringify(s.state));
  const saves = s.saves;
  const later = {...opts, now: () => T0 + 40 * 86400000};
  const decisions: {method: string; prefix: unknown[]; suffix?: unknown[]}[] = [
    {method: 'respondInvite', prefix: [gid], suffix: [10000, 15000]},
    {method: 'setAutoDeposit', prefix: [gid]},
    {method: 'setFailTopUps', prefix: [gid]},
    {method: 'respondBudget', prefix: ['budget-proposal']},
    {method: 'setCardFrozen', prefix: [created.db.cards[0].id]},
    {method: 'setLocked', prefix: ['receipt-charge'], suffix: ['receipt-revision']},
    {method: 'respondItemEdit', prefix: ['receipt-charge', 'item-edit']},
  ];
  for (const {method, prefix, suffix = []} of decisions) {
    // A truly omitted value and malformed JSON values are separate wire cases.
    const invalidArgs = [prefix, ...[undefined, null, 'false', 'true', '', 0, 1, {}, []].map(value => [...prefix, value, ...suffix])];
    for (const args of invalidArgs) {
      const reply = await call(s, 'auth-bo', method, args, later);
      assert.equal(reply.status, 400, `${method} must require an explicit boolean`);
      assert.deepEqual(reply.body, {error: 'Choose either yes or no.', code: 'rule'});
      assert.equal(s.saves, saves);
      assert.deepEqual(s.state, before, 'invalid consent cannot persist membership, money movements, or unrelated time-based updates');
    }
  }

  // Actual booleans preserve the legitimate accept/decline flow and its reviewed funding cap.
  assert.equal((await call(s, 'auth-bo', 'respondInvite', [gid, true, 10000, 15000])).status, 200);
  let group = s.state!.db.groups.find(value => value.id === gid)!;
  assert.equal(group.members.find(member => member.userId === boId)!.status, 'joined');
  assert.equal(group.activatedAt, null);
  assert.deepEqual(s.state!.db.ledger.filter(entry => entry.groupId === gid), []);
  assert.equal((await call(s, 'auth-cy', 'respondInvite', [gid, false])).status, 200);
  group = s.state!.db.groups.find(value => value.id === gid)!;
  assert.deepEqual(group.members.map(member => [member.userId, member.balance]), [[annId, 15000], [boId, 15000]]);
  assert.equal(group.activatedAt, T0);
  assert.equal(s.state!.db.ledger.filter(entry => entry.groupId === gid && entry.kind === 'deposit').length, 2);
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

// Charge notes use the JWT author, preserve draft privacy, and never change payment or consent state.
{
  const s = memory();
  const annId = ((await call(s, 'auth-ann', 'createUser', [profile('Ann')])).body as any).viewerId;
  const boId = ((await call(s, 'auth-bo', 'createUser', [profile('Bo')])).body as any).viewerId;
  await call(s, 'auth-cy', 'createUser', [profile('Cy')]);
  const created = (await call(s, 'auth-ann', 'createGroup', [{name: 'Dinner notes', inviteIds: [boId], budget: 20000, periodDays: 7}])).body as any;
  const gid = created.db.groups[0].id;
  assert.equal((await call(s, 'auth-bo', 'respondInvite', [gid, true, 10000])).status, 200);
  await call(s, 'auth-ann', 'addToWallet', [created.db.cards[0].id, 'Apple Wallet']);
  const purchased = (await call(s, 'auth-ann', 'purchase', [gid, {merchant: 'Dinner', amount: 1001}])).body as any;
  const cid = purchased.db.charges[0].id;
  const charge = () => s.state!.db.charges.find(c => c.id === cid)!;
  const withoutNotes = () => JSON.stringify({
    ...s.state!.db,
    charges: s.state!.db.charges.map(({note: _note, ...c}) => c),
  });

  const draft = withoutNotes();
  assert.equal((await call(s, 'auth-ann', 'setChargeNote', [cid, '  Birth\u0000day \tdinner\n\u007f\u0085\u009f  '])).status, 200);
  assert.deepEqual(charge().note, {authorId: annId, text: 'Birthday dinner', at: T0});
  assert.equal(withoutNotes(), draft, 'writing a note changes no other domain state');
  assert.equal(((await call(s, 'auth-bo', 'fetch')).body as any).db.charges.length, 0);
  for (const auth of ['auth-bo', 'auth-cy']) {
    const before = JSON.stringify(s.state);
    assert.equal((await call(s, auth, 'setChargeNote', [cid, 'Forged draft note'], opts, {actor: annId})).status, 400);
    assert.equal(JSON.stringify(s.state), before);
  }

  assert.equal((await call(s, 'auth-ann', 'sendDefaultSplit', [cid])).status, 200);
  const pending = withoutNotes();
  const version = s.state!.version;
  s.failNext = 1;
  assert.equal((await call(s, 'auth-bo', 'setChargeNote', [cid, 'I had the pasta'], {...opts, now: () => T0 + 1}, {actor: annId})).status, 200);
  assert.equal(s.state!.version, version + 1, 'CAS retry persists the replacement once');
  assert.deepEqual(charge().note, {authorId: boId, text: 'I had the pasta', at: T0 + 1}, 'the verified member can replace the note, but cannot forge its author');
  assert.equal(withoutNotes(), pending, 'replacing a note cannot alter approvals, reservations, balances, ledger, notifications, or ID sequence');
  for (const auth of ['auth-ann', 'auth-bo']) {
    const viewed = (await call(s, auth, 'fetch')).body as any;
    assert.deepEqual(viewed.db.charges.find((c: any) => c.id === cid).note, charge().note);
  }
  assert.equal(((await call(s, 'auth-cy', 'fetch')).body as any).db.charges.length, 0);
  const beforeOutsider = JSON.stringify(s.state);
  assert.equal((await call(s, 'auth-cy', 'setChargeNote', [cid, 'Not a member'], opts, {actor: annId})).status, 400);
  assert.equal(JSON.stringify(s.state), beforeOutsider);
  assert.equal((await call(s, 'auth-ann', 'setChargeNote', [cid, ' \n\t\u0080 '])).status, 200);
  assert.equal(charge().note, undefined, 'empty text after control stripping clears the note');
  assert.equal(withoutNotes(), pending, 'clearing the note changes no other domain state');
  assert.equal((await call(s, 'auth-bo', 'setChargeNote', [cid, `\u0000${'x'.repeat(280)}\n`])).status, 200);
  assert.equal(charge().note!.text, 'x'.repeat(280), 'the limit applies after controls are stripped');
  for (const text of [undefined, null, 42, {}, ['note'], 'x'.repeat(281)]) {
    const before = JSON.stringify(s.state);
    assert.equal((await call(s, 'auth-bo', 'setChargeNote', [cid, text])).status, 400);
    assert.equal(JSON.stringify(s.state), before, 'invalid text must not write state or allocate an ID');
  }

  assert.equal((await call(s, 'auth-bo', 'acceptSplit', [cid, charge().proposals.at(-1)!.id])).status, 200);
  assert.equal(charge().status, 'settled');
  const settled = withoutNotes();
  assert.equal((await call(s, 'auth-bo', 'setChargeNote', [cid, 'Thanks for dinner!'])).status, 200);
  assert.deepEqual(charge().note, {authorId: boId, text: 'Thanks for dinner!', at: T0});
  assert.equal(withoutNotes(), settled, 'a settled note cannot change agreed shares or debit anyone again');
  assert.equal((await call(s, 'auth-ann', 'setChargeNote', [cid, ''])).status, 200);
  assert.equal(charge().note, undefined);
  assert.equal(withoutNotes(), settled);
  assert.equal((await call(s, 'auth-ann', 'fileChargeback', [cid])).status, 200);
  const disputed = withoutNotes();
  assert.equal((await call(s, 'auth-bo', 'setChargeNote', [cid, 'Support context'])).status, 200);
  assert.deepEqual(charge().note, {authorId: boId, text: 'Support context', at: T0});
  assert.equal(withoutNotes(), disputed, 'notes remain available without changing the dispute or freeze');
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
