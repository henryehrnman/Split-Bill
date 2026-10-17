import assert from 'node:assert/strict';
import * as d from '../src/lib/domain.ts';
import {seed} from '../src/lib/seed.ts';

const T0 = Date.UTC(2026, 9, 17, 18);
const throws = (fn: () => unknown, pattern: RegExp) => assert.throws(fn, (e: unknown) => e instanceof d.ApiError && pattern.test(e.message));

// Seed is consistent with the rules: Jordan is restricted, Juniper is pending.
{
  const db = seed(T0);
  const apt = db.groups[0];
  assert.equal(apt.name, 'Apartment 4B');
  assert.deepEqual(apt.members.map(m => m.balance), [10000, 10000, 8000]);
  assert.equal(d.inGoodStanding(apt, 'u_jordan'), false);
  assert.equal(d.pendingCharge(db, apt.id)?.merchant, 'Juniper');
  assert.equal(d.isActive(db.groups[1]), false);
}

// Setup: equal deposits, cards issued on join, card works only once everyone has joined.
const db = seed(T0);
db.groups = [];
db.cards = [];
db.charges = [];
db.ledger = [];
const g = d.createGroup(db, 'u_henry', {name: 'Trip', memberIds: ['u_maya', 'u_jordan'], buyingPower: 30000}, T0);
assert.deepEqual(d.requiredBalances(g), {u_henry: 10000, u_maya: 10000, u_jordan: 10000});
d.joinGroup(db, 'u_henry', g.id, T0);
throws(() => d.purchase(db, 'u_henry', g.id, {merchant: 'X', amount: 100}, T0), /first deposit/);
d.joinGroup(db, 'u_maya', g.id, T0);
d.setFailTopUps(db, 'u_jordan', g.id, true);
throws(() => d.joinGroup(db, 'u_jordan', g.id, T0), /declined/);
d.setFailTopUps(db, 'u_jordan', g.id, false);
d.joinGroup(db, 'u_jordan', g.id, T0);
assert.equal(db.cards.filter(c => c.groupId === g.id).length, 3);
const card = (u: string) => d.cardFor(db, g.id, u)!;
throws(() => d.purchase(db, 'u_henry', g.id, {merchant: 'X', amount: 100}, T0), /wallet/);
for (const u of ['u_henry', 'u_maya', 'u_jordan']) d.addToWallet(db, u, card(u).id, 'Apple Wallet');

// Purchase opens one pending charge with the default split; no second floating charge.
const dinner = d.purchase(db, 'u_maya', g.id, {merchant: 'Dinner', amount: 9001}, T0);
assert.deepEqual(d.currentProposal(dinner).shares, {u_henry: 3001, u_maya: 3000, u_jordan: 3000});
throws(() => d.purchase(db, 'u_henry', g.id, {merchant: 'Y', amount: 100}, T0), /before the next purchase/);
assert.equal(d.availableFunds(db, g), 30000 - 9001);
throws(() => d.withdraw(db, 'u_henry', g.id, 25000, T0), /up to/);

// Iterative proposals: a new proposal resets acceptances; excluded members aren't required.
d.acceptSplit(db, 'u_henry', dinner.id, T0);
d.proposeSplit(db, 'u_maya', dinner.id, {method: 'equal', participants: ['u_henry', 'u_maya']}, T0);
assert.deepEqual(d.currentProposal(dinner).acceptedBy, ['u_maya']);
assert.deepEqual(d.waitingOn(d.currentProposal(dinner)), ['u_henry']);
throws(() => d.acceptSplit(db, 'u_jordan', dinner.id, T0), /approval isn’t needed/);
throws(() => d.proposeSplit(db, 'u_maya', dinner.id, {method: 'amount', amounts: {u_henry: 1, u_maya: 1, u_jordan: 1}}, T0), /must total/);
d.acceptSplit(db, 'u_henry', dinner.id, T0);
assert.equal(dinner.status, 'settled');
assert.deepEqual(g.members.map(m => m.balance), [10000 - 4501, 10000 - 4500, 10000]);

// Under-funded members are restricted to their own balance; auto top-up and failures.
assert.equal(d.inGoodStanding(g, 'u_henry'), false);
assert.equal(d.spendLimit(db, g.id, 'u_henry'), 5499);
throws(() => d.purchase(db, 'u_henry', g.id, {merchant: 'Big', amount: 6000}, T0), /only spend your own/);
assert.equal(d.spendLimit(db, g.id, 'u_jordan'), d.fundBalance(g));
d.setFailTopUps(db, 'u_maya', g.id, true);
d.setAutoDeposit(db, 'u_maya', g.id, true, T0);
assert.equal(db.ledger[0].kind, 'top-up-failed');
d.setFailTopUps(db, 'u_maya', g.id, false);
d.setAutoDeposit(db, 'u_maya', g.id, true, T0);
assert.equal(d.memberOf(g, 'u_maya').balance, 10000);
d.deposit(db, 'u_henry', g.id, 4501, T0);
assert.equal(d.inGoodStanding(g, 'u_henry'), true);

// Buying power: raising needs everyone; decreasing keeps balances (surplus stays).
d.proposeBuyingPower(db, 'u_henry', g.id, 45000, T0);
assert.equal(g.buyingPower, 30000);
const bpp = d.openBuyingPowerProposal(db, g.id)!;
d.respondBuyingPower(db, 'u_maya', bpp.id, true, T0);
d.respondBuyingPower(db, 'u_jordan', bpp.id, true, T0);
assert.equal(g.buyingPower, 45000);
assert.equal(d.memberOf(g, 'u_maya').balance, 15000);
assert.equal(d.inGoodStanding(g, 'u_henry'), false);
d.proposeBuyingPower(db, 'u_henry', g.id, 15000, T0);
for (const u of ['u_maya', 'u_jordan']) d.respondBuyingPower(db, u, d.openBuyingPowerProposal(db, g.id)!.id, true, T0);
assert.equal(d.memberOf(g, 'u_maya').balance, 15000);
assert.equal(d.inGoodStanding(g, 'u_henry'), true);

// Items split from a scanned receipt; frozen card blocks purchases.
d.setCardFrozen(db, 'u_jordan', card('u_jordan').id, true);
throws(() => d.purchase(db, 'u_jordan', g.id, {merchant: 'Juniper', amount: 15420}, T0), /frozen/);
d.setCardFrozen(db, 'u_jordan', card('u_jordan').id, false);
const juniper = d.purchase(db, 'u_jordan', g.id, {merchant: 'Juniper', amount: 15420}, T0);
const receipt = d.scanReceipt(db, 'u_henry', juniper.id, T0);
assert.equal(receipt.items.length, 6);
const claimed = receipt.items.map((it, i) => ({...it, people: i < 2 ? ['u_henry', 'u_maya', 'u_jordan'] : [['u_henry', 'u_maya', 'u_jordan'][i % 3]]}));
d.proposeSplit(db, 'u_henry', juniper.id, {method: 'items', items: claimed, tax: receipt.tax, tip: receipt.tip}, T0);
const shares = d.currentProposal(juniper).shares;
assert.equal(Object.values(shares).reduce((a, b) => a + b, 0), 15420);

// Deadline: an unagreed split after 7 days freezes the group; support resolution unfreezes.
d.enforceDeadlines(db, T0 + d.SPLIT_DEADLINE + 1);
assert.equal(juniper.status, 'disputed');
assert(g.frozen);
assert.equal(d.spendLimit(db, g.id, 'u_jordan'), 0);
d.resolveDisputes(db, g.id, T0 + d.SPLIT_DEADLINE + 2);
assert.equal(juniper.status, 'settled');
assert.equal(g.frozen, null);

// Chargeback on a settled charge freezes the group.
d.fileChargeback(db, 'u_henry', dinner.id, T0);
assert.equal(dinner.status, 'disputed');
throws(() => d.purchase(db, 'u_henry', g.id, {merchant: 'Z', amount: 100}, T0), /frozen/);

const spend = d.spendSummary(db, g.id, T0);
assert.equal(spend.total, 15420);

console.log('PASS domain: deposits/join, card gating, one floating charge, iterative proposals, excluded members, restriction, auto top-up + failures, buying power changes, receipt items, 7-day freeze, chargeback.');
