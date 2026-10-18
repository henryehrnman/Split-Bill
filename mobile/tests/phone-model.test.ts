import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {parse} from 'acorn';
import * as d from '../src/lib/domain.ts';
import type {Db, User} from '../src/lib/domain.ts';
import {projectPhoneSnapshot} from '../src/web/phoneModel.ts';
import {createPhoneBridge, moneyToCents} from '../src/web/phoneBridge.ts';
import type {PhoneApi, PhoneMutation} from '../src/web/phoneBridge.ts';
import {computeSplit} from '../src/lib/split.ts';

const NOW = new Date(2027, 1, 4, 10).getTime();
const buyer = 'buyer-z', peer = 'peer-a', viewer = 'viewer-x';
const users: User[] = [buyer, peer, viewer].map((id, index) => ({
  id, name: ['Avery N.', 'Robin Q.', 'Taylor V.'][index], initials: ['AN', 'RQ', 'TV'][index],
  handle: `member${index}`, tone: index, email: `member${index}@example.test`, phone: '',
}));
const db: Db = {version: 6, seq: 0, clockOffset: 0, users, groups: [], cards: [], charges: [], budgetProposals: [], ledger: [], notifications: []};
const group = d.createGroup(db, buyer, {name: 'Actual group', inviteIds: [peer, viewer], budget: 6000, periodDays: 14}, NOW);
for (const id of [peer, viewer]) d.respondInvite(db, id, group.id, true, NOW, 2000);
for (const id of [buyer, peer, viewer]) d.addToWallet(db, id, d.cardFor(db, group.id, id)!.id, 'Apple Wallet');

// Viewer-first presentation must not give the viewer the first member's rounding cent.
const history = d.purchase(db, buyer, group.id, {merchant: 'Archived merchant', amount: 5}, new Date(2026, 1, 4, 10).getTime());
d.sendDefaultSplit(db, buyer, history.id, NOW);
for (const id of [peer, viewer]) d.acceptSplit(db, id, history.id, NOW, d.currentProposal(history).id);
const sent = d.purchase(db, buyer, group.id, {merchant: 'Current merchant', amount: 1001}, NOW);
d.sendDefaultSplit(db, buyer, sent.id, NOW);
const privateCharge = d.purchase(db, buyer, group.id, {merchant: 'Private draft', amount: 401}, NOW);
const before = JSON.stringify(db);
let projected = projectPhoneSnapshot(db, viewer, NOW);
assert.equal(JSON.stringify(db), before, 'projection must not mutate domain state');
assert.equal(projected.viewer.name, 'Taylor V.');
assert.equal(projected.state.displayName, 'Taylor');
assert.equal(projected.groups[0].people[0].id, viewer);
assert.deepEqual(projected.pending.find(row => row.id === sent.id)!.allocation, [3.33, 3.34, 3.34]);
assert.equal(projected.charges[0].amount, 0.01);
assert.equal(projected.charges[0].year, 2026);
assert.equal(projected.calendar.year, 2027);
assert.equal(projected.calendar.month, 1);
assert.equal(projected.calendar.monthLabel, 'February 2027');
assert.equal(projected.calendar.greeting, 'Good morning');
assert.ok(!projected.pending.some(row => row.id === privateCharge.id));
assert.equal(projected.groups[0].pendingCount, 2, 'private drafts count toward authoritative group state');
assert.equal(projected.groups[0].power, 45.93, 'private drafts must reserve funds even though invisible');
assert.equal(projected.groups[0].last4, d.cardFor(db, group.id, viewer)!.last4);
assert.equal(projected.state.approvals[sent.id][buyer], true);
assert.equal(projected.state.approved[sent.id], false);
assert.equal(projected.pending[0].people[0].id, viewer);

// Remote snapshots omit private drafts; the pre-filtered server spendingView remains authoritative.
const scoped: Db = JSON.parse(JSON.stringify(db));
scoped.charges = scoped.charges.filter(charge => charge.id !== privateCharge.id);
scoped.spendingView = {viewerId: viewer, groups: {[group.id]: {availableFunds: 4593, spendLimit: 4593, purchaseBlocker: null, pendingCount: 2, withdrawalBlocked: true}}};
projected = projectPhoneSnapshot(scoped, viewer, NOW);
assert.equal(projected.groups[0].power, 45.93);
assert.equal(projected.groups[0].spendLimit, 45.93);
assert.equal(projected.groups[0].pendingCount, 2);
assert.equal(projected.groups[0].withdrawalBlocked, true);
assert.throws(() => projectPhoneSnapshot(scoped, buyer, NOW), /another account/);
assert.throws(() => projectPhoneSnapshot({...scoped, spendingView: {viewerId: viewer, groups: {}}}, viewer, NOW), /spending limits/);

// Zero-share pending proposals remain visible and do not fabricate acceptance.
const excluded = d.purchase(db, buyer, group.id, {merchant: 'Other members only', amount: 11}, NOW);
d.proposeSplit(db, buyer, excluded.id, {method: 'equal', participants: [buyer, peer]}, NOW);
projected = projectPhoneSnapshot(db, viewer, NOW);
assert.equal(projected.pending.find(row => row.id === excluded.id)!.share, 0);
assert.equal(projected.state.approved[excluded.id], false);
assert.deepEqual(projected.state.proposalDetails[excluded.id].participants, [buyer, peer]);

// Partial exclusive item boards project stable per-item cents and real peer locks.
const itemCharge = d.purchase(db, buyer, group.id, {merchant: 'Item merchant', amount: 11}, NOW);
d.confirmReceiptList(db, buyer, itemCharge.id, {items: [{id: 'item-a', name: 'First item', amount: 3}, {id: 'item-b', name: 'Second item', amount: 5}], tax: 1, tip: 2}, NOW, d.chargeEditKey(itemCharge));
d.confirmItemSelection(db, peer, itemCharge.id, ['item-a'], d.receiptListKey(itemCharge.receipt!), NOW);
projected = projectPhoneSnapshot(db, viewer, NOW);
const itemProposal = projected.state.proposalDetails[itemCharge.id];
assert.equal(itemProposal.method, 'item');
assert.equal(itemProposal.exclusive, true);
assert.deepEqual(itemProposal.items[0].assignees, [peer]);
assert.deepEqual(itemProposal.allocation, [0, 0, 0.04]);
assert.equal(itemProposal.unclaimed, 0.07);
assert.equal(projected.state.itemConfirmations[itemCharge.id][peer], true);
assert.equal(projected.state.approved[itemCharge.id], false);
assert.equal(itemProposal.receiptListKey, d.receiptListKey(itemCharge.receipt!));
assert.equal(itemProposal.editKey, d.chargeEditKey(itemCharge));
assert.equal(itemProposal.items.reduce((sum, item) => sum + Math.round(item.total! * 100), 0), 11);

// Invitations remain distinct from joined groups and carry exact reviewed consent cents.
const invitation = d.createGroup(db, buyer, {name: 'Invitation', inviteIds: [viewer, peer], budget: 10000, periodDays: 7}, NOW);
projected = projectPhoneSnapshot(db, viewer, NOW);
const invite = projected.invites.find(row => row.id === invitation.id)!;
assert.equal(invite.share, 33.33);
assert.equal(invite.expectedContribution, 3333);
assert.equal(invite.initialContributionLimit, 3333);
assert.equal(invite.from, 'Avery N.');
assert.ok(!projected.groups.some(row => row.id === invitation.id));
assert.ok(projected.state.notice);

// Receipt OCR mismatch exposes the actual editable read, not only its fallback charge line.
itemCharge.receipt!.draft = {items: [{name: 'Needs correction', amount: 8}], tax: 2, tip: 3};
projected = projectPhoneSnapshot(db, viewer, NOW);
assert.equal(projected.state.proposalDetails[itemCharge.id].receiptDraft, true);
assert.equal(projected.state.proposalDetails[itemCharge.id].receiptDraftDetails!.items[0].amount, 0.08);
assert.equal(projected.state.proposalDetails[itemCharge.id].receiptDraftDetails!.tax, 0.02);

// Empty accounts have no invented balances, people, invitations, charges or cards.
const empty: Db = {...db, users: [users[2]], groups: [], cards: [], charges: [], budgetProposals: [], ledger: [], notifications: []};
const emptySnapshot = projectPhoneSnapshot(empty, viewer, NOW);
assert.deepEqual([emptySnapshot.groups, emptySnapshot.invites, emptySnapshot.pending, emptySnapshot.charges], [[], [], [], []]);
assert.equal(emptySnapshot.people.length, 1);
assert.equal(emptySnapshot.demoUsers[0].id, viewer);
assert.equal(emptySnapshot.state.notice, false);

// The bridge injects the store actor, freezes reviewed arguments, and never routes reads through mutation state.
let queued: ((actor: string) => Promise<Db>) | null = null;
let invocation: unknown[] = [];
let runCount = 0;
const fakeApi = {
  proposeSplit: async (...args: unknown[]) => { invocation = args; return db; },
  searchUsers: async (...args: unknown[]) => { invocation = args; return [users[0]]; },
  parseReceipt: async (...args: unknown[]) => { invocation = args; return {items: [], tax: 0, tip: 0, itemized: false}; },
} as unknown as PhoneApi;
const bridge = createPhoneBridge({api: fakeApi, getViewerId: () => viewer, run: async call => { runCount++; queued = call; return null; }});
const input = {method: 'amount' as const, amounts: {[viewer]: 11}};
assert.equal(await bridge.call('proposeSplit', ['charge-1', input]), null);
input.amounts[viewer] = 999;
assert.ok(queued);
await (queued as (actor: string) => Promise<Db>)('store-actor');
assert.deepEqual(invocation, ['store-actor', 'charge-1', {method: 'amount', amounts: {[viewer]: 11}}]);
await bridge.searchUsers('avery', [peer]);
assert.deepEqual(invocation, [viewer, 'avery', [peer]]);
await bridge.parseReceipt('charge-1');
assert.deepEqual(invocation, [viewer, 'charge-1', undefined]);
assert.equal(runCount, 1);
await assert.rejects(() => bridge.call('reset' as PhoneMutation, [] as never), /not available/);
assert.equal(moneyToCents('0.29'), 29);
assert.equal(moneyToCents(12.34), 1234);
assert.throws(() => moneyToCents('1.001'), /two decimal/);
assert.throws(() => moneyToCents(-1), /two decimal/);
assert.throws(() => moneyToCents(Number.NaN), /two decimal/);

// Run the real runtime financial functions without a browser or DOM. This catches
// display-order rounding and no-op submission errors at the renderer/domain boundary.
const runtimeSource = readFileSync(new URL('../src/web/phoneRuntime.js', import.meta.url), 'utf8');
const functionNames = ['currentAllocation', 'canonicalAllocation', 'equalChargeAllocation',
  'distributeWeighted', 'percentageAllocation', 'calculateProposal',
  'setDraftMethod', 'beginSplitEdit', 'submitSplitProposal', 'groupedItems'];
// Parse declarations, rather than lines: formatting and multiline signatures must
// not change which exact production functions these boundary tests exercise.
const runtimeAst = parse(runtimeSource, {ecmaVersion: 'latest', sourceType: 'module'});
const mounts = runtimeAst.body.flatMap(node => node.type === 'ExportNamedDeclaration'
  && node.declaration?.type === 'FunctionDeclaration' && node.declaration.id?.name === 'mountPhone'
  ? [node.declaration] : []);
assert.equal(mounts.length, 1, 'Expected one exported mountPhone implementation');
const financialSource = functionNames.map(name => {
  const matching = mounts[0].body.body.flatMap(node => {
    if (node.type === 'FunctionDeclaration' && node.id?.name === name) return [runtimeSource.slice(node.start, node.end)];
    if (node.type === 'VariableDeclaration') return node.declarations
      .filter(declaration => declaration.id.type === 'Identifier' && declaration.id.name === name)
      .map(declaration => `${node.kind} ${runtimeSource.slice(declaration.start, declaration.end)};`);
    return [];
  });
  assert.equal(matching.length, 1, `Expected one runtime financial function: ${name}`);
  return matching[0];
}).join('\n');
const runtimeSnapshot = projectPhoneSnapshot(db, viewer, NOW);
let submitted: unknown[] = [];
const runtimeState = {...runtimeSnapshot.state, splitDrafts: {} as Record<string, any>, draftSequence: 0};
const normalize = (value: unknown) => JSON.parse(JSON.stringify(value));
const runtime: any = {
  state: runtimeState, pending: runtimeSnapshot.pending,
  chargePeople: (charge: any) => charge.people,
  currentProposal: (charge: any) => runtimeState.proposalDetails[charge.id],
  clone: normalize, cents: moneyToCents,
  moneyCents: (value: unknown) => { try { return moneyToCents(value); } catch { return null; } },
  percentageBasis: (value: string) => Number(value) * 100,
  splitUnit: () => 'dollars', money: (value: number) => `$${value.toFixed(2)}`,
  itemBreakdown: () => { throw new Error('Published allocation must not be recomputed by the renderer.'); },
  saveScroll() {}, render() {}, push() {}, finishSplitEdit() {}, toast() {},
  call: async (...args: unknown[]) => { submitted = args; return db; },
  avatar: () => '', esc: String, proposalHeading: () => '<h2>Proposed split</h2>',
  allocationText: (_charge: unknown, values: number[], index: number) => `$${values[index].toFixed(2)}`,
};
runInNewContext(`${financialSource}\nthis.financial={currentAllocation,canonicalAllocation,percentageAllocation,calculateProposal,setDraftMethod,beginSplitEdit,submitSplitProposal,groupedItems};`, runtime);
for (let count = 2; count <= 5; count++) {
  const ids = Array.from({length: count}, (_, index) => `canonical-${index}`);
  for (const self of ids) {
    const display = [self, ...ids.filter(id => id !== self)];
    for (let total = 1; total <= 25; total++) {
      const row = {id: 'rounding', total: total / 100, canonicalMemberIds: ids, people: display.map(id => ({id}))};
      const result = runtime.financial.calculateProposal(row, {method: 'equal', participants: ids});
      const expected = computeSplit(ids, total, {method: 'equal', participants: ids});
      assert.deepEqual(normalize(result.allocation), display.map(id => expected.shares[id] / 100));
    }
  }
}
const runtimeSent = runtimeSnapshot.pending.find(charge => charge.id === sent.id)!;
assert.deepEqual(normalize(runtime.financial.currentAllocation(runtimeSent)), [3.33, 3.34, 3.34]);
const runtimeItem = runtimeSnapshot.pending.find(charge => charge.id === itemCharge.id)!;
assert.deepEqual(normalize(runtime.financial.currentAllocation(runtimeItem)), runtimeItem.allocation);
runtime.financial.beginSplitEdit(excluded.id);
await runtime.financial.submitSplitProposal(excluded.id);
assert.deepEqual(normalize(submitted[1]), [excluded.id, {method: 'equal', participants: [buyer, peer]}, {acceptOwnShare: false, expectedEditKey: d.chargeEditKey(excluded)}]);
runtime.financial.beginSplitEdit(itemCharge.id);
assert.equal(runtimeState.splitDrafts[itemCharge.id].items[0].name, 'Needs correction');
assert.equal(runtimeState.splitDrafts[itemCharge.id].items[0].amount, 0.08);
assert.equal(runtimeState.splitDrafts[itemCharge.id].tax, 0.02);
assert.equal(runtimeState.splitDrafts[itemCharge.id].receiptDraft, false);
runtimeState.proposalDetails[itemCharge.id].exclusive = false;
runtimeState.proposalDetails[itemCharge.id].receiptDraftDetails = null;
runtimeState.proposalDetails[itemCharge.id].items[0].assignees = [buyer, peer];
runtime.financial.beginSplitEdit(itemCharge.id);
assert.deepEqual(normalize(runtimeState.splitDrafts[itemCharge.id].items[0].assignees), []);
assert.deepEqual(runtimeState.proposalDetails[itemCharge.id].items[0].assignees, [buyer, peer], 'opening an edit cannot mutate published ownership');
assert.equal(runtimeState.splitDrafts[itemCharge.id].exclusive, true);
assert.match(runtime.financial.groupedItems(runtimeItem, runtimeState.proposalDetails[itemCharge.id]), /Make changes and confirm/);

const percentCharge = d.purchase(db, buyer, group.id, {merchant: 'Percent legacy', amount: 101}, NOW);
d.proposeSplit(db, buyer, percentCharge.id, {method: 'percent', percents: {[buyer]: 50, [peer]: 25, [viewer]: 25}}, NOW);
const percentSnapshot = projectPhoneSnapshot(db, viewer, NOW);
Object.assign(runtimeState, percentSnapshot.state);
runtime.pending = percentSnapshot.pending;
runtime.financial.beginSplitEdit(percentCharge.id);
await runtime.financial.submitSplitProposal(percentCharge.id);
assert.equal((submitted[1] as any[])[1].method, 'percent', 'unchanged custom editor preserves a legacy percent proposal');
assert.deepEqual(normalize((submitted[1] as any[])[1]), d.currentProposal(percentCharge).input);

console.log('Phone model, bridge and runtime: projection, privacy, cents, consent, item state, actor isolation and 350 canonical allocations passed.');
