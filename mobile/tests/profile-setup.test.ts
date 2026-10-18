import assert from 'node:assert/strict';
import test from 'node:test';
import {RpcError} from '../src/lib/http.ts';
import {finishProfile} from '../src/lib/profileSetup.ts';

test('retrying setup recovers a profile committed before its response timed out', async () => {
  const profile = {viewerId: 'authenticated-user', name: 'QA profile'};
  let saved: typeof profile | null = null;
  let creates = 0;
  let reads = 0;
  const create = async () => {
    creates++;
    if (saved) throw new RpcError('You already have a profile.', 409, 'has_profile');
    saved = profile;
    throw new RpcError('The request timed out.', 0, 'timeout');
  };
  const fetchProfile = async () => { reads++; return saved; };

  await assert.rejects(finishProfile(create, fetchProfile), error => error instanceof RpcError && error.code === 'timeout');
  assert.equal(creates, 1, 'never automatically repeat a profile write');
  assert.equal(reads, 0);
  assert.equal(await finishProfile(create, fetchProfile), profile);
  assert.equal(creates, 2, 'one explicit retry by the user');
  assert.equal(reads, 1, 'load the already-created authenticated profile');
});

test('successful creation needs no follow-up fetch', async () => {
  const profile = {viewerId: 'new-user'};
  assert.equal(await finishProfile(async () => profile, async () => { throw Error('unexpected read'); }), profile);
});

test('validation and authentication errors stay on profile setup without a read or retry', async () => {
  for (const error of [new RpcError('Handle taken', 400, 'rule'), new RpcError('Session changed', 401, 'session_changed')]) {
    let creates = 0;
    await assert.rejects(finishProfile(async () => { creates++; throw error; }, async () => { throw Error('unexpected read'); }), value => value === error);
    assert.equal(creates, 1);
  }
});

test('a failed recovery read remains retryable and does not repeat profile creation', async () => {
  let creates = 0;
  const offline = new RpcError('Offline', 0, 'network_error');
  await assert.rejects(finishProfile(async () => { creates++; throw new RpcError('Exists', 409, 'has_profile'); }, async () => { throw offline; }), value => value === offline);
  assert.equal(creates, 1);
});
