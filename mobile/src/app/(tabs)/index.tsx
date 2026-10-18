import React, {useState} from 'react';
import {View, Pressable, Switch, TextInput} from 'react-native';
import {router} from 'expo-router';
import {Page, T, Button, Avatar, Icon, Pill, Segmented, Field, GroupPicker, EmptyState, Row, StandingPill, ago, periodLabel, s, C} from '../../lib/ui';
import {useStore} from '../../lib/store';
import {api} from '../../lib/api';
import {money, cents, toInput} from '../../lib/money';
import {DAY, availableFunds, currentProposal, isActive, isDraft, itemBoardStatus, memberOf, nextPeriodAt, notificationsFor, openBudgetProposal, openCharges, periodShares, shares, standing, userById, waitingOn} from '../../lib/domain';
import type {Charge, Db, Group} from '../../lib/domain';

export default function Home() {
  const {viewer, group} = useStore();
  const invited = group ? memberOf(group, viewer.id).status === 'invited' : false;
  return (
    <Page title={`Hey, ${viewer.name}`} subtitle="A little less settling up." footer={group ? invited ? <InviteFooter group={group} /> : <HomeFooter group={group} /> : undefined}>
      <GroupPicker allowNew />
      {!group ? (
        <EmptyState icon="users" title="No groups yet" body="Create a group, set a budget for each period, and invite people. Everyone deposits an equal share and gets their own card on the group fund." action={<Button title="Create a group" onPress={() => router.push('/new-group')} />} />
      ) : invited ? (
        <Invite group={group} />
      ) : isActive(group) ? (
        <ActiveGroup group={group} />
      ) : (
        <FormingGroup group={group} />
      )}
    </Page>
  );
}

function HomeFooter({group}: {group: Group}) {
  const {db} = useStore();
  const pending = openCharges(db, group.id).length;
  return <Button title={pending ? `Review pending ${pending === 1 ? 'split' : 'splits'}` : 'Open your group card'} onPress={() => router.push(pending ? '/split' : '/card')} />;
}

function MemberRows({group}: {group: Group}) {
  const {db, viewer} = useStore();
  const owed = periodShares(group);
  const joining = shares(group);
  return (
    <>
      {group.members.map(m => {
        const user = userById(db, m.userId);
        return (
          <View key={m.userId} style={s.listRow}>
            <Avatar user={user} size={36} />
            <View style={{flex: 1}}>
              <T style={{fontWeight: '500'}}>{user.name}{m.userId === viewer.id ? ' (you)' : ''}</T>
              <T style={s.caption}>
                {m.status === 'invited' ? `Share ${money(joining[m.userId])} per period` : `Balance ${money(m.balance)} of ${money(owed[m.userId])} this period${m.autoDeposit ? ' · auto-refill' : ''}`}
              </T>
            </View>
            <StandingPill standing={standing(group, m.userId)} />
          </View>
        );
      })}
    </>
  );
}

function Invite({group}: {group: Group}) {
  const {db, viewer} = useStore();
  const share = shares(group)[viewer.id];
  return (
    <>
      <View style={s.box}>
        <Pill label="Invitation" tone="blue" />
        <T style={{fontSize: 20, fontWeight: '700', marginTop: 16}}>{group.name}</T>
        <T style={[s.small, {marginTop: 4}]}>{userById(db, group.createdBy).name} invited you to join</T>
        <T style={[s.money, {marginTop: 14}]}>{money(group.budget)}</T>
        <T style={s.small}>Group budget {periodLabel(group.periodDays)}</T>
        <View style={s.divider} />
        <Row><T style={s.small}>Your deposit to join</T><T style={s.strong}>{money(share)}</T></Row>
        <T style={[s.caption, {marginTop: 8}]}>
          At the start of each period you’re topped back up to {money(share)} (automatically, unless you turn auto-refill off). You get your own card on the group fund. Splits need agreement from everyone involved.
        </T>
      </View>
      <T style={s.section}>Members</T>
      <MemberRows group={group} />
    </>
  );
}

function InviteFooter({group}: {group: Group}) {
  const {viewer, run, busy} = useStore();
  const share = shares(group)[viewer.id];
  return (
    <>
      <Button title={`Join · deposit ${money(share)}`} onPress={() => run(a => api.respondInvite(a, group.id, true, share), `You joined ${group.name}. Add your card to a wallet to start paying.`)} />
      <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => run(a => api.respondInvite(a, group.id, false), `You declined ${group.name}.`)} style={{alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16, marginTop: 2}}>
        <T style={{color: C.muted, fontWeight: '500', fontSize: 14}}>Decline invitation</T>
      </Pressable>
    </>
  );
}

function FormingGroup({group}: {group: Group}) {
  const pendingInvites = group.members.filter(m => m.status === 'invited').length;
  return (
    <>
      <View style={s.box}>
        <Pill label="Waiting for invites" tone="warn" />
        <T style={{fontSize: 20, fontWeight: '700', marginTop: 16}}>{group.name}</T>
        <T style={[s.money, {marginTop: 14}]}>{money(group.budget)}</T>
        <T style={s.small}>Budget {periodLabel(group.periodDays)} · {pendingInvites} {pendingInvites === 1 ? 'invite' : 'invites'} pending</T>
      </View>
      <T style={s.section}>Members</T>
      <MemberRows group={group} />
      <T style={[s.caption, {marginTop: 16}]}>Cards can be used once everyone invited has accepted or declined. Deposits are simulated.</T>
    </>
  );
}

function pendingLine(db: Db, c: Charge, viewerId: string) {
  if (isDraft(c)) return c.cardholderId === viewerId ? 'send the first proposal' : `waiting on ${userById(db, c.cardholderId).name} to send a split`;
  const r = c.receipt;
  if (r) {
    const st = itemBoardStatus(c);
    if (r.edits.some(e => e.targetId === viewerId)) return 'an item edit needs your answer';
    if (st.unclaimed.length) return `${st.unclaimed.length} ${st.unclaimed.length === 1 ? 'item' : 'items'} unclaimed`;
    if (st.unlocked.includes(viewerId)) return 'lock in your items';
  }
  const waiting = waitingOn(currentProposal(c));
  if (waiting.includes(viewerId)) return 'needs your OK';
  const names = waiting.map(id => userById(db, id).name);
  return `waiting on ${names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`}`;
}

function ActiveGroup({group}: {group: Group}) {
  const {db, viewer, now, run} = useStore();
  const currentBudget = group.periodBudget ?? group.budget;
  const open = openCharges(db, group.id);
  const proposal = openBudgetProposal(db, group.id);
  const daysLeft = Math.max(0, Math.ceil((nextPeriodAt(group) - now) / DAY));
  const status = group.frozen
    ? (['Frozen', 'danger'] as const)
    : open.length
      ? ([open.length === 1 ? 'Split pending' : `${open.length} splits pending`, 'warn'] as const)
      : (['Card ready', 'success'] as const);

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
        <T style={[s.small, {marginTop: 4}]}>Current budget {money(currentBudget)} {periodLabel(group.periodDays)} · resets in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}</T>
        {group.budget !== currentBudget && <T style={s.caption}>Approved for next period: {money(group.budget)}</T>}
        <T style={[s.money, {marginTop: 14}]}>{money(Math.max(0, availableFunds(db, group)))}</T>
        <T style={s.small}>Available in the group fund</T>
        {open.map(pending => (
          <Pressable key={pending.id} accessibilityRole="button" onPress={() => router.push({pathname: '/split', params: {charge: pending.id}})} style={{marginTop: 16, backgroundColor: C.softWarn, borderRadius: 12, padding: 14}}>
            <Row>
              <View style={{flex: 1}}>
                <T style={s.caption}>PENDING SPLIT</T>
                <T style={{fontWeight: '700', marginTop: 2}}>{pending.merchant} · {money(pending.amount)}</T>
                <T style={[s.small, {marginTop: 2}]}>Paid by {userById(db, pending.cardholderId).name} {ago(now, pending.createdAt)} · {pendingLine(db, pending, viewer.id)}</T>
              </View>
              <Icon name="chevron-right" color={C.muted} size={18} />
            </Row>
          </Pressable>
        ))}
        {group.frozen && <T style={{color: C.danger, fontSize: 13, marginTop: 12}}>Frozen: {group.frozen.reason} Escalated to the dispute center.</T>}
      </View>

      {proposal && (
        <View style={s.box}>
          <T style={{fontWeight: '700'}}>
            {userById(db, proposal.authorId).name} proposed {proposal.amount > group.budget ? 'raising' : 'lowering'} the budget to {money(proposal.amount)} {periodLabel(group.periodDays)}
          </T>
          <T style={[s.small, {marginTop: 4}]}>
            {proposal.amount > group.budget
              ? `Your share next period would be ${money(shares(group, proposal.amount)[viewer.id])}. The difference is collected at the start of that period.`
              : `Your share next period would be ${money(shares(group, proposal.amount)[viewer.id])}. Balances stay as they are; any surplus is kept.`}{' '}
            Accepted by {proposal.acceptedBy.length} of {group.members.length}.
          </T>
          {!proposal.acceptedBy.includes(viewer.id) && (
            <Row style={{marginTop: 10}}>
              <View style={{flex: 1}}><Button secondary title="Decline" onPress={() => run(a => api.respondBudget(a, proposal.id, false), 'Proposal declined.')} /></View>
              <View style={{flex: 1}}><Button title="Accept" onPress={() => run(a => api.respondBudget(a, proposal.id, true), 'You accepted the new budget.')} /></View>
            </Row>
          )}
        </View>
      )}

      <Notifications group={group} />

      <T style={s.section}>Members</T>
      <MemberRows group={group} />
      <T style={[s.caption, {marginTop: 10}]}>Anyone who hasn’t added their share this period can only spend up to their own balance until they do.</T>

      <GroupSettings key={group.id} group={group} />
    </>
  );
}

// Demo stand-in for push notifications.
function Notifications({group}: {group: Group}) {
  const {db, viewer, now} = useStore();
  const items = notificationsFor(db, viewer.id, group.id).slice(0, 4);
  if (!items.length) return null;
  return (
    <>
      <T style={s.section}>Notifications</T>
      {items.map(n => {
        const open = openCharges(db, group.id).some(c => c.id === n.chargeId);
        return (
          <Pressable key={n.id} accessibilityRole="button" disabled={!open} onPress={() => router.push({pathname: '/split', params: {charge: n.chargeId}})} style={s.listRow}>
            <Icon name="bell" size={16} color={open ? C.blue : C.muted} />
            <View style={{flex: 1}}>
              <T style={{fontSize: 14, color: open ? C.ink : C.muted}}>{n.text}</T>
              <T style={s.caption}>{ago(now, n.at)}</T>
            </View>
            {open && <Icon name="chevron-right" color={C.muted} size={18} />}
          </Pressable>
        );
      })}
    </>
  );
}

function GroupSettings({group}: {group: Group}) {
  const {db, run} = useStore();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState(group.defaultSplit.method);
  const [percents, setPercents] = useState<Record<string, string>>(() =>
    Object.fromEntries(group.members.map(m => [m.userId, group.defaultSplit.method === 'percent' ? String(group.defaultSplit.percents[m.userId] ?? 0) : (100 / group.members.length).toFixed(2)])),
  );
  const [budget, setBudget] = useState(toInput(group.budget));
  const total = Object.values(percents).reduce((a, b) => a + (Number(b) || 0), 0);
  const changed = method !== group.defaultSplit.method || method === 'percent';

  const summary = [
    group.defaultSplit.method === 'equal' ? 'Equal split' : 'Custom percentages',
    group.singleOpenCharge ? 'one purchase at a time' : 'several open splits',
    `${money(group.periodBudget ?? group.budget)} budget`,
  ].join(' · ');

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityState={{expanded: open}} onPress={() => setOpen(!open)} style={[s.listRow, {marginTop: 22, borderTopWidth: 1, borderTopColor: C.line}]}>
        <View style={{width: 36, height: 36, borderRadius: 10, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center'}}>
          <Icon name="sliders" size={17} />
        </View>
        <View style={{flex: 1}}>
          <T style={{fontWeight: '700'}}>Group settings</T>
          <T style={s.caption}>{summary}</T>
        </View>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} />
      </Pressable>
      {open && <>
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

      <T style={s.section}>Purchases</T>
      <Row>
        <View style={{flex: 1}}>
          <T style={{fontSize: 14}}>One purchase at a time</T>
          <T style={s.caption}>
            {group.singleOpenCharge
              ? 'Each split has to be agreed before the card can be used again.'
              : 'Several splits can be open at once. Open charges are held from the fund, and from the balance of anyone who hasn’t added their share.'}
          </T>
        </View>
        <Switch
          accessibilityLabel={`One purchase at a time for ${group.name}`}
          value={group.singleOpenCharge}
          trackColor={{false: '#dfe3ea', true: C.blue}}
          onValueChange={v => {
            run(a => api.setSingleOpenCharge(a, group.id, v), v ? 'The card now waits for each split to be agreed.' : 'Several splits can now be open at once.');
          }}
        />
      </Row>

      <T style={s.section}>Budget</T>
      <T style={[s.small, {marginBottom: 4}]}>Changing it needs everyone’s OK. A higher budget raises each person’s share from the next period; a lower one keeps any surplus.</T>
      <Row style={{alignItems: 'flex-end'}}>
        <Field label="New budget ($)" value={budget} onChange={setBudget} />
        <View style={{flex: 1}}>
          <Button secondary title="Propose" disabled={cents(budget) === null} onPress={() => run(a => api.proposeBudget(a, group.id, cents(budget) ?? 0), 'Proposal sent to the group.')} />
        </View>
      </Row>
      </>}
    </>
  );
}
