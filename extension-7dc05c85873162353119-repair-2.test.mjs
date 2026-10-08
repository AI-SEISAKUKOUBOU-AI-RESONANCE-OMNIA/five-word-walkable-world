import test from 'node:test';
import assert from 'node:assert/strict';
import {PLATE_START,PLATE_ROUTE,createWalkState,beginWalkMove,tickWalk,routeDirection,canSupportWalkPosition,createPlateWalk} from './plate-walk.mjs';
import {createLocale} from './locale.mjs';

// Additional retry regressions. All previously supplied test modules stay intact.
// This exercises model and controller event paths, not native browser rendering.
const originalRoute=[[0,0],[0,-2.8],[0,-5.6],[2.8,-5.6],[5.6,-5.6],[5.6,-8.4],[5.6,-11.2],[2.8,-11.2],[0,-11.2],[0,-14]];

test('retry preserves every original route coordinate and its orthogonal supported steps',()=>{
 assert.deepEqual(PLATE_ROUTE.map(({x,z})=>[x,z]),originalRoute);
 const nodes=[PLATE_START,...PLATE_ROUTE];
 for(let i=1;i<nodes.length;i++){
  const a=nodes[i-1],b=nodes[i];
  assert.ok(a.x===b.x || a.z===b.z,'no omitted corner may create a diagonal');
  assert.ok(Math.abs(Math.hypot(b.x-a.x,b.z-a.z)-2.8)<1e-12);
  for(let n=0;n<=100;n++)assert.equal(canSupportWalkPosition(a.x+(b.x-a.x)*n/100,a.z+(b.z-a.z)*n/100),true);
 }
 for(const reducedMotion of [false,true]){
  const state=createWalkState();
  for(let n=0;n<40;n++)tickWalk(state,0.02);
  let origin=PLATE_START;
  for(let index=0;index<originalRoute.length;index++){
   const [x,z]=originalRoute[index],destination={x,z};
   assert.deepEqual(beginWalkMove(state,routeDirection(origin,destination),{reducedMotion}),{ok:true,target:index});
   for(let n=0;n<100;n++){
    tickWalk(state,0.02,{reducedMotion});
    assert.equal(canSupportWalkPosition(state.position.x,state.position.z),true);
   }
   assert.equal(state.index,index);assert.equal(state.entries,index+1);
   assert.deepEqual(state.position,destination);assert.equal(state.flips[index],1);
   origin=destination;
  }
  assert.equal(state.phase,'complete');assert.equal(state.visited.size,10);
  assert.deepEqual(state.flips,Array(10).fill(1));
 }
});

class Bus extends EventTarget {
 emit(type,properties={}){
  const event=new Event(type,{cancelable:true});
  for(const [key,value] of Object.entries(properties))Object.defineProperty(event,key,{value,configurable:true});
  this.dispatchEvent(event);return event;
 }
}
class Element extends Bus {
 constructor(root,tag){
  super();this.root=root;this.tagName=tag.toUpperCase();this.dataset={};this.attributes=new Map();
  this.children=[];this.textContent='';this.value='';this.hidden=false;this.checked=false;this.captured=new Set();
  const classes=new Set();
  this.classList={contains:name=>classes.has(name),toggle(name,enabled){
   if(enabled)classes.add(name);else classes.delete(name);return Boolean(enabled);
  }};
 }
 append(node){node.parentElement=this;this.children.push(node);}
 setAttribute(name,value){this.attributes.set(name,String(value));}
 removeAttribute(name){this.attributes.delete(name);}
 closest(selector){
  const selectors=selector.split(',').map(value=>value.trim());
  for(let node=this;node;node=node.parentElement){
   if(selectors.some(value=>value===node.tagName.toLowerCase() || value==='[contenteditable]' && node.attributes.has('contenteditable')))return node;
  }
  return null;
 }
 focus(){this.root.activeElement=this;this.root.emit('focusin',{target:this});}
 setPointerCapture(id){this.captured.add(id);}
}
class Root extends Bus {
 constructor(){
  super();this.hidden=false;this.activeElement=null;this.documentElement={lang:'en'};this.title='';this.nodes=new Map();this.controls=new Map();
  for(const [id,tag] of [
   ['language','select'],['palette','select'],['gentle','input'],['plate-status','p'],['plate-progress','p'],
   ['plate-route','ol'],['plate-mode','button'],['world-mode','button'],['plate-reset','button'],
   ['plate-tools','section'],['progress','p'],['world-scene-label','span'],['plate-scene-label','span'],
   ['overview','button'],['scene-hint','div'],['scene','canvas']
  ])this.nodes.set(id,this.createElement(tag));
  this.getElementById('language').value='en';this.getElementById('palette').value='sand';
  for(const direction of ['forward','backward','left','right']){
   const node=this.createElement('button');node.dataset.plateMove=direction;this.controls.set(direction,node);
  }
 }
 createElement(tag){return new Element(this,tag);}
 getElementById(id){return this.nodes.get(id);}
 querySelectorAll(selector){
  if(selector==='[data-move],[data-plate-move]')return [...this.controls.values()];
  if(selector==='[data-i18n]' || selector==='[data-i18n-aria]')return [];
  throw new Error('Unexpected selector: '+selector);
 }
}
function withController(options,run){
 const names=['window','performance','requestAnimationFrame'];
 const descriptors=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
 const root=new Root(),win=new Bus(),media=new Bus(),queue=[];
 media.matches=Boolean(options.reduced);win.matchMedia=()=>media;
 let now=0,frames=0;
 const replacements={window:win,performance:{now:()=>now},requestAnimationFrame:callback=>{queue.push(callback);return queue.length;}};
 for(const name of names)Object.defineProperty(globalThis,name,{value:replacements[name],configurable:true,writable:true});
 try{
  const locale=createLocale(root),api=createPlateWalk({document:root,locale});
  api.setActive(true);root.getElementById('scene').focus();
  if(options.fallback)api.setFallback(true);
  function frame(milliseconds=16){
   now+=milliseconds;frames++;
   const callbacks=queue.splice(0);assert.equal(callbacks.length,1);
   callbacks[0](now);
  }
  function advance(milliseconds=2000){
   for(let remaining=milliseconds;remaining>0;){const amount=Math.min(16,remaining);frame(amount);remaining-=amount;}
  }
  const h={root,win,api,locale,frame,advance,
   status:()=>root.getElementById('plate-status').textContent,
   entries:()=>Number(root.getElementById('plate-progress').textContent.split('·')[1].match(/\d+/)[0]),
   route:()=>root.getElementById('plate-route').children,
   here:()=>root.getElementById('plate-route').children.findIndex(node=>node.classList.contains('current')),
   down(direction='forward',pointerType='mouse'){
    return root.controls.get(direction).emit('pointerdown',{pointerId:1,pointerType,button:0});
   },
   up(direction='forward',pointerType='mouse'){
    const node=root.controls.get(direction);
    node.emit('pointerup',{pointerId:1,pointerType,button:0});
    node.captured.delete(1);node.emit('lostpointercapture',{pointerId:1,pointerType});
    node.emit('click',{detail:1,pointerType});
   },
   short(direction='forward',pointerType='mouse'){
    const before=frames;
    assert.equal(h.down(direction,pointerType).defaultPrevented,true);
    now+=4;h.up(direction,pointerType);
    assert.equal(frames,before,'the gesture contains no RAF');
   },
   ready(){advance(650);assert.ok(h.status().startsWith(locale.t('invitation')));},
   resetWithFocus(){
    const button=root.getElementById('plate-reset');button.focus();button.emit('click',{detail:1});
    assert.equal(root.activeElement,button);assert.ok(h.status().startsWith(locale.t('opening')));
   }
  };
  return run(h);
 }finally{
  for(const name of names){const descriptor=descriptors.get(name);if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
 }
}

const modes=[
 {name:'normal',reduced:false,fallback:false},
 {name:'fallback',reduced:false,fallback:true},
 {name:'reduced motion',reduced:true,fallback:false},
 {name:'reduced-motion fallback',reduced:true,fallback:true}
];
for(const mode of modes)test(`focused reset reaches ready, completes ten short steps and replays in ${mode.name}`,()=>{
 for(const pointerType of ['mouse','touch'])withController(mode,h=>{
  h.ready();h.short('forward',pointerType);h.advance();assert.equal(h.entries(),1);
  h.resetWithFocus();
  const reset=h.root.activeElement;
  h.ready();assert.equal(h.root.activeElement,reset,'readiness must not require moving focus');
  assert.equal(h.entries(),0);assert.equal(h.here(),-1);
  let origin=PLATE_START;
  for(let index=0;index<originalRoute.length;index++){
   const [x,z]=originalRoute[index],destination={x,z};
   h.short(routeDirection(origin,destination),pointerType);
   assert.ok(h.status().startsWith(h.locale.t('walking',{number:String(index+1).padStart(2,'0')})));
   h.advance();assert.equal(h.entries(),index+1);assert.equal(h.here(),index);
   assert.ok(h.route()[index].textContent.includes('B ≋'));
   origin=destination;
  }
  assert.ok(h.status().startsWith(h.locale.t('complete')));
  assert.equal(h.route().filter(node=>node.classList.contains('visited')).length,10);
  h.resetWithFocus();h.ready();assert.equal(h.root.activeElement,reset);
  assert.equal(h.entries(),0);assert.ok(h.route().every(node=>node.textContent.includes('A −')));
  h.short('forward',pointerType);h.advance();assert.equal(h.entries(),1);
  h.short('backward',pointerType);h.advance();assert.equal(h.here(),-1);assert.equal(h.entries(),1);
  h.short('forward',pointerType);h.advance();assert.equal(h.entries(),2);
  assert.ok(h.route()[0].textContent.includes('A −'));
 });
});

test('reset with retained button focus abandons partial walking and turning without stalling',()=>{
 for(const elapsed of [200,650])withController({},h=>{
  h.ready();h.down();h.frame();h.advance(elapsed);
  assert.ok(h.status().startsWith(h.locale.t(elapsed===200?'walking':'turning',{number:'01'})));
  h.resetWithFocus();const reset=h.root.activeElement;
  h.up();h.advance(2500);
  assert.equal(h.root.activeElement,reset);assert.equal(h.entries(),0);assert.equal(h.here(),-1);
  assert.ok(h.status().startsWith(h.locale.t('invitation')));
  assert.ok(h.route().every(node=>node.textContent.includes('A −')));
  h.short();h.advance();assert.equal(h.entries(),1);
 });
});

test('editing focus cancels pending input while opening and committed animations continue',()=>{
 for(const tag of ['input','textarea','select','button','a','div']){
  withController({},h=>{
   const editor=h.root.createElement(tag);if(tag==='div')editor.setAttribute('contenteditable','true');
   editor.focus();h.ready();assert.equal(h.root.activeElement,editor);
   assert.equal(h.entries(),0);
   h.root.getElementById('scene').focus();
   h.win.emit('keydown',{key:'w',repeat:false,target:h.root.getElementById('scene')});
   editor.focus();h.advance();
   h.win.emit('keyup',{key:'w',target:editor});
   assert.equal(h.entries(),0);assert.equal(h.here(),-1);
   h.short();h.advance();assert.equal(h.entries(),1);
  });
  for(const elapsed of [200,650])withController({},h=>{
   h.ready();h.down();h.frame();h.advance(elapsed);
   const editor=h.root.createElement(tag);if(tag==='div')editor.setAttribute('contenteditable','true');
   editor.focus();h.advance(5000);
   assert.equal(h.root.activeElement,editor);
   assert.equal(h.entries(),1);assert.equal(h.here(),0);
   assert.ok(h.route()[0].textContent.includes('B ≋'));
   assert.ok(h.status().startsWith(h.locale.t('nextStep',{number:'01',face:'B',direction:h.locale.t('forward'),next:'02'})));
   h.up();h.advance();assert.equal(h.entries(),1,'release cannot queue a delayed move');
   h.short();h.advance();assert.equal(h.entries(),2);
  });
 }
});

test('focus fix preserves inactive and hidden pauses without requiring blur on mode re-entry',()=>{
 withController({},h=>{
  h.root.hidden=true;h.advance(2000);
  assert.ok(h.status().startsWith(h.locale.t('opening')));
  h.root.hidden=false;h.api.setActive(false);h.advance(2000);
  assert.ok(h.status().startsWith(h.locale.t('opening')));
  const button=h.root.getElementById('plate-mode');button.focus();button.emit('click',{detail:1});
  h.ready();assert.equal(h.root.activeElement,button);assert.equal(h.entries(),0);
  h.short();h.advance();assert.equal(h.entries(),1);
 });
});
