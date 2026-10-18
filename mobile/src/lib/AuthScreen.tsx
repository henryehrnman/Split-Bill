import React, {useRef, useState} from 'react';
import {ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import type {TextInputProps} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

export type ProfileInput = {name: string; handle: string; phone: string};

type Props = {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string, profile: ProfileInput) => Promise<string | void>;
  onDemo: () => void;
  configurationError?: string;
  sessionError?: string;
  profileOnly?: boolean;
  onCompleteProfile?: (profile: ProfileInput) => Promise<void>;
  onSignOut?: () => Promise<void>;
};

// Auth renders before the store, so these design tokens have no store dependency.
const C = {ink: '#171a20', muted: '#626a78', line: '#e8ebf0', surface: '#f5f6f8', blue: '#2459e8', danger: '#b52d37', success: '#17794c'};
type InputInstance = React.ComponentRef<typeof TextInput>;

function Field({label, inputRef, ...props}: TextInputProps & {label: string; inputRef?: React.Ref<InputInstance>}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput ref={inputRef} accessibilityLabel={label} placeholderTextColor={C.muted} selectionColor={C.blue} {...props} style={s.input} />
    </View>
  );
}

function Action({title, onPress, disabled = false, secondary = false, loading = false}: {title: string; onPress: () => void; disabled?: boolean; secondary?: boolean; loading?: boolean}) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{disabled, busy: loading}} disabled={disabled} onPress={onPress} style={({pressed}) => [s.button, secondary && s.secondary, disabled && s.disabled, pressed && s.pressed]}>
      {loading && <ActivityIndicator color={secondary ? C.ink : 'white'} />}
      <Text style={[s.buttonText, secondary && s.secondaryText]}>{title}</Text>
    </Pressable>
  );
}

export default function AuthScreen({onSignIn, onSignUp, onDemo, configurationError, sessionError, profileOnly = false, onCompleteProfile, onSignOut}: Props) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState<'submit' | 'signout' | null>(null);
  const inFlight = useRef(false);
  const passwordRef = useRef<InputInstance>(null);
  const nameRef = useRef<InputInstance>(null);
  const handleRef = useRef<InputInstance>(null);
  const phoneRef = useRef<InputInstance>(null);
  const needsProfile = profileOnly || mode === 'signup';
  const unavailable = !!configurationError || (profileOnly && !onCompleteProfile);

  async function submit() {
    if (inFlight.current || unavailable) return;
    setError('');
    setSuccess('');
    const address = email.trim().toLowerCase();
    const profile = {name: name.trim(), handle: handle.trim().toLowerCase(), phone: phone.trim()};
    if (!profileOnly) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
        setError('Enter a valid email address.');
        return;
      }
      if (!password || (mode === 'signup' && password.length < 6)) {
        setError(mode === 'signup' ? 'Choose a password with at least 6 characters.' : 'Enter your password.');
        passwordRef.current?.focus();
        return;
      }
    }
    if (needsProfile) {
      if (!profile.name || profile.name.length > 80) {
        setError('Enter your name using 1–80 characters.');
        nameRef.current?.focus();
        return;
      }
      if (!/^[a-z0-9._-]{3,24}$/.test(profile.handle)) {
        setError('Use 3–24 letters, numbers, dots, underscores, or hyphens for your handle.');
        handleRef.current?.focus();
        return;
      }
    }
    Keyboard.dismiss();
    inFlight.current = true;
    setBusy('submit');
    try {
      if (profileOnly) {
        await onCompleteProfile?.(profile);
        setSuccess('Your profile is ready.');
      } else if (mode === 'signup') {
        const message = await onSignUp(address, password, profile);
        setPassword('');
        setSuccess(message || 'Account created. You can now sign in.');
        setMode('signin');
      } else {
        await onSignIn(address, password);
        setPassword('');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.');
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  async function signOut() {
    if (inFlight.current || !onSignOut) return;
    inFlight.current = true;
    setBusy('signout');
    setError('');
    setSuccess('');
    try {
      await onSignOut();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign out. Please try again.');
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  function changeMode(next: 'signin' | 'signup') {
    if (inFlight.current) return;
    setMode(next);
    setPassword('');
    setError('');
    setSuccess('');
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <Text accessibilityRole="header" style={s.brand}>Split Bill</Text>
          <Text accessibilityRole="header" style={s.title}>{profileOnly ? 'Complete your profile' : mode === 'signup' ? 'Create your account' : 'Welcome back'}</Text>
          <Text style={s.subtitle}>{profileOnly ? 'Choose how friends will find you.' : 'Keep shared bills and your people together.'}</Text>

          {!profileOnly && (
            <View style={s.tabs}>
              {(['signin', 'signup'] as const).map(value => (
                <Pressable key={value} accessibilityRole="button" accessibilityState={{selected: mode === value, disabled: !!busy}} disabled={!!busy} onPress={() => changeMode(value)} style={[s.tab, mode === value && s.selectedTab]}>
                  <Text style={[s.tabText, mode === value && s.selectedTabText]}>{value === 'signin' ? 'Sign in' : 'Create account'}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {configurationError && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.error}>{configurationError}</Text>}
          {sessionError && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.error}>{sessionError}</Text>}
          {profileOnly && !onCompleteProfile && <Text accessibilityRole="alert" style={s.error}>Profile setup is unavailable. You can still explore the demo.</Text>}
          {!!error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.error}>{error}</Text>}
          {!!success && <Text accessibilityLiveRegion="polite" style={s.success}>{success}</Text>}

          {!profileOnly && (
            <>
              <Field label="Email" value={email} onChangeText={setEmail} editable={!busy} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" importantForAutofill="yes" maxLength={254} returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => passwordRef.current?.focus()} />
              <Field key={mode} inputRef={passwordRef} label="Password" value={password} onChangeText={setPassword} editable={!busy} autoCapitalize="none" autoCorrect={false} secureTextEntry autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} importantForAutofill="yes" returnKeyType={needsProfile ? 'next' : 'go'} submitBehavior={needsProfile ? 'submit' : 'blurAndSubmit'} onSubmitEditing={() => needsProfile ? nameRef.current?.focus() : void submit()} />
              {mode === 'signup' && <Text style={s.hint}>At least 6 characters.</Text>}
            </>
          )}

          {needsProfile && (
            <>
              <Field inputRef={nameRef} label="Name" value={name} onChangeText={setName} editable={!busy} autoComplete="name" autoCapitalize="words" maxLength={80} returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => handleRef.current?.focus()} />
              <Field inputRef={handleRef} label="Handle" value={handle} onChangeText={value => setHandle(value.toLowerCase())} editable={!busy} autoCapitalize="none" autoCorrect={false} autoComplete="off" maxLength={24} returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => phoneRef.current?.focus()} />
              <Text style={s.hint}>3–24 letters, numbers, dots, underscores, or hyphens.</Text>
              <Field inputRef={phoneRef} label="Phone (optional)" value={phone} onChangeText={setPhone} editable={!busy} keyboardType="phone-pad" autoComplete="tel" maxLength={32} returnKeyType="done" onSubmitEditing={() => void submit()} />
            </>
          )}

          <View style={s.actions}>
            <Action title={busy === 'submit' ? 'Please wait…' : profileOnly ? 'Save profile' : mode === 'signup' ? 'Create account' : 'Sign in'} onPress={() => void submit()} disabled={!!busy || unavailable} loading={busy === 'submit'} />
            {profileOnly && onSignOut && <Action title={busy === 'signout' ? 'Signing out…' : 'Sign out'} onPress={() => void signOut()} disabled={!!busy} secondary loading={busy === 'signout'} />}
          </View>

          <View style={s.demo}>
            <Action title="Explore the demo" onPress={onDemo} disabled={!!busy} secondary />
            <Text style={s.note}>Payments are simulated. No real money moves.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {flex: 1, backgroundColor: 'white'},
  flex: {flex: 1},
  page: {padding: 24, paddingBottom: 32, width: '100%', maxWidth: 480, alignSelf: 'center'},
  brand: {fontFamily: 'DM-Bold', fontSize: 20, lineHeight: 28, color: C.ink, marginBottom: 32},
  title: {fontFamily: 'DM-Bold', fontSize: 28, lineHeight: 35, color: C.ink, marginBottom: 8},
  subtitle: {fontFamily: 'DM-Regular', fontSize: 15, lineHeight: 22, color: C.muted, marginBottom: 24},
  tabs: {flexDirection: 'row', backgroundColor: C.surface, borderRadius: 12, padding: 4, marginBottom: 24},
  tab: {flex: 1, minHeight: 48, justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 8, borderRadius: 10},
  selectedTab: {backgroundColor: 'white'},
  tabText: {fontFamily: 'DM-Regular', fontSize: 15, lineHeight: 22, textAlign: 'center', color: C.muted},
  selectedTabText: {fontFamily: 'DM-Medium', color: C.ink},
  field: {marginBottom: 16},
  label: {fontFamily: 'DM-Medium', fontSize: 12, lineHeight: 18, color: C.ink, marginBottom: 8},
  input: {fontFamily: 'DM-Regular', fontSize: 16, color: C.ink, minHeight: 52, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: C.line, borderRadius: 10, backgroundColor: 'white'},
  hint: {fontFamily: 'DM-Regular', fontSize: 12, lineHeight: 18, color: C.muted, marginTop: -8, marginBottom: 16},
  error: {fontFamily: 'DM-Regular', fontSize: 15, lineHeight: 22, color: C.danger, marginBottom: 16},
  success: {fontFamily: 'DM-Regular', fontSize: 15, lineHeight: 22, color: C.success, marginBottom: 16},
  actions: {gap: 12, marginTop: 8},
  button: {minHeight: 52, backgroundColor: C.blue, borderRadius: 12, padding: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center'},
  buttonText: {fontFamily: 'DM-Bold', fontSize: 16, lineHeight: 22, color: 'white', textAlign: 'center', flexShrink: 1},
  secondary: {backgroundColor: C.surface},
  secondaryText: {color: C.ink},
  disabled: {opacity: 0.5},
  pressed: {opacity: 0.8},
  demo: {borderTopWidth: 1, borderTopColor: C.line, marginTop: 32, paddingTop: 24, gap: 12},
  note: {fontFamily: 'DM-Regular', fontSize: 12, lineHeight: 18, textAlign: 'center', color: C.muted},
});
