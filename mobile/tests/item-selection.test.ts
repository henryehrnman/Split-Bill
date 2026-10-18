import assert from 'node:assert/strict';
import * as d from '../src/lib/domain.ts';
import {computeSplit, receiptItemAllocations} from '../src/lib/split.ts';
import {seed} from '../src/lib/seed.ts';

const T = Date.UTC(2026, 9, 17, 18);
const H = 'u_henry', M = 'u_maya', J = 'u_jordan';
const image = 'data:image/png;base64,QUJD';
const input = {items: [{id: 'a', name: 'First', amount: 1}, {id: 'b', name: 'Second', amount: 1}, {id: 'c', name: 'Third', amount: 1}], tax: 2, tip: 0, image};
function fixture() {
  const db = seed(T), g = db.groups[0];
  const c = d.purchase(db, H, g.id, {merchant: 'Item rounding', amount: 5}, T);
  return {db, g, c};
}
const stale = (run: () => void) => assert.throws(run, error => error instanceof d.StaleStateError);

// Publishing is atomic and explicit; confirmation attaches independent cents to each item.
{
  const {db, g, c} = fixture();
  const initial = d.chargeEditKey(c);
  d.confirmReceiptList(db, H, c.id, input, T, initial);
  const key = d.receiptListKey(c.receipt!);
  assert.equal(c.sentAt, T);
  assert.equal(c.receipt!.image, image);
  assert.equal(c.receipt!.exclusive, true);
  assert.deepEqual(receiptItemAllocations(d.memberIds(g), c.receipt!).items.map(item => item.total), [2, 2, 1]);
  d.confirmItemSelection(db, H, c.id, ['a', 'b'], key, T);
  assert.equal(c.status, 'pending');
  assert.deepEqual(c.receipt!.locked, [H]);
  assert.deepEqual(receiptItemAllocations(d.memberIds(g), c.receipt!).shares, {[H]: 4, [M]: 0, [J]: 0});
  const before = JSON.stringify(db);
  stale(() => d.confirmItemSelection(db, M, c.id, ['a'], key, T));
  assert.equal(JSON.stringify(db), before, 'a rejected collision cannot change anyone');
  d.confirmReceiptList(db, H, c.id, input, T + 1, d.chargeEditKey(c));
  assert.deepEqual(c.receipt!.locked, [H], 'unchanged confirmation preserves peer and own consent');
  assert.equal(d.receiptListKey(c.receipt!), key);
  d.confirmItemSelection(db, J, c.id, [], key, T);
  assert.deepEqual(c.receipt!.locked, [H, J]);
  d.confirmItemSelection(db, M, c.id, ['c'], key, T);
  assert.equal(c.status, 'settled');
  assert.deepEqual(d.currentProposal(c).shares, {[H]: 4, [M]: 1, [J]: 0});
  assert.equal(db.ledger.filter(entry => entry.chargeId === c.id && entry.kind === 'charge').reduce((sum, entry) => sum - entry.amount, 0), 5);
  assert.throws(() => d.confirmItemSelection(db, M, c.id, ['c'], key, T), /no longer open/);
}

// A list revision rejects stale editors and claim confirmations; deleted items stay gone.
{
  const {db, c} = fixture();
  d.confirmReceiptList(db, H, c.id, input, T, d.chargeEditKey(c));
  const key = d.receiptListKey(c.receipt!), editKey = d.chargeEditKey(c);
  d.confirmItemSelection(db, H, c.id, ['a'], key, T);
  const next = {items: [{id: 'b', name: 'Remaining', amount: 4}], tax: 1, tip: 0, image};
  d.confirmReceiptList(db, M, c.id, next, T, editKey);
  assert.deepEqual(c.receipt!.items.map(item => [item.id, item.people]), [['b', []]]);
  assert.deepEqual(c.receipt!.locked, []);
  assert.notEqual(d.receiptListKey(c.receipt!), key, 'same-millisecond saves still create a distinct revision');
  const before = JSON.stringify(db);
  stale(() => d.confirmItemSelection(db, H, c.id, ['a'], key, T));
  stale(() => d.confirmReceiptList(db, H, c.id, input, T, editKey));
  assert.equal(JSON.stringify(db), before);
}

// Private parsing cannot publish a draft, clear consent, or change ledger/balances.
{
  const {db, c} = fixture();
  const before = JSON.stringify(db);
  const parsed = d.parseReceipt(db, H, c.id, {items: [{name: 'Read item', amount: 4}], tax: 0, tip: 0});
  assert.equal(parsed.draft?.items[0].amount, 4);
  assert.equal(JSON.stringify(db), before);
  assert.throws(() => d.parseReceipt(db, M, c.id), /Waiting for/);
  assert.equal(JSON.stringify(db), before);
}

// New proposals can request explicit consent without changing legacy implicit acceptance.
{
  const {db, c} = fixture();
  const input = {method: 'amount' as const, amounts: {[H]: 1, [M]: 2, [J]: 2}};
  d.proposeSplit(db, H, c.id, input, T, {acceptOwnShare: false, expectedEditKey: d.chargeEditKey(c)});
  assert.deepEqual(d.currentProposal(c).acceptedBy, []);
  d.acceptSplit(db, H, c.id, T, d.currentProposal(c).id);
  const id = d.currentProposal(c).id;
  d.proposeSplit(db, H, c.id, input, T, {acceptOwnShare: false, expectedEditKey: d.chargeEditKey(c)});
  assert.equal(d.currentProposal(c).id, id);
  assert.deepEqual(d.currentProposal(c).acceptedBy, [H]);
  stale(() => d.proposeSplit(db, M, c.id, input, T, {acceptOwnShare: false, expectedEditKey: 'old'}));
}

// Per-item rounding is opt-in; historical shared-item proposals retain their exact amounts.
{
  const items = input.items.map((item, i) => ({...item, people: [i === 2 ? M : H]}));
  const legacy = computeSplit([H, M], 5, {method: 'items', items, tax: 2, tip: 0});
  const next = computeSplit([H, M], 5, {method: 'items', items, tax: 2, tip: 0, taxAllocation: 'item'});
  assert.deepEqual(legacy.shares, {[H]: 3, [M]: 2});
  assert.deepEqual(next.shares, {[H]: 4, [M]: 1});
}

// Mathematical remainder ties must not drift because of binary fractional values.
{
  const items = [1, 1, 4].map((amount, index) => ({id: String(index), name: 'Item', amount, people: [[H], [M], [J]][index]}));
  const result = receiptItemAllocations([H, M, J], {items, tax: 10, tip: 10});
  assert.deepEqual(result.items.map(item => item.tax), [2, 2, 6]);
  assert.deepEqual(result.items.map(item => item.tip), [2, 2, 6]);
  assert.deepEqual(result.shares, {[H]: 5, [M]: 5, [J]: 16});
}

// Existing shared boards remain shared; a changed exclusive list resets through legacy APIs too.
{
  const {db, c} = fixture();
  d.scanReceipt(db, H, c.id, T);
  const r = c.receipt!;
  d.toggleClaim(db, H, c.id, r.items[0].id);
  d.toggleClaim(db, M, c.id, r.items[0].id);
  assert.deepEqual(r.items[0].people, [H, M]);
  d.confirmReceiptList(db, H, c.id, input, T, d.chargeEditKey(c));
  const key = d.receiptListKey(c.receipt!);
  d.confirmItemSelection(db, H, c.id, ['a'], key, T);
  assert.throws(() => d.toggleClaim(db, M, c.id, 'a'), /someone else/);
  d.updateReceipt(db, M, c.id, {items: [{id: 'b', name: 'Replacement', amount: 5}], tax: 0, tip: 0});
  assert.deepEqual(c.receipt!.items[0].people, []);
  assert.deepEqual(c.receipt!.locked, []);
  stale(() => d.confirmItemSelection(db, H, c.id, ['a'], key, T));
}

// Group/profile changes require membership and small raster images; rejection is atomic.
{
  const {db, g} = fixture();
  const before = JSON.stringify(db);
  assert.throws(() => d.updateGroup(db, 'u_connor', g.id, {name: 'Forged'}), /not a member/);
  assert.throws(() => d.updateGroup(db, H, g.id, {name: 'Changed', photo: 'data:image/svg+xml;base64,PHN2Zz4='}), /compressed/);
  assert.throws(() => d.updateGroup(db, H, g.id, {name: 'Changed', photo: `data:image/png;base64,${'A'.repeat(d.MAX_SHARED_IMAGE_LENGTH)}`}), /compressed/);
  assert.equal(JSON.stringify(db), before);
  d.updateGroup(db, M, g.id, {name: 'Shared place', photo: image});
  assert.equal(g.photo, image);
  d.updateGroup(db, H, g.id, {name: 'Home'});
  assert.equal(g.photo, image, 'omitted image preserves the existing one');
  d.updateGroup(db, H, g.id, {name: 'Home', photo: '/phone-assets/weekend.jpg'});
  assert.equal(g.photo, '/phone-assets/weekend.jpg');
  assert.throws(() => d.updateGroup(db, H, g.id, {name: 'Home', photo: '/phone-assets/other.jpg'}), /compressed/);
  d.updateGroup(db, H, g.id, {name: 'Home', photo: null});
  assert.equal(g.photo, undefined);
  d.updateProfile(db, H, {name: '  Henry   Example  '});
  assert.equal(d.userById(db, H).name, 'Henry Example');
  assert.equal(d.userById(db, H).initials, 'HE');
}
// By-item defaults are a preference: the card still has a complete equal fallback.
{
  const {db, g} = fixture();
  d.setDefaultSplit(db, H, g.id, {method: 'items'});
  const c = d.purchase(db, H, g.id, {merchant: 'Items preferred', amount: 101}, T);
  assert.equal(c.preferredSplit, 'items');
  assert.equal(d.currentProposal(c).input.method, 'equal');
  assert.equal(c.sentAt, null);
  assert.equal(Object.values(d.currentProposal(c).shares).reduce((a, b) => a + b, 0), 101);
}
console.log('PASS item selection: atomic exclusive ownership, stable cents and peer consent, revisions, deletion, private parsing, explicit proposal approval, legacy compatibility, authorized updates.');
