'use strict';
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const {Game}=require('../dist/game-core.js');
let checks=0;
function test(name,run){run();checks++;console.log('PASS '+name);}
function safeStep(g,dt){const row=g.rows.find(r=>r.a>.28&&r.a<.68&&!r.passed);if(row&&g.lane!==1-row.hazard)g.toggle();g.step(dt);g.takeEvents();}
function safeRun(seed,dt=1/60){const g=new Game(seed);g.start();let frames=0,maxRows=0;while(g.state==='playing'&&frames++<10000){safeStep(g,dt);maxRows=Math.max(maxRows,g.rows.length);}return{g,maxRows,frames};}
test('開始・切り替え・リセット',()=>{const g=new Game(1);assert.equal(g.state,'ready');assert.equal(g.toggle(),false);g.start();assert.equal(g.lives,3);assert.equal(g.lane,1);assert.equal(g.toggle(),true);assert.equal(g.toggle(),false);g.step(.15);assert.equal(g.laneMix,0);assert.equal(g.toggle(),true);g.home();assert.equal(g.state,'ready');assert.equal(g.score,0);assert.equal(g.rows.length,0);assert.equal(g.lane,1);});
test('一時停止中は時間・得点・位置が変化しない',()=>{const g=new Game(4);g.start();g.step(.5);g.pause();const before=JSON.stringify(g.snapshot());for(let i=0;i<400;i++)g.step(.1);assert.equal(JSON.stringify(g.snapshot()),before);assert.equal(g.toggle(),false);assert.equal(g.resume(),true);g.step(.1);assert.ok(g.elapsed>.5);});
test('静止プレイは衝突判定で終了する',()=>{const g=new Game(10);g.start();for(let i=0;i<3600&&g.state==='playing';i++)g.step(1/60);assert.equal(g.state,'ended');assert.equal(g.endReason,'crash');assert.equal(g.lives,0);assert.equal(g.hits,3);const s=g.score;g.step(.5);assert.equal(g.score,s);});
test('60秒完走・コンボ上限・完走ボーナス',()=>{const {g}=safeRun(43);assert.equal(g.endReason,'complete');assert.equal(g.elapsed,60);assert.equal(g.remaining,0);assert.equal(g.lives,3);assert.equal(g.hits,0);assert.equal(g.multiplier,5);assert.equal(g.finishBonus,600);assert.ok(g.pickups>180);assert.ok(g.score>8000);assert.equal(g.misses,0);assert.equal(g.maxCombo,g.pickups);});
test('低フレームレートでも判定がすり抜けない',()=>{for(const dt of [1/15,1/30,1/60,1/144]){const {g}=safeRun(7,dt);assert.equal(g.endReason,'complete');assert.equal(g.hits,0);assert.equal(g.misses,0);assert.equal(g.elapsed,60);}});
test('コンボは取り逃しでリセットする',()=>{const g=new Game(8);g.start();while(g.elapsed<3.3){g.step(1/60);g.takeEvents();}assert.ok(g.combo>0);g.toggle();while(g.elapsed<4.25){g.step(1/60);g.takeEvents();}assert.equal(g.combo,0);assert.ok(g.misses>0);});
test('連続接触の猶予・重複加点防止',()=>{const g=new Game(3);g.start();g.nextSpawn=999;const row=()=>({id:99,a:.05,hazard:1,hit:false,passed:false,coins:[]});g.rows=[row(),row()];g.step(.05);assert.equal(g.lives,2);assert.equal(g.hits,1);g.rows=[{id:100,a:.05,hazard:0,hit:false,passed:false,coins:[{offset:0,collected:false,missed:false}]}];g.invincible=0;g.step(.03);const score=g.score;assert.equal(g.pickups,1);g.step(.01);assert.equal(g.score,score);assert.equal(g.pickups,1);});
test('同じシード・同じ操作で同じ結果',()=>{const a=safeRun(123).g,b=safeRun(123).g;assert.deepEqual(a.snapshot(),b.snapshot());assert.equal(a.rowId,b.rowId);});
test('不正な時間入力で状態が壊れない',()=>{const g=new Game(2);g.start();for(const dt of [NaN,Infinity,-1,0,undefined])g.step(dt);assert.equal(g.elapsed,0);assert.ok(Number.isFinite(g.score));});
const start=performance.now();let lowest=Infinity,highest=0,maxRows=0;
test('300通りの配置がすべて無傷・全回収で完走できる',()=>{for(let seed=1;seed<=300;seed++){const result=safeRun(seed);assert.equal(result.g.endReason,'complete','seed '+seed);assert.equal(result.g.hits,0,'seed '+seed);assert.equal(result.g.misses,0,'seed '+seed);assert.ok(result.maxRows<=6);lowest=Math.min(lowest,result.g.score);highest=Math.max(highest,result.g.score);maxRows=Math.max(maxRows,result.maxRows);}});
console.log(JSON.stringify({checks,seeds:300,scoreRange:[lowest,highest],maxRows,simulationMs:Math.round(performance.now()-start)}));
