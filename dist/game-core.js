/* ORBIT SHIFT — deterministic, renderer-independent game rules. */
(function(root){
  'use strict';
  const DURATION=60, SWITCH_TIME=.14, SPAWN_ANGLE=3.85;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function random(seed){let s=seed>>>0||1;return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
  class Game {
    constructor(seed=Date.now()){this.rng=random(seed);this.state='ready';this.reset();}
    reset(){this.elapsed=0;this.score=0;this.lives=3;this.lane=1;this.laneMix=1;this.fromLane=1;this.switchLeft=0;this.invincible=0;this.rows=[];this.events=[];this.combo=0;this.maxCombo=0;this.pickups=0;this.misses=0;this.hits=0;this.nextSpawn=.55;this.rowId=0;this.lastHazard=0;this.streak=0;this.endReason=null;this.lastPhase=0;this.lastSecond=-1;this.finishBonus=0;}
    start(){this.reset();this.state='playing';this.events.push({type:'start'});}
    toggle(){if(this.state!=='playing'||this.switchLeft>0)return false;this.fromLane=this.laneMix;this.lane=1-this.lane;this.switchLeft=SWITCH_TIME;this.events.push({type:'switch',lane:this.lane});return true;}
    pause(){if(this.state!=='playing')return false;this.state='paused';return true;}
    resume(){if(this.state!=='paused')return false;this.state='playing';return true;}
    home(){this.state='ready';this.reset();}
    get speed(){return 1.7+.9*(this.elapsed/DURATION);}
    get phase(){return this.elapsed<20?0:this.elapsed<40?1:2;}
    get multiplier(){return Math.min(5,1+Math.floor(this.combo/6));}
    get remaining(){return Math.max(0,DURATION-this.elapsed);}
    spawn(){
      let hazard;
      if(this.rowId<2)hazard=0;
      else {hazard=this.rng()<.5?0:1;if(this.streak>=2)hazard=1-this.lastHazard;}
      this.streak=hazard===this.lastHazard?this.streak+1:1;this.lastHazard=hazard;
      const row={id:++this.rowId,a:SPAWN_ANGLE,hazard,hit:false,passed:false,points:0,coins:[-.18,0,.18].map(offset=>({offset,collected:false,missed:false}))};
      this.rows.push(row);
      const rhythm=this.phase===0?[1.04,.94,1.04,1.14]:this.phase===1?[.83,.78,.94,.78]:[.66,.64,.8,.64];
      this.nextSpawn+=rhythm[(this.rowId-1)%rhythm.length];
    }
    step(dt){
      if(this.state!=='playing'||!Number.isFinite(dt)||dt<=0)return;
      let left=Math.min(dt,.5);
      while(left>1e-8&&this.state==='playing'){const s=Math.min(left,1/120);this.tick(s);left-=s;}
    }
    tick(dt){
      this.elapsed=Math.min(DURATION,this.elapsed+dt);
      if(this.switchLeft>0){this.switchLeft=Math.max(0,this.switchLeft-dt);const t=1-this.switchLeft/SWITCH_TIME,ease=t*t*(3-2*t);this.laneMix=this.fromLane+(this.lane-this.fromLane)*ease;}else this.laneMix=this.lane;
      this.invincible=Math.max(0,this.invincible-dt);
      if(this.phase!==this.lastPhase){this.lastPhase=this.phase;this.events.push({type:'phase',phase:this.phase});}
      const second=Math.ceil(this.remaining);if(second<=5&&second>0&&second!==this.lastSecond){this.lastSecond=second;this.events.push({type:'countdown',second});}
      if(this.elapsed>=this.nextSpawn&&this.remaining>1.7)this.spawn();
      for(const row of this.rows){
        row.a-=this.speed*dt;
        if(!row.hit&&Math.abs(row.a)<.155&&Math.abs(this.laneMix-row.hazard)<.47&&this.invincible===0){
          row.hit=true;this.lives--;this.hits++;this.combo=0;this.invincible=1.05;this.events.push({type:'hit',lane:row.hazard});
          if(this.lives<=0){this.finish('crash');return;}
        }
        for(const coin of row.coins){
          if(coin.collected||coin.missed)continue;
          const angle=row.a+coin.offset;
          if(Math.abs(angle)<.095&&Math.abs(this.laneMix-(1-row.hazard))<.4){
            coin.collected=true;this.combo++;this.pickups++;this.maxCombo=Math.max(this.maxCombo,this.combo);const value=10*this.multiplier;this.score+=value;row.points=(row.points||0)+value;
            this.events.push({type:'collect',lane:1-row.hazard,value,rowPoints:row.points,lastInRow:coin===row.coins[row.coins.length-1],combo:this.combo,multiplier:this.multiplier});
            if(this.combo%6===0)this.events.push({type:'combo',combo:this.combo,multiplier:this.multiplier});
          }else if(angle<-.12){coin.missed=true;this.misses++;if(this.combo>0){this.combo=0;this.events.push({type:'miss'});}}
        }
        if(!row.passed&&row.a<-.2){row.passed=true;if(!row.hit){this.score+=5;this.events.push({type:'pass'});}}
      }
      this.rows=this.rows.filter(row=>row.a>-1.1);
      if(this.elapsed>=DURATION)this.finish('complete');
    }
    finish(reason){if(this.state!=='playing')return;this.endReason=reason;this.state='ended';if(reason==='complete'){this.finishBonus=300+this.lives*100;this.score+=this.finishBonus;}this.events.push({type:'end',reason,bonus:this.finishBonus});}
    takeEvents(){const events=this.events;this.events=[];return events;}
    snapshot(){return{state:this.state,score:this.score,remaining:Number(this.remaining.toFixed(1)),lives:this.lives,lane:this.lane===0?'inner':'outer',combo:this.combo,maxCombo:this.maxCombo,pickups:this.pickups,endReason:this.endReason};}
  }
  root.OrbitCore={Game,random,DURATION,SWITCH_TIME,SPAWN_ANGLE,clamp};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.OrbitCore;
})(typeof globalThis==='object'?globalThis:window);
