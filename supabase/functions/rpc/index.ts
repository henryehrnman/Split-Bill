// Supabase Edge Function "rpc": the whole backend for the hackathon build.
// POST {method, args} with the user's Supabase JWT. See core.ts for the rules and supabase/README.md for setup.
import {createClient} from 'npm:@supabase/supabase-js@2.45.4';
import {handle} from './core.ts';
import type {Links, State, Store} from './core.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const demo = Deno.env.get('DEMO_MODE') === '1';
const admin = createClient(url, serviceKey, {auth: {persistSession: false}});

const cors = {
  'access-control-allow-origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {status, headers: {...cors, 'content-type': 'application/json'}});

const store: Store = {
  async load() {
    const {data, error} = await admin.from('app_state').select('db, links, version').eq('id', 1).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? ({db: data.db, links: data.links as Links, version: data.version} as State) : null;
  },
  async save(next, expected) {
    if (expected === null) {
      const {data, error} = await admin.from('app_state').upsert({id: 1, db: next.db, links: next.links, version: 1}, {onConflict: 'id', ignoreDuplicates: true}).select('id');
      if (error) throw new Error(error.message);
      return (data?.length ?? 0) === 1;
    }
    const {data, error} = await admin
      .from('app_state')
      .update({db: next.db, links: next.links, version: expected + 1, updated_at: new Date().toISOString()})
      .eq('id', 1)
      .eq('version', expected)
      .select('id');
    if (error) throw new Error(error.message);
    return (data?.length ?? 0) === 1;
  },
};

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers: cors});
  if (req.method !== 'POST') return json(405, {error: 'POST only.'});
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, {error: 'Send JSON.'});
  }
  const jwt = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  let authId: string | null = null;
  if (jwt) {
    const {data} = await admin.auth.getUser(jwt); // verifies signature and expiry; the anon key is not a user
    authId = data.user?.id ?? null;
  }
  try {
    const reply = await handle(store, authId, body, {demo});
    return json(reply.status, reply.body);
  } catch (e) {
    console.error(e);
    return json(500, {error: 'Server error. Try again.'});
  }
});
