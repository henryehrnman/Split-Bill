import {
  availableFunds, cardFor, chargeEditKey, currentProposal, groupsFor, isActive, isDraft, memberIds,
  nextPeriodAt, openBudgetProposal, periodShares, purchaseBlocker, receiptApprovalKey,
  receiptListKey, shares, spendLimit, standing,
} from '../lib/domain.ts';
import type {Card, Charge, Db, Group, Member, User} from '../lib/domain.ts';
import {computeSplit, receiptItemAllocations} from '../lib/split.ts';
import type {SplitInput} from '../lib/split.ts';

// The phone renderer uses dollars. The domain and every API request remain in cents.
const dollars = (value: number) => value / 100;
const tones = ['', 'maya', 'jordan', 'sam'];
const groupTones = ['', 'warm', 'purple', 'green'];
const colors = ['#2459e8', '#b57439', '#8a70bd', '#53846b'];
const hash = (text: string) => [...text].reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 0);
const dateText = (at: number) => new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric'}).format(at);
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export type PhonePerson = {
  id: string; name: string; initials: string; tone: string; handle: string;
  status?: Member['status']; balance?: number; role?: 'creator' | 'member';
  standing?: ReturnType<typeof standing>; contribution?: number; initialContributionLimit?: number;
};
export type PhoneItem = {id: string; name: string; amount: number; assignees: string[]; tax?: number; tip?: number; total?: number};
export type PhoneProposal = {
  method: 'equal' | 'custom' | 'item'; allocation: number[]; items: PhoneItem[]; tax: number; tip: number;
  receipt: null | {kind: 'saved'; name: string; image?: string};
  proposalId: string; acceptedBy: string[]; participants: string[]; exclusive: boolean; sourceInput: SplitInput;
  receiptDraft: boolean; receiptDraftDetails: null | {items: PhoneItem[]; tax: number; tip: number};
  receiptKey: string | null; receiptListKey: string | null; editKey: string; unclaimed: number;
};
export type PhoneCharge = {
  id: string; name: string; merchant: string; group: string; icon: string;
  amount: number; share: number; total: number; groupAmount: number; memberShares: Record<string, number>;
  allocation: number[]; people: PhonePerson[]; canonicalMemberIds: string[]; members: number; status: Charge['status'];
  createdAt: number; year: number; month: number; day: number; monthKey: string; date: string;
  cardholderId: string; payerName: string; settledAt?: number; settled: boolean; draft: boolean;
  initialMethod: PhoneProposal['method']; proposalId: string; receiptKey: string | null; receiptListKey: string | null; editKey: string;
  approvedBy: string[]; initialApprovals: number; canReview: boolean; note: Charge['note']; preferredSplit?: 'items';
};
export type PhoneGroup = {
  id: string; name: string; icon: string; tone: string; color: string; photo?: string;
  members: number; joinedMembers: number; people: PhonePerson[]; canonicalMemberIds: string[]; balance: number; power: number;
  total: number; groupTotal: number; budget: number; period: string; periodDays: number;
  periodStart: number; nextPeriodAt: number; contribution: number; initialContributionLimit?: number;
  forming: boolean; frozenReason: string | null; createdBy: string;
  card: Card | null; cardId: string | null; last4: string | null; wallet: Card['wallet'];
  pendingCount: number; spendLimit: number; purchaseBlocker: string | null; withdrawalBlocked: boolean;
  defaultSplit: 'equal' | 'custom' | 'item'; defaultSplitInput: Group['defaultSplit'];
  proposedBudget?: number; budgetProposal: null | {id: string; amount: number; authorId: string; acceptedBy: string[]};
};
export type PhoneInvite = {
  id: string; name: string; from: string; icon: string; tone: string; photo?: string;
  budget: number; share: number; members: number; period: string; people: PhonePerson[];
  expectedContribution: number; initialContributionLimit: number;
};
export type PhoneState = {
  displayName: string; fullName: string; handle: string; notice: boolean;
  approved: Record<string, boolean>; approvals: Record<string, Record<string, boolean>>;
  proposals: Record<string, number[]>; publishedMethods: Record<string, PhoneProposal['method']>;
  proposalDetails: Record<string, PhoneProposal>; itemConfirmations: Record<string, Record<string, boolean>>;
  frozen: Record<string, boolean>; autofill: Record<string, boolean>;
};
export type PhoneSnapshot = {
  viewer: User; people: PhonePerson[]; demoUsers: PhonePerson[]; groups: PhoneGroup[]; invites: PhoneInvite[];
  pending: PhoneCharge[]; charges: PhoneCharge[];
  notifications: {id: string; group: string; chargeId: string; text: string; at: number; date: string}[];
  calendar: {now: number; year: number; month: number; day: number; monthKey: string;
    monthName: string; monthLabel: string; startLabel: string; endLabel: string; greeting: string};
  state: PhoneState;
};

export function phonePerson(user: User): PhonePerson {
  return {id: user.id, name: user.name, initials: user.initials, tone: tones[Math.abs(user.tone) % tones.length], handle: user.handle};
}

export function projectPhoneSnapshot(db: Db, viewerId: string, now: number): PhoneSnapshot {
  const viewer = db.users.find(user => user.id === viewerId);
  if (!viewer) throw new Error('Your account is missing from this snapshot. Refresh and try again.');
  if (db.spendingView && db.spendingView.viewerId !== viewerId) throw new Error('This financial snapshot belongs to another account.');
  const users = new Map(db.users.map(user => [user.id, user]));
  const person = (id: string): PhonePerson => {
    const user = users.get(id);
    if (!user) throw new Error('A group member is missing from this snapshot. Refresh and try again.');
    return phonePerson(user);
  };
  const ownedGroups = groupsFor(db, viewerId);
  const joinedGroups = ownedGroups.filter(group => group.members.some(member => member.userId === viewerId && member.status === 'joined'));
  const groupIds = new Set(joinedGroups.map(group => group.id));
  const visibleCharges = db.charges.filter(charge => groupIds.has(charge.groupId) && (!isDraft(charge) || charge.cardholderId === viewerId));
  const groupMap = new Map(joinedGroups.map(group => [group.id, group]));
  const groupPeople = (group: Group) => {
    const ordered = [...group.members].sort((a, b) => Number(b.userId === viewerId) - Number(a.userId === viewerId));
    const contributions = periodShares(group);
    return ordered.map(member => ({...person(member.userId), status: member.status, balance: dollars(member.balance),
      role: member.userId === group.createdBy ? 'creator' as const : 'member' as const,
      standing: standing(group, member.userId), contribution: dollars(contributions[member.userId]),
      initialContributionLimit: member.initialContributionLimit === undefined ? undefined : dollars(member.initialContributionLimit)}));
  };
  const peopleByGroup = new Map(ownedGroups.map(group => [group.id, groupPeople(group)]));
  const settled = (charge: Charge) => charge.status === 'settled' || (charge.status === 'disputed' && charge.settledAt !== undefined);
  const state: PhoneState = {displayName: viewer.name.trim().split(/\s+/)[0] || viewer.name, fullName: viewer.name, handle: viewer.handle,
    notice: false, approved: {}, approvals: {}, proposals: {}, publishedMethods: {}, proposalDetails: {}, itemConfirmations: {}, frozen: {}, autofill: {}};

  const rows = visibleCharges.map(charge => {
    const group = groupMap.get(charge.groupId)!;
    const people = peopleByGroup.get(group.id)!;
    const proposal = currentProposal(charge);
    const receipt = charge.receipt;
    const inputItems = proposal.input.method === 'items' ? proposal.input : null;
    const list = receipt ?? inputItems;
    // Stored proposal shares retain the backend's canonical rounding despite viewer-first display order.
    let canonicalShares = receipt ? Object.fromEntries(memberIds(group).map(id => [id, 0])) : proposal.shares;
    const itemAllocation = receipt?.exclusive && !receipt.draft ? receiptItemAllocations(memberIds(group), receipt) : null;
    if (itemAllocation) canonicalShares = itemAllocation.shares;
    else if (receipt && !receipt.draft) {
      const computed = computeSplit(memberIds(group), charge.amount, {method: 'items', items: receipt.items, tax: receipt.tax, tip: receipt.tip});
      canonicalShares = computed.shares;
    }
    const allocation = people.map(member => dollars(canonicalShares[member.id] ?? 0));
    const acceptedBy = [...(receipt ? receipt.locked : proposal.acceptedBy)];
    const method = list ? 'item' : proposal.input.method === 'equal' ? 'equal' : 'custom';
    const receiptKey = receipt ? receiptApprovalKey(receipt) : null;
    const image = receipt?.image;
    const listKey = receipt ? receiptListKey(receipt) : null;
    const editKey = chargeEditKey(charge);
    const details: PhoneProposal = {
      method, allocation, items: list ? list.items.map(item => {
        const amounts = itemAllocation?.items.find(value => value.id === item.id);
        return {id: item.id, name: item.name, amount: dollars(item.amount), assignees: [...item.people],
          ...(amounts ? {tax: dollars(amounts.tax), tip: dollars(amounts.tip), total: dollars(amounts.total)} : {})};
      }) : [],
      tax: dollars(list?.tax ?? 0), tip: dollars(list?.tip ?? 0), receipt: receipt ? {kind: 'saved', name: 'Receipt', ...(image ? {image} : {})} : null,
      proposalId: proposal.id, acceptedBy, participants: proposal.input.method === 'equal' ? [...proposal.input.participants] : memberIds(group), sourceInput: clone(proposal.input),
      exclusive: Boolean(receipt?.exclusive), receiptDraft: Boolean(receipt?.draft),
      receiptDraftDetails: receipt?.draft ? {
        items: receipt.draft.items.map((item, index) => ({id: `${charge.id}-draft-${index + 1}`, name: item.name, amount: dollars(item.amount), assignees: []})),
        tax: dollars(receipt.draft.tax), tip: dollars(receipt.draft.tip),
      } : null,
      receiptKey, receiptListKey: listKey, editKey,
      unclaimed: dollars(itemAllocation?.unclaimed ?? 0),
    };
    state.approved[charge.id] = acceptedBy.includes(viewerId);
    state.approvals[charge.id] = Object.fromEntries(people.map(member => [member.id, acceptedBy.includes(member.id)]));
    state.proposals[charge.id] = [...allocation];
    state.publishedMethods[charge.id] = method;
    state.proposalDetails[charge.id] = details;
    state.itemConfirmations[charge.id] = Object.fromEntries((receipt?.locked ?? []).map(id => [id, true]));
    const at = new Date(charge.createdAt);
    const row: PhoneCharge = {
      id: charge.id, name: charge.merchant, merchant: charge.merchant, group: group.id, icon: 'shopping-bag',
      amount: dollars(canonicalShares[viewerId] ?? 0), share: dollars(canonicalShares[viewerId] ?? 0), total: dollars(charge.amount), groupAmount: dollars(charge.amount),
      memberShares: Object.fromEntries(memberIds(group).map(id => [id, dollars(canonicalShares[id] ?? 0)])),
      allocation, people, canonicalMemberIds: memberIds(group), members: people.length, status: charge.status, createdAt: charge.createdAt,
      year: at.getFullYear(), month: at.getMonth(), day: at.getDate(), monthKey: `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`,
      date: dateText(charge.createdAt), cardholderId: charge.cardholderId, payerName: person(charge.cardholderId).name,
      settledAt: charge.settledAt, settled: settled(charge), draft: isDraft(charge), initialMethod: method,
      proposalId: proposal.id, receiptKey, receiptListKey: listKey, editKey, approvedBy: acceptedBy, initialApprovals: acceptedBy.length,
      canReview: charge.status === 'pending' && !group.frozen, note: charge.note ? {...charge.note} : undefined,
      preferredSplit: charge.proposals.length === 1 ? charge.preferredSplit : undefined,
    };
    return row;
  }).sort((a, b) => b.createdAt - a.createdAt);

  const groups = joinedGroups.map(group => {
    const member = group.members.find(item => item.userId === viewerId)!;
    const scoped = db.spendingView?.groups[group.id];
    if (db.spendingView && !scoped) throw new Error('The server omitted this group’s spending limits. Refresh and try again.');
    const card = cardFor(db, group.id, viewerId);
    const colorIndex = hash(group.id) % colors.length;
    const history = rows.filter(charge => charge.group === group.id && charge.settled);
    const budgetProposal = openBudgetProposal(db, group.id);
    state.frozen[group.id] = Boolean(card?.frozen);
    state.autofill[group.id] = member.autoDeposit;
    const result: PhoneGroup = {
      id: group.id, name: group.name, icon: 'users', tone: groupTones[colorIndex], color: colors[colorIndex],
      photo: group.photo,
      members: group.members.length, joinedMembers: group.members.filter(item => item.status === 'joined').length,
      people: peopleByGroup.get(group.id)!, canonicalMemberIds: memberIds(group), balance: dollars(member.balance), power: dollars(Math.max(0, scoped?.availableFunds ?? availableFunds(db, group))),
      total: history.reduce((sum, charge) => sum + Math.round(charge.amount * 100), 0) / 100,
      groupTotal: history.reduce((sum, charge) => sum + Math.round(charge.total * 100), 0) / 100,
      budget: dollars(group.budget), period: group.periodDays === 1 ? 'Every day' : group.periodDays === 7 ? 'Every week' : group.periodDays === 14 ? 'Every 2 weeks' : `Every ${group.periodDays} days`,
      periodDays: group.periodDays, periodStart: group.periodStart, nextPeriodAt: nextPeriodAt(group),
      contribution: dollars(periodShares(group)[viewerId]), initialContributionLimit: member.initialContributionLimit === undefined ? undefined : dollars(member.initialContributionLimit),
      forming: !isActive(group), frozenReason: group.frozen?.reason ?? null, createdBy: group.createdBy,
      card: card ? {...card} : null, cardId: card?.id ?? null, last4: card?.last4 ?? null, wallet: card?.wallet ?? null,
      pendingCount: scoped?.pendingCount ?? db.charges.filter(charge => charge.groupId === group.id && charge.status === 'pending').length,
      spendLimit: dollars(scoped?.spendLimit ?? spendLimit(db, group.id, viewerId)),
      purchaseBlocker: scoped ? scoped.purchaseBlocker : purchaseBlocker(db, group.id, viewerId),
      withdrawalBlocked: scoped?.withdrawalBlocked ?? (Boolean(group.frozen) || db.charges.some(charge => charge.groupId === group.id && !settled(charge))),
      defaultSplit: group.defaultSplit.method === 'equal' ? 'equal' : group.defaultSplit.method === 'items' ? 'item' : 'custom', defaultSplitInput: clone(group.defaultSplit),
      proposedBudget: budgetProposal ? dollars(budgetProposal.amount) : undefined,
      budgetProposal: budgetProposal ? {...budgetProposal, amount: dollars(budgetProposal.amount), acceptedBy: [...budgetProposal.acceptedBy]} : null,
    };
    return result;
  });
  const invites = ownedGroups.filter(group => group.members.some(member => member.userId === viewerId && member.status === 'invited')).map(group => {
    const expectedContribution = shares(group)[viewerId];
    const colorIndex = hash(group.id) % colors.length;
    return {id: group.id, name: group.name, from: person(group.createdBy).name, icon: 'users', tone: groupTones[colorIndex],
      photo: group.photo, budget: dollars(group.budget), share: dollars(expectedContribution),
      members: group.members.length, period: `Every ${group.periodDays} days`, people: peopleByGroup.get(group.id)!,
      expectedContribution, initialContributionLimit: expectedContribution};
  });
  const notifications = db.notifications.filter(notification => notification.userId === viewerId && groupIds.has(notification.groupId))
    .map(notification => ({id: notification.id, group: notification.groupId, chargeId: notification.chargeId, text: notification.text, at: notification.at, date: dateText(notification.at)}))
    .sort((a, b) => b.at - a.at);
  state.notice = notifications.length > 0 || invites.length > 0;
  const date = new Date(now);
  const monthName = new Intl.DateTimeFormat('en-US', {month: 'long'}).format(date);
  return {
    viewer: {...viewer}, people: [person(viewerId), ...db.users.filter(user => user.id !== viewerId).map(phonePerson)], demoUsers: db.users.map(phonePerson), groups, invites,
    pending: rows.filter(charge => !charge.settled), charges: rows.filter(charge => charge.settled), notifications,
    calendar: {now, year: date.getFullYear(), month: date.getMonth(), day: date.getDate(),
      monthKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, monthName,
      monthLabel: `${monthName} ${date.getFullYear()}`, startLabel: dateText(new Date(date.getFullYear(), date.getMonth(), 1).getTime()).toUpperCase(),
      endLabel: dateText(now).toUpperCase(), greeting: date.getHours() < 12 ? 'Good morning' : date.getHours() < 18 ? 'Good afternoon' : 'Good evening'}, state,
  };
}
