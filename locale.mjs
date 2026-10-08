export const LANGUAGES=Object.freeze(['en','zh-TW','zh-CN','ja']);
const rows={
 title:['Plate Flip Walk','翻板漫步','翻板漫步','Plate Flip Walk'],
 eyebrow:['Stone, light, one deliberate step','石材、光線與從容的一步','石材、光线与从容的一步','石と光、ゆっくり一歩'],
 intro:['Walk a short hinged-floor route, or keep exploring the eight districts you build from five words. Everything runs locally; BGM starts off.','走過短短的翻板路線，或繼續探索用五個詞建立的八個區域。所有處理都在本機進行；背景音樂預設關閉。','走过短短的翻板路线，或继续探索用五个词建立的八个区域。所有处理都在本机进行；背景音乐默认关闭。','反転する床の短い道を歩くか、五語でつくる8区画を探索できます。処理は端末内だけ。BGMは初期OFFです。'],
 language:['Language','語言','语言','言語'],
 workspace:['Build and explore a local 3D world','建立並探索本機的立體世界','建立并探索本机的立体世界','端末内の立体世界をつくって歩く'],
 canvas:['A walkable 3D world. Plate mode keeps the walker and next step in view; drag to look around in district mode.','可步行的立體世界。翻板模式會保持人物與下一步在畫面內；區域模式可拖曳環視。','可步行的立体世界。翻板模式会保持人物与下一步在画面内；区域模式可拖动环视。','歩ける立体世界。床板モードでは人物と次の一歩を表示。区画モードではドラッグで見回せます。'],
 plateScene:['The hinge gallery','鉸鏈迴廊','铰链回廊','ヒンジの回廊'],
 worldScene:['Eight districts at dusk','暮色中的八個區域','暮色中的八个区域','夕暮れの8区画'],
 plateHint:['WASD / arrows · follow numbered plates','WASD／方向鍵 · 沿編號翻板前進','WASD／方向键 · 沿编号翻板前进','WASD／矢印 · 番号の床板をたどる'],
 worldHint:['WASD / arrows to walk · drag to look','WASD／方向鍵移動 · 拖曳環視','WASD／方向键移动 · 拖动环视','WASD／矢印で歩く · ドラッグで見回す'],
 controls:['Direction controls','方向操作','方向操作','方向操作'],
 forward:['Forward ↑','前進 ↑','前进 ↑','前へ ↑'],
 backward:['Back ↓','後退 ↓','后退 ↓','後ろへ ↓'],
 left:['Left ←','向左 ←','向左 ←','左へ ←'],
 right:['Right →','向右 →','向右 →','右へ →'],
 plateMode:['Plate walk','翻板漫步','翻板漫步','床板を歩く'],
 worldMode:['Five-word districts','五詞區域','五词区域','五語の区画'],
 plateTitle:['Take the first step','踏出第一步','踏出第一步','最初の一歩を'],
 plateHelp:['Follow plates 01–10 to the arch. Each entry turns a plate once; standing still does not. You can retrace your steps. The fixed center rails support you while the plate turns below. A has one groove, B has two.','沿 01–10 號翻板走向拱門。每次踏入翻轉一次；站著不動不會翻轉，也可以回頭走。翻板在下方轉動時，中央固定軌道會支撐人物。A 面一道刻紋，B 面兩道。','沿 01–10 号翻板走向拱门。每次踏入翻转一次；站着不动不会翻转，也可以回头走。翻板在下方转动时，中央固定轨道会支撑人物。A 面一道刻纹，B 面两道。','01〜10の床板をたどって門へ。入るたびに一度反転し、立ち止まっている間は反転しません。戻ることもできます。中央の固定レールが足を支え、その下で板が回ります。A面は溝1本、B面は2本。'],
 palette:['Two surfaces','二種表面','两种表面','二つの表面'],
 sand:['A Limestone / B aged bronze','A 石灰石／B 古銅','A 石灰石／B 古铜','A 石灰石／B 古い青銅'],
 slate:['A Slate / B brushed brass','A 板岩／B 拉絲黃銅','A 板岩／B 拉丝黄铜','A 粘板岩／B 磨いた真鍮'],
 clay:['A Pale ceramic / B iron','A 淺色陶瓷／B 鐵','A 浅色陶瓷／B 铁','A 淡い陶器／B 鉄'],
 gentle:['Reduced motion','減少動態效果','减少动态效果','動きを抑える'],
 replay:['Reset / replay','重設／再玩','重置／重玩','リセット／もう一度'],
 routeTitle:['Route and surfaces','路線與表面','路线与表面','道と表面'],
 opening:['The gallery is settling. Your first step is ↑ toward plate 01.','迴廊準備中。第一步請按 ↑，走向 01 號翻板。','回廊准备中。第一步请按 ↑，走向 01 号翻板。','回廊が静まります。最初は ↑ で01の床板へ。'],
 invitation:['Ready. Step ↑ onto plate 01.','準備好了。按 ↑ 踏上 01 號翻板。','准备好了。按 ↑ 踏上 01 号翻板。','準備できました。↑ で01の床板へ。'],
 walking:['Walking to plate {number}.','正走向 {number} 號翻板。','正走向 {number} 号翻板。','床板{number}へ歩いています。'],
 turning:['Plate {number} is turning. Your feet stay on the fixed rails.','{number} 號翻板正在翻轉。人物的腳仍由固定軌道支撐。','{number} 号翻板正在翻转。人物的脚仍由固定轨道支撑。','床板{number}が反転中。足は固定レールが支えます。'],
 nextStep:['Plate {number}, surface {face}. Next: {direction} to {next}. You may also go back.','{number} 號翻板，{face} 面。下一步：{direction} 到 {next} 號，也可以回頭。','{number} 号翻板，{face} 面。下一步：{direction} 到 {next} 号，也可以回头。','床板{number}、{face}面。次は{direction}で{next}へ。戻ることもできます。'],
 edge:['There is no connected plate that way. Follow the next direction shown above.','那個方向沒有相連的翻板。請依照上方的下一步方向。','那个方向没有相连的翻板。请按照上方的下一步方向。','その方向に続く床板はありません。上に示した次の方向をたどってください。'],
 complete:['The arch is open. All 10 plates reached. Reset to walk again with either surface pair.','拱門開啟了，已走過全部 10 塊翻板。重設後可選擇表面組合再走一次。','拱门开启了，已走过全部 10 块翻板。重置后可选择表面组合再走一次。','門が開きました。10枚すべてに到達。リセットして表面の組み合わせを選び、もう一度歩けます。'],
 plateProgress:['Reached {n} / 10 · entries {entries} · {place}','已到達 {n}／10 · 踏入 {entries} 次 · {place}','已到达 {n}／10 · 踏入 {entries} 次 · {place}','到達 {n}／10 · 入場 {entries}回 · {place}'],
 start:['Start','起點','起点','出発点'],
 platePlace:['Plate {number} · {face}','翻板 {number} · {face}','翻板 {number} · {face}','床板{number} · {face}'],
 routeItem:['{number} · {face} · {status}','{number} · {face} · {status}','{number} · {face} · {status}','{number} · {face} · {status}'],
 unreached:['not reached','未到達','未到达','未到達'],
 reached:['reached','已到達','已到达','到達済み'],
 current:['here','目前位置','当前位置','現在地'],
 flipLabel:['turning','翻轉中','翻转中','反転中'],
 endpoint:['END','終點','终点','終点'],
 fallbackTitle:['3D rendering is unavailable','無法使用立體顯示','无法使用立体显示','立体表示を利用できません'],
 fallbackBody:['You can still play the plate route with the direction buttons and numbered surface list below. The five-word map and landmark descriptions also remain usable. Try another browser or device for 3D.','仍可使用下方方向按鈕及編號表面清單遊玩翻板路線。五詞地圖與景點說明也可閱讀。若要使用立體顯示，請嘗試其他瀏覽器或裝置。','仍可使用下方方向按钮及编号表面列表游玩翻板路线。五词地图与景点说明也可阅读。若要使用立体显示，请尝试其他浏览器或设备。','下の方向ボタンと番号付き表面一覧で床板の道を遊べます。五語の地図と名所の説明も読めます。立体探索には別のブラウザや端末をお試しください。'],
 fallbackNote:['Text route active; 3D is unavailable.','文字路線可操作；立體顯示不可用。','文字路线可操作；立体显示不可用。','文字の道を操作できます。立体表示は利用できません。'],
 worldTitle:['Five clues for eight districts','五個詞，八個區域','五个词，八个区域','8区画をつくる五つの手がかり'],
 wordHelp:['Up to 20 characters per word. The supported Japanese words guide shapes; other words become district labels. Your inputs stay unchanged when switching language or modes.','每個詞最多 20 個字元。支援的日文詞會決定形狀；其他詞會成為區域名稱。切換語言或模式不會改動輸入。','每个词最多 20 个字符。支持的日文词会决定形状；其他词会成为区域名称。切换语言或模式不会改动输入。','一語20文字まで。対応する日本語は形や配置の手がかりに、その他の言葉は区画の名前になります。言語やモードを切り替えても入力は保持します。'],
 word1:['Word 1','第一個詞','第一个词','一語目'],
 word2:['Word 2','第二個詞','第二个词','二語目'],
 word3:['Word 3','第三個詞','第三个词','三語目'],
 word4:['Word 4','第四個詞','第四个词','四語目'],
 word5:['Word 5','第五個詞','第五个词','五語目'],
 ban:['Element to exclude','排除的元素','排除的元素','入れたくない要素'],
 banHelp:['Enter one Japanese term: 橋 (bridge), 塔 (tower), 樹/森/木 (trees), 岩/山 (rock), 灯/光 (light), 水/川/湖 (water). Other exclusions are unsupported.','請輸入一個日文詞：橋、塔、樹／森／木、岩／山、灯／光、水／川／湖。不支援其他排除項目。','请输入一个日文词：橋、塔、樹／森／木、岩／山、灯／光、水／川／湖。不支持其他排除项。','除外できる要素：橋・塔・樹（森／木）・岩（山）・灯（光）・水（川／湖）。この一覧以外には対応していません。'],
 build:['Build the districts ↗','建立區域 ↗','建立区域 ↗','夕暮れの道をつくる ↗'],
 reset:['Return to start','返回起點','返回起点','出発地点へ戻る'],
 overview:['View all districts','查看全部區域','查看全部区域','全景を見る'],
 walkView:['Walking view','步行視角','步行视角','歩く視点へ'],
 stop:['Stop','停止','停止','止まる'],
 landmark:['Landmark · rule-based fiction','景點 · 固定規則的創作','景点 · 固定规则的创作','散歩道の名所 · 定型文による創作'],
 mapTitle:['Eight-district walking map','八區步行地圖','八区步行地图','8区画の散歩地図'],
 mapHelp:['Numbered from the upper left. Enter each district from the central path and approach its scenery.','編號從左上開始。可從中央道路進入各區域，走近景物。','编号从左上开始。可从中央道路进入各区域，走近景物。','番号は左上から順番。中央の道から各区画へ入り、気になる景色のそばまで歩けます。'],
 worldSample:['A sample world is ready. Enter five words to build your own districts.','範例世界已準備好。輸入五個詞，建立自己的區域。','示例世界已准备好。输入五个词，建立自己的区域。','見本の世界が広がっています。五語を入力して、世界をつくってください。'],
 worldBuilt:['Rebuilt eight districts. Walk the paths and look closely at the plants and landmarks.','已重新建立八個區域。沿著道路散步，近看植物與景點。','已重新建立八个区域。沿着道路散步，近看植物与景点。','8区画を組み直しました。小径を歩き、近くの草花や名所を見回してみてください。'],
 worldReset:['Returned to the start. The central path connects all eight districts.','已回到起點。中央道路連接全部八個區域。','已回到起点。中央道路连接全部八个区域。','出発地点に戻りました。中央の道から8区画を歩けます。'],
 worldStopped:['Stopped walking. You can still look around.','已停止步行，仍可環視。','已停止步行，仍可环视。','足を止めました。景色を見回せます。'],
 worldOverview:['Viewing all eight districts.','正在查看全部八個區域。','正在查看全部八个区域。','全景から8区画を見渡しています。'],
 worldWalking:['Returned to the walking view.','已回到步行視角。','已回到步行视角。','歩く視点に戻りました。'],
 bgmError:['BGM could not play. You can continue exploring.','無法播放背景音樂，仍可繼續探索。','无法播放背景音乐，仍可继续探索。','BGMを再生できませんでした。世界の探索は続けられます。'],
 centralPath:['Central path','中央道路','中央道路','中央の道'],
 districtPlace:['District {number} {name}','區域 {number} {name}','区域 {number} {name}','区画{number} {name}'],
 worldProgress:['Location: {place} · discovered {n} / 8{near}','位置：{place} · 已發現 {n}／8{near}','位置：{place} · 已发现 {n}／8{near}','現在地：{place} · 発見 {n} / 8{near}'],
 nearLandmark:[' · near the landmark',' · 景點附近',' · 景点附近',' · 名所の近く'],
 districtName:['{label} · {type} district','{label} · {type}區','{label} · {type}区','{label}の{type}区'],
 pathLabel:['Path','小徑','小径','小径'],
 landmarkTitle:['{label} lookout','{label}觀景處','{label}观景处','{label}の見晴らし'],
 landmarkText:['Here, the feeling of {label} echoes beyond the path. Walk closer and look around beyond the light.','在這裡，{label}的氣息沿著小徑延伸。走近一些，看看光線後方的景色。','在这里，{label}的气息沿着小径延伸。走近一些，看看光线后方的景色。','ここでは{label}の気配が道の先に重なります。近づいて、光の向こうを見回してみてください。'],
 errorCount:['Enter exactly five words.','請輸入正好五個詞。','请输入正好五个词。','言葉を五つ入力してください。'],
 errorEmpty:['Fill in all five words.','請填寫全部五個詞。','请填写全部五个词。','五つの言葉をすべて入力してください。'],
 errorLength:['Each word must be at most 20 characters.','每個詞最多 20 個字元。','每个词最多 20 个字符。','一語は20文字以内にしてください。'],
 errorBan:['Enter one excluded element, at most 20 characters.','請輸入一個要排除的元素，最多 20 個字元。','请输入一个要排除的元素，最多 20 个字符。','禁止要素を一つ、20文字以内で入力してください。'],
 errorUnsupported:['Unsupported exclusion. Use 橋, 塔, 樹/森/木, 岩/山, 灯/光 or 水/川/湖.','不支援此排除項目。請使用 橋、塔、樹／森／木、岩／山、灯／光 或 水／川／湖。','不支持此排除项。请使用 橋、塔、樹／森／木、岩／山、灯／光 或 水／川／湖。','その禁止要素には対応していません。橋・塔・樹（森／木）・岩（山）・灯（光）・水（川／湖）から選んでください。'],
 errorGeneric:['Check the five words and supported exclusion.','請檢查五個詞與支援的排除項目。','请检查五个词与支持的排除项。','五つの言葉と対応する禁止要素を確認してください。']
};
export const TEXT=Object.freeze(Object.fromEntries(LANGUAGES.map((language,i)=>[language,Object.freeze(Object.fromEntries(Object.entries(rows).map(([key,values])=>[key,values[i]])))])));
const typeRows={bridge:['Bridge','橋','桥','橋'],tower:['Tower','塔','塔','塔'],tree:['Trees','樹木','树木','樹'],rock:['Rock','岩石','岩石','岩'],lamp:['Lantern','燈','灯','灯'],water:['Water','水','水','水']};
export function translate(language,key,args={}){
 const table=TEXT[language]??TEXT.en;
 const template=table[key]??TEXT.en[key]??key;
 return template.replace(/\{(\w+)\}/g,(_,name)=>String(args[name]??''));
}
export function districtName(tile,language='en'){
 const i=Math.max(0,LANGUAGES.indexOf(language));
 const label=tile.label==='小径'?translate(language,'pathLabel'):tile.label;
 return translate(language,'districtName',{label,type:typeRows[tile.type][i]});
}
export function landmarkCopy(model,language='en'){
 const tile=model.tiles[model.landmark.tile];
 const label=tile.label==='小径'?translate(language,'pathLabel'):tile.label;
 return {title:translate(language,'landmarkTitle',{label}),text:translate(language,'landmarkText',{label})};
}
const validationKeys=['errorCount','errorEmpty','errorLength','errorBan','errorUnsupported'];
export function createLocale(root){
 let language='en';
 const listeners=new Set();
 const select=root.getElementById('language');
 const api={get language(){return language;},t:(key,args)=>translate(language,key,args),
  validation:error=>translate(language,validationKeys.find(key=>TEXT.ja[key]===error)??'errorGeneric'),
  subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},
  setLanguage(value){if(!LANGUAGES.includes(value))return false;language=value;apply();return true;}
 };
 function apply(){
  root.documentElement.lang=language;
  root.title=api.t('title');
  select.value=language;
  root.querySelectorAll('[data-i18n]').forEach(node=>{node.textContent=api.t(node.dataset.i18n);});
  root.querySelectorAll('[data-i18n-aria]').forEach(node=>{node.setAttribute('aria-label',api.t(node.dataset.i18nAria));});
  listeners.forEach(listener=>listener());
 }
 select.addEventListener('change',()=>api.setLanguage(select.value));
 apply();return api;
}
