import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRpcClient, RpcError} from '../src/lib/http.ts';
import type {RpcState} from '../src/lib/http.ts';
import type {User} from '../src/lib/domain.ts';
import {handle} from '../../supabase/functions/rpc/core.ts';
import type {State, Store} from '../../supabase/functions/rpc/core.ts';

const T0 = Date.UTC(2026, 9, 17, 18);
const endpoint = 'https://example.supabase.co/functions/v1/rpc';
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function harness() {
  let state: State | null = null;
  let saves = 0;
  let conflicts = 0;
  const requests: {authId: string; body: {method: string; args: unknown[]}}[] = [];
  const store: Store = {
    async load() { return state ? clone(state) : null; },
    async save(next, expectedVersion) {
      if ((state?.version ?? null) !== expectedVersion) { conflicts++; return false; }
      state = {...clone(next), version: (expectedVersion ?? 0) + 1};
      saves++;
      return true;
    },
  };
  // The adapter stands in for JWT verification, then runs the actual server handler.
  // Separate verified auth identities are used; DEMO_MODE and its actor escape hatch stay off.
  const tokens = new Map([['jwt-alice', 'auth-alice'], ['jwt-bob', 'auth-bob']]);
  function client(token: string, forgedActor?: string) {
    return createRpcClient({url: endpoint, publishableKey: 'public-key', getToken: () => token, fetch: async (input, init) => {
      assert.equal(input, endpoint);
      assert.equal(init?.method, 'POST');
      const headers = new Headers(init?.headers);
      assert.equal(headers.get('apikey'), 'public-key');
      const authId = tokens.get(headers.get('authorization')?.replace(/^Bearer /, '') ?? '') ?? null;
      const body = JSON.parse(String(init?.body));
      assert.deepEqual(Object.keys(body).sort(), ['args', 'method']);
      assert(Array.isArray(body.args));
      if (authId) requests.push({authId, body: clone(body)});
      // Simulate a malicious caller adding actor: the server must still use the verified JWT identity.
      const reply = await handle(store, authId, forgedActor ? {...body, actor: forgedActor} : body, {demo: false, now: () => T0});
      return new Response(JSON.stringify(reply.body), {status: reply.status, headers: {'Content-Type': 'application/json'}});
    }});
  }
  return {client, requests, get state() { return state; }, get saves() { return saves; }, get conflicts() { return conflicts; }};
}

async function accounts(h: ReturnType<typeof harness>) {
  const alice = h.client('jwt-alice');
  const bob = h.client('jwt-bob');
  const a = await alice.state('createUser', [{name: 'Alice Tester', handle: 'alice.test', email: 'alice@t.dev', phone: '555-0101'}]);
  const b = await bob.state('createUser', [{name: 'Bob Tester', handle: 'bob.test', email: 'bob@t.dev', phone: '555-0102'}]);
  return {alice, bob, aliceId: a.viewerId, bobId: b.viewerId, a, b};
}

function scoped(snapshot: RpcState, groupId: string, people: string[]) {
  assert.deepEqual(snapshot.db.groups.map(g => g.id), [groupId]);
  assert.deepEqual(snapshot.db.users.map(u => u.id).sort(), [...people].sort());
  assert(snapshot.db.cards.every(c => c.userId === snapshot.viewerId));
  assert(snapshot.db.ledger.every(e => e.userId === snapshot.viewerId));
  assert(snapshot.db.notifications.every(n => n.userId === snapshot.viewerId));
  assert(snapshot.db.charges.every(c => c.groupId === groupId));
}

test('two authenticated HTTP clients create profiles, find each other, join and settle a shared purchase', async () => {
  const h = harness();
  await assert.rejects(h.client('jwt-alice').state('fetch'), error => error instanceof RpcError && error.status === 403 && error.code === 'no_profile');
  assert.equal(h.saves, 0);
  const {alice, bob, aliceId, bobId, a, b} = await accounts(h);
  assert.notEqual(aliceId, bobId);
  assert.deepEqual(a.db.users.map(u => u.id), [aliceId]);
  assert.deepEqual(b.db.users.map(u => u.id), [bobId]);
  assert.equal(a.db.groups.length, 0);
  assert.equal(b.db.charges.length, 0);

  for (const [caller, query, expected] of [[alice, 'bob.test', bobId], [bob, 'alice.test', aliceId]] as const) {
    const users = await caller.request<User[]>('searchUsers', [query, []]);
    assert(Array.isArray(users));
    assert.deepEqual(users.map(u => u.id), [expected]);
    assert.deepEqual(Object.keys(users[0]).sort(), ['email', 'handle', 'id', 'initials', 'name', 'phone', 'tone']);
    assert.equal(typeof users[0].initials, 'string');
    assert(Number.isFinite(users[0].tone));
  }
  assert.deepEqual(await alice.request('searchUsers', ['bob.test', [bobId]]), []);

  const created = await alice.state('createGroup', [{name: 'Network dinner', inviteIds: [bobId], budget: 20000, periodDays: 7}]);
  const groupId = created.db.groups[0].id;
  scoped(created, groupId, [aliceId, bobId]);
  assert.equal(created.db.groups[0].createdBy, aliceId);
  const invited = await bob.state('fetch');
  scoped(invited, groupId, [aliceId, bobId]);
  assert.equal(invited.db.groups[0].members.find(m => m.userId === bobId)?.status, 'invited');
  assert.equal(invited.db.cards.length, 0);
  const joined = await bob.state('respondInvite', [groupId, true]);
  assert(joined.db.groups[0].members.every(m => m.status === 'joined' && m.balance === 10000));
  const aliceCard = created.db.cards[0].id;
  const bobCard = joined.db.cards[0].id;
  await alice.state('addToWallet', [aliceCard, 'Apple Wallet']);
  await bob.state('addToWallet', [bobCard, 'Google Wallet']);

  const purchased = await alice.state('purchase', [groupId, {merchant: 'Network cafe', amount: 9001}]);
  const charge = purchased.db.charges[0];
  assert.equal(charge.cardholderId, aliceId);
  assert.equal(charge.sentAt, null);
  assert.equal((await bob.state('fetch')).db.charges.length, 0, 'unsent draft stays private to the cardholder');
  const sent = await alice.state('sendDefaultSplit', [charge.id]);
  const proposal = sent.db.charges[0].proposals.at(-1)!;
  assert.deepEqual(proposal.shares, {[aliceId]: 4501, [bobId]: 4500});
  assert.deepEqual(proposal.acceptedBy, [aliceId]);
  const awaiting = await bob.state('fetch');
  assert.equal(awaiting.db.charges[0].status, 'pending');
  assert.equal(awaiting.db.notifications[0].chargeId, charge.id);
  await bob.state('acceptSplit', [charge.id]);

  for (const caller of [alice, bob]) {
    const settled = await caller.state('fetch');
    scoped(settled, groupId, [aliceId, bobId]);
    assert.equal(settled.db.charges[0].status, 'settled');
    assert.deepEqual(settled.db.groups[0].members.map(m => m.balance), [5499, 5500]);
    assert.equal(settled.db.cards.length, 1);
    const debit = settled.db.ledger.find(entry => entry.kind === 'charge');
    assert.equal(debit?.amount, settled.viewerId === aliceId ? -4501 : -4500);
  }
});

test('unchanged fetches and searches do not write state or trigger a version ping', async () => {
  const h = harness();
  const {alice, bob} = await accounts(h);
  const saves = h.saves;
  const version = h.state!.version;
  await alice.state('fetch');
  await bob.state('fetch');
  await alice.request('searchUsers', ['bob.test', []]);
  await bob.state('fetch');
  // Production's app_state_ping trigger only runs after a successful state insert/update.
  assert.equal(h.saves, saves);
  assert.equal(h.state!.version, version);
});

test('a forged actor cannot change the authenticated viewer or the member receiving a deposit', async () => {
  const h = harness();
  const {alice, bob, aliceId, bobId} = await accounts(h);
  const created = await alice.state('createGroup', [{name: 'Identity check', inviteIds: [bobId], budget: 20000, periodDays: 7}]);
  const groupId = created.db.groups[0].id;
  await bob.state('respondInvite', [groupId, true]);
  const forged = h.client('jwt-bob', aliceId);
  assert.equal((await forged.state('fetch')).viewerId, bobId);
  const deposited = await forged.state('deposit', [groupId, 200]);
  assert.equal(deposited.viewerId, bobId);
  assert.deepEqual(deposited.db.groups[0].members.map(m => [m.userId, m.balance]), [[aliceId, 10000], [bobId, 10200]]);
  assert(deposited.db.ledger.every(entry => entry.userId === bobId));
  assert.deepEqual(h.requests.at(-1)?.body, {method: 'deposit', args: [groupId, 200]});
});

test('concurrent clients preserve both writes through the server compare-and-set contract', async () => {
  const h = harness();
  const {alice, bob, aliceId, bobId} = await accounts(h);
  const created = await alice.state('createGroup', [{name: 'Concurrent deposits', inviteIds: [bobId], budget: 20000, periodDays: 7}]);
  const groupId = created.db.groups[0].id;
  await bob.state('respondInvite', [groupId, true]);
  const version = h.state!.version;
  const requestCount = h.requests.length;
  await Promise.all([alice.state('deposit', [groupId, 101]), bob.state('deposit', [groupId, 203])]);
  assert.equal(h.requests.length, requestCount + 2, 'CAS replay stays on the server; clients send each mutation once');
  assert(h.conflicts > 0);
  assert.equal(h.state!.version, version + 2);
  const final = await alice.state('fetch');
  assert.deepEqual(final.db.groups[0].members.map(m => [m.userId, m.balance]), [[aliceId, 10101], [bobId, 10203]]);
});
