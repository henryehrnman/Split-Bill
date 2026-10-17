import React, {useState} from 'react';
import {View, Pressable, TextInput} from 'react-native';
import {router} from 'expo-router';
import {Page, T, Button, Avatar, Icon, Pill, Segmented, Chip, Field, GroupPicker, EmptyState, Row, ago, s, C} from '../../lib/ui';
import {useStore} from '../../lib/store';
import {api} from '../../lib/api';
import {money, cents, toInput} from '../../lib/money';
import {computeSplit} from '../../lib/split';
import type {SplitInput, SplitMethod} from '../../lib/split';
import {SPLIT_DEADLINE, DAY, currentProposal, memberIds, pendingCharge, requiredApprovers, userById, waitingOn} from '../../lib/domain';
import type {Charge, Group} from '../../lib/domain';

export default function Split() {
  const {db, group} = useStore();
  const pending = group ? pendingCharge(db, group.id) : null;
  if (!group || !pending) {
    return (
      <Page title="Split" subtitle="Agree on who owes what after each purchase.">
        <GroupPicker />
        <EmptyState
          icon="check-circle"
          title="Nothing to split"
          body={group ? 'Every charge in this group is settled. The card is ready for the next purchase.' : 'Join or create a group to start splitting.'}
          action={<Button title={group ? 'Open your group card' : 'Go home'} onPress={() => router.push(group ? '/card' : '/')} />}
        />
      </Page>
    );
  }
  return <ChargeSplit key={`${currentProposal(pending).id}-${pending.receipt?.scannedAt ?? 0}`} group={group} charge={pending} />;
}

type ItemDraft = {id: string; name: string; amount: string; people: string[]};
type Draft = {method: SplitMethod; participants: string[]; percents: Record<string, string>; amounts: Record<string, string>; items: ItemDraft[]; tax: string; tip: string};

function draftFrom(group: Group, charge: Charge): Draft {
  const p = currentProposal(charge);
  const ids = memberIds(group);
  const input = p.input;
  const r = charge.receipt;
  const fromShares = Object.fromEntries(ids.map(id => [id, toInput(p.shares[id] ?? 0)]));
  return {
    method: input.method === 'items' || !r ? input.method : 'items',
    participants: input.method === 'equal' ? [...input.participants] : ids.filter(id => (p.shares[id] ?? 0) > 0),
    percents: input.method === 'percent' ? Object.fromEntries(ids.map(id => [id, String(input.percents[id] ?? 0)])) : Object.fromEntries(ids.map(id => [id, ((100 * (p.shares[id] ?? 0)) / charge.amount).toFixed(2)])),
    amounts: input.method === 'amount' ? Object.fromEntries(ids.map(id => [id, toInput(input.amounts[id] ?? 0)])) : fromShares,
    items: (input.method === 'items' ? input.items : r?.items ?? []).map(i => ({...i, amount: toInput(i.amount), people: [...i.people]})),
    tax: toInput(input.method === 'items' ? input.tax : r?.tax ?? 0),
    tip: toInput(input.method === 'items' ? input.tip : r?.tip ?? 0),
  };
}

function toSplitInput(d: Draft, ids: string[]): {input: SplitInput | null; error: string} {
  if (d.method === 'equal') return {input: {method: 'equal', participants: d.participants}, error: ''};
  if (d.method === 'percent') {
    const percents = Object.fromEntries(ids.map(id => [id, d.percents[id]?.trim() ? Number(d.percents[id]) : 0]));
    return Object.values(percents).some(Number.isNaN) ? {input: null, error: 'Enter numbers for every percentage.'} : {input: {method: 'percent', percents}, error: ''};
  }
  if (d.method === 'amount') {
    const amounts = Object.fromEntries(ids.map(id => [id, d.amounts[id]?.trim() ? cents(d.amounts[id]) : 0]));
    return Object.values(amounts).some(v => v === null) ? {input: null, error: 'Amounts can have at most two decimal places.'} : {input: {method: 'amount', amounts: amounts as Record<string, number>}, error: ''};
  }
  const tax = cents(d.tax), tip = cents(d.tip);
  const items = d.items.map(i => ({...i, amount: cents(i.amount) ?? -1}));
  if (tax === null || tip === null || items.some(i => i.amount < 0)) return {input: null, error: 'Item, tax and tip amounts need valid dollar values.'};
  return {input: {method: 'items', items, tax, tip}, error: ''};
}

function ChargeSplit({group, charge}: {group: Group; charge: Charge}) {
  const {db, viewer, now, run} = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => draftFrom(group, charge));
  const ids = memberIds(group);
  const p = currentProposal(charge);
  const waiting = waitingOn(p);
  const mustAccept = waiting.includes(viewer.id);
  const daysLeft = Math.max(0, Math.ceil((charge.createdAt + SPLIT_DEADLINE - now) / DAY));
  const parsed = toSplitInput(draft, ids);
  const preview = parsed.input ? computeSplit(ids, charge.amount, parsed.input) : null;
  const error = parsed.error || preview?.error || '';
  const edit = (patch: Partial<Draft>) => setDraft({...draft, ...patch});
  const setItem = (index: number, patch: Partial<ItemDraft>) => edit({items: draft.items.map((x, i) => (i === index ? {...x, ...patch} : x))});
  const author = p.authorId ? userById(db, p.authorId).name : null;

  const footer = editing ? (
    <>
      {!!error && <T accessibilityRole="alert" style={{color: C.danger, fontSize: 12, marginBottom: 6}}>{error}</T>}
      <Row>
        <View style={{flex: 1}}><Button secondary title="Cancel" onPress={() => { setEditing(false); setDraft(draftFrom(group, charge)); }} /></View>
        <View style={{flex: 1.4}}><Button title="Send proposal" disabled={!!error} onPress={() => parsed.input && run(a => api.proposeSplit(a, charge.id, parsed.input!), 'Proposal sent. Everyone with a share needs to accept it.')} /></View>
      </Row>
    </>
  ) : (
    <>
      <T style={[s.small, {textAlign: 'center', marginBottom: 6}]}>
        {waiting.length ? `Waiting on ${waiting.map(id => (id === viewer.id ? 'you' : userById(db, id).name)).join(', ')}` : 'Everyone has accepted'}
      </T>
      <Row>
        <View style={{flex: 1}}><Button secondary title="Propose changes" onPress={() => setEditing(true)} /></View>
        {mustAccept && <View style={{flex: 1}}><Button title="Accept split" onPress={() => run(a => api.acceptSplit(a, charge.id), waiting.length === 1 ? 'Split settled. Balances are updated and the card is ready again.' : 'You accepted this split.')} /></View>}
      </Row>
    </>
  );

  return (
    <Page title={charge.merchant} subtitle={`Paid by ${userById(db, charge.cardholderId).name} with the ${group.name} card · ${ago(now, charge.createdAt)}`} footer={footer}>
      <GroupPicker />
      <View style={{alignItems: 'center', paddingBottom: 18}}>
        <T style={s.money}>{money(charge.amount)}</T>
        <T style={[s.small, {marginTop: 4, color: daysLeft <= 2 ? C.danger : C.muted}]}>
          {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left to agree · the card stays locked until this is settled
        </T>
      </View>

      <Receipt charge={charge} />

      {!editing ? (
        <>
          <Row style={{marginTop: 24, marginBottom: 4}}>
            <T style={{fontSize: 17, fontWeight: '700'}}>{author ? `${author}’s proposal` : 'Default split'}</T>
            <Pill label={methodLabel(p.input.method)} tone="muted" />
          </Row>
          <T style={s.small}>{charge.proposals.length > 1 ? `Proposal ${charge.proposals.length} · ` : ''}Only people with a share need to accept.</T>
          {ids.map(id => {
            const share = p.shares[id] ?? 0;
            const accepted = p.acceptedBy.includes(id);
            const involved = requiredApprovers(p).includes(id);
            return (
              <View key={id} style={s.listRow}>
                <Avatar user={userById(db, id)} size={36} />
                <View style={{flex: 1}}>
                  <T style={{fontWeight: '500'}}>{userById(db, id).name}{id === viewer.id ? ' (you)' : ''}</T>
                  <T style={[s.caption, accepted && {color: C.success}]}>{!involved ? 'Not involved' : accepted ? 'Accepted' : 'Needs to accept'}</T>
                </View>
                <T style={s.strong}>{money(share)}</T>
              </View>
            );
          })}
        </>
      ) : (
        <View style={{marginTop: 24}}>
          <T style={{fontSize: 17, fontWeight: '700', marginBottom: 12}}>Propose a split</T>
          <Segmented
            options={[['equal', 'Equally'], ['percent', 'Percent'], ['amount', 'Amount'], ['items', 'Items']]}
            value={draft.method}
            onChange={method => edit({method})}
          />
          {draft.method === 'equal' && (
            <>
              <T style={[s.small, {marginBottom: 10}]}>Who was part of this charge?</T>
              <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
                {ids.map(id => (
                  <Chip key={id} label={userById(db, id).name} selected={draft.participants.includes(id)} onPress={() => edit({participants: draft.participants.includes(id) ? draft.participants.filter(x => x !== id) : [...draft.participants, id]})} />
                ))}
              </View>
            </>
          )}
          {draft.method === 'items' && !charge.receipt && <T style={s.small}>Scan the receipt above to split by item.</T>}
          {draft.method === 'items' && charge.receipt && (
            <>
              <T style={[s.small, {marginBottom: 6}]}>Tap names to claim items. Shared items are split evenly; tax and tip follow each person’s item total. Fix anything the scan got wrong.</T>
              {draft.items.map((item, index) => (
                <View key={item.id} style={{paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line}}>
                  <Row style={{alignItems: 'flex-end'}}>
                    <View style={{flex: 2}}><Field text label={`Item ${index + 1}`} value={item.name} onChange={name => setItem(index, {name})} /></View>
                    <Field label="Amount ($)" value={item.amount} onChange={amount => setItem(index, {amount})} />
                  </Row>
                  <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, alignItems: 'center'}}>
                    {ids.map(id => (
                      <Chip key={id} label={userById(db, id).name} selected={item.people.includes(id)} onPress={() => setItem(index, {people: item.people.includes(id) ? item.people.filter(x => x !== id) : [...item.people, id]})} />
                    ))}
                    <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.name || 'item'}`} onPress={() => edit({items: draft.items.filter((_, i) => i !== index)})} style={{padding: 10}}>
                      <Icon name="trash-2" size={16} color={C.muted} />
                    </Pressable>
                  </View>
                </View>
              ))}
              <Button secondary title="Add item" onPress={() => edit({items: [...draft.items, {id: `${charge.id}-m${Date.now()}`, name: '', amount: '', people: []}]})} />
              <Row style={{alignItems: 'flex-end'}}>
                <Field label="Tax ($)" value={draft.tax} onChange={tax => edit({tax})} />
                <Field label="Tip ($)" value={draft.tip} onChange={tip => edit({tip})} />
              </Row>
            </>
          )}

          <T style={[s.section, {marginTop: 22}]}>Preview</T>
          {ids.map(id => (
            <View key={id} style={[s.listRow, {paddingVertical: 12}]}>
              <Avatar user={userById(db, id)} size={32} />
              <View style={{flex: 1}}>
                <T style={{fontWeight: '500'}}>{userById(db, id).name}</T>
                {preview?.breakdown && !preview.error && (
                  <T style={s.caption}>{money(preview.breakdown[id].items)} items + {money(preview.breakdown[id].tax)} tax + {money(preview.breakdown[id].tip)} tip</T>
                )}
              </View>
              {(draft.method === 'percent' || draft.method === 'amount') && (
                <TextInput
                  accessibilityLabel={`${userById(db, id).name} ${draft.method}`}
                  keyboardType="decimal-pad"
                  value={draft.method === 'percent' ? draft.percents[id] : draft.amounts[id]}
                  onChangeText={v => edit(draft.method === 'percent' ? {percents: {...draft.percents, [id]: v}} : {amounts: {...draft.amounts, [id]: v}})}
                  style={s.smallInput}
                />
              )}
              {draft.method === 'percent' && <T style={s.small}>%</T>}
              <T style={[s.strong, {minWidth: 70, textAlign: 'right'}]}>{preview && !preview.error ? money(preview.shares[id]) : '—'}</T>
            </View>
          ))}
        </View>
      )}
    </Page>
  );
}

const methodLabel = (m: SplitMethod) => ({equal: 'Equal', percent: 'Percent', amount: 'Amounts', items: 'By item'})[m];

function Receipt({charge}: {charge: Charge}) {
  const {run} = useStore();
  const r = charge.receipt;
  if (!r) {
    return (
      <View style={[s.box, {alignItems: 'center'}]}>
        <Icon name="camera" size={22} color={C.blue} />
        <T style={{fontWeight: '700', marginTop: 10}}>Add the receipt</T>
        <T style={[s.small, {textAlign: 'center', marginTop: 4, marginBottom: 8}]}>Scan it to pull in line items so everyone can claim what they had.</T>
        <Button secondary title="Scan receipt (demo)" onPress={() => run(a => api.scanReceipt(a, charge.id), 'Receipt scanned. Choose “Propose changes” → Items to claim what you had.')} />
      </View>
    );
  }
  return (
    <View style={[s.box, {backgroundColor: C.bg, borderColor: C.bg}]}>
      <Row style={{marginBottom: 8}}>
        <T style={{fontWeight: '700'}}>Receipt</T>
        <Pill label={r.itemized ? 'Scanned' : 'Not itemized'} tone={r.itemized ? 'success' : 'warn'} />
      </Row>
      {r.items.map(i => (
        <Row key={i.id} style={{paddingVertical: 3}}>
          <T style={s.small}>{i.name}</T>
          <T style={[s.small, {fontVariant: ['tabular-nums']}]}>{money(i.amount)}</T>
        </Row>
      ))}
      {(r.tax > 0 || r.tip > 0) && (
        <Row style={{paddingTop: 6, marginTop: 4, borderTopWidth: 1, borderColor: C.line}}>
          <T style={s.small}>Tax {money(r.tax)} · Tip {money(r.tip)}</T>
          <T style={[s.small, {fontWeight: '700'}]}>{money(charge.amount)}</T>
        </Row>
      )}
      {!r.itemized && <T style={[s.caption, {marginTop: 6}]}>We couldn’t read line items. Edit them by hand in the Items split.</T>}
    </View>
  );
}
