import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createClient} from '@supabase/supabase-js';
import {AuthTimeoutError, createAuthFetch} from '../src/lib/authFetch.ts';

const url = 'https://auth.example.com/auth/v1/token';
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json', 'x-request-id': 'test-request'}});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return {promise, resolve};
}

function session(email: string) {
  const id = email.startsWith('alice') ? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' : 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const accessToken = [JSON.stringify({alg: 'none', typ: 'JWT'}), JSON.stringify({sub: id, exp: expires, aud: 'authenticated'})]
    .map(value => Buffer.from(value).toString('base64url')).join('.') + '.test-signature';
  return {access_token: accessToken, refresh_token: `test-refresh-${id}`, expires_in: 3600, expires_at: expires, token_type: 'bearer',
    user: {id, email, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString()}};
}

function authClient(send: typeof fetch) {
  return createClient('https://auth.example.com', 'test-public-key', {
    auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false},
    global: {fetch: createAuthFetch({fetch: send, timeoutMs: 20})},
  });
}

test('auth transport preserves request options, JSON errors, headers and empty responses', async () => {
  for (const status of [200, 401, 204]) {
    const response = status === 204 ? new Response(null, {status}) : json({message: 'Server response'}, status);
    const send = createAuthFetch({fetch: async (input, init) => {
      assert.equal(input, url);
      assert.equal(init?.method, 'POST');
      assert.equal(init?.body, '{"example":true}');
      assert.equal(new Headers(init?.headers).get('apikey'), 'test-key');
      assert(init?.signal instanceof AbortSignal);
      return response;
    }});
    const result = await send(url, {method: 'POST', headers: {apikey: 'test-key'}, body: '{"example":true}'});
    assert.equal(result.status, status);
    if (status === 204) assert.equal(await result.text(), '');
    else {
      assert.equal(result.headers.get('x-request-id'), 'test-request');
      assert.deepEqual(await result.json(), {message: 'Server response'});
    }
  }
});

test('stalled response headers time out and abort even when fetch ignores cancellation', async () => {
  let signal: AbortSignal | null | undefined;
  let calls = 0;
  const send = createAuthFetch({timeoutMs: 20, fetch: async (_, init) => {
    calls++;
    signal = init?.signal;
    return new Promise<Response>(() => {});
  }});
  await assert.rejects(send(url), AuthTimeoutError);
  assert.equal(signal?.aborted, true);
  assert.equal(calls, 1);
});

test('caller cancellation propagates and pre-aborted requests never reach fetch', async () => {
  const caller = new AbortController();
  let signal: AbortSignal | null | undefined;
  let calls = 0;
  const send = createAuthFetch({fetch: async (_, init) => {
    calls++;
    signal = init?.signal;
    return new Promise<Response>(() => {});
  }});
  const pending = send(url, {signal: caller.signal});
  caller.abort();
  await assert.rejects(pending, {name: 'AbortError'});
  assert.equal(signal?.aborted, true);
  await assert.rejects(send(new Request(url, {signal: caller.signal})), {name: 'AbortError'});
  assert.equal(calls, 1);
});

for (const stalled of ['headers', 'body'] as const) {
  test(`late successful sign-in ${stalled} cannot create a session after timeout`, async () => {
    const response = deferred<Response>();
    const body = deferred<string>();
    let signal: AbortSignal | null | undefined;
    let calls = 0;
    const client = authClient(async (_, init) => {
      calls++;
      signal = init?.signal;
      if (stalled === 'headers') return response.promise;
      const reply = json(session('alice@example.com'));
      reply.text = () => body.promise;
      return reply;
    });
    const signedIn: string[] = [];
    const {data: {subscription}} = client.auth.onAuthStateChange((event, next) => {
      if (event === 'SIGNED_IN' && next) signedIn.push(next.user.id);
    });
    const result = await client.auth.signInWithPassword({email: 'alice@example.com', password: 'test-password'});
    assert.match(result.error?.message ?? '', /timed out/);
    assert.equal(signal?.aborted, true);
    assert.equal(calls, 1, 'sign-in must not retry a potentially completed request');
    response.resolve(json(session('alice@example.com')));
    body.resolve(JSON.stringify(session('alice@example.com')));
    assert.equal((await client.auth.getSession()).data.session, null);
    assert.deepEqual(signedIn, []);
    subscription.unsubscribe();
  });
}

test('after bounded sign-out completes, its late response cannot evict a subsequent login', async () => {
  const logout = deferred<Response>();
  let logoutSignal: AbortSignal | null | undefined;
  const client = authClient(async (input, init) => {
    if (String(input).includes('/logout')) {
      logoutSignal = init?.signal;
      return logout.promise;
    }
    const {email} = JSON.parse(String(init?.body));
    return json(session(email));
  });
  assert.equal((await client.auth.signInWithPassword({email: 'alice@example.com', password: 'test-password'})).error, null);
  const result = await client.auth.signOut({scope: 'local'});
  assert.match(result.error?.message ?? '', /timed out/);
  assert.equal(logoutSignal?.aborted, true);
  assert.equal((await client.auth.getSession()).data.session, null);
  assert.equal((await client.auth.signInWithPassword({email: 'bob@example.com', password: 'test-password'})).error, null);
  logout.resolve(new Response(null, {status: 204}));
  assert.equal((await client.auth.getSession()).data.session?.user.email, 'bob@example.com');
});
