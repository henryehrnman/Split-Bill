import assert from 'node:assert/strict';
import test from 'node:test';
import {availableFunds, openCharges} from '../src/lib/domain.ts';
import type {GroupSpendingView} from '../src/lib/domain.ts';
import {seed} from '../src/lib/seed.ts';
import {groupSpendingView} from '../src/lib/spendingView.ts';

const T0 = Date.UTC(2026, 9, 17, 18);
const heldView: GroupSpendingView = {
  availableFunds: 5370,
  spendLimit: 5370,
  purchaseBlocker: null,
  pendingCount: 1,
  withdrawalBlocked: true,
};

test('a private draft keeps its server hold even though the visible charges imply more funds', () => {
  const db = seed(T0);
  const group = db.groups[0];
  const pending = openCharges(db, group.id)[0];
  pending.sentAt = null;
  db.charges = db.charges.filter(c => c.sentAt !== null || c.cardholderId === 'u_henry');
  db.spendingView = {viewerId: 'u_henry', groups: {[group.id]: heldView}};
  const before = JSON.stringify(db);

  assert.equal(openCharges(db, group.id).length, 0);
  assert.equal(availableFunds(db, group), 20790, 'filtered charges cannot calculate the private hold');
  assert.deepEqual(groupSpendingView(db, group, 'u_henry', false), heldView);
  assert.equal(JSON.stringify(db), before, 'reading the projection changes no saved state');
});

test('missing, stale-account, and missing-group remote views never fall back to local balances', () => {
  const db = seed(T0);
  const group = db.groups[0];
  assert.equal(groupSpendingView(db, group, 'u_henry', false), null);
  db.spendingView = {viewerId: 'u_maya', groups: {[group.id]: heldView}};
  assert.equal(groupSpendingView(db, group, 'u_henry', false), null);
  db.spendingView.viewerId = 'u_henry';
  assert.deepEqual(groupSpendingView(db, group, 'u_henry', false), heldView);
  assert.equal(groupSpendingView(db, group, 'u_jordan', false), null, 'switching viewers invalidates the prior projection');
  assert.equal(groupSpendingView(db, db.groups[1], 'u_henry', false), null);
  db.spendingView = {viewerId: 'u_connor', groups: {[group.id]: heldView}};
  assert.equal(groupSpendingView(db, group, 'u_connor', false), null, 'an unrelated group cannot use an attached projection');
});

test('an incomplete or malformed remote projection is unavailable', () => {
  const db = seed(T0);
  const group = db.groups[0];
  for (const broken of [{}, {...heldView, pendingCount: -1}, {...heldView, availableFunds: NaN},
    {...heldView, spendLimit: '5370'}, {...heldView, purchaseBlocker: undefined}, {...heldView, withdrawalBlocked: undefined}]) {
    db.spendingView = {viewerId: 'u_henry', groups: {[group.id]: broken as GroupSpendingView}};
    assert.equal(groupSpendingView(db, group, 'u_henry', false), null);
  }
});

test('demo switching calculates each member’s real buying power and ignores attached remote views', () => {
  const db = seed(T0);
  const group = db.groups[0];
  db.spendingView = {viewerId: 'u_henry', groups: {[group.id]: {...heldView, spendLimit: 1}}};
  const before = JSON.stringify(db);
  const funded = groupSpendingView(db, group, 'u_henry', true)!;
  const belowTarget = groupSpendingView(db, group, 'u_jordan', true)!;

  assert.equal(funded.spendLimit, 5370);
  assert.equal(funded.purchaseBlocker, null, 'multiple open charges may be allowed without releasing holds');
  assert.equal(funded.pendingCount, 1);
  assert.equal(funded.withdrawalBlocked, true);
  assert.equal(belowTarget.spendLimit, 5370, 'pending personal shares and missed refills do not restrict pooled spending');
  assert.equal(belowTarget.purchaseBlocker, null);
  assert.equal(groupSpendingView(db, group, 'u_henry', true)!.spendLimit, 5370);
  assert.equal(JSON.stringify(db), before);
});

test('demo withdrawal holds include unsettled disputes but do not count settled chargebacks twice', () => {
  const db = seed(T0);
  const group = db.groups[0];
  const charge = openCharges(db, group.id)[0];
  charge.status = 'disputed';
  assert.equal(groupSpendingView(db, group, 'u_henry', true)!.pendingCount, 0);
  assert.equal(groupSpendingView(db, group, 'u_henry', true)!.withdrawalBlocked, true);
  assert.equal(groupSpendingView(db, group, 'u_henry', true)!.availableFunds, 5370);
  charge.settledAt = 0;
  assert.equal(groupSpendingView(db, group, 'u_henry', true)!.withdrawalBlocked, false);
  assert.equal(groupSpendingView(db, group, 'u_henry', true)!.availableFunds, 20790);
  group.frozen = {reason: 'Chargeback under review', at: T0};
  assert.equal(groupSpendingView(db, group, 'u_henry', true)!.withdrawalBlocked, true);
});

test('demo invited and suspended members keep their existing spending restrictions', () => {
  const db = seed(T0);
  const invited = groupSpendingView(db, db.groups[1], 'u_henry', true)!;
  assert.equal(invited.spendLimit, 0);
  assert.equal(invited.withdrawalBlocked, true);
  assert.match(invited.purchaseBlocker!, /accept or decline their invite/);
  const group = db.groups[0];
  group.members.find(m => m.userId === 'u_henry')!.balance = -1;
  const suspended = groupSpendingView(db, group, 'u_henry', true)!;
  assert.equal(suspended.spendLimit, 0);
  assert.match(suspended.purchaseBlocker!, /suspended/);
});
