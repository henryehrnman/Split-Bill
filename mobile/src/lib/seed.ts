import {DAY, acceptSplit, addToWallet, cardFor, createGroup, deposit, joinGroup, purchase, setAutoDeposit} from './domain.ts';
import type {Db} from './domain.ts';

export const DEMO_USERS = [
  {id: 'u_henry', name: 'Henry', initials: 'HE', tone: 0},
  {id: 'u_maya', name: 'Maya', initials: 'ML', tone: 1},
  {id: 'u_jordan', name: 'Jordan', initials: 'JR', tone: 2},
  {id: 'u_connor', name: 'Connor', initials: 'CZ', tone: 3},
];

const [henry, maya, jordan, connor] = DEMO_USERS.map(u => u.id);

// Built through the same rules the fake backend enforces so the history is internally consistent.
export function seed(now: number): Db {
  const db: Db = {version: 2, seq: 0, clockOffset: 0, users: DEMO_USERS.map(u => ({...u})), groups: [], cards: [], charges: [], buyingPowerProposals: [], ledger: []};

  const apt = createGroup(db, henry, {name: 'Apartment 4B', memberIds: [maya, jordan], buyingPower: 30000}, now - 40 * DAY);
  for (const id of [henry, maya, jordan]) {
    joinGroup(db, id, apt.id, now - 40 * DAY);
    addToWallet(db, id, cardFor(db, apt.id, id)!.id, id === jordan ? 'Google Wallet' : 'Apple Wallet');
  }
  setAutoDeposit(db, henry, apt.id, true, now - 40 * DAY);
  setAutoDeposit(db, maya, apt.id, true, now - 40 * DAY);

  const costco = purchase(db, maya, apt.id, {merchant: 'Costco', amount: 9630}, now - 20 * DAY);
  for (const id of [henry, maya, jordan]) acceptSplit(db, id, costco.id, now - 20 * DAY + 3600000);
  deposit(db, jordan, apt.id, 3210, now - 19 * DAY);

  const internet = purchase(db, henry, apt.id, {merchant: 'Comcast Internet', amount: 6000}, now - 9 * DAY);
  for (const id of [henry, maya, jordan]) acceptSplit(db, id, internet.id, now - 9 * DAY + 7200000);

  purchase(db, maya, apt.id, {merchant: 'Juniper', amount: 15420}, now - 2 * 3600000);

  const ski = createGroup(db, connor, {name: 'Tahoe ski trip', memberIds: [henry, maya], buyingPower: 60000}, now - 2 * DAY);
  joinGroup(db, connor, ski.id, now - 2 * DAY);
  addToWallet(db, connor, cardFor(db, ski.id, connor)!.id, 'Apple Wallet');

  return db;
}
