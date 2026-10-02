(()=>{
  'use strict';
  const $=id=>document.getElementById(id),canvas=$('game-canvas'),ctx=canvas.getContext('2d'),arena=$('arena');
  if(!ctx){$('start-button').disabled=true;$('start-button').textContent='このブラウザではCanvasを利用できません';return;}
  const {Game,clamp}=OrbitCore,game=new Game(),TAU=Math.PI*2,TOP=-Math.PI/2;
  const mint='#90ffe0',red='#ff6476',gold='#f5dd8c';
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const font=getComputedStyle(document.body).fontFamily;
  let width=0,height=0,dpr=1,cx=0,cy=0,radius=0,background=null,displayTime=0,last=0,lastHud=-1;
  let particles=[],ripples=[],floaters=[],trail=[],flash=0,shake=0,cueUntil=0,clickUntil=0,spark=0,best=0,muted=false,musicBeat=-1;
  let audio=null,audioMaster=null,recordAvailable=true,frameId=0,idleAt=0;
  try {const n=Number(localStorage.getItem('orbit-shift-best-v1'));best=Number.isFinite(n)?Math.max(0,Math.floor(n)):0;muted=localStorage.getItem('orbit-shift-muted-v1')==='true';}catch{recordAvailable=false;}
  function storage(key,value){try{localStorage.setItem(key,String(value));return true;}catch{return false;}}
  function initAudio(){if(audio)return;try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;audio=new Audio();audioMaster=audio.createGain();audioMaster.gain.value=muted?0:.16;audioMaster.connect(audio.destination);}catch{audio=null;}}
  function wakeAudio(){initAudio();if(audio?.state==='suspended')audio.resume().catch(()=>{});}
  function tone(freq,duration=.1,type='sine',volume=.4,delay=0,endFreq){if(!audio||audio.state!=='running'||muted)return;try{const at=audio.currentTime+delay,osc=audio.createOscillator(),gain=audio.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,at);if(endFreq)osc.frequency.exponentialRampToValueAtTime(endFreq,at+duration);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume,at+.006);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);osc.connect(gain);gain.connect(audioMaster);osc.start(at);osc.stop(at+duration+.02);osc.onended=()=>{osc.disconnect();gain.disconnect();};}catch{}}
  function sound(type,value=0){if(type==='switch'){tone(250,.075,'sine',.3,0,420);}if(type==='collect'){const scale=[523.25,659.25,783.99,1046.5,1318.5,1568];tone(scale[value%6],.13,'sine',.3);}if(type==='hit'){tone(100,.25,'sawtooth',.3,0,35);tone(65,.32,'triangle',.6);}if(type==='combo'){tone(523,.15,'triangle',.3);tone(784,.18,'triangle',.28,.07);tone(1046,.2,'sine',.28,.14);}if(type==='start'){[392,523,784].forEach((f,i)=>tone(f,.2,'sine',.32,i*.075));}if(type==='end'){const notes=value?[523,659,784,1046]:[392,294,196];notes.forEach((f,i)=>tone(f,.3,'triangle',.32,i*.1));}if(type==='countdown')tone(880,.07,'sine',.25);}
  function updateSoundButton(){$('sound-button').classList.toggle('is-muted',muted);$('sound-button').setAttribute('aria-pressed',String(muted));$('sound-button').setAttribute('aria-label',muted?'音をオンにする':'音をオフにする');}
  function toggleSound(){wakeAudio();muted=!muted;if(audioMaster)audioMaster.gain.setTargetAtTime(muted?0:.16,audio.currentTime,.03);storage('orbit-shift-muted-v1',muted);updateSoundButton();if(!muted)tone(660,.12,'sine',.25);}
  function cue(text,seconds=1.7,color=mint){$('cue').textContent=text;$('cue').style.color=color;$('cue').classList.add('show');cueUntil=displayTime+seconds;}
  function announce(text){$('announcement').textContent=text;}
  function overlays(state){$('start-screen').hidden=state!=='ready';$('pause-screen').hidden=state!=='paused';$('result-screen').hidden=state!=='ended';$('pause-button').disabled=state==='ready'||state==='ended';$('pause-button').setAttribute('aria-label',state==='paused'?'ゲームを再開する':'一時停止');$('switch-button').disabled=state!=='playing';arena.style.cursor=state==='playing'?'pointer':'default';}
  function resetEffects(){particles=[];ripples=[];floaters=[];trail=[];flash=0;shake=0;spark=0;musicBeat=-1;lastHud=-1;}
  function start(){wakeAudio();game.start();resetEffects();overlays('playing');clickUntil=displayTime+.2;cue('SPACE / クリックで軌道を切り替える',2.7);announce('ゲーム開始。60秒間、赤をよけて光を集めてください。');document.activeElement?.blur();last=0;updateHud(true);}
  function toggle(){if(game.toggle()){wakeAudio();ripples.push({x:cx,y:cy-playerRadius(),r:8,life:.4,max:.4,color:mint});}}
  function pause(automatic=false){if(!game.pause())return;overlays('paused');$('pause-description').textContent=automatic?'画面を離れたので、一時停止しました。':'準備ができたら、軌道に戻ろう。';$('cue').classList.remove('show');announce('一時停止');$('resume-button').focus({preventScroll:true});}
  function resume(){if(!game.resume())return;wakeAudio();overlays('playing');last=0;clickUntil=displayTime+.2;document.activeElement?.blur();announce('ゲーム再開');}
  function home(){game.home();resetEffects();overlays('ready');$('cue').classList.remove('show');updateHud(true);$('start-button').focus({preventScroll:true});}
  function handleMain(){if(game.state==='ready'||game.state==='ended')start();else if(game.state==='paused')resume();else toggle();}
  function result(){
    const previousBest=best,isBest=game.score>best;if(isBest){best=game.score;recordAvailable=storage('orbit-shift-best-v1',best);}
    const complete=game.endReason==='complete';
    $('result-eyebrow').textContent=complete?'60 SECONDS COMPLETE':'END OF ORBIT';
    $('result-title').textContent=complete?(game.hits===0?'PERFECT ORBIT.':'NICE ORBIT.'):'ONE MORE SHIFT?';
    $('result-note').textContent=complete?`60秒完走！ 完走ボーナス +${game.finishBonus}`:(game.elapsed<15?'赤が近づいたら、もう片方の軌道へ。':'次の光を見て、ひとつ先の軌道へ。');
    $('result-score').textContent=game.score.toLocaleString('ja-JP');$('result-pickups').textContent=game.pickups;$('result-combo').textContent=game.maxCombo;$('result-time').textContent=`${game.elapsed.toFixed(1)}秒`;
    $('new-record').hidden=!isBest;$('new-record').textContent=recordAvailable?'NEW PERSONAL BEST':'NEW BEST · 今回のプレイ中のみ';
    overlays('ended');$('cue').classList.remove('show');updateHud(true);sound('end',complete?1:0);announce(`${complete?'60秒完走':'ゲーム終了'}。スコア${game.score}、最大コンボ${game.maxCombo}${isBest&&previousBest>0?'。自己ベスト更新':''}`);$('retry-button').focus({preventScroll:true});
    if(complete&&!reducedMotion){for(let i=0;i<3;i++)burst(cx+(i-1)*radius*.45,cy-radius*.4,mint,24);}
  }
  function updateHud(force=false){if(!force&&displayTime-lastHud<.08)return;lastHud=displayTime;$('score').textContent=String(game.score).padStart(5,'0');const t=game.remaining.toFixed(1).split('.');$('time').innerHTML=`${t[0]}<span>.${t[1]}</span>`;$('time').style.color=game.remaining<=10&&game.state!=='ready'?gold:'';$('best').textContent=String(best).padStart(5,'0');$('combo').textContent=game.combo>0?`${game.combo} COMBO · ×${game.multiplier}`:'光を集めよう';$('combo').classList.toggle('active',game.combo>0);$('lives').setAttribute('aria-label',`ライフ ${game.lives}`);Array.from($('lives').children).forEach((i,n)=>i.classList.toggle('lost',n>=game.lives));$('phase').textContent=game.state==='ready'?'READY TO ORBIT':['01 / FIND YOUR FLOW','02 / PICK UP THE PACE','03 / INTO THE ZONE'][game.phase];$('time-fill').style.transform=`scaleX(${game.remaining/60})`;}
  function playerRadius(){return radius*(.72+.28*game.laneMix);}
  function point(angle,r){return{x:cx+Math.cos(TOP+angle)*r,y:cy+Math.sin(TOP+angle)*r};}
  function burst(x,y,color,count=10){if(reducedMotion)count=3;for(let i=0;i<count;i++){const a=Math.random()*TAU,v=30+Math.random()*130;particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.25+Math.random()*.4,max:.65,size:1+Math.random()*2,color});}if(particles.length>180)particles.splice(0,particles.length-180);}
  function events(){for(const e of game.takeEvents()){
    if(e.type==='start')sound('start');
    if(e.type==='switch')sound('switch');
    if(e.type==='collect'){const p=point(0,radius*(e.lane===0?.72:1));burst(p.x,p.y,mint,6);spark=.2;sound('collect',e.combo);if(e.lastInRow){floaters.push({x:p.x+22,y:p.y-14,text:`+${e.rowPoints}`,life:.65,color:mint});}}
    if(e.type==='combo'&&(e.combo<=24||e.combo%30===0)){sound('combo');cue(e.combo<=24?`×${e.multiplier} COMBO`:`${e.combo} COMBO`,1.1);ripples.push({x:cx,y:cy,r:radius*.38,life:.65,max:.65,color:mint});}
    if(e.type==='hit'){flash=.32;shake=reducedMotion?0:.28;sound('hit');burst(cx,cy-playerRadius(),red,20);cue('HIT · ライフ −1',1.2,red);announce(`障害物に接触。残りライフ${game.lives}`);}
    if(e.type==='phase'){cue(e.phase===1?'テンポアップ':'ラスト20秒',1.8,e.phase===2?gold:mint);sound('combo');}
    if(e.type==='countdown')sound('countdown');
    if(e.type==='end')result();
  }}
  const stars=Array.from({length:60},()=>({x:Math.random(),y:Math.random(),a:.12+Math.random()*.35,r:Math.random()>.88?1.1:.55}));
  function resize(){const box=canvas.getBoundingClientRect();width=box.width;height=box.height;dpr=Math.min(window.devicePixelRatio||1,1.75);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);cx=width/2;cy=height*.55;radius=Math.min(width*.36,height*.355);background=document.createElement('canvas');background.width=canvas.width;background.height=canvas.height;const bg=background.getContext('2d');bg.scale(dpr,dpr);const gradient=bg.createRadialGradient(cx,cy,0,cx,cy,radius*1.9);gradient.addColorStop(0,'#102531');gradient.addColorStop(.55,'#0c1926');gradient.addColorStop(1,'#0b1320');bg.fillStyle=gradient;bg.fillRect(0,0,width,height);for(const star of stars){bg.fillStyle=`rgba(129,184,195,${star.a})`;bg.beginPath();bg.arc(star.x*width,star.y*height,star.r,0,TAU);bg.fill();}trail=[];draw();}
  function arc(r,start,end,color,line=1,alpha=1){ctx.globalAlpha=alpha;ctx.beginPath();ctx.arc(cx,cy,r,TOP+start,TOP+end);ctx.strokeStyle=color;ctx.lineWidth=line;ctx.stroke();ctx.globalAlpha=1;}
  function dot(p,r,color,alpha=1){ctx.globalAlpha=alpha;ctx.beginPath();ctx.arc(p.x,p.y,r,0,TAU);ctx.fillStyle=color;ctx.fill();ctx.globalAlpha=1;}
  function obstacle(a,lane,alpha=1){const r=radius*(lane===0?.72:1),w=radius<140?11:15;ctx.lineCap='round';arc(r,a-.075,a+.075,'#ff647619',w+12,alpha);arc(r,a-.075,a+.075,red,w,alpha);arc(r,a-.055,a+.055,'#ffa5ae',2,alpha*.65);ctx.lineCap='butt';}
  function coin(a,lane,alpha=1){const r=radius*(lane===0?.72:1),p=point(a,r),s=radius<140?3.2:4.2;dot(p,s+5,'#90ffe015',alpha);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(TOP+a+Math.PI/4);ctx.globalAlpha=alpha;ctx.fillStyle=mint;ctx.fillRect(-s,-s,s*2,s*2);ctx.restore();}
  function draw(){if(!width||!background)return;ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.drawImage(background,0,0);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.save();if(shake>0){ctx.translate((Math.random()-.5)*shake*18,(Math.random()-.5)*shake*18);}
    const ready=game.state==='ready';
    for(let i=0;i<60;i++){const a=TAU*i/60,r=radius*1.16,p=point(a,r),q=point(a,r+(i%5===0?6:3));ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.strokeStyle=i%5===0?'#314b59':'#1c3340';ctx.lineWidth=1;ctx.stroke();}
    arc(radius*1.1,0,TAU,'#18303c',1,.8);
    [radius*.72,radius].forEach((r,i)=>{arc(r,0,TAU,'#162d39',25,1);arc(r,0,TAU,'#2c4652',1,1);ctx.setLineDash([2,11]);ctx.lineDashOffset=displayTime*13;arc(r,0,TAU,'#496371',1,.3);ctx.setLineDash([]);arc(r,-.25,.25,'#90ffe0',1,(1-Math.abs(game.laneMix-i))*.6);});
    if(!ready){ctx.beginPath();ctx.moveTo(cx,cy-radius*1.085);ctx.lineTo(cx,cy-radius*.625);ctx.strokeStyle='#90ffe023';ctx.lineWidth=1;ctx.stroke();dot({x:cx,y:cy-radius*1.12},2,mint,.7);}
    if(!ready){for(const row of game.rows){const alpha=clamp((3.85-row.a)/.35,0,1)*(row.a<-.25?clamp(1-(-row.a-.25)/.65,0,1):1);if(!row.hit)obstacle(row.a,row.hazard,alpha);for(const c of row.coins)if(!c.collected&&!c.missed)coin(row.a+c.offset,1-row.hazard,alpha);}}
    ctx.globalAlpha=1;
    if(!ready){
      arc(radius*.41,0,TAU,'#1f3641',2,.8);arc(radius*.41,0,TAU*(game.remaining/60),game.remaining<=10?gold:'#587f84',2,.55);
      ctx.textAlign='center';ctx.fillStyle=game.combo>=6?mint:'#c5d6df';ctx.font=`500 ${Math.max(24,radius*.21)}px ${font}`;ctx.fillText(`×${game.multiplier}`,cx,cy+5);ctx.fillStyle='#718c9e';ctx.font='12px Arial,sans-serif';ctx.fillText(game.combo?`${game.combo} COMBO`:'KEEP YOUR FLOW',cx,cy+25);
      const r=playerRadius(),blink=game.invincible>0&&Math.floor(displayTime*13)%2===0;
      if(!blink){for(let i=trail.length-1;i>=0;i--){const t=trail[i];dot({x:cx-((trail.length-1-i)*2.7),y:cy-t.r+((trail.length-1-i)*.17)},Math.max(1,5.5*(i/trail.length)),mint,(i/trail.length)*.26);}dot({x:cx,y:cy-r},15+(spark>0?spark*20:0),'#90ffe00b');dot({x:cx,y:cy-r},10,'#90ffe025');dot({x:cx,y:cy-r},6.5,mint);dot({x:cx+1,y:cy-r-1},2.5,'#eafff8');}
    }else{dot(point(displayTime*.24,radius),6,mint,.55);}
    for(const p of particles)dot(p,p.size,p.color,clamp(p.life/p.max,0,1));
    for(const r of ripples){const alpha=r.life/r.max;ctx.globalAlpha=alpha*.4;ctx.beginPath();ctx.arc(r.x,r.y,r.r+(1-alpha)*55,0,TAU);ctx.strokeStyle=r.color;ctx.lineWidth=1;ctx.stroke();ctx.globalAlpha=1;}
    ctx.textAlign='center';ctx.font='600 13px Arial,sans-serif';for(const f of floaters){ctx.globalAlpha=clamp(f.life/.4,0,1);ctx.fillStyle=f.color;ctx.fillText(f.text,f.x,f.y);}ctx.globalAlpha=1;ctx.restore();
    if(flash>0){ctx.fillStyle=`rgba(255,100,118,${flash*.26})`;ctx.fillRect(0,0,width,height);}
  }
  function frame(now){
    frameId=0;
    if(document.hidden){last=0;return;}
    if(game.state!=='playing'&&now-idleAt<32){frameId=requestAnimationFrame(frame);return;}
    idleAt=now;
    let dt=last?Math.max(0,(now-last)/1000):0;last=now;if(dt>1&&game.state==='playing'){pause(true);dt=0;}dt=Math.min(dt,.15);displayTime+=dt;
    if(game.state==='playing')game.step(dt);events();
    if(game.state!=='paused'){
      flash=Math.max(0,flash-dt);shake=Math.max(0,shake-dt);spark=Math.max(0,spark-dt);for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.exp(-dt*2);p.vy*=Math.exp(-dt*2);p.life-=dt;}particles=particles.filter(p=>p.life>0);for(const r of ripples)r.life-=dt;ripples=ripples.filter(r=>r.life>0);for(const f of floaters){f.y-=dt*35;f.life-=dt;}floaters=floaters.filter(f=>f.life>0);
      if(game.state==='playing'&&!reducedMotion){trail.push({r:playerRadius()});if(trail.length>15)trail.shift();}
    }
    if(cueUntil&&displayTime>cueUntil){$('cue').classList.remove('show');cueUntil=0;}
    if(game.state==='playing'&&audio&&!muted){const beat=Math.floor(game.elapsed/(game.phase===0?.52:game.phase===1?.43:.36));if(beat!==musicBeat){musicBeat=beat;const notes=[65.4,65.4,82.4,98];tone(notes[Math.floor(beat/4)%4],.12,'sine',.13);if(beat%4===2)tone(196,.045,'triangle',.06);}}
    updateHud();draw();frameId=requestAnimationFrame(frame);
  }
  $('start-button').addEventListener('click',start);$('retry-button').addEventListener('click',start);$('restart-button').addEventListener('click',start);$('resume-button').addEventListener('click',resume);$('home-button').addEventListener('click',home);$('sound-button').addEventListener('click',toggleSound);$('pause-button').addEventListener('click',()=>game.state==='paused'?resume():pause());$('switch-button').addEventListener('click',toggle);
  document.querySelector('.wordmark').addEventListener('click',e=>{e.preventDefault();if(game.state==='playing')pause();else home();});
  arena.addEventListener('pointerdown',e=>{if(game.state!=='playing'||e.target.closest('button')||displayTime<clickUntil)return;e.preventDefault();toggle();});
  window.addEventListener('keydown',e=>{if(e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;if(e.code==='Space'){e.preventDefault();handleMain();}else if(e.code==='Escape'||e.code==='KeyP'){e.preventDefault();if(game.state==='playing')pause();else if(game.state==='paused')resume();}else if(e.code==='KeyM'){e.preventDefault();toggleSound();}else if(e.code==='Enter'&&game.state==='playing'&&e.target===document.body){e.preventDefault();toggle();}});
  document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(frameId);frameId=0;last=0;if(document.hidden){pause(true);if(audio?.state==='running')audio.suspend().catch(()=>{});}else frameId=requestAnimationFrame(frame);});
  let resizeFrame=0;new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(resize);}).observe(arena);
  if(!recordAvailable)document.querySelector('.page-footer span:last-child').textContent='自己ベストは、今回のプレイ中に記録。';
  updateSoundButton();updateHud(true);resize();frameId=requestAnimationFrame(frame);
  if(document.modelContext?.registerTool){
    const lifecycle=new AbortController(),empty={type:'object',properties:{},additionalProperties:false};
    function validate(input){if(input===null||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new Error('引数には空のオブジェクトを指定してください。');}
    const tools=[
      {name:'read_orbit_game',title:'ゲームの状態を見る',description:'現在のスコア、ライフ、軌道、残り時間を返す。',inputSchema:empty,annotations:{readOnlyHint:true,untrustedContentHint:false},execute(input){validate(input);return game.snapshot();}},
      {name:'start_orbit_game',title:'ゲームを始める',description:'タイトルまたは結果画面から、新しい60秒のゲームを開始する。',inputSchema:empty,annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){validate(input);if(game.state!=='ready'&&game.state!=='ended')throw new Error('現在のゲームを終了してから開始してください。');start();return game.snapshot();}},
      {name:'switch_orbit',title:'軌道を切り替える',description:'プレイ中の内側と外側の軌道を切り替える。',inputSchema:empty,annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){validate(input);if(game.state!=='playing')throw new Error('プレイ中にのみ軌道を切り替えられます。');if(game.switchLeft>0)throw new Error('切り替え中です。');toggle();return game.snapshot();}},
      {name:'pause_orbit_game',title:'一時停止する',description:'プレイ中のゲームを一時停止する。',inputSchema:empty,annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){validate(input);if(game.state!=='playing')throw new Error('プレイ中にのみ一時停止できます。');pause();return game.snapshot();}},
      {name:'resume_orbit_game',title:'ゲームを再開する',description:'一時停止しているゲームを再開する。',inputSchema:empty,annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){validate(input);if(game.state!=='paused')throw new Error('一時停止中にのみ再開できます。');resume();return game.snapshot();}}
    ];
    for(const tool of tools){try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  }
})();
