import React, {useState} from 'react';
import {View} from 'react-native';
import {router} from 'expo-router';
import {Page, T, Button, Field, Chip, Row, s} from '../lib/ui';
import {useStore} from '../lib/store';
import {api} from '../lib/api';
import {allocate, cents, money} from '../lib/money';

export default function NewGroup() {
  const {db, viewer, run, setGroupId} = useStore();
  const [name, setName] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [power, setPower] = useState('300');
  const amount = cents(power);
  const people = [viewer.id, ...members];
  const each = amount ? allocate(amount, people.map(() => 1)) : [];

  const create = () =>
    run(a => api.createGroup(a, {name, memberIds: members, buyingPower: amount ?? 0}), `${name.trim()} created. Everyone deposits their share to activate the cards.`).then(next => {
      if (!next) return;
      setGroupId(next.groups[next.groups.length - 1].id);
      setName('');
      setMembers([]);
      router.replace('/');
    });

  return (
    <Page
      back
      title="New group"
      subtitle="Everyone deposits an equal share of the buying power. Any member can then pay with their own card on the group fund."
      footer={<Button title="Create group" disabled={!name.trim() || !members.length || !amount} onPress={create} />}>
      <Field text label="Group name" value={name} onChange={setName} placeholder="e.g. Roommates" />
      <T style={s.section}>Members</T>
      <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
        <Chip label={`${viewer.name} (you)`} selected onPress={() => {}} />
        {db.users
          .filter(u => u.id !== viewer.id)
          .map(u => (
            <Chip key={u.id} label={u.name} selected={members.includes(u.id)} onPress={() => setMembers(members.includes(u.id) ? members.filter(x => x !== u.id) : [...members, u.id])} />
          ))}
      </View>
      <T style={s.section}>Buying power</T>
      <Field label="Group buying power ($)" value={power} onChange={setPower} />
      {!!amount && (
        <View style={{marginTop: 12}}>
          {people.map((id, i) => (
            <Row key={id} style={{paddingVertical: 4}}>
              <T style={s.small}>{db.users.find(u => u.id === id)?.name} deposits</T>
              <T style={s.strong}>{money(each[i])}</T>
            </Row>
          ))}
        </View>
      )}
    </Page>
  );
}
