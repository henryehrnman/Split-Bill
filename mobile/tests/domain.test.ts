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
  assert.equal(d.standing(apt, 'u_jordan'), 'on-track');
  // Pending liability and a missed refill do not cap a nonnegative member's pooled spending.
  assert.equal(d.spendLimit(db, apt.id, 'u_jordan'), 5370);
  assert.equal(d.availableFunds(db, apt), 8000 + 8000 + 4790 - 15420);
  assert.equal('singleOpenCharge' in apt, false);
  assert.equal(d.standing(apt, 'u_henry'), 'on-track');
  assert.equal(d.pendingCharge(db, apt.id)?.merchant, 'Juniper');
  assert.equal(d.periodSpend(db, apt, 'u_henry'), 2000);
  assert.equal(d.isActive(ski), false);
  assert.equal(d.standing(ski, 'u_henry'), 'invited');
  assert.deepEqual(bal(ski), [0, 0, 0]);
  assert.equal(ski.activatedAt, null);
}

const db = seed(T0);
Object.assign(db, {groups: [], cards: [], charges: [], budgetProposals: [], ledger: [], notifications: []});

// Invite search by handle, email or phone.
assert.deepEqual(d.searchUsers(db, '@maya', ['u_henry']).map(u => u.id), ['u_maya']);
assert.deepEqual(d.searchUsers(db, '555-0177', []).map(u => u.id), ['u_jordan']);
assert.equal(d.searchUsers(db, 'example.com', ['u_henry']).length, 4);

// Formation and early joining move no money; activation collects the final equal shares.
throws(() => d.createGroup(db, 'u_henry', {name: 'Solo', inviteIds: [], budget: 30000, periodDays: 14}, T0), /Invite at least one/);
const g = d.createGroup(db, 'u_henry', {name: 'Trip', inviteIds: ['u_maya', 'u_jordan', 'u_connor'], budget: 30000, periodDays: 14, initialContributionLimit: 15000}, T0);
assert.deepEqual(bal(g), [0, 0, 0, 0]);
assert.equal(db.ledger.length, 0);
assert.equal(g.activatedAt, null);
throws(() => d.purchase(db, 'u_henry', g.id, {merchant: 'X', amount: 100}, T0), /accept or decline/);
throws(() => d.deposit(db, 'u_henry', g.id, 100, T0), /accepted or declined/);
throws(() => d.deposit(db, 'u_maya', g.id, 100, T0), /Accept the invite/);
d.setDefaultSplit(db, 'u_henry', g.id, {method: 'percent', percents: {u_henry: 40, u_maya: 30, u_jordan: 20, u_connor: 10}});
d.respondInvite(db, 'u_connor', g.id, false, T0);
assert.deepEqual(d.shares(g), {u_henry: 10000, u_maya: 10000, u_jordan: 10000});
assert.deepEqual(g.defaultSplit, {method: 'equal'});
d.respondInvite(db, 'u_maya', g.id, true, T0, d.shares(g)['u_maya']);
d.setFailTopUps(db, 'u_jordan', g.id, true);
d.respondInvite(db, 'u_jordan', g.id, true, T0, d.shares(g)['u_jordan']);
assert.deepEqual(bal(g), [10000, 10000, 0]);
assert.equal(db.ledger.filter(e => e.kind === 'deposit').length, 2);
assert.deepEqual(db.ledger.filter(e => e.kind === 'deposit-failed').map(e => [e.userId, e.amount]), [['u_jordan', 10000]]);
assert.equal(g.activatedAt, T0);
throws(() => d.deposit(db, 'u_jordan', g.id, 10000, T0), /declined/);
d.setFailTopUps(db, 'u_jordan', g.id, false);
d.withdraw(db, 'u_henry', g.id, 2500, T0);
d.deposit(db, 'u_jordan', g.id, 10000, T0);
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

// Pending purchases reserve pooled funds; withdrawals remain locked while a split is pending.
const dinner = d.purchase(db, 'u_maya', g.id, {merchant: 'Dinner', amount: 9001}, T0);
assert.deepEqual(d.currentProposal(dinner).shares, {u_henry: 3001, u_maya: 3000, u_jordan: 3000});
assert.equal(d.purchaseBlocker(db, g.id, 'u_henry'), null);
assert.equal(d.spendLimit(db, g.id, 'u_henry'), 18499);
throws(() => d.withdraw(db, 'u_henry', g.id, 100, T0), /all pending splits/);

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

// Amount proposal; a negative balance is charged back to $0, restoring access to pooled funds.
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
assert.equal(d.standing(g, 'u_jordan'), 'on-track');
assert.equal(d.purchaseBlocker(db, g.id, 'u_jordan'), null);
assert.equal(d.spendLimit(db, g.id, 'u_jordan'), 20000, 'repaying to zero restores pooled spending without a period refill');

// A partial deposit increases the pool without imposing a personal spending limit.
d.deposit(db, 'u_jordan', g.id, 3000, T0 + 14 * d.DAY);
assert.equal(d.spendLimit(db, g.id, 'u_jordan'), 23000);
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

// Several charges can always be open; each is held once against the pooled fund.
const t3 = t2 + d.DAY;
const free = d.fundBalance(g) - 3000;
assert.equal(d.availableFunds(db, g), free);
d.purchase(db, 'u_maya', g.id, {merchant: 'Gas', amount: 1500}, t3);
assert.deepEqual(d.openCharges(db, g.id).map(c => c.merchant), ['Lunch', 'Gas']);
assert.equal(d.availableFunds(db, g), free - 1500);
throws(() => d.purchase(db, 'u_henry', g.id, {merchant: 'TV', amount: free - 1500 + 1}, t3), /only has/);
throws(() => d.withdraw(db, 'u_henry', g.id, 100, t3), /once the Lunch split/);
assert.equal(d.standing(g, 'u_jordan'), 'on-track');
d.deposit(db, 'u_jordan', g.id, 2000, t3);
assert.equal(d.spendLimit(db, g.id, 'u_jordan'), free + 500);
d.purchase(db, 'u_jordan', g.id, {merchant: 'Pizza', amount: 600}, t3);
assert.equal(d.availableFunds(db, g), free - 100);

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
  const proposal = JSON.parse(JSON.stringify(d.currentProposal(c)));
  const assertSpend = () => {
    assert.deepEqual(d.spendSummary(db, g.id, 0), {month: 1000, total: 1000, count: 1});
    for (const userId of ['u_henry', 'u_maya']) {
      assert.deepEqual(d.spendSummary(db, g.id, 0, userId), {month: 500, total: 500, count: 1});
      assert.equal(d.periodSpend(db, g, userId), 500);
    }
    assert.equal(db.ledger.filter(e => e.groupId === g.id && e.kind === 'charge').reduce((sum, e) => sum - e.amount, 0), 1000);
  };
  assertSpend();
  delete c.settledAt; // Old settled records still count by status even without the optional timestamp.
  assertSpend();
  c.settledAt = 0;
  d.fileChargeback(db, 'u_henry', c.id, 1);
  assertSpend();
  assert.equal(d.reservedFunds(db, g.id), 0);
  assert.equal(d.availableFunds(db, g), 19000);
  throws(() => d.withdraw(db, 'u_henry', g.id, 100, 1), /frozen/);
  d.resolveDisputes(db, g.id, 2);
  assert.equal(g.frozen, null);
  assert.equal(c.status, 'settled');
  assert.equal(c.settledAt, 0);
  assert.equal(c.dispute!.at, 2);
  assert.deepEqual(d.currentProposal(c), proposal);
  assert.deepEqual(bal(g), balances);
  assert.deepEqual(db.ledger, ledger);
  assertSpend();
  d.withdraw(db, 'u_henry', g.id, 100, 3);
  assert.equal(d.memberOf(g, 'u_henry').balance, 9400);
}

// Support clears a completed chargeback and settles a deadline dispute without repeating old debits or recovery.
{
  const db = seed(T0);
  const g = d.createGroup(db, 'u_henry', {name: 'Mixed dispute resolution', inviteIds: ['u_maya'], budget: 20000, periodDays: 30}, T0);
  d.respondInvite(db, 'u_maya', g.id, true, T0, 10000);
  d.addToWallet(db, 'u_henry', d.cardFor(db, g.id, 'u_henry')!.id, 'Apple Wallet');
  const completed = d.purchase(db, 'u_henry', g.id, {merchant: 'Already paid', amount: 15000}, T0);
  d.proposeSplit(db, 'u_henry', completed.id, {method: 'amount', amounts: {u_henry: 15000, u_maya: 0}}, T0);
  assert.equal(completed.status, 'settled');
  const proposal = JSON.parse(JSON.stringify(d.currentProposal(completed)));
  const oldLedger = db.ledger.filter(e => e.chargeId === completed.id).map(e => ({...e}));
  const oldRecovery = db.ledger.filter(e => e.groupId === g.id && e.kind === 'debt-recovery').map(e => ({...e}));
  assert.deepEqual(oldRecovery.map(e => e.amount), [5000]);
  const late = d.purchase(db, 'u_henry', g.id, {merchant: 'Still unagreed', amount: 6000}, T0 + 1);
  d.sendDefaultSplit(db, 'u_henry', late.id, T0 + 1);
  d.fileChargeback(db, 'u_maya', completed.id, T0 + 2);
  const resolvedAt = T0 + d.SPLIT_DEADLINE + 2;
  d.enforceDeadlines(db, resolvedAt);
  assert.equal(late.status, 'disputed');
  assert.equal(late.settledAt, undefined);
  assert.equal(d.reservedFunds(db, g.id), 6000);
  assert.deepEqual(d.spendSummary(db, g.id, resolvedAt), {month: 15000, total: 15000, count: 1});
  assert.equal(d.periodSpend(db, g, 'u_henry'), 15000);
  assert.equal(d.periodSpend(db, g, 'u_maya'), 0);

  d.resolveDisputes(db, g.id, resolvedAt);
  assert.equal(completed.status, 'settled');
  assert.equal(completed.settledAt, T0);
  assert.deepEqual(d.currentProposal(completed), proposal);
  assert.deepEqual(db.ledger.filter(e => e.chargeId === completed.id), oldLedger);
  const recoveries = db.ledger.filter(e => e.groupId === g.id && e.kind === 'debt-recovery');
  assert.deepEqual(recoveries.filter(e => oldRecovery.some(old => old.id === e.id)), oldRecovery);
  assert.deepEqual(recoveries.map(e => e.amount), [3000, 5000]);
  assert.equal(late.status, 'settled');
  assert.equal(late.settledAt, resolvedAt);
  assert.deepEqual(d.waitingOn(d.currentProposal(late)), []);
  assert.equal(db.ledger.filter(e => e.chargeId === late.id && e.kind === 'charge').length, 2);
  assert.deepEqual(bal(g), [0, 7000]);
  assert.equal(d.reservedFunds(db, g.id), 0);
  assert.equal(g.frozen, null);
  assert.deepEqual(d.spendSummary(db, g.id, resolvedAt), {month: 21000, total: 21000, count: 2});
  assert.equal(d.periodSpend(db, g, 'u_henry'), 18000);
  assert.equal(d.periodSpend(db, g, 'u_maya'), 3000);
  assert.equal(db.ledger.filter(e => e.groupId === g.id && e.kind === 'charge').reduce((sum, e) => sum - e.amount, 0), 21000);
  const resolved = JSON.parse(JSON.stringify(db));
  throws(() => d.resolveDisputes(db, g.id, resolvedAt + 1), /isn’t frozen/);
  assert.deepEqual(db, resolved, 'repeating resolution cannot debit or recover debt twice');
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

// Zero balance can use pooled funds even with pending liability; only settled negative debt blocks spending.
{
  const db = seed(T0);
  const g = d.createGroup(db, 'u_henry', {name: 'Pooled spending', inviteIds: ['u_maya'], budget: 20000, periodDays: 1}, T0);
  d.respondInvite(db, 'u_maya', g.id, true, T0, 10000);
  for (const id of ['u_henry', 'u_maya']) d.addToWallet(db, id, d.cardFor(db, g.id, id)!.id, 'Apple Wallet');
  d.withdraw(db, 'u_maya', g.id, 10000, T0);
  d.setAutoDeposit(db, 'u_maya', g.id, false);
  const now = T0 + d.DAY;
  d.rollPeriods(db, now);
  const maya = d.memberOf(g, 'u_maya');
  assert.equal(maya.balance, 0);
  assert.notEqual(maya.fundedPeriod, g.periodStart);
  // Old saved flags cannot reintroduce either removed purchase restriction.
  Object.assign(g, {singleOpenCharge: true});
  maya.suspended = true;
  assert.equal(d.standing(g, 'u_maya'), 'on-track');
  assert.equal(d.spendLimit(db, g.id, 'u_maya'), 10000);

  const first = d.purchase(db, 'u_henry', g.id, {merchant: 'Private cafe', amount: 4000}, now);
  assert.equal(d.currentProposal(first).shares.u_maya, 2000);
  assert.equal(d.spendLimit(db, g.id, 'u_maya'), 6000, 'pending liability above her zero balance is not settled debt');
  assert.equal(d.purchaseBlocker(db, g.id, 'u_maya'), null);
  throws(() => d.withdraw(db, 'u_maya', g.id, 1, now), /^You can withdraw once all pending splits are settled\.$/);
  const beforeTooLarge = JSON.parse(JSON.stringify(db));
  throws(() => d.purchase(db, 'u_maya', g.id, {merchant: 'Too large', amount: 6001}, now), /only has \$60\.00/);
  assert.deepEqual(db, beforeTooLarge);
  d.purchase(db, 'u_maya', g.id, {merchant: 'Use remaining pool', amount: 6000}, now);
  assert.equal(d.openCharges(db, g.id).length, 2);
  assert.equal(d.reservedFunds(db, g.id), 10000);
  assert.equal(d.availableFunds(db, g), 0);
  const beforeEmpty = JSON.parse(JSON.stringify(db));
  throws(() => d.purchase(db, 'u_maya', g.id, {merchant: 'Nothing left', amount: 1}, now), /held for splits/);
  assert.deepEqual(db, beforeEmpty);

  d.setFailTopUps(db, 'u_maya', g.id, true);
  d.proposeSplit(db, 'u_henry', first.id, {method: 'amount', amounts: {u_henry: 0, u_maya: 4000}}, now);
  d.acceptSplit(db, 'u_maya', first.id, now, d.currentProposal(first).id);
  assert.equal(maya.balance, -4000);
  d.deposit(db, 'u_henry', g.id, 1000, now);
  assert.equal(d.availableFunds(db, g), 1000);
  maya.suspended = false; // A missing legacy flag cannot conceal actual negative debt.
  assert.equal(d.standing(g, 'u_maya'), 'suspended');
  assert.equal(d.spendLimit(db, g.id, 'u_maya'), 0);
  const beforeDebtPurchase = JSON.parse(JSON.stringify(db));
  throws(() => d.purchase(db, 'u_maya', g.id, {merchant: 'While negative', amount: 1}, now), /suspended/);
  assert.deepEqual(db, beforeDebtPurchase);
  d.setFailTopUps(db, 'u_maya', g.id, false);
  d.deposit(db, 'u_maya', g.id, 3999, now);
  assert.equal(d.spendLimit(db, g.id, 'u_maya'), 0, 'even one cent of settled debt blocks spending');
  d.deposit(db, 'u_maya', g.id, 1, now);
  assert.equal(maya.balance, 0);
  assert.equal(d.standing(g, 'u_maya'), 'on-track');
  assert.equal(d.spendLimit(db, g.id, 'u_maya'), 5000);
  d.purchase(db, 'u_maya', g.id, {merchant: 'Repaid', amount: 1}, now);
}

// The budget sets refill targets; surplus pooled funds remain spendable, including after a budget cut.
for (const reduceBudget of [false, true]) {
  const db = seed(T0);
  const g = d.createGroup(db, 'u_henry', {name: 'Surplus spending', inviteIds: ['u_maya'], budget: 30000, periodDays: 1}, T0);
  d.respondInvite(db, 'u_maya', g.id, true, T0, 15000);
  for (const id of ['u_henry', 'u_maya']) d.addToWallet(db, id, d.cardFor(db, g.id, id)!.id, 'Apple Wallet');
  d.deposit(db, 'u_henry', g.id, 20000, T0);
  let now = T0;
  if (reduceBudget) {
    d.proposeBudget(db, 'u_henry', g.id, 10000, T0);
    d.respondBudget(db, 'u_maya', d.openBudgetProposal(db, g.id)!.id, true);
    now += d.DAY;
    d.rollPeriods(db, now);
    assert.equal(g.periodBudget, 10000);
    assert.deepEqual(bal(g), [35000, 15000], 'a lower refill target preserves surplus balances');
  }
  assert.equal(d.spendLimit(db, g.id, 'u_maya'), 50000);
  d.purchase(db, 'u_maya', g.id, {merchant: 'Larger than the budget', amount: 40000}, now);
  assert.equal(d.reservedFunds(db, g.id), 40000);
  assert.equal(d.spendLimit(db, g.id, 'u_henry'), 10000);
  const before = JSON.parse(JSON.stringify(db));
  throws(() => d.purchase(db, 'u_henry', g.id, {merchant: 'Beyond the remainder', amount: 10001}, now), /only has \$100\.00/);
  assert.deepEqual(db, before);
  d.purchase(db, 'u_henry', g.id, {merchant: 'Remaining funds', amount: 10000}, now);
  assert.equal(d.openCharges(db, g.id).length, 2);
  assert.equal(d.reservedFunds(db, g.id), 50000);
  assert.equal(d.availableFunds(db, g), 0);
}

// Joining still requires the current reviewed estimate, even though collection waits for activation.
{
  const db = seed(T0);
  const g = d.createGroup(db, 'u_henry', {name: 'Reviewed invitation', inviteIds: ['u_maya', 'u_jordan'], budget: 30000, periodDays: 7}, T0);
  const reviewed = d.shares(g).u_maya;
  assert.equal(reviewed, 10000);
  const beforeMissing = JSON.parse(JSON.stringify(db));
  assert.throws(() => d.respondInvite(db, 'u_maya', g.id, true, T0), error => error instanceof d.StaleStateError);
  assert.deepEqual(db, beforeMissing, 'missing reviewed estimate cannot change membership, balances, cards, ledger, or IDs');

  d.respondInvite(db, 'u_jordan', g.id, false, T0); // Declining needs no reviewed estimate.
  assert.equal(d.shares(g).u_maya, 15000);
  const beforeStale = JSON.parse(JSON.stringify(db));
  assert.throws(() => d.respondInvite(db, 'u_maya', g.id, true, T0, reviewed), error => error instanceof d.StaleStateError);
  assert.deepEqual(db, beforeStale, 'a stale $100 estimate cannot accept an invitation now showing $150');
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

// A group left with one member never activates, charges, or advances its period.
for (const bankDeclines of [false, true]) {
  const db = seed(T0);
  const g = d.createGroup(db, 'u_henry', {name: 'Unaccepted group', inviteIds: ['u_maya', 'u_jordan'], budget: 30000, periodDays: 1}, T0);
  d.respondInvite(db, 'u_maya', g.id, false, T0);
  d.respondInvite(db, 'u_jordan', g.id, false, T0);
  d.setFailTopUps(db, 'u_henry', g.id, bankDeclines);
  d.rollPeriods(db, T0 + 2 * d.DAY);
  assert.equal(g.periodStart, T0);
  assert.equal(g.activatedAt, null);
  assert.equal(d.isActive(g), false);
  assert.deepEqual(bal(g), [0]);
  assert.equal(d.memberOf(g, 'u_henry').fundedPeriod, null);
  assert.deepEqual(db.ledger.filter(e => e.groupId === g.id), []);
  throws(() => d.deposit(db, 'u_henry', g.id, 100, T0 + 2 * d.DAY), /accepted or declined/);
}

// Invalid explicit limits fail before changing IDs, membership, balances, or cards.
{
  const db = seed(T0);
  const input = {name: 'Reviewed limits', inviteIds: ['u_maya', 'u_jordan'], budget: 30000, periodDays: 1};
  for (const limit of [9999, 15001, 10000.5, NaN, Infinity, '15000', null]) {
    const before = JSON.parse(JSON.stringify(db));
    throws(() => d.createGroup(db, 'u_henry', {...input, initialContributionLimit: limit as number}, T0), /contribution limit/);
    assert.deepEqual(db, before);
  }
  const g = d.createGroup(db, 'u_henry', input, T0);
  assert.equal(d.memberOf(g, 'u_henry').initialContributionLimit, 10000);
  for (const limit of [9999, 15001, 10000.5, NaN, Infinity, '15000', null]) {
    const before = JSON.parse(JSON.stringify(db));
    throws(() => d.respondInvite(db, 'u_maya', g.id, true, T0, 10000, limit as number), /contribution limit/);
    assert.deepEqual(db, before);
  }
  d.respondInvite(db, 'u_jordan', g.id, false, T0, undefined, NaN); // A decline authorizes no collection from that invitee.
  assert.equal(d.memberOf(g, 'u_maya').status, 'invited');
}

// Older clients authorize only their reviewed estimate; a smaller explicit cap also remains binding.
for (const initialContributionLimit of [undefined, 12000]) {
  const db = seed(T0);
  const g = d.createGroup(db, 'u_henry', {name: 'Capped activation', inviteIds: ['u_maya', 'u_jordan'], budget: 30000, periodDays: 1, initialContributionLimit}, T0);
  d.respondInvite(db, 'u_maya', g.id, true, T0, 10000, initialContributionLimit);
  const limit = initialContributionLimit ?? 10000;
  d.respondInvite(db, 'u_jordan', g.id, false, T0);
  assert.deepEqual(bal(g), [limit, limit]);
  assert(g.members.every(m => m.initialContributionLimit === limit && !m.autoDeposit && m.fundedPeriod === null));
  assert.deepEqual(db.ledger.filter(e => e.groupId === g.id).map(e => [e.kind, e.amount]), [['deposit', limit], ['deposit', limit]]);
  const ledger = db.ledger.filter(e => e.groupId === g.id);
  d.rollPeriods(db, T0 + d.DAY);
  assert.deepEqual(bal(g), [limit, limit]);
  assert.deepEqual(db.ledger.filter(e => e.groupId === g.id), ledger, 'a later refill cannot bypass the initial limit');

  d.deposit(db, 'u_henry', g.id, 15000 - limit, T0 + d.DAY);
  d.setAutoDeposit(db, 'u_maya', g.id, true);
  d.rollPeriods(db, T0 + 2 * d.DAY);
  assert.deepEqual(bal(g), [15000, 15000], 'manual funding and explicit refill opt-in can authorize the remaining amount');
  assert.equal(d.memberOf(g, 'u_henry').autoDeposit, false, 'one manual deposit does not enable future automatic payments');
}

// Final accept or decline starts a fresh period and collects the final roster's shares once within disclosed caps.
for (const finalAccept of [true, false]) {
  const db = seed(T0);
  const g = d.createGroup(db, 'u_henry', {name: 'Waiting across periods', inviteIds: ['u_maya', 'u_jordan'], budget: 30000, periodDays: 1, initialContributionLimit: 15000}, T0);
  d.respondInvite(db, 'u_maya', g.id, true, T0, 10000, 15000);
  assert.deepEqual(bal(g), [0, 0, 0]);
  assert.equal(db.cards.filter(c => c.groupId === g.id).length, 2);
  assert(g.members.every(m => m.autoDeposit));
  assert.equal(d.memberOf(g, 'u_henry').initialContributionLimit, 15000);
  assert.equal(d.memberOf(g, 'u_maya').initialContributionLimit, 15000);
  const activated = T0 + 3 * d.DAY + 123;
  d.rollPeriods(db, activated);
  assert.equal(g.periodStart, T0, 'forming groups do not accrue refill periods');
  assert.equal(g.activatedAt, null);
  assert.deepEqual(db.ledger.filter(e => e.groupId === g.id), []);
  const beforeDeposit = JSON.parse(JSON.stringify(db));
  throws(() => d.deposit(db, 'u_henry', g.id, 100, activated), /accepted or declined/);
  assert.deepEqual(db, beforeDeposit);

  d.respondInvite(db, 'u_jordan', g.id, finalAccept, activated, finalAccept ? 10000 : undefined);
  const target = finalAccept ? 10000 : 15000;
  assert.equal(d.isActive(g), true);
  assert.equal(g.activatedAt, activated);
  assert.equal(g.periodStart, activated);
  assert.deepEqual(bal(g), finalAccept ? [10000, 10000, 10000] : [15000, 15000]);
  assert(g.members.every(m => m.fundedPeriod === activated));
  assert.equal(db.cards.filter(c => c.groupId === g.id).length, g.members.length);
  assert.deepEqual(db.ledger.filter(e => e.groupId === g.id).map(e => [e.kind, e.amount, e.at]), g.members.map(() => ['deposit', target, activated]));
  const activatedLedger = db.ledger.filter(e => e.groupId === g.id);
  throws(() => d.respondInvite(db, 'u_maya', g.id, true, activated, target), /already joined/);
  d.rollPeriods(db, activated);
  assert.deepEqual(db.ledger.filter(e => e.groupId === g.id), activatedLedger, 'activation cannot be charged twice');

  d.withdraw(db, 'u_henry', g.id, 2000, activated);
  d.rollPeriods(db, activated + d.DAY - 1);
  assert.equal(d.memberOf(g, 'u_henry').balance, target - 2000);
  d.rollPeriods(db, activated + d.DAY);
  assert(g.members.every(m => m.balance === target && m.fundedPeriod === g.periodStart));
  assert.deepEqual(db.ledger.filter(e => e.groupId === g.id && e.kind === 'period-top-up').map(e => [e.userId, e.amount]), [['u_henry', 2000]]);
}

// One failed initial collection neither reverses other deposits nor blocks a zero-balance member's card.
{
  const db = seed(T0);
  const g = d.createGroup(db, 'u_henry', {name: 'Initial bank failure', inviteIds: ['u_maya'], budget: 20001, periodDays: 1}, T0);
  d.setFailTopUps(db, 'u_henry', g.id, true);
  d.respondInvite(db, 'u_maya', g.id, true, T0, 10000);
  assert.equal(g.activatedAt, T0);
  assert.deepEqual(bal(g), [0, 10000]);
  assert.equal(d.memberOf(g, 'u_henry').fundedPeriod, null);
  assert.equal(d.memberOf(g, 'u_maya').fundedPeriod, T0);
  assert.deepEqual(db.ledger.filter(e => e.groupId === g.id).map(e => [e.userId, e.kind, e.amount]), [['u_maya', 'deposit', 10000], ['u_henry', 'deposit-failed', 10001]]);
  const collected = db.ledger.filter(e => e.groupId === g.id);
  d.rollPeriods(db, T0 + 1);
  assert.deepEqual(db.ledger.filter(e => e.groupId === g.id), collected, 'a failed collection is not retried on every read');
  d.addToWallet(db, 'u_henry', d.cardFor(db, g.id, 'u_henry')!.id, 'Apple Wallet');
  assert.equal(d.spendLimit(db, g.id, 'u_henry'), 10000);
  d.purchase(db, 'u_henry', g.id, {merchant: 'Pooled purchase', amount: 10000}, T0);
}

// Legacy forming groups retain earlier deposits without debiting members who never reviewed a limit.
for (const finalAccept of [false, true]) {
  const db = seed(T0);
  const g = d.createGroup(db, 'u_henry', {name: 'Legacy formation', inviteIds: finalAccept ? ['u_maya'] : ['u_maya', 'u_jordan'], budget: 30000, periodDays: 1}, T0);
  if (!finalAccept) d.respondInvite(db, 'u_maya', g.id, true, T0, 10000);
  delete g.activatedAt;
  // Hydrate the deposits an older client collected before all invitations were resolved.
  for (const m of g.members.filter(m => m.status === 'joined')) {
    delete m.initialContributionLimit;
    m.balance = 10000;
    m.fundedPeriod = T0;
    db.ledger.push({id: `legacy_${m.userId}`, groupId: g.id, userId: m.userId, kind: 'deposit', amount: 10000, at: T0});
  }
  const cards = db.cards.filter(c => c.groupId === g.id).map(c => ({...c}));
  const activated = T0 + 3 * d.DAY;
  d.rollPeriods(db, activated);
  assert.equal(g.periodStart, T0);
  d.respondInvite(db, finalAccept ? 'u_maya' : 'u_jordan', g.id, finalAccept, activated, finalAccept ? 15000 : undefined);
  assert.equal(g.activatedAt, activated);
  assert.equal(g.periodStart, activated);
  assert.deepEqual(bal(g), finalAccept ? [10000, 15000] : [10000, 10000]);
  assert.equal(d.memberOf(g, 'u_henry').autoDeposit, false);
  assert.deepEqual(db.ledger.filter(e => e.groupId === g.id && e.at === activated).map(e => [e.userId, e.kind, e.amount]), finalAccept
    ? [['u_maya', 'deposit', 15000]]
    : []);
  for (const card of cards) assert.deepEqual(d.cardFor(db, g.id, card.userId), card);
  const ledger = db.ledger.filter(e => e.groupId === g.id);
  d.rollPeriods(db, activated + d.DAY);
  assert.deepEqual(db.ledger.filter(e => e.groupId === g.id), ledger, 'legacy balances cannot be increased later without new consent');
}

// Already active legacy groups keep their current period and balances; reads do not recharge them.
{
  const db = seed(T0);
  const g = db.groups[0];
  delete g.activatedAt;
  for (const m of g.members) delete m.initialContributionLimit;
  const before = JSON.parse(JSON.stringify(db));
  d.tick(db, T0);
  assert.deepEqual(db, before);
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
  assert.equal(d.standing(g, 'u_maya'), 'on-track');

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
  assert.equal(d.spendLimit(db, g.id, 'u_maya'), 10000, 'zero balance can use the pool before any refill');
  d.deposit(db, 'u_maya', g.id, 6000, T0 + d.DAY);
  assert.equal(d.standing(g, 'u_maya'), 'on-track');
  assert.notEqual(d.memberOf(g, 'u_maya').fundedPeriod, g.periodStart);
  d.deposit(db, 'u_maya', g.id, 4000, T0 + d.DAY);
  assert.equal(d.memberOf(g, 'u_maya').fundedPeriod, g.periodStart, 'the current target still determines refill bookkeeping');
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
  assert.equal(d.standing(g, 'u_maya'), 'on-track');
  assert.notEqual(d.memberOf(g, 'u_maya').fundedPeriod, g.periodStart, 'manual refill target changes without restricting spending');
  assert.deepEqual(db.ledger.filter(e => e.groupId === g.id && e.kind === 'period-top-up').map(e => [e.userId, e.amount]), [['u_henry', 20000]]);

  const ledgerBeforeCut = db.ledger.filter(e => e.groupId === g.id);
  d.proposeBudget(db, 'u_henry', g.id, 20000, T0 + 2 * d.DAY);
  d.respondBudget(db, 'u_maya', d.openBudgetProposal(db, g.id)!.id, true);
  assert.equal(g.periodBudget, 60000);
  assert.deepEqual(d.shares(g), {u_henry: 10000, u_maya: 10000});
  assert.deepEqual(bal(g), [30000, 10000]);
  assert.deepEqual(db.ledger.filter(e => e.groupId === g.id), ledgerBeforeCut, 'approving a cut does not refund or collect money');
  d.deposit(db, 'u_maya', g.id, 5000, T0 + 2 * d.DAY);
  assert.notEqual(d.memberOf(g, 'u_maya').fundedPeriod, g.periodStart, 'a future cut cannot change this period’s refill bookkeeping');
  const ledgerBeforeRollover = db.ledger.filter(e => e.groupId === g.id);
  d.rollPeriods(db, T0 + 3 * d.DAY);
  assert.equal(g.periodBudget, 20000);
  assert.deepEqual(d.periodShares(g), {u_henry: 10000, u_maya: 10000});
  assert.deepEqual(bal(g), [30000, 15000], 'the lower target preserves surplus balances');
  assert(g.members.every(m => m.fundedPeriod === g.periodStart));
  assert.deepEqual(db.ledger.filter(e => e.groupId === g.id), ledgerBeforeRollover, 'balances already above the lower target need no refill');
}

// Receipt claims are pending liability, not settled debt: they never impose a personal spending cap.
{
  const db = seed(T0);
  const g = d.createGroup(db, 'u_henry', {name: 'Receipt holds', inviteIds: ['u_maya'], budget: 30000, periodDays: 1}, T0);
  d.respondInvite(db, 'u_maya', g.id, true, T0, 15000);
  for (const id of ['u_henry', 'u_maya']) d.addToWallet(db, id, d.cardFor(db, g.id, id)!.id, 'Apple Wallet');
  d.setAutoDeposit(db, 'u_maya', g.id, false);
  d.withdraw(db, 'u_maya', g.id, 5000, T0);
  const now = T0 + d.DAY;
  d.rollPeriods(db, now);
  assert.equal(d.standing(g, 'u_maya'), 'on-track');
  assert.notEqual(d.memberOf(g, 'u_maya').fundedPeriod, g.periodStart);
  assert.equal(d.memberOf(g, 'u_maya').balance, 10000);

  const c = d.purchase(db, 'u_henry', g.id, {merchant: 'Dinner', amount: 10000}, now);
  assert.equal(d.spendLimit(db, g.id, 'u_maya'), 15000, 'only the full charge reservation reduces available pooled funds');
  const r = d.scanReceipt(db, 'u_henry', c.id, now, {items: [{name: 'Maya meal', amount: 9000}, {name: 'Henry meal', amount: 1000}], tax: 0, tip: 0});
  assert.equal(d.spendLimit(db, g.id, 'u_maya'), 15000, 'an unclaimed receipt does not restrict the nonnegative member');
  assert.equal(d.purchaseBlocker(db, g.id, 'u_maya'), null);
  assert.equal(d.reservedFunds(db, g.id), 10000, 'the group reserves the charge only once');
  assert.equal(d.spendLimit(db, g.id, 'u_henry'), 15000);

  d.toggleClaim(db, 'u_maya', c.id, r.items[0].id);
  assert.equal(d.spendLimit(db, g.id, 'u_maya'), 15000);
  d.toggleClaim(db, 'u_henry', c.id, r.items[1].id);
  d.setLocked(db, 'u_maya', c.id, true, now, d.receiptApprovalKey(r));
  assert.equal(c.status, 'pending');
  assert.equal(d.spendLimit(db, g.id, 'u_maya'), 15000, 'the pending $90 share does not reduce her $150 pooled limit');
  const complete = JSON.parse(JSON.stringify(db));
  throws(() => d.purchase(db, 'u_maya', g.id, {merchant: 'Over the pooled funds', amount: 15001}, now), /only has \$150\.00/);
  assert.deepEqual(db, complete, 'rejected spending cannot add a charge or change the receipt, approvals, balances, or ledger');

  d.updateReceipt(db, 'u_henry', c.id, {items: [{id: r.items[0].id, name: 'Maya meal', amount: 8000}, {id: r.items[1].id, name: 'Henry meal', amount: 2000}], tax: 0, tip: 0});
  assert.deepEqual(r.locked, []);
  assert.equal(d.spendLimit(db, g.id, 'u_maya'), 15000, 'a correction changes consent, not the pooled reservation');
  d.toggleClaim(db, 'u_henry', c.id, r.items[0].id);
  d.toggleClaim(db, 'u_maya', c.id, r.items[0].id);
  assert.equal(d.spendLimit(db, g.id, 'u_maya'), 15000);

  d.proposeSplit(db, 'u_henry', c.id, {method: 'amount', amounts: {u_henry: 7000, u_maya: 3000}}, now);
  assert.equal(c.receipt, null);
  assert.equal(d.spendLimit(db, g.id, 'u_maya'), 15000, 'replacing the receipt does not change the pooled reservation');
  assert.equal(d.reservedFunds(db, g.id), 10000);
  d.purchase(db, 'u_maya', g.id, {merchant: 'Beyond my balance', amount: 15000}, now);
  assert.equal(d.memberOf(g, 'u_maya').balance, 10000, 'authorizing another purchase does not settle her pending shares');
  assert.equal(d.availableFunds(db, g), 0);
}

// Receipt settlement preserves the pooled reservation total and exact tax/tip pennies.
{
  const db = seed(T0);
  const g = d.createGroup(db, 'u_henry', {name: 'Receipt hold pennies', inviteIds: ['u_maya'], budget: 30000, periodDays: 1}, T0);
  d.respondInvite(db, 'u_maya', g.id, true, T0, 15000);
  d.addToWallet(db, 'u_henry', d.cardFor(db, g.id, 'u_henry')!.id, 'Apple Wallet');
  d.setAutoDeposit(db, 'u_maya', g.id, false);
  d.withdraw(db, 'u_maya', g.id, 5000, T0);
  const now = T0 + d.DAY;
  d.rollPeriods(db, now);
  const c = d.purchase(db, 'u_henry', g.id, {merchant: 'Shared meal', amount: 1264}, now);
  const r = d.scanReceipt(db, 'u_henry', c.id, now, {items: [{name: 'Shared', amount: 601}, {name: 'Solo', amount: 400}], tax: 83, tip: 180});
  d.toggleClaim(db, 'u_maya', c.id, r.items[0].id);
  d.toggleClaim(db, 'u_henry', c.id, r.items[0].id);
  d.toggleClaim(db, 'u_maya', c.id, r.items[1].id);
  // Maya: 300 shared + 400 solo + 58 tax + 126 tip = 884 cents, regardless of claim order.
  assert.equal(d.spendLimit(db, g.id, 'u_maya'), 23736);
  assert.equal(d.spendLimit(db, g.id, 'u_henry'), 23736);
  const key = d.receiptApprovalKey(r);
  d.setLocked(db, 'u_maya', c.id, true, now, key);
  d.setLocked(db, 'u_henry', c.id, true, now, key);
  assert.equal(c.status, 'settled');
  assert.deepEqual(d.currentProposal(c).shares, {u_henry: 380, u_maya: 884});
  assert.deepEqual(bal(g), [14620, 9116]);
  assert.equal(d.reservedFunds(db, g.id), 0);
  assert.equal(d.spendLimit(db, g.id, 'u_maya'), 23736, 'settling swaps the group hold for exact debits without changing pooled buying power');
}

// Photo reads: discounts fold into their item, $0 lines drop, and a read that doesn't add up is kept as a draft
// behind a one-line board until the payer fixes it.
{
  const db = seed(T0);
  const c = db.charges.find(x => x.merchant === 'Juniper')!;
  const folded = d.scanReceipt(db, 'u_maya', c.id, T0, {items: [{name: 'Pasta', amount: 9000}, {name: 'Happy hour', amount: -1000}, {name: 'Bread', amount: 0}, {name: 'Wine', amount: 5000}], tax: 1020, tip: 1400});
  assert.equal(folded.itemized, true);
  assert.deepEqual(folded.items.map(i => [i.name, i.amount]), [['Pasta', 8000], ['Wine', 5000]]);
  assert.equal(folded.draft, undefined);

  const off = d.scanReceipt(db, 'u_maya', c.id, T0, {items: [{name: 'Pasta', amount: 9000}, {name: 'Wine', amount: 5000}], tax: 1020, tip: 1300});
  assert.equal(off.itemized, false);
  assert.deepEqual(off.items.map(i => i.amount), [15420], 'the board stays one line while the read is a draft');
  assert.deepEqual(off.draft, {items: [{name: 'Pasta', amount: 9000}, {name: 'Wine', amount: 5000}], tax: 1020, tip: 1300});
  // The server enforces it, not just the Split screen: nobody can claim, lock or suggest on the one-line board while it's a draft.
  const beforeGuards = JSON.stringify(db);
  throws(() => d.toggleClaim(db, 'u_henry', c.id, off.items[0].id), /Fix the receipt first/);
  throws(() => d.setLocked(db, 'u_henry', c.id, true, T0, d.receiptApprovalKey(off)), /Fix the receipt first/);
  throws(() => d.suggestItemEdit(db, 'u_henry', c.id, off.items[0].id, 'u_maya', T0), /Fix the receipt first/);
  assert.equal(JSON.stringify(db), beforeGuards, 'refused draft writes change nothing');
  assert.equal(d.itemBoardStatus(c).ready, false);
  assert.match(db.notifications[0].text, /don’t match the charge yet/);
  throws(() => d.updateReceipt(db, 'u_maya', c.id, {items: [{id: 'a', name: 'Pasta', amount: 9000}, {id: 'b', name: 'Wine', amount: 5000}], tax: 1020, tip: 1300}), /add up to/);
  d.updateReceipt(db, 'u_maya', c.id, {items: [{id: 'a', name: 'Pasta', amount: 9000}, {id: 'b', name: 'Wine', amount: 5000}], tax: 1020, tip: 400});
  assert.equal(c.receipt!.itemized, true);
  assert.equal(c.receipt!.draft, undefined);
  d.toggleClaim(db, 'u_henry', c.id, 'a');
  assert.deepEqual(c.receipt!.items[0].people, ['u_henry'], 'claims open once the saved receipt matches');

  assert.equal(d.scanReceipt(db, 'u_maya', c.id, T0, {items: [{name: 'Refund', amount: -500}], tax: 0, tip: 0}).draft, undefined, 'an unusable read keeps no draft');
  assert.equal(d.scanReceipt(db, 'u_maya', c.id, T0, {items: [], tax: 0, tip: 0}).draft, undefined);
}

// Charge notes are shared context, including on receipts whose shares were already reviewed.
{
  const db = seed(T0);
  const c = db.charges.find(x => x.merchant === 'Juniper')!;
  const g = d.groupById(db, c.groupId);
  const withoutNote = () => JSON.parse(JSON.stringify({...db, charges: db.charges.map(({note: _note, ...charge}) => charge)}));
  const before = withoutNote();
  d.setChargeNote(db, 'u_henry', c.id, '  Dinner\u0000 with friends\n ', T0);
  assert.deepEqual(c.note, {text: 'Dinner with friends', authorId: 'u_henry', at: T0});
  assert.deepEqual(withoutNote(), before);
  d.setChargeNote(db, 'u_jordan', c.id, 'x'.repeat(d.MAX_CHARGE_NOTE_LENGTH), T0 + 1);
  assert.equal(c.note!.authorId, 'u_jordan', 'members with a missed refill can still add context');
  for (const text of [null, undefined, {}, 42, 'x'.repeat(d.MAX_CHARGE_NOTE_LENGTH + 1)]) {
    const unchanged = JSON.parse(JSON.stringify(db));
    // @ts-expect-error Check the runtime RPC boundary as well as typed callers.
    throws(() => d.setChargeNote(db, 'u_henry', c.id, text, T0), /text note|characters/);
    assert.deepEqual(db, unchanged);
  }
  throws(() => d.setChargeNote(db, 'u_connor', c.id, 'Outsider', T0), /not a member/);
  const member = d.memberOf(g, 'u_henry');
  member.status = 'invited';
  throws(() => d.setChargeNote(db, 'u_henry', c.id, 'Invitee', T0), /Accept the invite/);
  member.status = 'joined';

  const receipt = d.scanReceipt(db, 'u_maya', c.id, T0);
  d.toggleClaim(db, 'u_henry', c.id, receipt.items[0].id);
  const key = d.receiptApprovalKey(receipt);
  d.setLocked(db, 'u_henry', c.id, true, T0, key);
  const reviewed = withoutNote();
  d.setChargeNote(db, 'u_maya', c.id, 'Updated context', T0 + 2);
  assert.equal(d.receiptApprovalKey(receipt), key);
  assert.deepEqual(withoutNote(), reviewed, 'receipt claims, locks, funds, and notifications stay unchanged');
  d.setChargeNote(db, 'u_henry', c.id, ' \n\t ', T0 + 3);
  assert.equal(c.note, undefined);
  assert.deepEqual(withoutNote(), reviewed);
}

console.log('PASS domain: invite search, reviewed invitations and once-only activation deposits, invites accept/decline with valid defaults, invalid-purchase atomicity, withdraw lock and pooled-fund cap, nonnegative pooled spending, settled-debt suspension, cardholder first proposal + notifications, reviewed-proposal acceptance, multiple open charges with pooled reservations, active-only period refills, current and next-period budget targets, receipt consent invalidation, disputed reservations, frozen withdrawals, chargeback without duplicate settlement, shared charge notes without financial changes.');
