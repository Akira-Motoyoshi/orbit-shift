'use strict';
// Runs the actual controller with a small DOM/Canvas adapter. Real browser
// rendering and input are checked separately through the in-app browser.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Game}=require('../dist/game-core.js');
function environment(blockStorage=false){
  const nodes=new Map(),globalEvents={},docEvents={},queue=new Map(),saved=new Map(),tools=[];let serial=0,clock=0,current;
  function node(id){if(nodes.has(id))return nodes.get(id);const n={id,hidden:false,disabled:false,textContent:'',innerHTML:'',style:{},attributes:{},listeners:{},children:[],classList:{toggle(){},add(){},remove(){}},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,fn){this.listeners[k]=fn;},focus(){document.activeElement=this;},blur(){document.activeElement=document.body;},getBoundingClientRect(){return{width:1038,height:610};},getContext(){return paint;}};nodes.set(id,n);return n;}
  const paint=new Proxy({createRadialGradient(){return{addColorStop(){}};}},{get(t,k){return t[k]||(()=>{});},set(t,k,v){t[k]=v;return true;}});
  const document={hidden:false,activeElement:null,body:node('body'),getElementById:node,createElement:()=>node('created-canvas'),querySelector:node,addEventListener(k,fn){docEvents[k]=fn;},modelContext:{registerTool(t){tools.push(t);}}};document.activeElement=document.body;
  node('lives').children=[node('life0'),node('life1'),node('life2')];
  class ObservedGame extends Game{constructor(){super(78);current=this;}}
  const context={document,console,OrbitCore:{Game:ObservedGame,clamp:(v,a,b)=>Math.max(a,Math.min(b,v))},window:{matchMedia:()=>({matches:false}),devicePixelRatio:1,addEventListener(k,fn){globalEvents[k]=fn;}},localStorage:{getItem(k){if(blockStorage)throw new Error('blocked');return saved.get(k)||null;},setItem(k,v){if(blockStorage)throw new Error('blocked');saved.set(k,v);}},getComputedStyle:()=>({fontFamily:'Arial'}),ResizeObserver:class{observe(){}},requestAnimationFrame(fn){const id=++serial;queue.set(id,fn);return id;},cancelAnimationFrame(id){queue.delete(id);},AbortController,Math,Date};
  vm.runInNewContext(fs.readFileSync('dist/game.js','utf8'),context,{filename:'game.js'});
  function frame(dt=1/60){clock+=dt*1000;const jobs=Array.from(queue.values());queue.clear();for(const fn of jobs)fn(clock);}
  function key(code,repeat=false){globalEvents.keydown({code,repeat,target:document.body,preventDefault(){}});}
  function visible(value){document.hidden=!value;docEvents.visibilitychange();}
  return{node,document,frame,key,visible,saved,tools,queue,get game(){return current;}};
}
const e=environment();
assert.equal(e.tools.length,5);assert.equal(e.queue.size,1);
e.key('Space');assert.equal(e.game.state,'playing');assert.equal(e.node('start-screen').hidden,true);e.frame();e.frame();
e.key('Space');assert.equal(e.game.lane,0);e.key('Space',true);assert.equal(e.game.lane,0);
e.key('Escape');const frozen=e.game.elapsed;for(let i=0;i<120;i++)e.frame();assert.equal(e.game.elapsed,frozen);assert.equal(e.node('pause-screen').hidden,false);
e.key('Space');assert.equal(e.game.state,'playing');e.visible(false);assert.equal(e.game.state,'paused');assert.equal(e.queue.size,0);e.visible(true);assert.equal(e.queue.size,1);e.frame();assert.equal(e.queue.size,1);
e.node('restart-button').listeners.click();
for(let frames=0;e.game.state==='playing'&&frames<5000;frames++){const row=e.game.rows.find(r=>r.a>.28&&r.a<.68&&!r.passed);if(row&&e.game.lane!==1-row.hazard)e.key('Space');e.frame();}
assert.equal(e.game.endReason,'complete');assert.equal(e.node('result-screen').hidden,false);assert.equal(e.node('result-eyebrow').textContent,'60 SECONDS COMPLETE');assert.equal(e.node('result-title').textContent,'PERFECT ORBIT.');assert.ok(e.node('result-note').textContent.includes('+600'));assert.equal(e.node('result-time').textContent,'60.0秒');assert.equal(Number(e.saved.get('orbit-shift-best-v1')),e.game.score);assert.equal(e.node('retry-button'),e.document.activeElement);
e.node('home-button').listeners.click();assert.equal(e.game.state,'ready');assert.equal(e.node('start-screen').hidden,false);assert.equal(e.node('result-screen').hidden,true);
const reader=e.tools.find(t=>t.name==='read_orbit_game');assert.equal(reader.execute({}).state,'ready');assert.throws(()=>reader.execute({unexpected:1}));
e.tools.find(t=>t.name==='start_orbit_game').execute({});assert.equal(e.game.state,'playing');assert.throws(()=>e.tools.find(t=>t.name==='start_orbit_game').execute({}));
const b=environment(true);b.node('start-button').listeners.click();assert.equal(b.game.state,'playing');assert.ok(b.node('.page-footer span:last-child').textContent.includes('今回のプレイ中'));
console.log('PASS UI controller: keyboard, key repeat, pause/resume, tab visibility, single animation loop, 60-second completion, result bonus, best-score persistence, retry/home, WebMCP state and invalid input, blocked storage, missing audio API.');
