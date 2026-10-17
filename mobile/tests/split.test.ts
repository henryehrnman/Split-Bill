import assert from 'node:assert/strict';
import {allocate, cents} from '../src/lib/money.ts';
import {computeSplit} from '../src/lib/split.ts';

const ids = ['a', 'b', 'c'];
const sum = (s: Record<string, number>) => Object.values(s).reduce((x, y) => x + y, 0);

assert.deepEqual(allocate(100, [1, 1, 1]), [34, 33, 33]);
for (let n = 1; n < 10000; n += 37) assert.equal(allocate(n, [23, 31, 46]).reduce((a, b) => a + b, 0), n);
assert.equal(cents('12.3'), 1230);
assert.equal(cents('1.234'), null);
assert.equal(cents('-1'), null);

// Equal: every cent is allocated, extra cents follow member order; excluded members owe nothing.
assert.deepEqual(computeSplit(ids, 10001, {method: 'equal', participants: ids}).shares, {a: 3334, b: 3334, c: 3333});
assert.deepEqual(computeSplit(ids, 1001, {method: 'equal', participants: ['c', 'a']}).shares, {a: 501, b: 0, c: 500});
assert(computeSplit(ids, 1000, {method: 'equal', participants: []}).error);
assert(computeSplit(ids, 1000, {method: 'equal', participants: ['z']}).error);

// Percent and amount must cover the whole charge.
assert.equal(sum(computeSplit(ids, 15420, {method: 'percent', percents: {a: 50, b: 25, c: 25}}).shares), 15420);
assert(computeSplit(ids, 15420, {method: 'percent', percents: {a: 50, b: 20, c: 20}}).error);
assert.equal(computeSplit(ids, 1000, {method: 'amount', amounts: {a: 500, b: 500, c: 0}}).error, '');
assert.match(computeSplit(ids, 1000, {method: 'amount', amounts: {a: 500, b: 400, c: 0}}).error, /\$1\.00 left/);

// Items: shared items, tax and tip follow item totals, cents conserved.
const items = [
  {id: '1', name: 'Shared', amount: 601, people: ['c', 'a']},
  {id: '2', name: 'Solo', amount: 400, people: ['b']},
];
const r = computeSplit(ids, 1264, {method: 'items', items, tax: 83, tip: 180});
assert.equal(r.error, '');
assert.deepEqual(Object.values(r.breakdown!).map(x => x.items), [301, 400, 300]);
assert.equal(sum(r.shares), 1264);
assert(computeSplit(ids, 1264, {method: 'items', items: [{...items[0], people: []}, items[1]], tax: 83, tip: 180}).error);
assert(computeSplit(ids, 1264, {method: 'items', items: [{...items[0], people: ['a', 'a']}, items[1]], tax: 83, tip: 180}).error);
assert(computeSplit(ids, 1300, {method: 'items', items, tax: 83, tip: 180}).error);
for (let amount = 1; amount < 10000; amount += 97) {
  const x = computeSplit(ids, amount, {method: 'items', items: [{id: 'x', name: 'Shared', amount, people: ids}], tax: 0, tip: 0});
  assert.equal(sum(x.shares), amount);
}

console.log('PASS split: cent conservation, equal/percent/amount/items validation, excluded members, shared items, tax/tip allocation.');
