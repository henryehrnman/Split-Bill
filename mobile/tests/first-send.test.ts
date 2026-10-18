import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createFirstSendController} from '../src/lib/firstSend.ts';

const sent = {sent: true};
type Result = typeof sent;

function deferred<Result>() {
  let resolve!: (value: Result) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<Result>((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}

test('repeated leave events share one pending default and a successful send is not repeated', async () => {
  const request = deferred<Result | null>();
  let calls = 0;
  const controller = createFirstSendController({canSend: () => true, sendDefault: () => { calls++; return request.promise; }});
  const leaving = controller.leave();
  assert.equal(await controller.leave(), null);
  assert.equal(await controller.manual(async () => { throw Error('Must not overlap the default.'); }), null);
  assert.equal(calls, 1);
  request.resolve(sent);
  assert.equal(await leaving, sent);
  controller.returnToScreen();
  await controller.leave();
  assert.equal(calls, 1);
});

test('failed or busy default stays retryable without looping', async () => {
  let calls = 0;
  const controller = createFirstSendController({canSend: () => true, sendDefault: async () => ++calls === 1 ? null : sent});
  assert.equal(await controller.leave(), null);
  assert.equal(calls, 1);
  controller.returnToScreen();
  assert.equal(await controller.leave(), sent);
  assert.equal(calls, 2);
});

test('an unexpected default rejection stays retryable and does not escape cleanup', async () => {
  let calls = 0;
  const controller = createFirstSendController({canSend: () => true, sendDefault: async () => {
    if (++calls === 1) throw Error('Offline');
    return sent;
  }});
  assert.equal(await controller.leave(), null);
  assert.equal(await controller.leave(), sent);
  assert.equal(calls, 2);
});

test('leaving during a successful manual send waits and never sends a default', async () => {
  const request = deferred<Result | null>();
  let defaults = 0;
  const controller = createFirstSendController({canSend: () => true, sendDefault: async () => { defaults++; return sent; }});
  const manual = controller.manual(() => request.promise);
  await controller.leave();
  assert.equal(defaults, 0);
  request.resolve(sent);
  assert.equal(await manual, sent);
  await controller.leave();
  assert.equal(defaults, 0);
});

test('leaving during a failed manual send attempts the default once and remains retryable', async () => {
  const request = deferred<Result | null>();
  let defaults = 0;
  const controller = createFirstSendController({canSend: () => true, sendDefault: async () => ++defaults === 1 ? null : sent});
  const manual = controller.manual(() => request.promise);
  await controller.leave();
  await controller.leave();
  assert.equal(defaults, 0);
  request.resolve(null);
  assert.equal(await manual, null);
  assert.equal(defaults, 1);
  assert.equal(await controller.leave(), sent);
  assert.equal(defaults, 2);
});

test('returning before a manual failure preserves the draft for the user', async () => {
  const request = deferred<Result | null>();
  let defaults = 0;
  const controller = createFirstSendController({canSend: () => true, sendDefault: async () => { defaults++; return sent; }});
  const manual = controller.manual(() => request.promise);
  await controller.leave();
  controller.returnToScreen();
  request.resolve(null);
  assert.equal(await manual, null);
  assert.equal(defaults, 0);
  assert.equal(await controller.manual(async () => sent), sent);
  await controller.leave();
  assert.equal(defaults, 0);
});

test('a busy manual operation does not complete the draft or trigger a fallback while present', async () => {
  let defaults = 0;
  const controller = createFirstSendController({canSend: () => true, sendDefault: async () => { defaults++; return sent; }});
  assert.equal(await controller.manual(async () => null), null);
  assert.equal(defaults, 0);
  await controller.leave();
  assert.equal(defaults, 1);
});

test('a charge sent by another update no longer triggers a default', async () => {
  let defaults = 0;
  const request = deferred<Result | null>();
  const sendDefault = async () => { defaults++; return sent; };
  const controller = createFirstSendController({canSend: () => true, sendDefault});
  const manual = controller.manual(() => request.promise);
  await controller.leave();
  controller.update({canSend: () => false, sendDefault});
  request.resolve(null);
  await manual;
  await controller.leave();
  assert.equal(defaults, 0);
});

test('cleanup uses the original demo payer but still goes through the account guard', async () => {
  let accountCurrent = true;
  let viewer = 'payer';
  const submitted: string[] = [];
  const run = async (call: (actor: string) => Promise<Result>) => accountCurrent ? call(viewer) : null;
  const payer = viewer;
  const sendDefault = () => run(async () => { submitted.push(payer); return sent; });
  const demo = createFirstSendController({canSend: () => true, sendDefault});
  viewer = 'next-demo-viewer';
  await demo.leave();
  assert.deepEqual(submitted, ['payer']);

  const account = createFirstSendController({canSend: () => true, sendDefault});
  accountCurrent = false;
  assert.equal(await account.leave(), null);
  assert.deepEqual(submitted, ['payer'], 'an invalidated account must not invoke the API callback');
});
