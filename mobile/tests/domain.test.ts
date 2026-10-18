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
  assert.equal(d.standing(apt, 'u_jordan'), 'restricted');
  // Jordan's $51.40 default share of the open Juniper charge is held against his $47.90 balance.
  assert.equal(d.spendLimit(db, apt.id, 'u_jordan'), 0);
  assert.equal(d.availableFunds(db, apt), 8000 + 8000 + 4790 - 15420);
  assert.equal(apt.singleOpenCharge, true);
  assert.equal(d.standing(apt, 'u_henry'), 'on-track');
  assert.equal(d.pendingCharge(db, apt.id)?.merchant, 'Juniper');
  assert.equal(d.periodSpend(db, apt, 'u_henry'), 2000);
  assert.equal(d.isActive(ski), false);
  assert.equal(d.standing(ski, 'u_henry'), 'invited');
}

const db = seed(T0);
Object.assign(db, {groups: [], cards: [], charges: [], budgetProposals: [], ledger: [], notifications: []});

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
d.setDefaultSplit(db, 'u_henry', g.id, {method: 'percent', percents: {u_henry: 40, u_maya: 30, u_jordan: 20, u_connor: 10}});
d.respondInvite(db, 'u_connor', g.id, false, T0);
assert.deepEqual(d.shares(g), {u_henry: 10000, u_maya: 10000, u_jordan: 10000});
assert.deepEqual(g.defaultSplit, {method: 'equal'});
d.respondInvite(db, 'u_maya', g.id, true, T0, d.shares(g)['u_maya']);
d.setFailTopUps(db, 'u_jordan', g.id, true);
throws(() => d.respondInvite(db, 'u_jordan', g.id, true, T0, d.shares(g)['u_jordan']), /declined/);
d.setFailTopUps(db, 'u_jordan', g.id, false);
d.respondInvite(db, 'u_jordan', g.id, true, T0, d.shares(g)['u_jordan']);
assert.deepEqual(bal(g), [7500, 10000, 10000]);
assert.equal(d.standing(g, 'u_henry'), 'on-track');
assert.equal(db.cards.filter(c => c.groupId === g.id).length, 3);
const card = (u: string) => d.cardFor(db, g.id, u)!;
throws(() => d.purchase(db, 'u_henry', g.id, {merchant: 'X', amount: 100}, T0), /wallet/);
for (const u of ['u_henry', 'u_maya', 'u_jordan']) d.addToWallet(db, u, card(u).id, 'Apple Wallet');

// Invalid persisted defaults must fail before creating IDs, charges, or balance changes.
g.defaultSplit = {method: 'percent', percents: {u_henry: 50, u_maya: 25}};
const beforeInvalidPurchase = JSON.parse(JSON.stringify(db));
throws(() => d.purchase(db, 'u_henry', g.id, {merchant: 'Invalid default', amount: 1000}, T0), /Percentages must total 100/);
assert.deepEqual(db, beforeInvalidPurchase);
g.defaultSplit = {method: 'equal'};

// One floating charge; withdrawals are locked while it's pending.
const dinner = d.purchase(db, 'u_maya', g.id, {merchant: 'Dinner', amount: 9001}, T0);
assert.deepEqual(d.currentProposal(dinner).shares, {u_henry: 3001, u_maya: 3000, u_jordan: 3000});
throws(() => d.purchase(db, 'u_henry', g.id, {merchant: 'Y', amount: 100}, T0), /before the next purchase/);
throws(() => d.withdraw(db, 'u_henry', g.id, 100, T0), /once the Dinner split/);

// The cardholder sends the first proposal; until then nobody else can act and nobody is notified.
assert.equal(d.isDraft(dinner), true);
throws(() => d.acceptSplit(db, 'u_henry', dinner.id, T0, d.currentProposal(dinner).id), /Waiting for Maya/);
throws(() => d.sendDefaultSplit(db, 'u_henry', dinner.id, T0), /Only the person who paid/);
assert.equal(db.notifications.length, 0);
const beforeMissingProposal = JSON.parse(JSON.stringify(db));
assert.throws(() => {
  // @ts-expect-error Runtime callers must supply the reviewed proposal ID too.
  d.acceptSplit(db, 'u_maya', dinner.id, T0);
}, error => error instanceof d.StaleStateError);
assert.deepEqual(db, beforeMissingProposal);
d.sendDefaultSplit(db, 'u_maya', dinner.id, T0);
assert.equal(d.isDraft(dinner), false);
assert.deepEqual(db.notifications.map(n => n.userId).sort(), ['u_henry', 'u_jordan']);
assert.deepEqual(d.currentProposal(dinner).acceptedBy, ['u_maya']);
for (const u of ['u_henry', 'u_jordan']) d.acceptSplit(db, u, dinner.id, T0, d.currentProposal(dinner).id);
assert.equal(dinner.status, 'settled');
assert.deepEqual(bal(g), [4499, 7000, 7000]);

// Amount proposal; a negative balance is charged back to $0, and members who added their share can still spend the whole fund.
const rent = d.purchase(db, 'u_jordan', g.id, {merchant: 'Rent', amount: 15000}, T0);
d.proposeSplit(db, 'u_jordan', rent.id, {method: 'amount', amounts: {u_henry: 6000, u_maya: 1000, u_jordan: 8000}}, T0);
throws(() => d.proposeSplit(db, 'u_maya', rent.id, {method: 'amount', amounts: {u_henry: 1, u_maya: 1, u_jordan: 1}}, T0), /must total/);
d.acceptSplit(db, 'u_henry', rent.id, T0, d.currentProposal(rent).id);
d.acceptSplit(db, 'u_maya', rent.id, T0, d.currentProposal(rent).id);
assert.deepEqual(bal(g), [0, 6000, 0]);
assert.equal(db.ledger.filter(e => e.kind === 'debt-recovery').length, 2);
assert.equal(d.standing(g, 'u_henry'), 'on-track');
assert.equal(d.spendLimit(db, g.id, 'u_henry'), 6000);

// If the bank charge fails, the member is suspended and the group carries the debt.
d.deposit(db, 'u_jordan', g.id, 2000, T0);
d.setFailTopUps(db, 'u_jordan', g.id, true);
const groceries = d.purchase(db, 'u_maya', g.id, {merchant: 'Groceries', amount: 7500}, T0);
for (const u of ['u_maya', 'u_henry', 'u_jordan']) d.acceptSplit(db, u, groceries.id, T0, d.currentProposal(groceries).id);
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
throws(() => d.purchase(db, 'u_jordan', g.id, {merchant: 'Z', amount: 100}, T0 + 14 * d.DAY), /Add your \$100\.00 share/);

// Without their share added, a member can only spend up to their own balance.
d.deposit(db, 'u_jordan', g.id, 3000, T0 + 14 * d.DAY);
assert.equal(d.spendLimit(db, g.id, 'u_jordan'), 3000);
throws(() => d.purchase(db, 'u_jordan', g.id, {merchant: 'Z', amount: 4000}, T0 + 14 * d.DAY), /own balance/);
d.withdraw(db, 'u_jordan', g.id, 3000, T0 + 14 * d.DAY);
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
assert.equal(d.standing(g, 'u_henry'), 'on-track');
d.tick(db, T0 + 42 * d.DAY);
assert.deepEqual(bal(g), [15000, 15000, 0]);
d.proposeBudget(db, 'u_maya', g.id, 30000, T0 + 42 * d.DAY);
for (const u of ['u_henry', 'u_jordan']) d.respondBudget(db, u, d.openBudgetProposal(db, g.id)!.id, true);
assert.deepEqual(bal(g), [15000, 15000, 0]);

// Itemized claim board: claim, lock, suggest edits, confirm when everything is claimed and locked.
const t = T0 + 42 * d.DAY;
const bar = d.purchase(db, 'u_henry', g.id, {merchant: 'Bar', amount: 6000}, t);
d.scanReceipt(db, 'u_henry', bar.id, t);
const scannedBarKey = d.receiptApprovalKey(bar.receipt!);
throws(() => d.updateReceipt(db, 'u_henry', bar.id, {items: [{id: 'a', name: 'Beer', amount: 100}], tax: 0, tip: 0}), /add up to/);
d.updateReceipt(db, 'u_henry', bar.id, {items: [{id: 'a', name: 'Beer', amount: 2000}, {id: 'b', name: 'Wings', amount: 2400}, {id: 'c', name: 'Fries', amount: 1000}], tax: 600, tip: 0});
const beforeStaleReceiptLock = JSON.parse(JSON.stringify(db));
assert.throws(() => d.setLocked(db, 'u_henry', bar.id, true, t, scannedBarKey), error => error instanceof d.StaleStateError);
assert.deepEqual(db, beforeStaleReceiptLock);
d.toggleClaim(db, 'u_henry', bar.id, 'a');
d.toggleClaim(db, 'u_maya', bar.id, 'b');
assert.deepEqual(d.itemBoardStatus(bar).unclaimed.map(i => i.id), ['c']);
d.toggleClaim(db, 'u_jordan', bar.id, 'c');
const reviewedBarKey = d.receiptApprovalKey(bar.receipt!);
d.setLocked(db, 'u_henry', bar.id, true, t, reviewedBarKey);
throws(() => d.toggleClaim(db, 'u_henry', bar.id, 'c'), /Unlock/);
throws(() => d.suggestItemEdit(db, 'u_maya', bar.id, 'b', 'u_maya', t), /directly/);
d.suggestItemEdit(db, 'u_maya', bar.id, 'c', 'u_henry', t);
throws(() => d.respondItemEdit(db, 'u_jordan', bar.id, bar.receipt!.edits[0].id, true, t), /Only the person/);
d.setLocked(db, 'u_maya', bar.id, true, t, reviewedBarKey);
d.setLocked(db, 'u_jordan', bar.id, true, t, reviewedBarKey);
assert.equal(bar.status, 'pending');
d.respondItemEdit(db, 'u_henry', bar.id, bar.receipt!.edits[0].id, true, t);
assert.equal(bar.status, 'pending');
assert.deepEqual(bar.receipt!.locked, []);
assert.deepEqual(bal(g), [15000, 15000, 0]);
const editedBarKey = d.receiptApprovalKey(bar.receipt!);
for (const userId of ['u_henry', 'u_maya', 'u_jordan']) d.setLocked(db, userId, bar.id, true, t, editedBarKey);
assert.equal(bar.status, 'settled');
assert.deepEqual(d.currentProposal(bar).shares, {u_henry: 2778, u_maya: 2667, u_jordan: 555});
assert.deepEqual(bal(g), [15000 - 2778, 15000 - 2667, 0]);

// Deadline: an unagreed split after 7 days freezes the group; support resolution unfreezes.
const late = d.purchase(db, 'u_maya', g.id, {merchant: 'Late', amount: 300}, t);
const beforeDeadlineFunds = d.availableFunds(db, g);
d.tick(db, t + d.SPLIT_DEADLINE + 1);
assert.equal(late.status, 'disputed');
assert(g.frozen);
assert.equal(d.spendLimit(db, g.id, 'u_maya'), 0);
assert.equal(d.reservedFunds(db, g.id), 300);
assert.equal(d.availableFunds(db, g), beforeDeadlineFunds);
const beforeFrozenWithdrawal = JSON.parse(JSON.stringify(db));
throws(() => d.withdraw(db, 'u_henry', g.id, 100, t + d.SPLIT_DEADLINE + 1), /frozen/);
assert.deepEqual(db, beforeFrozenWithdrawal);
d.resolveDisputes(db, g.id, t + d.SPLIT_DEADLINE + 2);
assert.equal(late.status, 'settled');
assert.equal(g.frozen, null);
assert.equal(d.reservedFunds(db, g.id), 0);
assert.equal(d.availableFunds(db, g), d.fundBalance(g));
assert.equal(db.ledger.filter(e => e.chargeId === late.id && e.kind === 'charge').reduce((sum, e) => sum - e.amount, 0), late.amount);

// A first proposal that leaves someone out only notifies the people with a share.
const t2 = t + d.SPLIT_DEADLINE + 3;
db.notifications = [];
const coffee = d.purchase(db, 'u_henry', g.id, {merchant: 'Coffee', amount: 1200}, t2);
d.proposeSplit(db, 'u_henry', coffee.id, {method: 'equal', participants: ['u_henry', 'u_maya']}, t2);
assert.deepEqual(db.notifications.map(n => n.userId), ['u_maya']);
d.acceptSplit(db, 'u_maya', coffee.id, t2, d.currentProposal(coffee).id);
assert.equal(coffee.status, 'settled');

// If the cardholder never sends anything, the default split goes to everyone after the grace period.
db.notifications = [];
const snacks = d.purchase(db, 'u_maya', g.id, {merchant: 'Snacks', amount: 900}, t2);
d.tick(db, t2 + d.DRAFT_GRACE - 1);
assert.equal(d.isDraft(snacks), true);
d.tick(db, t2 + d.DRAFT_GRACE);
assert.equal(d.isDraft(snacks), false);
assert.deepEqual(db.notifications.map(n => n.userId).sort(), ['u_henry', 'u_jordan']);
for (const u of ['u_henry', 'u_jordan']) d.acceptSplit(db, u, snacks.id, t2 + d.DRAFT_GRACE, d.currentProposal(snacks).id);
assert.equal(snacks.status, 'settled');

// Scanning the receipt while drafting sends it to everyone to claim their items.
db.notifications = [];
const lunch = d.purchase(db, 'u_henry', g.id, {merchant: 'Lunch', amount: 3000}, t2 + d.DAY);
d.scanReceipt(db, 'u_henry', lunch.id, t2 + d.DAY);
assert.equal(d.isDraft(lunch), false);
assert.deepEqual(db.notifications.map(n => n.userId).sort(), ['u_jordan', 'u_maya']);
d.sendDefaultSplit(db, 'u_henry', lunch.id, t2 + d.DAY);
assert.equal(db.notifications.length, 2);

// With the lock off, several charges can be open; each is held against the fund and against a restricted member's balance.
const t3 = t2 + d.DAY;
throws(() => d.purchase(db, 'u_maya', g.id, {merchant: 'Gas', amount: 1500}, t3), /Lunch before the next purchase/);
d.setSingleOpenCharge(db, 'u_maya', g.id, false);
const free = d.fundBalance(g) - 3000;
assert.equal(d.availableFunds(db, g), free);
d.purchase(db, 'u_maya', g.id, {merchant: 'Gas', amount: 1500}, t3);
assert.deepEqual(d.openCharges(db, g.id).map(c => c.merchant), ['Lunch', 'Gas']);
assert.equal(d.availableFunds(db, g), free - 1500);
throws(() => d.purchase(db, 'u_henry', g.id, {merchant: 'TV', amount: free - 1500 + 1}, t3), /only has/);
throws(() => d.withdraw(db, 'u_henry', g.id, 100, t3), /once the Lunch split/);
assert.equal(d.standing(g, 'u_jordan'), 'restricted');
d.deposit(db, 'u_jordan', g.id, 2000, t3);
assert.equal(d.spendLimit(db, g.id, 'u_jordan'), 500);
throws(() => d.purchase(db, 'u_jordan', g.id, {merchant: 'Pizza', amount: 600}, t3), /own balance \(\$5\.00\)/);
d.setSingleOpenCharge(db, 'u_henry', g.id, true);
throws(() => d.purchase(db, 'u_jordan', g.id, {merchant: 'Pizza', amount: 100}, t3), /Lunch before the next purchase/);

// Chargeback on a settled charge freezes the group.
const beforeChargebackHold = d.reservedFunds(db, g.id);
d.fileChargeback(db, 'u_henry', dinner.id, t);
assert.equal(dinner.status, 'disputed');
assert.equal(d.reservedFunds(db, g.id), beforeChargebackHold);
throws(() => d.purchase(db, 'u_henry', g.id, {merchant: 'Z', amount: 100}, t), /frozen/);
throws(() => d.withdraw(db, 'u_henry', g.id, 100, t), /frozen/);

// A departing member with no percentage share leaves valid custom percentages intact.
{
  const db = seed(T0);
  const g = d.createGroup(db, 'u_henry', {name: 'Zero-share invite', inviteIds: ['u_maya', 'u_jordan'], budget: 30000, periodDays: 30}, T0);
  d.setDefaultSplit(db, 'u_henry', g.id, {method: 'percent', percents: {u_henry: 70, u_maya: 30, u_jordan: 0}});
  d.respondInvite(db, 'u_jordan', g.id, false, T0);
  assert.deepEqual(g.defaultSplit, {method: 'percent', percents: {u_henry: 70, u_maya: 30}});
  d.respondInvite(db, 'u_maya', g.id, true, T0, d.shares(g)['u_maya']);
  d.addToWallet(db, 'u_henry', d.cardFor(db, g.id, 'u_henry')!.id, 'Apple Wallet');
  const c = d.purchase(db, 'u_henry', g.id, {merchant: 'Custom default', amount: 1001}, T0);
  assert.deepEqual(d.currentProposal(c).shares, {u_henry: 701, u_maya: 300});
}

// Pending and disputed-unsettled charges both reserve funds, but only pending ones stay editable.
{
  const db = seed(T0);
  const g = d.createGroup(db, 'u_henry', {name: 'Mixed reservations', inviteIds: ['u_maya'], budget: 20000, periodDays: 30}, T0);
  d.respondInvite(db, 'u_maya', g.id, true, T0, d.shares(g)['u_maya']);
  d.addToWallet(db, 'u_henry', d.cardFor(db, g.id, 'u_henry')!.id, 'Apple Wallet');
  d.setSingleOpenCharge(db, 'u_henry', g.id, false);
  const older = d.purchase(db, 'u_henry', g.id, {merchant: 'Older', amount: 2000}, T0);
  const newer = d.purchase(db, 'u_henry', g.id, {merchant: 'Newer', amount: 1000}, T0 + d.DAY);
  d.tick(db, T0 + d.SPLIT_DEADLINE + 1);
  assert.equal(older.status, 'disputed');
  assert.equal(newer.status, 'pending');
  assert.deepEqual(d.openCharges(db, g.id).map(c => c.id), [newer.id]);
  assert.equal(d.reservedFunds(db, g.id), 3000);
  assert.equal(d.availableFunds(db, g), 17000);
  throws(() => d.withdraw(db, 'u_henry', g.id, 100, T0 + d.SPLIT_DEADLINE + 1), /frozen/);

  // Even missing freeze metadata cannot make an unsettled dispute withdrawable.
  const thawed: d.Db = JSON.parse(JSON.stringify(db));
  d.groupById(thawed, g.id).frozen = null;
  const before = JSON.parse(JSON.stringify(thawed));
  throws(() => d.withdraw(thawed, 'u_henry', g.id, 100, T0 + d.SPLIT_DEADLINE + 1), /once the Older split/);
  assert.deepEqual(thawed, before);

  d.resolveDisputes(db, g.id, T0 + d.SPLIT_DEADLINE + 2);
  assert.equal(older.status, 'settled');
  assert.equal(newer.status, 'pending');
  assert.equal(g.frozen, null);
  assert.equal(d.reservedFunds(db, g.id), 1000);
  assert.equal(d.availableFunds(db, g), 17000);
  throws(() => d.withdraw(db, 'u_henry', g.id, 100, T0 + d.SPLIT_DEADLINE + 2), /once the Newer split/);
  d.acceptSplit(db, 'u_maya', newer.id, T0 + d.SPLIT_DEADLINE + 3, d.currentProposal(newer).id);
  assert.equal(d.reservedFunds(db, g.id), 0);
  assert.equal(d.availableFunds(db, g), 17000);
  d.withdraw(db, 'u_henry', g.id, 100, T0 + d.SPLIT_DEADLINE + 4);
  assert.equal(d.memberOf(g, 'u_henry').balance, 8400);
}

// A settledAt timestamp of zero is still settled: chargebacks never reserve or debit it twice.
{
  const db = seed(T0);
  const g = d.createGroup(db, 'u_henry', {name: 'Settled chargeback', inviteIds: ['u_maya'], budget: 20000, periodDays: 30}, 0);
  d.respondInvite(db, 'u_maya', g.id, true, 0, d.shares(g)['u_maya']);
  d.addToWallet(db, 'u_henry', d.cardFor(db, g.id, 'u_henry')!.id, 'Apple Wallet');
  const c = d.purchase(db, 'u_henry', g.id, {merchant: 'Settled', amount: 1000}, 0);
  d.sendDefaultSplit(db, 'u_henry', c.id, 0);
  d.acceptSplit(db, 'u_maya', c.id, 0, d.currentProposal(c).id);
  assert.equal(c.settledAt, 0);
  const balances = bal(g);
  const ledger = JSON.parse(JSON.stringify(db.ledger));
  d.fileChargeback(db, 'u_henry', c.id, 1);
  assert.equal(d.reservedFunds(db, g.id), 0);
  assert.equal(d.availableFunds(db, g), 19000);
  throws(() => d.withdraw(db, 'u_henry', g.id, 100, 1), /frozen/);
  d.resolveDisputes(db, g.id, 2);
  assert.equal(g.frozen, null);
  assert.equal(c.settledAt, 0);
  assert.deepEqual(bal(g), balances);
  assert.deepEqual(db.ledger, ledger);
  d.withdraw(db, 'u_henry', g.id, 100, 3);
  assert.equal(d.memberOf(g, 'u_henry').balance, 9400);
}

// Acceptance belongs to the reviewed proposal, even when another member replaces it before the tap arrives.
{
  const db = seed(T0);
  const g = d.createGroup(db, 'u_henry', {name: 'Reviewed proposal', inviteIds: ['u_maya'], budget: 20000, periodDays: 30}, T0);
  d.respondInvite(db, 'u_maya', g.id, true, T0, d.shares(g)['u_maya']);
  d.addToWallet(db, 'u_henry', d.cardFor(db, g.id, 'u_henry')!.id, 'Apple Wallet');
  const c = d.purchase(db, 'u_henry', g.id, {merchant: 'Review first', amount: 1000}, T0);
  d.sendDefaultSplit(db, 'u_henry', c.id, T0);
  const reviewedId = d.currentProposal(c).id;
  assert.equal(d.currentProposal(c).shares.u_maya, 500);
  d.proposeSplit(db, 'u_henry', c.id, {method: 'amount', amounts: {u_henry: 0, u_maya: 1000}}, T0 + 1);
  assert.notEqual(d.currentProposal(c).id, reviewedId);
  const before = JSON.parse(JSON.stringify(db));
  assert.throws(() => d.acceptSplit(db, 'u_maya', c.id, T0 + 2, reviewedId), error => {
    assert(error instanceof d.StaleStateError);
    assert.equal(error.message, 'The split changed. Review the latest proposal before accepting.');
    return true;
  });
  assert.deepEqual(db, before);
  d.acceptSplit(db, 'u_maya', c.id, T0 + 3, d.currentProposal(c).id);
  assert.equal(c.status, 'settled');
  assert.deepEqual(bal(g), [10000, 9000]);
}

// A shared-item change alters item, tax and tip amounts: everybody must review and lock again.
{
  const db = seed(T0);
  const g = d.createGroup(db, 'u_henry', {name: 'Reviewed receipt', inviteIds: ['u_maya'], budget: 20000, periodDays: 30}, T0);
  d.respondInvite(db, 'u_maya', g.id, true, T0, d.shares(g)['u_maya']);
  d.addToWallet(db, 'u_henry', d.cardFor(db, g.id, 'u_henry')!.id, 'Apple Wallet');
  const c = d.purchase(db, 'u_henry', g.id, {merchant: 'Shared plate', amount: 1300}, T0);
  d.scanReceipt(db, 'u_henry', c.id, T0);
  d.updateReceipt(db, 'u_henry', c.id, {items: [{id: 'shared', name: 'Shared plate', amount: 600}, {id: 'solo', name: 'Solo plate', amount: 400}], tax: 100, tip: 200});
  d.toggleClaim(db, 'u_henry', c.id, 'shared');
  d.toggleClaim(db, 'u_maya', c.id, 'shared');
  d.toggleClaim(db, 'u_maya', c.id, 'solo');
  const r = c.receipt!;
  const reviewedKey = d.receiptApprovalKey(r);
  assert.equal(d.receiptApprovalKey({...r, items: r.items.map(item => ({...item, people: [...item.people].reverse()}))}), reviewedKey);
  const beforeMissingKey = JSON.parse(JSON.stringify(db));
  assert.throws(() => d.setLocked(db, 'u_henry', c.id, true, T0), error => error instanceof d.StaleStateError);
  assert.deepEqual(db, beforeMissingKey);
  d.setLocked(db, 'u_henry', c.id, true, T0, reviewedKey);
  d.setLocked(db, 'u_henry', c.id, false, T0); // Unlocking never requires an approval key.
  d.setLocked(db, 'u_henry', c.id, true, T0, reviewedKey);
  const balancesBeforeChange = bal(g);
  d.toggleClaim(db, 'u_maya', c.id, 'shared');
  assert.deepEqual(r.locked, []);
  assert.equal(c.status, 'pending');
  assert.deepEqual(bal(g), balancesBeforeChange);
  const updatedKey = d.receiptApprovalKey(r);
  assert.notEqual(updatedKey, reviewedKey);
  d.setLocked(db, 'u_maya', c.id, true, T0, updatedKey);
  const beforeStaleKey = JSON.parse(JSON.stringify(db));
  assert.throws(() => d.setLocked(db, 'u_henry', c.id, true, T0, reviewedKey), error => {
    assert(error instanceof d.StaleStateError);
    assert.equal(error.message, 'The receipt changed. Review your items before locking them.');
    return true;
  });
  assert.deepEqual(db, beforeStaleKey);
  d.setLocked(db, 'u_henry', c.id, true, T0, updatedKey);
  assert.equal(c.status, 'settled');
  assert.deepEqual(d.currentProposal(c).shares, {u_henry: 780, u_maya: 520});
  assert.deepEqual(bal(g), [9220, 9480]);
}

// A failed debt recovery reduces the cash available for every member's withdrawals.
{
  const db = seed(T0);
  const g = d.createGroup(db, 'u_henry', {name: 'Debt-backed balance', inviteIds: ['u_maya'], budget: 20000, periodDays: 30}, T0);
  d.respondInvite(db, 'u_maya', g.id, true, T0, d.shares(g)['u_maya']);
  d.addToWallet(db, 'u_henry', d.cardFor(db, g.id, 'u_henry')!.id, 'Apple Wallet');
  d.setFailTopUps(db, 'u_maya', g.id, true);
  const c = d.purchase(db, 'u_henry', g.id, {merchant: 'Shared debt', amount: 15000}, T0);
  d.proposeSplit(db, 'u_henry', c.id, {method: 'amount', amounts: {u_henry: 0, u_maya: 15000}}, T0);
  d.acceptSplit(db, 'u_maya', c.id, T0, d.currentProposal(c).id);
  assert.deepEqual(bal(g), [10000, -5000]);
  assert.equal(d.availableFunds(db, g), 5000);

  const before = JSON.parse(JSON.stringify(db));
  throws(() => d.withdraw(db, 'u_henry', g.id, 5001, T0), /withdraw up to \$50\.00/);
  assert.deepEqual(db, before);
  d.withdraw(db, 'u_henry', g.id, 5000, T0);
  assert.deepEqual(bal(g), [5000, -5000]);
  assert.equal(d.availableFunds(db, g), 0);
  throws(() => d.withdraw(db, 'u_henry', g.id, 1, T0), /withdraw up to \$0\.00/);

  d.setFailTopUps(db, 'u_maya', g.id, false);
  d.deposit(db, 'u_maya', g.id, 5000, T0);
  assert.equal(d.availableFunds(db, g), 5000);
  d.withdraw(db, 'u_henry', g.id, 5000, T0);
  assert.deepEqual(bal(g), [0, 0]);
  assert.equal(d.availableFunds(db, g), 0);
}

// Joining deposits only the amount the invitee reviewed, including after another invitee declines.
{
  const db = seed(T0);
  const g = d.createGroup(db, 'u_henry', {name: 'Reviewed deposit', inviteIds: ['u_maya', 'u_jordan'], budget: 30000, periodDays: 7}, T0);
  const reviewed = d.shares(g).u_maya;
  assert.equal(reviewed, 10000);
  const beforeMissing = JSON.parse(JSON.stringify(db));
  assert.throws(() => d.respondInvite(db, 'u_maya', g.id, true, T0), error => error instanceof d.StaleStateError);
  assert.deepEqual(db, beforeMissing, 'missing deposit consent cannot change membership, balances, cards, ledger, or IDs');

  d.respondInvite(db, 'u_jordan', g.id, false, T0); // Declining needs no reviewed deposit.
  assert.equal(d.shares(g).u_maya, 15000);
  const beforeStale = JSON.parse(JSON.stringify(db));
  assert.throws(() => d.respondInvite(db, 'u_maya', g.id, true, T0, reviewed), error => error instanceof d.StaleStateError);
  assert.deepEqual(db, beforeStale, 'the old $100 consent cannot authorize a $150 deposit');
  assert.equal(d.memberOf(g, 'u_maya').status, 'invited');
  assert.equal(d.cardFor(db, g.id, 'u_maya'), null);

  d.respondInvite(db, 'u_maya', g.id, true, T0, 15000);
  assert.equal(d.memberOf(g, 'u_maya').status, 'joined');
  assert.equal(d.memberOf(g, 'u_maya').balance, 15000);
  assert.equal(db.cards.filter(c => c.groupId === g.id && c.userId === 'u_maya').length, 1);
  assert.deepEqual(db.ledger.filter(e => e.groupId === g.id && e.userId === 'u_maya').map(e => [e.kind, e.amount]), [['deposit', 15000]]);
  const joined = JSON.parse(JSON.stringify(db));
  throws(() => d.respondInvite(db, 'u_maya', g.id, true, T0, 15000), /already joined/);
  assert.deepEqual(db, joined, 'retrying a completed join cannot deposit twice');
}

// A group left with one member cannot collect a larger refill after everyone else declines.
for (const bankDeclines of [false, true]) {
  const db = seed(T0);
  const g = d.createGroup(db, 'u_henry', {name: 'Unaccepted group', inviteIds: ['u_maya', 'u_jordan'], budget: 30000, periodDays: 1}, T0);
  d.respondInvite(db, 'u_maya', g.id, false, T0);
  d.respondInvite(db, 'u_jordan', g.id, false, T0);
  d.setFailTopUps(db, 'u_henry', g.id, bankDeclines);
  const ledger = db.ledger.filter(e => e.groupId === g.id);
  d.rollPeriods(db, T0 + 2 * d.DAY);
  assert.equal(g.periodStart, T0 + 2 * d.DAY, 'inactive groups still advance their period');
  assert.equal(d.isActive(g), false);
  assert.deepEqual(bal(g), [10000]);
  assert.equal(d.memberOf(g, 'u_henry').fundedPeriod, T0);
  assert.deepEqual(db.ledger.filter(e => e.groupId === g.id), ledger, 'no refill or failed bank attempt occurs while inactive');
}

// Waiting for a final invite preserves funded balances without collecting from short members.
{
  const db = seed(T0);
  const g = d.createGroup(db, 'u_henry', {name: 'Waiting across periods', inviteIds: ['u_maya', 'u_jordan'], budget: 30000, periodDays: 1}, T0);
  d.respondInvite(db, 'u_maya', g.id, true, T0, 10000);
  d.withdraw(db, 'u_henry', g.id, 2000, T0);
  const ledger = db.ledger.filter(e => e.groupId === g.id);
  d.rollPeriods(db, T0 + d.DAY);
  assert.equal(g.periodStart, T0 + d.DAY);
  assert.deepEqual(bal(g), [8000, 10000, 0]);
  assert.equal(d.standing(g, 'u_henry'), 'restricted');
  assert.equal(d.standing(g, 'u_maya'), 'on-track', 'a sufficient balance still funds the current period');
  assert.equal(d.memberOf(g, 'u_jordan').fundedPeriod, null);
  assert.deepEqual(db.ledger.filter(e => e.groupId === g.id), ledger);

  d.respondInvite(db, 'u_jordan', g.id, true, T0 + d.DAY, 10000);
  assert.equal(d.isActive(g), true);
  assert.equal(d.standing(g, 'u_maya'), 'on-track');
  d.rollPeriods(db, T0 + 2 * d.DAY);
  assert.deepEqual(bal(g), [10000, 10000, 10000]);
  assert(g.members.every(m => m.fundedPeriod === g.periodStart));
  assert.deepEqual(db.ledger.filter(e => e.groupId === g.id && e.kind === 'period-top-up').map(e => [e.userId, e.amount]), [['u_henry', 2000]]);
}

// Approved budgets change the next period's target, including for groups saved before periodBudget existed.
for (const legacy of [false, true]) {
  const db = seed(T0);
  const g = d.createGroup(db, 'u_henry', {name: 'Budget timing', inviteIds: ['u_maya'], budget: 20000, periodDays: 1}, T0);
  assert.equal(g.periodBudget, 20000);
  d.respondInvite(db, 'u_maya', g.id, true, T0, 10000);
  d.setAutoDeposit(db, 'u_maya', g.id, false);
  d.withdraw(db, 'u_maya', g.id, 10000, T0);
  d.rollPeriods(db, T0 + d.DAY);
  if (legacy) delete g.periodBudget; // Simulate a previously persisted group without the optional field.
  assert.deepEqual(d.periodShares(g), {u_henry: 10000, u_maya: 10000});
  assert.equal(d.standing(g, 'u_maya'), 'restricted');

  const ledgerBeforeRaise = db.ledger.filter(e => e.groupId === g.id);
  d.proposeBudget(db, 'u_henry', g.id, 40000, T0 + d.DAY);
  assert.equal(g.budget, 20000, 'a proposal alone does not change the budget');
  d.respondBudget(db, 'u_maya', d.openBudgetProposal(db, g.id)!.id, true);
  assert.equal(g.periodBudget, 20000, 'capture the old budget before changing a legacy group');
  assert.equal(g.budget, 40000);
  assert.deepEqual(d.periodShares(g), {u_henry: 10000, u_maya: 10000});
  assert.deepEqual(d.shares(g), {u_henry: 20000, u_maya: 20000}, 'next-period refill uses the approved budget');
  assert.deepEqual(bal(g), [10000, 0]);
  assert.deepEqual(db.ledger.filter(e => e.groupId === g.id), ledgerBeforeRaise);
  assert.match(d.purchaseBlocker(db, g.id, 'u_maya')!, /Add your \$100\.00 share/);
  d.deposit(db, 'u_maya', g.id, 6000, T0 + d.DAY);
  assert.equal(d.standing(g, 'u_maya'), 'restricted');
  d.deposit(db, 'u_maya', g.id, 4000, T0 + d.DAY);
  assert.equal(d.standing(g, 'u_maya'), 'on-track', 'adding this period’s $100 share restores pooled spending');
  assert.equal(d.spendLimit(db, g.id, 'u_maya'), 20000);

  d.proposeBudget(db, 'u_henry', g.id, 60000, T0 + d.DAY);
  d.respondBudget(db, 'u_maya', d.openBudgetProposal(db, g.id)!.id, true);
  assert.equal(g.periodBudget, 20000, 'another approval cannot overwrite the current-period snapshot');
  assert.equal(g.budget, 60000);
  d.rollPeriods(db, T0 + 2 * d.DAY);
  assert.equal(g.periodBudget, 60000);
  assert.deepEqual(d.periodShares(g), {u_henry: 30000, u_maya: 30000});
  assert.deepEqual(bal(g), [30000, 10000]);
  assert.equal(d.standing(g, 'u_henry'), 'on-track');
  assert.equal(d.standing(g, 'u_maya'), 'restricted', 'manual refill now requires the new target');
  assert.deepEqual(db.ledger.filter(e => e.groupId === g.id && e.kind === 'period-top-up').map(e => [e.userId, e.amount]), [['u_henry', 20000]]);

  const ledgerBeforeCut = db.ledger.filter(e => e.groupId === g.id);
  d.proposeBudget(db, 'u_henry', g.id, 20000, T0 + 2 * d.DAY);
  d.respondBudget(db, 'u_maya', d.openBudgetProposal(db, g.id)!.id, true);
  assert.equal(g.periodBudget, 60000);
  assert.deepEqual(d.shares(g), {u_henry: 10000, u_maya: 10000});
  assert.deepEqual(bal(g), [30000, 10000]);
  assert.deepEqual(db.ledger.filter(e => e.groupId === g.id), ledgerBeforeCut, 'approving a cut does not refund or collect money');
  d.deposit(db, 'u_maya', g.id, 5000, T0 + 2 * d.DAY);
  assert.equal(d.standing(g, 'u_maya'), 'restricted', 'a future cut cannot reduce this period’s funding requirement');
  const ledgerBeforeRollover = db.ledger.filter(e => e.groupId === g.id);
  d.rollPeriods(db, T0 + 3 * d.DAY);
  assert.equal(g.periodBudget, 20000);
  assert.deepEqual(d.periodShares(g), {u_henry: 10000, u_maya: 10000});
  assert.deepEqual(bal(g), [30000, 15000], 'the lower target preserves surplus balances');
  assert(g.members.every(m => m.fundedPeriod === g.periodStart));
  assert.deepEqual(db.ledger.filter(e => e.groupId === g.id), ledgerBeforeRollover, 'balances already above the lower target need no refill');
}

console.log('PASS domain: invite search, reviewed invitation deposits, invites accept/decline with valid defaults, invalid-purchase atomicity, withdraw lock and pooled-fund cap, unfunded-share restriction, debt recovery + suspension, cardholder first proposal + notifications, reviewed-proposal acceptance, optional single-open-charge lock with held funds, active-only period refills, current and next-period budget targets, receipt consent invalidation, disputed reservations, frozen withdrawals, chargeback without duplicate settlement.');
