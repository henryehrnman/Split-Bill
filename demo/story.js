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
    {id:'receipt',label:'Snap the receipt',title:'Snap it.<br><span class="accent">Let <span class="gemini-word">Gemini<img class="gemini-logo" src="assets/gemini-logo.png" alt="" width="512" height="512"></span> read it.</span>',body:'A photo of the receipt becomes an itemized list.',script:'Then, instead of worrying about how much everyone owes, he snapped a photo of the receipt. Gemini reads the receipt and lists out line items.',word:'snap',length:240,side:'right',camera:{side:'left',y:.06,scale:1.07,rotate:-4},phases:[{at:0,body:'One photo. Every dish, ready to review.'},{at:1/3,body:'Gemini reads the receipt and identifies each line item.'},{at:2/3,body:'Review the items, tax, and tip. Everything adds up to $154.20.'}]},
    {id:'claims',label:'Claim your items',title:'Claim yours.<br><span class="accent">Keep moving.</span>',body:'Everyone opens their own app and selects what they had.',script:'Then, we all go into our apps, claim what’s ours, and move on.',word:'yours',length:240,side:'right',camera:{side:'left',y:.045,scale:1.08,rotate:2},phases:[{at:0,body:'Everyone opens their own app and selects what they had.'},{at:1/3,body:'Xiaolongbao and cucumber salad? Tap. Tap. Confirm your selection.'},{at:2/3,body:'A clear breakdown for each person, with tax and tip included.'}]},
    {id:'clarity',label:'See the whole picture',title:'No guessing.<br><span class="accent">Everyone’s in sync.</span>',body:'Every charge. Every balance. What’s coming up next month.',script:'Everyone sees every charge, every balance, and what’s coming up next period.',word:'in sync',length:180,side:'left',camera:{side:'right',y:0,scale:1,rotate:-3}},
    // Pitch chapters. The phone leaves the stage and a data prop takes its place.
    {id:'market',label:'The market',title:'$2 trillion<br><span class="accent">moves between friends.</span>',body:'US mobile P2P payments: $2.0 trillion in 2025, 170 million people, $7,200 each per year. Most of it is friends paying friends back.',script:'US mobile peer-to-peer payments moved two trillion dollars in 2025, across 170 million people. Most of it is one friend paying another back. Our wedge is the 25 million 18-to-34-year-olds in standing groups: roommates, couples, friends who travel. About 60 billion dollars of card spend a year.',word:'$2T',length:190,side:'left',deck:'market',camera:{side:'right',y:0,scale:1,rotate:0},phases:[{at:0,body:'US mobile P2P payments: $2.0 trillion in 2025, 170 million people, $7,200 each per year. Most of it is friends paying friends back.'},{at:.5,body:'Our wedge: 25 million 18-to-34-year-olds in standing groups. Roommates, couples, friends who travel. About $60 billion of shared card spend a year.'}]},
    {id:'competition',label:'The competition',title:'They split the bill.<br><span class="accent">We split the card.</span>',body:'Splitwise, Venmo and Cash App settle up after someone has already paid. chipin removes the fronting and the repayment.',script:'Everyone else helps you settle up after one person has already paid. Splitwise and Venmo keep a ledger. Cash App has a pot. The two shared-card products are Europe-only. chipin is the only one where every member has a card on one fund, the split is agreed afterward, and everyone involved accepts it.',word:'ahead',length:200,side:'left',deck:'competition',camera:{side:'right',y:0,scale:1,rotate:0},phases:[{at:0,body:'Splitwise, Venmo and Cash App settle up after someone has already paid. chipin removes the fronting and the repayment.'},{at:.5,body:'The only product where every member has a card on one shared fund, the split is agreed after the purchase, and everyone involved accepts it.'}]},
    {id:'model',label:'How we make money',title:'Deposits earn.<br><span class="accent">Spending earns.</span>',body:'Group funds sit in low-risk, high-yield instruments: government money market and T-bills. chipin keeps the yield and fronts every card charge from the pool.',script:'Here’s how we make money. Group deposits sit in low-risk, high-yield instruments, government money market funds and Treasury bills, and chipin keeps the yield while fronting every card charge from the pool. Every tap of a chipin card also earns interchange from the merchant. Two revenue streams, and the app stays free for friends.',word:'yield',length:200,side:'left',deck:'model',camera:{side:'right',y:0,scale:1,rotate:0},phases:[{at:0,body:'Group funds sit in low-risk, high-yield instruments: government money market and T-bills. chipin keeps the yield and fronts every card charge from the pool.'},{at:.5,body:'Every tap of a chipin card earns interchange from the merchant. Two revenue streams, and the app stays free for friends.'}]},
    {id:'projections',label:'Projections',title:'Year three:<br><span class="accent">$12.7M revenue.</span>',body:'15,000 active members in year one, 400,000 by year three. $100 average balance, $260 a month on the card.',script:'With 15 thousand active members in year one and 400 thousand by year three, chipin reaches 12.7 million dollars of revenue: 1.5 million from yield on a 40 million dollar float, and 11.2 million from interchange on 1.25 billion dollars of card spend. Contribution margin is positive from year one.',word:'$12.7M',length:200,side:'left',deck:'projections',camera:{side:'right',y:0,scale:1,rotate:0},phases:[{at:0,body:'15,000 active members in year one, 400,000 by year three. $100 average balance, $260 a month on the card.'},{at:.5,body:'$1.5M from yield on a $40M float, $11.2M from interchange on $1.25B of card spend. Contribution-margin positive from year one.'}]},
    {id:'outro',label:'Just chipin',title:'Just <span class="accent">chipin.</span>',body:'See? It’s easy when you chip in.',script:'See? It’s easy when you just Chipin.',word:'chipin',length:135,side:'center',camera:{side:'center',y:.14,scale:.82,rotate:0}}
  ];
  // Seconds are narration time, not a percentage of the page. Extra motion
  // stops let the phone arrive, hold, then perform an action on the spoken cue.
  const cues = [
    {time:0,scene:'intro',progress:0,label:'Meet chipin'},
    {time:2,scene:'groups',progress:0,label:'One shared fund'},
    {time:6,scene:'groups',progress:.6,label:'A card for every member'},
    {time:8.36,scene:'budget',progress:0,label:'Agree on $500 every month'},
    {time:14,scene:'invite',progress:0,label:'Everyone gets invited'},
    {time:15.33,scene:'invite',progress:1/3,label:'See what you agree to'},
    {time:17,scene:'invite',progress:2/3,label:'Chip in equally'},
    {time:19,scene:'cards',progress:0,label:'Everyone has a card'},
    {time:22,scene:'pay',progress:0,label:'Whoever is there pays'},
    {time:27,scene:'pay',progress:.5,label:'Purchase withdraws group funds'},
    {time:29,scene:'split',progress:0,label:'Buyer proposes the split'},
    {time:31,scene:'split',progress:.24,label:'Equal shares by default'},
    {time:35,scene:'split',progress:.5,label:'Customize individual amounts'},
    {time:40,scene:'henry',progress:0,label:'Be like Henry'},
    {time:45,scene:'henry',progress:.5,label:'Henry paid at Din Tai Fung'},
    {time:50,scene:'receipt',progress:0,label:'Photograph the receipt'},
    {time:52,scene:'receipt',progress:1/3,label:'Gemini reads the receipt'},
    {time:55,scene:'claims',progress:0,label:'Claim your items'},
    {time:60,scene:'clarity',progress:0,label:'Every charge, balance, and next period'},
    {time:65,scene:'market',progress:0,label:'$2 trillion moves between friends'},
    {time:71,scene:'market',progress:.5,label:'Our wedge: 25M people, $60B of shared spend'},
    {time:76,scene:'competition',progress:0,label:'Everyone else settles up after'},
    {time:82,scene:'competition',progress:.5,label:'Only chipin does all of it'},
    {time:88,scene:'model',progress:0,label:'Deposits earn yield'},
    {time:94,scene:'model',progress:.5,label:'Spending earns interchange'},
    {time:100,scene:'projections',progress:0,label:'Three-year model'},
    {time:106,scene:'projections',progress:.5,label:'$12.7M revenue in year three'},
    {time:112,scene:'outro',progress:0,label:'Just chipin'}
  ];
  const duration=115;
  const motionStops=[
    [1.6,'intro',.75],[3,'groups',.3],[7.9,'groups',.88],
    [9.4,'budget',.34],[12,'budget',.5],[18.6,'invite',.88],
    [20,'cards',.34],[21.7,'cards',.88],[23,'pay',.34],[28.7,'pay',.88],
    [39.5,'split',.88],[41,'henry',.34],[49.5,'henry',.88],
    [50.7,'receipt',.25],[54,'receipt',2/3],[54.8,'receipt',.95],
    [56.5,'claims',1/3],[58,'claims',2/3],[59.6,'claims',.95],
    [60.9,'clarity',.34],[62,'clarity',.6],[64,'clarity',.9],
    [66.5,'market',.34],[75,'market',.92],
    [77.5,'competition',.34],[87,'competition',.92],
    [89.5,'model',.34],[99,'model',.92],
    [101.5,'projections',.34],[111,'projections',.92],
    [113,'outro',.34],[duration,'outro',1]
  ];
  const timeline=[...cues,...motionStops.map(([time,scene,progress])=>({time,scene,progress}))]
    .map(stop=>({...stop,position:scenes.findIndex(scene=>scene.id===stop.scene)+stop.progress}))
    .sort((a,b)=>a.time-b.time);
  scenes[1].phases=[{at:0,body:scenes[1].body},{at:.6,body:'One shared fund, with a card for every member.'}];
  scenes[3].phases=[{at:0,body:'Invite Henry, Saahil, and Nathan to the apartment fund.'},{at:1/3,body:'Everyone reviews the $500 monthly budget and their $125 contribution before agreeing.'},{at:2/3,body:'$125 each. Four approved contributions. $500 ready to spend.'}];
  scenes[6].phases=[{at:0,body:'The purchase is already paid. The buyer proposes how to split it.'},{at:.24,body:'An even split by default: $16 for each of the four members.'},{at:.5,body:scenes[6].phases[1].body}];
  scenes[7].phases[0].body='There’s an easier way to work out dinner. Meet Henry.';
  const $ = id => document.getElementById(id);
  const stage=$('story-stage'),rig=$('phone-rig'),phone=$('story-phone'),track=$('story-track');
  const copy=$('scene-copy'),title=$('scene-title'),body=$('scene-body'),kicker=$('scene-kicker');
  const nav=$('chapter-nav'),bar=$('story-progress');
  const receipt=$('receipt-prop'),fan=$('card-fan'),word=$('stage-word'),glow=$('ambient-glow'),deck=$('deck-prop');
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp=(v,min=0,max=1)=>Math.min(max,Math.max(min,v));
  const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
  const lerp=(a,b,t)=>a+(b-a)*t;
  let bounds=[],frame=0,lastScene=-1,lastPhase=-1,ready=false,exploring=false,forcePhone=true;
  let active={index:0,progress:0},savedPosition={index:0,progress:0};
  let playing=false,timed=false,playbackTime=0,clockStart=0,expectedScroll=null;
  track.innerHTML=scenes.map((scene,i)=>`<section class="story-step" id="scene-${scene.id}" style="height:${scene.length}vh" aria-labelledby="script-title-${i}"><div class="sr-only"><h2 id="script-title-${i}">${scene.label}</h2><p>${scene.script}</p></div></section>`).join('');
  track.style.paddingBottom='100vh';
  nav.innerHTML=scenes.map((scene,i)=>`<button class="chapter-dot" type="button" data-chapter="${i}" aria-label="${i+1}. ${scene.label}" title="${scene.label}"><span class="chapter-dot-mark"></span><span class="chapter-label">${scene.label}</span></button>`).join('');
  const dots=[...nav.querySelectorAll('button')];
  phone.tabIndex=-1;
  function measure(){const prior=bounds.length?locate(scrollY):null;bounds=[...track.querySelectorAll('.story-step')].map(el=>({start:el.offsetTop,end:el.offsetTop+el.offsetHeight}));if(timed)scrollToPosition(positionAtTime(playbackTime));else if(prior&&!exploring)scrollToPosition(prior.index+prior.progress);schedule();}
  function locate(y){let i=bounds.findIndex(b=>y<b.end);if(i<0)i=scenes.length-1;return {index:i,progress:clamp((y-bounds[i].start)/(bounds[i].end-bounds[i].start))};}
  function interpolate(value,input,output){
    if(value<=timeline[0][input])return timeline[0][output];
    const end=timeline.findIndex(stop=>stop[input]>value);
    if(end<0)return timeline[timeline.length-1][output];
    const a=timeline[end-1],b=timeline[end];
    return lerp(a[output],b[output],(value-a[input])/(b[input]-a[input]));
  }
  function positionAtTime(time){return interpolate(clamp(time,0,duration),'time','position');}
  function timeAtPosition(position){return interpolate(clamp(position,0,scenes.length),'position','time');}
  function splitPosition(position){const index=Math.min(scenes.length-1,Math.floor(position));return {index,progress:position-index};}
  function scrollToPosition(position){const {index,progress}=splitPosition(position),b=bounds[index];expectedScroll=b.start+(b.end-b.start)*progress;if(Math.abs(scrollY-expectedScroll)>.5)scrollTo({top:expectedScroll,behavior:'instant'});}
  function paintPlayback(){
    document.body.dataset.playing=String(playing);
  }
  function pause(){if(playing)playbackTime=clamp((performance.now()-clockStart)/1000,0,duration);playing=false;paintPlayback();schedule();}
  function play(){
    if(playing)return;
    if(exploring)setExplore(false);
    if(!timed){const p=locate(scrollY);playbackTime=timeAtPosition(p.index+p.progress);}
    if(playbackTime>=duration-.01)playbackTime=0;
    // Cancel a chapter's in-flight smooth scroll before the narration clock starts.
    timed=true;expectedScroll=scrollY;scrollTo({top:scrollY,behavior:'instant'});scrollToPosition(positionAtTime(playbackTime));
    clockStart=performance.now()-playbackTime*1000;playing=true;paintPlayback();schedule();
  }
  function togglePlayback(){if(playing)pause();else play();}
  function seekTime(time){if(!Number.isFinite(time))return;pause();if(exploring)setExplore(false);playbackTime=clamp(time,0,duration);timed=true;scrollToPosition(positionAtTime(playbackTime));forcePhone=true;paintPlayback();schedule();}
  function manualOverride(){if(exploring)return;pause();timed=false;expectedScroll=null;const p=locate(scrollY);playbackTime=timeAtPosition(p.index+p.progress);paintPlayback();}
  function onScroll(){
    if(timed&&expectedScroll!==null&&Math.abs(scrollY-expectedScroll)>2)manualOverride();
    if(!timed&&!exploring){const p=locate(scrollY);playbackTime=timeAtPosition(p.index+p.progress);paintPlayback();}
    schedule();
  }
  function sendPhone(scene,progress,force=false){if(ready)phone.contentWindow.postMessage({type:'chipin-story',scene,progress,force},location.origin);}
  function cameraFor(scene,mobile,w,h){
    const c=scene.camera,anchorX=mobile?.5:.72,compact=h<=520&&w>=600,still=reduced.matches||compact,side=still?'right':c.side;
    // Pitch chapters park the phone just off the edge of the stage so a data prop can take its place.
    if(scene.deck)return mobile?{x:0,y:h*.6,scale:.9,rotate:0,opacity:0}:{x:((still?.73:1.1)-anchorX)*w,y:still?0:.08*h,scale:still?1:.9,rotate:still?0:10,opacity:0};
    return {x:mobile?0:((side==='left'?.27:side==='center'?.5:.73)-anchorX)*w,y:mobile?0:(still?0:c.y*h),scale:mobile?1:(still?1:c.scale),rotate:mobile||still?0:c.rotate,opacity:1};
  }
  function paintCamera(scene,p,index){
    const w=innerWidth,h=innerHeight,mobile=w<=760;
    const base=Number.parseFloat(getComputedStyle(rig).getPropertyValue('--phone-base-scale'))||.85;
    if(exploring){rig.style.transform=`translate3d(${mobile?0:-.22*w}px,${mobile?-.13*h:0}px,0) scale(${base})`;rig.style.opacity='1';return;}
    const current=cameraFor(scene,mobile,w,h),prev=index?cameraFor(scenes[index-1],mobile,w,h):{...current,y:current.y+60,scale:current.scale*.92,rotate:current.rotate+4};
    const t=reduced.matches?1:smooth(p/.34);
    rig.style.transform=`translate3d(${lerp(prev.x,current.x,t).toFixed(2)}px,${lerp(prev.y,current.y,t).toFixed(2)}px,0) rotate(${lerp(prev.rotate,current.rotate,t).toFixed(3)}deg) scale(${(base*lerp(prev.scale,current.scale,t)).toFixed(4)})`;
    rig.style.opacity=lerp(prev.opacity,current.opacity,t).toFixed(3);
    if(glow)glow.style.transform=reduced.matches?'translateY(-50%)':`translate3d(${lerp(prev.x,current.x,t)*.32}px,calc(-50% + ${Math.sin((index+p)*.6)*35}px),0)`;
  }
  // Each pitch prop fades in with the chapter, then animates its figures across the chapter's progress.
  function paintDeck(scene,p){
    if(!deck)return;
    const enter=smooth(p/.25),exit=1-smooth((p-.86)/.14);
    deck.style.opacity=scene.deck?String(enter*exit):'0';
    deck.dataset.panel=scene.deck||'';
    deck.style.setProperty('--deck-enter',String(enter));
    const reveal=scene.deck?smooth((p-.1)/.55):0,second=scene.deck?smooth((p-.5)/.3):0;
    deck.style.setProperty('--deck-reveal',String(reveal));
    deck.style.setProperty('--deck-second',String(second));
    deck.style.transform=reduced.matches?'none':`translate3d(0,${(1-enter)*50}px,0) scale(${lerp(.94,1,enter)})`;
    deck.querySelectorAll('[data-reveal-at]').forEach(el=>{el.classList.toggle('shown',scene.deck&&p>=Number(el.dataset.revealAt)-1e-7);});
    deck.querySelectorAll('[data-count]').forEach(el=>{
      const at=Number(el.dataset.revealAt||0),span=Number(el.dataset.countSpan||.22),k=scene.deck?smooth((p-at)/span):0;
      const target=Number(el.dataset.count),decimals=Number(el.dataset.decimals||0);
      el.textContent=(el.dataset.prefix||'')+(target*k).toLocaleString('en-US',{minimumFractionDigits:decimals,maximumFractionDigits:decimals})+(el.dataset.suffix||'');
    });
  }
  function paintProps(scene,p){
    const receiptOn=scene.id==='receipt',earlyCards=scene.id==='groups'&&p>=.6,cardsOn=scene.id==='cards'||earlyCards;
    const enter=smooth(p/.25),exit=1-smooth((p-.82)/.18);
    if(receipt){receipt.style.opacity=receiptOn?String(enter*exit):'0';receipt.style.transform=reduced.matches?'none':`translate3d(${(1-enter)*80}px,${(1-enter)*90}px,0) rotate(${lerp(17,-8,enter)}deg) scale(${lerp(.85,1,enter)})`;receipt.dataset.scanning=receiptOn&&p>=1/3-1e-7&&p<2/3-1e-7?'true':'false';}
    const cardEnter=earlyCards?smooth((p-.6)/.12):enter;
    if(fan){fan.style.opacity=cardsOn?String(cardEnter*exit):'0';fan.style.setProperty('--fan-spread',cardsOn?String(cardEnter):'0');fan.style.transform=reduced.matches?'none':`translateY(${(1-cardEnter)*60}px) rotate(${(1-cardEnter)*8}deg)`;}
  }
  function render(){frame=0;if(!bounds.length)return;
    if(playing){playbackTime=clamp((performance.now()-clockStart)/1000,0,duration);if(playbackTime>=duration)playing=false;}
    if(timed&&!exploring){const position=positionAtTime(playbackTime);scrollToPosition(position);active=splitPosition(position);}else active=locate(scrollY);
    paintPlayback();const {index,progress:p}=active,scene=scenes[index];
    if(exploring){paintCamera(scene,p,index);if(deck)deck.style.opacity='0';return;}
    let phase=0;if(scene.phases)scene.phases.forEach((v,i)=>{if(p>=v.at-1e-7)phase=i;});
    if(lastScene!==index){document.body.dataset.scene=scene.id;document.body.dataset.tone=['cards','outro'].includes(scene.id)?'blue':'navy';document.body.dataset.copySide=reduced.matches?'left':scene.side;title.innerHTML=scene.title;kicker.textContent=scene.label;word.textContent=scene.word;dots.forEach((dot,i)=>{dot.classList.toggle('active',i===index);if(i===index)dot.setAttribute('aria-current','step');else dot.removeAttribute('aria-current');});lastPhase=-1;lastScene=index;}
    if(lastPhase!==phase){body.textContent=scene.phases?.[phase].body||scene.body;lastPhase=phase;}
    // Copy changes in the quiet interval while the phone crosses the stage.
    const fadeIn=index===0?1:smooth((p-.06)/.15),fadeOut=index===scenes.length-1?1:1-smooth((p-.88)/.12);
    copy.style.opacity=reduced.matches?'1':String(fadeIn*fadeOut);
    copy.style.setProperty('--copy-shift',`${reduced.matches?0:(1-fadeIn)*20-(1-fadeOut)*12}px`);
    bar.style.width=`${((index+p)/scenes.length*100).toFixed(3)}%`;
    stage.style.setProperty('--scene-progress',p);
    dots[index].style.setProperty('--chapter-progress',p);
    paintCamera(scene,p,index);paintProps(scene,p);paintDeck(scene,p);sendPhone(scene.id,p,forcePhone);forcePhone=false;
    if(playing)schedule();
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(render);}
  function seek(index,p=.32){index=clamp(index,0,scenes.length-1);if(exploring)setExplore(false);manualOverride();scrollTo({top:bounds[index].start+(bounds[index].end-bounds[index].start)*clamp(p),behavior:reduced.matches?'instant':'smooth'});}
  // Arrow keys step cue to cue, not scene to scene, so every beat inside a chapter gets its turn. The page
  // scrolls smoothly between cues, which plays the motion stops and prop animations on the way.
  function currentTime(){if(timed)return playbackTime;const p=locate(scrollY);return timeAtPosition(p.index+p.progress);}
  function seekCue(direction){
    if(exploring)setExplore(false);
    const now=currentTime(),gap=.05;
    // A cue at the top of a scene is where the phone starts crossing the stage and the copy is still hidden;
    // stop where the arrival has finished instead, so each press lands on a readable frame. If the scene's
    // next cue sits right there anyway, go straight to it rather than showing two near-identical frames.
    const landing=.3;
    const landingOf=cue=>{if(!cue)return null;if(cue.progress===0){const next=cues[cues.indexOf(cue)+1];if(next&&next.scene===cue.scene&&next.progress<=landing+.06)return landingOf(next);const index=scenes.findIndex(scene=>scene.id===cue.scene);return {index,progress:Math.max(splitPosition(positionAtTime(cue.time)).progress,landing)};}return splitPosition(positionAtTime(cue.time));};
    const timeOf=spot=>timeAtPosition(spot.index+spot.progress);
    let spot;
    if(direction>0){const cue=cues.find(cue=>timeOf(landingOf(cue))>now+gap);spot=cue?landingOf(cue):splitPosition(positionAtTime(duration));}
    else{const cue=[...cues].reverse().find(cue=>timeOf(landingOf(cue))<now-gap);spot=cue?landingOf(cue):{index:0,progress:0};}
    manualOverride();
    const {index,progress}=spot,b=bounds[index];
    scrollTo({top:b.start+(b.end-b.start)*progress,behavior:reduced.matches?'instant':'smooth'});
  }
  function setExplore(enabled){
    if(enabled===exploring)return;if(enabled)pause();exploring=enabled;document.body.dataset.mode=enabled?'explore':'story';
    phone.tabIndex=enabled?0:-1;
    if(enabled){savedPosition=locate(scrollY);document.body.style.overflow='hidden';}
    else{document.body.style.overflow='';const b=bounds[savedPosition.index];scrollTo({top:b.start+(b.end-b.start)*savedPosition.progress,behavior:'instant'});forcePhone=true;lastScene=-1;dots[savedPosition.index].focus({preventScroll:true});}
    if(ready)phone.contentWindow.postMessage({type:'chipin-story-explore',enabled},location.origin);
    schedule();
  }
  nav.addEventListener('click',e=>{const button=e.target.closest('[data-chapter]');if(button)seek(Number(button.dataset.chapter));});
  addEventListener('scroll',onScroll,{passive:true});addEventListener('resize',measure,{passive:true});
  addEventListener('wheel',manualOverride,{passive:true});addEventListener('touchstart',manualOverride,{passive:true});
  addEventListener('keydown',e=>{
    if(e.key==='Escape'&&exploring){setExplore(false);return;}
    if(exploring||e.defaultPrevented||e.altKey||e.metaKey||e.ctrlKey||e.shiftKey||e.target.isContentEditable||e.target.closest?.('input,textarea,select,[contenteditable],[role="textbox"]')||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;
    if(e.code==='Space'||e.key===' '){
      if(e.target.closest?.('button,a,summary,[role="button"]'))return;
      e.preventDefault();if(!e.repeat)togglePlayback();return;
    }
    if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();if(!e.repeat)seekCue(e.key==='ArrowRight'?1:-1);}
    else if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End'].includes(e.key))manualOverride();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  function phoneReady(){ready=true;forcePhone=true;if(exploring)phone.contentWindow.postMessage({type:'chipin-story-explore',enabled:true},location.origin);schedule();}
  addEventListener('message',e=>{if(e.source!==phone.contentWindow||e.origin!==location.origin)return;if(e.data?.type==='chipin-story-ready')phoneReady();if(e.data?.type==='chipin-story-exit-explore')setExplore(false);});
  phone.addEventListener('load',phoneReady);
  reduced.addEventListener('change',()=>{lastScene=-1;measure();});
  document.body.dataset.mode='story';measure();
  window.chipinStoryTimeline={scenes,cues,duration,seek,seekCue,seekTime,setExplore,play,pause,togglePlayback,positionAtTime,timeAtPosition,getState:()=>({...active,exploring,playing,time:playbackTime,duration})};
})();
