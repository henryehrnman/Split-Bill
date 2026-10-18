import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createClient} from '@supabase/supabase-js';
import type {Session} from '@supabase/supabase-js';
import {createAuthFetch} from '../src/lib/authFetch.ts';
import {createAuthIntent} from '../src/lib/authIntent.ts';

const FLAG = 'test-sign-out-intent';
const SDK_KEY = 'test-sdk-session';
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}});

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); },
    removeItem: async (key: string) => { values.delete(key); },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return {promise, resolve};
}

function session(email: string) {
  const id = email.startsWith('alice') ? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' : 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const accessToken = [{alg: 'none', typ: 'JWT'}, {sub: id, exp: expires, aud: 'authenticated'}]
    .map(value => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.') + '.test-signature';
  return {access_token: accessToken, refresh_token: `test-refresh-${email}`, expires_in: 3600, expires_at: expires, token_type: 'bearer',
    user: {id, email, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString()}};
}

function authClient(storage: ReturnType<typeof memoryStorage>, send: typeof fetch) {
  return createClient('https://auth.example.test', 'test-public-key', {
    auth: {storage, storageKey: SDK_KEY, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false},
    global: {fetch: createAuthFetch({fetch: send})},
  });
}

test('expired-session sign-out stays blocked through SDK refresh and reload until explicit login', {timeout: 3000}, async t => {
  let clock = Date.now();
  t.mock.method(Date, 'now', () => clock);
  const storage = memoryStorage();
  let online = true;
  const send: typeof fetch = async (input, init) => {
    if (String(input).includes('/logout')) return new Response(null, {status: 204});
    const body = JSON.parse(String(init?.body));
    if (body.refresh_token && !online) {
      // Exhaust the real SDK's refresh retry window without waiting 30 seconds.
      clock += 31000;
      return json({message: 'Connection temporarily unavailable'}, 503);
    }
    return json(session(body.email ?? body.refresh_token.replace('test-refresh-', '')));
  };
  const client = authClient(storage, send);
  t.after(() => client.auth.dispose());
  let intent = createAuthIntent(storage, FLAG);
  let displayed: Session | null = null;
  const refreshed = deferred<void>();
  const {data: {subscription}} = client.auth.onAuthStateChange((event, next) => {
    if (!intent.blocked()) displayed = next;
    if (event === 'TOKEN_REFRESHED') refreshed.resolve();
  });
  await intent.restore();
  await client.auth.getSession();
  assert.equal((await client.auth.signInWithPassword({email: 'alice@example.test', password: 'test-password'})).error, null);
  assert.equal(displayed?.user.email, 'alice@example.test');

  clock += 3601000;
  online = false;
  await intent.markSignedOut();
  displayed = null;
  const result = await client.auth.signOut({scope: 'local'});
  assert.equal(result.error?.status, 503);
  assert(storage.values.has(SDK_KEY), 'this SDK failure retains the expired session');
  assert.equal(storage.values.get(FLAG), '1');
  online = true;
  clock += 61000; // past the SDK's refresh-failure cooldown
  await client.auth.startAutoRefresh();
  await refreshed.promise;
  assert.equal(displayed, null, 'automatic refresh cannot reopen the signed-out account');
  assert.equal((await client.auth.getSession()).data.session?.user.email, 'alice@example.test');
  subscription.unsubscribe();
  await client.auth.dispose();

  // Reload: a new client and intent controller share only persisted storage.
  intent = createAuthIntent(storage, FLAG);
  const reloaded = authClient(storage, send);
  t.after(() => reloaded.auth.dispose());
  const {data: {subscription: reloadedSub}} = reloaded.auth.onAuthStateChange((_event, next) => {
    if (!intent.blocked()) displayed = next;
  });
  await reloaded.auth.getSession();
  assert.equal(displayed, null, 'startup auth events are blocked before the flag is read');
  await intent.restore();
  assert(intent.blocked());
  assert.equal(displayed, null);

  const attempt = intent.beginLogin();
  const signedIn = await reloaded.auth.signInWithPassword({email: 'bob@example.test', password: 'test-password'});
  assert.equal(signedIn.error, null);
  assert.equal(displayed, null, 'SIGNED_IN does not bypass the durable flag');
  assert(await intent.completeLogin(attempt, !!signedIn.data.session));
  displayed = signedIn.data.session;
  assert.equal(displayed?.user.email, 'bob@example.test');
  assert.equal(storage.values.has(FLAG), false);
  const nextReload = createAuthIntent(storage, FLAG);
  await nextReload.restore();
  assert.equal(nextReload.blocked(), false, 'explicit login enables future session restoration');
  reloadedSub.unsubscribe();
});

test('sessionless SDK signup cannot clear a prior sign-out', async t => {
  const storage = memoryStorage();
  const intent = createAuthIntent(storage, FLAG);
  await intent.markSignedOut();
  const client = authClient(storage, async () => json({user: session('alice@example.test').user}));
  t.after(() => client.auth.dispose());
  const attempt = intent.beginLogin();
  const result = await client.auth.signUp({email: 'alice@example.test', password: 'test-password'});
  assert.equal(result.error, null);
  assert.equal(result.data.session, null);
  assert.equal(await intent.completeLogin(attempt, !!result.data.session), false);
  assert(intent.blocked());
  assert.equal(storage.values.get(FLAG), '1');
});

test('a late SDK refresh cannot replace an explicitly signed-in account', {timeout: 3000}, async t => {
  const storage = memoryStorage();
  const intent = createAuthIntent(storage, FLAG);
  const started = deferred<void>();
  const oldResponse = deferred<Response>();
  const client = authClient(storage, async (input, init) => {
    if (String(input).includes('grant_type=refresh_token')) {
      started.resolve();
      return oldResponse.promise;
    }
    return json(session(JSON.parse(String(init?.body)).email));
  });
  t.after(() => client.auth.dispose());
  let displayed: Session | null = null;
  const {data: {subscription}} = client.auth.onAuthStateChange((_event, next) => {
    if (!intent.blocked()) displayed = next;
  });
  await intent.restore();
  await client.auth.getSession();
  await client.auth.signInWithPassword({email: 'alice@example.test', password: 'test-password'});
  await intent.markSignedOut();
  displayed = null;
  const oldRefresh = client.auth.refreshSession();
  await started.promise;
  const attempt = intent.beginLogin();
  const next = await client.auth.signInWithPassword({email: 'bob@example.test', password: 'test-password'});
  assert.equal(next.error, null);
  assert(await intent.completeLogin(attempt, !!next.data.session));
  displayed = next.data.session;
  oldResponse.resolve(json(session('alice@example.test')));
  await oldRefresh;
  assert.equal(displayed?.user.email, 'bob@example.test');
  assert.equal((await client.auth.getSession()).data.session?.user.email, 'bob@example.test');
  subscription.unsubscribe();
});

test('a delayed startup read cannot undo a newer sign-out intent', async () => {
  const storage = memoryStorage();
  const read = deferred<string | null>();
  const intent = createAuthIntent({...storage, getItem: () => read.promise}, FLAG);
  const restoring = intent.restore();
  assert(intent.blocked());
  await intent.markSignedOut();
  read.resolve(null);
  await restoring;
  assert(intent.blocked());
  assert.equal(storage.values.get(FLAG), '1');
});

test('a newer sign-out survives an already-running login flag removal', async () => {
  const storage = memoryStorage();
  const removing = deferred<void>();
  const release = deferred<void>();
  const intent = createAuthIntent({...storage, removeItem: async key => {
    removing.resolve();
    await release.promise;
    await storage.removeItem(key);
  }}, FLAG);
  await intent.markSignedOut();
  const attempt = intent.beginLogin();
  const login = intent.completeLogin(attempt, true);
  await removing.promise;
  const logout = intent.markSignedOut();
  assert(intent.blocked());
  release.resolve();
  assert.equal(await login, false);
  await logout;
  assert.equal(storage.values.get(FLAG), '1');
  assert.equal(await intent.completeLogin(attempt, true), false);
  assert(intent.blocked());
});

test('flag read, write and removal failures remain blocked and can be retried', async () => {
  const storage = memoryStorage();
  let fail: 'read' | 'write' | 'remove' | null = 'read';
  const unavailable = new Error('Storage unavailable');
  const intent = createAuthIntent({
    getItem: async key => { if (fail === 'read') throw unavailable; return storage.getItem(key); },
    setItem: async (key, value) => { if (fail === 'write') throw unavailable; await storage.setItem(key, value); },
    removeItem: async key => { if (fail === 'remove') throw unavailable; await storage.removeItem(key); },
  }, FLAG);
  await assert.rejects(intent.restore(), unavailable);
  assert(intent.blocked());
  fail = null;
  await intent.restore();
  assert.equal(intent.blocked(), false);
  fail = 'write';
  await assert.rejects(intent.markSignedOut(), unavailable);
  assert(intent.blocked());
  assert.equal(storage.values.has(FLAG), false, 'failed persistence must not be reported as durable');
  fail = null;
  await intent.markSignedOut();
  fail = 'remove';
  await assert.rejects(intent.completeLogin(intent.beginLogin(), true), unavailable);
  assert(intent.blocked());
  assert.equal(storage.values.get(FLAG), '1');
  fail = null;
  assert(await intent.completeLogin(intent.beginLogin(), true));
  assert.equal(intent.blocked(), false);
});
