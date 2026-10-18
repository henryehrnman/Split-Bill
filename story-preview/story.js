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
    {time:65,scene:'outro',progress:0,label:'Just chipin'}
  ];
  const duration=68;
  const motionStops=[
    [1.6,'intro',.75],[3,'groups',.3],[7.9,'groups',.88],
    [9.4,'budget',.34],[12,'budget',.5],[18.6,'invite',.88],
    [20,'cards',.34],[21.7,'cards',.88],[23,'pay',.34],[28.7,'pay',.88],
    [39.5,'split',.88],[41,'henry',.34],[49.5,'henry',.88],
    [50.7,'receipt',.25],[54,'receipt',2/3],[54.8,'receipt',.95],
    [56.5,'claims',1/3],[58,'claims',2/3],[59.6,'claims',.95],
    [60.9,'clarity',.34],[62,'clarity',.6],[64,'clarity',.9],
    [66,'outro',.34],[duration,'outro',1]
  ];
  const timeline=[...cues,...motionStops.map(([time,scene,progress])=>({time,scene,progress}))]
    .map(stop=>({...stop,position:scenes.findIndex(scene=>scene.id===stop.scene)+stop.progress}))
    .sort((a,b)=>a.time-b.time);
  scenes[1].phases=[{at:0,body:scenes[1].body},{at:.6,body:'One shared fund, with a card for every member.'}];
  scenes[3].phases=[{at:0,body:'Invite Henry, Maya, and Jordan to the apartment fund.'},{at:1/3,body:'Everyone reviews the $500 monthly budget and their $125 contribution before agreeing.'},{at:2/3,body:'$125 each. Four approved contributions. $500 ready to spend.'}];
  scenes[6].phases=[{at:0,body:'The purchase is already paid. The buyer proposes how to split it.'},{at:.24,body:'An even split by default: $16 for each of the four members.'},{at:.5,body:scenes[6].phases[1].body}];
  scenes[7].phases[0].body='There’s an easier way to work out dinner. Meet Henry.';
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
  function formatTime(time){return `${Math.floor(time/60)}:${String(Math.floor(time%60)).padStart(2,'0')}`;}
  function paintPlayback(){
    const toggle=$('playback-toggle'),label=$('playback-label'),icon=$('playback-icon'),timer=$('playback-time');
    document.body.dataset.playing=String(playing);
    if(toggle){toggle.setAttribute('aria-pressed',String(playing));toggle.setAttribute('aria-label',playing?'Pause story':'Play story');}
    const labelText=playing?'Pause story':'Play story',iconText=playing?'Ⅱ':'▶',timeText=`${formatTime(playbackTime)} / ${formatTime(duration)}`;
    if(label&&label.textContent!==labelText)label.textContent=labelText;
    if(icon&&icon.textContent!==iconText)icon.textContent=iconText;
    if(timer&&timer.textContent!==timeText)timer.textContent=timeText;
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
    if(exploring){paintCamera(scene,p,index);return;}
    let phase=0;if(scene.phases)scene.phases.forEach((v,i)=>{if(p>=v.at-1e-7)phase=i;});
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
    if(playing)schedule();
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(render);}
  function seek(index,p=.32){index=clamp(index,0,scenes.length-1);if(exploring)setExplore(false);manualOverride();scrollTo({top:bounds[index].start+(bounds[index].end-bounds[index].start)*clamp(p),behavior:reduced.matches?'instant':'smooth'});}
  function setExplore(enabled){
    if(enabled===exploring)return;if(enabled)pause();exploring=enabled;document.body.dataset.mode=enabled?'explore':'story';
    $('explore-toggle').textContent=enabled?'Back to story':'Explore the app';$('explore-toggle').setAttribute('aria-pressed',String(enabled));
    phone.tabIndex=enabled?0:-1;
    if(enabled){savedPosition=locate(scrollY);document.body.style.overflow='hidden';}
    else{document.body.style.overflow='';const b=bounds[savedPosition.index];scrollTo({top:b.start+(b.end-b.start)*savedPosition.progress,behavior:'instant'});forcePhone=true;lastScene=-1;$('explore-toggle').focus({preventScroll:true});}
    if(ready)phone.contentWindow.postMessage({type:'chipin-story-explore',enabled},location.origin);
    schedule();
  }
  nav.addEventListener('click',e=>{const button=e.target.closest('[data-chapter]');if(button)seek(Number(button.dataset.chapter));});
  $('replay').addEventListener('click',()=>seekTime(0));
  $('playback-toggle')?.addEventListener('click',togglePlayback);
  $('explore-toggle').addEventListener('click',()=>setExplore(!exploring));
  addEventListener('scroll',onScroll,{passive:true});addEventListener('resize',measure,{passive:true});
  addEventListener('wheel',manualOverride,{passive:true});addEventListener('touchstart',manualOverride,{passive:true});
  addEventListener('keydown',e=>{
    if(e.key==='Escape'&&exploring){setExplore(false);return;}
    if(exploring||e.defaultPrevented||e.altKey||e.metaKey||e.ctrlKey||e.shiftKey||e.target.isContentEditable||e.target.closest?.('input,textarea,select,[contenteditable],[role="textbox"]')||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;
    if(e.code==='Space'||e.key===' '){
      if(e.target.closest?.('button,a,summary,[role="button"]'))return;
      e.preventDefault();if(!e.repeat)togglePlayback();return;
    }
    if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();if(!e.repeat)seek(active.index+(e.key==='ArrowRight'?1:-1));}
    else if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End'].includes(e.key))manualOverride();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  function phoneReady(){ready=true;forcePhone=true;if(exploring)phone.contentWindow.postMessage({type:'chipin-story-explore',enabled:true},location.origin);schedule();}
  addEventListener('message',e=>{if(e.source!==phone.contentWindow||e.origin!==location.origin)return;if(e.data?.type==='chipin-story-ready')phoneReady();if(e.data?.type==='chipin-story-exit-explore')setExplore(false);});
  phone.addEventListener('load',phoneReady);
  reduced.addEventListener('change',()=>{lastScene=-1;measure();});
  document.body.dataset.mode='story';$('explore-toggle').setAttribute('aria-pressed','false');measure();
  window.chipinStoryTimeline={scenes,cues,duration,seek,seekTime,setExplore,play,pause,togglePlayback,positionAtTime,timeAtPosition,getState:()=>({...active,exploring,playing,time:playbackTime,duration})};
})();
