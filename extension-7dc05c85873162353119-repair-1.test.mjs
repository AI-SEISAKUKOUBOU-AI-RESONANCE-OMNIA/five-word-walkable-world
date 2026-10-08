import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlateWalk,PLATE_START,PLATE_ROUTE,routeDirection} from './plate-walk.mjs';
import {createLocale,LANGUAGES} from './locale.mjs';
import {buildWorld,validateInput} from './app.mjs';

// Exercise the actual controller listeners and RAF callback with a small DOM
// double. These are deterministic event-path regressions, not native-browser
// or rendered-video verification. Short gestures never contain a RAF callback.
class Bus extends EventTarget {
 emit(type,properties={}){
  const event=new Event(type,{cancelable:true});
  for(const [key,value] of Object.entries(properties))Object.defineProperty(event,key,{value,configurable:true});
  this.dispatchEvent(event);return event;
 }
}
class Element extends Bus {
 constructor(root,tag='div'){
  super();this.root=root;this.tagName=tag.toUpperCase();this.dataset={};this.attributes=new Map();
  this.children=[];this.textContent='';this.value='';this.checked=false;this.hidden=false;this.captured=new Set();
  const classes=new Set();
  this.classList={contains:name=>classes.has(name),toggle(name,force){
   const enabled=force===undefined?!classes.has(name):Boolean(force);
   if(enabled)classes.add(name);else classes.delete(name);return enabled;
  }};
 }
 append(node){node.parentElement=this;this.children.push(node);}
 setAttribute(name,value){this.attributes.set(name,String(value));}
 removeAttribute(name){this.attributes.delete(name);}
 getAttribute(name){return this.attributes.get(name)??null;}
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
  super();this.hidden=false;this.activeElement=null;this.documentElement={lang:'en'};this.title='';this.nodes=new Map();this.all=[];
  for(const [id,tag] of [
   ['language','select'],['palette','select'],['gentle','input'],['plate-status','p'],['plate-progress','p'],
   ['plate-route','ol'],['plate-mode','button'],['world-mode','button'],['plate-reset','button'],
   ['plate-tools','section'],['progress','p'],['world-scene-label','span'],['plate-scene-label','span'],
   ['overview','button'],['scene-hint','div'],['scene','canvas'],['ban','input'],['bgm','audio']
  ])this.nodes.set(id,this.createElement(tag));
  this.getElementById('language').value='en';this.getElementById('palette').value='sand';
  this.getElementById('scene-hint').dataset.i18n='plateHint';
  this.getElementById('ban').value='岩';this.getElementById('bgm').paused=true;
  this.words=['灯','森','水','樹','橋'].map(value=>{const node=this.createElement('input');node.value=value;return node;});
  this.controls={panel:new Map(),touch:new Map()};
  for(const direction of ['forward','backward','left','right']){
   const panel=this.createElement('button');panel.dataset={plateMove:direction,i18n:direction};this.controls.panel.set(direction,panel);
   const touch=this.createElement('button');touch.dataset={move:direction,i18nAria:direction};this.controls.touch.set(direction,touch);
  }
 }
 createElement(tag){const node=new Element(this,tag);this.all.push(node);return node;}
 getElementById(id){return this.nodes.get(id);}
 querySelectorAll(selector){
  if(selector==='[data-move],[data-plate-move]')return [...this.controls.panel.values(),...this.controls.touch.values()];
  if(selector==='[data-i18n]')return this.all.filter(node=>node.dataset.i18n);
  if(selector==='[data-i18n-aria]')return this.all.filter(node=>node.dataset.i18nAria);
  throw new Error('Unexpected selector: '+selector);
 }
}
function withWalk(options,run){
 const names=['window','performance','requestAnimationFrame'];
 const originals=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
 const root=new Root(),win=new Bus(),media=new Bus(),queue=[];
 media.matches=Boolean(options.reduced);win.matchMedia=()=>media;
 let now=0,frames=0;
 const replacements={window:win,performance:{now:()=>now},requestAnimationFrame:callback=>{queue.push(callback);return queue.length;}};
 for(const name of names)Object.defineProperty(globalThis,name,{value:replacements[name],configurable:true,writable:true});
 try{
  const locale=createLocale(root);
  const api=createPlateWalk({document:root,locale});
  api.setActive(true);root.getElementById('scene').focus();
  if(options.fallback)api.setFallback(true);
  function frame(milliseconds=16){
   now+=milliseconds;frames++;
   const callbacks=queue.splice(0);assert.equal(callbacks.length,1);
   callbacks.forEach(callback=>callback(now));
  }
  function advance(milliseconds=1600){
   for(let remaining=milliseconds;remaining>0;){const amount=Math.min(16,remaining);frame(amount);remaining-=amount;}
  }
  const h={root,win,media,api,locale,frame,advance,clock:milliseconds=>{now+=milliseconds;},
   status:()=>root.getElementById('plate-status').textContent,
   entries:()=>Number(root.getElementById('plate-progress').textContent.split('·')[1].match(/\d+/)[0]),
   route:()=>root.getElementById('plate-route').children,
   here:()=>root.getElementById('plate-route').children.findIndex(node=>node.classList.contains('current')),
   button:(direction,controls='panel')=>root.controls[controls].get(direction),
   ready(){advance(650);assert.ok(h.status().startsWith(locale.t('invitation')));},
   down(direction,{id=1,pointerType='mouse',controls='panel',button=0}={}){
    return h.button(direction,controls).emit('pointerdown',{pointerId:id,pointerType,button});
   },
   up(direction,{id=1,pointerType='mouse',controls='panel',click=true,clickDetail=1}={}){
    const node=h.button(direction,controls);
    node.emit('pointerup',{pointerId:id,pointerType,button:0});
    node.captured.delete(id);node.emit('lostpointercapture',{pointerId:id,pointerType});
    if(click)node.emit('click',{detail:clickDetail,pointerType});
   },
   short(direction,properties={}){
    const before=frames;
    const event=h.down(direction,properties);assert.equal(event.defaultPrevented,true);
    assert.ok(h.button(direction,properties.controls).captured.has(properties.id??1));
    h.clock(properties.elapsed??4);h.up(direction,properties);
    assert.equal(frames,before,'no RAF is allowed between down, up and click');
   },
   key(type,key,properties={}){return win.emit(type,{key,repeat:false,target:root.getElementById('scene'),...properties});}
  };
  return run(h);
 }finally{
  for(const name of names){const descriptor=originals.get(name);if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
 }
}

const modes=[
 {name:'normal',reduced:false,fallback:false},
 {name:'fallback',reduced:false,fallback:true},
 {name:'reduced motion',reduced:true,fallback:false},
 {name:'reduced-motion fallback',reduced:true,fallback:true}
];
for(const mode of modes)for(const input of [
 {pointerType:'mouse',controls:'panel'},
 {pointerType:'touch',controls:'touch'}
])test(`short ${input.pointerType} gestures traverse all 10 plates, finish and replay in ${mode.name}`,()=>{
 withWalk(mode,h=>{
  h.ready();let origin=PLATE_START;
  assert.equal(PLATE_ROUTE.length,10);
  for(let index=0;index<PLATE_ROUTE.length;index++){
   const destination=PLATE_ROUTE[index],direction=routeDirection(origin,destination);
   h.short(direction,{...input,id:index+1,elapsed:4});
   assert.ok(h.status().startsWith(h.locale.t('walking',{number:String(index+1).padStart(2,'0')})));
   assert.equal(h.entries(),index,'entry follows supported walking, not the input event itself');
   h.advance();
   assert.equal(h.entries(),index+1);assert.equal(h.here(),index);
   assert.ok(h.route()[index].textContent.includes('B ≋'));
   origin=destination;
  }
  assert.ok(h.status().startsWith(h.locale.t('complete')));
  assert.equal(h.route().filter(node=>node.classList.contains('visited')).length,10);
  const ending=h.status();h.short('backward',input);h.advance(3000);
  assert.equal(h.entries(),10);assert.equal(h.status(),ending);
  h.root.getElementById('plate-reset').emit('click',{detail:0});
  assert.ok(h.status().startsWith(h.locale.t('opening')));
  assert.equal(h.entries(),0);assert.equal(h.here(),-1);
  assert.ok(h.route().every(node=>node.textContent.includes('A −') && !node.classList.contains('visited')));
  h.ready();h.short('forward',input);h.advance();assert.equal(h.entries(),1);
  h.short('backward',input);h.advance();assert.equal(h.entries(),1);assert.equal(h.here(),-1);
  h.short('forward',input);h.advance();assert.equal(h.entries(),2);assert.equal(h.here(),0);
  assert.ok(h.route()[0].textContent.includes('A −'));
  assert.equal(h.route().filter(node=>node.classList.contains('visited')).length,1);
 });
});

test('1–15ms gestures are accepted without a frame, including touch on the panel buttons',()=>{
 for(const elapsed of [1,4,10,15])for(const pointerType of ['mouse','touch'])withWalk({},h=>{
  h.ready();h.short('forward',{elapsed,pointerType,controls:'panel',clickDetail:0});
  assert.ok(h.status().startsWith(h.locale.t('walking',{number:'01'})));
  h.advance(5000);assert.equal(h.entries(),1);assert.equal(h.here(),0);
 });
});

test('a frame consumes a held gesture before release; continued holding still walks connected plates',()=>{
 withWalk({},h=>{
  h.ready();h.down('forward');h.frame();
  assert.ok(h.status().startsWith(h.locale.t('walking',{number:'01'})));
  h.advance(4400);assert.equal(h.entries(),3);assert.equal(h.here(),2);
  assert.ok(h.status().includes(h.locale.t('edge')));
  h.up('forward',{clickDetail:0});h.advance(2500);
  assert.equal(h.entries(),3);
  h.short('right');h.advance();assert.equal(h.entries(),4);assert.equal(h.here(),3);
 });
});

test('a late compatibility click cannot repeat a tap, while Enter and Space button activation remain usable',()=>{
 for(const key of ['Enter',' '])withWalk({},h=>{
  h.ready();h.short('forward',{click:false});h.advance(2000);assert.equal(h.entries(),1);
  const button=h.button('forward');
  button.emit('click',{detail:0});h.advance(2000);assert.equal(h.entries(),1);
  button.emit('keydown',{key,repeat:false});button.emit('click',{detail:0});h.advance();
  assert.equal(h.entries(),2);assert.equal(h.here(),1);
  button.emit('click',{detail:1,pointerType:'mouse'});h.advance(2000);assert.equal(h.entries(),2);
 });
});

test('cancel, lost capture, blur, visibility, stop, reset, mode, fallback and focus discard unconsumed taps',()=>{
 const cancellations={
  pointercancel:h=>h.button('forward').emit('pointercancel',{pointerId:1}),
  lostcapture:h=>h.button('forward').emit('lostpointercapture',{pointerId:1}),
  blur:h=>h.win.emit('blur'),
  visibility:h=>{h.root.hidden=true;h.root.emit('visibilitychange');h.root.hidden=false;},
  stop:h=>h.api.stop(),
  reset:h=>h.api.reset(),
  mode:h=>{h.api.setActive(false);h.api.setActive(true);},
  fallback:h=>h.api.setFallback(true),
  focus:h=>h.root.words[0].focus()
 };
 for(const [name,cancel] of Object.entries(cancellations))withWalk({},h=>{
  h.ready();h.down('forward');h.clock(4);cancel(h);
  h.up('forward',{clickDetail:0,pointerType:''});h.advance(2000);
  assert.equal(h.entries(),0,name);assert.equal(h.here(),-1,name);
  h.short('forward');h.advance();assert.equal(h.entries(),1,name+' permits a fresh gesture');
 });
});

test('cancelling an already committed hold finishes its supported step but prevents further walking',()=>{
 for(const signal of ['pointercancel','lostpointercapture','blur','stop'])withWalk({},h=>{
  h.ready();h.down('forward');h.frame();h.advance(200);
  if(signal==='blur')h.win.emit('blur');
  else if(signal==='stop')h.api.stop();
  else h.button('forward').emit(signal,{pointerId:1});
  h.up('forward',{clickDetail:0});h.advance(5000);
  assert.equal(h.entries(),1,signal);assert.equal(h.here(),0,signal);
 });
});

test('reset during walking or turning abandons the old step and all held input',()=>{
 for(const elapsed of [200,650])withWalk({},h=>{
  h.ready();h.down('forward');h.frame();h.advance(elapsed);
  assert.ok(h.status().startsWith(h.locale.t(elapsed===200?'walking':'turning',{number:'01'})));
  h.api.reset();h.up('forward',{clickDetail:0});h.advance(2500);
  assert.equal(h.entries(),0);assert.equal(h.here(),-1);
  assert.ok(h.route().every(node=>node.textContent.includes('A −')));
  h.short('forward');h.advance();assert.equal(h.entries(),1);
 });
});

test('busy and opening presses never become delayed moves, even if still held when ready',()=>{
 withWalk({},h=>{
  h.ready();h.short('forward');
  h.down('forward',{id:2});h.key('keydown','ArrowUp');h.advance(3500);
  assert.equal(h.entries(),1);assert.equal(h.here(),0);
  h.up('forward',{id:2});h.key('keyup','ArrowUp');h.advance(2000);assert.equal(h.entries(),1);
  h.key('keydown','ArrowUp',{repeat:true});h.key('keyup','ArrowUp');h.advance(2000);assert.equal(h.entries(),1);
  h.short('forward');h.advance();assert.equal(h.entries(),2);
  h.api.reset();h.down('forward',{id:3});h.advance(2500);
  assert.equal(h.entries(),0);h.up('forward',{id:3});h.advance(2000);assert.equal(h.entries(),0);
  h.short('forward');h.advance();assert.equal(h.entries(),1);
 });
});

test('opposing and diagonal short chords cancel before any frame rather than selecting a direction',()=>{
 for(const second of ['backward','right'])withWalk({},h=>{
  h.ready();h.down('forward',{id:1});h.down(second,{id:2});h.clock(4);
  h.up('forward',{id:1});h.up(second,{id:2});h.advance(2000);
  assert.equal(h.entries(),0);assert.equal(h.here(),-1);
  h.short('forward');h.advance();assert.equal(h.entries(),1);
 });
});

test('a remaining eligible hold resumes after its opposing control is released',()=>{
 withWalk({},h=>{
  h.ready();h.down('forward',{id:1});h.down('backward',{id:2});h.advance(200);
  assert.equal(h.entries(),0);assert.ok(h.status().startsWith(h.locale.t('invitation')));
  h.up('backward',{id:2});h.frame();h.up('forward',{id:1});h.advance();
  assert.equal(h.entries(),1);assert.equal(h.here(),0);
 });
});

test('a reverse press during a committed hold cancels continuation without queuing a late reversal',()=>{
 withWalk({},h=>{
  h.ready();h.down('forward',{id:1});h.frame();h.down('backward',{id:2});h.advance(1800);
  assert.equal(h.entries(),1);assert.equal(h.here(),0);
  h.up('forward',{id:1});h.advance(2000);assert.equal(h.entries(),1);assert.equal(h.here(),0);
  h.up('backward',{id:2});h.advance(2000);assert.equal(h.here(),0);
  h.short('backward');h.advance();assert.equal(h.here(),-1);assert.equal(h.entries(),1);
  h.short('forward');h.advance();assert.equal(h.entries(),2);assert.ok(h.route()[0].textContent.includes('A −'));
 });
});

test('same-direction keyboard and pointer releases consume one entry without down/up/click duplication',()=>{
 withWalk({},h=>{
  h.ready();h.key('keydown','w');h.down('forward');h.down('forward');h.clock(4);
  h.up('forward',{clickDetail:0});h.key('keyup','w',{target:h.button('forward')});h.advance(4000);
  assert.equal(h.entries(),1);assert.equal(h.here(),0);
 });
});

test('short keyboard taps are covered separately without assuming a native keyboard audit failure',()=>{
 for(const key of ['w','ArrowUp'])withWalk({},h=>{
  h.ready();assert.equal(h.key('keydown',key).defaultPrevented,true);h.clock(1);h.key('keyup',key);
  assert.ok(h.status().startsWith(h.locale.t('walking',{number:'01'})));
  h.advance(4000);assert.equal(h.entries(),1);
 });
});

test('non-primary mouse buttons and keyboard repeats without a fresh press cannot start a walk',()=>{
 for(const button of [1,2])withWalk({},h=>{
  h.ready();h.down('forward',{button});h.clock(4);h.up('forward',{clickDetail:0});
  h.key('keydown','w',{repeat:true});h.key('keyup','w');h.advance(2000);
  assert.equal(h.entries(),0);
 });
});

test('interactive focus cancels held keys and protects editing; an explicit direction tap works afterward',()=>{
 for(const tag of ['input','textarea','select','button','a','div'])withWalk({},h=>{
  h.ready();h.key('keydown','w');
  const editor=h.root.createElement(tag);if(tag==='div')editor.setAttribute('contenteditable','true');
  editor.focus();h.key('keydown','ArrowUp',{target:editor});h.advance(2000);
  h.key('keyup','w',{target:editor});h.key('keyup','ArrowUp',{target:editor});
  assert.equal(h.entries(),0,tag);
  h.short('forward');h.advance();assert.equal(h.entries(),1,tag);
 });
});

test('hidden input cannot commit on release and does not resume after visibility returns',()=>{
 withWalk({},h=>{
  h.ready();h.down('forward');h.root.hidden=true;h.up('forward');h.advance(200);
  h.root.hidden=false;h.advance(2000);assert.equal(h.entries(),0);
  h.short('forward');h.advance();assert.equal(h.entries(),1);
 });
});

test('mode changes retain completed plate state but discard a pending direction gesture',()=>{
 withWalk({},h=>{
  h.ready();h.short('forward');h.advance();h.down('forward');
  h.root.getElementById('world-mode').emit('click',{detail:0});
  assert.equal(h.api.active,false);h.up('forward');h.advance(2000);
  h.root.getElementById('plate-mode').emit('click',{detail:0});h.advance(2000);
  assert.equal(h.entries(),1);assert.equal(h.here(),0);
  h.short('forward');h.advance();assert.equal(h.entries(),2);
 });
});

test('gesture repair preserves bounded literal inputs, palette, audio state and progress across all locales',()=>{
 withWalk({},h=>{
  const literal='<b>&'+String.fromCharCode(39,34)+'</b>';
  assert.ok([...literal].length<=20);
  const words=[literal,'森','星','川','塔'];
  h.root.words.forEach((node,index)=>{node.value=words[index];});
  h.root.getElementById('palette').value='slate';h.root.getElementById('palette').emit('change');
  assert.equal(validateInput(words,'岩').ok,true);
  assert.equal(validateInput(['x'.repeat(21),...words.slice(1)],'岩').ok,false);
  assert.equal(validateInput(['x'.repeat(20),...words.slice(1)],'岩').ok,true);
  assert.equal(buildWorld(words,'岩').tiles[0].label,literal);
  const inputs=()=>({words:h.root.words.map(node=>node.value),ban:h.root.getElementById('ban').value,
   palette:h.root.getElementById('palette').value,paused:h.root.getElementById('bgm').paused});
  const before=inputs();h.ready();h.short('forward',{pointerType:'touch'});h.advance();
  for(const language of LANGUAGES){
   assert.equal(h.locale.setLanguage(language),true);assert.deepEqual(inputs(),before);
   assert.equal(h.entries(),1);assert.equal(h.here(),0);
   assert.ok(h.route()[0].textContent.includes('B ≋'));
   h.api.setActive(false);h.api.setActive(true);h.advance(2000);
   assert.equal(h.entries(),1);assert.deepEqual(inputs(),before);
  }
 });
});
