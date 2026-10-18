import {DAY, acceptSplit, addToWallet, cardFor, createGroup, purchase, respondInvite, setAutoDeposit, tick} from './domain.ts';
import type {Db, User} from './domain.ts';

export const DEMO_USERS: User[] = [
  {id: 'u_henry', name: 'Henry', initials: 'HE', tone: 0, handle: 'henry', email: 'henry@example.com', phone: '(415) 555-0101'},
  {id: 'u_maya', name: 'Maya', initials: 'ML', tone: 1, handle: 'maya.l', email: 'maya@example.com', phone: '(415) 555-0142'},
  {id: 'u_jordan', name: 'Jordan', initials: 'JR', tone: 2, handle: 'jordanr', email: 'jordan@example.com', phone: '(415) 555-0177'},
  {id: 'u_connor', name: 'Connor', initials: 'CZ', tone: 3, handle: 'connorz', email: 'connor@example.com', phone: '(415) 555-0123'},
  {id: 'u_saahil', name: 'Saahil', initials: 'SA', tone: 4, handle: 'saahil', email: 'saahil@example.com', phone: '(415) 555-0168'},
];

const [henry, maya, jordan, connor, saahil] = DEMO_USERS.map(u => u.id);

// Built through the same rules the fake backend enforces so the history is internally consistent.
export function seed(now: number): Db {
  const db: Db = {version: 6, seq: 0, clockOffset: 0, users: DEMO_USERS.map(u => ({...u})), groups: [], cards: [], charges: [], budgetProposals: [], ledger: [], notifications: []};
  const at = (t: number) => {
    tick(db, t);
    return t;
  };

  const t0 = now - 20 * DAY;
  const apt = createGroup(db, henry, {name: 'Apartment 4B', inviteIds: [maya, jordan], budget: 30000, periodDays: 14}, t0);
  respondInvite(db, maya, apt.id, true, t0);
  respondInvite(db, jordan, apt.id, true, t0);
  setAutoDeposit(db, jordan, apt.id, false);
  for (const id of [henry, maya, jordan]) addToWallet(db, id, cardFor(db, apt.id, id)!.id, id === jordan ? 'Google Wallet' : 'Apple Wallet');

  const costco = purchase(db, maya, apt.id, {merchant: 'Costco', amount: 9630}, at(now - 18 * DAY));
  for (const id of [maya, henry, jordan]) acceptSplit(db, id, costco.id, at(now - 18 * DAY + 3600000));

  const internet = purchase(db, henry, apt.id, {merchant: 'Comcast Internet', amount: 6000}, at(now - 4 * DAY));
  for (const id of [henry, maya, jordan]) acceptSplit(db, id, internet.id, at(now - 4 * DAY + 7200000));

  purchase(db, maya, apt.id, {merchant: 'Juniper', amount: 15420}, at(now - 2 * 3600000));

  const ski = createGroup(db, connor, {name: 'Tahoe ski trip', inviteIds: [saahil, henry], budget: 60000, periodDays: 30}, now - 2 * DAY);
  respondInvite(db, saahil, ski.id, true, now - DAY);
  addToWallet(db, connor, cardFor(db, ski.id, connor)!.id, 'Apple Wallet');

  tick(db, now);
  return db;
}
