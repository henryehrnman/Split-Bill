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
  'itemEditor', 'call', 'act'];
const clickHandlers = body.filter(node => node.type === 'ExpressionStatement'
  && node.expression.type === 'CallExpression' && node.expression.callee.type === 'Identifier'
  && node.expression.callee.name === 'on' && node.expression.arguments[0]?.type === 'Literal'
  && node.expression.arguments[0].value === 'click'
  && source.slice(node.start, node.end).includes('case "confirm-selection":'));
assert.equal(clickHandlers.length, 1, 'Expected one delegated selection action handler');
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
  + `\nthis.runtime={${names.join(',')}};`
  + `\nthis.renderSelection=function(id){const r={id};let html='',footer='';${selectionRender};return {html,footer};};`;

function fixture() {
  let db: Db = {version: 6, seq: 0, clockOffset: 0,
    users: [PAYER, SELF, PEER].map((id, tone) => ({id, name: id, initials: id[0], tone,
      handle: id, email: `${id}@example.test`, phone: ''})),
    groups: [], cards: [], charges: [], budgetProposals: [], ledger: [], notifications: []};
  const group = d.createGroup(db, PAYER, {name: 'Runtime group', budget: 6000, periodDays: 30, inviteIds: [SELF, PEER]}, NOW);
  for (const id of [SELF, PEER]) d.respondInvite(db, id, group.id, true, NOW, 2000);
  d.addToWallet(db, PAYER, d.cardFor(db, group.id, PAYER)!.id, 'Apple Wallet');
  const chargeId = d.purchase(db, PAYER, group.id, {merchant: 'Runtime receipt', amount: 103}, NOW).id;
  d.confirmReceiptList(db, PAYER, chargeId, list, NOW, d.chargeEditKey(db.charges[0]));
  const snapshot = projectPhoneSnapshot(db, SELF, NOW);
  const state = {...snapshot.state, tab: 'home', stack: [{type: 'split', id: chargeId}],
    splitDrafts: {} as Record<string, any>, selectionDrafts: {} as Record<string, any>};
  const calls: {method: string; args: any[]}[] = [];
  const messages: string[] = [];
  let handler: (event: any) => void;
  let work: Promise<void> | undefined;
  let failTransport = false;
  let lastError: unknown;
  const context: any = {
    state, pending: snapshot.pending, busy: false, disposed: false, suppressCardClickUntil: 0,
    root: {setAttribute() {}, removeAttribute() {}}, $: () => null,
    on: (_type: string, callback: (event: any) => void) => { handler = callback; },
    chargePeople: (charge: PhoneCharge) => charge.people,
    currentProposal: (charge: PhoneCharge) => state.proposalDetails[charge.id],
    current: () => state.stack.at(-1) ?? {type: state.tab},
    push: (type: string, id: string) => state.stack.push({type, id}),
    saveScroll() {}, render() {}, safeRender() {}, syncRoute() {},
    toast: (message: string) => messages.push(message),
    money: (value: number) => `$${value.toFixed(2)}`, esc: String, icon: () => '',
    backbar: (title: string) => `<header>${title}</header>`,
    itemFlowShell: (_charge: unknown, _proposal: unknown, card: string) => card,
    receiptEntryActions: () => '', customInputWidth: () => 4, draftValidationText: () => '',
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
    handler!({target: {closest: () => target}, preventDefault() {}});
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
  return {context, state, calls, messages, chargeId, click, clickFooter, currentCharge,
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

// Receipt-list editing uses the same footer but cannot accidentally approve items.
{
  const f = fixture();
  f.state.splitDrafts[f.chargeId] = clone(f.state.proposalDetails[f.chargeId]);
  f.state.stack.push({type: 'split-edit', id: f.chargeId});
  const card = f.context.runtime.itemEditor(f.context.pending[0], f.state.splitDrafts[f.chargeId]);
  assert.doesNotMatch(card, /data-action="(?:submit-proposal|cancel-edit|confirm-selection)"/);
  const footer = f.context.runtime.splitFooter(f.chargeId, true);
  assert.match(footer, /data-action="submit-proposal"[^>]*>Propose changes/);
  await f.click('submit-proposal');
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

console.log('PASS phone runtime: shared footer wiring, draft-only selection/cancel, failed and stale submissions, zero items, settlement, and receipt revision reset.');
