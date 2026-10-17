import React, {useState} from 'react';
import {View, Switch, Pressable} from 'react-native';
import {router} from 'expo-router';
import {Page, T, Avatar, Button, Field, Row, StandingPill, periodLabel, shortDate, s, C} from '../lib/ui';
import {useStore} from '../lib/store';
import {api} from '../lib/api';
import {money, cents} from '../lib/money';
import {DAY, currentProposal, groupById, groupsFor, isActive, memberOf, nextPeriodAt, pendingCharge, periodSpend, shares, spendSummary, standing} from '../lib/domain';
import type {Group, LedgerEntry} from '../lib/domain';

const LEDGER_LABEL: Record<LedgerEntry['kind'], string> = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  'period-top-up': 'Period refill',
  'top-up-failed': 'Refill failed',
  charge: 'Share of charge',
  'debt-recovery': 'Card charge to cover negative balance',
  'debt-recovery-failed': 'Card charge failed',
};
const FAILED: LedgerEntry['kind'][] = ['top-up-failed', 'debt-recovery-failed'];

export default function Profile() {
  const {db, viewer, setViewerId, group, now, run} = useStore();
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
          <T style={[s.small, {flex: 1, color: FAILED.includes(e.kind) ? C.danger : C.muted}]}>
            {LEDGER_LABEL[e.kind]} · {groupById(db, e.groupId).name} · {shortDate(e.at)}
          </T>
          <T style={[s.small, {fontVariant: ['tabular-nums'], color: C.ink}]}>{FAILED.includes(e.kind) ? money(e.amount) : (e.amount > 0 ? '+' : '') + money(e.amount)}</T>
        </Row>
      ))}

      <T style={s.section}>Demo controls</T>
      <T style={[s.small, {marginBottom: 6}]}>Shortcuts for walking through edge cases. They don’t exist in the real product.</T>
      {group && memberOf(group, viewer.id).status === 'joined' && (
        <Button
          secondary
          title="Skip to next budget period"
          onPress={() => run(() => api.skipAhead(Math.max(1, Math.ceil((nextPeriodAt(group) - now) / DAY))), `New period for ${group.name}. Auto-refill members were topped up to their share.`)}
        />
      )}
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
  const me = memberOf(group, viewer.id);
  const share = shares(group)[viewer.id];
  const used = periodSpend(db, group, viewer.id);
  const spend = spendSummary(db, group.id, now, viewer.id);
  const pending = pendingCharge(db, group.id);
  const daysLeft = Math.max(0, Math.ceil((nextPeriodAt(group) - now) / DAY));
  const value = cents(amount);

  return (
    <View style={[s.box, {marginTop: 24}]}>
      <Row>
        <T style={{fontSize: 17, fontWeight: '700'}}>{group.name}</T>
        <StandingPill standing={standing(group, viewer.id)} />
      </Row>
      <T style={s.caption}>{money(group.budget)} {periodLabel(group.periodDays)} · next period in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}</T>
      <Row style={{marginTop: 14}}>
        <View>
          <T style={s.caption}>Your balance</T>
          <T style={{fontSize: 26, fontWeight: '700', fontVariant: ['tabular-nums'], color: me.balance < 0 ? C.danger : C.ink}}>{money(me.balance)}</T>
        </View>
        <View style={{alignItems: 'flex-end'}}>
          <T style={s.caption}>Your share per period</T>
          <T style={{fontSize: 17, fontWeight: '500', fontVariant: ['tabular-nums']}}>{money(share)}</T>
        </View>
      </Row>
      <T style={[s.caption, {marginTop: 6}]}>
        {me.status === 'joined' ? `${money(used)} of your share used this period · ` : ''}{money(spend.month)} this month · {money(spend.total)} all time
      </T>
      {me.suspended && <T style={{color: C.danger, fontSize: 13, marginTop: 8}}>Suspended: we couldn’t charge your personal card for {money(-me.balance)}. The group is covering it until you add funds.</T>}
      {me.status === 'invited' ? (
        <Button title="View invitation" onPress={() => router.replace('/')} />
      ) : (
        <>
          <Field label="Amount ($)" value={amount} onChange={setAmount} placeholder={me.balance < share ? (Math.max(0, share - me.balance) / 100).toFixed(2) : '0.00'} />
          <Row>
            <View style={{flex: 1}}><Button secondary title="Withdraw" disabled={!value || !!pending} onPress={() => run(a => api.withdraw(a, group.id, value ?? 0), `Withdrew ${money(value ?? 0)}.`).then(ok => ok && setAmount(''))} /></View>
            <View style={{flex: 1}}><Button title="Add funds" disabled={!value} onPress={() => run(a => api.deposit(a, group.id, value ?? 0), `Added ${money(value ?? 0)}.`).then(ok => ok && setAmount(''))} /></View>
          </Row>
          {pending && <T style={s.caption}>Withdrawals open once the {pending.merchant} split is settled.</T>}
          <Row style={{paddingTop: 10}}>
            <View style={{flex: 1}}>
              <T style={{fontSize: 14}}>Auto-refill each period</T>
              <T style={s.caption}>Charge my bank back up to {money(share)} when a new period starts</T>
            </View>
            <Switch accessibilityLabel={`Auto-refill for ${group.name}`} value={me.autoDeposit} trackColor={{false: '#dfe3ea', true: C.blue}} onValueChange={v => { run(a => api.setAutoDeposit(a, group.id, v)); }} />
          </Row>
          <Row style={{paddingTop: 10}}>
            <View style={{flex: 1}}>
              <T style={{fontSize: 14}}>Simulate bank declines</T>
              <T style={s.caption}>Demo: deposits, refills and debt recovery from you fail</T>
            </View>
            <Switch accessibilityLabel={`Simulate failed top-ups for ${group.name}`} value={me.failTopUps} trackColor={{false: '#dfe3ea', true: C.danger}} onValueChange={v => { run(a => api.setFailTopUps(a, group.id, v)); }} />
          </Row>
        </>
      )}
      {!isActive(group) && me.status === 'joined' && <T style={[s.caption, {marginTop: 8}]}>Waiting for everyone invited to accept or decline.</T>}
    </View>
  );
}
