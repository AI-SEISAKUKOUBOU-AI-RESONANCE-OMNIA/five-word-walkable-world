export const PLATE_START=Object.freeze({x:0,z:2.8});
export const PLATE_ROUTE=Object.freeze([[0,0],[0,-2.8],[0,-5.6],[2.8,-5.6],[5.6,-5.6],[5.6,-8.4],[5.6,-11.2],[2.8,-11.2],[0,-11.2],[0,-14]].map(([x,z])=>Object.freeze({x,z})));
export const PALETTES=Object.freeze({sand:Object.freeze(['#b9b3a3','#69857c']),slate:Object.freeze(['#667986','#c1a674']),clay:Object.freeze(['#cbc4b4','#626b72'])});
export const SUPPORT_Y=0.16;
export const PLATE_HALF_WIDTH=1.08;
export const PLATE_HALF_HEIGHT=0.15;
const vectors=Object.freeze({forward:[0,-1],backward:[0,1],left:[-1,0],right:[1,0]});
const smooth=t=>t*t*(3-2*t);
const number=index=>String(index+1).padStart(2,'0');
export function routeDirection(from,to){
 const dx=to.x-from.x,dz=to.z-from.z;
 if(Math.abs(dx)>Math.abs(dz))return dx>0?'right':'left';
 return dz>0?'backward':'forward';
}
export function createWalkState(){
 return {phase:'opening',opening:0.55,index:-1,position:{...PLATE_START},move:null,flip:null,flips:Array(10).fill(0),visited:new Set(),entries:0,edge:false};
}
export function beginWalkMove(state,direction,{reducedMotion=false}={}){
 if(!Object.hasOwn(vectors,direction))return {ok:false,reason:'direction'};
 if(state.phase==='complete')return {ok:false,reason:'complete'};
 if(state.phase!=='ready')return {ok:false,reason:'busy'};
 const origin=state.index<0?PLATE_START:PLATE_ROUTE[state.index];
 const candidates=state.index<0?[0]:[state.index-1,state.index+1];
 const target=candidates.find(index=>index>=-1 && index<PLATE_ROUTE.length && routeDirection(origin,index<0?PLATE_START:PLATE_ROUTE[index])===direction);
 if(target===undefined){state.edge=true;return {ok:false,reason:'edge'};}
 state.edge=false;
 state.phase='walking';
 state.move={from:{...origin},to:{...(target<0?PLATE_START:PLATE_ROUTE[target])},target,elapsed:0,duration:reducedMotion?0.28:0.52,reducedMotion};
 return {ok:true,target};
}
export function tickWalk(state,seconds,{reducedMotion=false}={}){
 if(!Number.isFinite(seconds)||seconds<=0)return;
 const dt=Math.min(0.1,seconds);
 if(state.phase==='opening'){
  state.opening=Math.max(0,state.opening-dt);
  if(state.opening===0)state.phase='ready';
  return;
 }
 if(state.phase==='walking'){
  const move=state.move;
  move.elapsed=Math.min(move.duration,move.elapsed+dt);
  const t=smooth(move.elapsed/move.duration);
  state.position.x=move.from.x+(move.to.x-move.from.x)*t;
  state.position.z=move.from.z+(move.to.z-move.from.z)*t;
  if(move.elapsed<move.duration)return;
  state.index=move.target;state.position={...move.to};state.move=null;
  if(state.index<0){state.phase='ready';return;}
  const index=state.index;
  state.flips[index]++;state.entries++;state.visited.add(index);
  state.flip={index,elapsed:0,duration:reducedMotion?0.18:0.72,fromAngle:(state.flips[index]-1)*Math.PI,toAngle:state.flips[index]*Math.PI};
  state.phase='turning';return;
 }
 if(state.phase==='turning'){
  state.flip.elapsed=Math.min(state.flip.duration,state.flip.elapsed+dt);
  if(state.flip.elapsed<state.flip.duration)return;
  state.flip=null;
  state.phase=state.index===PLATE_ROUTE.length-1 && state.visited.size===PLATE_ROUTE.length?'complete':'ready';
 }
}
// The entire rotating assembly (including grooves) fits these conservative bounds.
// Its top stays below the fixed walk rail, even at a vertical half-turn.
export function platePose(angle){
 const extent=PLATE_HALF_WIDTH*Math.abs(Math.sin(angle))+PLATE_HALF_HEIGHT*Math.abs(Math.cos(angle));
 return {angle,y:SUPPORT_Y-0.08-extent,extent};
}
export function canSupportWalkPosition(x,z){
 if(!Number.isFinite(x)||!Number.isFinite(z))return false;
 const nodes=[PLATE_START,...PLATE_ROUTE];
 return nodes.slice(1).some((b,i)=>{
  const a=nodes[i],dx=b.x-a.x,dz=b.z-a.z;
  const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));
  return Math.hypot(x-a.x-t*dx,z-a.z-t*dz)<=0.19;
 });
}
export function cameraPlan(position,next,aspect,focusOverride){
 const safeAspect=Number.isFinite(aspect)&&aspect>0?aspect:1;
 const ideal={x:(position.x+next.x)/2,y:0.8,z:(position.z+next.z)/2};
 const focus=focusOverride??ideal;
 const drift=Math.hypot(focus.x-ideal.x,focus.y-ideal.y,focus.z-ideal.z);
 const radius=Math.max(3.2,Math.hypot(Math.hypot(position.x-next.x,position.z-next.z)/2+1.55,1.6))+drift;
 const verticalFov=48*Math.PI/180;
 const horizontalFov=2*Math.atan(Math.tan(verticalFov/2)*safeAspect);
 const distance=radius/Math.sin(Math.min(verticalFov,horizontalFov)/2)+0.6;
 const norm=Math.hypot(0.27,0.68,0.68);
 const offset={x:0.27/norm,y:0.68/norm,z:0.68/norm};
 return {focus:{...focus},radius,distance,verticalFov,horizontalFov,offset,camera:{x:focus.x+offset.x*distance,y:focus.y+offset.y*distance,z:focus.z+offset.z*distance}};
}

export function createPlateWalk({document:root,locale,onMode=()=>{}}){
 let state=createWalkState(),active=false,fallback=false,view=null;
 const held=new Map();
 const media=window.matchMedia('(prefers-reduced-motion: reduce)');
 const gentle=root.getElementById('gentle');
 gentle.checked=media.matches;
 let reduced=gentle.checked;
 const status=root.getElementById('plate-status');
 const progress=root.getElementById('plate-progress');
 const list=root.getElementById('plate-route');
 const palette=root.getElementById('palette');
 const routeItems=PLATE_ROUTE.map(()=>{const item=root.createElement('li');list.append(item);return item;});
 let cameraFresh=true;
 function write(node,text){if(node.textContent!==text)node.textContent=text;}
 function next(){return PLATE_ROUTE[Math.min(9,state.index+1)];}
 function sync(){
  const face=state.index<0?'A':state.flips[state.index]%2?'B':'A';
  let key=state.phase==='opening'?'opening':state.phase==='complete'?'complete':state.phase==='walking'?'walking':state.phase==='turning'?'turning':state.index<0?'invitation':'nextStep';
  const args={number:number(state.phase==='walking'?state.move.target:state.index),face,direction:locale.t(routeDirection(state.position,next())),next:number(Math.min(9,state.index+1))};
  let message=locale.t(key,args);
  if(state.edge)message+=' '+locale.t('edge');
  if(fallback)message+=' '+locale.t('fallbackNote');
  write(status,message);
  const place=state.index<0?locale.t('start'):locale.t('platePlace',{number:number(state.index),face:state.phase==='turning'?locale.t('flipLabel'):face});
  write(progress,locale.t('plateProgress',{n:state.visited.size,entries:state.entries,place}));
  routeItems.forEach((item,index)=>{
   const here=index===state.index;
   write(item,locale.t('routeItem',{number:number(index),face:state.flip?.index===index?locale.t('flipLabel'):state.flips[index]%2?'B ≋':'A −',status:here?locale.t('current'):locale.t(state.visited.has(index)?'reached':'unreached')}));
   item.classList.toggle('visited',state.visited.has(index));item.classList.toggle('current',here);
   if(here)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');
  });
  root.getElementById('plate-mode').setAttribute('aria-pressed',String(active));
  root.getElementById('world-mode').setAttribute('aria-pressed',String(!active));
  root.getElementById('plate-tools').hidden=!active;
  progress.hidden=!active;root.getElementById('progress').hidden=active;
  root.getElementById('world-scene-label').hidden=active;
  root.getElementById('plate-scene-label').hidden=!active;
  root.getElementById('overview').disabled=active;
  const hint=root.getElementById('scene-hint');hint.dataset.i18n=active?'plateHint':'worldHint';write(hint,locale.t(hint.dataset.i18n));
  if(view){view.group.visible=active;view.world.visible=!active;view.endLabel(locale.t('endpoint'));}
 }
 const interactive='input,textarea,select,button,a,[contenteditable]';
 function protectedFocus(){
  const node=root.activeElement?.closest?.(interactive);
  return Boolean(node && !(node.dataset?.plateMove || node.dataset?.move));
 }
 function stop(){held.clear();}
 function heldDirection(){
  const directions=new Set([...held.values()].map(input=>input.direction));
  const forward=Number(directions.has('forward'))-Number(directions.has('backward'));
  const side=Number(directions.has('right'))-Number(directions.has('left'));
  return (forward!==0)!==(side!==0)?forward?forward>0?'forward':'backward':side>0?'right':'left':null;
 }
 function press(id,direction){
  if(!active || root.hidden || protectedFocus() || held.has(id) || !Object.hasOwn(vectors,direction))return;
  // Busy presses participate in cancellation, but never become deferred moves.
  const eligible=state.phase==='ready';
  held.set(id,{direction,eligible,tapPending:eligible});
  const selected=heldDirection();
  held.forEach(input=>{if(input.direction!==selected)input.tapPending=false;});
 }
 function command(direction){
  if(!active || root.hidden || protectedFocus())return;
  // A frame or release consumes every pending tap in the current input chord.
  if(state.phase==='ready')held.forEach(input=>{input.tapPending=false;});
  const result=beginWalkMove(state,direction,{reducedMotion:reduced});sync();return result;
 }
 function release(id,cancelled=false){
  const input=held.get(id);
  if(!input)return;
  // Down/up can both occur between frames. Commit that tap before deleting it.
  // A held move already consumed it, and cancellation never commits a tap.
  if(!cancelled && input.eligible && input.tapPending && state.phase==='ready' && heldDirection()===input.direction)command(input.direction);
  held.delete(id);
 }
 const keyMap={w:'forward',arrowup:'forward',s:'backward',arrowdown:'backward',a:'left',arrowleft:'left',d:'right',arrowright:'right'};
 window.addEventListener('keydown',event=>{
  if(!active || event.target?.closest?.(interactive))return;
  const key=event.key.toLowerCase();
  if(!Object.hasOwn(keyMap,key))return;
  event.preventDefault();
  if(!event.repeat)press('key:'+key,keyMap[key]);
 });
 window.addEventListener('keyup',event=>release('key:'+event.key.toLowerCase(),Boolean(event.target?.closest?.(interactive))));
 window.addEventListener('blur',stop);
 root.addEventListener('visibilitychange',()=>{if(root.hidden)stop();});
 root.addEventListener('focusin',()=>{if(protectedFocus())stop();});
 root.querySelectorAll('[data-move],[data-plate-move]').forEach(button=>{
  const direction=button.dataset.plateMove??button.dataset.move;
  let pointerClick=false;
  button.addEventListener('pointerdown',event=>{
   // Retain this marker until the compatibility click, even after cancellation.
   pointerClick=true;
   if(!active || root.hidden || (event.button!==undefined && event.button!==0))return;
   event.preventDefault();
   button.focus?.({preventScroll:true});
   press('pointer:'+event.pointerId,direction);
   try{button.setPointerCapture(event.pointerId);}catch{}
  });
  button.addEventListener('pointerup',event=>release('pointer:'+event.pointerId));
  for(const name of ['pointercancel','lostpointercapture'])button.addEventListener(name,event=>release('pointer:'+event.pointerId,true));
  button.addEventListener('keydown',event=>{
   if(event.key==='Enter' || event.key===' ' || event.key==='Spacebar')pointerClick=false;
  });
  button.addEventListener('click',event=>{
   if(pointerClick){pointerClick=false;return;}
   if(event.detail===0 && !event.pointerType)command(direction);
  });
 });
 root.getElementById('plate-mode').addEventListener('click',()=>api.setActive(true));
 root.getElementById('world-mode').addEventListener('click',()=>api.setActive(false));
 root.getElementById('plate-reset').addEventListener('click',()=>{api.setActive(true);api.reset();});
 gentle.addEventListener('change',()=>{reduced=gentle.checked;sync();});
 media.addEventListener?.('change',event=>{reduced=event.matches;gentle.checked=reduced;sync();});
 palette.addEventListener('change',()=>{
  if(!Object.hasOwn(PALETTES,palette.value))palette.value='sand';
  view?.setPalette(palette.value);sync();
 });
 locale.subscribe(sync);
 let last=performance.now();
 function advance(now){
  requestAnimationFrame(advance);
  const dt=Math.max(0,Math.min(0.05,(now-last)/1000));last=now;
  if(!active || root.hidden){stop();return;}
  // Editing or focusing reset cancels input, not the opening or a committed step.
  // Keep animation advancing while focus remains on an interactive control.
  if(protectedFocus())stop();
  if(state.phase==='ready' && held.size){
   // Opposing simultaneous controls cancel; no random diagonal choice.
   const direction=heldDirection();
   if(direction && [...held.values()].some(input=>input.eligible && input.direction===direction))command(direction);
  }
  tickWalk(state,dt,{reducedMotion:reduced});sync();
 }
 requestAnimationFrame(advance);
 const api={
  get active(){return active;},
  setActive(value){active=Boolean(value);stop();cameraFresh=true;onMode(active);sync();},
  reset(){state=createWalkState();stop();cameraFresh=true;sync();},
  stop,
  setFallback(value){fallback=Boolean(value);stop();sync();},
  mountRenderer(THREE,options){view=buildGallery(THREE,options,root);view.setPalette(palette.value);sync();},
  render(dt){if(!view || !active)return;view.draw(state,{dt,reduced,next:next(),cameraFresh});cameraFresh=false;}
 };
 sync();return api;
}

function buildGallery(THREE,{scene,camera,world,lowPower},root){
 const group=new THREE.Group();scene.add(group);
 const stone=new THREE.MeshStandardMaterial({color:'#a5a59d',roughness:0.93});
 const pale=new THREE.MeshStandardMaterial({color:'#c5beb0',roughness:0.87});
 const dark=new THREE.MeshStandardMaterial({color:'#454e54',roughness:0.92});
 const metal=new THREE.MeshStandardMaterial({color:'#88795f',metalness:0.62,roughness:0.55});
 const railMat=new THREE.MeshStandardMaterial({color:'#d3bc8d',metalness:0.65,roughness:0.4});
 const faceA=new THREE.MeshStandardMaterial({roughness:0.78,metalness:0.12,color:PALETTES.sand[0]});
 const faceB=new THREE.MeshStandardMaterial({roughness:0.53,metalness:0.42,color:PALETTES.sand[1]});
 const groove=new THREE.MeshStandardMaterial({color:'#303c40',roughness:0.7});
 const lit=new THREE.MeshStandardMaterial({color:'#ddc59e',emissive:'#f1bf78',emissiveIntensity:0.15,roughness:0.6});
 function mesh(parent,geometry,material,x=0,y=0,z=0,cast=true){
  const object=new THREE.Mesh(geometry,material);object.position.set(x,y,z);object.castShadow=cast&&!lowPower;object.receiveShadow=true;parent.add(object);return object;
 }
 function box(parent,w,h,d,mat,x=0,y=0,z=0,cast=true){return mesh(parent,new THREE.BoxGeometry(w,h,d),mat,x,y,z,cast);}
 function bevel(parent,w,h,d,mat,x,y,z){
  const shape=new THREE.Shape();
  shape.moveTo(-w/2,-d/2);shape.lineTo(w/2,-d/2);shape.lineTo(w/2,d/2);shape.lineTo(-w/2,d/2);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:Math.max(0.01,h-0.08),bevelEnabled:true,bevelThickness:0.04,bevelSize:0.035,bevelSegments:lowPower?1:2,steps:1});
  geometry.rotateX(-Math.PI/2);geometry.translate(0,-(h-0.08)/2,0);
  return mesh(parent,geometry,mat,x,y,z);
 }
 function label(text,parent,x,y,z,scale=0.65){
  const canvas=root.createElement('canvas');canvas.width=256;canvas.height=128;
  const context=canvas.getContext('2d');
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:true}));
  sprite.position.set(x,y,z);sprite.scale.set(scale*2,scale,1);parent.add(sprite);
  let previous;
  function set(value){if(previous===value)return;previous=value;context.clearRect(0,0,256,128);context.fillStyle='#ddd3ba';context.font='700 48px system-ui';context.textAlign='center';context.textBaseline='middle';context.fillText(value,128,64,244);texture.needsUpdate=true;}
  set(text);return set;
 }
 // Recesses are deep enough for the full plate sweep. The support is separate.
 box(group,22,0.6,27,dark,2.8,-3.1,-6);
 for(let i=0;i<9;i++){
  box(group,22,0.05,0.018,metal,2.8,-2.77,-18+i*3);
 }
 const nodes=[PLATE_START,...PLATE_ROUTE];
 nodes.slice(1).forEach((b,i)=>{
  const a=nodes[i],dx=b.x-a.x,dz=b.z-a.z;
  // Continuous fixed stone rail underneath the walker, including plate centers.
  box(group,Math.abs(dx)+0.4,0.24,Math.abs(dz)+0.4,metal,(a.x+b.x)/2,SUPPORT_Y-0.12,(a.z+b.z)/2);
  box(group,Math.abs(dx)+0.23,0.022,Math.abs(dz)+0.23,railMat,(a.x+b.x)/2,SUPPORT_Y-0.011,(a.z+b.z)/2,false);
 });
 bevel(group,2.35,0.35,2.35,pale,PLATE_START.x,-0.09,PLATE_START.z);
 const plates=[];
 PLATE_ROUTE.forEach((point,index)=>{
  const base=new THREE.Group();base.position.set(point.x,0,point.z);group.add(base);
  bevel(base,2.65,0.22,2.65,stone,0,-2.63,0);
  for(const side of [-1,1]){
   box(base,0.13,2.5,2.48,dark,side*1.24,-1.35,0);
   box(base,2.48,2.5,0.13,dark,0,-1.35,side*1.24);
   bevel(base,0.22,0.17,2.64,pale,side*1.31,-0.03,0);
   bevel(base,2.64,0.17,0.22,pale,0,-0.03,side*1.31);
   for(const corner of [-1,1])mesh(base,new THREE.CylinderGeometry(0.055,0.055,0.025,8),metal,side*1.31,0.07,corner*1.08,false);
   mesh(base,new THREE.CylinderGeometry(0.065,0.065,2.4,8),metal,0,-1.31,side*1.18);
  }
  const pivot=new THREE.Group();base.add(pivot);
  const deck=new THREE.Group();pivot.add(deck);
  bevel(deck,2.04,0.16,2.04,metal,0,0,0);
  for(const [sign,mat,count] of [[1,faceA,1],[-1,faceB,2]]){
   box(deck,1.97,0.025,1.97,mat,0,sign*0.098,0);
   for(let n=0;n<count;n++){
    box(deck,0.028,0.012,1.58,groove,(n-(count-1)/2)*0.2,sign*0.118,0,false);
   }
   for(const side of [-1,1]){
    box(deck,1.83,0.008,0.015,railMat,0,sign*0.12,side*0.86,false);
    box(deck,0.015,0.008,1.83,railMat,side*0.86,sign*0.12,0,false);
   }
  }
  for(const sign of [-1,1]){
   const axle=mesh(pivot,new THREE.CylinderGeometry(0.105,0.105,0.28,12),metal,0,0,sign*1.12);
   axle.rotation.x=Math.PI/2;
   const bearing=mesh(pivot,new THREE.TorusGeometry(0.145,0.032,6,16),railMat,0,0,sign*1.23);
   bearing.rotation.y=0;
  }
  const lampMat=lit.clone();
  box(base,0.14,0.14,0.56,lampMat,-1.3,0.12,0,false);
  label(number(index),base,-1.53,0.55,0,0.4);
  const contact=mesh(base,new THREE.PlaneGeometry(2.5,2.5),new THREE.MeshBasicMaterial({color:'#111a20',transparent:true,opacity:0.25,depthWrite:false}),0,-2.49,0,false);contact.rotation.x=-Math.PI/2;
  plates.push({pivot,deck,lampMat});
 });
 // Repeated piers, inset seams and layered arches make distance visible without textures.
 for(const side of [-1,1]){
  for(let i=0;i<6;i++){
   const x=side<0?-4.2:10,z=4-i*4.2;
   bevel(group,1.2,0.28,1.2,pale,x,-0.1,z);
   box(group,0.66,4.2,0.72,stone,x,2.05,z);
   box(group,0.12,3.6,0.055,metal,x,2.1,z+0.38);
   bevel(group,1.12,0.25,1.05,pale,x,4.18,z);
   for(let seam=1;seam<=4;seam++)box(group,0.69,0.013,0.025,dark,x,seam*0.78,z+0.37,false);
   box(group,0.14,0.42,0.14,lit,x,2.8,z+0.43,false);
  }
  box(group,0.6,0.4,25,stone,side<0?-4.2:10,4.4,-6.5);
 }
 for(let layer=0;layer<3;layer++){
  const z=-18-layer*8,span=8+layer*4,height=5+layer*2;
  const mat=layer===0?stone:dark;
  for(const side of [-1,1])box(group,0.85,height,1.4,mat,2.8+side*span/2,height/2-0.5,z);
  const arch=mesh(group,new THREE.TorusGeometry(span/2,0.35,6,lowPower?16:32,Math.PI),mat,2.8,height-0.5,z,false);
  arch.rotation.z=0;
 }
 const end=PLATE_ROUTE[9];
 for(const side of [-1,1]){
  bevel(group,0.45,3.1,0.55,pale,end.x+side*1.8,1.45,end.z-0.5);
 }
 const portal=mesh(group,new THREE.TorusGeometry(1.8,0.16,8,32,Math.PI),railMat,end.x,2.95,end.z-0.5);
 portal.rotation.z=0;
 const endLabel=label('END',group,end.x,3.65,end.z-0.48,0.65);
 const gateLeaves=[];
 for(const side of [-1,1]){
  const hinge=new THREE.Group();hinge.position.set(end.x+side*1.7,0.15,end.z-0.7);group.add(hinge);
  box(hinge,1.6,2.45,0.09,metal,-side*0.8,1.2,0);
  for(let i=0;i<4;i++)box(hinge,0.04,2.25,0.13,railMat,-side*(0.18+i*0.39),1.2,0.02);
  gateLeaves.push({hinge,side});
 }
 const endGlow=new THREE.PointLight('#ffd2a1',0,9,2);endGlow.position.set(end.x,2,end.z-1);group.add(endGlow);
 const dustPositions=[];
 for(let i=0;i<(lowPower?8:20);i++)dustPositions.push(-2+(i*37%100)/10,0.9+(i*13%24)/10,-(i*29%160)/10);
 const dustGeometry=new THREE.BufferGeometry();dustGeometry.setAttribute('position',new THREE.Float32BufferAttribute(dustPositions,3));
 const dust=new THREE.Points(dustGeometry,new THREE.PointsMaterial({color:'#d8c8a2',size:0.035,transparent:true,opacity:0.28,depthWrite:false}));group.add(dust);
 const pawn=new THREE.Group();group.add(pawn);
 const coat=new THREE.MeshStandardMaterial({color:'#d4cbb5',roughness:0.74,metalness:0.16});
 const boots=new THREE.MeshStandardMaterial({color:'#334249',roughness:0.68,metalness:0.3});
 mesh(pawn,new THREE.CylinderGeometry(0.2,0.28,0.57,10),coat,0,0.73,0);
 mesh(pawn,new THREE.SphereGeometry(0.18,12,8),metal,0,1.23,0);
 box(pawn,0.12,0.05,0.12,dark,0,1.24,-0.15);
 const legs=[];
 for(const side of [-1,1]){
  const leg=new THREE.Group();leg.position.set(side*0.13,0,0);pawn.add(leg);
  mesh(leg,new THREE.CylinderGeometry(0.065,0.075,0.4,7),boots,0,0.3,0);
  box(leg,0.16,0.13,0.29,boots,0,0.065,-0.04);legs.push(leg);
 }
 const pawnShadow=mesh(group,new THREE.CircleGeometry(0.43,24),new THREE.MeshBasicMaterial({color:'#162328',transparent:true,opacity:0.25,depthWrite:false}),0,SUPPORT_Y+0.002,2.8,false);pawnShadow.rotation.x=-Math.PI/2;
 let focus=null,camDistance=0;
 return {
  group,world,endLabel,
  setPalette(id){const pair=PALETTES[id]??PALETTES.sand;faceA.color.set(pair[0]);faceB.color.set(pair[1]);},
  draw(state,{dt,reduced,next,cameraFresh}){
   plates.forEach((plate,index)=>{
    let angle=state.flips[index]*Math.PI;
    if(state.flip?.index===index){
     const t=state.flip.elapsed/state.flip.duration;
     angle=reduced?(t<0.5?state.flip.fromAngle:state.flip.toAngle):state.flip.fromAngle+(state.flip.toAngle-state.flip.fromAngle)*smooth(t);
    }
    const pose=platePose(angle);plate.pivot.position.y=pose.y;plate.deck.rotation.z=angle;
    plate.lampMat.emissiveIntensity=state.visited.has(index)?0.9:index===state.index+1?0.48:0.1;
   });
   pawn.position.set(state.position.x,SUPPORT_Y,state.position.z);
   pawnShadow.position.set(state.position.x,SUPPORT_Y+0.002,state.position.z);
   if(state.move){
    pawn.rotation.y=Math.atan2(state.move.to.x-state.move.from.x,state.move.to.z-state.move.from.z)+Math.PI;
    const t=state.move.elapsed/state.move.duration;
    // Feet lift only during a supported step, and settle before the entry flip.
    legs.forEach((leg,i)=>{leg.position.y=reduced?0:Math.max(0,Math.sin(t*Math.PI*4+i*Math.PI))*0.065;leg.position.z=reduced?0:Math.sin(t*Math.PI*4+i*Math.PI)*0.065;});
   }else legs.forEach(leg=>{leg.position.y=0;leg.position.z=0;});
   const complete=state.phase==='complete';
   gateLeaves.forEach(({hinge,side})=>{const target=complete?side*1.15:0;hinge.rotation.y=reduced||cameraFresh?target:hinge.rotation.y+(target-hinge.rotation.y)*(1-Math.exp(-5*dt));});
   endGlow.intensity=complete?5:state.visited.size*0.12;
   dust.visible=!reduced;
   dust.material.opacity=0.16+state.visited.size*0.012;
   const ideal=cameraPlan(state.position,next,camera.aspect);
   if(cameraFresh || !focus){focus=new THREE.Vector3(ideal.focus.x,ideal.focus.y,ideal.focus.z);camDistance=0;}
   else focus.lerp(new THREE.Vector3(ideal.focus.x,ideal.focus.y,ideal.focus.z),reduced?1:1-Math.exp(-6*dt));
   const plan=cameraPlan(state.position,next,camera.aspect,focus);
   // Expand immediately after portrait resize; ease only inward, never crop support.
   camDistance=Math.max(plan.distance,camDistance+(plan.distance-camDistance)*(1-Math.exp(-5*dt)));
   camera.fov=48;camera.far=Math.max(210,camDistance+100);camera.updateProjectionMatrix();
   camera.position.set(focus.x+plan.offset.x*camDistance,focus.y+plan.offset.y*camDistance,focus.z+plan.offset.z*camDistance);
   camera.lookAt(focus);
  }
 };
}
