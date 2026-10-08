import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildWorld,validateInput,canStand,movementDelta} from './app.mjs';
import {PLATE_ROUTE,PLATE_START,PALETTES,SUPPORT_Y,PLATE_HALF_WIDTH,PLATE_HALF_HEIGHT,createWalkState,beginWalkMove,tickWalk,routeDirection,platePose,canSupportWalkPosition,cameraPlan} from './plate-walk.mjs';
import {LANGUAGES,TEXT,translate,districtName,landmarkCopy,createLocale} from './locale.mjs';

function advance(state,seconds=2,options={}){
 for(let i=0;i<Math.ceil(seconds/0.02);i++)tickWalk(state,0.02,options);
}
function ready(){const state=createWalkState();advance(state,0.6);assert.equal(state.phase,'ready');return state;}
function step(state,direction,options={}){
 assert.equal(beginWalkMove(state,direction,options).ok,true);
 advance(state,2,options);
}

 test('opening invites a deliberate first step, then movement enters and flips exactly once',()=>{
 const state=createWalkState();
 assert.deepEqual(beginWalkMove(state,'forward'),{ok:false,reason:'busy'});
 assert.equal(state.entries,0);
 advance(state,0.6);
 assert.equal(beginWalkMove(state,'forward').ok,true);
 advance(state,0.2);
 assert.equal(state.entries,0);
 assert.ok(state.position.z<PLATE_START.z && state.position.z>0);
 advance(state,0.4);
 assert.equal(state.phase,'turning');
 assert.equal(state.entries,1);assert.equal(state.flips[0],1);
 assert.deepEqual(state.position,PLATE_ROUTE[0]);
 assert.deepEqual(beginWalkMove(state,'forward'),{ok:false,reason:'busy'});
 advance(state,3);
 const snapshot=[...state.flips];advance(state,20);
 assert.deepEqual(state.flips,snapshot);assert.equal(state.entries,1);
 });

 test('holding a direction cannot create duplicate entries during a step or flip',()=>{
 const state=ready();assert.equal(beginWalkMove(state,'forward').ok,true);
 for(let i=0;i<50;i++){
  const result=beginWalkMove(state,'forward');
  assert.equal(result.ok,false);assert.equal(result.reason,'busy');
  tickWalk(state,0.02);
 }
 assert.equal(state.entries,1);assert.equal(state.flips[0],1);
 advance(state);step(state,'forward');
 assert.deepEqual(state.flips.slice(0,3),[1,1,0]);
 });

 test('re-entry flips again, standing does not, and returning to start is supported',()=>{
 const state=ready();step(state,'forward');step(state,'forward');step(state,'backward');
 assert.equal(state.index,0);assert.equal(state.flips[0],2);assert.equal(state.flips[0]%2,0);
 assert.equal(state.entries,3);assert.equal(state.visited.size,2);
 step(state,'backward');assert.equal(state.index,-1);assert.equal(state.entries,3);
 step(state,'forward');assert.equal(state.flips[0],3);assert.equal(state.visited.size,2);
 });

 test('route edges reject unsupported and diagonal commands without moving or flipping',()=>{
 const state=ready();const initial={...state.position};
 for(const direction of ['left','right','backward']){
  assert.deepEqual(beginWalkMove(state,direction),{ok:false,reason:'edge'});
  assert.deepEqual(state.position,initial);assert.equal(state.entries,0);
 }
 for(const direction of ['diagonal','__proto__',undefined])assert.deepEqual(beginWalkMove(state,direction),{ok:false,reason:'direction'});
 step(state,'forward');step(state,'forward');step(state,'forward');
 assert.equal(state.index,2);
 assert.equal(beginWalkMove(state,'forward').reason,'edge');
 step(state,'right');assert.equal(state.index,3);
 });

 test('endpoint completion waits for its final flip and replay starts a clean independent walk',()=>{
 const state=ready();let origin=PLATE_START;
 for(let i=0;i<PLATE_ROUTE.length;i++){
  const destination=PLATE_ROUTE[i];
  assert.equal(beginWalkMove(state,routeDirection(origin,destination)).ok,true);
  advance(state,0.6);
  assert.equal(state.phase,'turning');
  assert.equal(state.index,i);assert.equal(state.entries,i+1);
  assert.notEqual(state.phase,'complete');
  advance(state,1);
  origin=destination;
 }
 assert.equal(state.phase,'complete');assert.equal(state.visited.size,10);
 assert.deepEqual(state.flips,Array(10).fill(1));
 const before={...state.position};assert.equal(beginWalkMove(state,'backward').reason,'complete');
 advance(state,10);assert.deepEqual(state.position,before);
 const replay=createWalkState();advance(replay,0.6);step(replay,'forward');
 assert.equal(replay.entries,1);assert.equal(replay.visited.size,1);
 assert.deepEqual(replay.flips,[1,0,0,0,0,0,0,0,0,0]);
 assert.equal(state.entries,10);
 });

 test('reset model discards partial movement or rotation rather than completing an old entry',()=>{
 for(const seconds of [0.2,0.6]){
  let state=ready();beginWalkMove(state,'forward');advance(state,seconds);
  assert.ok(['walking','turning'].includes(state.phase));
  state=createWalkState();advance(state,3);
  assert.equal(state.index,-1);assert.equal(state.entries,0);assert.equal(state.visited.size,0);
  assert.deepEqual(state.position,PLATE_START);assert.equal(state.move,null);assert.equal(state.flip,null);
  assert.deepEqual(state.flips,Array(10).fill(0));
 }
 });

 test('reduced motion retains entry counts, directions, surfaces and completion',()=>{
 const options={reducedMotion:true};const state=ready();let origin=PLATE_START;
 for(const destination of PLATE_ROUTE){step(state,routeDirection(origin,destination),options);origin=destination;}
 assert.equal(state.phase,'complete');assert.equal(state.entries,10);assert.deepEqual(state.flips,Array(10).fill(1));
 const replay=ready();step(replay,'forward',options);step(replay,'backward',options);step(replay,'forward',options);
 assert.equal(replay.flips[0],2);assert.equal(replay.visited.size,1);
 });

 test('invalid or long elapsed time cannot teleport, create extra entries, or corrupt the support position',()=>{
 const state=ready();beginWalkMove(state,'forward');const position={...state.position};
 for(const dt of [NaN,Infinity,-1,0])tickWalk(state,dt);
 assert.deepEqual(state.position,position);assert.equal(state.entries,0);
 tickWalk(state,1000);assert.equal(state.entries,0);assert.equal(state.phase,'walking');
 advance(state);
 assert.equal(state.entries,1);assert.ok(canSupportWalkPosition(state.position.x,state.position.z));
 });

 test('every interpolated step remains on continuous fixed support and all rotating corners remain below it',()=>{
 const state=ready();let origin=PLATE_START;
 for(const destination of PLATE_ROUTE){
  assert.equal(beginWalkMove(state,routeDirection(origin,destination)).ok,true);
  for(let i=0;i<100;i++){
   tickWalk(state,0.02);
   assert.ok(canSupportWalkPosition(state.position.x,state.position.z));
  }
  origin=destination;
 }
 assert.equal(canSupportWalkPosition(100,100),false);
 assert.equal(canSupportWalkPosition(NaN,0),false);
 assert.equal(canSupportWalkPosition(0.5,1.4),false);
 for(let turn=-2;turn<=4;turn++)for(let i=0;i<=180;i++){
  const angle=turn*Math.PI+i*Math.PI/180;const pose=platePose(angle);
  for(const x of [-PLATE_HALF_WIDTH,PLATE_HALF_WIDTH])for(const y of [-PLATE_HALF_HEIGHT,PLATE_HALF_HEIGHT]){
   const top=pose.y+x*Math.sin(angle)+y*Math.cos(angle);
   assert.ok(top<=SUPPORT_Y-0.079999);
  }
  assert.ok(pose.y-pose.extent>-2.7,'full sweep remains inside the recessed base');
 }
 });

 test('portrait, landscape, corners, backtracking and camera easing all frame walker and next plate',()=>{
 function inside(point,plan){
  const f={x:-plan.offset.x,y:-plan.offset.y,z:-plan.offset.z};
  const rightLength=Math.hypot(f.x,f.z);
  const r={x:-f.z/rightLength,y:0,z:f.x/rightLength};
  const u={x:r.y*f.z-r.z*f.y,y:r.z*f.x-r.x*f.z,z:r.x*f.y-r.y*f.x};
  const v={x:point.x-plan.camera.x,y:point.y-plan.camera.y,z:point.z-plan.camera.z};
  const dot=a=>v.x*a.x+v.y*a.y+v.z*a.z;
  const depth=dot(f);assert.ok(depth>0);
  assert.ok(Math.abs(dot(r)/depth)<Math.tan(plan.horizontalFov/2));
  assert.ok(Math.abs(dot(u)/depth)<Math.tan(plan.verticalFov/2));
 }
 const nodes=[PLATE_START,...PLATE_ROUTE];
 for(const aspect of [0.25,0.45,0.65,1,1.8,3])for(let i=0;i<nodes.length-1;i++){
  const a=nodes[i],b=nodes[i+1];
  for(const t of [0,0.3,0.8,1]){
   const p={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t};
   const staleFocus={x:a.x-0.8,y:0.8,z:a.z+0.8};
   const plan=cameraPlan(p,b,aspect,staleFocus);
   for(const y of [SUPPORT_Y,SUPPORT_Y+1.5])inside({x:p.x,y,z:p.z},plan);
   for(const x of [-1.4,1.4])for(const z of [-1.4,1.4])inside({x:b.x+x,y:0,z:b.z+z},plan);
  }
 }
 const wide=cameraPlan(PLATE_START,PLATE_ROUTE[0],1.8),portrait=cameraPlan(PLATE_START,PLATE_ROUTE[0],0.45);
 assert.ok(portrait.distance>wide.distance);
 });

 test('palette choices are bounded local two-surface pairs and do not alter route rules',()=>{
 assert.deepEqual(Object.keys(PALETTES),['sand','slate','clay']);
 for(const pair of Object.values(PALETTES)){
  assert.equal(pair.length,2);assert.notEqual(pair[0],pair[1]);
  pair.forEach(color=>assert.match(color,/^#[0-9a-f]{6}$/i));
 }
 assert.equal(PLATE_ROUTE.length,10);
 assert.equal(new Set(PLATE_ROUTE.map(p=>`${p.x},${p.z}`)).size,10);
 });

 test('all UI locales cover identical keys and interpolation preserves literal special-character labels',()=>{
 const keys=Object.keys(TEXT.en).sort();
 const literal='<b>&\'"</b>';
 assert.ok(literal.length<=20);
 const model=buildWorld([literal,'森','星','川','塔'],'岩');
 assert.equal(validateInput([literal,'森','星','川','塔'],'岩').ok,true);
 assert.equal(validateInput(['x'.repeat(21),'森','星','川','塔'],'岩').ok,false);
 assert.equal(validateInput(['x'.repeat(20),'森','星','川','塔'],'岩').ok,true);
 for(const language of LANGUAGES){
  assert.deepEqual(Object.keys(TEXT[language]).sort(),keys);
  for(const key of keys)assert.ok(TEXT[language][key].trim(),`${language}:${key}`);
  assert.ok(districtName(model.tiles[0],language).includes(literal));
  const copy=landmarkCopy(model,language);assert.ok(copy.title);assert.ok(copy.text);
  const message=translate(language,'nextStep',{number:'03',face:'B',direction:translate(language,'right'),next:'04'});
  assert.ok(message.includes('03')&&message.includes('04')&&message.includes('B'));
  assert.ok(!/\{\w+\}/.test(message));
  assert.equal(translate(language,'districtPlace',{number:'01',name:literal}).includes(literal),true);
 }
 });

 test('changing locale updates labels without replacing or editing word fields, palette or audio state',()=>{
 const controls={language:{value:'en',addEventListener(){}},words:[{value:'<b>&</b>'},{value:'森'},{value:'星'},{value:'川'},{value:'塔'}],ban:{value:'岩'},palette:{value:'slate'},audio:{paused:true}};
 const textNode={dataset:{i18n:'plateHelp'},textContent:''};
 const ariaNode={dataset:{i18nAria:'forward'},setAttribute(name,value){this[name]=value;}};
 const root={documentElement:{lang:''},title:'',getElementById:id=>controls[id],querySelectorAll:selector=>selector==='[data-i18n]'?[textNode]:[ariaNode]};
 const before=JSON.stringify(controls);
 const locale=createLocale(root);let changes=0;locale.subscribe(()=>changes++);
 for(const language of LANGUAGES){
  assert.equal(locale.setLanguage(language),true);assert.equal(root.documentElement.lang,language);
  assert.equal(textNode.textContent,TEXT[language].plateHelp);assert.equal(ariaNode['aria-label'],TEXT[language].forward);
  assert.equal(locale.validation('一語は20文字以内にしてください。'),TEXT[language].errorLength);
 }
 const after=JSON.stringify({...controls,language:{...controls.language,value:'en'}});
 assert.equal(after,before);assert.equal(changes,4);
 assert.equal(locale.setLanguage('unsupported'),false);assert.equal(changes,4);
 });

 test('world-building still supports banned shapes, all eight districts and view-relative walking',()=>{
 const model=buildWorld(['橋','森','星','水','塔'],'岩');
 assert.equal(model.tiles.length,8);assert.equal(model.landmark.tile,2);
 assert.ok(model.tiles.every(tile=>tile.type!=='rock'));
 for(const x of [-24,-8,8,24])assert.equal(canStand(x,0,model.tiles),true);
 assert.deepEqual(movementDelta(1,0,0,1),{dx:0,dz:-1});
 const changed=buildWorld(['橋','塔','星','水','塔'],'岩');
 assert.deepEqual(model.tiles[3],changed.tiles[3]);assert.notEqual(model.tiles[1].type,changed.tiles[1].type);
 });

 test('integration keeps original assets, local renderer, fallback controls and safe text sinks',()=>{
 const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('./app.mjs',import.meta.url),'utf8');
 const plate=readFileSync(new URL('./plate-walk.mjs',import.meta.url),'utf8');
 const locale=readFileSync(new URL('./locale.mjs',import.meta.url),'utf8');
 assert.match(html,/<html lang='en'>/);
 assert.match(html,/src='\.\/bgm\.mp3'/);assert.match(html,/href='\.\/style\.css'/);assert.match(html,/src='\.\/app\.mjs'/);
 assert.match(app,/import\('\.\/vendor\/three\.module\.min\.js'\)/);
 assert.match(app,/plate\.mountRenderer\(THREE,\{scene,camera,world,lowPower\}\)/);
 assert.match(app,/plate\.setActive\(false\)/);
 assert.match(app,/webglcontextlost/);assert.match(app,/plate\.setFallback\(true\)/);
 assert.equal((html.match(/data-plate-move=/g)||[]).length,4);
 assert.equal((html.match(/name='word' maxlength='20'/g)||[]).length,5);
 assert.match(plate,/visibilitychange/);assert.match(plate,/lostpointercapture/);assert.match(plate,/window\.addEventListener\('blur',stop\)/);
 assert.match(app,/bgm\.pause\(\)/);
 for(const source of [app,plate,locale]){
  assert.doesNotMatch(source,/\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\b/);
  assert.doesNotMatch(source,/innerHTML|outerHTML|insertAdjacentHTML|\beval\s*\(/);
 }
 const declared=[...html.matchAll(/data-i18n(?:-aria)?='([^']+)'/g)].map(match=>match[1]);
 for(const language of LANGUAGES)for(const key of declared)assert.ok(TEXT[language][key],`${language}:${key}`);
 });
