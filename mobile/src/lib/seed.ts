import {DAY, acceptSplit, addToWallet, cardFor, createGroup, currentProposal, proposeSplit, purchase, respondInvite, setAutoDeposit, shares, tick} from './domain.ts';
import type {Db, User} from './domain.ts';

export const DEMO_USERS: User[] = [
  {id: 'u_henry', name: 'Henry', initials: 'HE', tone: 0, handle: 'henry', email: 'henry@example.com', phone: '(415) 555-0101'},
  {id: 'u_maya', name: 'Maya', initials: 'ML', tone: 1, handle: 'maya.l', email: 'maya@example.com', phone: '(415) 555-0142'},
  {id: 'u_jordan', name: 'Jordan', initials: 'JR', tone: 2, handle: 'jordanr', email: 'jordan@example.com', phone: '(415) 555-0177'},
  {id: 'u_connor', name: 'Connor', initials: 'CZ', tone: 3, handle: 'connorz', email: 'connor@example.com', phone: '(415) 555-0123'},
  {id: 'u_saahil', name: 'Saahil', initials: 'SA', tone: 4, handle: 'saahil', email: 'saahil@example.com', phone: '(415) 555-0168'},
  {id: 'u_nathan', name: 'Nathan', initials: 'NZ', tone: 5, handle: 'nathan', email: 'nathan@example.com', phone: '(415) 555-0190'},
];

const [henry, maya, jordan, connor, saahil, nathan] = DEMO_USERS.map(u => u.id);
const HOUR = 3600000;
const $ = (dollars: number) => Math.round(dollars * 100);

// Built through the same rules the fake backend enforces so the history is internally consistent.
export function seed(now: number): Db {
  const db: Db = {version: 6, seq: 0, clockOffset: 0, users: DEMO_USERS.map(u => ({...u})), groups: [], cards: [], charges: [], budgetProposals: [], ledger: [], notifications: []};
  const at = (t: number) => {
    tick(db, t);
    return t;
  };

  const t0 = now - 20 * DAY;
  const apt = createGroup(db, henry, {name: 'Apartment 4B', inviteIds: [maya, jordan], budget: 30000, periodDays: 14}, t0);
  respondInvite(db, maya, apt.id, true, t0, shares(apt)[maya]);
  respondInvite(db, jordan, apt.id, true, t0, shares(apt)[jordan]);
  setAutoDeposit(db, jordan, apt.id, false);
  for (const id of [henry, maya, jordan]) addToWallet(db, id, cardFor(db, apt.id, id)!.id, id === jordan ? 'Google Wallet' : 'Apple Wallet');

  const costco = purchase(db, maya, apt.id, {merchant: 'Costco', amount: 9630}, at(now - 18 * DAY));
  for (const id of [maya, henry, jordan]) acceptSplit(db, id, costco.id, at(now - 18 * DAY + 3600000), currentProposal(costco).id);

  const internet = purchase(db, henry, apt.id, {merchant: 'Comcast Internet', amount: 6000}, at(now - 4 * DAY));
  for (const id of [henry, maya, jordan]) acceptSplit(db, id, internet.id, at(now - 4 * DAY + 7200000), currentProposal(internet).id);

  purchase(db, maya, apt.id, {merchant: 'Juniper', amount: 15420}, at(now - 2 * 3600000));

  const ski = createGroup(db, connor, {name: 'Tahoe ski trip', inviteIds: [saahil, henry], budget: 60000, periodDays: 30}, now - 2 * DAY);
  respondInvite(db, saahil, ski.id, true, now - DAY, shares(ski)[saahil]);
  addToWallet(db, connor, cardFor(db, ski.id, connor)!.id, 'Apple Wallet');

  // The four roommates' groups, so Connor's demo has a real history: 8 settled splits and 4 waiting on him.
  const roommates = (name: string, members: string[], budget: number, periodDays: number, t: number) => {
    const g = createGroup(db, members[0], {name, inviteIds: members.slice(1), budget, periodDays}, t);
    for (const id of members.slice(1)) respondInvite(db, id, g.id, true, t, shares(g)[id]);
    for (const id of members) addToWallet(db, id, cardFor(db, g.id, id)!.id, id === nathan ? 'Google Wallet' : 'Apple Wallet');
    return g;
  };
  const send = (groupId: string, payer: string, merchant: string, amounts: Record<string, number>, t: number) => {
    const cents = Object.fromEntries(Object.entries(amounts).map(([id, v]) => [id, $(v)]));
    const c = purchase(db, payer, groupId, {merchant, amount: Object.values(cents).reduce((a, b) => a + b, 0)}, at(t));
    proposeSplit(db, payer, c.id, {method: 'amount', amounts: cents}, t);
    return c;
  };
  const settled = (groupId: string, payer: string, merchant: string, amounts: Record<string, number>, t: number) => {
    const c = send(groupId, payer, merchant, amounts, t);
    for (const id of Object.keys(amounts)) if (amounts[id] > 0 && id !== payer) acceptSplit(db, id, c.id, at(t + HOUR), currentProposal(c).id);
  };

  const home = roommates('Apartment', [connor, henry, saahil, nathan], $(1200), 30, now - 16 * DAY);
  const weekend = roommates('Weekend crew', [connor, henry, saahil, nathan], $(800), 14, now - 16 * DAY);
  const trip = roommates('Road trip', [connor, henry, saahil], $(900), 30, now - 16 * DAY);

  settled(home.id, henry, 'Trader Joe’s', {[connor]: 39.6, [henry]: 44.3, [saahil]: 56.8, [nathan]: 0}, now - 10 * DAY);
  settled(weekend.id, connor, 'Bowling', {[connor]: 24, [henry]: 28, [saahil]: 16, [nathan]: 24}, now - 9 * DAY);
  settled(home.id, nathan, 'Utilities', {[connor]: 95, [henry]: 95, [saahil]: 95, [nathan]: 95}, now - 8 * DAY);
  settled(weekend.id, henry, 'Dinner at Bar Cotto', {[connor]: 38.2, [henry]: 49.5, [saahil]: 35.4, [nathan]: 42.7}, now - 7 * DAY);
  settled(trip.id, saahil, 'Shell', {[connor]: 16.2, [henry]: 21.6, [saahil]: 18}, now - 6 * DAY);
  settled(home.id, saahil, 'IKEA', {[connor]: 86.2, [henry]: 24.3, [saahil]: 106.4, [nathan]: 28}, now - 4 * DAY);
  settled(trip.id, henry, 'Campground', {[connor]: 24, [henry]: 7.4, [saahil]: 24}, now - 3 * DAY - 2 * HOUR);
  send(weekend.id, saahil, 'Blue Bottle', {[connor]: 12.5, [henry]: 12.5, [saahil]: 12.5, [nathan]: 12.5}, now - 3 * DAY);
  settled(home.id, connor, 'Whole Foods', {[connor]: 47.3, [henry]: 58.6, [saahil]: 24.2, [nathan]: 35.4}, now - 2 * DAY - 2 * HOUR);
  send(home.id, nathan, 'Spotify', {[connor]: 5.99, [henry]: 5.99, [saahil]: 5.99, [nathan]: 5.99}, now - 2 * DAY);
  send(home.id, saahil, 'Whole Foods', {[connor]: 24.8, [henry]: 24.8, [saahil]: 24.8, [nathan]: 24.8}, now - 30 * HOUR);
  send(weekend.id, henry, 'Din Tai Fung', {[connor]: 38.55, [henry]: 38.55, [saahil]: 38.55, [nathan]: 38.55}, now - 5 * HOUR);

  tick(db, now);
  return db;
}
