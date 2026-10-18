import React, {useState} from 'react';
import {View, Switch, Pressable} from 'react-native';
import {router} from 'expo-router';
import {Page, T, Button, CardVisual, Icon, Field, GroupPicker, EmptyState, Row, s, C} from '../../lib/ui';
import {useStore} from '../../lib/store';
import {api} from '../../lib/api';
import {money, cents} from '../../lib/money';
import {SAMPLE_PURCHASES} from '../../lib/fakeOcr';
import {cardFor, isActive, pendingCharge, purchaseBlocker, spendLimit, standing} from '../../lib/domain';
import type {Wallet} from '../../lib/domain';

export default function Card() {
  const {db, viewer, group, run} = useStore();
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const card = group ? cardFor(db, group.id, viewer.id) : null;

  if (!group || !card) {
    return (
      <Page title="Your card" subtitle="One card per person, all drawing from the group fund.">
        <GroupPicker />
        <EmptyState
          icon="credit-card"
          title={group ? 'Accept your invite first' : 'No group yet'}
          body={group ? 'Your card is issued once you accept the invite and deposit your share of the budget.' : 'Create or join a group to get a card.'}
          action={<Button title="Go home" onPress={() => router.push('/')} />}
        />
      </Page>
    );
  }

  const limit = spendLimit(db, group.id, viewer.id);
  const blocker = purchaseBlocker(db, group.id, viewer.id);
  const st = standing(group, viewer.id);
  const pending = pendingCharge(db, group.id);
  const blockerAction =
    !blocker ? null
    : pending && group.singleOpenCharge && blocker.includes(pending.merchant) ? {label: 'Open the split', onPress: () => router.push('/split')}
    : !card.wallet && blocker.startsWith('Add your card') ? {label: 'Add to Apple Wallet', onPress: () => { run(a => api.addToWallet(a, card.id, 'Apple Wallet'), 'Added to Apple Wallet (simulated).'); }}
    : null;
  const buy = (m: string, a: number) =>
    run(x => api.purchase(x, group.id, {merchant: m, amount: a}), `${money(a)} at ${m} approved. Choose who was part of it, or leave and the default split is sent to everyone.`).then(ok => {
      if (ok) router.push('/split');
    });

  return (
    <Page title="Your card" subtitle={`${group.name} · each member has their own card on the same fund`}>
      <GroupPicker />
      <CardVisual holder={viewer.name} groupName={group.name} last4={card.last4} frozen={card.frozen || !!group.frozen} />
      <Row style={{marginBottom: 4, alignItems: 'flex-end'}}>
        <View>
          <T style={s.caption}>Available to spend</T>
          <T style={{fontSize: 26, fontWeight: '500', fontVariant: ['tabular-nums'], letterSpacing: -0.6}}>{money(limit)}</T>
        </View>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6}}>
          <View style={{width: 6, height: 6, borderRadius: 3, backgroundColor: blocker ? '#ac742d' : C.success}} />
          <T style={{fontSize: 12, color: C.muted}}>{blocker ? 'Not ready to pay' : `Ready in ${card.wallet}`}</T>
        </View>
      </Row>
      <T style={[s.caption, {marginBottom: 8}]}>Virtual Visa · payments are simulated</T>
      {blocker && (
        <View style={[s.box, {backgroundColor: C.softWarn, borderColor: C.softWarn, flexDirection: 'row', gap: 10}]}>
          <Icon name="alert-circle" size={18} color={C.warn} />
          <View style={{flex: 1}}>
            <T style={{color: C.ink, fontSize: 14, lineHeight: 20}}>{blocker}</T>
            {blockerAction && (
              <Pressable accessibilityRole="button" onPress={blockerAction.onPress} style={{flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8}}>
                <T style={{color: C.blue, fontWeight: '700', fontSize: 14}}>{blockerAction.label}</T>
                <Icon name="arrow-right" size={14} color={C.blue} />
              </Pressable>
            )}
          </View>
        </View>
      )}
      {isActive(group) && !group.frozen && st === 'on-track' && (
        <T style={s.small}>
          You can spend up to everything in the group fund. Your share is settled after each purchase; if it takes you below $0, the difference is charged to your personal card.
        </T>
      )}
      {isActive(group) && !group.frozen && st === 'restricted' && (
        <T style={s.small}>
          You haven’t added your share for this period yet, so you can only spend up to your own balance until you do.
        </T>
      )}

      <T style={s.section}>Wallet</T>
      {(['Apple Wallet', 'Google Wallet'] as Wallet[]).map((wallet, i) => (
        <Pressable key={wallet} accessibilityRole="radio" accessibilityState={{checked: card.wallet === wallet}} onPress={() => run(a => api.addToWallet(a, card.id, wallet), `Added to ${wallet} (simulated).`)} style={[s.listRow, {minHeight: 70}]}>
          <View style={{width: 40, height: 40, backgroundColor: C.bg, borderRadius: 10, alignItems: 'center', justifyContent: 'center'}}>
            <Icon name={i ? 'smartphone' : 'credit-card'} size={19} />
          </View>
          <View style={{flex: 1}}>
            <T style={{fontWeight: '500'}}>{wallet}</T>
            <T style={s.caption}>{i ? 'Android' : 'iPhone'} · simulated setup</T>
          </View>
          <View style={{width: 20, height: 20, borderRadius: 10, borderWidth: card.wallet === wallet ? 6 : 1.5, borderColor: card.wallet === wallet ? C.blue : '#bdc4cf'}} />
        </Pressable>
      ))}
      <View style={[s.listRow, {paddingVertical: 16}]}>
        <Icon name="lock" size={18} color={C.muted} />
        <T style={{flex: 1, fontSize: 14}}>Freeze my card</T>
        <Switch accessibilityLabel="Freeze card" value={card.frozen} trackColor={{false: '#dfe3ea', true: C.blue}} onValueChange={v => { run(a => api.setCardFrozen(a, card.id, v)); }} />
      </View>

      <T style={s.section}>Make a purchase (demo)</T>
      <T style={[s.small, {marginBottom: 8}]}>Simulates tapping your card at a store. The charge comes out of the group fund and opens a split.</T>
      {SAMPLE_PURCHASES.map(p => (
        <Pressable key={p.merchant} accessibilityRole="button" disabled={!!blocker} onPress={() => buy(p.merchant, p.amount)} style={[s.listRow, blocker && {opacity: 0.45}]}>
          <View style={{flex: 1}}>
            <T style={{fontWeight: '500'}}>{p.merchant}</T>
            <T style={s.caption}>{p.category} · itemized receipt available</T>
          </View>
          <T style={s.strong}>{money(p.amount)}</T>
          <Icon name="chevron-right" size={16} color={C.muted} />
        </Pressable>
      ))}
      <Row style={{alignItems: 'flex-end', marginTop: 6}}>
        <View style={{flex: 1.4}}><Field text label="Merchant" value={merchant} onChange={setMerchant} placeholder="e.g. Target" /></View>
        <Field label="Amount ($)" value={amount} onChange={setAmount} placeholder="0.00" />
      </Row>
      <Button secondary title="Pay custom amount" disabled={!!blocker || !merchant.trim() || cents(amount) === null} onPress={() => buy(merchant.trim(), cents(amount) ?? 0)} />
    </Page>
  );
}
