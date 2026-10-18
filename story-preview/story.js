/* A reversible, scroll-driven timeline. The phone is a separate, frozen demo copy. */
(() => {
  'use strict';
  const scenes = [
    {id:'intro',label:'Meet chipin',title:'Meet <span class="accent">chipin.</span>',body:'A little less settling up. A lot more living.',script:'Narrator: Meet chipin.',word:'together',length:125,side:'left',camera:{side:'right',y:.035,scale:.94,rotate:8}},
    {id:'groups',label:'One shared fund',title:'Your people.<br>One <span class="accent">shared fund.</span>',body:'The whole apartment. The ski trip. Whatever brings you together.',script:'One shared fund for the whole apartment, ski trip, or whatever other group you’re a part of, and a card for every member.',word:'together',length:150,side:'left',camera:{side:'right',y:0,scale:1,rotate:-4}},
    {id:'budget',label:'Agree on a budget',title:'Make a plan.<br><span class="accent">Together.</span>',body:'$500 every month. Four people. A shared budget everyone agrees to.',script:'Here’s how it works. The group agrees on a shared budget, say $500 every month.',word:'$500',length:155,side:'right',camera:{side:'left',y:.015,scale:1.06,rotate:3}},
    {id:'invite',label:'Invite & chip in',title:'An invitation.<br><span class="accent">No surprises.</span>',body:'Everyone sees exactly what they’re agreeing to. Then each person chips in $125.',script:'Everyone gets invited, sees exactly what they’re agreeing to, and chips in an equal share.',word:'$125',length:150,side:'right',camera:{side:'left',y:0,scale:1,rotate:-3}},
    {id:'cards',label:'A card for everyone',title:'One fund.<br><span class="accent">A card each.</span>',body:'Now everyone has a card on that fund.',script:'Now everyone has a card on that fund.',word:'everyone',length:145,side:'left',camera:{side:'right',y:.045,scale:.95,rotate:5}},
    {id:'pay',label:'Just pay',title:'Whoever’s there<br><span class="accent">just pays.</span>',body:'No fronting the bill. No “I’ll Venmo you later.”',script:'No fronting the bill, no “I’ll Venmo you later.” Whoever’s at the store just pays.',word:'paid',length:175,side:'left',camera:{side:'right',y:.035,scale:1.03,rotate:0},phases:[{at:0,body:'No fronting the bill. No “I’ll Venmo you later.”'},{at:.5,body:'$64 paid from the shared fund. $436 left to spend.'}]},
    {id:'split',label:'Split your way',title:'Pay together.<br><span class="accent">Split your way.</span>',body:'The buyer proposes the split. Equal shares by default, custom amounts when life isn’t equal.',script:'When you make a purchase, funds withdraw from the group amount and the split is proposed by the buyer. By default, it’s an even split with everyone, but you can customize the amounts that each individual owes to adapt each transaction to your group.',word:'your way',length:210,side:'left',camera:{side:'right',y:.07,scale:1.13,rotate:-2},phases:[{at:0,body:'The purchase is already paid. Start with an even $16 share for everyone.'},{at:.5,body:'Or propose $24, $16, $12, and $12. The same purchase, split to fit your group.'}]},
    {id:'henry',label:'Meet Henry',title:'Or, be<br><span class="accent">like Henry.</span>',body:'Dinner at Din Tai Fung. Henry pays with the group card.',script:'Alternatively, if you’re too lazy to decide on a split yourselves, you can be like Henry. Henry paid with the group card at Din Tai Fung.',word:'Henry',length:170,side:'left',camera:{side:'right',y:.04,scale:.98,rotate:5},phases:[{at:0,body:'Dinner at Din Tai Fung. Henry pays with the group card.'},{at:.5,body:'Dinner is paid. Now for the part nobody wants to calculate.'}]},
    {id:'receipt',label:'Snap the receipt',title:'Snap it.<br><span class="accent">Let Gemini read it.</span>',body:'A photo of the receipt becomes an itemized list.',script:'Then, instead of worrying about how much everyone owes, he snapped a photo of the receipt. Gemini reads the receipt and lists out line items.',word:'snap',length:240,side:'right',camera:{side:'left',y:.06,scale:1.07,rotate:-4},phases:[{at:0,body:'One photo. Every dish, ready to review.'},{at:1/3,body:'Gemini reads the receipt and identifies each line item.'},{at:2/3,body:'Review the items, tax, and tip. Everything adds up to $154.20.'}]},
    {id:'claims',label:'Claim your items',title:'Claim yours.<br><span class="accent">Keep moving.</span>',body:'Everyone opens their own app and selects what they had.',script:'Then, we all go into our apps, claim what’s ours, and move on.',word:'yours',length:240,side:'right',camera:{side:'left',y:.045,scale:1.08,rotate:2},phases:[{at:0,body:'Everyone opens their own app and selects what they had.'},{at:1/3,body:'Xiaolongbao and cucumber salad? Tap. Tap. Confirm your selection.'},{at:2/3,body:'A clear breakdown for each person, with tax and tip included.'}]},
    {id:'clarity',label:'See the whole picture',title:'No guessing.<br><span class="accent">Everyone’s in sync.</span>',body:'Every charge. Every balance. What’s coming up next month.',script:'Everyone sees every charge, every balance, and what’s coming up next period.',word:'in sync',length:180,side:'left',camera:{side:'right',y:0,scale:1,rotate:-3}},
    {id:'outro',label:'Just chipin',title:'Just <span class="accent">chipin.</span>',body:'See? It’s easy when you chip in.',script:'See? It’s easy when you just Chipin.',word:'chipin',length:135,side:'center',camera:{side:'center',y:.14,scale:.82,rotate:0}}
  ];
  const $ = id => document.getElementById(id);
  const stage=$('story-stage'),rig=$('phone-rig'),phone=$('story-phone'),track=$('story-track');
  const copy=$('scene-copy'),title=$('scene-title'),body=$('scene-body'),kicker=$('scene-kicker');
  const nav=$('chapter-nav'),bar=$('story-progress'),count=$('scene-count');
  const receipt=$('receipt-prop'),fan=$('card-fan'),word=$('stage-word'),glow=$('ambient-glow');
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp=(v,min=0,max=1)=>Math.min(max,Math.max(min,v));
  const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
  const lerp=(a,b,t)=>a+(b-a)*t;
  let bounds=[],frame=0,lastScene=-1,lastPhase=-1,ready=false,exploring=false,forcePhone=true;
  let active={index:0,progress:0},savedPosition={index:0,progress:0};
  track.innerHTML=scenes.map((scene,i)=>`<section class="story-step" id="scene-${scene.id}" style="height:${scene.length}vh" aria-labelledby="script-title-${i}"><div class="sr-only"><h2 id="script-title-${i}">${scene.label}</h2><p>${scene.script}</p></div></section>`).join('');
  track.style.paddingBottom='100vh';
  nav.innerHTML=scenes.map((scene,i)=>`<button class="chapter-dot" type="button" data-chapter="${i}" aria-label="${i+1}. ${scene.label}" title="${scene.label}"><span class="chapter-dot-mark"></span><span class="chapter-label">${scene.label}</span></button>`).join('');
  const dots=[...nav.querySelectorAll('button')];
  phone.tabIndex=-1;
  function measure(){bounds=[...track.querySelectorAll('.story-step')].map(el=>({start:el.offsetTop,end:el.offsetTop+el.offsetHeight}));schedule();}
  function locate(y){let i=bounds.findIndex(b=>y<b.end);if(i<0)i=scenes.length-1;return {index:i,progress:clamp((y-bounds[i].start)/(bounds[i].end-bounds[i].start))};}
  function sendPhone(scene,progress,force=false){if(ready)phone.contentWindow.postMessage({type:'chipin-story',scene,progress,force},location.origin);}
  function cameraFor(scene,mobile,w,h){
    const c=scene.camera,anchorX=mobile?.5:.72,compact=h<=520&&w>=600,still=reduced.matches||compact,side=still?'right':c.side;
    return {x:mobile?0:((side==='left'?.27:side==='center'?.5:.73)-anchorX)*w,y:mobile?0:(still?0:c.y*h),scale:mobile?1:(still?1:c.scale),rotate:mobile||still?0:c.rotate};
  }
  function paintCamera(scene,p,index){
    const w=innerWidth,h=innerHeight,mobile=w<=760;
    const base=Number.parseFloat(getComputedStyle(rig).getPropertyValue('--phone-base-scale'))||.85;
    if(exploring){rig.style.transform=`translate3d(${mobile?0:-.22*w}px,${mobile?-.13*h:0}px,0) scale(${base})`;return;}
    const current=cameraFor(scene,mobile,w,h),prev=index?cameraFor(scenes[index-1],mobile,w,h):{...current,y:current.y+60,scale:current.scale*.92,rotate:current.rotate+4};
    const t=reduced.matches?1:smooth(p/.34);
    rig.style.transform=`translate3d(${lerp(prev.x,current.x,t).toFixed(2)}px,${lerp(prev.y,current.y,t).toFixed(2)}px,0) rotate(${lerp(prev.rotate,current.rotate,t).toFixed(3)}deg) scale(${(base*lerp(prev.scale,current.scale,t)).toFixed(4)})`;
    if(glow)glow.style.transform=reduced.matches?'translateY(-50%)':`translate3d(${lerp(prev.x,current.x,t)*.32}px,calc(-50% + ${Math.sin((index+p)*.6)*35}px),0)`;
  }
  function paintProps(scene,p){
    const receiptOn=scene.id==='receipt',cardsOn=scene.id==='cards';
    const enter=smooth(p/.25),exit=1-smooth((p-.82)/.18);
    if(receipt){receipt.style.opacity=receiptOn?String(enter*exit):'0';receipt.style.transform=reduced.matches?'none':`translate3d(${(1-enter)*80}px,${(1-enter)*90}px,0) rotate(${lerp(17,-8,enter)}deg) scale(${lerp(.85,1,enter)})`;receipt.dataset.scanning=receiptOn&&p>=1/3&&p<2/3?'true':'false';}
    if(fan){fan.style.opacity=cardsOn?String(enter*exit):'0';fan.style.setProperty('--fan-spread',cardsOn?String(enter):'0');fan.style.transform=reduced.matches?'none':`translateY(${(1-enter)*60}px) rotate(${(1-enter)*8}deg)`;}
  }
  function render(){frame=0;if(!bounds.length)return;active=locate(scrollY);const {index,progress:p}=active,scene=scenes[index];
    if(exploring){paintCamera(scene,p,index);return;}
    let phase=0;if(scene.phases)scene.phases.forEach((v,i)=>{if(p>=v.at)phase=i;});
    if(lastScene!==index){document.body.dataset.scene=scene.id;document.body.dataset.tone=['cards','outro'].includes(scene.id)?'blue':'navy';document.body.dataset.copySide=reduced.matches?'left':scene.side;title.innerHTML=scene.title;kicker.textContent=scene.label;word.textContent=scene.word;count.textContent=`${String(index+1).padStart(2,'0')} / ${String(scenes.length).padStart(2,'0')}`;dots.forEach((dot,i)=>{dot.classList.toggle('active',i===index);if(i===index)dot.setAttribute('aria-current','step');else dot.removeAttribute('aria-current');});lastPhase=-1;lastScene=index;}
    if(lastPhase!==phase){body.textContent=scene.phases?.[phase].body||scene.body;lastPhase=phase;}
    // Copy changes in the quiet interval while the phone crosses the stage.
    const fadeIn=index===0?1:smooth((p-.06)/.15),fadeOut=index===scenes.length-1?1:1-smooth((p-.88)/.12);
    copy.style.opacity=reduced.matches?'1':String(fadeIn*fadeOut);
    copy.style.setProperty('--copy-shift',`${reduced.matches?0:(1-fadeIn)*20-(1-fadeOut)*12}px`);
    bar.style.width=`${((index+p)/scenes.length*100).toFixed(3)}%`;
    stage.style.setProperty('--scene-progress',p);
    dots[index].style.setProperty('--chapter-progress',p);
    paintCamera(scene,p,index);paintProps(scene,p);sendPhone(scene.id,p,forcePhone);forcePhone=false;
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(render);}
  function seek(index,p=.32){index=clamp(index,0,scenes.length-1);if(exploring)setExplore(false);scrollTo({top:bounds[index].start+(bounds[index].end-bounds[index].start)*p,behavior:reduced.matches?'instant':'smooth'});}
  function setExplore(enabled){
    if(enabled===exploring)return;exploring=enabled;document.body.dataset.mode=enabled?'explore':'story';
    $('explore-toggle').textContent=enabled?'Back to story':'Explore the app';$('explore-toggle').setAttribute('aria-pressed',String(enabled));
    phone.tabIndex=enabled?0:-1;
    if(enabled){savedPosition=locate(scrollY);document.body.style.overflow='hidden';}
    else{document.body.style.overflow='';const b=bounds[savedPosition.index];scrollTo({top:b.start+(b.end-b.start)*savedPosition.progress,behavior:'instant'});forcePhone=true;lastScene=-1;$('explore-toggle').focus({preventScroll:true});}
    if(ready)phone.contentWindow.postMessage({type:'chipin-story-explore',enabled},location.origin);
    schedule();
  }
  nav.addEventListener('click',e=>{const button=e.target.closest('[data-chapter]');if(button)seek(Number(button.dataset.chapter));});
  $('replay').addEventListener('click',()=>seek(0,0));
  $('explore-toggle').addEventListener('click',()=>setExplore(!exploring));
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',measure,{passive:true});
  addEventListener('keydown',e=>{if(e.key==='Escape'&&exploring){setExplore(false);return;}if(exploring||e.altKey||e.metaKey||e.ctrlKey||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();seek(active.index+(e.key==='ArrowRight'?1:-1));}});
  function phoneReady(){ready=true;forcePhone=true;if(exploring)phone.contentWindow.postMessage({type:'chipin-story-explore',enabled:true},location.origin);schedule();}
  addEventListener('message',e=>{if(e.source!==phone.contentWindow||e.origin!==location.origin)return;if(e.data?.type==='chipin-story-ready')phoneReady();if(e.data?.type==='chipin-story-exit-explore')setExplore(false);});
  phone.addEventListener('load',phoneReady);
  reduced.addEventListener('change',()=>{lastScene=-1;measure();});
  document.body.dataset.mode='story';$('explore-toggle').setAttribute('aria-pressed','false');measure();
  window.chipinStoryTimeline={scenes,seek,setExplore,getState:()=>({...active,exploring})};
})();
