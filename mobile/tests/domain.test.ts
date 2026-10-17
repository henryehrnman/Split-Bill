import assert from 'node:assert/strict';
import * as d from '../src/lib/domain.ts';
import {seed} from '../src/lib/seed.ts';

const T0 = Date.UTC(2026, 9, 17, 18);
const throws = (fn: () => unknown, pattern: RegExp) => assert.throws(fn, (e: unknown) => e instanceof d.ApiError && pattern.test(e.message));
const bal = (g: d.Group) => g.members.map(m => m.balance);

// Seed follows the rules: a period rolled over, Jordan (manual refill) is below share, Juniper is pending,
// and Henry has an open invite to the ski trip.
{
  const db = seed(T0);
  const [apt, ski] = db.groups;
  assert.equal(apt.name, 'Apartment 4B');
  assert.deepEqual(bal(apt), [8000, 8000, 4790]);
  assert.equal(d.standing(apt, 'u_jordan'), 'low');
  assert.equal(d.pendingCharge(db, apt.id)?.merchant, 'Juniper');
  assert.equal(d.periodSpend(db, apt, 'u_henry'), 2000);
  assert.equal(d.isActive(ski), false);
  assert.equal(d.standing(ski, 'u_henry'), 'invited');
}

const db = seed(T0);
Object.assign(db, {groups: [], cards: [], charges: [], budgetProposals: [], ledger: []});

// Invite search by handle, email or phone.
assert.deepEqual(d.searchUsers(db, '@maya', ['u_henry']).map(u => u.id), ['u_maya']);
assert.deepEqual(d.searchUsers(db, '555-0177', []).map(u => u.id), ['u_jordan']);
assert.equal(d.searchUsers(db, 'example.com', ['u_henry']).length, 4);

// Group creation: creator deposits immediately; invitees accept (deposit) or decline; shares recompute.
throws(() => d.createGroup(db, 'u_henry', {name: 'Solo', inviteIds: [], budget: 30000, periodDays: 14}, T0), /Invite at least one/);
const g = d.createGroup(db, 'u_henry', {name: 'Trip', inviteIds: ['u_maya', 'u_jordan', 'u_connor'], budget: 30000, periodDays: 14}, T0);
assert.deepEqual(bal(g), [7500, 0, 0, 0]);
throws(() => d.purchase(db, 'u_henry', g.id, {merchant: 'X', amount: 100}, T0), /accept their invite/);
throws(() => d.deposit(db, 'u_maya', g.id, 100, T0), /Accept the invite/);
d.respondInvite(db, 'u_connor', g.id, false, T0);
assert.deepEqual(d.shares(g), {u_henry: 10000, u_maya: 10000, u_jordan: 10000});
d.respondInvite(db, 'u_maya', g.id, true, T0);
d.setFailTopUps(db, 'u_jordan', g.id, true);
throws(() => d.respondInvite(db, 'u_jordan', g.id, true, T0), /declined/);
d.setFailTopUps(db, 'u_jordan', g.id, false);
d.respondInvite(db, 'u_jordan', g.id, true, T0);
assert.deepEqual(bal(g), [7500, 10000, 10000]);
assert.equal(d.standing(g, 'u_henry'), 'low');
assert.equal(db.cards.filter(c => c.groupId === g.id).length, 3);
const card = (u: string) => d.cardFor(db, g.id, u)!;
throws(() => d.purchase(db, 'u_henry', g.id, {merchant: 'X', amount: 100}, T0), /wallet/);
for (const u of ['u_henry', 'u_maya', 'u_jordan']) d.addToWallet(db, u, card(u).id, 'Apple Wallet');

// One floating charge; withdrawals are locked while it's pending.
const dinner = d.purchase(db, 'u_maya', g.id, {merchant: 'Dinner', amount: 9001}, T0);
assert.deepEqual(d.currentProposal(dinner).shares, {u_henry: 3001, u_maya: 3000, u_jordan: 3000});
throws(() => d.purchase(db, 'u_henry', g.id, {merchant: 'Y', amount: 100}, T0), /before the next purchase/);
throws(() => d.withdraw(db, 'u_henry', g.id, 100, T0), /once the Dinner split/);
for (const u of ['u_henry', 'u_maya', 'u_jordan']) d.acceptSplit(db, u, dinner.id, T0);
assert.equal(dinner.status, 'settled');
assert.deepEqual(bal(g), [4499, 7000, 7000]);

// Amount proposal; a negative balance is charged back to $0 and the member is restricted at $0.
const rent = d.purchase(db, 'u_jordan', g.id, {merchant: 'Rent', amount: 15000}, T0);
d.proposeSplit(db, 'u_jordan', rent.id, {method: 'amount', amounts: {u_henry: 6000, u_maya: 1000, u_jordan: 8000}}, T0);
throws(() => d.proposeSplit(db, 'u_maya', rent.id, {method: 'amount', amounts: {u_henry: 1, u_maya: 1, u_jordan: 1}}, T0), /must total/);
d.acceptSplit(db, 'u_henry', rent.id, T0);
d.acceptSplit(db, 'u_maya', rent.id, T0);
assert.deepEqual(bal(g), [0, 6000, 0]);
assert.equal(db.ledger.filter(e => e.kind === 'debt-recovery').length, 2);
assert.equal(d.standing(g, 'u_henry'), 'restricted');
assert.equal(d.spendLimit(db, g.id, 'u_henry'), 0);
throws(() => d.purchase(db, 'u_henry', g.id, {merchant: 'Z', amount: 100}, T0), /\$0 or below/);

// If the bank charge fails, the member is suspended and the group carries the debt.
d.deposit(db, 'u_jordan', g.id, 2000, T0);
d.setFailTopUps(db, 'u_jordan', g.id, true);
const groceries = d.purchase(db, 'u_maya', g.id, {merchant: 'Groceries', amount: 7500}, T0);
for (const u of ['u_henry', 'u_maya', 'u_jordan']) d.acceptSplit(db, u, groceries.id, T0);
assert.deepEqual(bal(g), [0, 3500, -500]);
assert.equal(d.standing(g, 'u_jordan'), 'suspended');
throws(() => d.purchase(db, 'u_jordan', g.id, {merchant: 'Z', amount: 100}, T0), /suspended/);

// Period start: auto-refill members are charged up to their share; failures are logged.
d.tick(db, T0 + 14 * d.DAY);
assert.equal(g.periodStart, T0 + 14 * d.DAY);
assert.deepEqual(bal(g), [10000, 10000, -500]);
assert.equal(db.ledger.some(e => e.kind === 'top-up-failed' && e.userId === 'u_jordan'), true);
d.setFailTopUps(db, 'u_jordan', g.id, false);
d.deposit(db, 'u_jordan', g.id, 500, T0 + 14 * d.DAY);
assert.equal(d.standing(g, 'u_jordan'), 'restricted');
d.setAutoDeposit(db, 'u_jordan', g.id, false);
d.tick(db, T0 + 28 * d.DAY);
assert.deepEqual(bal(g), [10000, 10000, 0]);

// Budget changes need everyone; a raise is collected at the next period, a cut keeps balances.
d.proposeBudget(db, 'u_henry', g.id, 45000, T0 + 28 * d.DAY);
const raise = d.openBudgetProposal(db, g.id)!;
d.respondBudget(db, 'u_maya', raise.id, true);
assert.equal(g.budget, 30000);
d.respondBudget(db, 'u_jordan', raise.id, true);
assert.equal(g.budget, 45000);
assert.deepEqual(bal(g), [10000, 10000, 0]);
assert.equal(d.standing(g, 'u_henry'), 'low');
d.tick(db, T0 + 42 * d.DAY);
assert.deepEqual(bal(g), [15000, 15000, 0]);
d.proposeBudget(db, 'u_maya', g.id, 30000, T0 + 42 * d.DAY);
for (const u of ['u_henry', 'u_jordan']) d.respondBudget(db, u, d.openBudgetProposal(db, g.id)!.id, true);
assert.deepEqual(bal(g), [15000, 15000, 0]);

// Itemized claim board: claim, lock, suggest edits, confirm when everything is claimed and locked.
const t = T0 + 42 * d.DAY;
const bar = d.purchase(db, 'u_henry', g.id, {merchant: 'Bar', amount: 6000}, t);
d.scanReceipt(db, 'u_henry', bar.id, t);
throws(() => d.updateReceipt(db, 'u_henry', bar.id, {items: [{id: 'a', name: 'Beer', amount: 100}], tax: 0, tip: 0}), /add up to/);
d.updateReceipt(db, 'u_henry', bar.id, {items: [{id: 'a', name: 'Beer', amount: 2000}, {id: 'b', name: 'Wings', amount: 2400}, {id: 'c', name: 'Fries', amount: 1000}], tax: 600, tip: 0});
d.toggleClaim(db, 'u_henry', bar.id, 'a');
d.toggleClaim(db, 'u_maya', bar.id, 'b');
assert.deepEqual(d.itemBoardStatus(bar).unclaimed.map(i => i.id), ['c']);
d.toggleClaim(db, 'u_jordan', bar.id, 'c');
d.setLocked(db, 'u_henry', bar.id, true, t);
throws(() => d.toggleClaim(db, 'u_henry', bar.id, 'c'), /Unlock/);
throws(() => d.suggestItemEdit(db, 'u_maya', bar.id, 'b', 'u_maya', t), /directly/);
d.suggestItemEdit(db, 'u_maya', bar.id, 'c', 'u_henry', t);
throws(() => d.respondItemEdit(db, 'u_jordan', bar.id, bar.receipt!.edits[0].id, true, t), /Only the person/);
d.setLocked(db, 'u_maya', bar.id, true, t);
d.setLocked(db, 'u_jordan', bar.id, true, t);
assert.equal(bar.status, 'pending');
d.respondItemEdit(db, 'u_henry', bar.id, bar.receipt!.edits[0].id, true, t);
assert.equal(bar.status, 'settled');
assert.deepEqual(d.currentProposal(bar).shares, {u_henry: 2778, u_maya: 2667, u_jordan: 555});
assert.deepEqual(bal(g), [15000 - 2778, 15000 - 2667, 0]);

// Deadline: an unagreed split after 7 days freezes the group; support resolution unfreezes.
const late = d.purchase(db, 'u_maya', g.id, {merchant: 'Late', amount: 300}, t);
d.tick(db, t + d.SPLIT_DEADLINE + 1);
assert.equal(late.status, 'disputed');
assert(g.frozen);
assert.equal(d.spendLimit(db, g.id, 'u_maya'), 0);
d.resolveDisputes(db, g.id, t + d.SPLIT_DEADLINE + 2);
assert.equal(late.status, 'settled');
assert.equal(g.frozen, null);

// Chargeback on a settled charge freezes the group.
d.fileChargeback(db, 'u_henry', dinner.id, t);
assert.equal(dinner.status, 'disputed');
throws(() => d.purchase(db, 'u_henry', g.id, {merchant: 'Z', amount: 100}, t), /frozen/);

console.log('PASS domain: invite search, invites accept/decline, withdraw lock, $0 restriction, debt recovery + suspension, period refills, budget changes, item claim board with locks and edits, 7-day freeze, chargeback.');
