import {availableFunds, openCharges, purchaseBlocker, spendLimit} from './domain.ts';
import type {Db, Group, GroupSpendingView} from './domain.ts';
import type {UserId} from './split.ts';

// Real snapshots omit other payers' drafts, so only the server can calculate their holds.
export function groupSpendingView(db: Db, group: Group, viewerId: UserId, demoMode: boolean): GroupSpendingView | null {
  const member = group.members.find(m => m.userId === viewerId);
  if (!member) return null;
  if (!demoMode) {
    if (db.spendingView?.viewerId !== viewerId) return null;
    const view = db.spendingView.groups?.[group.id];
    if (!view || ![view.availableFunds, view.spendLimit, view.pendingCount].every(n => Number.isSafeInteger(n) && n >= 0)
      || (view.purchaseBlocker !== null && typeof view.purchaseBlocker !== 'string') || typeof view.withdrawalBlocked !== 'boolean') return null;
    return view;
  }
  return {
    availableFunds: Math.max(0, availableFunds(db, group)),
    spendLimit: spendLimit(db, group.id, viewerId),
    purchaseBlocker: purchaseBlocker(db, group.id, viewerId),
    pendingCount: openCharges(db, group.id).length,
    withdrawalBlocked: member.status !== 'joined' || !!group.frozen || db.charges.some(c => c.groupId === group.id
      && (c.status === 'pending' || (c.status === 'disputed' && c.settledAt === undefined))),
  };
}
