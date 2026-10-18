import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRpcClient, RpcError} from '../src/lib/http.ts';
import type {RpcState} from '../src/lib/http.ts';
import {receiptApprovalKey} from '../src/lib/domain.ts';
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
  let beforeSave: (() => Promise<void>) | null = null;
  const requests: {authId: string; body: {method: string; args: unknown[]}}[] = [];
  const store: Store = {
    async load() { return state ? clone(state) : null; },
    async save(next, expectedVersion) {
      const hook = beforeSave;
      beforeSave = null;
      if (hook) await hook();
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
  return {client, requests, beforeSave(hook: () => Promise<void>) { beforeSave = hook; }, get state() { return state; }, get saves() { return saves; }, get conflicts() { return conflicts; }};
}

async function accounts(h: ReturnType<typeof harness>) {
  const alice = h.client('jwt-alice');
  const bob = h.client('jwt-bob');
  const a = await alice.state('createUser', [{name: 'Alice Tester', handle: 'alice.test', email: 'alice@t.dev', phone: '555-0101'}]);
  const b = await bob.state('createUser', [{name: 'Bob Tester', handle: 'bob.test', email: 'bob@t.dev', phone: '555-0102'}]);
  return {alice, bob, aliceId: a.viewerId, bobId: b.viewerId, a, b};
}

async function pendingCharge(h: ReturnType<typeof harness>) {
  const people = await accounts(h);
  const {alice, bob, bobId} = people;
  const created = await alice.state('createGroup', [{name: 'Proposal revisions', inviteIds: [bobId], budget: 20000, periodDays: 7}]);
  const groupId = created.db.groups[0].id;
  await bob.state('respondInvite', [groupId, true]);
  await alice.state('addToWallet', [created.db.cards[0].id, 'Apple Wallet']);
  const purchased = await alice.state('purchase', [groupId, {merchant: 'Shared dinner', amount: 9001}]);
  const chargeId = purchased.db.charges[0].id;
  await alice.state('sendDefaultSplit', [chargeId]);
  const viewed = await bob.state('fetch');
  const proposal = viewed.db.charges.find(charge => charge.id === chargeId)!.proposals.at(-1)!;
  assert.equal(viewed.db.charges.find(charge => charge.id === chargeId)!.status, 'pending');
  assert.deepEqual(proposal.acceptedBy, [people.aliceId]);
  return {...people, groupId, chargeId, proposal};
}

async function claimedReceipt(h: ReturnType<typeof harness>) {
  const pending = await pendingCharge(h);
  const {alice, bob, chargeId} = pending;
  const aliceItemId = 'alice-meal';
  const bobItemId = 'bob-meal';
  await alice.state('scanReceipt', [chargeId]);
  await alice.state('updateReceipt', [chargeId, {items: [{id: aliceItemId, name: 'Main course', amount: 6000}, {id: bobItemId, name: 'Side plate', amount: 2000}], tax: 1001, tip: 0}]);
  await alice.state('toggleClaim', [chargeId, aliceItemId]);
  const assigned = await bob.state('toggleClaim', [chargeId, bobItemId]);
  const receipt = assigned.db.charges.find(charge => charge.id === chargeId)!.receipt!;
  assert.deepEqual(receipt.locked, []);
  assert.deepEqual(receipt.items.map(item => item.people), [[pending.aliceId], [pending.bobId]]);
  return {...pending, aliceItemId, bobItemId, reviewedReceiptKey: receiptApprovalKey(receipt)};
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
  await bob.state('acceptSplit', [charge.id, proposal.id]);

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

test('accepting a previously viewed split rejects a replacement proposal without writing state', async () => {
  const h = harness();
  const {alice, bob, aliceId, bobId, chargeId, proposal} = await pendingCharge(h);
  const replacement = await alice.state('proposeSplit', [chargeId, {method: 'amount', amounts: {[aliceId]: 6001, [bobId]: 3000}}]);
  const current = replacement.db.charges.find(charge => charge.id === chargeId)!.proposals.at(-1)!;
  assert.notEqual(current.id, proposal.id);
  assert.deepEqual(current.shares, {[aliceId]: 6001, [bobId]: 3000});
  const before = clone(h.state!);
  const saves = h.saves;

  await assert.rejects(bob.state('acceptSplit', [chargeId, proposal.id]), error => error instanceof RpcError && error.status === 409 && error.code === 'stale');

  assert.equal(h.saves, saves);
  assert.deepEqual(h.state, before, 'stale acceptance preserves balances, ledger, proposal approvals, and version');
});

test('accepting a split without the viewed proposal id is rejected without writing state', async () => {
  const h = harness();
  const {bob, chargeId} = await pendingCharge(h);
  const before = clone(h.state!);
  const saves = h.saves;

  await assert.rejects(bob.state('acceptSplit', [chargeId]), error => error instanceof RpcError && error.status === 409 && error.code === 'stale');

  assert.equal(h.saves, saves);
  assert.deepEqual(h.state, before, 'missing proposal id cannot approve or settle the current proposal');
});

test('CAS replay revalidates the viewed proposal when another client replaces it before acceptance saves', async () => {
  const h = harness();
  const {alice, bob, aliceId, bobId, groupId, chargeId, proposal} = await pendingCharge(h);
  const before = clone(h.state!);
  const saves = h.saves;
  const conflicts = h.conflicts;
  const requests = h.requests.length;
  let replacementState: State | null = null;
  h.beforeSave(async () => {
    await alice.state('proposeSplit', [chargeId, {method: 'amount', amounts: {[aliceId]: 6001, [bobId]: 3000}}]);
    replacementState = clone(h.state!);
  });

  await assert.rejects(bob.state('acceptSplit', [chargeId, proposal.id]), error => error instanceof RpcError && error.status === 409 && error.code === 'stale');

  assert(replacementState, 'the concurrent proposal committed before the first acceptance save');
  assert.equal(h.requests.length, requests + 2, 'one acceptance and one proposal request; replay happens on the server');
  assert.equal(h.conflicts, conflicts + 1, 'the first acceptance attempt lost its compare-and-set race');
  assert.equal(h.saves, saves + 1, 'only the replacement proposal was committed');
  assert.equal(h.state!.version, before.version + 1);
  assert.deepEqual(h.state, replacementState, 'replay must not approve, settle, or alter the replacement proposal');
  assert.deepEqual(h.state!.db.groups.find(group => group.id === groupId)!.members, before.db.groups.find(group => group.id === groupId)!.members);
  assert.deepEqual(h.state!.db.ledger, before.db.ledger, 'a discarded acceptance cannot debit either member');
  const charge = h.state!.db.charges.find(value => value.id === chargeId)!;
  assert.equal(charge.status, 'pending');
  assert.notEqual(charge.proposals.at(-1)!.id, proposal.id);
  assert.deepEqual(charge.proposals.at(-1)!.acceptedBy, [aliceId]);
});

test('CAS replay rejects locking a reviewed receipt when another client changes its claims before save', async () => {
  const h = harness();
  const {alice, bob, aliceId, bobId, groupId, chargeId, aliceItemId, reviewedReceiptKey} = await claimedReceipt(h);
  const before = clone(h.state!);
  const saves = h.saves;
  const conflicts = h.conflicts;
  const requests = h.requests.length;
  let changedState: State | null = null;
  h.beforeSave(async () => {
    await bob.state('toggleClaim', [chargeId, aliceItemId]);
    changedState = clone(h.state!);
  });

  await assert.rejects(alice.state('setLocked', [chargeId, true, reviewedReceiptKey]), error => error instanceof RpcError && error.status === 409 && error.code === 'stale');

  assert(changedState, 'Bob changed the item claim before Alice could save her reviewed receipt lock');
  assert.equal(h.requests.length, requests + 2);
  assert.equal(h.conflicts, conflicts + 1);
  assert.equal(h.saves, saves + 1, 'only the new item claim was committed');
  assert.equal(h.state!.version, before.version + 1);
  assert.deepEqual(h.state, changedState, 'the stale lock cannot alter the receipt or any other persisted state');
  assert.deepEqual(h.state!.db.groups.find(group => group.id === groupId)!.members, before.db.groups.find(group => group.id === groupId)!.members);
  assert.deepEqual(h.state!.db.ledger, before.db.ledger, 'stale receipt consent must not debit either member');
  const charge = h.state!.db.charges.find(value => value.id === chargeId)!;
  assert.equal(charge.status, 'pending');
  assert.deepEqual(charge.receipt!.locked, [], 'Alice must review the changed claims before locking again');
  assert.deepEqual(charge.receipt!.items.find(item => item.id === aliceItemId)!.people, [aliceId, bobId]);
  assert.notEqual(receiptApprovalKey(charge.receipt!), reviewedReceiptKey);
});

test('concurrent locks for the same unchanged receipt both succeed and settle once', async () => {
  const h = harness();
  const {alice, bob, aliceId, bobId, groupId, chargeId, reviewedReceiptKey} = await claimedReceipt(h);
  const saves = h.saves;
  const version = h.state!.version;
  const conflicts = h.conflicts;
  const requests = h.requests.length;
  h.beforeSave(async () => {
    const locked = await bob.state('setLocked', [chargeId, true, reviewedReceiptKey]);
    const charge = locked.db.charges.find(value => value.id === chargeId)!;
    assert.equal(charge.status, 'pending');
    assert.deepEqual(charge.receipt!.locked, [bobId]);
    assert.equal(receiptApprovalKey(charge.receipt!), reviewedReceiptKey, 'another member locking does not change the reviewed receipt');
  });

  const settled = await alice.state('setLocked', [chargeId, true, reviewedReceiptKey]);

  assert.equal(h.requests.length, requests + 2, 'each client sends its lock once');
  assert.equal(h.conflicts, conflicts + 1, 'Alice reloads the concurrently saved lock');
  assert.equal(h.saves, saves + 2);
  assert.equal(h.state!.version, version + 2);
  const charge = settled.db.charges.find(value => value.id === chargeId)!;
  assert.equal(charge.status, 'settled');
  assert.deepEqual([...charge.receipt!.locked].sort(), [aliceId, bobId].sort());
  assert.deepEqual(charge.proposals.at(-1)!.shares, {[aliceId]: 6751, [bobId]: 2250});
  assert.deepEqual(h.state!.db.groups.find(group => group.id === groupId)!.members.map(member => [member.userId, member.balance]), [[aliceId, 3249], [bobId, 7750]]);
  const debits = h.state!.db.ledger.filter(entry => entry.chargeId === chargeId && entry.kind === 'charge');
  assert.equal(debits.length, 2, 'settlement records exactly one debit for each member');
  assert.deepEqual(Object.fromEntries(debits.map(entry => [entry.userId, entry.amount])), {[aliceId]: -6751, [bobId]: -2250});
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
