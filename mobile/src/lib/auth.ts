import AsyncStorage from '@react-native-async-storage/async-storage';
import {createClient, processLock} from '@supabase/supabase-js';
import type {Session} from '@supabase/supabase-js';
import {Platform} from 'react-native';
import {apiUrl, configurationError, publishableKey, supabaseUrl} from './config';
import {RpcError} from './http';
import {createAuthFetch} from './authFetch';

export const supabase = apiUrl && !configurationError ? createClient(supabaseUrl, publishableKey, {
  global: {fetch: createAuthFetch()},
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    ...(Platform.OS !== 'web' ? {lock: processLock} : {}),
  },
}) : null;

let identity = {demoMode: !apiUrl, userId: null as string | null, epoch: 0};
export const backendIdentity = () => identity;
export function setBackendIdentity(demoMode: boolean, userId: string | null) {
  if (identity.demoMode !== demoMode || identity.userId !== userId) {
    identity = {demoMode, userId, epoch: identity.epoch + 1};
  }
}

// getSession() waits for the auth lock, which the background token refresh holds while its request is in flight.
// Keeping the latest session from auth events lets ordinary requests skip that wait; getSession() is only
// consulted when nothing is cached or the cached token is about to expire.
let cachedSession: Session | null = null;
supabase?.auth.onAuthStateChange((_event, session) => { cachedSession = session; });

const EXPIRY_MARGIN_SECONDS = 60;
const fresh = (session: Session | null, userId: string): session is Session =>
  !!session && session.user.id === userId && !!session.access_token
  && (session.expires_at ?? 0) > Date.now() / 1000 + EXPIRY_MARGIN_SECONDS;

export async function accessToken() {
  const started = identity;
  if (!supabase || started.demoMode || !started.userId) throw new RpcError('Please sign in to continue.', 401, 'session_expired');
  if (fresh(cachedSession, started.userId)) return cachedSession.access_token;
  const {data, error} = await supabase.auth.getSession();
  if (error) throw error;
  if (identity !== started || data.session?.user.id !== started.userId) throw new RpcError('Your session changed. Please sign in again.', 401, 'session_changed');
  cachedSession = data.session;
  return data.session.access_token;
}
