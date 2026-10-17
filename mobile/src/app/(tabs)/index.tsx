import React, {useState} from 'react';
import {View, Pressable, TextInput} from 'react-native';
import {router} from 'expo-router';
import {Page, T, Button, Avatar, Icon, Pill, Segmented, Field, GroupPicker, EmptyState, Row, ago, s, C} from '../../lib/ui';
import {useStore} from '../../lib/store';
import {api} from '../../lib/api';
import {money, cents, toInput} from '../../lib/money';
import {availableFunds, currentProposal, inGoodStanding, isActive, openBuyingPowerProposal, pendingCharge, requiredBalances, userById, waitingOn} from '../../lib/domain';
import type {Group} from '../../lib/domain';

export default function Home() {
  const {viewer, group} = useStore();
  return (
    <Page title={`Hey, ${viewer.name}`} subtitle="A little less settling up." footer={group ? <HomeFooter group={group} /> : undefined}>
      <GroupPicker allowNew />
      {!group ? (
        <EmptyState icon="users" title="No groups yet" body="Start a group with roommates or friends. Everyone deposits an equal share, then any member can pay with the group card." action={<Button title="Create a group" onPress={() => router.push('/new-group')} />} />
      ) : isActive(group) ? (
        <ActiveGroup group={group} />
      ) : (
        <FormingGroup group={group} />
      )}
    </Page>
  );
}

function HomeFooter({group}: {group: Group}) {
  const {db, viewer, run} = useStore();
  const me = group.members.find(m => m.userId === viewer.id)!;
  if (!me.joined) {
    const need = requiredBalances(group)[viewer.id];
    return <Button title={`Deposit ${money(need)} to join`} onPress={() => run(a => api.joinGroup(a, group.id), `You joined ${group.name}. Your group card is ready to add to a wallet.`)} />;
  }
  const pending = pendingCharge(db, group.id);
  return <Button title={pending ? 'Review pending split' : 'Open your group card'} onPress={() => router.push(pending ? '/split' : '/card')} />;
}

function FormingGroup({group}: {group: Group}) {
  const {db} = useStore();
  const required = requiredBalances(group);
  const joined = group.members.filter(m => m.joined).length;
  return (
    <>
      <View style={s.box}>
        <Pill label="Waiting for deposits" tone="warn" />
        <T style={{fontSize: 20, fontWeight: '700', marginTop: 16}}>{group.name}</T>
        <T style={[s.small, {marginTop: 4}]}>Created by {userById(db, group.createdBy).name}</T>
        <T style={[s.money, {marginTop: 14}]}>{money(group.buyingPower)}</T>
        <T style={s.small}>Group buying power · {joined} of {group.members.length} deposited</T>
      </View>
      <T style={s.section}>Members</T>
      {group.members.map(m => (
        <View key={m.userId} style={s.listRow}>
          <Avatar user={userById(db, m.userId)} size={36} />
          <View style={{flex: 1}}>
            <T style={{fontWeight: '500'}}>{userById(db, m.userId).name}</T>
            <T style={s.caption}>Initial deposit {money(required[m.userId])}</T>
          </View>
          <Pill label={m.joined ? 'Deposited' : 'Pending'} tone={m.joined ? 'success' : 'muted'} />
        </View>
      ))}
      <T style={[s.caption, {marginTop: 16}]}>Cards activate once everyone has made their first deposit. Deposits are simulated.</T>
    </>
  );
}

function ActiveGroup({group}: {group: Group}) {
  const {db, viewer, now, run} = useStore();
  const pending = pendingCharge(db, group.id);
  const bpp = openBuyingPowerProposal(db, group.id);
  const required = requiredBalances(group);
  const available = availableFunds(db, group);
  const status = group.frozen ? (['Frozen', 'danger'] as const) : pending ? (['Split pending', 'warn'] as const) : (['Card ready', 'success'] as const);

  return (
    <>
      <View style={s.box}>
        <Row>
          <View style={{width: 42, height: 42, borderRadius: 12, backgroundColor: '#f2ede6', alignItems: 'center', justifyContent: 'center'}}>
            <Icon name="home" color="#84684a" />
          </View>
          <Pill label={status[0]} tone={status[1]} />
        </Row>
        <T style={{fontSize: 20, fontWeight: '700', marginTop: 18, letterSpacing: -0.4}}>{group.name}</T>
        <T style={[s.small, {marginTop: 4}]}>{group.members.length} members · {money(group.buyingPower)} buying power</T>
        <T style={[s.money, {marginTop: 14}]}>{money(Math.max(0, available))}</T>
        <T style={s.small}>Available in the group fund{pending ? ` (after ${pending.merchant})` : ''}</T>
        {group.frozen && <T style={{color: C.danger, fontSize: 13, marginTop: 12}}>Frozen: {group.frozen.reason} Escalated to the dispute center.</T>}
      </View>

      {pending && (
        <Pressable accessibilityRole="button" onPress={() => router.push('/split')} style={[s.box, {backgroundColor: C.softWarn, borderColor: C.softWarn}]}>
          <Row>
            <View style={{flex: 1}}>
              <T style={{fontWeight: '700'}}>{pending.merchant} · {money(pending.amount)}</T>
              <T style={[s.small, {marginTop: 4}]}>
                Paid by {userById(db, pending.cardholderId).name} {ago(now, pending.createdAt)} ·{' '}
                {(() => {
                  const waiting = waitingOn(currentProposal(pending));
                  if (waiting.includes(viewer.id)) return 'needs your OK';
                  return `waiting on ${waiting.map(id => userById(db, id).name).join(', ')}`;
                })()}
              </T>
            </View>
            <Icon name="chevron-right" color={C.muted} size={18} />
          </Row>
        </Pressable>
      )}

      {bpp && (
        <View style={s.box}>
          <T style={{fontWeight: '700'}}>
            {userById(db, bpp.authorId).name} proposed {bpp.amount > group.buyingPower ? 'raising' : 'lowering'} buying power to {money(bpp.amount)}
          </T>
          <T style={[s.small, {marginTop: 4}]}>
            {bpp.amount > group.buyingPower
              ? `Everyone would keep ${money(requiredBalances(group, bpp.amount)[viewer.id])} on deposit. Auto top-up members are charged the difference.`
              : 'Balances stay as they are; each person only needs to stay topped up to the lower amount.'}{' '}
            Accepted by {bpp.acceptedBy.length} of {group.members.length}.
          </T>
          {!bpp.acceptedBy.includes(viewer.id) && (
            <Row style={{marginTop: 10}}>
              <View style={{flex: 1}}><Button secondary title="Decline" onPress={() => run(a => api.respondBuyingPower(a, bpp.id, false), 'Proposal declined.')} /></View>
              <View style={{flex: 1}}><Button title="Accept" onPress={() => run(a => api.respondBuyingPower(a, bpp.id, true), 'You accepted the new buying power.')} /></View>
            </Row>
          )}
        </View>
      )}

      <T style={s.section}>Members</T>
      {group.members.map(m => {
        const user = userById(db, m.userId);
        const good = inGoodStanding(group, m.userId);
        return (
          <View key={m.userId} style={s.listRow}>
            <Avatar user={user} size={36} />
            <View style={{flex: 1}}>
              <T style={{fontWeight: '500'}}>{user.name}{m.userId === viewer.id ? ' (you)' : ''}</T>
              <T style={s.caption}>
                Balance {money(m.balance)} of {money(required[m.userId])}
                {m.autoDeposit ? ' · auto top-up' : ''}
              </T>
            </View>
            <Pill label={good ? 'On track' : 'Restricted'} tone={good ? 'success' : 'warn'} />
          </View>
        );
      })}
      <T style={[s.caption, {marginTop: 10}]}>Members below their share can only spend their own balance until they top up.</T>

      <GroupSettings key={group.id} group={group} />
    </>
  );
}

function GroupSettings({group}: {group: Group}) {
  const {db, run} = useStore();
  const [method, setMethod] = useState(group.defaultSplit.method);
  const [percents, setPercents] = useState<Record<string, string>>(() =>
    Object.fromEntries(group.members.map(m => [m.userId, group.defaultSplit.method === 'percent' ? String(group.defaultSplit.percents[m.userId] ?? 0) : (100 / group.members.length).toFixed(2)])),
  );
  const [power, setPower] = useState(toInput(group.buyingPower));
  const total = Object.values(percents).reduce((a, b) => a + (Number(b) || 0), 0);
  const changed = method !== group.defaultSplit.method || method === 'percent';

  return (
    <>
      <T style={s.section}>Default split</T>
      <T style={[s.small, {marginBottom: 12}]}>New charges start with this split. Anyone can propose changes before it’s accepted.</T>
      <Segmented options={[['equal', 'Equally'], ['percent', 'Percentages']]} value={method} onChange={setMethod} />
      {method === 'percent' &&
        group.members.map(m => (
          <Row key={m.userId} style={{paddingVertical: 6}}>
            <T style={{flex: 1}}>{userById(db, m.userId).name}</T>
            <TextInput accessibilityLabel={`${userById(db, m.userId).name} default percent`} keyboardType="decimal-pad" value={percents[m.userId]} onChangeText={v => setPercents({...percents, [m.userId]: v})} style={s.smallInput} />
            <T style={s.small}>%</T>
          </Row>
        ))}
      {method === 'percent' && <T style={[s.caption, {marginTop: 6}]}>Total {Number(total.toFixed(2))}%</T>}
      {changed && (
        <Button
          secondary
          title="Save default split"
          onPress={() =>
            run(
              a => api.setDefaultSplit(a, group.id, method === 'equal' ? {method: 'equal'} : {method: 'percent', percents: Object.fromEntries(Object.entries(percents).map(([k, v]) => [k, Number(v)]))}),
              'Default split saved for future charges.',
            )
          }
        />
      )}

      <T style={s.section}>Buying power</T>
      <T style={[s.small, {marginBottom: 4}]}>Changing it needs everyone’s OK. Raising it asks each person to deposit their equal share of the increase.</T>
      <Row style={{alignItems: 'flex-end'}}>
        <Field label="New buying power ($)" value={power} onChange={setPower} />
        <View style={{flex: 1}}>
          <Button
            secondary
            title="Propose"
            disabled={cents(power) === null}
            onPress={() => run(a => api.proposeBuyingPower(a, group.id, cents(power) ?? 0), 'Proposal sent to the group.')}
          />
        </View>
      </Row>
    </>
  );
}
