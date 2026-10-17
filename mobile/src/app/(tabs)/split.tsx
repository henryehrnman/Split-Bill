import React, {useState} from 'react';
import {View, Pressable, TextInput} from 'react-native';
import {router} from 'expo-router';
import {Page, T, Button, Avatar, Icon, Pill, Segmented, Chip, Field, GroupPicker, EmptyState, Row, ago, s, C} from '../../lib/ui';
import {useStore} from '../../lib/store';
import {api} from '../../lib/api';
import {money, cents, toInput, allocate} from '../../lib/money';
import {computeSplit} from '../../lib/split';
import type {SplitInput} from '../../lib/split';
import {SPLIT_DEADLINE, DAY, currentProposal, itemBoardStatus, memberIds, pendingCharge, requiredApprovers, userById, waitingOn} from '../../lib/domain';
import type {Charge, Group, Receipt} from '../../lib/domain';

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
  return <ChargeSplit key={pending.id} group={group} charge={pending} />;
}

type Mode = 'items' | 'proposal';

function ChargeSplit({group, charge}: {group: Group; charge: Charge}) {
  const {db, now} = useStore();
  const [mode, setMode] = useState<Mode>(charge.receipt?.itemized === false ? 'proposal' : 'items');
  const [editing, setEditing] = useState(false);
  const daysLeft = Math.max(0, Math.ceil((charge.createdAt + SPLIT_DEADLINE - now) / DAY));
  const p = currentProposal(charge);

  const footer = mode === 'items' ? <ItemsFooter charge={charge} /> : editing ? null : <ProposalFooter charge={charge} onEdit={() => setEditing(true)} />;

  return (
    <Page title={charge.merchant} subtitle={`Paid by ${userById(db, charge.cardholderId).name} with the ${group.name} card · ${ago(now, charge.createdAt)}`} footer={footer ?? undefined}>
      <GroupPicker />
      <View style={{alignItems: 'center', paddingBottom: 18}}>
        <T style={s.money}>{money(charge.amount)}</T>
        <T style={[s.small, {marginTop: 4, color: daysLeft <= 2 ? C.danger : C.muted}]}>
          {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left to agree · the card stays locked until this is settled
        </T>
      </View>
      <Segmented options={[['items', 'By item'], ['proposal', 'Percent / amount']]} value={mode} onChange={setMode} />
      {mode === 'items' ? (
        charge.receipt ? <ClaimBoard key={charge.receipt.scannedAt} group={group} charge={charge} receipt={charge.receipt} /> : <ScanPrompt charge={charge} />
      ) : editing ? (
        <ProposalEditor key={p.id} group={group} charge={charge} onDone={() => setEditing(false)} />
      ) : (
        <ProposalView group={group} charge={charge} />
      )}
    </Page>
  );
}

function ScanPrompt({charge}: {charge: Charge}) {
  const {run} = useStore();
  return (
    <View style={[s.box, {alignItems: 'center'}]}>
      <Icon name="camera" size={22} color={C.blue} />
      <T style={{fontWeight: '700', marginTop: 10}}>Add the receipt</T>
      <T style={[s.small, {textAlign: 'center', marginTop: 4, marginBottom: 8}]}>Scan it to pull in line items. Everyone claims what they had, locks in their selection, and the split confirms once every item is claimed.</T>
      <Button secondary title="Scan receipt (demo)" onPress={() => run(a => api.scanReceipt(a, charge.id), 'Receipt scanned. Tap your name on the items you had.')} />
    </View>
  );
}

// ---------- Itemized: claim board ----------

function ItemsFooter({charge}: {charge: Charge}) {
  const {db, viewer, run} = useStore();
  const r = charge.receipt;
  if (!r) return null;
  const st = itemBoardStatus(charge);
  const locked = r.locked.includes(viewer.id);
  const others = st.unlocked.filter(id => id !== viewer.id).map(id => userById(db, id).name);
  const parts = [
    st.unclaimed.length ? `${st.unclaimed.length} unclaimed` : '',
    r.edits.length ? `${r.edits.length} ${r.edits.length === 1 ? 'edit' : 'edits'} pending` : '',
    others.length ? `waiting on ${others.join(', ')} to lock` : '',
  ].filter(Boolean);
  return (
    <>
      <T style={[s.small, {textAlign: 'center', marginBottom: 6}]}>{parts.length ? parts.join(' · ') : locked ? 'Everything is claimed' : 'Lock in your items to confirm'}</T>
      {locked ? (
        <Button secondary title="Unlock my items" onPress={() => run(a => api.setLocked(a, charge.id, false), 'Unlocked. You can change your items.')} />
      ) : (
        <Button
          title="Lock in my items"
          onPress={() => run(a => api.setLocked(a, charge.id, true), st.unlocked.length <= 1 && !st.unclaimed.length && !r.edits.length ? 'Split confirmed. Balances are updated and the card is ready again.' : 'Your items are locked in.')}
        />
      )}
    </>
  );
}

function ClaimBoard({group, charge, receipt: r}: {group: Group; charge: Charge; receipt: Receipt}) {
  const {db, viewer, run} = useStore();
  const [fixing, setFixing] = useState(false);
  const ids = memberIds(group);
  const myLock = r.locked.includes(viewer.id);
  const mine = r.items.filter(i => i.people.includes(viewer.id));
  const myItems = mine.reduce((a, i) => a + allocate(i.amount, i.people.map(() => 1))[i.people.indexOf(viewer.id)], 0);
  const forMe = r.edits.filter(e => e.targetId === viewer.id);
  const itemName = (id: string) => r.items.find(i => i.id === id)?.name ?? 'an item';

  if (fixing) return <ReceiptEditor charge={charge} receipt={r} onDone={() => setFixing(false)} />;

  return (
    <>
      {!r.itemized && <T style={[s.small, {marginBottom: 12, color: C.warn}]}>We couldn’t read line items, so this is one line. Fix the receipt or split by percent / amount instead.</T>}

      {forMe.map(e => (
        <View key={e.id} style={[s.box, {backgroundColor: C.softBlue, borderColor: C.softBlue}]}>
          <T style={{fontWeight: '700'}}>
            {userById(db, e.authorId).name} suggests {e.action === 'add' ? 'adding you to' : 'removing you from'} {itemName(e.itemId)}
          </T>
          <Row style={{marginTop: 10}}>
            <View style={{flex: 1}}><Button secondary title="Reject" onPress={() => run(a => api.respondItemEdit(a, charge.id, e.id, false), 'Edit rejected.')} /></View>
            <View style={{flex: 1}}><Button title="Accept" onPress={() => run(a => api.respondItemEdit(a, charge.id, e.id, true), 'Edit accepted.')} /></View>
          </Row>
        </View>
      ))}

      <Row style={{marginBottom: 4}}>
        <T style={{fontSize: 17, fontWeight: '700'}}>Items</T>
        <Pressable accessibilityRole="button" onPress={() => setFixing(true)} style={{padding: 6}}>
          <T style={{color: C.blue, fontWeight: '500', fontSize: 13}}>Fix receipt</T>
        </Pressable>
      </Row>
      <T style={[s.small, {marginBottom: 4}]}>Tap your name on what you had. Tap someone else’s name to suggest a change; they approve it. Shared items split evenly; tax and tip follow item totals.</T>

      {r.items.map(item => (
        <View key={item.id} style={{paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line}}>
          <Row>
            <T style={{fontWeight: '500', flex: 1}}>{item.name}</T>
            <T style={s.strong}>{money(item.amount)}</T>
          </Row>
          {!item.people.length && <T style={[s.caption, {color: C.warn}]}>Unclaimed</T>}
          <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8}}>
            {ids.map(id => {
              const isMe = id === viewer.id;
              const pendingEdit = r.edits.find(e => e.itemId === item.id && e.targetId === id);
              const name = isMe ? 'You' : userById(db, id).name;
              return (
                <Chip
                  key={id}
                  label={`${name}${r.locked.includes(id) ? ' · locked' : ''}${pendingEdit ? ' · suggested' : ''}`}
                  selected={item.people.includes(id)}
                  onPress={() =>
                    isMe
                      ? run(a => api.toggleClaim(a, charge.id, item.id))
                      : run(a => api.suggestItemEdit(a, charge.id, item.id, id), `Suggested ${item.people.includes(id) ? 'removing' : 'adding'} ${name} ${item.people.includes(id) ? 'from' : 'to'} ${item.name}. They need to approve it.`)
                  }
                />
              );
            })}
          </View>
        </View>
      ))}
      <Row style={{paddingTop: 10}}>
        <T style={s.small}>Tax {money(r.tax)} · Tip {money(r.tip)}</T>
        <T style={[s.small, {fontWeight: '700'}]}>{money(charge.amount)}</T>
      </Row>

      <View style={[s.box, {marginTop: 18, backgroundColor: C.bg, borderColor: C.bg}]}>
        <Row>
          <T style={{fontWeight: '700'}}>Your items</T>
          <T style={s.strong}>{money(myItems)}</T>
        </Row>
        <T style={[s.caption, {marginTop: 2}]}>{mine.length} {mine.length === 1 ? 'item' : 'items'} before tax and tip{myLock ? ' · locked in' : ''}</T>
      </View>

      {r.edits.filter(e => e.targetId !== viewer.id).length > 0 && (
        <>
          <T style={s.section}>Pending edits</T>
          {r.edits
            .filter(e => e.targetId !== viewer.id)
            .map(e => (
              <T key={e.id} style={[s.small, {paddingVertical: 4}]}>
                {userById(db, e.authorId).name} → {e.action === 'add' ? 'add' : 'remove'} {userById(db, e.targetId).name} {e.action === 'add' ? 'to' : 'from'} {itemName(e.itemId)} · waiting on {userById(db, e.targetId).name}
              </T>
            ))}
        </>
      )}
    </>
  );
}

type ItemDraft = {id: string; name: string; amount: string};

function ReceiptEditor({charge, receipt: r, onDone}: {charge: Charge; receipt: Receipt; onDone: () => void}) {
  const {run} = useStore();
  const [items, setItems] = useState<ItemDraft[]>(() => r.items.map(i => ({id: i.id, name: i.name, amount: toInput(i.amount)})));
  const [tax, setTax] = useState(toInput(r.tax));
  const [tip, setTip] = useState(toInput(r.tip));
  const parsed = items.map(i => ({id: i.id, name: i.name, amount: cents(i.amount) ?? -1}));
  const total = parsed.reduce((a, i) => a + Math.max(0, i.amount), 0) + (cents(tax) ?? 0) + (cents(tip) ?? 0);
  const setItem = (index: number, patch: Partial<ItemDraft>) => setItems(items.map((x, i) => (i === index ? {...x, ...patch} : x)));

  return (
    <>
      <T style={{fontSize: 17, fontWeight: '700'}}>Fix receipt</T>
      <T style={[s.small, {marginBottom: 6}]}>Items, tax and tip must add up to {money(charge.amount)}. Saving releases everyone’s locks so they can re-check.</T>
      {items.map((item, index) => (
        <Row key={item.id} style={{alignItems: 'flex-end'}}>
          <View style={{flex: 2}}><Field text label={`Item ${index + 1}`} value={item.name} onChange={name => setItem(index, {name})} /></View>
          <Field label="Amount ($)" value={item.amount} onChange={amount => setItem(index, {amount})} />
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.name || 'item'}`} onPress={() => setItems(items.filter((_, i) => i !== index))} style={{padding: 10, paddingBottom: 14}}>
            <Icon name="trash-2" size={16} color={C.muted} />
          </Pressable>
        </Row>
      ))}
      <Button secondary title="Add item" onPress={() => setItems([...items, {id: `${charge.id}-m${Date.now()}`, name: '', amount: ''}])} />
      <Row style={{alignItems: 'flex-end'}}>
        <Field label="Tax ($)" value={tax} onChange={setTax} />
        <Field label="Tip ($)" value={tip} onChange={setTip} />
      </Row>
      <T style={[s.small, {marginTop: 10, color: total === charge.amount ? C.success : C.danger}]}>Adds up to {money(total)} of {money(charge.amount)}</T>
      <Row style={{marginTop: 8}}>
        <View style={{flex: 1}}><Button secondary title="Cancel" onPress={onDone} /></View>
        <View style={{flex: 1.4}}>
          <Button
            title="Save receipt"
            onPress={async () => {
              const ok = await run(a => api.updateReceipt(a, charge.id, {items: parsed, tax: cents(tax) ?? -1, tip: cents(tip) ?? -1}), 'Receipt updated. Everyone needs to lock in again.');
              if (ok) onDone();
            }}
          />
        </View>
      </Row>
    </>
  );
}

// ---------- Percent / amount proposals ----------

function ProposalFooter({charge, onEdit}: {charge: Charge; onEdit: () => void}) {
  const {db, viewer, run} = useStore();
  const waiting = waitingOn(currentProposal(charge));
  return (
    <>
      <T style={[s.small, {textAlign: 'center', marginBottom: 6}]}>
        {waiting.length ? `Waiting on ${waiting.map(id => (id === viewer.id ? 'you' : userById(db, id).name)).join(', ')}` : 'Everyone has accepted'}
      </T>
      <Row>
        <View style={{flex: 1}}><Button secondary title="Propose changes" onPress={onEdit} /></View>
        {waiting.includes(viewer.id) && (
          <View style={{flex: 1}}>
            <Button title="Accept split" onPress={() => run(a => api.acceptSplit(a, charge.id), waiting.length === 1 ? 'Split settled. Balances are updated and the card is ready again.' : 'You accepted this split.')} />
          </View>
        )}
      </Row>
    </>
  );
}

const methodLabel = (m: SplitInput['method']) => ({equal: 'Equal', percent: 'Percent', amount: 'Amounts', items: 'By item'})[m];

function ProposalView({group, charge}: {group: Group; charge: Charge}) {
  const {db, viewer} = useStore();
  const p = currentProposal(charge);
  const author = p.authorId ? userById(db, p.authorId).name : null;
  return (
    <>
      <Row style={{marginBottom: 4}}>
        <T style={{fontSize: 17, fontWeight: '700'}}>{author ? `${author}’s proposal` : 'Default split'}</T>
        <Pill label={methodLabel(p.input.method)} tone="muted" />
      </Row>
      <T style={s.small}>{charge.proposals.length > 1 ? `Proposal ${charge.proposals.length} · ` : ''}Only people with a share need to accept.</T>
      {memberIds(group).map(id => {
        const accepted = p.acceptedBy.includes(id);
        const involved = requiredApprovers(p).includes(id);
        return (
          <View key={id} style={s.listRow}>
            <Avatar user={userById(db, id)} size={36} />
            <View style={{flex: 1}}>
              <T style={{fontWeight: '500'}}>{userById(db, id).name}{id === viewer.id ? ' (you)' : ''}</T>
              <T style={[s.caption, accepted && {color: C.success}]}>{!involved ? 'Not involved' : accepted ? 'Accepted' : 'Needs to accept'}</T>
            </View>
            <T style={s.strong}>{money(p.shares[id] ?? 0)}</T>
          </View>
        );
      })}
    </>
  );
}

type Method = 'equal' | 'percent' | 'amount';

function ProposalEditor({group, charge, onDone}: {group: Group; charge: Charge; onDone: () => void}) {
  const {db, run} = useStore();
  const ids = memberIds(group);
  const p = currentProposal(charge);
  const [method, setMethod] = useState<Method>(p.input.method === 'items' ? 'amount' : p.input.method);
  const [participants, setParticipants] = useState(() => (p.input.method === 'equal' ? [...p.input.participants] : ids.filter(id => (p.shares[id] ?? 0) > 0)));
  const [percents, setPercents] = useState<Record<string, string>>(() =>
    Object.fromEntries(ids.map(id => [id, p.input.method === 'percent' ? String(p.input.percents[id] ?? 0) : ((100 * (p.shares[id] ?? 0)) / charge.amount).toFixed(2)])),
  );
  const [amounts, setAmounts] = useState<Record<string, string>>(() => Object.fromEntries(ids.map(id => [id, toInput(p.shares[id] ?? 0)])));

  let input: SplitInput | null = null;
  let error = '';
  if (method === 'equal') input = {method: 'equal', participants};
  else if (method === 'percent') {
    const values = Object.fromEntries(ids.map(id => [id, percents[id]?.trim() ? Number(percents[id]) : 0]));
    if (Object.values(values).some(Number.isNaN)) error = 'Enter numbers for every percentage.';
    else input = {method: 'percent', percents: values};
  } else {
    const values = Object.fromEntries(ids.map(id => [id, amounts[id]?.trim() ? cents(amounts[id]) : 0]));
    if (Object.values(values).some(v => v === null)) error = 'Amounts can have at most two decimal places.';
    else input = {method: 'amount', amounts: values as Record<string, number>};
  }
  const preview = input ? computeSplit(ids, charge.amount, input) : null;
  error ||= preview?.error ?? '';

  return (
    <>
      <T style={{fontSize: 17, fontWeight: '700', marginBottom: 12}}>Propose a split</T>
      <Segmented options={[['equal', 'Equally'], ['percent', 'Percent'], ['amount', 'Amount']]} value={method} onChange={setMethod} />
      {method === 'equal' && (
        <>
          <T style={[s.small, {marginBottom: 10}]}>Who was part of this charge?</T>
          <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
            {ids.map(id => (
              <Chip key={id} label={userById(db, id).name} selected={participants.includes(id)} onPress={() => setParticipants(participants.includes(id) ? participants.filter(x => x !== id) : [...participants, id])} />
            ))}
          </View>
        </>
      )}
      <T style={[s.section, {marginTop: 22}]}>Preview</T>
      {ids.map(id => (
        <View key={id} style={[s.listRow, {paddingVertical: 12}]}>
          <Avatar user={userById(db, id)} size={32} />
          <T style={{fontWeight: '500', flex: 1}}>{userById(db, id).name}</T>
          {method !== 'equal' && (
            <TextInput
              accessibilityLabel={`${userById(db, id).name} ${method}`}
              keyboardType="decimal-pad"
              value={method === 'percent' ? percents[id] : amounts[id]}
              onChangeText={v => (method === 'percent' ? setPercents({...percents, [id]: v}) : setAmounts({...amounts, [id]: v}))}
              style={s.smallInput}
            />
          )}
          {method === 'percent' && <T style={s.small}>%</T>}
          <T style={[s.strong, {minWidth: 70, textAlign: 'right'}]}>{preview && !preview.error ? money(preview.shares[id]) : '—'}</T>
        </View>
      ))}
      {!!error && <T accessibilityRole="alert" style={{color: C.danger, fontSize: 12, marginTop: 10}}>{error}</T>}
      <Row style={{marginTop: 12}}>
        <View style={{flex: 1}}><Button secondary title="Cancel" onPress={onDone} /></View>
        <View style={{flex: 1.4}}>
          <Button
            title="Send proposal"
            disabled={!!error || !input}
            onPress={async () => {
              const ok = input && (await run(a => api.proposeSplit(a, charge.id, input!), 'Proposal sent. Everyone with a share needs to accept it.'));
              if (ok) onDone();
            }}
          />
        </View>
      </Row>
    </>
  );
}
