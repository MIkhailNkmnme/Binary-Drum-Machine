const test=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
const {mount}=require('./mayatnik-xorrom-controls.js');
function boot(extra={}){
  const dom=new JSDOM('<div id="other">other</div><div id="host"><b>existing</b></div>'),host=dom.window.document.querySelector('#host');
  let config={},current={state:'stopped',notes:[]},listener,unsubscribed=0,starts=0,patches=[];
  const api={getSettings:()=>config,getState:()=>current,setSettings:patch=>{patches.push(patch);Object.assign(config,patch);listener?.();},start:async()=>{starts++;current.state='playing';listener?.();},pause:()=>{current.state='paused';listener?.();},stop:()=>{current={state:'stopped',notes:[]};listener?.();},exportWav:async()=>({blob:new dom.window.Blob(['wav']),name:'test.wav',note:'Сохранено 60 с: длинный проход ограничен'}),subscribe:fn=>{listener=fn;return()=>unsubscribed++;},...extra};
  const downloaded=[],control=mount(host,{api,download:(blob,name)=>downloaded.push({blob,name})});
  const el=id=>host.querySelector('[data-xorrom="'+id+'"]'),input=id=>el(id).querySelector('input,select');
  const change=(id,value)=>{input(id).value=String(value);input(id).dispatchEvent(new dom.window.Event('change',{bubbles:true}));};
  return {dom,host,api,control,el,input,change,patches,downloaded,get starts(){return starts},get unsubscribed(){return unsubscribed},setState:value=>{current=value;listener?.();}};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('Line is a quick transport toggle that changes only the persisted visual preference',()=>{
 let visible=true;const writes=[];const a=boot({getLinesVisible:()=>visible,setLinesVisible(value){visible=value;writes.push(value);}});try{
  const line=a.el('line');assert.equal(line.parentElement,a.host);assert.equal(line.previousElementSibling,a.el('stop'));assert.equal(line.getAttribute('aria-pressed'),'true');assert.ok(line.classList.contains('gz-on'));assert.equal(line.disabled,false);
  a.setState({state:'playing',index:3,notes:[]});line.click();assert.deepEqual(writes,[false]);assert.equal(line.getAttribute('aria-pressed'),'false');assert.equal(a.api.getState().state,'playing');assert.equal(a.api.getState().index,3);assert.equal(a.starts,0);assert.deepEqual(a.patches,[]);
  line.click();assert.deepEqual(writes,[false,true]);assert.equal(line.getAttribute('aria-pressed'),'true');assert.match(line.title,/неточном масштабе/);
 }finally{a.control.destroy();a.dom.window.close();}
});
test('Electro rim marks the electronic family even with custom BPM and division; exact preset is separate',()=>{
  const a=boot(),button=a.el('electro');
  const pressed=value=>{assert.equal(button.getAttribute('aria-pressed'),String(value));assert.equal(button.classList.contains('gz-on'),value);};
  pressed(false);button.click();pressed(true);assert.equal(button.dataset.presetMatch,'true');
  for(const timbre of ['robot','metal','bass','pulse']){a.api.setSettings({timbre,division:8,bpm:112,backing:'bass'});pressed(true);assert.equal(button.dataset.presetMatch,'false');}
  a.api.setSettings({timbre:'sine'});pressed(false);button.click();pressed(true);assert.equal(button.dataset.presetMatch,'true');
  assert.equal(a.api.getSettings().backing,'bass');assert.equal(a.starts,0);a.dom.window.close();
});
test('tempo number accepts fractional, slow and fast values, and keeps the previous valid value on invalid entry',()=>{
  const a=boot(),input=a.input('bpm');assert.equal(input.step,'any');assert.equal(input.hasAttribute('min'),false);assert.equal(input.hasAttribute('max'),false);
  for(const bpm of [.5,1,30,250,999,123.45]){a.change('bpm',bpm);assert.deepEqual(a.patches.at(-1),{bpm});}
  for(const value of ['',0,-5]){a.change('bpm',value);assert.equal(input.value,'123.45');}
  assert.equal(a.starts,0);a.dom.window.close();
});

test('library groups reuse all live controls and leave quick transport directly in the rail',()=>{
 const a=boot();try{
  assert.equal(a.el('start').parentElement,a.host);assert.equal(a.el('stop').parentElement,a.host);
  assert.deepEqual([...a.host.querySelectorAll('[data-xorrom-group]')].map(n=>n.dataset.xorromGroup),['reading','notes','sound','effects','files']);
  for(const [key,group]of [['first','reading'],['tonic','notes'],['timbre','sound'],['attack','effects'],['jsonSave','files']])assert.equal(a.el(key).closest('[data-xorrom-group]').dataset.xorromGroup,group);
  const input=a.input('bpm'),section=input.closest('section');input.focus();input.value='133.25';a.setState({state:'playing',index:1});assert.equal(a.input('bpm'),input);assert.equal(input.closest('section'),section);assert.equal(input.value,'133.25');assert.equal(a.dom.window.document.activeElement,input);
  for(const input of a.host.querySelectorAll('select,input[type="number"]')){const row=input.closest('[data-xorrom]');assert.equal(row.querySelectorAll('[data-xorrom-step]').length,2);assert.ok(row.classList.contains('zcf-control'));assert.equal(row.querySelectorAll('.zcf-outline').length,3);}
 }finally{a.control.destroy();a.dom.window.close();}
});

test('global off can cancel preparation before any track reports playing',async()=>{
 let finish,stops=0;const tracks=[{id:1,name:'Main',color:'#c29bff',muted:false}];
 const a=boot({getRack:()=>({selected:1,tracks}),anyActive:()=>false,startAll:()=>new Promise(resolve=>finish=resolve),stopAll(){stops++;finish();}});
 try{const off=a.el('tracksStop');assert.equal(off.disabled,true);a.el('tracksStart').click();assert.equal(off.disabled,false);off.click();assert.equal(stops,1);await flush();assert.equal(off.disabled,true);assert.deepEqual(a.patches,[]);}finally{a.dom.window.close();}
});

test('side arrows keep numeric bounds, decimal conversions, unrestricted BPM and manual focus',()=>{
 const a=boot(),side=(key,dir)=>a.el(key).querySelector('[data-xorrom-step="'+dir+'"]');try{
  a.change('bpm',999.25);side('bpm',1).click();assert.equal(a.api.getSettings().bpm,1000.25);assert.equal(a.input('bpm').hasAttribute('max'),false);
  a.change('bpm',.5);assert.equal(side('bpm',-1).disabled,true);side('bpm',-1).click();assert.equal(a.api.getSettings().bpm,.5);
  a.change('gain',100);assert.equal(side('gain',1).disabled,true);side('gain',-1).click();assert.equal(a.api.getSettings().gain,.99);
  a.change('attack',.005);side('attack',1).click();assert.equal(a.api.getSettings().attack,.006);
  a.input('bpm').focus();a.input('bpm').value='135.5';side('bpm',1).dispatchEvent(new a.dom.window.MouseEvent('pointerdown',{bubbles:true,cancelable:true}));side('bpm',1).click();assert.equal(a.dom.window.document.activeElement,a.input('bpm'));assert.equal(a.input('bpm').value,'136.5');assert.equal(a.api.getSettings().bpm,136.5);
 }finally{a.dom.window.close();}
});

test('select side arrows preserve option order and all auto/source-disabled restrictions',()=>{
 const a=boot(),side=(key,dir)=>a.el(key).querySelector('[data-xorrom-step="'+dir+'"]');try{
  side('source',1).click();assert.equal(a.api.getSettings().source,'rhythm');assert.equal(side('source',1).disabled,true);assert.equal(a.input('chord').disabled,true);assert.equal(side('chord',-1).disabled,true);
  side('source',-1).click();assert.equal(a.api.getSettings().source,'rgb');assert.equal(a.input('chord').disabled,false);
  a.api.setSettings({autoGeometry:true});a.setState({state:'playing',effective:{tonic:7,gain:.2}});const count=a.patches.length;
  assert.equal(side('tonic',1).disabled,true);assert.equal(side('gain',-1).disabled,true);side('gain',-1).click();assert.equal(a.patches.length,count);
  a.el('autoGeometry').click();side('tonic',1).click();assert.equal(a.api.getSettings().tonic,1);
 }finally{a.dom.window.close();}
});
test('frame restart is an independent saved toggle and does not start sound',()=>{
  const a=boot(),toggle=a.el('restartOnFrame');assert.equal(toggle.getAttribute('aria-pressed'),'false');
  assert.match(toggle.textContent,/С начала кадра/);assert.match(toggle.title,/линия чтения/);
  toggle.click();assert.equal(toggle.getAttribute('aria-pressed'),'true');assert.deepEqual(a.patches.at(-1),{restartOnFrame:true});
  toggle.click();assert.equal(a.starts,0);assert.deepEqual(a.patches.at(-1),{restartOnFrame:false});a.dom.window.close();
});
test('mount reads state without starting audio and owns only its appended controls',()=>{
  const a=boot();assert.equal(a.starts,0);assert.equal(a.input('source').value,'rgb');assert.equal(a.input('bpm').value,'96');assert.equal(a.input('gain').value,'25');assert.equal(a.el('start').getAttribute('aria-pressed'),'false');
  a.control.destroy();a.control.destroy();assert.equal(a.unsubscribed,1);assert.equal(a.host.innerHTML,'<b>existing</b>');assert.equal(a.dom.window.document.querySelector('#other').textContent,'other');a.dom.window.close();
});
test('settings normalize UI units and bounds, source gates RGB chord, API changes sync',()=>{
  const a=boot();a.change('bpm',999);assert.deepEqual(a.patches.at(-1),{bpm:999});a.change('gain',40);assert.deepEqual(a.patches.at(-1),{gain:.4});a.change('stride',0);assert.deepEqual(a.patches.at(-1),{stride:1});
  a.change('source','rhythm');assert.equal(a.input('chord').disabled,true);a.api.setSettings({source:'rgb',tonic:7});assert.equal(a.input('chord').disabled,false);assert.equal(a.input('tonic').value,'7');a.el('loop').click();assert.equal(a.el('loop').getAttribute('aria-pressed'),'false');a.dom.window.close();
});
test('transport starts only by gesture, pauses and stops; note events are not aria-live',async()=>{
  const a=boot();a.el('start').click();assert.equal(a.starts,1);assert.equal(a.el('start').disabled,true);await flush();assert.equal(a.el('start').getAttribute('aria-pressed'),'true');a.el('start').click();await flush();assert.match(a.el('status').textContent,/Пауза/);
  a.setState({state:'playing',notes:[{midi:60},{midi:64}]});assert.equal(a.el('notes').textContent,'До4 · Ми4');assert.equal(a.el('notes').hasAttribute('aria-live'),false);a.el('stop').click();assert.match(a.el('status').textContent,/Остановлено/);a.dom.window.close();
});
test('start failure gives plain feedback and permits retry',async()=>{
  const a=boot({start:async()=>{throw Error('Нет строк для музыки');}});a.el('start').click();await flush();assert.match(a.el('status').textContent,/Нет строк для музыки/);assert.equal(a.el('start').disabled,false);a.dom.window.close();
});
test('Stop remains enabled and cancels an unresolved start without reporting an error',async()=>{
  let rejectStart,stops=0;
  const a=boot({start:()=>new Promise((resolve,reject)=>{rejectStart=reject;}),stop:()=>{stops++;const error=Error('cancelled');error.name='AbortError';rejectStart(error);}});
  a.el('start').click();assert.equal(a.el('start').disabled,true);assert.equal(a.el('stop').disabled,false);a.el('stop').click();assert.equal(stops,1);assert.match(a.el('status').textContent,/Остановлено/);
  await flush();assert.equal(a.el('start').disabled,false);assert.equal(a.el('stop').disabled,false);assert.match(a.el('status').textContent,/Чтение отменено/);assert.doesNotMatch(a.el('status').textContent,/Ошибка/);a.dom.window.close();
});
test('playing and paused status shows zero-based source row without live row announcements',()=>{
  const a=boot();a.setState({state:'playing',index:0,notes:[{midi:60},{midi:64},{midi:67}]});assert.match(a.el('status').textContent,/Строка 0/);assert.equal(a.el('row').getAttribute('aria-live'),'off');assert.equal(a.el('status').hasAttribute('aria-live'),false);
  assert.equal(a.el('notes').title,'Прозвучало: До4 · Ми4 · Соль4');assert.equal(a.el('notes').getAttribute('aria-label'),a.el('notes').title);
  a.setState({state:'paused',index:42,notes:[]});assert.match(a.el('status').textContent,/Пауза · Строка 42/);a.dom.window.close();
});
test('runtime errors surface after start and stable menu IDs and capture help remain available',async()=>{
  const a=boot();for(const node of a.host.querySelectorAll('.may-xorrom-control'))assert.equal(node.dataset.n,'xorrom-'+node.dataset.xorrom);
  assert.match(a.el('start').title,/Захват приостанавливает плеер поля/);assert.match(a.el('live').textContent,/Обновлять/);assert.match(a.el('live').title,/сам кадры не переключает/);
  a.el('start').click();await flush();a.setState({state:'stopped',notes:[],error:'Не удалось обновить снимок'});assert.match(a.el('status').textContent,/Ошибка: Не удалось обновить снимок/);
  a.setState({state:'paused',index:1,notes:[]});assert.match(a.el('start').title,/без нового снимка поля/);assert.doesNotMatch(a.el('status').textContent,/Ошибка/);a.dom.window.close();
});
test('WAV download exposes render limit note and catches export failure',async()=>{
  const a=boot();a.el('wav').click();assert.equal(a.el('wav').disabled,true);await flush();assert.equal(a.downloaded[0].name,'test.wav');assert.match(a.el('status').textContent,/60 с/);assert.equal(a.el('wav').disabled,false);
  a.api.exportWav=async()=>{throw Error('Слишком большое поле');};a.el('wav').click();await flush();assert.match(a.el('status').textContent,/Слишком большое поле/);assert.equal(a.el('wav').disabled,false);a.dom.window.close();
});

test('frame refresh shows status and cannot export an outdated score',()=>{
 const a=boot();a.setState({state:'paused',index:2,notes:[],updating:true});assert.match(a.el('status').textContent,/Обновляю кадр/);assert.equal(a.el('wav').disabled,true);a.setState({state:'playing',index:2,notes:[],updating:false});assert.equal(a.el('wav').disabled,false);a.dom.window.close();
});


test('geometry settings use compact standard controls and exact fill connectivity titles',()=>{
  const a=boot();assert.equal(a.el('autoGeometry').getAttribute('aria-pressed'),'false');assert.equal(a.input('geometrySource').value,'all');assert.equal(a.input('geometryConnectivity').value,'sides');
  assert.equal(a.el('autoGeometry').dataset.n,'xorrom-autoGeometry');assert.ok(a.el('geometrySource').classList.contains('gz-split'));
  assert.deepEqual(Array.from(a.input('geometryConnectivity').options,o=>o.title),['По сторонам','Стороны + углы','Только углы','Шахматки 0','Один бит']);
  a.change('geometrySource','symmetry');assert.deepEqual(a.patches.at(-1),{geometrySource:'symmetry'});a.change('geometryConnectivity','chess0');assert.deepEqual(a.patches.at(-1),{geometryConnectivity:'chess0'});
  a.el('autoGeometry').click();assert.deepEqual(a.patches.at(-1),{autoGeometry:true});assert.equal(a.el('autoGeometry').getAttribute('aria-pressed'),'true');assert.equal(a.starts,0);a.dom.window.close();
});

test('effective automatic values are visible without overwriting manual settings and restore on toggle off',()=>{
  const a=boot();a.api.setSettings({autoGeometry:true});
  const effective={division:16,scale:'minor',tonic:7,octave:5,timbre:'pluck',gain:.12,chord:2};
  a.setState({state:'playing',effective,geometry:{id:7,area:120,height:16,symmetryHeight:12},notes:[]});
  for(const [key,value]of Object.entries(effective)){
    assert.equal(a.input(key).value,String(key==='gain'?12:value));assert.equal(a.input(key).disabled,true);assert.ok(a.el(key).classList.contains('may-xorrom-modulated'));assert.match(a.input(key).title,/По рисунку: .*вручную:/);
  }
  assert.equal(a.input('bpm').disabled,false);assert.equal(a.input('bpm').value,'96');assert.equal(a.input('source').disabled,false);assert.equal(a.input('geometrySource').disabled,false);assert.equal(a.el('geometry').textContent,'Обл 7 · S 120 · H 16 · сим 12');assert.equal(a.el('geometry').getAttribute('aria-live'),'off');assert.match(a.el('geometry').title,/площадь 120 клеток/);
  assert.deepEqual(a.api.getSettings(),{autoGeometry:true});const count=a.patches.length;a.change('gain',80);assert.equal(a.patches.length,count);
  a.el('autoGeometry').click();assert.equal(a.input('bpm').value,'96');assert.equal(a.input('gain').value,'25');assert.equal(a.input('scale').value,'major');assert.equal(a.input('gain').disabled,false);assert.equal(a.el('gain').classList.contains('may-xorrom-auto'),false);assert.doesNotMatch(a.input('gain').title,/По рисунку/);assert.equal(a.el('geometry').textContent,'Рисунок: вручную');a.dom.window.close();
});

test('step synchronization preserves focused manual edits and auto fields wait for effective values',()=>{
  const a=boot();a.input('bpm').focus();a.input('bpm').value='135';a.setState({state:'playing',index:8,effective:{bpm:110},notes:[]});assert.equal(a.input('bpm').value,'135');assert.equal(a.input('bpm').disabled,false);
  a.input('bpm').blur();a.api.setSettings({autoGeometry:true});a.setState({state:'playing',notes:[]});assert.equal(a.input('bpm').value,'96');assert.equal(a.input('bpm').disabled,false);assert.equal(a.el('geometry').textContent,'Рисунок: ожидание');
  a.setState({state:'playing',effective:{bpm:96,gain:.25},notes:[]});assert.equal(a.input('bpm').disabled,false);assert.equal(a.el('bpm').classList.contains('may-xorrom-auto'),false);a.change('bpm',140);assert.deepEqual(a.patches.at(-1),{bpm:140});a.dom.window.close();
});


test('automatic octave displays every normalized core octave without a blank selection',()=>{
  const a=boot();a.api.setSettings({autoGeometry:true});
  for(let octave=1;octave<=7;octave++){a.setState({state:'playing',effective:{octave},notes:[]});assert.equal(a.input('octave').value,String(octave));assert.equal(a.input('octave').selectedOptions[0].textContent,String(octave));}
  a.el('autoGeometry').click();assert.equal(a.input('octave').value,'4');assert.equal(a.input('octave').disabled,false);a.dom.window.close();
});


test('partial geometry modes leave unrelated musical settings editable',()=>{
 const a=boot();a.api.setSettings({autoGeometry:true,geometrySource:'symmetry'});a.setState({state:'playing',effective:{scale:'minor',octave:5,gain:.25,timbre:'triangle',tonic:0,division:8,chord:3},notes:[]});
 assert.equal(a.input('scale').disabled,true);assert.equal(a.input('octave').disabled,true);assert.equal(a.input('timbre').disabled,false);assert.equal(a.input('gain').disabled,false);a.change('gain',40);assert.deepEqual(a.patches.at(-1),{gain:.4});
 a.change('geometrySource','regions');assert.equal(a.input('timbre').disabled,true);assert.equal(a.input('scale').disabled,false);a.dom.window.close();
});


test('electro preset selects original machine tones without autoplay or replacing the chosen row range',()=>{
 const a=boot();a.api.setSettings({first:8,last:16,stride:2,loop:false,autoGeometry:true,source:'rhythm'});a.el('electro').click();assert.deepEqual(a.patches.at(-1),require('./mayatnik-xorrom.js').ELECTRO_PRESET);assert.equal(a.starts,0);assert.equal(a.input('first').value,'8');assert.equal(a.input('last').value,'16');assert.equal(a.input('stride').value,'2');assert.equal(a.api.getSettings().loop,false);assert.equal(a.api.getSettings().autoGeometry,false);assert.equal(a.input('timbre').value,'pulse');assert.equal(a.input('bpm').value,'112');assert.equal(a.input('timbre').disabled,false);assert.equal(a.el('electro').dataset.n,'xorrom-electro');a.dom.window.close();
});
test('four new timbres are selectable; drum mode explains timbre through its own fixed voices',()=>{
 const a=boot();for(const timbre of ['bass','pulse','metal','robot']){a.change('timbre',timbre);assert.deepEqual(a.patches.at(-1),{timbre});assert.equal(a.input('timbre').value,timbre);}a.change('source','rhythm');assert.equal(a.input('timbre').disabled,true);assert.match(a.input('timbre').title,/Ритм/);a.change('source','rgb');assert.equal(a.input('timbre').disabled,false);a.dom.window.close();
});


test('backing controls preserve solo settings, use stable IDs and never start playback',()=>{
 const a=boot();assert.equal(a.input('backing').value,'off');assert.equal(a.input('backingGain').disabled,true);
 a.change('backing','pad');assert.equal(a.input('backingGain').disabled,false);assert.equal(a.input('backingRows').disabled,false);a.change('backingGain',30);assert.deepEqual(a.patches.at(-1),{backingGain:.3});a.change('backingRows',4);a.change('backingTimbre','triangle');assert.equal(a.starts,0);
 assert.equal(a.api.getSettings().backing,'pad');assert.equal(a.input('timbre').value,'triangle');
 a.setState({state:'playing',index:1,notes:[],backingNotes:[{midi:48}]});assert.match(a.el('notes').textContent,/Фон До3/);
 a.change('backing','off');assert.equal(a.input('backingTimbre').disabled,true);assert.equal(a.input('backingGain').value,'30');a.change('backing','bass');assert.equal(a.input('backingGain').value,'30');a.dom.window.close();
});


const SYNTH_DEFAULTS={envelopeOn:false,attack:.005,decay:.08,sustain:.7,release:.12,filterType:'off',cutoff:8000,resonance:.7,lfoTarget:'off',lfoRate:2,lfoDepth:0,delayTime:.25,delayFeedback:.25,delayMix:0,reverbMix:0,reverbTime:1,pan:0,arpMode:'off',arpGate:.8,swing:0};
function jsonCore(a,validate=value=>value){a.dom.window.MayatnikXorrom={DEFAULTS:{...require('./mayatnik-xorrom.js').DEFAULTS,...SYNTH_DEFAULTS},validateSettings:validate};}
function chooseJSON(a,text,options={}){const file=options.file||{size:options.size??new a.dom.window.Blob([text]).size,text:async()=>text};Object.defineProperty(a.el('jsonFile'),'files',{configurable:true,value:options.cancel?[]:[file]});a.el('jsonFile').dispatchEvent(new a.dom.window.Event('change',{bubbles:true}));}
function blobText(a,blob){return new Promise((resolve,reject)=>{const reader=new a.dom.window.FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsText(blob);});}

test('synth parameters keep exact defaults, decimal units and percent conversions without autoplay',()=>{
 const a=boot();assert.equal(a.el('envelopeOn').getAttribute('aria-pressed'),'false');
 const percent=new Set(['sustain','lfoDepth','delayFeedback','delayMix','reverbMix','pan','arpGate','swing']);
 for(const [key,value]of Object.entries(SYNTH_DEFAULTS)){if(key==='envelopeOn')continue;assert.equal(a.input(key).value,String(percent.has(key)?Math.round(value*100):value));assert.equal(a.el(key).dataset.n,'xorrom-'+key);assert.ok(a.el(key).classList.contains('gz-split'));}
 for(const [key,value,normalized]of [['attack',.005,.005],['decay',1.234,1.234],['release',.333,.333],['resonance',.7,.7],['lfoRate',.01,.01],['delayTime',.27,.27],['reverbTime',1.25,1.25],['sustain',35,.35],['lfoDepth',42,.42],['delayFeedback',120,.9],['delayMix',55,.55],['reverbMix',25,.25],['pan',-75,-.75],['arpGate',1,.05],['swing',99,.75]]){a.change(key,value);assert.deepEqual(a.patches.at(-1),{[key]:normalized});}
 for(const [key,value]of [['filterType','bandpass'],['lfoTarget','pan'],['arpMode','updown']]){a.change(key,value);assert.deepEqual(a.patches.at(-1),{[key]:value});}
 a.el('envelopeOn').click();assert.deepEqual(a.patches.at(-1),{envelopeOn:true});assert.equal(a.starts,0);a.dom.window.close();
});

test('JSON export saves a pure full manual settings object including every synth field',async()=>{
 const a=boot();let validated;jsonCore(a,value=>{validated=value;return {...value};});a.api.setSettings({attack:.55,pan:-.2,autoGeometry:true});a.setState({state:'playing',effective:{gain:.1,octave:7},notes:[]});
 a.el('jsonSave').click();await flush();assert.equal(a.downloaded.length,1);assert.equal(a.downloaded[0].name,'xorrom-settings.json');assert.equal(a.downloaded[0].blob.type,'application/json');const saved=JSON.parse(await blobText(a,a.downloaded[0].blob));assert.deepEqual(saved,validated);
 for(const key of Object.keys(SYNTH_DEFAULTS))assert.ok(Object.hasOwn(saved,key),key);assert.equal(saved.attack,.55);assert.equal(saved.pan,-.2);assert.equal(saved.gain,.25);assert.equal(saved.octave,4);assert.equal(saved.settings,undefined);assert.match(a.el('status').textContent,/JSON сохранены/);assert.equal(a.starts,0);a.dom.window.close();
});

test('JSON import validates a BOM file before pausing and atomically applies without autoplay; repeated file works',async()=>{
 const a=boot(),order=[],valid={...require('./mayatnik-xorrom.js').DEFAULTS,...SYNTH_DEFAULTS,attack:.75,lfoTarget:'pitch'};jsonCore(a,value=>{order.push('validate');assert.deepEqual(value,valid);return {...value};});
 const originalPause=a.api.pause;a.api.pause=()=>{order.push('pause');return originalPause();};const originalSet=a.api.setSettings;a.api.setSettings=value=>{order.push('set');return originalSet(value);};a.setState({state:'playing',notes:[]});
 chooseJSON(a,'\uFEFF'+JSON.stringify(valid));await flush();assert.deepEqual(order,['validate','pause','set']);assert.equal(a.patches.length,1);assert.deepEqual(a.patches[0],valid);assert.equal(a.api.getState().state,'paused');assert.equal(a.starts,0);assert.equal(a.el('jsonFile').value,'');assert.match(a.el('status').textContent,/Нажмите Старт/);
 chooseJSON(a,JSON.stringify(valid));await flush();assert.deepEqual(order.slice(3),['validate','pause','set']);assert.equal(a.patches.length,2);assert.equal(a.starts,0);a.dom.window.close();
});

test('malformed, oversized and rejected JSON never pauses or partially changes settings',async()=>{
 const a=boot();let validations=0,pauses=0;jsonCore(a,()=>{validations++;throw Error('Настройки: отсутствует attack');});a.api.pause=()=>pauses++;a.setState({state:'playing',notes:[]});
 chooseJSON(a,'{');await flush();assert.match(a.el('status').textContent,/Неверный JSON/);assert.equal(validations,0);
 chooseJSON(a,'{}',{size:65537});await flush();assert.match(a.el('status').textContent,/64 КиБ/);assert.equal(validations,0);
 chooseJSON(a,' '.repeat(65537),{size:1});await flush();assert.match(a.el('status').textContent,/64 КиБ/);assert.equal(validations,0);
 chooseJSON(a,'{}');await flush();assert.match(a.el('status').textContent,/отсутствует attack/);assert.equal(validations,1);assert.equal(pauses,0);assert.deepEqual(a.patches,[]);assert.equal(a.api.getState().state,'playing');assert.equal(a.starts,0);a.dom.window.close();
});

test('JSON cancellation and read failures give feedback; destroy cancels late file results without mutations',async()=>{
 const a=boot();jsonCore(a);chooseJSON(a,'',{cancel:true});assert.match(a.el('status').textContent,/Импорт отменён/);a.el('jsonFile').dispatchEvent(new a.dom.window.Event('cancel'));assert.match(a.el('status').textContent,/Импорт отменён/);
 chooseJSON(a,'',{file:{size:1,text:async()=>{throw Error('Нет доступа к файлу');}}});await flush();assert.match(a.el('status').textContent,/Нет доступа/);assert.equal(a.el('jsonLoad').disabled,false);
 let finish;chooseJSON(a,'',{file:{size:2,text:()=>new Promise(resolve=>finish=resolve)}});assert.equal(a.el('jsonLoad').disabled,true);assert.equal(a.el('start').disabled,true);a.control.destroy();finish('{}');await flush();assert.deepEqual(a.patches,[]);assert.equal(a.host.innerHTML,'<b>existing</b>');assert.equal(a.starts,0);a.dom.window.close();
});

test('destroy during an asynchronous import pause cannot apply the validated file',async()=>{
 let finishPause;const a=boot({pause:()=>new Promise(resolve=>finishPause=resolve)});jsonCore(a);a.setState({state:'playing',notes:[]});chooseJSON(a,'{}');await flush();assert.equal(typeof finishPause,'function');a.control.destroy();finishPause();await flush();assert.deepEqual(a.patches,[]);assert.equal(a.starts,0);a.dom.window.close();
});

test('JSON FileReader fallback reads native File objects and reports missing validator safely',async()=>{
 const a=boot();jsonCore(a);const file=new a.dom.window.File(['{"attack":0.25}'],'test.json',{type:'application/json'});chooseJSON(a,'',{file});await new Promise(resolve=>setTimeout(resolve,30));assert.deepEqual(a.patches.at(-1),{attack:.25});
 delete a.dom.window.MayatnikXorrom;chooseJSON(a,'{}');await flush();assert.match(a.el('status').textContent,/Проверка настроек недоступна/);assert.equal(a.patches.length,1);a.dom.window.close();
});


test('JSON import is blocked while a deferred start is preparing and does not pause or mutate',async()=>{
 let finishStart,pauses=0,checks=0;const a=boot({start:()=>new Promise(resolve=>finishStart=resolve),pause:()=>{pauses++;}});jsonCore(a,value=>{checks++;return value;});a.el('start').click();assert.equal(a.el('jsonLoad').disabled,true);
 a.el('jsonLoad').click();chooseJSON(a,'{}');await flush();assert.equal(checks,0);assert.equal(pauses,0);assert.deepEqual(a.patches,[]);finishStart();await flush();assert.equal(a.el('jsonLoad').disabled,false);a.dom.window.close();
});

test('a valid JSON import cancels pending API audio preparation even before playing is reported',async()=>{
 let cancelled=0;const a=boot({pause:()=>{cancelled++;}});jsonCore(a);a.setState({state:'stopped',notes:[]});chooseJSON(a,'{}');await flush();assert.equal(cancelled,1);assert.equal(a.patches.length,1);assert.equal(a.starts,0);a.dom.window.close();
});


test('real engine validator accepts a full JSON roundtrip and atomically rejects unknown, missing, wrong-type and out-of-range synth values',async()=>{
 const core=require('./mayatnik-xorrom.js'),a=boot();a.dom.window.MayatnikXorrom=core;let pauses=0;const pause=a.api.pause;a.api.pause=()=>{pauses++;return pause();};a.setState({state:'playing',notes:[]});
 const invalids=[{...core.DEFAULTS,unknown:1},{...core.DEFAULTS,attack:'0.5'},{...core.DEFAULTS,delayFeedback:.95},{...core.DEFAULTS,envelopeOn:1},Object.fromEntries(Object.entries(core.DEFAULTS).filter(([key])=>key!=='swing'))];
 for(const value of invalids){chooseJSON(a,JSON.stringify(value));await flush();assert.match(a.el('status').textContent,/Ошибка:/);assert.equal(pauses,0);assert.deepEqual(a.patches,[]);assert.equal(a.api.getState().state,'playing');}
 const full={...core.DEFAULTS,envelopeOn:true,attack:.123,filterType:'highpass',lfoTarget:'pan',lfoRate:.05,delayMix:.3,pan:-.4,arpMode:'updown',swing:.25};chooseJSON(a,'\uFEFF'+JSON.stringify(full));await flush();assert.equal(pauses,1);assert.deepEqual(a.patches,[full]);assert.equal(a.starts,0);
 a.el('jsonSave').click();await flush();const saved=JSON.parse(await blobText(a,a.downloaded[0].blob));assert.deepEqual(saved,full);assert.deepEqual(core.validateSettings(saved),full);assert.equal(Object.keys(saved).length,Object.keys(core.DEFAULTS).length);a.dom.window.close();
});

test('browser-realm modules validate their JSON import in the same realm as production',async()=>{
 const fs=require('node:fs'),dom=new JSDOM('<div id="host"></div>',{runScripts:'outside-only'}),win=dom.window;
 win.eval(fs.readFileSync(require.resolve('./mayatnik-xorrom.js'),'utf8'));win.eval(fs.readFileSync(require.resolve('./mayatnik-xorrom-controls.js'),'utf8'));
 let config=win.MayatnikXorrom.DEFAULTS,changes=0,starts=0;const api={getSettings:()=>config,getState:()=>({state:'stopped'}),setSettings:value=>{config=value;changes++;},pause(){},start(){starts++;}};
 const host=win.document.querySelector('#host'),controls=win.MayatnikXorromControls.mount(host,{api}),file=host.querySelector('[data-xorrom="jsonFile"]');
 const full=win.JSON.parse(win.JSON.stringify({...win.MayatnikXorrom.DEFAULTS,attack:.75}));Object.defineProperty(file,'files',{value:[{size:1000,text:async()=>win.JSON.stringify(full)}]});file.dispatchEvent(new win.Event('change'));await flush();assert.equal(changes,1);assert.equal(config.attack,.75);assert.equal(starts,0);assert.equal(win.Object.getPrototypeOf(config),win.Object.prototype);controls.destroy();dom.window.close();
});

test('late-loaded shared frame supplies real side contours; axis coordinates remain signed and track picker stays alive',()=>{
 const fs=require('node:fs'),dom=new JSDOM('<div id="host"></div>',{runScripts:'outside-only'}),w=dom.window;
 try{
  w.eval(fs.readFileSync(require.resolve('./mayatnik-xorrom-controls.js'),'utf8'));
  w.eval(fs.readFileSync(require.resolve('../_js/control-frame.js'),'utf8'));
  let selected=1,spec={x1:0,y1:0,x2:9,y2:9},listener;const tracks=[{id:1,name:'A',color:'#f00',muted:false},{id:2,name:'B',color:'#0ff',muted:false}];
  const api={getSettings:()=>({}),getState:()=>({state:'stopped'}),getRack:()=>({selected,tracks}),getTrackList:()=>({selected,tracks}),getAxis:()=>spec,getAxisName:()=>'',getTemplate:()=>null,getSize:()=>({width:10,height:10}),getAxes:()=>[],setAxis:v=>{spec=v;listener?.();},select:id=>{selected=id;listener?.();},subscribe:fn=>{listener=fn;return()=>{};}};
  const host=w.document.getElementById('host'),control=w.MayatnikXorromControls.mount(host,{api});
  const pick=host.querySelector('[data-xorrom="track"] select'),options=[...pick.options];pick.focus();listener();assert.equal(w.document.activeElement,pick);assert.deepEqual([...pick.options],options);
  host.querySelector('[data-xorrom="track"] [data-xorrom-step="1"]').click();assert.equal(selected,2);assert.equal(host.querySelector('[data-xorrom="track"] select'),pick);
  const axis=host.querySelector('[data-xorrom="trackAxisx1"]');assert.equal(axis.querySelectorAll('.zcf-outline').length,3);axis.querySelector('[data-xorrom-step="-1"]').click();assert.equal(spec.x1,-1);
  assert.equal(host.querySelector('[data-xorrom-group="tracks"]').getAttribute('aria-label'),'Дорожки');control.destroy();
 }finally{dom.window.close();}
});

test('music grid CSS is scoped, uses standard columns/gaps and hides native field arrows',()=>{
 const css=require('node:fs').readFileSync(__dirname+'/mayatnik-xorrom-controls.css','utf8');
 assert.match(css,/:is\(#mayMusicPane,#mayMusicSettingsPane\) \.may-xorrom-grid\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(min\(120px,100%\),120px\)\);gap:2px 6px/);
 assert.match(css,/\.may-xorrom-value>\.gz-h1[^}]*appearance:none/);assert.match(css,/::-webkit-inner-spin-button/);assert.match(css,/\.may-xorrom-value:focus-within/);
});

test('destroy aborts an active FileReader and a pause failure leaves settings untouched',async()=>{
 const a=boot();jsonCore(a);const file=new a.dom.window.File(['{}'],'cancel.json');chooseJSON(a,'',{file});a.control.destroy();await new Promise(resolve=>setTimeout(resolve,30));assert.deepEqual(a.patches,[]);assert.equal(a.host.innerHTML,'<b>existing</b>');a.dom.window.close();
 const b=boot({pause:()=>{throw Error('Не удалось остановить подготовку звука');}});jsonCore(b);chooseJSON(b,'{}');await flush();assert.deepEqual(b.patches,[]);assert.match(b.el('status').textContent,/Не удалось остановить/);assert.equal(b.starts,0);b.dom.window.close();
});
