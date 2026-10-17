import assert from 'node:assert/strict';
import {fresh,calculate,allocate,reducer} from '../src/lib/engine.ts';
let state=fresh();assert.equal(calculate(state.draft).total,15420);assert.deepEqual(allocate(100,[1,1,1]),[34,33,33]);
assert.equal(reducer(state,{type:'generate',id:'blocked'}).card,null);
for(let index=0;index<3;index++)state=reducer(state,{type:'approve',index});
state=reducer(state,{type:'generate',id:'demo-one'});assert.equal(state.card?.limit,15420);
state=reducer(state,{type:'pay'});assert.equal(state.receipt,null);
state=reducer(state,{type:'wallet',wallet:'Apple Wallet'});state=reducer(state,{type:'freeze'});state=reducer(state,{type:'pay'});assert.equal(state.receipt,null);
state=reducer(state,{type:'freeze'});state=reducer(state,{type:'decline',value:true});state=reducer(state,{type:'pay'});assert.equal(state.receipt,null);
state=reducer(state,{type:'decline',value:false});state=reducer(state,{type:'pay'});assert.equal(state.receipt?.total,15420);assert.deepEqual(reducer(state,{type:'pay'}),state);
state=reducer(state,{type:'edit',draft:{...state.draft,tip:'25'}});assert.equal(state.card,null);assert.equal(state.approvals.some(Boolean),false);
assert(calculate({...state.draft,mode:'percent',values:['50','20','20']}).error);
assert.equal(calculate({...fresh().draft,mode:'custom',values:['50','50','54.20']}).error,'');
assert(calculate({...fresh().draft,subtotal:''}).error);
for(let n=1;n<10000;n+=37)assert.equal(allocate(n,[23,31,46]).reduce((a,b)=>a+b,0),n);
console.log('PASS: cent conservation, split validation, consent gate, wallet gate, freeze, decline/retry, duplicate prevention, card invalidation.');

const itemDraft={...fresh().draft,mode:'items' as const,subtotal:'10.01',tax:'0.83',tip:'18',items:[{id:'a',name:'Shared',amount:'6.01',people:[2,0]},{id:'b',name:'Solo',amount:'4.00',people:[1]}]};
const result=calculate(itemDraft);assert.equal(result.error,'');assert.deepEqual(result.itemBase,[301,400,300]);
assert.equal(result.shares.reduce((a,b)=>a+b,0),1264);assert.equal(result.taxes.reduce((a,b)=>a+b,0),83);assert.equal(result.tips.reduce((a,b)=>a+b,0),180);
for(const people of [[],[0,0],[3]])assert(calculate({...itemDraft,items:[{...itemDraft.items[0],people},itemDraft.items[1]]}).error);
assert(calculate({...itemDraft,subtotal:'11'}).error);assert(calculate({...itemDraft,items:[]}).error);
assert(calculate({...itemDraft,items:[{...itemDraft.items[0],amount:'6.001'},itemDraft.items[1]]}).error);
let itemState=reducer(fresh(),{type:'edit',draft:itemDraft});
for(let index=0;index<3;index++)itemState=reducer(itemState,{type:'approve',index});
itemState=reducer(itemState,{type:'generate',id:'items'});assert.equal(itemState.card?.limit,1264);
itemState=reducer(itemState,{type:'edit',draft:{...itemDraft,items:itemDraft.items.map((x,i)=>i===0?{...x,people:[0,1,2]}:x)}});assert.equal(itemState.card,null);assert.equal(itemState.approvals.some(Boolean),false);
for(let amount=1;amount<10000;amount+=97){const d={...itemDraft,subtotal:(amount/100).toFixed(2),items:[{id:'x',name:'Shared',amount:(amount/100).toFixed(2),people:[0,1,2]}]};const c=calculate(d);assert.equal(c.error,'');assert.equal(c.shares.reduce((a,b)=>a+b,0),c.total);}
console.log('PASS: shared items, proportional tax/tip, unassigned/mismatched/invalid costs blocked, item edit revokes approval/card.');
