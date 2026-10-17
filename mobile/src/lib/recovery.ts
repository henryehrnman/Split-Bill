import {calculate, fresh} from './engine.ts';
import type {Draft, State} from './engine.ts';

export type SavedReceipt={id:string;total:number;shares:number[];wallet:string};
export type Snapshot={version:1;draft:Draft;receipts:SavedReceipt[]};
export const STORAGE_KEY='splitbill.demo.v1';
const record=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
function validDraft(x:unknown):x is Draft {
  if(!record(x)||!['equal','percent','custom','items'].includes(String(x.mode)))return false;
  if(!['subtotal','tax','tip'].every(k=>typeof x[k]==='string'&&(x[k] as string).length<=32))return false;
  if(!Array.isArray(x.values)||x.values.length!==3||!x.values.every(v=>typeof v==='string'&&v.length<=32))return false;
  if(x.items!==undefined&&(!Array.isArray(x.items)||x.items.length>100||!x.items.every(i=>record(i)&&typeof i.id==='string'&&i.id.length<=100&&typeof i.name==='string'&&i.name.length<=200&&typeof i.amount==='string'&&i.amount.length<=32&&Array.isArray(i.people)&&i.people.length<=3&&i.people.every(p=>Number.isInteger(p)&&p>=0&&p<3))))return false;
  return true;
}
function validReceipt(x:unknown):x is SavedReceipt {
  return record(x)&&typeof x.id==='string'&&x.id.length>0&&x.id.length<=100&&Number.isSafeInteger(x.total)&&Number(x.total)>0&&Number(x.total)<=30000000&&Array.isArray(x.shares)&&x.shares.length===3&&x.shares.every(n=>Number.isSafeInteger(n)&&n>=0)&&x.shares.reduce((a,b)=>a+b,0)===x.total&&['Apple Wallet','Google Wallet'].includes(String(x.wallet));
}
export function decode(raw:string|null):Snapshot|null {
  if(!raw||raw.length>200000)return null;
  try {const x:unknown=JSON.parse(raw);if(!record(x)||x.version!==1||!validDraft(x.draft)||!Array.isArray(x.receipts)||x.receipts.length>100||!x.receipts.every(validReceipt)||new Set(x.receipts.map(r=>r.id)).size!==x.receipts.length)return null;return {version:1,draft:x.draft,receipts:x.receipts};}catch{return null;}
}
// Only draft + completed simulated receipts survive. Consent and wallet/card state never do.
export function restore(saved:Snapshot):State {return {...fresh(),draft:saved.draft,notice:calculate(saved.draft).error?'Recovered draft needs attention. Check amounts before approving.':'Draft recovered. Review shares and approve again.'};}
export function remember(receipts:SavedReceipt[],state:State):SavedReceipt[]{
  if(!state.receipt||!state.card?.wallet||receipts.some(r=>r.id===state.receipt!.id))return receipts;
  return [{...state.receipt,shares:[...state.receipt.shares],wallet:state.card.wallet},...receipts].slice(0,100);
}
