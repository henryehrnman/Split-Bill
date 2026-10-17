import React, {useState} from 'react';
import {View, Switch, Pressable} from 'react-native';
import {router} from 'expo-router';
import {Page, T, Avatar, Button, Field, Pill, Row, shortDate, s, C} from '../lib/ui';
import {useStore} from '../lib/store';
import {api} from '../lib/api';
import {money, cents} from '../lib/money';
import {currentProposal, groupById, groupsFor, inGoodStanding, isActive, requiredBalances, spendSummary} from '../lib/domain';
import type {Group, LedgerEntry} from '../lib/domain';

const LEDGER_LABEL: Record<LedgerEntry['kind'], string> = {deposit: 'Deposit', withdrawal: 'Withdrawal', 'auto-deposit': 'Auto top-up', 'top-up-failed': 'Top-up failed', charge: 'Share of charge'};

export default function Profile() {
  const {db, viewer, setViewerId, group, run} = useStore();
  const [confirm, setConfirm] = useState(false);
  const groups = groupsFor(db, viewer.id);
  const myCharges = db.charges.filter(c => groups.some(g => g.id === c.groupId) && (currentProposal(c).shares[viewer.id] ?? 0) > 0);
  const myLedger = db.ledger.filter(e => e.userId === viewer.id).slice(0, 12);

  return (
    <Page back title="Your account">
      <View style={{flexDirection: 'row', gap: 16, alignItems: 'center', paddingVertical: 12}}>
        <Avatar user={viewer} size={64} />
        <View>
          <T style={{fontSize: 21, fontWeight: '700'}}>{viewer.name}</T>
          <T style={s.small}>Demo account · Checking •• 1024 (sample)</T>
        </View>
      </View>

      <T style={s.section}>Switch demo user</T>
      <T style={[s.small, {marginBottom: 10}]}>Act as another member to propose or accept splits from their side.</T>
      <View style={{flexDirection: 'row', gap: 14}}>
        {db.users.map(u => (
          <Pressable key={u.id} accessibilityRole="button" accessibilityState={{selected: u.id === viewer.id}} accessibilityLabel={`Act as ${u.name}`} onPress={() => setViewerId(u.id)} style={{alignItems: 'center', gap: 4, opacity: u.id === viewer.id ? 1 : 0.55}}>
            <Avatar user={u} size={44} />
            <T style={{fontSize: 12, fontWeight: u.id === viewer.id ? '700' : '400'}}>{u.name}</T>
          </Pressable>
        ))}
      </View>

      {groups.map(g => (
        <GroupBalance key={g.id} group={g} />
      ))}

      <T style={s.section}>Charges you were part of</T>
      {!myCharges.length && <T style={s.small}>None yet.</T>}
      {myCharges.map(c => (
        <Row key={c.id} style={{paddingVertical: 8}}>
          <View style={{flex: 1}}>
            <T style={{fontSize: 14}}>{c.merchant}</T>
            <T style={s.caption}>{groupById(db, c.groupId).name} · {shortDate(c.createdAt)} · {c.status}</T>
          </View>
          <T style={s.strong}>{money(currentProposal(c).shares[viewer.id])}</T>
        </Row>
      ))}

      <T style={s.section}>Funding history</T>
      {!myLedger.length && <T style={s.small}>No deposits yet.</T>}
      {myLedger.map(e => (
        <Row key={e.id} style={{paddingVertical: 6}}>
          <T style={[s.small, {flex: 1, color: e.kind === 'top-up-failed' ? C.danger : C.muted}]}>
            {LEDGER_LABEL[e.kind]} · {groupById(db, e.groupId).name} · {shortDate(e.at)}
          </T>
          <T style={[s.small, {fontVariant: ['tabular-nums'], color: C.ink}]}>{e.kind === 'top-up-failed' ? money(e.amount) : (e.amount > 0 ? '+' : '') + money(e.amount)}</T>
        </Row>
      ))}

      <T style={s.section}>Demo controls</T>
      <T style={[s.small, {marginBottom: 6}]}>Shortcuts for walking through edge cases. They don’t exist in the real product.</T>
      <Button secondary title="Skip ahead 7 days" onPress={() => run(() => api.skipAhead(7), 'Moved the clock forward 7 days. Unsettled splits past the deadline are now disputed.')} />
      {group?.frozen && <Button secondary title={`Resolve ${group.name} dispute (support)`} onPress={() => run(() => api.resolveDisputes(group.id), 'Support resolved the dispute and unfroze the group.')} />}
      <Button secondary title="Reset demo data" onPress={() => setConfirm(true)} />
      {confirm && (
        <>
          <T style={s.small}>Restore the original sample groups and charges? Everything you’ve done in the demo will be lost.</T>
          <Button danger title="Reset demo" onPress={() => run(() => api.reset(), 'Demo data reset.').then(() => { setConfirm(false); router.replace('/'); })} />
          <Button secondary title="Keep my data" onPress={() => setConfirm(false)} />
        </>
      )}

      <T style={s.section}>About this prototype</T>
      <T style={s.small}>
        Accounts, deposits, cards, wallets and payments are simulated by a fake backend that runs inside the app and saves to this device. Receipt scanning returns sample receipts for the demo merchants. Nothing is synced between devices and no real money moves.
      </T>
      <T style={[s.caption, {marginTop: 24}]}>Split Bill · iOS, Android & web prototype</T>
    </Page>
  );
}

function GroupBalance({group}: {group: Group}) {
  const {db, viewer, now, run} = useStore();
  const [amount, setAmount] = useState('');
  const me = group.members.find(m => m.userId === viewer.id)!;
  const required = requiredBalances(group)[viewer.id];
  const spend = spendSummary(db, group.id, now, viewer.id);
  const value = cents(amount);

  return (
    <View style={[s.box, {marginTop: 24}]}>
      <Row>
        <T style={{fontSize: 17, fontWeight: '700'}}>{group.name}</T>
        {!me.joined ? <Pill label="Not joined" tone="muted" /> : inGoodStanding(group, viewer.id) ? <Pill label="On track" tone="success" /> : <Pill label="Restricted" tone="warn" />}
      </Row>
      <Row style={{marginTop: 14}}>
        <View>
          <T style={s.caption}>Your balance</T>
          <T style={{fontSize: 26, fontWeight: '700', fontVariant: ['tabular-nums']}}>{money(me.balance)}</T>
        </View>
        <View style={{alignItems: 'flex-end'}}>
          <T style={s.caption}>Your share to keep</T>
          <T style={{fontSize: 17, fontWeight: '500', fontVariant: ['tabular-nums']}}>{money(required)}</T>
        </View>
      </Row>
      <T style={[s.caption, {marginTop: 6}]}>
        You spent {money(spend.month)} this month · {money(spend.total)} all time
      </T>
      {!me.joined ? (
        <Button title={`Deposit ${money(required)} to join`} onPress={() => run(a => api.joinGroup(a, group.id), `You joined ${group.name}.`)} />
      ) : (
        <>
          <Field label="Amount ($)" value={amount} onChange={setAmount} placeholder={me.balance < required ? (Math.max(0, required - me.balance) / 100).toFixed(2) : '0.00'} />
          <Row>
            <View style={{flex: 1}}><Button secondary title="Withdraw" disabled={!value} onPress={() => run(a => api.withdraw(a, group.id, value ?? 0), `Withdrew ${money(value ?? 0)}.`).then(ok => ok && setAmount(''))} /></View>
            <View style={{flex: 1}}><Button title="Add funds" disabled={!value} onPress={() => run(a => api.deposit(a, group.id, value ?? 0), `Added ${money(value ?? 0)}.`).then(ok => ok && setAmount(''))} /></View>
          </Row>
          <Row style={{paddingTop: 10}}>
            <View style={{flex: 1}}>
              <T style={{fontSize: 14}}>Auto top-up</T>
              <T style={s.caption}>Refill to {money(required)} after every split</T>
            </View>
            <Switch accessibilityLabel={`Auto top-up for ${group.name}`} value={me.autoDeposit} trackColor={{false: '#dfe3ea', true: C.blue}} onValueChange={v => { run(a => api.setAutoDeposit(a, group.id, v)); }} />
          </Row>
          <Row style={{paddingTop: 10}}>
            <View style={{flex: 1}}>
              <T style={{fontSize: 14}}>Simulate failed top-ups</T>
              <T style={s.caption}>Demo: the bank declines deposits from you</T>
            </View>
            <Switch accessibilityLabel={`Simulate failed top-ups for ${group.name}`} value={me.failTopUps} trackColor={{false: '#dfe3ea', true: C.danger}} onValueChange={v => { run(a => api.setFailTopUps(a, group.id, v)); }} />
          </Row>
        </>
      )}
      {!isActive(group) && me.joined && <T style={[s.caption, {marginTop: 8}]}>Waiting for everyone else to make their first deposit.</T>}
    </View>
  );
}
