import React, {useState} from 'react';
import {View, Pressable} from 'react-native';
import {router} from 'expo-router';
import {Page, T, Button, Avatar, Icon, Pill, GroupPicker, EmptyState, Row, shortDate, s, C} from '../../lib/ui';
import {useStore} from '../../lib/store';
import {api} from '../../lib/api';
import {money} from '../../lib/money';
import {currentProposal, memberIds, spendSummary, userById} from '../../lib/domain';
import type {Charge} from '../../lib/domain';
import {ChargeNote} from '../../lib/ChargeNote';

export default function Activity() {
  const {db, group, now, demoMode} = useStore();
  const [open, setOpen] = useState<string | null>(null);
  if (!group) {
    return (
      <Page title="Activity" subtitle="Your splits, in one place.">
        <EmptyState icon="file-text" title="Nothing here yet" body="Join a group to see its spending." action={<Button title="Go home" onPress={() => router.push('/')} />} />
      </Page>
    );
  }
  const charges = db.charges.filter(c => c.groupId === group.id);
  const summary = spendSummary(db, group.id, now);
  const monthName = new Date(now).toLocaleDateString('en-US', {month: 'long'});

  return (
    <Page title="Activity" subtitle="Your splits, in one place.">
      <GroupPicker />
      <Row style={{gap: 12, marginBottom: 8}}>
        <Stat label={`${monthName} spend`} value={money(summary.month)} />
        <Stat label="All-time spend" value={money(summary.total)} />
      </Row>
      <T style={s.caption}>{summary.count} settled {summary.count === 1 ? 'charge' : 'charges'} · simulated payments, {demoMode ? 'saved on this device' : 'shared with your group'}</T>

      <T style={s.section}>Charges</T>
      {!charges.length && <T style={s.small}>No purchases yet. Use the card to make the first one.</T>}
      {charges.map(c => (
        <ChargeRow key={c.id} charge={c} open={open === c.id} onToggle={() => setOpen(open === c.id ? null : c.id)} />
      ))}
    </Page>
  );
}

function Stat({label, value}: {label: string; value: string}) {
  return (
    <View style={[s.box, {flex: 1, minWidth: 0, marginBottom: 0, padding: 16}]}>
      <T style={s.caption}>{label}</T>
      <T style={{fontSize: 22, fontWeight: '700', marginTop: 4, fontVariant: ['tabular-nums']}}>{value}</T>
    </View>
  );
}

function ChargeRow({charge, open, onToggle}: {charge: Charge; open: boolean; onToggle: () => void}) {
  const {db, viewer, group, run} = useStore();
  const [confirm, setConfirm] = useState(false);
  const p = currentProposal(charge);
  const status = {pending: ['Split pending', 'warn'], settled: ['Settled', 'success'], disputed: ['Disputed', 'danger']}[charge.status] as [string, 'warn' | 'success' | 'danger'];
  const mine = p.shares[viewer.id] ?? 0;

  return (
    <View style={{borderBottomWidth: 1, borderColor: C.line}}>
      <Pressable accessibilityRole="button" accessibilityState={{expanded: open}} onPress={onToggle} style={[s.row, {paddingVertical: 16}]}>
        <View style={{width: 38, height: 38, borderRadius: 10, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center'}}>
          <Icon name={charge.receipt ? 'file-text' : 'shopping-bag'} size={18} color={C.muted} />
        </View>
        <View style={{flex: 1, minWidth: 0}}>
          <T style={{fontWeight: '500'}}>{charge.merchant}</T>
          <T style={s.caption}>{shortDate(charge.createdAt)} · paid by {userById(db, charge.cardholderId).name}{mine ? ` · your share ${money(mine)}` : ''}</T>
        </View>
        <View style={{alignItems: 'flex-end', gap: 4, flexShrink: 0}}>
          <T style={s.strong}>{money(charge.amount)}</T>
          <Pill label={status[0]} tone={status[1]} />
        </View>
      </Pressable>
      {open && (
        <View style={{paddingBottom: 16}}>
          {group &&
            memberIds(group).map(id => (
              <Row key={id} style={{paddingVertical: 6}}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0}}>
                  <Avatar user={userById(db, id)} size={26} />
                  <T style={{fontSize: 14, flexShrink: 1}}>{userById(db, id).name}</T>
                </View>
                <T style={[s.small, {flexShrink: 0, fontVariant: ['tabular-nums'], color: C.ink}]}>{(p.shares[id] ?? 0) ? money(p.shares[id]) : 'Not involved'}</T>
              </Row>
            ))}
          <ChargeNote key={charge.id} charge={charge} />
          {charge.receipt && (
            <T style={[s.caption, {marginTop: 8}]}>
              Receipt: {charge.receipt.items.map(i => `${i.name} ${money(i.amount)}`).join(' · ')}
              {charge.receipt.tax ? ` · tax ${money(charge.receipt.tax)}` : ''}
              {charge.receipt.tip ? ` · tip ${money(charge.receipt.tip)}` : ''}
            </T>
          )}
          <T style={[s.caption, {marginTop: 8}]}>
            {charge.proposals.length} {charge.proposals.length === 1 ? 'proposal' : 'proposals'}
            {charge.settledAt ? ` · settled ${shortDate(charge.settledAt)}` : ''}
          </T>
          {charge.dispute && <T style={{color: C.danger, fontSize: 12, marginTop: 6}}>{charge.dispute.reason}</T>}
          {charge.status === 'pending' && <Button secondary title="Open split" onPress={() => router.push({pathname: '/split', params: {charge: charge.id}})} />}
          {charge.status === 'settled' && mine > 0 && !confirm && (
            <Pressable accessibilityRole="button" onPress={() => setConfirm(true)} style={{paddingVertical: 10}}>
              <T style={{fontSize: 12, color: C.muted}}>Report a chargeback (demo)</T>
            </Pressable>
          )}
          {confirm && (
            <View style={{marginTop: 8}}>
              <T style={s.small}>A chargeback freezes the whole group and escalates it to the dispute center as potential fraud.</T>
              <Button danger title="File chargeback" onPress={() => run(a => api.fileChargeback(a, charge.id), 'Chargeback filed. The group is frozen pending review.').then(ok => { if (ok) setConfirm(false); })} />
              <Button secondary title="Cancel" onPress={() => setConfirm(false)} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}
