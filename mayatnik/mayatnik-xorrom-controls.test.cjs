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
test('mount reads state without starting audio and owns only its appended controls',()=>{
  const a=boot();assert.equal(a.starts,0);assert.equal(a.input('source').value,'rgb');assert.equal(a.input('bpm').value,'96');assert.equal(a.input('gain').value,'25');assert.equal(a.el('start').getAttribute('aria-pressed'),'false');
  a.control.destroy();a.control.destroy();assert.equal(a.unsubscribed,1);assert.equal(a.host.innerHTML,'<b>existing</b>');assert.equal(a.dom.window.document.querySelector('#other').textContent,'other');a.dom.window.close();
});
test('settings normalize UI units and bounds, source gates RGB chord, API changes sync',()=>{
  const a=boot();a.change('bpm',999);assert.deepEqual(a.patches.at(-1),{bpm:180});a.change('gain',40);assert.deepEqual(a.patches.at(-1),{gain:.4});a.change('stride',0);assert.deepEqual(a.patches.at(-1),{stride:1});
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
