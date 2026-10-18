import React, {useEffect} from 'react';
import {View, Text, Pressable, ScrollView, StyleSheet, TextInput, ActivityIndicator, Switch, StyleProp, TextStyle, TextProps, ViewStyle} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import {useStore} from './store';
import type {Standing, User} from './domain';

export const C = {ink: '#171a20', dark: '#171e2d', muted: '#626a78', line: '#e8ebf0', bg: '#f5f6f8', blue: '#2459e8', softBlue: '#edf2ff', success: '#17794c', softSuccess: '#eef7f1', warn: '#9a6420', softWarn: '#fbf5e9', danger: '#b52d37', softDanger: '#fdf0f1'};
const TONES = [['#e2eaff', '#2c4b98'], ['#f4dfd7', '#8b5142'], ['#e8e2f2', '#67518a'], ['#dcefe6', '#2f6b4f'], ['#f6ead0', '#7a5a14']];

export const periodLabel = (days: number) => (days === 7 ? 'every week' : days === 14 ? 'every 2 weeks' : days === 30 ? 'every month' : `every ${days} days`);

export function StandingPill({standing}: {standing: Standing}) {
  const map: Record<Standing, [string, 'success' | 'blue' | 'warn' | 'danger' | 'muted']> = {
    'on-track': ['On track', 'success'],
    suspended: ['Suspended', 'danger'],
    invited: ['Invited', 'muted'],
  };
  return <Pill label={map[standing][0]} tone={map[standing][1]} />;
}

export function T({children, style, ...props}: TextProps & {children: React.ReactNode; style?: StyleProp<TextStyle>}) {
  const f = StyleSheet.flatten(style) || {};
  const weight = String(f.fontWeight || '400');
  const family = ['700', '800', '900', 'bold'].includes(weight) ? 'DM-Bold' : ['500', '600'].includes(weight) ? 'DM-Medium' : 'DM-Regular';
  return <Text {...props} style={[s.text, style, {fontFamily: family, fontWeight: 'normal', lineHeight: f.lineHeight ?? Math.round((f.fontSize ?? 15) * 1.4)}]}>{children}</Text>;
}

export function Icon({name, size = 20, color = C.ink}: {name: React.ComponentProps<typeof Feather>['name']; size?: number; color?: string}) {
  return <Feather name={name} size={size} color={color} />;
}

export function Avatar({user, size = 40}: {user: User; size?: number}) {
  const [bg, fg] = TONES[user.tone % TONES.length];
  return (
    <View style={{width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center'}}>
      <T style={{fontSize: size * 0.34, fontWeight: '700', color: fg}}>{user.initials}</T>
    </View>
  );
}

export function Button({title, onPress, disabled = false, secondary = false, danger = false}: {title: string; onPress: () => void; disabled?: boolean; secondary?: boolean; danger?: boolean}) {
  const {busy} = useStore();
  const off = disabled || busy;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{disabled: off}} disabled={off} onPress={onPress} style={({pressed}) => [s.button, secondary && s.secondary, danger && {backgroundColor: C.danger}, off && {backgroundColor: '#e9ecf2', borderColor: '#e9ecf2'}, pressed && {opacity: 0.8}]}>
      <T style={{fontWeight: '700', textAlign: 'center', fontSize: 16, color: off ? '#717b8b' : secondary ? C.ink : 'white'}}>{title}</T>
    </Pressable>
  );
}

export function Pill({label, tone = 'blue'}: {label: string; tone?: 'blue' | 'success' | 'warn' | 'danger' | 'muted'}) {
  const colors = {blue: [C.softBlue, C.blue], success: [C.softSuccess, C.success], warn: [C.softWarn, C.warn], danger: [C.softDanger, C.danger], muted: [C.bg, C.muted]}[tone];
  return (
    <View style={{backgroundColor: colors[0], borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4, alignSelf: 'flex-start'}}>
      <T style={{fontSize: 11, color: colors[1], fontWeight: '500'}}>{label}</T>
    </View>
  );
}

export function Segmented<K extends string>({options, value, onChange}: {options: [K, string][]; value: K; onChange: (k: K) => void}) {
  return (
    <View style={{flexDirection: 'row', backgroundColor: C.bg, padding: 4, borderRadius: 11, marginBottom: 20}}>
      {options.map(([k, label]) => (
        <Pressable key={k} accessibilityRole="button" accessibilityState={{selected: value === k}} onPress={() => onChange(k)} style={{flex: 1, minHeight: 40, justifyContent: 'center', borderRadius: 8, backgroundColor: value === k ? 'white' : 'transparent', borderWidth: 1, borderColor: value === k ? '#e1e5ed' : 'transparent'}}>
          <T style={{textAlign: 'center', fontSize: 13, fontWeight: value === k ? '700' : '400', color: value === k ? C.ink : C.muted}}>{label}</T>
        </Pressable>
      ))}
    </View>
  );
}

export function Chip({label, selected, onPress, check = true}: {label: string; selected: boolean; onPress: () => void; check?: boolean}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{checked: selected}}
      onPress={onPress}
      style={{minHeight: 40, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, borderWidth: 1, borderColor: selected ? C.blue : C.bg, backgroundColor: selected ? '#eaf0ff' : C.bg}}>
      {selected && check && <Feather name="check" size={13} color={C.blue} />}
      <T style={{fontSize: 12, color: selected ? C.blue : C.muted, fontWeight: selected ? '700' : '400'}}>{label}</T>
    </Pressable>
  );
}

// Floats over the top of the page so showing or dismissing it never shifts the content; confirmations clear after a few seconds, errors stay until tapped.
function NoticeBanner() {
  const {notice, clearNotice} = useStore();
  useEffect(() => {
    if (!notice || notice.kind === 'error') return;
    const t = setTimeout(clearNotice, 4000);
    return () => clearTimeout(t);
  }, [notice, clearNotice]);
  if (!notice) return null;
  const error = notice.kind === 'error';
  return (
    <Pressable accessibilityRole="alert" onPress={clearNotice} style={[s.notice, {backgroundColor: error ? C.softDanger : C.softSuccess, borderColor: error ? '#f3d3d6' : '#cfe6d8'}]}>
      <Icon name={error ? 'alert-circle' : 'check-circle'} size={18} color={error ? C.danger : C.success} />
      <T style={{flex: 1, fontSize: 13, lineHeight: 19, color: error ? C.danger : C.success}}>{notice.text}</T>
      <Icon name="x" size={16} color={C.muted} />
    </Pressable>
  );
}

function ViewerSwitch() {
  const {db, viewer, setViewerId, demoMode, busy} = useStore();
  if (!demoMode) return null;
  const next = db.users[(db.users.findIndex(u => u.id === viewer.id) + 1) % db.users.length];
  return (
    <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={`Viewing as ${viewer.name}. Switch to ${next.name}`} onPress={() => setViewerId(next.id)} style={s.demo}>
      <Icon name="repeat" size={11} color={C.warn} />
      <T style={{fontSize: 11, color: C.warn, fontWeight: '500'}}>Demo · {viewer.name}</T>
    </Pressable>
  );
}

export function Page({title, subtitle, children, footer, back = false}: {title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode; back?: boolean}) {
  const {viewer, busy, refreshing, demoMode, live, refresh} = useStore();
  return (
    <SafeAreaView edges={['top']} style={{flex: 1, backgroundColor: 'white'}}>
      <View style={s.top}>
        {back ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={{flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4}}>
            <Icon name="chevron-left" size={22} />
            <T style={{fontSize: 16, fontWeight: '500'}}>Back</T>
          </Pressable>
        ) : (
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
            <View style={s.mark}>
              <View style={s.markLine} />
              <View style={[s.markLine, {transform: [{rotate: '-24deg'}]}]} />
            </View>
            <T style={s.logo}>splitbill</T>
          </View>
        )}
        <View style={[s.row, {gap: 10}]}>
          {/* Fixed-size slot, so saving and live refreshes never move the page. */}
          <View accessibilityLiveRegion="polite" accessibilityLabel={busy ? 'Saving' : refreshing ? 'Updating' : undefined} style={{width: 18, alignItems: 'center'}}>
            {(busy || refreshing) && <ActivityIndicator size="small" color={C.blue} />}
          </View>
          <ViewerSwitch />
          <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => router.push('/profile')} style={{padding: 4}}>
            <Avatar user={viewer} size={34} />
          </Pressable>
        </View>
      </View>
      <View style={{flex: 1}}>
        <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
          <T style={s.title}>{title}</T>
          {subtitle && <T style={s.sub}>{subtitle}</T>}
          {!demoMode && <Pressable accessibilityRole="button" accessibilityLabel="Refresh group" accessibilityState={{disabled: busy || refreshing}} disabled={busy || refreshing} onPress={refresh} style={{paddingVertical: 10}}><T style={s.caption}>{live ? 'Live updates on · Tap to refresh' : 'Live updates reconnecting · Tap to refresh'}</T></Pressable>}
          {children}
        </ScrollView>
        <View pointerEvents="box-none" style={s.noticeLayer}><NoticeBanner /></View>
      </View>
      {footer && <View style={s.footer}>{footer}</View>}
    </SafeAreaView>
  );
}

export function Label({children}: {children: React.ReactNode}) {
  return <T style={s.label}>{children}</T>;
}

export function Field({label, value, onChange, text = false, placeholder}: {label: string; value: string; onChange: (v: string) => void; text?: boolean; placeholder?: string}) {
  return (
    <View style={{flex: 1}}>
      <Label>{label}</Label>
      <TextInput accessibilityLabel={label} placeholder={placeholder} placeholderTextColor="#9aa1ad" keyboardType={text ? 'default' : 'decimal-pad'} value={value} onChangeText={onChange} style={s.input} />
    </View>
  );
}

// Switch with the same white thumb on iOS, Android and web (react-native-web otherwise draws a teal thumb).
export function Toggle({value, onValueChange, label, disabled, color = C.blue}: {value: boolean; onValueChange: (v: boolean) => void; label: string; disabled?: boolean; color?: string}) {
  return (
    <Switch
      accessibilityLabel={label}
      disabled={disabled}
      value={value}
      onValueChange={onValueChange}
      trackColor={{false: '#dfe3ea', true: color}}
      thumbColor="white"
      ios_backgroundColor="#dfe3ea"
      {...({activeThumbColor: 'white'} as object)}
    />
  );
}

export function Row({children, style}: {children: React.ReactNode; style?: StyleProp<ViewStyle>}) {
  return <View style={[s.row, style]}>{children}</View>;
}

// The card has no stored expiry, so derive a stable one from its number.
const cardExpiry = (last4: string) => {
  const n = Number(last4) || 0;
  return `${String((n % 12) + 1).padStart(2, '0')}/${30 + (n % 4)}`;
};

// A standard card face: issuer and contactless on top, chip, masked number, cardholder, expiry, network mark.
export function CardVisual({holder, groupName, last4, frozen}: {holder: string; groupName: string; last4: string; frozen: boolean}) {
  return (
    <View
      accessible
      accessibilityLabel={`Visa card ending in ${last4}, ${holder}, ${groupName}${frozen ? ', frozen' : ''}`}
      style={[s.card, frozen && {opacity: 0.6}]}
    >
      <View accessible={false} style={s.cardArc} />
      <View accessible={false} style={[s.cardArc, {right: -65, top: 35, borderColor: '#2f4466'}]} />
      <View style={s.row}>
        <View style={{flexShrink: 1}}>
          <T style={{color: 'white', fontWeight: '700', fontSize: 20, letterSpacing: -0.6}}>splitbill</T>
          <T numberOfLines={1} style={{color: '#aebbd1', fontSize: 11, marginTop: 1}}>{groupName}</T>
        </View>
        {frozen ? (
          <View style={s.cardFrozen}>
            <Icon name="lock" size={12} color="white" />
            <T style={{color: 'white', fontSize: 10, fontWeight: '700', letterSpacing: 1}}>FROZEN</T>
          </View>
        ) : (
          <View style={{transform: [{rotate: '90deg'}]}}>
            <Icon name="wifi" size={22} color="#ccd5e5" />
          </View>
        )}
      </View>
      <View style={s.cardChip}>
        <View style={[s.cardChipLine, {top: 11}]} />
        <View style={[s.cardChipLine, {top: 21}]} />
        <View style={s.cardChipCenter} />
      </View>
      <T style={{color: 'white', fontSize: 19, letterSpacing: 2.5, fontVariant: ['tabular-nums']}}>•••• •••• •••• {last4}</T>
      <View style={[s.row, {alignItems: 'flex-end', marginTop: 'auto'}]}>
        <View style={{flexShrink: 1}}>
          <T style={s.cardLabel}>CARDHOLDER</T>
          <T numberOfLines={1} style={s.cardValue}>{holder.toUpperCase()}</T>
        </View>
        <View style={{marginHorizontal: 12}}>
          <T style={s.cardLabel}>VALID THRU</T>
          <T style={[s.cardValue, {fontVariant: ['tabular-nums']}]}>{cardExpiry(last4)}</T>
        </View>
        <T style={{color: 'white', fontSize: 26, fontWeight: '700', fontStyle: 'italic', letterSpacing: -0.5}}>VISA</T>
      </View>
    </View>
  );
}

export function GroupPicker({allowNew = false}: {allowNew?: boolean}) {
  const {db, viewer, group, setGroupId} = useStore();
  const groups = db.groups.filter(g => g.members.some(m => m.userId === viewer.id));
  if (!groups.length && !allowNew) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8, paddingBottom: 18}}>
      {groups.map(g => (
        <Chip key={g.id} label={g.name} selected={g.id === group?.id} check={false} onPress={() => setGroupId(g.id)} />
      ))}
      {allowNew && <Chip label="+ New group" selected={false} check={false} onPress={() => router.push('/new-group')} />}
    </ScrollView>
  );
}

export function EmptyState({icon, title, body, action}: {icon: React.ComponentProps<typeof Feather>['name']; title: string; body: string; action?: React.ReactNode}) {
  return (
    <View style={{alignItems: 'center', paddingTop: 50, paddingBottom: 30}}>
      <Icon name={icon} size={32} color={C.muted} />
      <T style={{fontSize: 21, fontWeight: '700', marginTop: 20, textAlign: 'center'}}>{title}</T>
      <T style={[s.small, {textAlign: 'center', marginTop: 10, marginBottom: 20}]}>{body}</T>
      {action}
    </View>
  );
}

export const ago = (now: number, at: number) => {
  const m = Math.max(0, Math.round((now - at) / 60000));
  if (m < 60) return m <= 1 ? 'just now' : `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};
export const shortDate = (at: number) => new Date(at).toLocaleDateString('en-US', {month: 'short', day: 'numeric'});

export const s = StyleSheet.create({
  text: {fontFamily: 'DM-Regular', color: C.ink, fontSize: 15, lineHeight: 22},
  page: {paddingHorizontal: 24, paddingTop: 12, paddingBottom: 30, width: '100%', maxWidth: 480, alignSelf: 'center'},
  top: {paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  logo: {fontSize: 23, lineHeight: 28, fontWeight: '700', letterSpacing: -1},
  mark: {width: 24, height: 25, flexDirection: 'row', gap: 3, alignItems: 'center'},
  markLine: {width: 7, height: 21, borderRadius: 2, backgroundColor: C.blue, transform: [{rotate: '24deg'}]},
  demo: {flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.softWarn, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6},
  title: {fontSize: 28, lineHeight: 35, fontWeight: '700', letterSpacing: -0.9, marginBottom: 6},
  sub: {color: C.muted, fontSize: 14, lineHeight: 21, marginBottom: 20},
  box: {borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 20, marginBottom: 16},
  button: {backgroundColor: C.blue, borderWidth: 1, borderColor: 'transparent', borderRadius: 12, minHeight: 52, justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 18, marginVertical: 5},
  secondary: {backgroundColor: 'white', borderWidth: 1, borderColor: '#c5ccd6'},
  label: {fontSize: 12, lineHeight: 18, color: C.muted, fontWeight: '500', marginBottom: 8, marginTop: 8},
  row: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10},
  input: {borderWidth: 1, borderColor: '#d8dde6', padding: 12, borderRadius: 10, fontSize: 17, fontFamily: 'DM-Medium', color: C.ink, backgroundColor: 'white', minWidth: 0, minHeight: 48},
  smallInput: {borderWidth: 1, borderColor: '#d8dde6', paddingHorizontal: 8, paddingVertical: 8, borderRadius: 10, fontSize: 14, fontFamily: 'DM-Medium', color: C.ink, backgroundColor: 'white', width: 76, textAlign: 'right'},
  divider: {height: 1, backgroundColor: C.line, marginVertical: 20},
  small: {fontSize: 12, color: C.muted, lineHeight: 18},
  section: {fontSize: 17, lineHeight: 24, fontWeight: '700', marginTop: 28, marginBottom: 10, letterSpacing: -0.3},
  card: {backgroundColor: C.dark, borderRadius: 16, padding: 22, marginBottom: 14, overflow: 'hidden', width: '100%', maxWidth: 420, aspectRatio: 1.586, alignSelf: 'center'},
  cardChip: {width: 44, height: 33, borderRadius: 6, backgroundColor: '#d8b45a', marginTop: 14, marginBottom: 12, overflow: 'hidden'},
  cardChipLine: {position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#a8873a'},
  cardChipCenter: {position: 'absolute', left: 15, top: 6, width: 14, height: 21, borderRadius: 3, borderWidth: 1, borderColor: '#a8873a'},
  cardFrozen: {flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3},
  cardLabel: {color: '#8899b6', fontSize: 9, letterSpacing: 1},
  cardValue: {color: '#e6ebf4', fontSize: 13, fontWeight: '500', letterSpacing: 1, marginTop: 2},
  cardArc: {position: 'absolute', width: 240, height: 240, borderRadius: 120, borderWidth: 32, borderColor: '#263750', right: -70, top: -110},
  noticeLayer: {position: 'absolute', top: 6, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 16, zIndex: 10},
  notice: {flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderRadius: 12, borderWidth: 1, padding: 14, width: '100%', maxWidth: 448, shadowColor: '#171e2d', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: {width: 0, height: 4}, elevation: 4},
  footer: {borderTopWidth: 1, borderColor: C.line, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 14, backgroundColor: 'white'},
  money: {fontSize: 52, lineHeight: 62, fontWeight: '500', letterSpacing: -2.2, fontVariant: ['tabular-nums']},
  listRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 12, borderBottomWidth: 1, borderColor: C.line},
  caption: {fontSize: 11, color: C.muted, lineHeight: 17},
  strong: {fontWeight: '700', fontVariant: ['tabular-nums']},
});
