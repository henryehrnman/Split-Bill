import React, {useRef, useState} from 'react';
import {ActivityIndicator, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import type {TextInputProps} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';

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
const C = {ink: '#171a20', muted: '#626a78', line: '#e8ebf0', surface: '#f5f6f8', blue: '#2459e8', softBlue: '#edf2ff', dark: '#171e2d', danger: '#b52d37', softDanger: '#fdf0f1', success: '#17794c', softSuccess: '#eef7f1'};
const STEPS: [React.ComponentProps<typeof Feather>['name'], string, string][] = [
  ['users', 'Pool a budget', 'Everyone adds an equal share to one group fund.'],
  ['credit-card', 'Pay with your own card', 'Each member gets a card on the fund for Apple or Google Wallet.'],
  ['check-circle', 'Agree on every split', 'Split by item, percent or amount. Every cent is accounted for.'],
];

function Brand() {
  return (
    <View style={s.brandRow} accessibilityRole="header" accessibilityLabel="chipin">
      {Platform.OS === 'web' ? (
        <Image source={{uri: '/phone-assets/chipin-mark.png'}} style={s.markImage} resizeMode="contain" />
      ) : (
        <View style={s.mark}>
          <View style={s.markLine} />
          <View style={[s.markLine, {transform: [{rotate: '-24deg'}]}]} />
        </View>
      )}
      <Text style={s.brand}>chipin</Text>
    </View>
  );
}

function Steps() {
  return (
    <View style={s.steps}>
      {STEPS.map(([icon, title, body]) => (
        <View key={title} style={s.step}>
          <View style={s.stepIcon}><Feather name={icon} size={18} color={C.blue} /></View>
          <View style={s.flex}>
            <Text style={s.stepTitle}>{title}</Text>
            <Text style={s.stepBody}>{body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
type InputInstance = React.ComponentRef<typeof TextInput>;

function Field({label, inputRef, ...props}: TextInputProps & {label: string; inputRef?: React.Ref<InputInstance>}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput ref={inputRef} accessibilityLabel={label} placeholderTextColor="#9aa1ad" selectionColor={C.blue} {...props} style={s.input} />
    </View>
  );
}

function Action({title, onPress, disabled = false, secondary = false, loading = false, icon}: {title: string; onPress: () => void; disabled?: boolean; secondary?: boolean; loading?: boolean; icon?: React.ComponentProps<typeof Feather>['name']}) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{disabled, busy: loading}} disabled={disabled} onPress={onPress} style={({pressed}) => [s.button, secondary && s.secondary, disabled && s.disabled, pressed && s.pressed]}>
      {loading && <ActivityIndicator color={secondary ? C.ink : 'white'} />}
      {!loading && icon && <Feather name={icon} size={18} color={secondary ? C.ink : 'white'} />}
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
      if (!profile.name || profile.name.length > 60) {
        setError('Enter your name using 1–60 characters.');
        nameRef.current?.focus();
        return;
      }
      if (!/^[a-z0-9._]{3,30}$/.test(profile.handle)) {
        setError('Use 3–30 letters, numbers, dots, or underscores for your handle.');
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
          <Brand />
          <Text accessibilityRole="header" style={s.title}>{profileOnly ? 'Complete your profile' : mode === 'signup' ? 'Create your account' : 'Spend together, settle as you go.'}</Text>
          <Text style={s.subtitle}>{profileOnly ? 'Choose how friends will find you. They invite you by handle, email or phone.' : mode === 'signup' ? 'Friends invite you by your handle, email or phone.' : 'A shared fund and a card for everyone in your group, so nobody fronts the bill.'}</Text>
          {!profileOnly && mode === 'signin' && <Steps />}

          {!profileOnly && (
            <View style={s.tabs}>
              {(['signin', 'signup'] as const).map(value => (
                <Pressable key={value} accessibilityRole="button" accessibilityState={{selected: mode === value, disabled: !!busy}} disabled={!!busy} onPress={() => changeMode(value)} style={[s.tab, mode === value && s.selectedTab]}>
                  <Text style={[s.tabText, mode === value && s.selectedTabText]}>{value === 'signin' ? 'Sign in' : 'Create account'}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {[configurationError, sessionError, profileOnly && !onCompleteProfile ? 'Profile setup is unavailable. You can still explore the demo.' : '', error].filter(Boolean).map(text => (
            <View key={text as string} accessibilityRole="alert" accessibilityLiveRegion="polite" style={[s.banner, {backgroundColor: C.softDanger}]}>
              <Feather name="alert-circle" size={16} color={C.danger} />
              <Text style={[s.bannerText, {color: C.danger}]}>{text}</Text>
            </View>
          ))}
          {!!success && (
            <View accessibilityLiveRegion="polite" style={[s.banner, {backgroundColor: C.softSuccess}]}>
              <Feather name="check-circle" size={16} color={C.success} />
              <Text style={[s.bannerText, {color: C.success}]}>{success}</Text>
            </View>
          )}

          {!profileOnly && (
            <>
              <Field label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} editable={!busy} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" importantForAutofill="yes" maxLength={254} returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => passwordRef.current?.focus()} />
              <Field key={mode} inputRef={passwordRef} label="Password" placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'} value={password} onChangeText={setPassword} editable={!busy} autoCapitalize="none" autoCorrect={false} secureTextEntry autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} importantForAutofill="yes" returnKeyType={needsProfile ? 'next' : 'go'} submitBehavior={needsProfile ? 'submit' : 'blurAndSubmit'} onSubmitEditing={() => needsProfile ? nameRef.current?.focus() : void submit()} />
            </>
          )}

          {needsProfile && (
            <>
              <Field inputRef={nameRef} label="Name" placeholder="Maya Lopez" value={name} onChangeText={setName} editable={!busy} autoComplete="name" autoCapitalize="words" maxLength={60} returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => handleRef.current?.focus()} />
              <Field inputRef={handleRef} label="Handle" placeholder="maya.l" value={handle} onChangeText={value => setHandle(value.toLowerCase())} editable={!busy} autoCapitalize="none" autoCorrect={false} autoComplete="off" maxLength={30} returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => phoneRef.current?.focus()} />
              <Text style={s.hint}>How friends find you. 3–30 letters, numbers, dots or underscores.</Text>
              <Field inputRef={phoneRef} label="Phone (optional)" placeholder="(555) 123-4567" value={phone} onChangeText={setPhone} editable={!busy} keyboardType="phone-pad" autoComplete="tel" maxLength={30} returnKeyType="done" onSubmitEditing={() => void submit()} />
            </>
          )}

          <View style={s.actions}>
            <Action title={busy === 'submit' ? 'Please wait…' : profileOnly ? 'Save profile' : mode === 'signup' ? 'Create account' : 'Sign in'} onPress={() => void submit()} disabled={!!busy || unavailable} loading={busy === 'submit'} />
            {profileOnly && onSignOut && <Action title={busy === 'signout' ? 'Signing out…' : 'Sign out'} onPress={() => void signOut()} disabled={!!busy} secondary loading={busy === 'signout'} />}
          </View>

          <View style={s.orRow}>
            <View style={s.orLine} />
            <Text style={s.orText}>or</Text>
            <View style={s.orLine} />
          </View>
          <Action title="Explore the demo" icon="play-circle" onPress={onDemo} disabled={!!busy} secondary />
          <Text style={s.note}>No account needed. Try it as any of five sample people.{'\n'}Payments are simulated; no real money moves.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {flex: 1, backgroundColor: 'white'},
  flex: {flex: 1},
  page: {padding: 24, paddingBottom: 32, width: '100%', maxWidth: 480, alignSelf: 'center'},
  brandRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 36},
  mark: {width: 24, height: 25, flexDirection: 'row', gap: 3, alignItems: 'center'},
  markImage: {width: 32, height: 28},
  markLine: {width: 7, height: 21, borderRadius: 2, backgroundColor: C.blue, transform: [{rotate: '24deg'}]},
  brand: {fontFamily: 'DM-Bold', fontSize: 23, lineHeight: 28, letterSpacing: -1, color: C.ink},
  title: {fontFamily: 'DM-Bold', fontSize: 30, lineHeight: 36, letterSpacing: -0.9, color: C.ink, marginBottom: 10},
  subtitle: {fontFamily: 'DM-Regular', fontSize: 15, lineHeight: 22, color: C.muted, marginBottom: 24},
  steps: {gap: 14, marginBottom: 28},
  step: {flexDirection: 'row', gap: 12, alignItems: 'flex-start'},
  stepIcon: {width: 36, height: 36, borderRadius: 10, backgroundColor: C.softBlue, alignItems: 'center', justifyContent: 'center'},
  stepTitle: {fontFamily: 'DM-Medium', fontSize: 15, lineHeight: 21, color: C.ink},
  stepBody: {fontFamily: 'DM-Regular', fontSize: 13, lineHeight: 19, color: C.muted},
  banner: {flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderRadius: 12, padding: 14, marginBottom: 16},
  bannerText: {flex: 1, fontFamily: 'DM-Regular', fontSize: 14, lineHeight: 20},
  orRow: {flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 28, marginBottom: 16},
  orLine: {flex: 1, height: 1, backgroundColor: C.line},
  orText: {fontFamily: 'DM-Regular', fontSize: 12, color: C.muted},
  tabs: {flexDirection: 'row', backgroundColor: C.surface, borderRadius: 12, padding: 4, marginBottom: 24},
  tab: {flex: 1, minHeight: 48, justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 8, borderRadius: 10},
  selectedTab: {backgroundColor: 'white'},
  tabText: {fontFamily: 'DM-Regular', fontSize: 15, lineHeight: 22, textAlign: 'center', color: C.muted},
  selectedTabText: {fontFamily: 'DM-Medium', color: C.ink},
  field: {marginBottom: 16},
  label: {fontFamily: 'DM-Medium', fontSize: 12, lineHeight: 18, color: C.ink, marginBottom: 8},
  input: {fontFamily: 'DM-Regular', fontSize: 16, color: C.ink, minHeight: 52, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: '#d8dde6', borderRadius: 10, backgroundColor: 'white'},
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
  note: {fontFamily: 'DM-Regular', fontSize: 12, lineHeight: 18, textAlign: 'center', color: C.muted, marginTop: 12},
});
