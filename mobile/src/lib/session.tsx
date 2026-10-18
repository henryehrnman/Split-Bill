import React, {createContext, useContext, useEffect, useState} from 'react';
import {ActivityIndicator, AppState, Platform, Text, View} from 'react-native';
import type {Session} from '@supabase/supabase-js';
import AuthScreen from './AuthScreen';
import {setBackendIdentity, supabase} from './auth';
import {apiUrl, configurationError} from './config';

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

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let authEvent = false;
    const {data: {subscription}} = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      authEvent = true;
      setSession(next);
      setReady(true);
    });
    supabase.auth.getSession().then(({data, error: loadError}) => {
      if (!active || authEvent) return;
      if (loadError) setError(loadError.message);
      setSession(data.session);
      setReady(true);
    }).catch(() => {
      if (active) { setError('Could not restore your session. Please sign in again.'); setReady(true); }
    });
    const listener = Platform.OS !== 'web' ? AppState.addEventListener('change', state => {
      if (state === 'active') supabase?.auth.startAutoRefresh();
      else supabase?.auth.stopAutoRefresh();
    }) : null;
    return () => { active = false; subscription.unsubscribe(); listener?.remove(); };
  }, []);

  // Update the request identity before mounting/unmounting account-specific screens.
  // Old split-screen cleanup callbacks cannot send using a new account's token.
  setBackendIdentity(demoMode, demoMode ? null : session?.user.id ?? null);
  const enterDemo = () => { setBackendIdentity(true, null); setDemoMode(true); };
  const exitDemo = () => { setBackendIdentity(false, session?.user.id ?? null); setDemoMode(false); };
  const signOut = async () => {
    setBackendIdentity(false, null);
    setSession(null);
    setDemoMode(false);
    const result = await supabase?.auth.signOut({scope: 'local'});
    if (result?.error) setError('Signed out on this device. Please sign in again.');
  };

  if (!ready) return <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}><ActivityIndicator /><Text>Restoring your session…</Text></View>;
  if (!demoMode && !session) {
    return <AuthScreen
      configurationError={configurationError}
      sessionError={error}
      onDemo={enterDemo}
      onSignIn={async (email, password) => {
        if (!supabase) throw Error(configurationError || 'Account access is not configured.');
        const {error: authError} = await supabase.auth.signInWithPassword({email, password});
        if (authError) throw authError;
        setError('');
      }}
      onSignUp={async (email, password, profile) => {
        if (!supabase) throw Error(configurationError || 'Account access is not configured.');
        const {data, error: authError} = await supabase.auth.signUp({email, password, options: {data: profile}});
        if (authError) throw authError;
        setError('');
        if (!data.session) return 'Check your email to confirm your account, then sign in.';
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
