/* v0.626: Editable binary rows shared by Очки and the live/detached library.
   v0.626: the table keeps old gold rows across frames; new matches are added to
   foundHistory, current found stays only for the frame and field highlight. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikSequences=api;})(globalThis,function(){
  'use strict';
  const KEY='mayatnik-sequences-v1',MAX_BITS=2100000,MAX_ROWS=4096;
  const directionLabel=mode=>({v:'вдоль осей ↘↗',row:'по рядам →',col:'по столбцам ↓',antidiag:'по противодиагоналям ↙',diag:'по диагоналям ↘',snake:'змея вниз ↙↘',all:'во всех 4 направлениях',0:'по рядам →',2:'по столбцам ↓','-1':'по противодиагоналям ↙',1:'по диагоналям ↘'}[mode]||'по диагоналям ↘');
  function parse(text){const value=String(text).replace(/\r\n?/g,'\n').trim();if(!value)return[];const rows=value.split('\n');if(rows.length>MAX_ROWS)throw Error('Не более '+MAX_ROWS+' строк. Данные не изменены.');let bits=0;rows.forEach((row,i)=>{if(!/^[01]+$/.test(row))throw Error('Строка '+(i+1)+': допустимы только 0 и 1, без пробелов.');bits+=row.length;});if(bits>MAX_BITS)throw Error('Больше '+MAX_BITS+' бит. Данные не изменены.');return rows;}
  function sierpinski(count){count=Number(count);if(!Number.isInteger(count)||count<1||count>2048)throw Error('Для Серпинского задайте от 1 до 2048 строк.');const rows=['1'];for(let i=1;i<count;i++){const prev=rows[i-1];let next='';for(let j=0;j<=i;j++)next+=Number(prev[j-1]||0)^Number(prev[j]||0);rows.push(next);}return rows;}
  // Wolfram numbering: bit (4*left+2*centre+right) is the next cell.
  // Each finite row gains one cell on each side; outside it the input is zero.
  function elementary({rule=90,seed='1',count=512,compact=false}={}){
    if(String(rule).trim()==='')throw Error('Введите номер правила от 0 до 255.');
    rule=Number(rule);count=Number(count);seed=String(seed);
    if(!Number.isInteger(rule)||rule<0||rule>255)throw Error('Правило — целое число от 0 до 255.');
    if(!Number.isInteger(count)||count<1||count>2048)throw Error('Задайте от 1 до 2048 строк.');
    if(!/^[01]+$/.test(seed))throw Error('Начальная строка — непустая последовательность из 0 и 1 без пробелов.');
    if(compact&&(rule!==90||seed!=='1'))throw Error('Сжатые строки доступны для правила 90 с начальной строкой 1.');
    const bits=compact?count*(count+1)/2:count*seed.length+count*(count-1);
    if(bits>MAX_BITS)throw Error('Больше '+MAX_BITS+' бит. Уменьшите число строк или начальную строку.');
    if(compact)return sierpinski(count);
    const rows=[seed];
    for(let i=1;i<count;i++){
      const prev=rows[i-1],next=new Array(prev.length+2);
      for(let j=0;j<next.length;j++){const at=j-1,pattern=(prev[at-1]==='1'?4:0)|(prev[at]==='1'?2:0)|(prev[at+1]==='1'?1:0);next[j]=String((rule>>pattern)&1);}
      rows.push(next.join(''));
    }
    return rows;
  }
  function create(storage,{rows:count=512,initialRows=[]}={}){
    const originalRows=parse(initialRows.join('\n'));
    let state=null,error='',revision=0,matches={enabled:false,active:false,found:[]},matchKey='',matchScope,foundHistory=new Map(),selection=null,selectionSerial=0,listeners=new Set();
    try{const raw=storage?.getItem(KEY);if(raw!==null&&raw!==undefined){const saved=JSON.parse(raw);if(saved?.version!==1||!Array.isArray(saved.rows)||saved.rows.some(row=>typeof row!=='string'))throw Error('format');state={rows:parse(saved.rows.join('\n')),source:saved.source==='serp'?'serp':'user',count:saved.count||saved.rows.length};}}catch(_){state={rows:[],source:'user',count:0};error='Сохранённая последовательность повреждена. Исходная запись сохранена; исправьте строки и нажмите «Применить».';}
    const emit=kind=>{for(const listener of listeners)listener(kind);};
    const write=(rows,source,count)=>{const next={version:1,rows,source,count};try{storage?.setItem(KEY,JSON.stringify(next));}catch(_){throw Error('Не удалось сохранить последовательность в браузере. Освободите место и повторите.');}state=next;error='';selection=null;foundHistory.clear();matches={...matches,active:false,found:[]};matchKey='';revision++;emit('sequence');};
    const api={get rows(){return state.rows;},get initialRows(){return originalRows.slice();},get revision(){return revision;},snapshot:()=>({rows:state.rows,source:state.source,count:state.count,revision,error,matches,foundHistory:Array.from(foundHistory.values()),selection}),subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},setText(text){const rows=parse(text);write(rows,'user',rows.length);},generate(count){const rows=sierpinski(count);write(rows,'serp',rows.length);},selectMatches(value){selection=value?{...value,token:++selectionSerial}:null;emit('selection');},setMatches(value){const key=JSON.stringify(value);if(key===matchKey)return;matchKey=key;matches=value;
      if(!value.enabled||value.searchScope!==undefined&&value.searchScope!==matchScope)foundHistory.clear();
      matchScope=value.searchScope;
      if(value.enabled&&value.active&&value.complete!==false&&(!value.pattern||value.pattern==='initial')){
        const rows=new Map();for(const hit of value.found||[]){if(!Number.isInteger(hit.i)||hit.i<0||hit.i>=state.rows.length)continue;if(!rows.has(hit.i))rows.set(hit.i,[]);rows.get(hit.i).push({...hit});}
        for(const [i,hits]of rows){const prior=foundHistory.get(i),merged=value.halves===2?[...(prior?.hits||[]).filter(old=>!hits.some(hit=>hit.p===old.p)),...hits]:hits;foundHistory.set(i,{i,hits:merged,frame:value.frame,mode:value.mode,halves:value.halves,joined:value.joined});}
      }
      emit('matches');}};
    if(!state){const n=Math.max(1,Math.min(512,Math.floor(Number(count)||512)));state={rows:sierpinski(n),source:'serp',count:n};try{storage?.setItem(KEY,JSON.stringify({version:1,...state}));}catch(_){error='Начальные строки созданы, но браузер не смог их сохранить.';}}
    return api;
  }
  function mount(pane,api){
    const doc=pane.ownerDocument;pane.classList.add('mtp-sequences');pane.dataset.noMini='';
    const intro=doc.createElement('p');intro.textContent='Строки для «Начальной» в Очках. Серпинский: 60, 90, 102; другие узоры: 30, 150.';
    const label=doc.createElement('label');label.textContent='Своя последовательность';const editor=doc.createElement('textarea');editor.id='maySequenceEditor';editor.setAttribute('aria-label','Строки своей последовательности');editor.spellcheck=false;editor.wrap='off';label.append(editor);
    const commands=doc.createElement('div');commands.className='mtp-sequence-actions';
    const notice=doc.createElement('output');notice.className='mtp-sequence-notice';notice.setAttribute('role','status');let dirty=false,rendered=-1;
    const button=(text,run)=>{const b=doc.createElement('button');b.type='button';b.className='mtp-command';b.textContent=text;b.addEventListener('click',()=>{try{run();}catch(e){notice.textContent=e.message;}});commands.append(b);return b;};
    const save=button('Применить',()=>{api.setText(editor.value);dirty=false;rendered=-1;notice.textContent='Сохранено. Очки используют эти строки.';refresh();});save.dataset.sequenceSave='';
    editor.addEventListener('input',()=>{dirty=true;notice.textContent='Есть изменения — нажмите «Применить». Они ещё не участвуют в поиске.';});
    const append=doc.createElement('input');append.type='text';append.inputMode='numeric';append.placeholder='Новая строка: 01…';append.setAttribute('aria-label','Добавить строку последовательности');commands.append(append);
    button('＋ Строка',()=>{if(!append.value.trim())throw Error('Введите новую строку из 0 и 1.');parse(append.value);editor.value+=(editor.value.trim()?'\n':'')+append.value.trim();append.value='';dirty=true;notice.textContent='Строка добавлена в редактор — нажмите «Применить».';});
    const initial=button('↓ Начальная',()=>{const rows=api.initialRows;if(!rows.length)throw Error('Исходная начальная последовательность недоступна.');editor.value=rows.join('\n');dirty=true;notice.textContent='Начальная последовательность вставлена в редактор — нажмите «Применить».';});initial.setAttribute('aria-label','Вставить исходную начальную последовательность');initial.dataset.sequenceInitial='';
    const generator=doc.createElement('div');generator.className='mtp-sequence-generator';generator.setAttribute('role','group');generator.setAttribute('aria-label','Генератор последовательностей');generator.title='Одна строка — один ряд из 0 и 1. Каждый полный ряд расширяется на две ячейки; вне предыдущего конечного ряда вход равен 0, в том числе для правил с 000 → 1. Сжатые 90 соответствуют строкам Хаба: 1, 11, 101…';
    function field(text,control){const label=doc.createElement('label');label.textContent=text;label.append(control);generator.append(label);return control;}
    const presets=doc.createElement('select');presets.setAttribute('aria-label','Быстрый выбор правила');for(const n of [30,60,90,102,150]){const option=doc.createElement('option');option.value=String(n);option.textContent=String(n);presets.append(option);}const custom=doc.createElement('option');custom.value='custom';custom.textContent='Своё';presets.append(custom);presets.value='90';field('Правило',presets);
    const rule=doc.createElement('input');rule.type='number';rule.min='0';rule.max='255';rule.value='90';rule.setAttribute('aria-label','Номер правила от 0 до 255');field('0–255',rule);
    const seed=doc.createElement('input');seed.type='text';seed.inputMode='numeric';seed.value='1';seed.setAttribute('aria-label','Начальная строка генератора из 0 и 1');field('Начальная строка',seed);
    const count=doc.createElement('input');count.type='number';count.min='1';count.max='2048';count.value=String(Math.min(2048,api.snapshot().count||512));count.setAttribute('aria-label','Число строк генератора');field('Строк',count);
    const compact=doc.createElement('input');compact.type='checkbox';compact.checked=true;compact.setAttribute('aria-label','Сжатые строки правила 90 как в Хабе');field('Сжатые 90: 1, 11, 101…',compact);
    function syncCompact(){compact.disabled=Number(rule.value)!==90||seed.value!=='1';if(compact.disabled)compact.checked=false;}
    presets.addEventListener('change',()=>{if(presets.value!=='custom')rule.value=presets.value;syncCompact();});rule.addEventListener('input',()=>{presets.value=['30','60','90','102','150'].includes(rule.value)?rule.value:'custom';syncCompact();});seed.addEventListener('input',syncCompact);
    const insert=button('↓ Вставить',()=>{const rows=elementary({rule:rule.value,seed:seed.value,count:count.value,compact:compact.checked});editor.value=rows.join('\n');dirty=true;notice.textContent='В редактор вставлено '+rows.length+' строк правила '+Number(rule.value)+'. Нажмите «Применить».';});insert.setAttribute('aria-label','Вставить сгенерированные строки в редактор');insert.dataset.sequenceGenerate='';generator.append(insert);
    const summary=doc.createElement('output');summary.className='mtp-sequence-summary';summary.setAttribute('aria-live','polite');const list=doc.createElement('ol');list.className='mtp-sequence-rows';list.setAttribute('aria-label','Строки и совпадения Очков');let nodes=[],listKey='',scrolledSelection=0;list.setAttribute('role','listbox');list.setAttribute('aria-multiselectable','true');
    pane.append(intro,label,commands,generator,notice,summary,list);
    function refresh(){
      if(pane.closest('[hidden]'))return;const state=api.snapshot(),m=state.matches||{},simple=m.pattern&&m.pattern!=='initial',shown=simple&&m.active?(m.found||[]).map(hit=>hit.text||''):state.rows;
      if(rendered!==state.revision){if(!dirty)editor.value=state.rows.join('\n');rendered=state.revision;if(state.error)notice.textContent=state.error;}
      const key=simple&&m.active?'runs:'+shown.join('|'):'sequence:'+state.revision;if(key!==listKey){listKey=key;nodes=shown.map((text,i)=>{const li=doc.createElement('li'),code=doc.createElement('code');li.dataset.sequenceRow=String(i);li.setAttribute('role','option');code.textContent=text;li.append(code);return li;});list.replaceChildren(...nodes);}
      const modeLabel=directionLabel(m.mode);
      const found=new Map();for(const hit of m.found||[]){if(!found.has(hit.i))found.set(hit.i,[]);found.get(hit.i).push(hit);}
      const foundEver=Number.isInteger(m.foundEver)?m.foundEver:found.size;
      const foundIndices=new Set(Array.isArray(m.foundIndices)?m.foundIndices:(m.found||[]).map(hit=>hit.i));
      const previous=new Map((state.foundHistory||[]).map(entry=>[entry.i,entry]));
      nodes.forEach((node,i)=>{const current=m.enabled&&m.active?(simple?((m.found||[])[i]?[(m.found||[])[i]]:[]):found.get(i)||[]):[],prior=m.enabled&&!simple?previous.get(i):null,hits=current.length?current:prior?.hits||[],past=!current.length&&!!prior;
        const context=past?prior:m,title=hits.map(hit=>(past?'Ранее найдено · кадр '+prior.frame+': ':'Найдено на поле: ')+(context.halves===2?(hit.p?'правый':'левый')+' полумаятник · ':'')+(context.joined?'строка ромба ':'строка ')+(hit.r+1)+' · '+(context.mode==='all'?directionLabel(hit.dir):directionLabel(context.mode))+(hit.vn?' · '+hit.vn:'')).join('\n');
        if(node.dataset.found!==String(hits.length>0)){node.classList.toggle('is-found',hits.length>0);node.dataset.found=String(hits.length>0);}if(node.title!==title)node.title=title;});
      const selection=state.selection,selected=new Set(simple?selection?.matchIndices:selection?.rowIndices);nodes.forEach((node,i)=>{const on=selected.has(i);node.classList.toggle('is-selected',on);if(node.getAttribute('aria-selected')!==String(on))node.setAttribute('aria-selected',String(on));});
      if(selection&&selection.token!==scrolledSelection){const first=nodes.find((node,i)=>selected.has(i));if(first){const top=first.offsetTop-list.offsetTop,bottom=top+first.offsetHeight;if(top<list.scrollTop)list.scrollTop=top;else if(bottom>list.scrollTop+list.clientHeight)list.scrollTop=Math.max(0,bottom-list.clientHeight);scrolledSelection=selection.token;}}
      if(!m.enabled)summary.textContent='Очки выключены.';
      else if(!m.active)summary.textContent='Кадр '+m.frame+': '+(m.reason||'ожидание поиска');
      else if(simple)summary.textContent='Серии '+({ones:'111…',zeros:'000…',alternating:'1010…'}[m.pattern]||'')+': '+m.count+(m.count>shown.length?' · показаны первые '+shown.length:'')+' · кадр '+m.frame+' · '+modeLabel;
      else {
        const fresh=(m.found||[]).length, totalFound=previous.size||foundEver;
        let text=(fresh?'Новых: '+fresh+' · ':'')+'Всего найдено '+totalFound+' из '+state.rows.length+' строк';
        if(m.halves===2)text+=' · '+(m.foundCount??(Array.from(previous.values()).reduce((n,entry)=>n+entry.hits.length,0)||fresh))+' из '+(m.total??state.rows.length*2)+' совпадений в двух полумаятниках';
        summary.textContent=text+' · кадр '+m.frame+' · '+modeLabel;
        if(m.complete===false)summary.textContent+=' · '+m.reason;
        if(m.joined)summary.textContent+=' · единый ромб';
      }
    }
    const unsubscribe=api.subscribe(refresh);refresh();return {refresh,save:()=>save.click(),destroy:unsubscribe};
  }
  return {KEY,parse,sierpinski,elementary,create,mount};
});
