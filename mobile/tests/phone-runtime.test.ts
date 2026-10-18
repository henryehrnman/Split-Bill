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

console.log('PASS phone runtime: inline list/shared selection actions, draft isolation and stale guards, settlement, receipt revisions, live custom preview/validation, canonical cents, and input preservation.');
