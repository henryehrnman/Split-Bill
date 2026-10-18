import React, {createContext, useContext, useEffect, useRef, useState} from 'react';
import {AppState, Platform, Pressable, Text, View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {Session} from '@supabase/supabase-js';
import AuthScreen from './AuthScreen';
import {setBackendIdentity, supabase} from './auth';
import {apiUrl, configurationError, supabaseUrl} from './config';
import {createAuthIntent} from './authIntent';
import {Splash, splashLink, splashText} from './Splash';

type SessionContext = {
  demoMode: boolean;
  session: Session | null;
  enterDemo: () => void;
  exitDemo: () => void;
  signOut: () => Promise<void>;
};
const Context = createContext<SessionContext | null>(null);

export function SessionProvider({children}: {children: React.ReactNode}) {
  const [session, setSession] = useState<Session | null>(null);
  const [demoMode, setDemoMode] = useState(!apiUrl);
  const [ready, setReady] = useState(!supabase);
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [storageRecovery, setStorageRecovery] = useState<'restore' | 'signout' | null>(null);
  const [intent] = useState(() => createAuthIntent(AsyncStorage, `splitbill.signed-out.v1:${supabaseUrl}`));
  const signOutPending = useRef<Promise<void> | null>(null);
  const restoreRef = useRef<() => Promise<void>>(async () => {});
  const explicitLogin = useRef(false);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let authEvent = false;
    const client = supabase;
    const {data: {subscription}} = client.auth.onAuthStateChange((event, next) => {
      if (!active || intent.blocked() || signOutPending.current) return;
      if (explicitLogin.current && event === 'INITIAL_SESSION') return;
      authEvent = true;
      setSession(next);
      setReady(true);
    });
    const restore = async () => {
      setReady(false);
      setStorageRecovery(null);
      setError('');
      try { await intent.restore(); }
      catch {
        if (active) {
          setError('Could not read the saved sign-out state on this device. Retry, or use demo mode.');
          setStorageRecovery('restore');
          setReady(true);
        }
        return;
      }
      if (!active) return;
      if (intent.blocked()) { setSession(null); setReady(true); return; }
      try {
        const {data, error: loadError} = await client.auth.getSession();
        if (!active || intent.blocked() || signOutPending.current || explicitLogin.current) return;
        if (loadError) setError(loadError.message);
        if (!authEvent) setSession(data.session);
      } catch {
        if (active && !intent.blocked()) setError('Could not restore your session. Please sign in again.');
      } finally {
        if (active) setReady(true);
      }
    };
    restoreRef.current = restore;
    void restore();
    const listener = Platform.OS !== 'web' ? AppState.addEventListener('change', state => {
      if (state === 'active') supabase?.auth.startAutoRefresh();
      else supabase?.auth.stopAutoRefresh();
    }) : null;
    return () => { active = false; subscription.unsubscribe(); listener?.remove(); };
  }, [intent]);

  // Update the request identity before mounting/unmounting account-specific screens.
  // Old split-screen cleanup callbacks cannot send using a new account's token.
  setBackendIdentity(demoMode, demoMode || signingOut ? null : session?.user.id ?? null);
  const enterDemo = () => { setBackendIdentity(true, null); setDemoMode(true); };
  const exitDemo = () => { setBackendIdentity(false, session?.user.id ?? null); setDemoMode(false); };
  const signOut = () => {
    if (signOutPending.current) return signOutPending.current;
    setSigningOut(true);
    setError('');
    setStorageRecovery(null);
    setBackendIdentity(false, null);
    setSession(null);
    setDemoMode(false);
    const savedIntent = intent.markSignedOut();
    const pending = (async () => {
      let storageFailed = false;
      try { await savedIntent; }
      catch { storageFailed = true; }
      try {
        const result = await supabase?.auth.signOut({scope: 'local'});
        if (result?.error) setError('Could not confirm sign-out. Please sign in again.');
      } catch {
        setError('Could not confirm sign-out. Please sign in again.');
      } finally {
        if (storageFailed) {
          setError('Sign-out could not be saved on this device. This page stays signed out, but reloading may restore the account. Retry, or use demo mode.');
          setStorageRecovery('signout');
        }
        setSession(null);
        setReady(true);
        signOutPending.current = null;
        setSigningOut(false);
      }
    })();
    signOutPending.current = pending;
    return pending;
  };

  if (signingOut || (!ready && !demoMode)) return <Splash>
    <Text style={splashText}>{signingOut ? 'Signing out…' : 'Restoring your session…'}</Text>
    {!signingOut && <Pressable accessibilityRole="button" onPress={enterDemo} style={{padding: 16}}><Text style={splashLink}>Try demo mode</Text></Pressable>}
  </Splash>;
  if (storageRecovery && !demoMode) return <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16}}>
    <Text accessibilityRole="alert">{error}</Text>
    <Pressable accessibilityRole="button" onPress={() => { void (storageRecovery === 'restore' ? restoreRef.current() : signOut()); }} style={{padding: 16}}><Text>Retry</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={enterDemo} style={{padding: 16}}><Text>Try demo mode</Text></Pressable>
  </View>;
  if (!demoMode && !session) {
    return <AuthScreen
      configurationError={configurationError}
      sessionError={error}
      onDemo={enterDemo}
      onSignIn={async (email, password) => {
        if (signOutPending.current) throw Error('Sign-out is still finishing. Please try again.');
        if (!supabase) throw Error(configurationError || 'Account access is not configured.');
        explicitLogin.current = true;
        const attempt = intent.beginLogin();
        const {data, error: authError} = await supabase.auth.signInWithPassword({email, password});
        if (authError) throw authError;
        try {
          if (!(await intent.completeLogin(attempt, true))) return;
        } catch { throw Error('Could not save sign-in on this device. Please try again.'); }
        setSession(data.session);
        setError('');
      }}
      onSignUp={async (email, password, profile) => {
        if (signOutPending.current) throw Error('Sign-out is still finishing. Please try again.');
        if (!supabase) throw Error(configurationError || 'Account access is not configured.');
        explicitLogin.current = true;
        const attempt = intent.beginLogin();
        const {data, error: authError} = await supabase.auth.signUp({email, password, options: {data: profile}});
        if (authError) throw authError;
        setError('');
        if (!data.session) return 'Check your email to confirm your account, then sign in.';
        try {
          if (!(await intent.completeLogin(attempt, true))) return;
        } catch { throw Error('Could not save sign-in on this device. Please try again.'); }
        setSession(data.session);
      }}
    />;
  }
  return <Context.Provider value={{demoMode, session, enterDemo, exitDemo, signOut}}>{children}</Context.Provider>;
}

export function useSession() {
  const value = useContext(Context);
  if (!value) throw Error('Missing SessionProvider');
  return value;
}
