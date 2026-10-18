import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {parse} from 'acorn';
import * as d from '../src/lib/domain.ts';
import type {Db, ReceiptListInput} from '../src/lib/domain.ts';
import {projectPhoneSnapshot} from '../src/web/phoneModel.ts';
import type {PhoneCharge, PhoneSnapshot} from '../src/web/phoneModel.ts';

const NOW = Date.UTC(2026, 9, 18, 16);
const SELF = 'viewer', PAYER = 'payer', PEER = 'peer';
const IMAGE = 'data:image/png;base64,QUJD';
const list: ReceiptListInput = {
  items: [{id: 'a', name: 'First', amount: 50}, {id: 'b', name: 'Second', amount: 50}],
  tax: 1, tip: 2, image: IMAGE,
};
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

// Exercise production declarations and the delegated click handler, with only
// rendering and the store transport replaced. Domain mutations remain real.
const source = readFileSync(new URL('../src/web/phoneRuntime.js', import.meta.url), 'utf8');
const ast = parse(source, {ecmaVersion: 'latest', sourceType: 'module'});
const mount = ast.body.find(node => node.type === 'ExportNamedDeclaration'
  && node.declaration?.type === 'FunctionDeclaration' && node.declaration.id?.name === 'mountPhone');
assert.ok(mount?.type === 'ExportNamedDeclaration' && mount.declaration?.type === 'FunctionDeclaration');
const body = mount.declaration.body.body;
function declaration(name: string) {
  const matches = body.flatMap(node => {
    if (node.type === 'FunctionDeclaration' && node.id?.name === name) return [source.slice(node.start, node.end)];
    if (node.type === 'VariableDeclaration') return node.declarations
      .filter(value => value.id.type === 'Identifier' && value.id.name === name)
      .map(value => `${node.kind} ${source.slice(value.start, value.end)};`);
    return [];
  });
  assert.equal(matches.length, 1, `Expected one runtime declaration: ${name}`);
  return matches[0];
}
const names = ['button', 'moneyCents', 'distributeWeighted', 'validateItemList', 'itemBreakdown',
  'itemListSignature', 'prepareSelection', 'beginSelection', 'advanceItemSelection', 'toggleSelection',
  'back', 'confirmSelection', 'confirmItemList', 'submitSplitProposal', 'splitFooter', 'selectItems',
  'itemEditor', 'call', 'act', 'currentAllocation', 'canonicalAllocation', 'equalChargeAllocation',
  'splitUnit', 'percentageParts', 'percentText', 'percentageBasis', 'makePercentageDraft',
  'percentageAllocation', 'allocationText', 'calculateProposal', 'customAllocationValue',
  'customInputWidth', 'methodName', 'draftPersonalAllocation', 'draftValidationText',
  'refreshDraftSummary', 'memberAllocations', 'splitEdit'];
const clickHandlers = body.filter(node => node.type === 'ExpressionStatement'
  && node.expression.type === 'CallExpression' && node.expression.callee.type === 'Identifier'
  && node.expression.callee.name === 'on' && node.expression.arguments[0]?.type === 'Literal'
  && node.expression.arguments[0].value === 'click'
  && source.slice(node.start, node.end).includes('case "confirm-selection":'));
assert.equal(clickHandlers.length, 1, 'Expected one delegated selection action handler');
const inputHandlers = body.filter(node => node.type === 'ExpressionStatement'
  && node.expression.type === 'CallExpression' && node.expression.callee.type === 'Identifier'
  && node.expression.callee.name === 'on' && node.expression.arguments[0]?.type === 'Literal'
  && node.expression.arguments[0].value === 'input'
  && source.slice(node.start, node.end).includes('e.target.dataset.draftField'));
assert.equal(inputHandlers.length, 1, 'Expected one draft input handler');
const render = body.find(node => node.type === 'FunctionDeclaration' && node.id?.name === 'render');
assert.ok(render?.type === 'FunctionDeclaration');
const routes = render.body.body.find(node => node.type === 'SwitchStatement');
assert.ok(routes?.type === 'SwitchStatement');
const selectionRoute = routes.cases.find(node => node.test?.type === 'Literal' && node.test.value === 'select-items');
assert.ok(selectionRoute);
const selectionRender = selectionRoute.consequent.filter(node => node.type !== 'BreakStatement')
  .map(node => source.slice(node.start, node.end)).join('\n');
const runtimeSource = names.map(declaration).join('\n')
  + '\n' + source.slice(clickHandlers[0].start, clickHandlers[0].end)
  + '\n' + source.slice(inputHandlers[0].start, inputHandlers[0].end)
  + `\nthis.runtime={${names.join(',')}};`
  + `\nthis.renderSelection=function(id){const r={id};let html='',footer='';${selectionRender};return {html,footer};};`;

function fixture(amount = 103, itemized = true) {
  let db: Db = {version: 6, seq: 0, clockOffset: 0,
    users: [PAYER, SELF, PEER].map((id, tone) => ({id, name: id, initials: id[0], tone,
      handle: id, email: `${id}@example.test`, phone: ''})),
    groups: [], cards: [], charges: [], budgetProposals: [], ledger: [], notifications: []};
  const budget = Math.max(6000, amount * 3);
  const group = d.createGroup(db, PAYER, {name: 'Runtime group', budget, periodDays: 30, inviteIds: [SELF, PEER]}, NOW);
  for (const id of [SELF, PEER]) d.respondInvite(db, id, group.id, true, NOW, budget / 3);
  d.addToWallet(db, PAYER, d.cardFor(db, group.id, PAYER)!.id, 'Apple Wallet');
  const chargeId = d.purchase(db, PAYER, group.id, {merchant: 'Runtime receipt', amount}, NOW).id;
  if (itemized) d.confirmReceiptList(db, PAYER, chargeId, list, NOW, d.chargeEditKey(db.charges[0]));
  else d.proposeSplit(db, PAYER, chargeId, {method: 'equal', participants: [PAYER, SELF, PEER]}, NOW,
    {acceptOwnShare: false, expectedEditKey: d.chargeEditKey(db.charges[0])});
  const snapshot = projectPhoneSnapshot(db, SELF, NOW);
  const state = {...snapshot.state, tab: 'home', stack: [{type: 'split', id: chargeId}],
    splitDrafts: {} as Record<string, any>, selectionDrafts: {} as Record<string, any>, splitUnits: {} as Record<string, string>};
  const calls: {method: string; args: any[]}[] = [];
  const messages: string[] = [];
  const handlers: Record<string, (event: any) => void> = {};
  const dom = {share: {textContent: ''}, error: {textContent: '', hidden: true}, submit: {disabled: false}};
  let renders = 0;
  let work: Promise<void> | undefined;
  let failTransport = false;
  let lastError: unknown;
  const context: any = {
    state, pending: snapshot.pending, busy: false, disposed: false, suppressCardClickUntil: 0,
    root: {setAttribute() {}, removeAttribute() {},
      querySelectorAll: (selector: string) => selector === '[data-draft-submit]' ? [dom.submit] : []},
    $: (selector: string) => ({'#split-share': dom.share, '#draft-total': dom.error, '[data-draft-submit]': dom.submit})[selector] ?? null,
    on: (type: string, callback: (event: any) => void) => { handlers[type] = callback; },
    chargePeople: (charge: PhoneCharge) => charge.people,
    currentProposal: (charge: PhoneCharge) => state.proposalDetails[charge.id],
    current: () => state.stack.at(-1) ?? {type: state.tab},
    push: (type: string, id: string) => state.stack.push({type, id}),
    saveScroll() {}, render() { renders++; }, safeRender() {}, syncRoute() {},
    toast: (message: string) => messages.push(message),
    money: (value: number) => `$${value.toFixed(2)}`, esc: String, icon: () => '',
    backbar: (title: string) => `<header>${title}</header>`,
    itemFlowShell: (_charge: unknown, _proposal: unknown, card: string, _selecting: boolean, share: number | null) => { context.flowShare = share; return card; },
    receiptEntryActions: () => '', proposalHeading: () => '<h2>Proposed split</h2>', avatar: () => '',
    cents: (value: number) => Math.round(value * 100),
    adopt(next: PhoneSnapshot) { Object.assign(state, next.state); context.pending = next.pending; },
    bridge: {
      snapshot: (next: Db) => projectPhoneSnapshot(next, SELF, NOW),
      async call(method: string, args: any[]) {
        calls.push({method, args: clone(args)});
        if (failTransport) return null;
        const next = clone(db);
        try {
          if (method === 'confirmItemSelection') d.confirmItemSelection(next, SELF, args[0], args[1], args[2], NOW);
          else if (method === 'confirmReceiptList') d.confirmReceiptList(next, SELF, args[0], args[1], NOW, args[2]);
          else throw Error(`Unexpected mutation: ${method}`);
        } catch (error) { lastError = error; return null; }
        db = next;
        return db;
      },
    },
  };
  runInNewContext(runtimeSource, context);
  const actualAct = context.runtime.act;
  context.act = (operation: () => Promise<void>) => { work = actualAct(operation); return work; };
  async function click(action: string, extra: Record<string, string> = {}) {
    work = undefined;
    const target = {dataset: {action, id: chargeId, ...extra}, closest: () => null};
    handlers.click({target: {closest: () => target}, preventDefault() {}});
    await work;
  }
  async function clickFooter(label: string) {
    const {footer} = context.renderSelection(chargeId);
    const button = [...footer.matchAll(/<button\b([^>]*)>([^<]*)<\/button>/g)]
      .find((match: RegExpMatchArray) => match[2] === label);
    assert.ok(button, `Missing footer button: ${label}`);
    const action = button[1].match(/data-action="([^"]+)"/)?.[1];
    assert.ok(action);
    await click(action);
  }
  const currentCharge = () => db.charges.find(charge => charge.id === chargeId)!;
  return {context, state, calls, messages, chargeId, click, clickFooter, currentCharge, dom,
    input(target: any) { handlers.input({target}); }, get renders() { return renders; },
    get db() { return db; }, get lastError() { return lastError; },
    fail() { failTransport = true; },
    refresh() { context.adopt(projectPhoneSnapshot(db, SELF, NOW)); },
    open() { assert.equal(context.runtime.beginSelection(chargeId), true); },
  };
}

// Selection and cancellation are local; the actual route supplies the sole action row.
{
  const f = fixture(), before = JSON.stringify(f.db);
  f.open();
  await f.click('toggle-selection', {item: 'a'});
  assert.deepEqual(clone(f.state.selectionDrafts[f.chargeId].ids), ['a']);
  const screen = f.context.renderSelection(f.chargeId);
  assert.match(screen.html, /<h2>Select your items<\/h2>/);
  assert.doesNotMatch(screen.html, /data-action="(?:confirm-selection|submit-proposal|cancel-edit|back)"/);
  assert.equal((screen.footer.match(/<button\b/g) || []).length, 2);
  assert.equal(f.calls.length, 0);
  await f.clickFooter('Cancel');
  assert.equal(f.state.selectionDrafts[f.chargeId], undefined);
  assert.equal(f.state.stack.at(-1)?.type, 'split');
  assert.equal(f.calls.length, 0);
  assert.equal(JSON.stringify(f.db), before);
}

// Inline list actions follow editable rows, not receipt attachment or the sticky
// manualEntry flag. The bottom actions remain available throughout local editing.
for (const attached of [false, true]) {
  const f = fixture(), before = JSON.stringify(f.db);
  const draft = {...clone(f.state.proposalDetails[f.chargeId]), manualEntry: false};
  draft.items = [];
  draft.receipt = attached ? {kind: 'saved', name: 'Receipt', image: IMAGE} : null;
  f.state.splitDrafts[f.chargeId] = draft;
  f.context.state.draftSequence = 0;
  f.state.stack.push({type: 'split-edit', id: f.chargeId});
  const assertActions = (visible: boolean) => {
    const card = f.context.runtime.itemEditor(f.context.pending[0], draft);
    assert.equal(/data-action="cancel-edit"/.test(card), visible);
    assert.equal(/data-action="confirm-item-list"/.test(card), visible);
    const footer = f.context.runtime.splitFooter(f.chargeId, true);
    assert.match(footer, /data-action="cancel-edit"[^>]*>Cancel/);
    assert.match(footer, /data-action="submit-proposal"[^>]*>Propose changes/);
  };
  assertActions(false);
  await f.click('add-item');
  assert.equal(draft.items.length, 1);
  assert.equal(draft.items[0].name, '');
  assertActions(true);
  await f.click('remove-item', {item: draft.items[0].id});
  assert.equal(draft.items.length, 0);
  assert.equal(draft.manualEntry, true);
  assertActions(false);
  assert.equal(f.calls.length, 0);
  assert.equal(JSON.stringify(f.db), before);
}

// Both list-editor actions publish only the list; selection still has no inline actions.
for (const action of ['confirm-item-list', 'submit-proposal']) {
  const f = fixture();
  f.state.splitDrafts[f.chargeId] = clone(f.state.proposalDetails[f.chargeId]);
  f.state.stack.push({type: 'split-edit', id: f.chargeId});
  const card = f.context.runtime.itemEditor(f.context.pending[0], f.state.splitDrafts[f.chargeId]);
  assert.match(card, /data-action="cancel-edit"[^>]*>Cancel/);
  assert.match(card, /data-action="confirm-item-list"[^>]*>Confirm items/);
  assert.doesNotMatch(card, /data-action="confirm-selection"/);
  const footer = f.context.runtime.splitFooter(f.chargeId, true);
  assert.match(footer, /data-action="submit-proposal"[^>]*>Propose changes/);
  await f.click(action);
  assert.deepEqual(f.calls.map(call => call.method), ['confirmReceiptList']);
  assert.equal(f.state.stack.at(-1)?.type, 'select-items');
  assert.deepEqual(f.currentCharge().receipt!.locked, []);
  assert.ok(f.currentCharge().receipt!.items.every(item => item.people.length === 0));
}

// Transport failure and both stale guards retain the reviewed draft and do not navigate.
for (const failure of ['transport', 'owner', 'revision'] as const) {
  const f = fixture();
  f.open();
  await f.click('toggle-selection', {item: 'a'});
  const draft = JSON.stringify(f.state.selectionDrafts[f.chargeId]);
  if (failure === 'transport') f.fail();
  else if (failure === 'owner') d.confirmItemSelection(f.db, PEER, f.chargeId, ['a'], d.receiptListKey(f.currentCharge().receipt!), NOW);
  else d.confirmReceiptList(f.db, PEER, f.chargeId, {...list, image: 'data:image/png;base64,REVG'}, NOW, d.chargeEditKey(f.currentCharge()));
  const before = JSON.stringify(f.db);
  await f.clickFooter('Propose changes');
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].method, 'confirmItemSelection');
  assert.equal(JSON.stringify(f.state.selectionDrafts[f.chargeId]), draft);
  assert.equal(f.state.stack.at(-1)?.type, 'select-items');
  assert.equal(JSON.stringify(f.db), before);
  assert.ok(f.messages.at(-1)?.includes('could not be saved'));
  if (failure !== 'transport') assert.ok(f.lastError instanceof d.StaleStateError);
}

// One footer submission confirms exactly the reviewed selection, including no items.
for (const selected of [[], ['a']]) {
  const f = fixture();
  f.open();
  for (const item of selected) await f.click('toggle-selection', {item});
  const key = f.state.selectionDrafts[f.chargeId].receiptKey;
  await f.clickFooter('Propose changes');
  assert.deepEqual(f.calls, [{method: 'confirmItemSelection', args: [f.chargeId, selected, key]}]);
  assert.deepEqual(f.currentCharge().receipt!.locked, [SELF]);
  assert.equal(f.currentCharge().status, 'pending');
  assert.equal(f.state.selectionDrafts[f.chargeId], undefined);
  assert.equal(f.state.stack.at(-1)?.type, 'split');
}

// Last confirmation settles once and keeps the peer's exclusive item unchanged.
{
  const f = fixture();
  d.confirmItemSelection(f.db, PEER, f.chargeId, ['b'], d.receiptListKey(f.currentCharge().receipt!), NOW);
  f.refresh(); f.open();
  await f.click('toggle-selection', {item: 'b'});
  assert.deepEqual(clone(f.state.selectionDrafts[f.chargeId].ids), []);
  await f.click('toggle-selection', {item: 'a'});
  await f.clickFooter('Propose changes');
  assert.equal(f.calls.length, 1);
  assert.equal(f.currentCharge().status, 'settled');
  assert.deepEqual(f.currentCharge().receipt!.items.map(item => item.people), [[SELF], [PEER]]);
  assert.equal(f.db.ledger.filter(entry => entry.chargeId === f.chargeId && entry.kind === 'charge')
    .reduce((sum, entry) => sum - entry.amount, 0), 103);
  assert.ok(!f.context.pending.some((charge: PhoneCharge) => charge.id === f.chargeId));
  assert.equal(f.state.selectionDrafts[f.chargeId], undefined);
  assert.equal(f.messages.at(-1), 'This charge has settled.');
}

// A fresh receipt revision invalidates local choices even after A -> B -> A
// restores identical content. An unchanged list/key preserves unsent selection.
for (const revision of ['unchanged', 'image', 'restored-image'] as const) {
  const f = fixture();
  f.open();
  await f.click('toggle-selection', {item: 'a'});
  const old = clone(f.state.selectionDrafts[f.chargeId]);
  f.state.splitDrafts[f.chargeId] = clone(f.state.proposalDetails[f.chargeId]);
  f.state.stack.push({type: 'split-edit', id: f.chargeId});
  if (revision !== 'unchanged') {
    d.confirmReceiptList(f.db, PEER, f.chargeId, {...list, image: 'data:image/png;base64,REVG'}, NOW, d.chargeEditKey(f.currentCharge()));
    if (revision === 'restored-image') d.confirmReceiptList(f.db, PEER, f.chargeId, list, NOW, d.chargeEditKey(f.currentCharge()));
    f.refresh();
  }
  if (revision === 'restored-image') assert.equal(old.signature, f.context.runtime.itemListSignature(f.state.proposalDetails[f.chargeId]));
  assert.equal(f.context.runtime.advanceItemSelection(f.chargeId), true);
  const next = f.state.selectionDrafts[f.chargeId];
  assert.deepEqual(clone(next.ids), revision === 'unchanged' ? ['a'] : []);
  assert.equal(next.receiptKey, d.receiptListKey(f.currentCharge().receipt!));
  assert.equal(f.state.splitDrafts[f.chargeId], undefined);
  assert.equal(f.state.stack.filter(route => route.type === 'select-items').length, 1);
  assert.equal(f.calls.length, 0);
}


function customFixture(amount = 10000) {
  const f = fixture(amount, false), charge = f.context.pending[0];
  const draft = {...clone(f.state.proposalDetails[f.chargeId]), method: 'custom', allocation: [...charge.allocation]} as any;
  f.state.splitDrafts[f.chargeId] = draft;
  f.state.stack.push({type: 'split-edit', id: f.chargeId});
  return Object.assign(f, {charge, draft});
}
function submitTag(markup: string) {
  const tag = markup.match(/<button\b[^>]*data-draft-submit\b[^>]*>/)?.[0];
  assert.ok(tag, 'The custom footer must expose its draft submit button');
  return tag;
}

// Initial custom rendering and live refresh agree; invalid totals never normalize
// the viewer's percentage or fall back to their published allocation.
for (const test of [
  {unit: 'dollars', values: ['20', '30', '40'], own: 20, valid: false},
  {unit: 'dollars', values: ['20', '30', '60'], own: 20, valid: false},
  {unit: 'dollars', values: ['20', '30', '50'], own: 20, valid: true},
  {unit: 'dollars', values: ['20', '', '80'], own: 20, valid: false},
  {unit: 'dollars', values: ['', '50', '50'], own: null, valid: false},
  {unit: 'dollars', values: ['0', '50', '50'], own: 0, valid: true},
  {unit: 'percent', values: ['30', '30', '30'], own: 30, valid: false},
  {unit: 'percent', values: ['30', '50', '30'], own: 30, valid: false},
  {unit: 'percent', values: ['30', '30', '40'], own: 30, valid: true},
  {unit: 'percent', values: ['30', '', '70'], own: 30, valid: false},
  {unit: 'percent', values: ['', '50', '50'], own: null, valid: false},
  {unit: 'percent', values: ['0', '50', '50'], own: 0, valid: true},
]) {
  const f = customFixture(), api = f.context.runtime;
  f.state.splitUnits[f.chargeId] = test.unit;
  if (test.unit === 'percent') f.draft.percentageDraft = {...api.makePercentageDraft(f.draft.allocation), values: test.values};
  else f.draft.allocation = test.values;
  const before = JSON.stringify(f.db), raw = JSON.stringify(f.draft);
  assert.equal(api.draftPersonalAllocation(f.charge, f.draft), test.own);
  api.splitEdit(f.chargeId);
  assert.equal(f.context.flowShare, test.own, 'Initial top share must use the draft preview');
  const footer = api.splitFooter(f.chargeId, true);
  assert.equal(/\bdisabled\b/.test(submitTag(footer)), !test.valid);
  const rows = api.memberAllocations(f.charge, f.draft, true);
  assert.match(rows, /id="draft-total"/);
  if (!test.valid) {
    assert.match(rows, /Split must total to \$100\.00/);
    assert.ok(rows.indexOf('id="draft-total"') > rows.lastIndexOf('class="person-row"'));
    assert.match(rows, /class="[^"]*form-error[^"]*"[^>]*id="draft-total"|id="draft-total"[^>]*class="[^"]*form-error/);
  } else assert.doesNotMatch(rows, /Split must total to/);
  api.refreshDraftSummary(f.charge, f.draft);
  assert.equal(f.dom.share.textContent, test.own === null ? '—' : `$${test.own.toFixed(2)}`);
  assert.equal(f.dom.submit.disabled, !test.valid);
  assert.equal(f.dom.error.textContent, test.valid ? '' : 'Split must total to $100.00');
  assert.equal(f.dom.error.hidden, test.valid);
  assert.equal(JSON.stringify(f.draft), raw, 'Preview must not rewrite raw draft data');
  if (!test.valid) {
    await f.click('submit-proposal'); // Validation remains effective even if a stale event bypasses disabled UI.
    assert.equal(f.calls.length, 0);
    assert.equal(f.state.stack.at(-1)?.type, 'split-edit');
  }
  assert.equal(JSON.stringify(f.db), before);
}

// Valid amounts use canonical remainder cents, and unchanged percent baselines
// retain their exact original cents rather than reverse-calculating rounded text.
{
  const f = customFixture(1), api = f.context.runtime;
  f.draft.percentageDraft = {...api.makePercentageDraft(f.draft.allocation), values: ['50', '40', '0']};
  assert.equal(api.draftPersonalAllocation(f.charge, f.draft), 0.01);
  f.draft.percentageDraft.values[1] = '50';
  assert.deepEqual(clone(api.calculateProposal(f.charge, f.draft).allocation), [0, 0.01, 0]);
  assert.equal(api.draftPersonalAllocation(f.charge, f.draft), 0);
}
{
  const f = customFixture(1000003), api = f.context.runtime;
  f.draft.allocation = [5000.01, 5000.02, 0];
  f.draft.percentageDraft = api.makePercentageDraft(f.draft.allocation);
  assert.deepEqual(clone(f.draft.percentageDraft.values), ['50', '50', '0']);
  assert.equal(api.draftPersonalAllocation(f.charge, f.draft), 5000.01);
  assert.deepEqual(clone(api.calculateProposal(f.charge, f.draft).allocation), f.draft.allocation);
}

// The real input handler updates existing nodes, preserving typing/caret and
// draft strings while switching button/error state in both units.
for (const unit of ['dollars', 'percent']) {
  const f = customFixture(), api = f.context.runtime;
  f.state.splitUnits[f.chargeId] = unit;
  f.draft.allocation = [20, 30, 50];
  if (unit === 'percent') f.draft.percentageDraft = api.makePercentageDraft(f.draft.allocation);
  const before = JSON.stringify(f.db);
  const input = {dataset: {draftField: unit === 'percent' ? 'percentage' : 'allocation', person: '0'},
    value: '21.', style: {}, selectionStart: 3, selectionEnd: 3};
  const renderCount = f.renders;
  f.input(input);
  assert.equal(input.value, '21.');
  assert.equal(input.selectionStart, 3); assert.equal(input.selectionEnd, 3);
  assert.equal((unit === 'percent' ? f.draft.percentageDraft.values : f.draft.allocation)[0], '21.');
  assert.equal(f.dom.share.textContent, '$21.00');
  assert.equal(f.dom.submit.disabled, true);
  assert.equal(f.dom.error.textContent, 'Split must total to $100.00');
  assert.equal(f.dom.error.hidden, false);
  f.input({dataset: {...input.dataset, person: '2'}, value: '49', style: {}});
  assert.equal(f.dom.submit.disabled, false);
  assert.equal(f.dom.error.textContent, '');
  assert.equal(f.dom.error.hidden, true);
  assert.equal(f.dom.share.textContent, '$21.00');
  assert.equal(f.renders, renderCount);
  assert.equal(f.calls.length, 0);
  assert.equal(JSON.stringify(f.db), before);
}

// Equal proposals and item selection retain active footers; inline list Cancel
// only discards its unsent editor and does not publish or approve anything.
{
  const f = customFixture(), api = f.context.runtime;
  f.draft.method = 'equal';
  f.draft.allocation = ['', '', ''];
  assert.doesNotMatch(api.splitFooter(f.chargeId, true), /\bdisabled\b/);
  assert.equal(api.draftPersonalAllocation(f.charge, f.draft), api.calculateProposal(f.charge, f.draft).allocation[0]);
}
{
  const f = fixture(), before = JSON.stringify(f.db);
  f.state.splitDrafts[f.chargeId] = clone(f.state.proposalDetails[f.chargeId]);
  f.state.stack.push({type: 'split-edit', id: f.chargeId});
  await f.click('cancel-edit');
  assert.equal(f.state.splitDrafts[f.chargeId], undefined);
  assert.equal(f.calls.length, 0);
  assert.equal(JSON.stringify(f.db), before);
}

// Extract the actual public methods too: testing only the inner update misses
// an accidental second render in the mounted instance's update wrapper.
const mountedReturn = body.find(node => node.type === 'ReturnStatement'
  && node.argument?.type === 'ObjectExpression');
assert.ok(mountedReturn?.type === 'ReturnStatement' && mountedReturn.argument?.type === 'ObjectExpression');
const mountedMethods = source.slice(mountedReturn.argument.start, mountedReturn.argument.end);
function transitionFixture() {
  const events: string[] = [];
  const panes = {app: {innerHTML: 'current pane'}, modal: {innerHTML: 'current modal'}};
  const screen = {getAnimations: () => []};
  const transition = {
    refresh: false, nextTab: null as string | null,
    outgoing: {remove() { events.push('remove outgoing'); }},
    incoming: {classList: {remove(name: string) { events.push(`remove class ${name}`); }}},
    animations: [0, 1].map(index => ({cancel() { events.push(`cancel ${index}`); }})),
  };
  const context: any = {
    activeTabTransition: transition, disposed: false, busy: false, focusedForm: false,
    pendingMotionRefresh: null, renderedRouteKey: 'groups:',
    state: {tab: 'groups', stack: [], splitDrafts: {kept: true}, selectionDrafts: {kept: true}},
    routeKey: () => `${context.state.tab}:`,
    $: () => screen,
    adopt(next: {version: number}) { events.push(`adopt ${next.version}`); },
    routeChanged() { events.push('route'); },
    safeRender() { events.push('refresh'); },
    render() { events.push(`render ${context.state.tab}`); },
    syncRoute() { events.push(`sync ${context.state.tab}`); },
    saveScroll() { events.push('save scroll'); },
    document: {activeElement: {closest() { return {}; }}},
    root: {contains() { return context.focusedForm; },
      querySelector: (selector: string) => selector === '#app' ? panes.app : panes.modal},
    listeners: {abort() { events.push('abort'); }},
    toastTimer: 1, searchTimer: 2,
    clearTimeout(timer: number) { events.push(`clear timer ${timer}`); },
  };
  runInNewContext(['update', 'refreshAfterMotion', 'nav', 'finishTabTransition'].map(declaration).join('\n')
    + `\nthis.mounted=${mountedMethods};this.lifecycle={update,nav,finishTabTransition};`, context);
  return {context, transition, events, panes};
}

// Public and inner update each adopt, reconcile the URL, and render exactly once.
{
  const f = transitionFixture();
  f.context.activeTabTransition = null;
  for (const update of [f.context.lifecycle.update, f.context.mounted.update]) {
    f.events.length = 0;
    update({version: 7});
    assert.deepEqual(f.events, ['adopt 7', 'route', 'refresh']);
  }
  f.events.length = 0;
  f.context.busy = true;
  f.context.mounted.update({version: 8});
  assert.deepEqual(f.events, ['adopt 8']);
  f.events.length = 0;
  f.context.busy = false;
  f.context.focusedForm = true;
  f.context.mounted.update({version: 9});
  assert.deepEqual(f.events, ['adopt 9', 'route']);
  f.events.length = 0;
  f.context.disposed = true;
  f.context.mounted.update({version: 10});
  assert.deepEqual(f.events, []);
}

// A snapshot/URL echo during the same tab swipe must leave both panes intact.
{
  const f = transitionFixture(), screen = {scrollTop: 73};
  Object.assign(f.context, {
    current: () => ({type: 'groups'}), routeKey: () => 'groups:',
    renderedRouteKey: 'groups:', renderRevision: 4,
    $: (selector: string) => selector === '#app' ? f.panes.app : screen,
  });
  runInNewContext(declaration('render') + '\nthis.renderDuringTransition=render;', f.context);
  f.context.renderDuringTransition();
  f.context.renderDuringTransition();
  assert.equal(f.transition.refresh, true);
  assert.equal(f.context.activeTabTransition, f.transition);
  assert.equal(f.context.renderRevision, 4);
  assert.equal(f.panes.app.innerHTML, 'current pane');
  assert.equal(screen.scrollTop, 73);
  assert.deepEqual(f.events, [], 'Deferral must not cancel animations, remove panes or render');
}

// Rapid taps keep the active pane until completion, then flush only the latest
// different tab. A queued navigation takes precedence over a deferred refresh.
{
  const f = transitionFixture();
  const before = JSON.stringify(f.context.state);
  f.context.lifecycle.nav('spending');
  f.context.lifecycle.nav('groups');
  f.context.lifecycle.nav('home');
  assert.equal(f.transition.nextTab, 'home');
  assert.equal(JSON.stringify(f.context.state), before);
  assert.deepEqual(f.events, []);
  f.transition.refresh = true;
  f.context.lifecycle.finishTabTransition(true);
  assert.equal(f.context.activeTabTransition, null);
  assert.equal(f.context.state.tab, 'home');
  assert.deepEqual(f.events, ['remove outgoing', 'remove class tab-incoming', 'cancel 0', 'cancel 1',
    'save scroll', 'render home', 'sync home']);
  f.context.lifecycle.finishTabTransition(true);
  assert.equal(f.events.length, 7, 'Finishing twice must not repeat cleanup or navigation');
}

// No queued change (including a last tap on the current tab) flushes at most one refresh.
for (const queued of [null, 'groups']) {
  const f = transitionFixture();
  f.transition.nextTab = queued;
  f.transition.refresh = true;
  f.context.lifecycle.finishTabTransition(true);
  assert.deepEqual(f.events, ['remove outgoing', 'remove class tab-incoming', 'cancel 0', 'cancel 1', 'refresh']);
  assert.equal(f.context.state.tab, 'groups');
}

// Disposal still removes both transition artifacts/animation handles, but cannot
// flush queued navigation or redraw content after the mounted host is cleared.
{
  const f = transitionFixture();
  f.transition.nextTab = 'home';
  f.transition.refresh = true;
  f.context.mounted.destroy();
  assert.equal(f.context.disposed, true);
  assert.equal(f.context.activeTabTransition, null);
  assert.equal(f.panes.app.innerHTML, '');
  assert.equal(f.panes.modal.innerHTML, '');
  assert.deepEqual(f.events, ['abort', 'clear timer 1', 'clear timer 2',
    'remove outgoing', 'remove class tab-incoming', 'cancel 0', 'cancel 1']);
  f.context.mounted.update({version: 11});
  f.context.lifecycle.finishTabTransition(true);
  assert.equal(f.events.length, 7);
  assert.equal(f.context.state.tab, 'groups');
}
{
  const f = transitionFixture();
  f.context.disposed = true;
  f.transition.nextTab = 'home';
  f.transition.refresh = true;
  f.context.lifecycle.finishTabTransition(true);
  assert.deepEqual(f.events, ['remove outgoing', 'remove class tab-incoming', 'cancel 0', 'cancel 1']);
}

// Model browser animation completion without replacing the production refresh
// scheduler. A reversed animation gets a new finished promise, as in the browser.
function motion(playState = 'running', endTime = 280, pending = false) {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const result = {
    playState, pending,
    effect: {getComputedTiming: () => ({endTime})},
    finished: Promise.resolve(),
    restart() {
      result.playState = 'running';
      result.pending = false;
      result.finished = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
    },
    finish() { result.playState = 'finished'; result.pending = false; resolve(); },
    cancel() { result.playState = 'idle'; result.pending = false; reject(Error('Animation canceled')); },
  };
  result.restart();
  result.playState = playState;
  result.pending = pending;
  return result;
}
type TestMotion = ReturnType<typeof motion>;

function motionFixture(animations: TestMotion[] = []) {
  const adopted: number[] = [], refreshed: {version: number; key: string}[] = [];
  const initialScreen = {getAnimations(options: {subtree: boolean}) {
    assert.equal(options.subtree, true, 'Card and carousel descendants must participate in the wait');
    return animations;
  }};
  let screen: any = initialScreen;
  const panes = {app: {innerHTML: 'current screen'}, modal: {innerHTML: ''}};
  const context: any = {
    disposed: false, busy: false, focusedForm: false, pendingMotionRefresh: null,
    renderedRouteKey: 'group:g', key: 'group:g', version: 0,
    document: {activeElement: {closest: () => ({})}},
    root: {contains: () => context.focusedForm,
      querySelector: (selector: string) => selector === '#app' ? panes.app : panes.modal},
    $: () => screen,
    routeKey: () => context.key,
    adopt(next: {version: number; route?: string}) {
      adopted.push(next.version);
      context.version = next.version;
      context.nextRoute = next.route;
    },
    routeChanged() { if (context.nextRoute) context.key = context.nextRoute; },
    safeRender() {
      refreshed.push({version: context.version, key: context.key});
      context.renderedRouteKey = context.key;
      screen = {getAnimations: () => []};
    },
    listeners: {abort() {}}, toastTimer: 0, searchTimer: 0,
    clearTimeout() {}, finishTabTransition() {},
  };
  runInNewContext(['update', 'refreshAfterMotion'].map(declaration).join('\n')
    + `\nthis.mounted=${mountedMethods};`, context);
  return {context, adopted, refreshed, animations, initialScreen, panes,
    update(version: number, route?: string) { context.mounted.update({version, route}); },
    get screen() { return screen; },
    replaceScreen() { screen = {getAnimations: () => []}; },
  };
}
const settleMotion = () => new Promise<void>(resolve => setImmediate(resolve));

// Use the real router reconciler with the same mounted update/animation
// lifecycle: store notifications may arrive before the URL reflects a local push.
function bridgeRouteFixture(animations: TestMotion[] = []) {
  const f = motionFixture(animations), context = f.context;
  Object.assign(context, {
    lastBridgeRouteKey: null,
    state: {tab: 'groups', stack: []},
    bridge: {route: {type: 'groups', tab: 'groups'}},
    renderedRouteKey: 'groups:',
  });
  const renderSnapshot = context.safeRender;
  context.safeRender = () => { context.key = context.routeKey(); renderSnapshot(); };
  runInNewContext(['current', 'routeKey', 'routeChanged'].map(declaration).join('\n'), context);
  context.routeChanged();
  return f;
}

{
  const entrance = motion(), f = bridgeRouteFixture([entrance]);
  // The click has already pushed/rendered the group, but selectGroup publishes
  // a store snapshot while the bridge still reports the previous Groups URL.
  const stack = [{type: 'group', id: 'g'}];
  f.context.state.stack = stack;
  f.context.renderedRouteKey = 'group:g';
  f.update(1);
  f.update(2);
  assert.equal(f.context.state.stack, stack, 'An unchanged old URL must not undo the local push');
  assert.equal(f.context.routeKey(), 'group:g');
  assert.equal(f.screen, f.initialScreen);
  assert.deepEqual(f.refreshed, []);

  // The matching router echo acknowledges the push without replacing its stack
  // or animated DOM. Finishing the entrance flushes the latest data exactly once.
  f.context.bridge.route = {type: 'group', id: 'g', tab: 'groups'};
  f.update(3);
  assert.equal(f.context.lastBridgeRouteKey, 'group:g');
  assert.equal(f.context.state.stack, stack);
  assert.deepEqual(f.refreshed, []);
  entrance.finish();
  await settleMotion();
  assert.deepEqual(f.refreshed, [{version: 3, key: 'group:g'}]);

  // Browser Back is a newly changed URL, even though it was seen before the
  // push. It must still navigate to Groups after the matching echo was recorded.
  f.context.bridge.route = {type: 'groups', tab: 'groups'};
  f.update(4);
  assert.equal(f.context.routeKey(), 'groups:');
  assert.equal(f.context.state.stack.length, 0);
  assert.deepEqual(f.refreshed.at(-1), {version: 4, key: 'groups:'});
}
{
  const f = bridgeRouteFixture();
  f.context.bridge.route = {type: 'group', id: 'g2', tab: 'spending'};
  f.update(1);
  assert.equal(f.context.routeKey(), 'group:g2');
  assert.equal(f.context.state.tab, 'spending');
  assert.deepEqual(clone(f.context.state.stack), [{type: 'group', id: 'g2'}]);
  assert.deepEqual(f.refreshed, [{version: 1, key: 'group:g2'}]);
  f.context.bridge.route = {type: 'home'};
  f.update(2);
  assert.equal(f.context.state.tab, 'home');
  assert.deepEqual(clone(f.context.state.stack), []);
  assert.deepEqual(f.refreshed.at(-1), {version: 2, key: 'home:'});
}

// CSS entry, card arrival, and carousel motion share a screen. Store refreshes
// and URL echoes must adopt immediately without replacing any animated DOM.
{
  const entry = motion(), card = motion('running', 580), carousel = motion('idle', 360, true);
  const f = motionFixture([entry, card, carousel]);
  for (const version of [1, 2, 3]) f.update(version, 'group:g');
  assert.deepEqual(f.adopted, [1, 2, 3]);
  assert.deepEqual(f.refreshed, []);
  assert.equal(f.screen, f.initialScreen);
  entry.finish();
  await settleMotion();
  assert.equal(f.screen, f.initialScreen, 'Finishing entry alone must not truncate card/carousel motion');
  f.update(4, 'group:g');
  card.finish();
  await settleMotion();
  assert.deepEqual(f.refreshed, []);
  carousel.finish();
  await settleMotion();
  assert.deepEqual(f.refreshed, [{version: 4, key: 'group:g'}], 'All echoes coalesce into the latest snapshot');
  assert.notEqual(f.screen, f.initialScreen);
  await settleMotion();
  assert.equal(f.refreshed.length, 1);
}

// Canceled CSS motion can be replaced, and reversing the same animation handle
// starts another completion promise. Neither event grants permission to redraw early.
for (const change of ['cancel and replace', 'reverse same handle'] as const) {
  const first = motion(), f = motionFixture([first]);
  f.update(1);
  let current: TestMotion;
  if (change === 'cancel and replace') {
    first.cancel();
    current = motion('running', 360);
    f.animations.splice(0, 1, current);
  } else {
    first.finish();
    first.restart();
    current = first;
  }
  await settleMotion();
  assert.deepEqual(f.refreshed, [], change);
  assert.equal(f.screen, f.initialScreen);
  f.update(2);
  current.finish();
  await settleMotion();
  assert.deepEqual(f.refreshed, [{version: 2, key: 'group:g'}], change);
}

// Decorative loops, paused effects, and zero-duration/reduced-motion effects
// must not hold fresh data hostage to a finished promise that may never resolve.
for (const ignored of [motion('running', Infinity), motion('paused'), motion('running', 0), motion('finished')]) {
  const f = motionFixture([ignored]);
  f.update(1);
  assert.deepEqual(f.refreshed, [{version: 1, key: 'group:g'}]);
}
{
  const f = motionFixture();
  delete (f.initialScreen as {getAnimations?: unknown}).getAnimations;
  f.update(1);
  assert.deepEqual(f.refreshed, [{version: 1, key: 'group:g'}], 'Browsers without animation inspection still refresh');
}

// A URL navigation must render its destination immediately, even while the
// previous route moves; that old completion may not redraw the destination.
{
  const active = motion(), f = motionFixture([active]);
  f.update(1);
  f.update(2, 'profile:');
  assert.deepEqual(f.refreshed, [{version: 2, key: 'profile:'}]);
  active.finish();
  await settleMotion();
  assert.equal(f.refreshed.length, 1);
}
for (const invalidation of ['route', 'screen', 'unmount'] as const) {
  const active = motion(), f = motionFixture([active]);
  f.update(1);
  if (invalidation === 'route') f.context.key = 'profile:';
  if (invalidation === 'screen') f.replaceScreen();
  if (invalidation === 'unmount') f.context.mounted.destroy();
  active.finish();
  await settleMotion();
  assert.deepEqual(f.refreshed, [], `Stale completion after ${invalidation}`);
  if (invalidation === 'unmount') {
    assert.equal(f.context.pendingMotionRefresh, null);
    assert.equal(f.panes.app.innerHTML, '');
    f.update(2);
    assert.deepEqual(f.adopted, [1]);
  }
}

// Work or form editing can begin while an animation is settling. Its callback
// must respect those guards, and the next eligible update catches up once.
for (const guard of ['busy', 'focusedForm'] as const) {
  const active = motion(), f = motionFixture([active]);
  f.context[guard] = true;
  f.update(1);
  assert.deepEqual(f.adopted, [1]);
  assert.deepEqual(f.refreshed, []);
  f.context[guard] = false;
  f.update(2);
  f.context[guard] = true;
  active.finish();
  await settleMotion();
  assert.deepEqual(f.refreshed, [], `Animation completion during ${guard}`);
  f.context[guard] = false;
  f.update(3);
  assert.deepEqual(f.refreshed, [{version: 3, key: 'group:g'}]);
}

console.log('PASS phone runtime: item actions and draft isolation, custom preview/validation and canonical cents, input preservation, one-render updates, queued tab transitions, motion-preserving snapshots, and disposal cleanup.');
