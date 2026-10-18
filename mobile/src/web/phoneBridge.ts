import type {api as appApi} from '../lib/api.ts';
import type {Db} from '../lib/domain.ts';
import {cents} from '../lib/money.ts';

export type PhoneApi = typeof appApi;
type AfterActor<Args> = Args extends [string, ...infer Rest] ? Rest : never;
export type PhoneMutation = {
  [K in keyof PhoneApi]: Parameters<PhoneApi[K]> extends [string, ...unknown[]]
    ? ReturnType<PhoneApi[K]> extends Promise<Db> ? K : never
    : never;
}[keyof PhoneApi];
export type PhoneMutationArgs<K extends PhoneMutation> = AfterActor<Parameters<PhoneApi[K]>>;
export type PhoneRun = (call: (actor: string) => Promise<Db>, success?: string) => Promise<Db | null>;

const mutations = new Set<string>([
  'createGroup', 'respondInvite', 'deposit', 'withdraw', 'setAutoDeposit', 'setFailTopUps',
  'setDefaultSplit', 'proposeBudget', 'respondBudget', 'addToWallet', 'setCardFrozen',
  'purchase', 'setChargeNote', 'scanReceipt', 'updateReceipt', 'toggleClaim', 'setLocked',
  'suggestItemEdit', 'respondItemEdit', 'proposeSplit', 'sendDefaultSplit', 'acceptSplit',
  'fileChargeback', 'confirmReceiptList', 'confirmItemSelection', 'updateGroup', 'updateProfile',
]);

/** Validate decimal input without letting binary rounding silently accept fractional cents. */
export function moneyToCents(value: unknown): number {
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error('Enter a valid amount with at most two decimal places.');
  const amount = cents(String(value));
  if (amount === null) throw new Error('Enter a valid amount with at most two decimal places.');
  return amount;
}

/** All writes go through the existing store runner and its current authenticated actor. */
export function createPhoneBridge(options: {api: PhoneApi; run: PhoneRun; getViewerId: () => string}) {
  return {
    call<K extends PhoneMutation>(method: K, args: PhoneMutationArgs<K>, success?: string): Promise<Db | null> {
      if (!mutations.has(method)) return Promise.reject(new Error('This action is not available in the phone interface.'));
      const action = options.api[method] as (actor: string, ...values: unknown[]) => Promise<Db>;
      if (typeof action !== 'function') return Promise.reject(new Error('This action is not available. Refresh the app and try again.'));
      // A form draft can change during a queued request. Capture exactly what was reviewed.
      const reviewed = structuredClone(args) as unknown[];
      return options.run(actor => action(actor, ...reviewed), success);
    },
    searchUsers(query: string, exclude: string[] = []) {
      return options.api.searchUsers(options.getViewerId(), query, [...exclude]);
    },
    parseReceipt(chargeId: string, photo?: Parameters<PhoneApi['parseReceipt']>[2]) {
      return options.api.parseReceipt(options.getViewerId(), chargeId, photo);
    },
  };
}

export type PhoneBridge = ReturnType<typeof createPhoneBridge>;
