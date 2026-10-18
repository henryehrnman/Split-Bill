import assert from 'node:assert/strict';
import * as d from '../src/lib/domain.ts';
import {seed} from '../src/lib/seed.ts';

// Exhaust the invitation decision/order space independently of the implementation's
// share allocator. Money is simulated; this never connects to a live service.
const T0 = Date.UTC(2026, 9, 18);
const users = ['u_henry', 'u_maya', 'u_jordan', 'u_connor', 'u_saahil'];
const fresh = () => Object.assign(seed(T0), {
  groups: [], cards: [], charges: [], budgetProposals: [], ledger: [], notifications: [],
});
const permutations = (ids: string[]): string[][] => ids.length
  ? ids.flatMap((id, i) => permutations(ids.filter((_, j) => j !== i)).map(rest => [id, ...rest]))
  : [[]];
let scenarios = 0;

for (let size = 2; size <= 5; size++) {
  const ids = users.slice(0, size);
  for (const order of permutations(ids.slice(1))) {
    for (let accepted = 0; accepted < 2 ** (size - 1); accepted++) {
      for (const budget of [size * 100, 30001, 50003]) {
        for (const failure of ['none', ...ids, 'all']) {
          const db = fresh();
          const maximum = Math.ceil(budget / 2);
          const group = d.createGroup(db, ids[0], {
            name: 'Invitation audit', inviteIds: ids.slice(1), budget,
            periodDays: 1, initialContributionLimit: maximum,
          }, T0);
          for (const id of ids) {
            if (failure === id || failure === 'all') d.setFailTopUps(db, id, group.id, true);
          }
          for (let step = 0; step < order.length; step++) {
            const id = order[step];
            const accept = !!(accepted & (1 << (ids.indexOf(id) - 1)));
            const now = T0 + (step + 1) * 9 * d.DAY;
            d.tick(db, now);
            assert.equal(db.ledger.length, 0, 'no initial collection or period refill while forming');
            assert.equal(d.spendLimit(db, group.id, ids[0]), 0);
            if (accept) d.respondInvite(db, id, group.id, true, now, d.shares(group)[id], maximum);
            else d.respondInvite(db, id, group.id, false, now);
            if (step < order.length - 1) assert.equal(db.ledger.length, 0, 'an early response never collects');
          }
          const joined = ids.filter((_, i) => i === 0 || !!(accepted & (1 << (i - 1))));
          const now = T0 + order.length * 9 * d.DAY;
          if (joined.length < 2) {
            assert.equal(group.activatedAt, null);
            assert.equal(db.ledger.length, 0);
            d.tick(db, now + 90 * d.DAY);
            assert.equal(db.ledger.length, 0, 'a lone creator is never charged');
          } else {
            assert.equal(group.activatedAt, now);
            assert.equal(group.periodStart, now, 'the first period begins at activation');
            const base = Math.floor(budget / joined.length);
            const remainingCents = budget % joined.length;
            joined.forEach((id, i) => {
              const amount = base + (i < remainingCents ? 1 : 0);
              const failed = failure === id || failure === 'all';
              assert.equal(d.memberOf(group, id).balance, failed ? 0 : amount);
              const entries = db.ledger.filter(entry => entry.userId === id);
              assert.equal(entries.length, 1, 'exactly one funding attempt per joined member');
              assert.equal(entries[0].amount, amount);
              assert.equal(entries[0].kind, failed ? 'deposit-failed' : 'deposit');
              assert(amount <= maximum, 'every charge stays within its authorization');
            });
            assert.equal(db.ledger.reduce((sum, entry) => sum + entry.amount, 0), budget);
            const before = structuredClone(db);
            d.tick(db, now);
            d.tick(db, now);
            assert.deepEqual(db, before, 'repeated ticks never repeat initial funding');
            assert.throws(() => d.respondInvite(db, joined[0], group.id, true, now, base, maximum), d.ApiError);
            assert.deepEqual(db, before, 'duplicate acceptance never repeats initial funding');
          }
          scenarios++;
        }
      }
    }
  }
}

console.log(`PASS group rules: ${scenarios} invitation orders, decisions, exact-cent budgets and initial-payment failure scenarios.`);
