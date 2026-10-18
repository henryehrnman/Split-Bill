import React, {useEffect, useState} from 'react';
import {View, Pressable, TextInput} from 'react-native';
import {router} from 'expo-router';
import {Page, T, Button, Field, Avatar, Icon, Label, Segmented, Row, periodLabel, s, C} from '../lib/ui';
import {useStore} from '../lib/store';
import {api} from '../lib/api';
import {allocate, cents, money} from '../lib/money';
import type {User} from '../lib/domain';

const PERIODS: [string, string][] = [['7', 'Weekly'], ['14', '2 weeks'], ['30', 'Monthly'], ['custom', 'Custom']];

export default function NewGroup() {
  const {viewer, run, setGroupId, demoMode} = useStore();
  const [name, setName] = useState('');
  const [invites, setInvites] = useState<User[]>([]);
  const [query, setQuery] = useState('');
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [search, setSearch] = useState<{key: string; users: User[]; error: string} | null>(null);
  const [budget, setBudget] = useState('300');
  const [period, setPeriod] = useState('14');
  const [customDays, setCustomDays] = useState('10');
  const amount = cents(budget);
  const days = period === 'custom' ? Number(customDays) : Number(period);
  const validDays = Number.isInteger(days) && days >= 1 && days <= 365;
  const people = [viewer, ...invites];
  const each = amount ? allocate(amount, people.map(() => 1)) : [];
  const searchKey = JSON.stringify([viewer.id, demoMode, query, invites.map(u => u.id), searchAttempt]);
  const shouldSearch = query.trim().length >= 2;
  const currentSearch = search?.key === searchKey ? search : null;
  const results = shouldSearch ? currentSearch?.users ?? [] : [];
  const searching = shouldSearch && !currentSearch;
  const searchError = shouldSearch ? currentSearch?.error : '';

  useEffect(() => {
    if (query.trim().length < 2) return;
    let active = true;
    const timer = setTimeout(() => {
      api.searchUsers(viewer.id, query, invites.map(u => u.id)).then(
        users => {
          if (active) setSearch({key: searchKey, users, error: ''});
        },
        () => {
          if (active) setSearch({key: searchKey, users: [], error: 'Could not search for people. Try again.'});
        },
      );
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [viewer.id, demoMode, query, invites, searchKey, searchAttempt]);

  const create = () =>
    run(a => api.createGroup(a, {name, inviteIds: invites.map(u => u.id), budget: amount ?? 0, periodDays: days, initialContributionLimit: Math.ceil((amount ?? 0) / 2)}), `${name.trim()} created. Your final share is collected once everyone responds and at least two members join.`).then(next => {
      if (!next) return;
      setGroupId(next.groups[next.groups.length - 1].id);
      router.replace('/');
    });

  return (
    <Page
      back
      title="New group"
      subtitle="Set a budget and invite people. Your final share is collected when the group forms."
      footer={<Button title="Create & send invites" disabled={!name.trim() || !invites.length || !amount || !validDays} onPress={create} />}>
      <Field text label="Group name" value={name} onChange={setName} placeholder="e.g. Roommates" />

      <T style={s.section}>Budget</T>
      <Field label="Budget per period ($)" value={budget} onChange={setBudget} />
      <Label>Period</Label>
      <Segmented options={PERIODS} value={period} onChange={setPeriod} />
      {period === 'custom' && (
        <Row style={{marginTop: -10, marginBottom: 10, justifyContent: 'flex-start'}}>
          <T style={s.small}>Every</T>
          <TextInput accessibilityLabel="Period length in days" keyboardType="number-pad" value={customDays} onChangeText={setCustomDays} style={s.smallInput} />
          <T style={s.small}>days</T>
        </Row>
      )}
      {!!amount && validDays && <T style={s.caption}>{money(amount)} {periodLabel(days)}. The first period starts once everyone responds and at least two members join. Final equal shares are collected automatically.</T>}

      <T style={s.section}>Invite people</T>
      <TextInput
        accessibilityLabel="Search by username, email or phone"
        placeholder="Username, email or phone"
        placeholderTextColor="#9aa1ad"
        autoCapitalize="none"
        autoCorrect={false}
        value={query}
        onChangeText={setQuery}
        style={s.input}
      />
      {searching && <T style={[s.small, {marginTop: 8}]}>Searching for people…</T>}
      {!!searchError && (
        <View style={{marginTop: 8}}>
          <T accessibilityRole="alert" style={[s.small, {color: C.danger}]}>{searchError}</T>
          <Button secondary title="Retry search" onPress={() => setSearchAttempt(attempt => attempt + 1)} />
        </View>
      )}
      {shouldSearch && !searching && !searchError && !results.length && <T style={[s.small, {marginTop: 8}]}>No one found. Try their exact username, email or phone number.</T>}
      {results.map(u => (
        <Pressable key={u.id} accessibilityRole="button" accessibilityLabel={`Invite ${u.name}`} onPress={() => { setInvites(current => current.some(invitee => invitee.id === u.id) ? current : [...current, u]); setQuery(''); }} style={s.listRow}>
          <Avatar user={u} size={34} />
          <View style={{flex: 1, minWidth: 0}}>
            <T style={{fontWeight: '500'}}>{u.name}</T>
            <T style={s.caption}>@{u.handle} · {u.email}</T>
          </View>
          <Icon name="user-plus" size={18} color={C.blue} />
        </Pressable>
      ))}
      {demoMode && <T style={[s.caption, {marginTop: 8}]}>Demo users: maya.l, jordanr, connorz, saahil — or search by email or phone.</T>}

      <View style={{marginTop: 14}}>
        {people.map((u, i) => {
          const id = u.id;
          return (
            <Row key={id} style={{paddingVertical: 8}}>
              <Avatar user={u} size={30} />
              <View style={{flex: 1, minWidth: 0}}>
                <T style={{fontSize: 14}}>{u.name}{id === viewer.id ? ' (you)' : ''}</T>
                <T style={s.caption}>{id === viewer.id ? 'Your estimated share' : 'Invited · estimated share'}</T>
              </View>
              {!!amount && <T style={[s.strong, {flexShrink: 0}]}>{money(each[i])}</T>}
              {id !== viewer.id && (
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${u.name}`} onPress={() => setInvites(invites.filter(x => x.id !== id))} style={{padding: 6}}>
                  <Icon name="x" size={16} color={C.muted} />
                </Pressable>
              )}
            </Row>
          );
        })}
      </View>
      {!!amount && people.length >= 2 && <T style={[s.caption, {marginTop: 8}]}>Shares are estimates. If someone declines, your share can rise to {money(Math.ceil(amount / 2))}. That final share is collected automatically when the group forms. Auto-refill is on for future periods unless you turn it off.</T>}
    </Page>
  );
}
