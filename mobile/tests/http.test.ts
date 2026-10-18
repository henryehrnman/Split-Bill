import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRpcClient, RpcError} from '../src/lib/http.ts';

const url = 'https://example.supabase.co/functions/v1/api';
const db = {
  version: 5, seq: 1, clockOffset: 0,
  users: [{id: 'user-1'}], groups: [], cards: [], charges: [], budgetProposals: [], ledger: [], notifications: [],
};
const state = {db, viewerId: 'user-1'};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status});
const rpcError = (status: number, code?: string) => (error: unknown) => {
  assert(error instanceof RpcError);
  assert.equal(error.status, status);
  if (code) assert.equal(error.code, code);
  return true;
};

test('POST sends JWT, optional publishable key and method args without an actor field', async () => {
  const client = createRpcClient({url, publishableKey: 'public-key', getToken: async () => 'jwt', fetch: async (input, init) => {
    assert.equal(input, url);
    assert.equal(init?.method, 'POST');
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('Authorization'), 'Bearer jwt');
    assert.equal(headers.get('apikey'), 'public-key');
    assert.equal(headers.get('Content-Type'), 'application/json');
    assert.deepEqual(JSON.parse(String(init?.body)), {method: 'deposit', args: ['group-1', 1234]});
    assert(init?.signal instanceof AbortSignal);
    return json(state);
  }});
  assert.deepEqual(await client.state('deposit', ['group-1', 1234]), state);
});

test('searchUsers returns its plain array and omits absent API key', async () => {
  const users = [{id: 'user-2', name: 'Maya'}];
  const client = createRpcClient({url, getToken: () => 'jwt', fetch: async (_, init) => {
    assert.equal(new Headers(init?.headers).has('apikey'), false);
    assert.deepEqual(JSON.parse(String(init?.body)), {method: 'searchUsers', args: ['maya', []]});
    return json(users);
  }});
  assert.deepEqual(await client.request('searchUsers', ['maya', []]), users);
});

test('state validates snapshots and viewer membership while permitting schema evolution', async () => {
  for (const bad of [null, [], {db}, {...state, viewerId: 'missing'}, {...state, db: {...db, cards: null}}, {...state, db: {...db, clockOffset: '0'}}]) {
    const client = createRpcClient({url, getToken: () => 'jwt', fetch: async () => json(bad)});
    await assert.rejects(client.state('fetch'), rpcError(200, 'invalid_response'));
  }
  const evolved = {...state, db: {...db, version: 6}};
  const client = createRpcClient({url, getToken: () => 'jwt', fetch: async () => json(evolved)});
  assert.deepEqual(await client.state('fetch'), evolved);
});

test('malformed JSON is rejected instead of exposed as application state', async () => {
  const client = createRpcClient({url, getToken: () => 'jwt', fetch: async () => new Response('<html>not JSON</html>')});
  await assert.rejects(client.request('fetch'), rpcError(200, 'invalid_response'));
});

test('domain errors preserve message, code and HTTP status without retrying writes', async () => {
  let calls = 0;
  const client = createRpcClient({url, getToken: () => 'jwt', fetch: async () => {
    calls++;
    return json({error: 'Unlock your selection to change it.', code: 'rule_violation'}, 409);
  }});
  await assert.rejects(client.request('toggleClaim', ['charge-1', 'item-1']), error => {
    assert(rpcError(409, 'rule_violation')(error));
    assert.equal((error as RpcError).message, 'Unlock your selection to change it.');
    return true;
  });
  assert.equal(calls, 1);
});

test('missing token and server 401 request a new sign-in', async () => {
  let calls = 0;
  const unauthenticated = createRpcClient({url, getToken: () => null, fetch: async () => { calls++; return json(state); }});
  await assert.rejects(unauthenticated.state('fetch'), rpcError(401, 'session_expired'));
  assert.equal(calls, 0);
  const expired = createRpcClient({url, getToken: () => 'expired', fetch: async () => json({error: 'Unauthorized', code: 'invalid_jwt'}, 401)});
  await assert.rejects(expired.request('fetch'), error => {
    assert(rpcError(401, 'invalid_jwt')(error));
    assert.match((error as RpcError).message, /Sign in again/);
    return true;
  });
});

test('offline failures are useful and do not retry a mutation', async () => {
  let calls = 0;
  const client = createRpcClient({url, getToken: () => 'jwt', fetch: async () => { calls++; throw new TypeError('Failed to fetch'); }});
  await assert.rejects(client.request('deposit', ['group-1', 100]), rpcError(0, 'network_error'));
  assert.equal(calls, 1);
});

test('timeout aborts a hung fetch even if the transport ignores the abort signal', async () => {
  let signal: AbortSignal | null | undefined;
  let calls = 0;
  const client = createRpcClient({url, timeoutMs: 20, getToken: () => 'jwt', fetch: async (_, init) => {
    calls++;
    signal = init?.signal;
    return new Promise<Response>(() => {});
  }});
  await assert.rejects(client.request('toggleClaim', ['charge-1', 'item-1']), rpcError(0, 'timeout'));
  assert.equal(signal?.aborted, true);
  assert.equal(calls, 1);
});

test('timeout includes response body reading', async () => {
  const response = json(state);
  response.text = () => new Promise<string>(() => {});
  const client = createRpcClient({url, timeoutMs: 20, getToken: () => 'jwt', fetch: async () => response});
  await assert.rejects(client.state('fetch'), rpcError(0, 'timeout'));
});

test('timed-out token retrieval cannot start a late mutation', async () => {
  let finishToken!: (token: string) => void;
  const token = new Promise<string>(resolve => { finishToken = resolve; });
  let calls = 0;
  const client = createRpcClient({url, timeoutMs: 20, getToken: () => token, fetch: async () => { calls++; return json(state); }});
  await assert.rejects(client.request('deposit', ['group-1', 100]), rpcError(0, 'timeout'));
  finishToken('jwt');
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(calls, 0);
});
