import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRpcClient, RpcError} from '../src/lib/http.ts';
import type {RpcState} from '../src/lib/http.ts';
import {chargeEditKey, receiptListKey, receiptApprovalKey} from '../src/lib/domain.ts';
import type {User} from '../src/lib/domain.ts';
import {handle} from '../../supabase/functions/rpc/core.ts';
import type {State, Store} from '../../supabase/functions/rpc/core.ts';

const T0 = Date.UTC(2026, 9, 17, 18);
const endpoint = 'https://example.supabase.co/functions/v1/rpc';
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function harness() {
  let now = T0;
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
  const tokens = new Map([['jwt-alice', 'auth-alice'], ['jwt-bob', 'auth-bob'], ['jwt-charlie', 'auth-charlie']]);
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
      const reply = await handle(store, authId, forgedActor ? {...body, actor: forgedActor} : body, {demo: false, now: () => now});
      return new Response(JSON.stringify(reply.body), {status: reply.status, headers: {'Content-Type': 'application/json'}});
    }});
  }
  return {client, requests, advanceTo(time: number) { now = time; }, beforeSave(hook: () => Promise<void>) { beforeSave = hook; }, get state() { return state; }, get saves() { return saves; }, get conflicts() { return conflicts; }};
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
  await bob.state('respondInvite', [groupId, true, 10000]);
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
  assert(created.db.groups[0].members.every(m => m.balance === 0));
  assert.equal(created.db.groups[0].activatedAt, null);
  assert.deepEqual(created.db.ledger, [], 'creating the group does not charge the creator');
  const invited = await bob.state('fetch');
  scoped(invited, groupId, [aliceId, bobId]);
  assert.equal(invited.db.groups[0].members.find(m => m.userId === bobId)?.status, 'invited');
  assert.equal(invited.db.cards.length, 0);
  const joined = await bob.state('respondInvite', [groupId, true, 10000]);
  assert(joined.db.groups[0].members.every(m => m.status === 'joined' && m.balance === 10000));
  assert.equal(joined.db.groups[0].activatedAt, T0);
  assert.deepEqual(h.state!.db.ledger.filter(entry => entry.groupId === groupId).map(entry => [entry.kind, entry.amount]), [['deposit', 10000], ['deposit', 10000]], 'the final invitation collects both contributions once');
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

test('zero-balance members can make concurrent purchases while private drafts reserve the shared pool', async () => {
  const h = harness();
  const {alice, bob, bobId} = await accounts(h);
  const created = await alice.state('createGroup', [{name: 'Concurrent spending', inviteIds: [bobId], budget: 20000, periodDays: 7}]);
  const groupId = created.db.groups[0].id;
  const joined = await bob.state('respondInvite', [groupId, true, 10000]);
  await alice.state('addToWallet', [created.db.cards[0].id, 'Apple Wallet']);
  await bob.state('addToWallet', [joined.db.cards[0].id, 'Google Wallet']);
  await bob.state('withdraw', [groupId, 10000]);
  await alice.state('purchase', [groupId, {merchant: 'Private dinner', amount: 6000}]);

  const viewed = await bob.state('fetch');
  assert.equal(viewed.db.charges.length, 0);
  assert.equal(JSON.stringify(viewed).includes('Private dinner'), false);
  assert.deepEqual(viewed.db.spendingView?.groups[groupId], {
    availableFunds: 4000, spendLimit: 4000, purchaseBlocker: null, pendingCount: 1, withdrawalBlocked: true,
  });
  await assert.rejects(bob.state('withdraw', [groupId, 100]), error => error instanceof RpcError
    && error.status === 400 && !error.message.includes('Private dinner'));
  await bob.state('purchase', [groupId, {merchant: 'Coffee for everyone', amount: 3000}]);
  assert.equal((await alice.state('fetch')).db.spendingView?.groups[groupId].availableFunds, 1000);

  // Two clients race for the last $10. CAS must recheck the pooled reservation.
  const results = await Promise.allSettled([
    alice.state('purchase', [groupId, {merchant: 'Last funds A', amount: 1000}]),
    bob.state('purchase', [groupId, {merchant: 'Last funds B', amount: 1000}]),
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected').length, 1);
  assert.equal(h.state!.db.charges.filter(c => c.groupId === groupId).length, 3);
  for (const client of [alice, bob]) {
    const final = await client.state('fetch');
    assert.equal(final.db.spendingView?.groups[groupId].availableFunds, 0);
    assert.equal(final.db.spendingView?.groups[groupId].spendLimit, 0);
    assert.equal(final.db.spendingView?.groups[groupId].pendingCount, 3);
  }
  assert.equal(h.state!.db.spendingView, undefined, 'viewer projections never enter saved state');
});

test('joining requires the reviewed contribution target before the final invitation funds the group', async () => {
  const h = harness();
  const {alice, bob, bobId} = await accounts(h);
  const created = await alice.state('createGroup', [{name: 'Reviewed invitation', inviteIds: [bobId], budget: 20000, periodDays: 7}]);
  const groupId = created.db.groups[0].id;
  const before = clone(h.state!);
  const saves = h.saves;

  for (const args of [[groupId, true], [groupId, true, null], [groupId, true, '10000'], [groupId, true, 9999]]) {
    await assert.rejects(bob.state('respondInvite', args), error => error instanceof RpcError && error.status === 409 && error.code === 'stale');
    assert.equal(h.saves, saves);
    assert.deepEqual(h.state, before, 'an unreviewed contribution target cannot change any persisted state');
  }
  const joined = await bob.state('respondInvite', [groupId, true, 10000]);
  assert(joined.db.groups[0].members.every(m => m.balance === 10000));
  assert.equal(joined.db.cards.length, 1);
  assert.deepEqual(joined.db.ledger.map(entry => [entry.kind, entry.amount]), [['deposit', 10000]]);
});

test('CAS replay rejects a reviewed invitation amount when another invitee declines before the join saves', async () => {
  const h = harness();
  const {alice, bob, bobId} = await accounts(h);
  const charlie = h.client('jwt-charlie');
  const c = await charlie.state('createUser', [{name: 'Charlie Tester', handle: 'charlie.test', email: 'charlie@t.dev', phone: '555-0103'}]);
  const created = await alice.state('createGroup', [{name: 'Concurrent invitations', inviteIds: [bobId, c.viewerId], budget: 30000, periodDays: 7, initialContributionLimit: 15000}]);
  const groupId = created.db.groups[0].id;
  const saves = h.saves;
  const conflicts = h.conflicts;
  const requests = h.requests.length;
  let declinedState: State | null = null;
  h.beforeSave(async () => {
    await charlie.state('respondInvite', [groupId, false]);
    declinedState = clone(h.state!);
  });

  await assert.rejects(bob.state('respondInvite', [groupId, true, 10000]), error => error instanceof RpcError && error.status === 409 && error.code === 'stale');

  assert(declinedState, 'Charlie declined after Bob reviewed $100 but before his join saved');
  assert.equal(h.requests.length, requests + 2, 'both clients send one request; the server revalidates on replay');
  assert.equal(h.conflicts, conflicts + 1);
  assert.equal(h.saves, saves + 1, 'only the decline committed');
  assert.deepEqual(h.state, declinedState, 'the discarded join must not issue a card or alter membership');
  assert.equal(h.state!.db.groups.find(g => g.id === groupId)!.members.find(m => m.userId === bobId)!.status, 'invited');
  assert.equal(h.state!.db.cards.some(card => card.groupId === groupId && card.userId === bobId), false);
  assert.equal(h.state!.db.ledger.some(entry => entry.groupId === groupId && entry.userId === bobId), false);

  const joined = await bob.state('respondInvite', [groupId, true, 15000]);
  assert(joined.db.groups[0].members.every(m => m.balance === 15000));
  assert.equal(joined.db.cards.length, 1);
  assert.deepEqual(joined.db.ledger.map(entry => [entry.kind, entry.amount]), [['deposit', 15000]]);
  assert.equal(h.state!.db.ledger.filter(entry => entry.groupId === groupId).length, 2, 'both members fund the final target only after membership is resolved');
});

test('concurrent final invitations activate a waiting group and collect each contribution once', async () => {
  const h = harness();
  const {alice, bob, bobId} = await accounts(h);
  const charlie = h.client('jwt-charlie');
  const c = await charlie.state('createUser', [{name: 'Charlie Tester', handle: 'charlie.test', email: 'charlie@t.dev', phone: '555-0103'}]);
  const created = await alice.state('createGroup', [{name: 'Waiting for everyone', inviteIds: [bobId, c.viewerId], budget: 30000, periodDays: 7}]);
  const groupId = created.db.groups[0].id;

  // Even after a full nominal period, unresolved invitations cannot trigger top-ups.
  const activatedAt = T0 + 8 * 86400000;
  h.advanceTo(activatedAt);
  const waiting = await alice.state('fetch');
  assert.equal(waiting.db.groups[0].activatedAt, null);
  assert(waiting.db.groups[0].members.every(member => member.balance === 0));
  assert.deepEqual(waiting.db.ledger, []);
  const beforeDeposit = clone(h.state!);
  await assert.rejects(alice.state('deposit', [groupId, 10000]), error => error instanceof RpcError && error.status === 400);
  assert.deepEqual(h.state, beforeDeposit, 'funding cannot start while invitations are unresolved');

  const version = h.state!.version;
  const requests = h.requests.length;
  const conflicts = h.conflicts;
  await Promise.all([
    bob.state('respondInvite', [groupId, true, 10000]),
    charlie.state('respondInvite', [groupId, true, 10000]),
  ]);
  assert.equal(h.requests.length, requests + 2);
  assert(h.conflicts > conflicts, 'simultaneous invitations replay against the latest membership');
  assert.equal(h.state!.version, version + 2);
  const group = h.state!.db.groups.find(value => value.id === groupId)!;
  assert(group.members.every(member => member.status === 'joined' && member.balance === 10000));
  assert.equal(group.activatedAt, activatedAt);
  assert.equal(group.periodStart, activatedAt, 'the first funding period starts when the last invitation is resolved');
  assert.equal(h.state!.db.cards.filter(card => card.groupId === groupId).length, 3, 'replay issues one card per member');
  const deposits = h.state!.db.ledger.filter(entry => entry.groupId === groupId);
  assert.equal(deposits.length, 3);
  assert(deposits.every(entry => entry.kind === 'deposit' && entry.amount === 10000 && entry.at === activatedAt));
  assert.deepEqual([...new Set(deposits.map(entry => entry.userId))].sort(), group.members.map(member => member.userId).sort(), 'activation collects exactly one contribution per remaining member');
  const afterActivation = clone(h.state!);
  await alice.state('fetch');
  await bob.state('fetch');
  assert.deepEqual(h.state, afterActivation, 'later reads do not charge members again');
});

test('a final decline collects the final equal contributions from previously joined members', async () => {
  const h = harness();
  const {alice, bob, bobId} = await accounts(h);
  const charlie = h.client('jwt-charlie');
  const c = await charlie.state('createUser', [{name: 'Charlie Tester', handle: 'charlie.test', email: 'charlie@t.dev', phone: '555-0103'}]);
  const created = await alice.state('createGroup', [{name: 'Final membership', inviteIds: [bobId, c.viewerId], budget: 30000, periodDays: 7, initialContributionLimit: 15000}]);
  const groupId = created.db.groups[0].id;
  const partial = await bob.state('respondInvite', [groupId, true, 10000, 15000]);
  assert.equal(partial.db.groups[0].activatedAt, null);
  assert(partial.db.groups[0].members.every(member => member.balance === 0));
  assert(partial.db.groups[0].members.filter(member => member.status === 'joined').every(member => member.initialContributionLimit === 15000));
  assert.deepEqual(h.state!.db.ledger.filter(entry => entry.groupId === groupId), [], 'neither creator nor early acceptor is charged');
  assert.equal(partial.db.cards.length, 1, 'accepting still issues the member card');

  const activatedAt = T0 + 86400000;
  h.advanceTo(activatedAt);
  await charlie.state('respondInvite', [groupId, false]);
  const activated = await alice.state('fetch');
  assert.equal(activated.db.groups[0].activatedAt, activatedAt);
  assert.equal(activated.db.groups[0].periodStart, activatedAt);
  assert.deepEqual(activated.db.groups[0].members.map(member => member.balance), [15000, 15000]);
  const deposits = h.state!.db.ledger.filter(entry => entry.groupId === groupId);
  assert.equal(deposits.length, 2);
  assert(deposits.every(entry => entry.kind === 'deposit' && entry.amount === 15000 && entry.at === activatedAt));
  assert.equal(deposits.some(entry => entry.userId === c.viewerId), false, 'the declining invitee is never charged');
});

test('older clients never authorize more than the reviewed contribution after another invitee declines', async () => {
  const h = harness();
  const {alice, bob, bobId} = await accounts(h);
  const charlie = h.client('jwt-charlie');
  const c = await charlie.state('createUser', [{name: 'Charlie Tester', handle: 'charlie.test', email: 'charlie@t.dev', phone: '555-0103'}]);
  const created = await alice.state('createGroup', [{name: 'Older client consent', inviteIds: [bobId, c.viewerId], budget: 30000, periodDays: 7}]);
  const groupId = created.db.groups[0].id;
  await bob.state('respondInvite', [groupId, true, 10000]);
  assert.deepEqual(h.state!.db.ledger.filter(entry => entry.groupId === groupId), []);

  await charlie.state('respondInvite', [groupId, false]);
  const activated = await alice.state('fetch');
  assert.equal(activated.db.groups[0].activatedAt, T0);
  assert(activated.db.groups[0].members.every(member => member.status === 'joined'
    && member.balance === 10000 && member.initialContributionLimit === 10000 && !member.autoDeposit));
  const deposits = h.state!.db.ledger.filter(entry => entry.groupId === groupId);
  assert.equal(deposits.length, 2);
  assert(deposits.every(entry => entry.kind === 'deposit' && entry.amount === 10000));

  h.advanceTo(T0 + 7 * 86400000);
  const renewed = await bob.state('fetch');
  assert(renewed.db.groups[0].members.every(member => member.balance === 10000 && !member.autoDeposit));
  assert.deepEqual(h.state!.db.ledger.filter(entry => entry.groupId === groupId), deposits, 'the next period cannot collect an unapproved increase through automatic funding');
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

test('a new manual proposal replaces receipt consent and rejects old receipt locks', async () => {
  const h = harness();
  const {alice, bob, aliceId, bobId, chargeId, reviewedReceiptKey} = await claimedReceipt(h);
  await alice.state('setLocked', [chargeId, true, reviewedReceiptKey]);
  const receiptState = clone(h.state!);
  await assert.rejects(alice.state('proposeSplit', [chargeId, {method: 'amount', amounts: {[aliceId]: 1, [bobId]: 2}}]), error => error instanceof RpcError && error.code === 'rule');
  assert.deepEqual(h.state, receiptState, 'an invalid proposal must retain the receipt and its consent');

  const proposed = await alice.state('proposeSplit', [chargeId, {method: 'amount', amounts: {[aliceId]: 6001, [bobId]: 3000}}]);
  const charge = proposed.db.charges.find(c => c.id === chargeId)!;
  assert.equal(charge.receipt, null);
  const beforeLock = clone(h.state!);
  await assert.rejects(bob.state('setLocked', [chargeId, true, reviewedReceiptKey]), error => error instanceof RpcError && error.status === 409 && error.code === 'stale');
  assert.deepEqual(h.state, beforeLock, 'superseded receipt approval cannot settle or modify the new proposal');
  const settled = await bob.state('acceptSplit', [chargeId, charge.proposals.at(-1)!.id]);
  assert.equal(settled.db.charges.find(c => c.id === chargeId)!.status, 'settled');
  assert.deepEqual(settled.db.groups[0].members.map(m => m.balance), [3999, 7000]);
});

test('scanning a receipt supersedes proposal acceptance and notifies other members', async () => {
  const h = harness();
  const {alice, bob, bobId, chargeId, proposal} = await pendingCharge(h);
  const notifications = h.state!.db.notifications.length;
  await alice.state('scanReceipt', [chargeId]);
  assert.equal(h.state!.db.notifications.length, notifications + 1);
  assert.equal(h.state!.db.notifications[0].userId, bobId);
  assert.match(h.state!.db.notifications[0].text, /Claim the items/);
  const before = clone(h.state!);
  await assert.rejects(bob.state('acceptSplit', [chargeId, proposal.id]), error => error instanceof RpcError && error.status === 409 && error.code === 'stale');
  assert.deepEqual(h.state, before, 'old proposal approval cannot settle an active receipt');
});

test('CAS replay rejects a receipt lock when a manual proposal replaced the board before save', async () => {
  const h = harness();
  const {alice, bob, aliceId, bobId, chargeId, reviewedReceiptKey} = await claimedReceipt(h);
  await alice.state('setLocked', [chargeId, true, reviewedReceiptKey]);
  let replacement: State | null = null;
  h.beforeSave(async () => {
    await alice.state('proposeSplit', [chargeId, {method: 'amount', amounts: {[aliceId]: 6001, [bobId]: 3000}}]);
    replacement = clone(h.state!);
  });
  await assert.rejects(bob.state('setLocked', [chargeId, true, reviewedReceiptKey]), error => error instanceof RpcError && error.status === 409 && error.code === 'stale');
  assert(replacement);
  assert.deepEqual(h.state, replacement, 'discard the attempted receipt settlement after the proposal wins');
  assert.equal(h.conflicts, 1);
});

test('CAS replay rejects proposal acceptance when a receipt was scanned before save', async () => {
  const h = harness();
  const {alice, bob, chargeId, proposal} = await pendingCharge(h);
  let replacement: State | null = null;
  h.beforeSave(async () => {
    await alice.state('scanReceipt', [chargeId]);
    replacement = clone(h.state!);
  });
  await assert.rejects(bob.state('acceptSplit', [chargeId, proposal.id]), error => error instanceof RpcError && error.status === 409 && error.code === 'stale');
  assert(replacement);
  assert.deepEqual(h.state, replacement, 'discard the attempted proposal settlement after the receipt wins');
  assert.equal(h.conflicts, 1);
});

test('a forged actor cannot change the authenticated viewer or the member receiving a deposit', async () => {
  const h = harness();
  const {alice, bob, aliceId, bobId} = await accounts(h);
  const created = await alice.state('createGroup', [{name: 'Identity check', inviteIds: [bobId], budget: 20000, periodDays: 7}]);
  const groupId = created.db.groups[0].id;
  await bob.state('respondInvite', [groupId, true, 10000]);
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
  await bob.state('respondInvite', [groupId, true, 10000]);
  const version = h.state!.version;
  const requestCount = h.requests.length;
  await Promise.all([alice.state('deposit', [groupId, 101]), bob.state('deposit', [groupId, 203])]);
  assert.equal(h.requests.length, requestCount + 2, 'CAS replay stays on the server; clients send each mutation once');
  assert(h.conflicts > 0);
  assert.equal(h.state!.version, version + 2);
  const final = await alice.state('fetch');
  assert.deepEqual(final.db.groups[0].members.map(m => [m.userId, m.balance]), [[aliceId, 10101], [bobId, 10203]]);
  assert.equal(h.state!.db.ledger.filter(entry => entry.groupId === groupId && entry.kind === 'deposit').length, 4, 'each activation contribution and each later explicit deposit is recorded once');
});


test('exclusive item confirmation replays a collision without stealing another member or clearing their approval', async () => {
  const h = harness();
  const {alice, bob, aliceId, bobId, chargeId} = await pendingCharge(h);
  const current = (await alice.state('fetch')).db.charges.find(c => c.id === chargeId)!;
  const published = await alice.state('confirmReceiptList', [chargeId, {items: [{id: 'first', name: 'First meal', amount: 3000}, {id: 'second', name: 'Second meal', amount: 6000}], tax: 1, tip: 0}, chargeEditKey(current)]);
  const key = receiptListKey(published.db.charges.find(c => c.id === chargeId)!.receipt!);
  h.beforeSave(async () => { await bob.state('confirmItemSelection', [chargeId, ['first'], key]); });
  await assert.rejects(alice.state('confirmItemSelection', [chargeId, ['first'], key]), error => error instanceof RpcError && error.status === 409 && error.code === 'stale');
  assert(h.conflicts >= 1, 'the rejected confirmation really raced with a committed peer');
  const afterRace = (await alice.state('fetch')).db.charges.find(c => c.id === chargeId)!;
  assert.deepEqual(afterRace.receipt!.items.map(item => item.people), [[bobId], []]);
  assert.deepEqual(afterRace.receipt!.locked, [bobId]);
  const settled = await alice.state('confirmItemSelection', [chargeId, ['second'], key]);
  const charge = settled.db.charges.find(c => c.id === chargeId)!;
  assert.equal(charge.status, 'settled');
  assert.deepEqual(charge.proposals.at(-1)!.shares, {[aliceId]: 6001, [bobId]: 3000});
  assert.equal(h.state!.db.ledger.filter(entry => entry.chargeId === chargeId && entry.kind === 'charge').length, 2);
});

test('receipt publication rejects stale editor saves, preserves unchanged confirmations, and persists deletion across fetch', async () => {
  const h = harness();
  const {alice, bob, aliceId, chargeId} = await pendingCharge(h);
  const c = (await alice.state('fetch')).db.charges.find(c => c.id === chargeId)!;
  const input = {items: [{id: 'one', name: 'One', amount: 3000}, {id: 'two', name: 'Two', amount: 6000}], tax: 1, tip: 0, image: 'data:image/png;base64,QUJD'};
  const first = (await alice.state('confirmReceiptList', [chargeId, input, chargeEditKey(c)])).db.charges.find(c => c.id === chargeId)!;
  const oldEdit = chargeEditKey(first), oldList = receiptListKey(first.receipt!);
  await alice.state('confirmItemSelection', [chargeId, ['one'], oldList]);
  const same = (await bob.state('confirmReceiptList', [chargeId, input, oldEdit])).db.charges.find(c => c.id === chargeId)!;
  assert.deepEqual(same.receipt!.locked, [aliceId]);
  const replacement = {items: [{id: 'two', name: 'Only remaining item', amount: 9001}], tax: 0, tip: 0, image: null};
  await bob.state('confirmReceiptList', [chargeId, replacement, oldEdit]);
  const before = clone(h.state);
  await assert.rejects(alice.state('confirmReceiptList', [chargeId, input, oldEdit]), error => error instanceof RpcError && error.code === 'stale');
  await assert.rejects(alice.state('confirmItemSelection', [chargeId, ['one'], oldList]), error => error instanceof RpcError && error.code === 'stale');
  assert.deepEqual(h.state, before);
  const latest = (await alice.state('fetch')).db.charges.find(c => c.id === chargeId)!;
  assert.deepEqual(latest.receipt!.items.map(item => [item.id, item.people]), [['two', []]]);
  assert.deepEqual(latest.receipt!.locked, []);
  assert.equal(latest.receipt!.image, undefined);
});

test('phone proposals require separate acceptance and profile/group edits use JWT identity', async () => {
  const h = harness();
  const {alice, bob, aliceId, bobId, chargeId, groupId} = await pendingCharge(h);
  const charlie = h.client('jwt-charlie');
  await charlie.state('createUser', [{name: 'Charlie', handle: 'charlie.test', email: 'charlie@t.dev', phone: ''}]);
  await assert.rejects(charlie.state('updateGroup', [groupId, {name: 'Not my group'}]), error => error instanceof RpcError && error.status === 400);
  const renamed = await bob.state('updateGroup', [groupId, {name: 'Our group', photo: 'data:image/jpeg;base64,QUJD'}]);
  assert.equal(renamed.db.groups[0].name, 'Our group');
  const forged = h.client('jwt-alice', bobId);
  const changed = await forged.state('updateProfile', [{name: 'Alice Updated'}]);
  assert.equal(changed.db.users.find(user => user.id === aliceId)!.name, 'Alice Updated');
  assert.equal(changed.db.users.find(user => user.id === bobId)!.name, 'Bob Tester');
  const c = changed.db.charges.find(charge => charge.id === chargeId)!;
  const result = await alice.state('proposeSplit', [chargeId, {method: 'amount', amounts: {[aliceId]: 1001, [bobId]: 8000}}, {acceptOwnShare: false, expectedEditKey: chargeEditKey(c)}]);
  assert.deepEqual(result.db.charges.find(charge => charge.id === chargeId)!.proposals.at(-1)!.acceptedBy, []);
  assert.equal(result.db.charges.find(charge => charge.id === chargeId)!.status, 'pending');
});
