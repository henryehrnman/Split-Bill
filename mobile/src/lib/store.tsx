import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {Pressable, Text, View} from 'react-native';
import {api, createProfile, now, remoteViewerId} from './api';
import {groupsFor, StaleStateError} from './domain';
import type {Db, Group, User} from './domain';
import type {UserId} from './split';
import {useSession} from './session';
import {backendIdentity} from './auth';
import {RpcError} from './http';
import {subscribeToChanges} from './realtime';
import {Splash, splashLink, splashText} from './Splash';
import AuthScreen from './AuthScreen';
import {finishProfile} from './profileSetup';

export type Notice = {kind: 'error' | 'success'; text: string};
type Ctx = {
  db: Db;
  now: number;
  viewer: User;
  demoMode: boolean;
  setViewerId: (id: UserId) => void;
  group: Group | null;
  setGroupId: (id: string) => void;
  busy: boolean;
  refreshing: boolean;
  live: boolean;
  refresh: () => void;
  notice: Notice | null;
  clearNotice: () => void;
  run: (call: (actor: UserId) => Promise<Db>, success?: string) => Promise<Db | null>;
};
const Context = createContext<Ctx | null>(null);
const message = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Try again.';

// Remount data and forms on account/mode changes: no prior account snapshot survives.
export function StoreProvider({children}: {children: React.ReactNode}) {
  const {demoMode, session} = useSession();
  return <AccountStore key={demoMode ? 'demo' : session!.user.id}>{children}</AccountStore>;
}

function AccountStore({children}: {children: React.ReactNode}) {
  const {demoMode, session, enterDemo, signOut} = useSession();
  const [identity] = useState(backendIdentity);
  const [db, setDb] = useState<Db | null>(null);
  const [viewerId, setViewerId] = useState<UserId>('u_henry');
  const viewerRef = useRef(viewerId);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const fetching = useRef(false);
  const loaded = useRef(false);
  const refreshAgain = useRef(false);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const [live, setLive] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const clearNotice = useCallback(() => setNotice(null), []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(current => current === notice ? null : current), 2500);
    return () => clearTimeout(timer);
  }, [notice]);
  const [loadError, setLoadError] = useState('');
  const [needsProfile, setNeedsProfile] = useState(false);
  const alive = useRef(true);
  const current = useCallback(() => alive.current && backendIdentity() === identity, [identity]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const apply = useCallback((next: Db) => {
    if (!current()) return;
    const id = demoMode ? viewerRef.current : remoteViewerId();
    if (!id || !next.users.some(user => user.id === id)) throw Error('Your account is missing from the server response. Please sign in again.');
    viewerRef.current = id;
    setViewerId(id);
    setDb(next);
    loaded.current = true;
    setLoadError('');
    setNeedsProfile(false);
  }, [current, demoMode]);

  const refresh = useCallback(async () => {
    if (!current()) return;
    if (fetching.current || pending.current) { refreshAgain.current = true; return; }
    fetching.current = true;
    setRefreshing(true);
    try {
      let next: Db;
      try { next = await api.fetch(); }
      catch (error) {
        if (!(error instanceof RpcError) || error.code !== 'no_profile' || demoMode) throw error;
        const meta = session?.user.user_metadata;
        if (!meta?.name || !meta?.handle) { if (current()) setNeedsProfile(true); return; }
        try { next = await finishProfile(() => createProfile({name: meta.name, handle: meta.handle, phone: meta.phone ?? '', email: session?.user.email ?? ''}), () => api.fetch()); }
        catch (profileError) {
          if (current()) setNeedsProfile(true);
          throw profileError;
        }
      }
      apply(next);
    } catch (error) {
      if (!current()) return;
      // Background refreshes (Realtime pings, the 15 s poll, returning to the app) retry on their own. While data is
      // already on screen, a dropped or slow read is not worth an error banner; only problems that need the person
      // (an expired session, a server error) are shown.
      if (loaded.current && error instanceof RpcError && (error.code === 'timeout' || error.code === 'network_error')) return;
      setLoadError(message(error));
      setNotice({kind: 'error', text: message(error)});
    } finally {
      fetching.current = false;
      if (current()) setRefreshing(false);
      if (refreshAgain.current && current()) { refreshAgain.current = false; void refreshRef.current(); }
    }
  }, [apply, current, demoMode, session]);

  useEffect(() => {
    refreshRef.current = refresh;
    let canceled = false;
    void Promise.resolve().then(() => { if (!canceled) void refresh(); });
    return () => { canceled = true; };
  }, [refresh]);
  const hasDb = !!db;
  const groups = db ? groupsFor(db, viewerId) : [];
  const group = groups.find(g => g.id === groupId) ?? groups[0] ?? null;
  useEffect(() => {
    if (demoMode || !hasDb || !session) return;
    return subscribeToChanges(session.user.id, group?.id ?? null, () => { void refresh(); }, setLive);
  }, [demoMode, hasDb, session?.user.id, group?.id, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = useCallback(async (call: (actor: UserId) => Promise<Db>, success?: string) => {
    if (!current() || pending.current) return null;
    const actor = viewerRef.current;
    pending.current = true;
    setBusy(true);
    try {
      const next = await call(actor);
      if (!current() || viewerRef.current !== actor) return null;
      apply(next);
      setNotice(success ? {kind: 'success', text: success} : null);
      return next;
    } catch (error) {
      if (current()) {
        setNotice({kind: 'error', text: message(error)});
        if (error instanceof StaleStateError || (error instanceof RpcError && error.code === 'stale')) refreshAgain.current = true;
      }
      return null;
    } finally {
      pending.current = false;
      if (current()) {
        setBusy(false);
        if (refreshAgain.current) { refreshAgain.current = false; void refresh(); }
      }
    }
  }, [apply, current, refresh]);

  if (needsProfile) return <AuthScreen profileOnly onDemo={enterDemo} onSignOut={signOut}
    onSignIn={async () => {}} onSignUp={async () => {}}
    onCompleteProfile={async profile => { apply(await finishProfile(() => createProfile({...profile, email: session?.user.email ?? ''}), () => api.fetch())); }} />;
  if (!db) return <Splash immediate={!!loadError && !refreshing}>
    <Text accessibilityRole={loadError ? 'alert' : undefined} style={splashText}>{loadError || 'Loading your groups…'}</Text>
    {!!loadError && <Pressable accessibilityRole="button" disabled={refreshing} onPress={() => void refresh()} style={{padding: 16}}><Text style={splashLink}>Retry</Text></Pressable>}
    {!demoMode && <Pressable accessibilityRole="button" onPress={() => void signOut()} style={{padding: 16}}><Text style={splashLink}>Sign out</Text></Pressable>}
    <Pressable accessibilityRole="button" onPress={enterDemo} style={{padding: 16}}><Text style={splashLink}>Try demo mode</Text></Pressable>
  </Splash>;
  const viewer = db.users.find(u => u.id === viewerId)!;
  return <Context.Provider value={{db, now: now(db), viewer, demoMode, group, setGroupId, busy, refreshing, live,
    refresh: () => { void refresh(); }, notice, clearNotice, run,
    setViewerId: id => {
      if (!demoMode || pending.current || !db.users.some(u => u.id === id)) return;
      viewerRef.current = id;
      setViewerId(id);
      setGroupId(null);
      setNotice(null);
    },
  }}><View key={viewerId} style={{flex: 1}}>{children}</View></Context.Provider>;
}

export function useStore() {
  const value = useContext(Context);
  if (!value) throw Error('Missing StoreProvider');
  return value;
}
