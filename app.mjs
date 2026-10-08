export const TYPES = Object.freeze(['bridge','tower','tree','rock','lamp','water']);
const TYPE_NAMES = Object.freeze({bridge:'橋',tower:'塔',tree:'樹',rock:'岩',lamp:'灯',water:'水'});
const ALIASES = Object.freeze({bridge:['橋'],tower:['塔'],tree:['樹','森','木'],rock:['岩','山'],lamp:['灯','光'],water:['水','川','湖']});
const WORD_TYPES = new Map(Object.entries(ALIASES).flatMap(([type, words]) => words.map(word => [word,type])));
const CENTERS = [-24,-8,8,24];
const DEFAULT_TYPES = ['bridge','tree','lamp','water','tower','rock','tree','bridge'];
const SPAWN = Object.freeze({x:-8,z:0,yaw:0.08,pitch:-0.2});

export function validateInput(words, ban) {
  if (!Array.isArray(words) || words.length !== 5) return {ok:false,error:'言葉を五つ入力してください。'};
  const clean = words.map(value => String(value ?? '').trim().normalize('NFC'));
  if (clean.some(value => !value)) return {ok:false,error:'五つの言葉をすべて入力してください。'};
  if (clean.some(value => [...value].length > 20)) return {ok:false,error:'一語は20文字以内にしてください。'};
  const banText = String(ban ?? '').trim().normalize('NFC');
  if (!banText || [...banText].length > 20) return {ok:false,error:'禁止要素を一つ、20文字以内で入力してください。'};
  const bannedType = WORD_TYPES.get(banText);
  if (!bannedType) return {ok:false,error:'その禁止要素には対応していません。橋・塔・樹（森／木）・岩（山）・灯（光）・水（川／湖）から選んでください。'};
  return {ok:true,words:clean,bannedType,bannedLabel:TYPE_NAMES[bannedType]};
}

function hash(text) {
  let n = 2166136261;
  for (const char of text) { n ^= char.codePointAt(0); n = Math.imul(n,16777619); }
  return n >>> 0;
}
function allowedType(type, bannedType) {
  let index = TYPES.indexOf(type);
  while (TYPES[index] === bannedType) index = (index + 1) % TYPES.length;
  return TYPES[index];
}
export function buildWorld(words, ban) {
  const checked = validateInput(words,ban);
  if (!checked.ok) throw new Error(checked.error);
  const forbiddenWords = ALIASES[checked.bannedType];
  const tiles = Array.from({length:8}, (_, index) => {
    const row = Math.floor(index / 4);
    const col = index % 4;
    const word = checked.words[index % 5];
    const seed = hash(word + '|' + index);
    const known = WORD_TYPES.get(word);
    const type = allowedType(known ?? DEFAULT_TYPES[index],checked.bannedType);
    const unsafeLabel = known === checked.bannedType || forbiddenWords.some(term => word.includes(term));
    const label = unsafeLabel ? '小径' : word;
    const x = CENTERS[col];
    const z = row === 0 ? -9 : 9;
    return {index,row,col,x,z,wordIndex:index % 5,type,label,name:label + 'の' + TYPE_NAMES[type] + '区',seed,height:0.6 + seed % 6 * 0.26,objectX:x + (seed % 2 ? 3.2 : -3.2),objectZ:z + (seed % 4 < 2 ? 3.1 : -3.1)};
  });
  const focus = tiles[2];
  return {tiles,words:checked.words,bannedType:checked.bannedType,bannedLabel:checked.bannedLabel,landmark:{tile:2,title:focus.label + 'の見晴らし',text:'ここでは' + focus.label + 'の気配が道の先に重なります。近づいて、光の向こうを見回してみてください。'},map:tiles.map(tile => tile.name)};
}

export function canOccupy(x,z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  if (Math.abs(x) <= 31.7 && Math.abs(z) <= 1.5) return true;
  if (Math.abs(z) <= 16.5 && CENTERS.some(cx => Math.abs(x - cx) <= 1.35)) return true;
  return CENTERS.some(cx => Math.abs(x - cx) <= 7.55) && (Math.abs(z + 9) <= 7.55 || Math.abs(z - 9) <= 7.55);
}

export function canStand(x,z,tiles) {
  if (!canOccupy(x,z)) return false;
  const radius={tower:3.4,tree:2.6,rock:2.5,lamp:1.1};
  return tiles.every(tile => !radius[tile.type] || Math.hypot(x-tile.objectX,z-tile.objectZ)>=radius[tile.type]);
}

export function movementDelta(forward,side,yaw,distance) {
  const length=Math.hypot(forward,side)||1;
  return {dx:(-forward*Math.sin(yaw)+side*Math.cos(yaw))*distance/length,
    dz:(-forward*Math.cos(yaw)-side*Math.sin(yaw))*distance/length};
}

function boot() {
  const canvas = document.getElementById('scene');
  const fallback = document.getElementById('fallback');
  const form = document.getElementById('world-form');
  const state = document.getElementById('state');
  const mapList = document.getElementById('map-list');
  const landmarkHeading = document.getElementById('landmark-heading');
  const landmarkText = document.getElementById('landmark-text');
  const bgm = document.getElementById('bgm');
  const bgmToggle = document.getElementById('bgm-toggle');
  const overviewButton = document.getElementById('overview');
  const progress = document.getElementById('progress');
  let current = buildWorld(['灯','森','水','樹','橋'],'岩');
  let updateScene = () => {};
  let setOverview = () => {};
  let resetView = () => {};
  let stopMoving = () => {};
  let resetVisitProgress = () => {};
  function showModel(model,message) {
    current = model;
    state.textContent = message;
    landmarkHeading.textContent = model.landmark.title;
    landmarkText.textContent = model.landmark.text;
    mapList.replaceChildren();
    model.tiles.forEach(tile => {
      const item = document.createElement('li');
      if (tile.index === model.landmark.tile) item.className = 'landmark-cell';
      const number = document.createElement('span');
      number.className = 'number';
      number.textContent = String(tile.index + 1).padStart(2,'0');
      item.append(number,document.createTextNode(tile.name));
      mapList.append(item);
    });
  }
  showModel(current,'見本の世界が広がっています。五語を入力して、世界をつくってください。');
  form.addEventListener('submit', event => {
    event.preventDefault();
    const words = [...form.querySelectorAll('input[name=word]')].map(input => input.value);
    const ban = document.getElementById('ban').value;
    const checked = validateInput(words,ban);
    if (!checked.ok) { state.textContent = checked.error; return; }
    const model = buildWorld(words,ban);
    updateScene(model);
    resetView();
    showModel(model,'8区画を組み直しました。小径を歩き、近くの草花や名所を見回してみてください。');
    resetVisitProgress();
  });
  document.getElementById('reset').addEventListener('click',() => { resetView(); state.textContent = '出発地点に戻りました。中央の道から8区画を歩けます。'; });
  overviewButton.addEventListener('click',() => setOverview());
  document.getElementById('stop').addEventListener('click',() => { stopMoving(); state.textContent = '足を止めました。景色を見回せます。'; });
  bgm.volume = 0.18;
  bgm.pause();
  bgmToggle.addEventListener('click',async () => {
    if (!bgm.paused) {
      bgm.pause();
      bgmToggle.textContent = 'BGM: OFF';
      bgmToggle.setAttribute('aria-pressed','false');
      return;
    }
    try {
      bgm.volume = 0.18;
      await bgm.play();
      bgmToggle.textContent = 'BGM: ON';
      bgmToggle.setAttribute('aria-pressed','true');
    } catch {
      bgmToggle.textContent = 'BGM: OFF';
      bgmToggle.setAttribute('aria-pressed','false');
      state.textContent = 'BGMを再生できませんでした。世界の探索は続けられます。';
    }
  });
  let gl;
  try { gl = canvas.getContext('webgl2',{antialias:true}); } catch { gl = null; }
  if (!gl) { fallback.hidden = false; return; }
  import('./vendor/three.module.min.js').then(THREE => {
    try {
      const renderer = new THREE.WebGLRenderer({canvas,context:gl,antialias:true,powerPreference:'high-performance'});
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.18;
      const lowPower = (navigator.deviceMemory && navigator.deviceMemory <= 4) || matchMedia('(max-width: 600px)').matches;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,lowPower ? 1 : 1.5));
      renderer.shadowMap.enabled = !lowPower;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#596381');
      scene.fog = new THREE.FogExp2('#68738a',0.006);
      const sky=new THREE.Mesh(new THREE.SphereGeometry(145,32,16),new THREE.ShaderMaterial({
        side:THREE.BackSide,depthWrite:false,fog:false,
        vertexShader:'varying float h; void main(){h=position.y/145.0;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader:'varying float h; void main(){vec3 low=vec3(0.59,0.48,0.51);vec3 high=vec3(0.24,0.30,0.44);float t=smoothstep(-0.08,0.55,h);gl_FragColor=vec4(mix(low,high,t),1.0);}'
      }));
      sky.renderOrder=-100;scene.add(sky);
      const camera = new THREE.PerspectiveCamera(69,1,0.1,210);
      camera.rotation.order = 'YXZ';
      scene.add(new THREE.HemisphereLight('#b7c8e4','#516e61',2.35));
      const sun = new THREE.DirectionalLight('#ffcf9d',2.8);
      sun.position.set(-26,45,18);
      sun.castShadow = !lowPower;
      sun.shadow.mapSize.set(1024,1024);
      sun.shadow.camera.left = -48;
      sun.shadow.camera.right = 48;
      sun.shadow.camera.top = 30;
      sun.shadow.camera.bottom = -30;
      sun.shadow.bias = -0.0004;
      scene.add(sun);
      const world = new THREE.Group();
      scene.add(world);
      const pathMat = new THREE.MeshStandardMaterial({color:'#ac927c',roughness:0.99});
      const edgeMat = new THREE.MeshStandardMaterial({color:'#d7b896',roughness:0.99});
      function mesh(parent,geometry,material,x,y,z,cast=true) {
        const object = new THREE.Mesh(geometry,material);
        object.position.set(x,y,z);
        object.castShadow = cast;
        object.receiveShadow = true;
        parent.add(object);
        return object;
      }
      function box(parent,w,h,d,material,x,y,z) { return mesh(parent,new THREE.BoxGeometry(w,h,d),material,x,y,z); }
      const meadow = new THREE.MeshStandardMaterial({color:'#546f67',roughness:1,side:THREE.DoubleSide});
      const meadowGeometry=new THREE.PlaneGeometry(180,180,30,30);
      meadowGeometry.rotateX(-Math.PI/2);
      const meadowPositions=meadowGeometry.attributes.position;
      for(let i=0;i<meadowPositions.count;i++){
        const x=meadowPositions.getX(i),z=meadowPositions.getZ(i);
        meadowPositions.setY(i,-0.17+Math.sin(x*0.075)*0.07+Math.cos(z*0.055)*0.08);
      }
      meadowGeometry.computeVertexNormals();
      mesh(world,meadowGeometry,meadow,0,0,0,false);
      box(world,65,0.2,1.9,pathMat,0,-0.015,0,false);
      for (const cx of CENTERS) {
        box(world,1.7,0.21,33.2,pathMat,cx,-0.015,0,false);
        for (const z of [-1.55,1.55]) box(world,1.75,0.04,0.09,edgeMat,cx,0.105,z,false);
      }
      const leafLitterMat=new THREE.MeshStandardMaterial({color:'#987f68',roughness:1,side:THREE.DoubleSide});
      const leaves=new THREE.InstancedMesh(new THREE.PlaneGeometry(0.12,0.32),leafLitterMat,94);
      const leafDummy=new THREE.Object3D();
      for(let i=0;i<94;i++){
        const branch=i%4,x=branch===0?(i*13%57)-28:branch===1?CENTERS[i%4]+((i*17%13)-6)*0.12:branch===2?(i*19%61)-30:CENTERS[i%4]+((i*11%15)-7)*0.1;
        const z=branch%2===0?((i*7%19)-9)*0.055:(i*23%29)-14;
        leafDummy.position.set(x,0.117,z);
        leafDummy.rotation.set(-Math.PI/2,0,i*2.39996);
        leafDummy.scale.set(0.6+(i%5)*0.15,0.7+(i%3)*0.17,1);
        leafDummy.updateMatrix();leaves.setMatrixAt(i,leafDummy.matrix);
      }
      leaves.instanceMatrix.needsUpdate=true;leaves.castShadow=false;world.add(leaves);
      const stars=[];
      for(let i=0;i<92;i++) {
        const a=i*2.39996,r=49+(i%8)*8;
        stars.push(Math.cos(a)*r,21+(i%11)*2.6,Math.sin(a)*r);
      }
      const starGeometry=new THREE.BufferGeometry();
      starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));
      scene.add(new THREE.Points(starGeometry,new THREE.PointsMaterial({color:'#f7e8d4',size:0.26,sizeAttenuation:true,transparent:true,opacity:0.75})));
      const moss = ['#657d6a','#708368','#5e796e','#788872'];
      const stone = new THREE.MeshStandardMaterial({color:'#a6a699',roughness:0.98});
      const darkStone = new THREE.MeshStandardMaterial({color:'#828c88',roughness:0.98});
      const gold = new THREE.MeshStandardMaterial({color:'#bd935f',metalness:0,roughness:0.92});
      const amber = new THREE.MeshStandardMaterial({color:'#ffe0a2',emissive:'#efa64f',emissiveIntensity:0.72});
      const waterMat = new THREE.MeshStandardMaterial({color:'#6eafbf',metalness:0.14,roughness:0.3,transparent:true,opacity:0.9});
      const treeMat = new THREE.MeshStandardMaterial({color:'#467565',roughness:0.96});
      const leafMat = new THREE.MeshStandardMaterial({color:'#739073',roughness:0.97});
      const trunkMat = new THREE.MeshStandardMaterial({color:'#80675c',roughness:1});
      const shadowMat = new THREE.MeshBasicMaterial({color:'#354d4d',transparent:true,opacity:0.15,depthWrite:false});
      const grassMat=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1,side:THREE.DoubleSide});
      const flowerMat=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:0.85});
      const stemMat=new THREE.MeshStandardMaterial({color:'#739579',roughness:1});
      const shrubMat=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1});
      const flowerColors=['#f8e5c8','#dabed0','#f1c5a4','#d8e5cd'];
      const grassColors=['#65846f','#839c7d','#8fa589','#587b70'];
      const shrubColors=['#436b61','#5c7d68','#6f8569','#55796f'];
      function createTile(tile,bannedType) {
        const group = new THREE.Group();
        group.position.set(tile.x,0,tile.z);
        const groundMat = new THREE.MeshStandardMaterial({color:moss[tile.seed % moss.length],roughness:0.98});
        const ground=mesh(group,new THREE.CircleGeometry(8.75,15),groundMat,0,0.018,0,false);
        ground.rotation.x=-Math.PI/2;
        const hx = tile.objectX - tile.x;
        const hz = tile.objectZ - tile.z;
        if(tile.type!=='water'){
          const mound = mesh(group,new THREE.CylinderGeometry(2.4,3.9,0.35+tile.height*0.16,9),groundMat,hx*0.9,0.09+tile.height*0.08,hz*0.9);
          mound.rotation.y = tile.seed % 8 * Math.PI / 8;
        }
        let randomState=(tile.seed^0x9e3779b9)>>>0;
        const rand=()=>{randomState^=randomState<<13;randomState^=randomState>>>17;randomState^=randomState<<5;return(randomState>>>0)/4294967296;};
        const plantPosition=()=>{
          for(let attempt=0;attempt<40;attempt++){
            const x=(rand()-.5)*13.5,z=(rand()-.5)*13.5;
            if(Math.abs(x)>1.65&&Math.hypot(x-hx,z-hz)>2.4)return {x,z};
          }
          return {x:5,z:5};
        };
        const dummy=new THREE.Object3D();
        const turfMat=new THREE.MeshBasicMaterial({color:'#455e59',transparent:true,opacity:0.15,depthWrite:false,side:THREE.DoubleSide});
        for(let i=0;i<9;i++){
          const {x,z}=plantPosition();
          const patch=mesh(group,new THREE.CircleGeometry(1.0+rand()*0.75,9),turfMat,x,0.034,z,false);
          patch.rotation.x=-Math.PI/2;
          patch.scale.set(1.2,0.58+rand()*0.55,1);
        }
        const grass=new THREE.InstancedMesh(new THREE.ConeGeometry(0.09,0.58,3),grassMat,210);
        for(let i=0;i<210;i++){
          const {x,z}=plantPosition();
          dummy.position.set(x,0.29,z);
          dummy.rotation.set((rand()-.5)*0.3,rand()*Math.PI*2,(rand()-.5)*0.3);
          dummy.scale.set(0.75+rand()*0.75,0.65+rand()*0.9,0.75+rand()*0.75);
          dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);
          grass.setColorAt(i,new THREE.Color(grassColors[(i+tile.index+Math.floor(rand()*3))%grassColors.length]));
        }
        grass.instanceMatrix.needsUpdate=true;grass.instanceColor.needsUpdate=true;
        grass.castShadow=false;grass.receiveShadow=false;group.add(grass);
        const stems=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025,0.035,0.38,4),stemMat,42);
        const flowers=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.12,0),flowerMat,42);
        for(let i=0;i<42;i++){
          const {x,z}=plantPosition(),height=0.28+rand()*0.25;
          dummy.position.set(x,height*0.5+0.06,z);dummy.rotation.set(0,rand()*6.28,0);dummy.scale.set(1,height/0.38,1);dummy.updateMatrix();stems.setMatrixAt(i,dummy.matrix);
          dummy.position.set(x,height+0.1,z);dummy.scale.set(0.65+rand()*0.6,0.65+rand()*0.6,0.65+rand()*0.6);dummy.updateMatrix();flowers.setMatrixAt(i,dummy.matrix);
          flowers.setColorAt(i,new THREE.Color(flowerColors[(tile.index+i+Math.floor(rand()*4))%flowerColors.length]));
        }
        stems.instanceMatrix.needsUpdate=true;flowers.instanceMatrix.needsUpdate=true;
        flowers.instanceColor.needsUpdate=true;
        stems.castShadow=false;flowers.castShadow=false;group.add(stems,flowers);
        if(bannedType!=='tree'){
          const shrubs=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.62,0),shrubMat,18);
          for(let i=0;i<18;i++){
            const p=i<4?{x:(i%2?-1:1)*(2.25+Math.floor(i/2)*0.85),z:5.3+Math.floor(i/2)*0.7}:plantPosition();
            dummy.position.set(p.x,0.27,p.z);dummy.rotation.set(0,rand()*6.28,0);
            dummy.scale.set(0.45+rand()*0.38,0.36+rand()*0.28,0.45+rand()*0.38);
            dummy.updateMatrix();shrubs.setMatrixAt(i,dummy.matrix);
            shrubs.setColorAt(i,new THREE.Color(shrubColors[(i+tile.index)%shrubColors.length]));
          }
          shrubs.instanceMatrix.needsUpdate=true;shrubs.instanceColor.needsUpdate=true;
          shrubs.castShadow=false;group.add(shrubs);
        }
        if(bannedType!=='rock'){
          const pebbles=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.27,0),stone,9);
          for(let i=0;i<9;i++){
            const {x,z}=plantPosition();dummy.position.set(x,0.13,z);dummy.rotation.set(0,rand()*6.28,0);dummy.scale.set(0.55+rand(),0.3+rand()*0.45,0.6+rand());dummy.updateMatrix();pebbles.setMatrixAt(i,dummy.matrix);
          }
          pebbles.instanceMatrix.needsUpdate=true;pebbles.castShadow=false;group.add(pebbles);
        }
        if(bannedType!=='lamp'){
          const signZ=tile.row===0?5.6:-5.6;
          mesh(group,new THREE.CylinderGeometry(0.09,0.14,1.1,7),trunkMat,-1.65,0.55,signZ);
          mesh(group,new THREE.SphereGeometry(0.2,8,6),amber,-1.65,1.16,signZ,false);
          mesh(group,new THREE.SphereGeometry(0.36,8,6),new THREE.MeshBasicMaterial({color:'#ffc57e',transparent:true,opacity:0.12,depthWrite:false}),-1.65,1.16,signZ,false);
        }
        const contact = mesh(group,new THREE.CircleGeometry(2.45,24),shadowMat,hx,0.065,hz,false);
        contact.rotation.x = -Math.PI/2;
        const feature = new THREE.Group();
        feature.position.set(hx,0,hz);
        group.add(feature);
        const s = tile.height;
        if (tile.type === 'bridge') {
          box(feature,4.8,0.25,4.4,gold,0,0.63+s*0.08,0);
          for (const side of [-1,1]) {
            for (const end of [-1,1]) box(feature,0.2,1.15,0.2,trunkMat,side*2.15,1.08+s*0.08,end*1.8);
            box(feature,0.15,0.15,4.2,gold,side*2.15,1.55+s*0.08,0);
          }
          for (let i=-2;i<=2;i++) box(feature,0.07,0.04,4.2,trunkMat,i*0.8,0.79+s*0.08,0);
          for(const side of [-1,1]){
            const arch=mesh(feature,new THREE.TorusGeometry(1.55,0.13,6,20,Math.PI),trunkMat,side*1.9,0.55,0);
            arch.rotation.y=Math.PI/2;
          }
        } else if (tile.type === 'tower') {
          const h = 3.2+s*1.3;
          mesh(feature,new THREE.CylinderGeometry(0.9,1.4,h,8),stone,0,h/2,0);
          mesh(feature,new THREE.ConeGeometry(1.55,1.55,8),darkStone,0,h+0.77,0);
          mesh(feature,new THREE.CylinderGeometry(1.14,1.14,0.16,8),gold,0,h-0.12,0);
          const door=mesh(feature,new THREE.BoxGeometry(0.75,1.35,0.13),trunkMat,0,0.72,1.22);
          door.rotation.y=0;
          for (let i=0;i<4;i++) {
            const a=i*Math.PI/2;
            const window = box(feature,0.28,0.57,0.1,amber,Math.sin(a)*0.92,h*0.66,Math.cos(a)*0.92);
            window.rotation.y = a;
          }
        } else if (tile.type === 'tree') {
          for (let i=0;i<3;i++) {
            const x=(i-1)*1.52;
            const z=i===1?-0.55:0.55;
            const h=1.8+s*0.65+(i===1?0.55:0);
            mesh(feature,new THREE.CylinderGeometry(0.18,0.3,h,7),trunkMat,x,h/2,z);
            const crown=mesh(feature,new THREE.IcosahedronGeometry(1.12+i*0.08,1),i===1?treeMat:leafMat,x,h+0.55,z);
            crown.scale.set(1.12,1.18,0.93);
            mesh(feature,new THREE.IcosahedronGeometry(0.78,1),i===1?leafMat:treeMat,x+0.55,h+1.05,z+0.2);
          }
        } else if (tile.type === 'rock') {
          for (let i=0;i<4;i++) {
            const rock = mesh(feature,new THREE.DodecahedronGeometry(1.05+i*0.16,0),i%2?stone:darkStone,(i-1.5)*1.05,0.8+i*0.22,(i%2?0.8:-0.65));
            rock.scale.y=0.8+s*0.15;
            rock.rotation.y=i*0.7;
          }
        } else if (tile.type === 'lamp') {
          for (const x of [-1.35,1.35]) {
            mesh(feature,new THREE.CylinderGeometry(0.1,0.19,2.6+s*0.36,8),trunkMat,x,1.3+s*0.18,0);
            mesh(feature,new THREE.SphereGeometry(0.35,12,8),amber,x,2.8+s*0.36,0);
            mesh(feature,new THREE.ConeGeometry(0.55,0.44,8),gold,x,3.28+s*0.36,0);
          }
        } else if (tile.type === 'water') {
          mesh(feature,new THREE.CylinderGeometry(2.6,2.74,0.16,32),darkStone,0,0.13,0);
          mesh(feature,new THREE.CylinderGeometry(2.42,2.42,0.035,32),waterMat,0,0.24,0,false);
          const ripple=mesh(feature,new THREE.TorusGeometry(1.42,0.028,6,40),amber,0,0.29,0,false);
          ripple.rotation.x=Math.PI/2;
          for(let i=0;i<5;i++){
            const a=i*2.3,px=Math.cos(a)*1.6,pz=Math.sin(a)*1.6;
            const reed=mesh(feature,new THREE.ConeGeometry(0.11,0.68,4),stemMat,px,0.49,pz,false);
            reed.rotation.z=(i%2?1:-1)*0.18;
          }
        }
        if (tile.index === 2) {
          const ring = mesh(feature,new THREE.TorusGeometry(2.67,0.055,8,48),amber,0,0.19,0,false);
          ring.rotation.x=Math.PI/2;
          const flame = mesh(feature,new THREE.IcosahedronGeometry(0.24,0),amber,0,2.3+s*0.2,0,false);
          flame.userData.floatBase=2.3+s*0.2;
          const glow = new THREE.PointLight('#ffc894',6,12,2);
          glow.position.set(0,2.1,0);
          feature.add(glow);
        }
        return group;
      }
      function disposeGroup(group) {
        world.remove(group);
        group.traverse(object => {
          if (object.geometry) object.geometry.dispose();
          if (object.material) (Array.isArray(object.material)?object.material:[object.material]).forEach(material => material.dispose());
        });
      }
      const groups = new Map();
      const transitions = [];
      let backdrop=null;
      function makeBackdrop(model){
        const group=new THREE.Group();
        if(model.bannedType==='tree')return group;
        const bark=new THREE.MeshStandardMaterial({color:'#626463',roughness:1});
        const distantLeaf=new THREE.MeshStandardMaterial({color:'#536d70',roughness:1});
        const paleLeaf=new THREE.MeshStandardMaterial({color:'#667d78',roughness:1});
        for(let i=0;i<21;i++){
          const x=-40+i*4.1+(i%3)*0.65;
          const z=-24-(i%4)*3.6;
          const height=2.5+(i*7%9)*0.35;
          mesh(group,new THREE.CylinderGeometry(0.13,0.23,height,5),bark,x,height/2-0.25,z,false);
          const crown=mesh(group,new THREE.IcosahedronGeometry(1.25+(i%4)*0.2,0),i%3?paleLeaf:distantLeaf,x,height+0.32,z,false);
          crown.scale.set(1.06,1.32,0.88);
        }
        return group;
      }
      function install(model,animate) {
        if(backdrop)disposeGroup(backdrop);
        backdrop=makeBackdrop(model);world.add(backdrop);
        model.tiles.forEach(tile => {
          const previous = groups.get(tile.index);
          const signature = tile.type + ':' + tile.seed + ':' + tile.label;
          if (previous && previous.signature === signature && animate) return;
          const next = createTile(tile,model.bannedType);
          world.add(next);
          groups.set(tile.index,{group:next,signature});
          if (animate && previous) {
            next.position.y = -0.85;
            next.scale.y = 0.7;
            transitions.push({from:previous.group,to:next,start:performance.now()});
          } else if (previous) disposeGroup(previous.group);
        });
      }
      install(current,false);
      updateScene = model => install(model,true);
      const player = {x:SPAWN.x,z:SPAWN.z,yaw:SPAWN.yaw,pitch:SPAWN.pitch};
      const keys = new Set();
      const touchMoves = new Set();
      const visited = new Set();
      let lastDistrict = -2;
      let lastNear = false;
      function updateProgress(force=false) {
        const tile = current.tiles.find(part => Math.abs(player.x-part.x)<=7.55 && Math.abs(player.z-part.z)<=7.55);
        const district = tile?.index ?? -1;
        if (tile) visited.add(district);
        const focus=current.tiles[current.landmark.tile];
        const near=Math.hypot(player.x-focus.objectX,player.z-focus.objectZ)<6;
        if (!force && district===lastDistrict && near===lastNear) return;
        lastDistrict=district;lastNear=near;
        const place=tile?`区画${String(district+1).padStart(2,'0')} ${tile.name}`:'中央の道';
        progress.textContent=`現在地：${place} · 発見 ${visited.size} / 8${near?' · 名所の近く':''}`;
        [...mapList.children].forEach((item,index)=>{
          item.classList.toggle('visited',visited.has(index));
          item.classList.toggle('current',index===district);
          if(index===district)item.setAttribute('aria-current','location');
          else item.removeAttribute('aria-current');
        });
      }
      resetVisitProgress=()=>{visited.clear();lastDistrict=-2;lastNear=false;updateProgress(true);};
      let overview = false;
      resetView = () => {
        Object.assign(player,SPAWN);
        keys.clear();touchMoves.clear();
        overview=false;
        overviewButton.textContent='全景を見る';
        updateProgress(true);
      };
      stopMoving = () => { keys.clear();touchMoves.clear(); };
      setOverview = () => {
        overview=!overview;
        stopMoving();
        overviewButton.textContent=overview?'歩く視点へ':'全景を見る';
        state.textContent=overview?'全景から8区画を見渡しています。':'歩く視点に戻りました。';
      };
      const movementKeys = new Set(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright']);
      window.addEventListener('keydown',event => {
        if (event.target instanceof HTMLElement && event.target.closest('input,textarea,select')) return;
        const key=event.key.toLowerCase();
        if (movementKeys.has(key)) { event.preventDefault();keys.add(key);if (overview) setOverview(); }
      });
      window.addEventListener('keyup',event => keys.delete(event.key.toLowerCase()));
      window.addEventListener('blur',stopMoving);
      document.querySelectorAll('[data-move]').forEach(button => {
        const direction=button.dataset.move;
        button.addEventListener('pointerdown',event => {
          event.preventDefault();button.setPointerCapture(event.pointerId);touchMoves.add(direction);
          if (overview) setOverview();
        });
        for (const name of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(name,() => touchMoves.delete(direction));
      });
      let dragId=null,lastX=0,lastY=0;
      canvas.addEventListener('pointerdown',event => {
        if (event.pointerType==='mouse' && event.button!==0) return;
        dragId=event.pointerId;lastX=event.clientX;lastY=event.clientY;
        canvas.setPointerCapture(event.pointerId);
        if (overview) setOverview();
      });
      canvas.addEventListener('pointermove',event => {
        if (event.pointerId!==dragId) return;
        player.yaw+=(event.clientX-lastX)*0.0045;
        player.pitch=Math.max(-0.66,Math.min(0.54,player.pitch+(event.clientY-lastY)*0.0037));
        lastX=event.clientX;lastY=event.clientY;
      });
      for (const name of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(name,() => { dragId=null; });
      const resize = () => {
        const rect=canvas.getBoundingClientRect();
        const width=Math.max(1,Math.floor(rect.width));
        const height=Math.max(1,Math.floor(rect.height));
        renderer.setSize(width,height,false);
        camera.aspect=width/height;
        camera.updateProjectionMatrix();
      };
      new ResizeObserver(resize).observe(canvas);
      resize();
      let previousTime=performance.now();
      function frame(now) {
        requestAnimationFrame(frame);
        const dt=Math.min(0.05,(now-previousTime)/1000);
        previousTime=now;
        if (!overview) {
          const forward=Number(keys.has('w')||keys.has('arrowup')||touchMoves.has('forward'))-Number(keys.has('s')||keys.has('arrowdown')||touchMoves.has('backward'));
          const side=Number(keys.has('d')||keys.has('arrowright')||touchMoves.has('right'))-Number(keys.has('a')||keys.has('arrowleft')||touchMoves.has('left'));
          const {dx,dz}=movementDelta(forward,side,player.yaw,4.5*dt);
          if (canStand(player.x+dx,player.z,current.tiles)) player.x+=dx;
          if (canStand(player.x,player.z+dz,current.tiles)) player.z+=dz;
          updateProgress();
          camera.position.set(player.x,1.82,player.z);
          camera.rotation.set(player.pitch,player.yaw,0,'YXZ');
        } else {
          camera.position.set(0,43,44);
          camera.lookAt(0,0,0);
        }
        for (let i=transitions.length-1;i>=0;i--) {
          const part=transitions[i];
          const t=Math.min(1,(now-part.start)/720);
          const smooth=t*t*(3-2*t);
          part.from.position.y=smooth*1.1;
          part.from.scale.y=1-smooth*0.35;
          part.to.position.y=-0.85*(1-smooth);
          part.to.scale.y=0.7+smooth*0.3;
          if (t===1) { disposeGroup(part.from);transitions.splice(i,1); }
        }
        groups.get(2)?.group.traverse(object => {
          if (object.userData.floatBase) {
            object.position.y=object.userData.floatBase+Math.sin(now*0.0014)*0.12;
            object.rotation.y=now*0.0005;
          }
        });
        sky.position.copy(camera.position);
        renderer.render(scene,camera);
      }
      requestAnimationFrame(frame);
      updateProgress(true);
    } catch {
      fallback.hidden=false;
      canvas.hidden=true;
    }
  }).catch(() => { fallback.hidden=false;canvas.hidden=true; });
}
if (typeof document !== 'undefined') boot();
