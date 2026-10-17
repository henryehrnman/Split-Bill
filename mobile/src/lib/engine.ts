export type Mode='equal'|'percent'|'custom'|'items';
export type LineItem={id:string;name:string;amount:string;people:number[]};
export type Draft={subtotal:string;tax:string;tip:string;mode:Mode;values:string[];items?:LineItem[]};
export const initial:Draft={subtotal:'120',tax:'10.20',tip:'20',mode:'equal',values:['34','33','33']};
export const money=(c:number)=>'$'+(c/100).toFixed(2);
export function allocate(total:number,weights:number[]){const sum=weights.reduce((a,b)=>a+b,0);if(sum<=0)return weights.map(()=>0);const raw=weights.map(w=>total*w/sum),out=raw.map(Math.floor);raw.map((x,i)=>({i,r:x-out[i]})).sort((a,b)=>b.r-a.r||a.i-b.i).slice(0,total-out.reduce((a,b)=>a+b,0)).forEach(x=>out[x.i]++);return out;}
// Decimal money input is parsed to integer cents; reject hidden fractional cents.
export function cents(value:string):number|null {
  if(!/^\d+(?:\.\d{1,2})?$/.test(value.trim()))return null;
  const [whole,fraction='']=value.trim().split('.');
  const result=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  return Number.isSafeInteger(result)&&result<=10000000?result:null;
}
export function calculate(d:Draft){
  const subtotal=cents(d.subtotal),tax=cents(d.tax),tip=Number(d.tip),v=d.values.map(Number);
  const valid=subtotal!==null&&subtotal>0&&tax!==null&&/^\d+(?:\.\d{1,2})?$/.test(d.tip.trim())&&tip>=0&&tip<=100;
  const base=subtotal??0,taxCents=tax??0,tipCents=Math.round(base*tip/100);
  const total=valid?base+taxCents+tipCents:0;
  let error=valid?'':'Enter valid money amounts (up to 2 decimal places) and a tip between 0% and 100%.';
  let itemBase=[0,0,0];
  if(d.mode==='items'){
    const items=d.items??[];
    if(!items.length)error=error||'Add at least one item.';
    let itemTotal=0;
    for(const item of items){
      const amount=cents(item.amount);
      const people=[...new Set(item.people)];
      if(!item.name.trim()||amount===null||amount<=0){error=error||'Give every item a name and a positive amount.';continue;}
      itemTotal+=amount;
      if(!people.length||people.length!==item.people.length||people.some(i=>!Number.isInteger(i)||i<0||i>2)){
        error=error||'Assign every item to at least one person.';continue;
      }
      // Participant order breaks ties, independent of selection order.
      const parts=allocate(amount,[0,1,2].map(i=>people.includes(i)?1:0));
      itemBase=itemBase.map((x,i)=>x+parts[i]);
    }
    if(itemTotal!==base)error=error||'Item amounts must total the subtotal of '+money(base)+'.';
  }
  const taxes=allocate(taxCents,itemBase),tips=allocate(Number.isFinite(tipCents)?tipCents:0,itemBase);
  const shares=d.mode==='items'?itemBase.map((x,i)=>x+taxes[i]+tips[i]):d.mode==='equal'?allocate(total,[1,1,1]):d.mode==='percent'?allocate(total,v):d.values.map(x=>cents(x)??0);
  if(d.mode==='percent'&&(d.values.length!==3||d.values.some(x=>x.trim()===''||!Number.isFinite(Number(x))||Number(x)<0)||Math.abs(v.reduce((a,b)=>a+b,0)-100)>0.00001))error=error||'Percentages must total 100%.';
  if(d.mode==='custom'&&(d.values.length!==3||d.values.some(x=>cents(x)===null)||shares.reduce((a,b)=>a+b,0)!==total))error=error||'Amounts must total '+money(total)+'.';
  return {total,shares,error,itemBase,taxes,tips};
}
export type Card={id:string;limit:number;wallet:'Apple Wallet'|'Google Wallet'|null;frozen:boolean;spent:boolean};
export type State={draft:Draft;approvals:boolean[];card:Card|null;receipt:{total:number;shares:number[];id:string}|null;notice:string;decline:boolean};
export const fresh=():State=>({draft:{...initial,values:[...initial.values]},approvals:[false,false,false],card:null,receipt:null,notice:'',decline:false});
export type Action={type:'edit';draft:Draft}|{type:'approve';index:number}|{type:'generate';id:string}|{type:'wallet';wallet:'Apple Wallet'|'Google Wallet'}|{type:'freeze'}|{type:'pay'}|{type:'decline';value:boolean}|{type:'reset'};
export function reducer(s:State,a:Action):State{const c=calculate(s.draft);switch(a.type){case 'reset':return fresh();case 'edit':return {...s,draft:a.draft,approvals:[false,false,false],card:null,receipt:null,notice:'Bill updated. Approvals and any previous demo card have been reset.'};case 'approve':return c.error||s.card?s:{...s,approvals:s.approvals.map((x,i)=>i===a.index?!x:x)};case 'generate':return c.error||!s.approvals.every(Boolean)||s.card?s:{...s,card:{id:a.id,limit:c.total,wallet:null,frozen:false,spent:false},notice:'Demo group card generated. No bank card has been issued.'};case 'wallet':return !s.card||s.card.spent?s:{...s,card:{...s.card,wallet:a.wallet},notice:'Wallet setup simulated. Nothing was added to your device wallet.'};case 'freeze':return !s.card||s.card.spent?s:{...s,card:{...s.card,frozen:!s.card.frozen}};case 'decline':return {...s,decline:a.value};case 'pay':if(!s.card||s.card.frozen||s.card.spent||!s.card.wallet||c.error||!s.approvals.every(Boolean))return s;if(s.decline)return {...s,notice:'Payment declined in demo. No one was charged. Turn off the decline scenario to retry.'};return {...s,card:{...s.card,spent:true},receipt:{total:c.total,shares:c.shares,id:s.card.id},notice:'Demo checkout complete. No real money moved.'};}}
