import React, {useState} from 'react';
import {View, Pressable, TextInput} from 'react-native';
import {router} from 'expo-router';
import {Page, T, Button, Field, Avatar, Icon, Label, Segmented, Row, periodLabel, s, C} from '../lib/ui';
import {useStore} from '../lib/store';
import {api} from '../lib/api';
import {allocate, cents, money} from '../lib/money';
import {searchUsers, userById} from '../lib/domain';

const PERIODS: [string, string][] = [['7', 'Weekly'], ['14', 'Every 2 weeks'], ['30', 'Monthly'], ['custom', 'Custom']];

export default function NewGroup() {
  const {db, viewer, run, setGroupId} = useStore();
  const [name, setName] = useState('');
  const [invites, setInvites] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [budget, setBudget] = useState('300');
  const [period, setPeriod] = useState('14');
  const [customDays, setCustomDays] = useState('10');
  const amount = cents(budget);
  const days = period === 'custom' ? Number(customDays) : Number(period);
  const validDays = Number.isInteger(days) && days >= 1 && days <= 365;
  const people = [viewer.id, ...invites];
  const each = amount ? allocate(amount, people.map(() => 1)) : [];
  const results = searchUsers(db, query, [viewer.id, ...invites]);

  const create = () =>
    run(a => api.createGroup(a, {name, inviteIds: invites, budget: amount ?? 0, periodDays: days}), `${name.trim()} created. You deposited ${money(each[0] ?? 0)}; the card works once everyone responds.`).then(next => {
      if (!next) return;
      setGroupId(next.groups[next.groups.length - 1].id);
      router.replace('/');
    });

  return (
    <Page
      back
      title="New group"
      subtitle="Set a budget for each period and invite people. Everyone deposits an equal share; anyone can pay with their own card on the group fund."
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
      {!!amount && validDays && <T style={s.caption}>{money(amount)} {periodLabel(days)}. At the start of each period, members are topped back up to their share (automatically, unless they turn auto-refill off).</T>}

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
      {query.trim().length >= 2 && !results.length && <T style={[s.small, {marginTop: 8}]}>No one found. Try their exact username, email or phone number.</T>}
      {results.map(u => (
        <Pressable key={u.id} accessibilityRole="button" accessibilityLabel={`Invite ${u.name}`} onPress={() => { setInvites([...invites, u.id]); setQuery(''); }} style={s.listRow}>
          <Avatar user={u} size={34} />
          <View style={{flex: 1}}>
            <T style={{fontWeight: '500'}}>{u.name}</T>
            <T style={s.caption}>@{u.handle} · {u.email}</T>
          </View>
          <Icon name="user-plus" size={18} color={C.blue} />
        </Pressable>
      ))}
      <T style={[s.caption, {marginTop: 8}]}>Demo users: maya.l, jordanr, connorz, saahil — or search by email or phone.</T>

      <View style={{marginTop: 14}}>
        {people.map((id, i) => {
          const u = userById(db, id);
          return (
            <Row key={id} style={{paddingVertical: 8}}>
              <Avatar user={u} size={30} />
              <View style={{flex: 1}}>
                <T style={{fontSize: 14}}>{u.name}{id === viewer.id ? ' (you)' : ''}</T>
                <T style={s.caption}>{id === viewer.id ? 'Deposits now' : 'Invited · deposits on accepting'}</T>
              </View>
              {!!amount && <T style={s.strong}>{money(each[i])}</T>}
              {id !== viewer.id && (
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${u.name}`} onPress={() => setInvites(invites.filter(x => x !== id))} style={{padding: 6}}>
                  <Icon name="x" size={16} color={C.muted} />
                </Pressable>
              )}
            </Row>
          );
        })}
      </View>
    </Page>
  );
}
