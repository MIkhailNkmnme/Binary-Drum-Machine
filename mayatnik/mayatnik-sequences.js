/* v0.626: Editable binary rows shared by Очки and the live/detached library.
   v0.626: the table keeps old gold rows across frames; new matches are added to
   foundHistory, current found stays only for the frame and field highlight. */
(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./mayatnik-ochki-method.js'):root.MayatnikOchkiMethod,node?require('./mayatnik-sequence-columns.js'):root.MayatnikSequenceColumns,node?require('./mayatnik-sequence-catalog.js'):root.MayatnikSequenceCatalog);if(node)module.exports=api;else root.MayatnikSequences=api;})(globalThis,function(Methods,Columns,Catalog){
  'use strict';
  const methodLabel=Methods.label;
  const KEY='mayatnik-sequences-v1',MAX_BITS=2100000,MAX_ROWS=4096;
  const COLUMN_KEYS=['number','sequence','frame','start','end','method'];
  function copyHit(hit){const start=hit.start||(hit.displayStart?{display:{...hit.displayStart,space:'поле'}}:null);return {...hit,start:start?JSON.parse(JSON.stringify(start)):null,end:hit.end?JSON.parse(JSON.stringify(hit.end)):null};}
  function startLabel(start){if(start&&Number.isInteger(start.row)&&Number.isInteger(start.bit)){return {text:(start.row+1)+':'+(start.bit+1),title:'Строка '+(start.row+1)+' · бит '+(start.bit+1)+(start.fragment!=null?' · фрагмент '+start.fragment:'')};}if(!start)return {text:'—',title:'Начальный бит не записан'};const source=start.source||{},display=start.display||{},lines=[],number=n=>Number.isFinite(n)?String(n):null;let text='';
    if(Number.isInteger(source.q)&&source.q>=0){text='#'+(source.q+1);lines.push('Исходный бит '+(source.q+1)+' (индекс q='+source.q+')');}
    if(Number.isInteger(source.r)&&Number.isInteger(source.c)){text=(source.r+1)+':'+(source.c+1);lines.push('Исходная строка '+(source.r+1)+', столбец '+(source.c+1));}
    if(Number.isInteger(display.row)&&Number.isInteger(display.col)){text=(display.row+1)+':'+(display.col+1);lines.push('Отображаемая строка '+(display.row+1)+', столбец '+(display.col+1));}
    if(number(display.x)!==null&&number(display.y)!==null){if(!text)text='x'+display.x+' y'+display.y;lines.push('Координаты отображения: x='+display.x+', y='+display.y);}
    if(display.space)lines.push('Система отображения: '+display.space);return {text:text||'—',title:lines.join('\n')||'Начальный бит не записан'};
  }
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
    let state=null,error='',revision=0,matches={enabled:false,active:false,found:[]},manualMatch=null,snakeSelection=null,matchKey='',matchScope,foundHistory=new Map(),firstFinds=new Map(),firstScope,selection=null,selectionSerial=0,listeners=new Set();
    try{const raw=storage?.getItem(KEY);if(raw!==null&&raw!==undefined){const saved=JSON.parse(raw);if(saved?.version!==1||!Array.isArray(saved.rows)||saved.rows.some(row=>typeof row!=='string'))throw Error('format');state={rows:parse(saved.rows.join('\n')),source:saved.source==='serp'?'serp':'user',count:saved.count||saved.rows.length};}}catch(_){state={rows:[],source:'user',count:0};error='Сохранённая последовательность повреждена. Исходная запись сохранена; исправьте строки и нажмите «Применить».';}
    const emit=kind=>{for(const listener of listeners)listener(kind);};
    const write=(rows,source,count)=>{const next={version:1,rows,source,count};try{storage?.setItem(KEY,JSON.stringify(next));}catch(_){throw Error('Не удалось сохранить последовательность в браузере. Освободите место и повторите.');}state=next;error='';selection=null;manualMatch=null;snakeSelection=null;foundHistory.clear();firstFinds.clear();matches={...matches,active:false,found:[]};matchKey='';revision++;emit('sequence');};
    const remember=(hit,context)=>{
      if(!Number.isInteger(hit.i)||hit.i<0||hit.i>=state.rows.length)return;
      const key=hit.i+':'+(context.halves===2?hit.p:'single');
      if(!firstFinds.has(key))firstFinds.set(key,{...copyHit(hit),frame:context.frame,halves:context.halves,joined:!!context.joined});
    };
    const api={columns:Columns?.create(storage,COLUMN_KEYS),get rows(){return state.rows;},get initialRows(){return originalRows.slice();},get revision(){return revision;},snapshot:()=>({rows:state.rows,source:state.source,count:state.count,revision,error,matches,manualMatch:manualMatch?{...manualMatch}:null,foundHistory:Array.from(foundHistory.values(),entry=>({...entry,hits:entry.hits.map(copyHit)})),firstFinds:Array.from(firstFinds.values(),copyHit),selection,snakeSelection:snakeSelection?{...snakeSelection}:null}),subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},setText(text){const rows=parse(text);write(rows,'user',rows.length);},generate(count){const rows=sierpinski(count);write(rows,'serp',rows.length);},setManualMatch(value){if(value==null)manualMatch=null;else{const i=value.i,n=state.rows[i]?.length;if(!Number.isInteger(i)||!n)throw Error('Некорректная строка ручного поиска');const complete=value.complete!==false,matched=Math.max(0,Math.min(n,Math.floor(Number(value.matched??(value.found?n:0))||0)));manualMatch={enabled:true,i,n,matched:complete?matched:0,found:complete&&!!value.found&&matched===n,complete,variant:String(value.variant||''),variantFlags:value.variantFlags?{...value.variantFlags}:null,variantLabel:value.variantLabel||'',frame:value.frame};}emit('manual-match');},selectSnakePath(value){if(value==null)snakeSelection=null;else{if(!Number.isInteger(value.i)||!state.rows[value.i]||typeof value.id!=='string')throw Error('Некорректный выбор змеи');snakeSelection={...value,token:++selectionSerial};}emit('snake-selection');},selectMatches(value){selection=value?{...value,token:++selectionSerial}:null;emit('selection');},recordFirstFind(hit,context){if(context.searchScope!==firstScope){firstFinds.clear();firstScope=context.searchScope;}remember(hit,context);emit('first-find');},setMatches(value){const wasEnabled=matches.enabled,oldFrame=matches.frame,key=JSON.stringify(value);if(key===matchKey)return;matchKey=key;matches=value;if(Number.isFinite(oldFrame)&&Number.isFinite(value.frame)&&oldFrame!==value.frame)snakeSelection=null;if(manualMatch&&Number.isFinite(value.frame)&&Number.isFinite(manualMatch.frame)&&value.frame!==manualMatch.frame)manualMatch=null;
      if(!value.enabled||value.searchScope!==undefined&&value.searchScope!==matchScope)foundHistory.clear();
      if(wasEnabled&&!value.enabled||value.searchScope!==undefined&&value.searchScope!==firstScope)firstFinds.clear();
      firstScope=value.searchScope;matchScope=value.searchScope;
      if(value.enabled&&value.active&&value.complete!==false&&(!value.pattern||value.pattern==='initial')){
        const rows=new Map();for(const hit of value.found||[]){if(!Number.isInteger(hit.i)||hit.i<0||hit.i>=state.rows.length)continue;if(!rows.has(hit.i))rows.set(hit.i,[]);rows.get(hit.i).push(copyHit(hit));}
        for(const [i,hits]of rows){
          const prior=foundHistory.get(i),merged=[...(prior?.hits||[])];
          for(const hit of hits){remember(hit,value);if(!merged.some(old=>value.halves!==2||old.p===hit.p))merged.push({...copyHit(hit),frame:value.frame});}
          foundHistory.set(i,prior?{...prior,hits:merged}:{i,hits:merged,frame:value.frame,mode:value.mode,halves:value.halves,joined:value.joined});
        }
      }
      emit('matches');}};
    if(!state){const n=Math.max(1,Math.min(512,Math.floor(Number(count)||512)));state={rows:sierpinski(n),source:'serp',count:n};try{storage?.setItem(KEY,JSON.stringify({version:1,...state}));}catch(_){error='Начальные строки созданы, но браузер не смог их сохранить.';}}
    return api;
  }
  function paintManualWord(code,text,match){
    const reverse=!!match&&(match.variantFlags?!!match.variantFlags.reverse:/рев|rev/i.test(match.variant)),n=match?.matched||0,start=reverse?text.length-n:0,end=start+n;
    const variant=match?.variantLabel||{'':'исходная',инв:'инверсия',рев:'реверс','инв+рев':'инверсия и реверс'}[match?.variant]||match?.variant||'исходная';
    const partial=!!match&&!match.found&&match.complete&&n>0,description=match?'Ручная змея · кадр '+match.frame+' · '+(match.found?'найдена вся строка':match.complete?'совпало '+n+' из '+text.length+' битов':'поиск не завершён')+' · '+variant+(partial?' · биты исходной строки '+(start+1)+'–'+end:''):'';
    const key=JSON.stringify([text,partial,start,end]);if(code.dataset.manualWord!==key){code.dataset.manualWord=key;if(partial){const mark=code.ownerDocument.createElement('span');mark.className='mtp-manual-prefix';mark.textContent=text.slice(start,end);code.replaceChildren(code.ownerDocument.createTextNode(text.slice(0,start)),mark,code.ownerDocument.createTextNode(text.slice(end)));}else code.textContent=text;}
    code.title=text+(description?'\n'+description:'');code.setAttribute('aria-label',code.title);return description;
  }
  function mount(pane,api){
    const doc=pane.ownerDocument;pane.classList.add('mtp-sequences');pane.dataset.noMini='';
    const label=doc.createElement('div');const editor=doc.createElement('textarea');editor.id='maySequenceEditor';editor.setAttribute('aria-label','Строки своей последовательности');editor.spellcheck=false;editor.wrap='off';label.append(editor);
    const commands=doc.createElement('div');commands.className='mtp-sequence-actions';
    const notice=doc.createElement('output');notice.className='mtp-sequence-notice';notice.setAttribute('role','status');let dirty=false,rendered=-1;
    const button=(text,run)=>{const b=doc.createElement('button');b.type='button';b.className='mtp-command';b.textContent=text;b.title=text;b.setAttribute('aria-label',text);b.addEventListener('click',()=>{try{run();}catch(e){notice.textContent=e.message;}});commands.append(b);return b;};
    const save=button('Применить',()=>{api.setText(editor.value);dirty=false;rendered=-1;notice.textContent='';refresh();});save.dataset.sequenceSave='';
    editor.addEventListener('input',()=>{dirty=true;notice.textContent='Есть изменения — нажмите «Применить». Они ещё не участвуют в поиске.';});
    const append=doc.createElement('input');append.type='text';append.inputMode='numeric';append.placeholder='Новая строка: 01…';append.setAttribute('aria-label','Добавить строку последовательности');commands.append(append);
    button('＋ Строка',()=>{if(!append.value.trim())throw Error('Введите новую строку из 0 и 1.');parse(append.value);editor.value+=(editor.value.trim()?'\n':'')+append.value.trim();append.value='';dirty=true;notice.textContent='Строка добавлена в редактор — нажмите «Применить».';});

    const generator=doc.createElement('div');generator.className='mtp-sequence-generator';generator.setAttribute('role','group');generator.setAttribute('aria-label','Генератор последовательностей');generator.title='Одна строка — один ряд из 0 и 1. Каждый полный ряд расширяется на две ячейки; вне предыдущего конечного ряда вход равен 0, в том числе для правил с 000 → 1. Сжатые 90 соответствуют строкам Хаба: 1, 11, 101…';
    function field(text,control){const label=doc.createElement('label');label.title=control.getAttribute('aria-label')||text;control.title=label.title;label.append(control);generator.append(label);return control;}
    const presets=doc.createElement('select');presets.setAttribute('aria-label','Быстрый выбор правила');for(const n of [30,60,90,102,150]){const option=doc.createElement('option');option.value=String(n);option.textContent=String(n);presets.append(option);}const custom=doc.createElement('option');custom.value='custom';custom.textContent='Своё';presets.append(custom);const initial=doc.createElement('option');initial.value='initial';initial.textContent='Начальная';presets.append(initial);presets.value='90';field('Правило',presets);
    const rule=doc.createElement('input');rule.type='number';rule.min='0';rule.max='255';rule.value='90';rule.setAttribute('aria-label','Номер правила от 0 до 255');field('0–255',rule);
    const seed=doc.createElement('input');seed.type='text';seed.inputMode='numeric';seed.value='1';seed.setAttribute('aria-label','Начальная строка генератора из 0 и 1');field('Начальная строка',seed);
    const count=doc.createElement('input');count.type='number';count.min='1';count.max='2048';count.value=String(Math.min(2048,api.snapshot().count||512));count.setAttribute('aria-label','Число строк генератора');field('Строк',count);
    const compact=doc.createElement('input');compact.type='checkbox';compact.checked=true;compact.setAttribute('aria-label','Сжатые строки правила 90 как в Хабе');field('Сжатые 90: 1, 11, 101…',compact);
    function syncCompact(){const initial=presets.value==='initial';for(const input of [rule,seed,count])input.disabled=initial;compact.disabled=initial||Number(rule.value)!==90||seed.value!=='1';if(compact.disabled)compact.checked=false;}
    presets.addEventListener('change',()=>{if(presets.value!=='custom'&&presets.value!=='initial')rule.value=presets.value;syncCompact();});rule.addEventListener('input',()=>{presets.value=['30','60','90','102','150'].includes(rule.value)?rule.value:'custom';syncCompact();});seed.addEventListener('input',syncCompact);
    const insert=button('↓ Вставить',()=>{const rows=presets.value==='initial'?api.initialRows:elementary({rule:rule.value,seed:seed.value,count:count.value,compact:compact.checked});if(!rows.length)throw Error('Исходная начальная последовательность недоступна.');editor.value=rows.join('\n');dirty=true;notice.textContent='В редактор вставлено '+rows.length+' строк'+(presets.value==='initial'?' начальной последовательности':' правила '+Number(rule.value))+'. Нажмите «Применить».';});insert.setAttribute('aria-label','Вставить сгенерированные строки в редактор');insert.dataset.sequenceGenerate='';generator.append(insert);
    const summary=doc.createElement('output');summary.className='mtp-sequence-summary';summary.setAttribute('aria-live','polite');const list=doc.createElement('div');list.className='mtp-sequence-rows';const table=doc.createElement('table'),head=doc.createElement('thead'),headRow=doc.createElement('tr'),body=doc.createElement('tbody');table.setAttribute('aria-label','Строки и первые находки Поиска');
    for(const [text,full] of [['№','Номер последовательности'],['Послед-ть','Последовательность'],['Кадр','Первый кадр находки'],['Начало','Начало змейки: строка и бит'],['Конец','Конец змейки: строка и бит'],['Поиск','Способ поиска']]){const cell=doc.createElement('th');cell.scope='col';cell.textContent=text;cell.title=full;cell.setAttribute('aria-label',full);headRow.append(cell);}head.append(headRow);table.append(head,body);list.append(table);let nodes=[],listKey='',scrolledSelection=0;
    table.classList.add('mtp-resizable-sequences');const columns=Columns&&api.columns?Columns.mount(table,COLUMN_KEYS,api.columns,{onError:error=>notice.textContent=error.message}):null;
    pane.append(label,commands,generator,notice,summary,list);
    function refresh(){
      if(pane.closest('[hidden]'))return;const state=api.snapshot(),m=state.matches||{},simple=m.pattern&&m.pattern!=='initial',shown=simple&&m.active?(m.found||[]).map(hit=>hit.text||''):state.rows;
      if(rendered!==state.revision){if(!dirty)editor.value=state.rows.join('\n');rendered=state.revision;if(state.error)notice.textContent=state.error;}
      const key=simple&&m.active?'runs:'+shown.join('|'):'sequence:'+state.revision;if(key!==listKey){listKey=key;nodes=shown.map((text,i)=>{const row=doc.createElement('tr');row.dataset.sequenceRow=String(i);for(const kind of COLUMN_KEYS){const cell=doc.createElement('td');cell.dataset.column=kind;if(kind==='sequence'){const code=doc.createElement('code');code.textContent=text;code.title=text;cell.append(code);}else cell.textContent=kind==='number'?String(i+1):'—';row.append(cell);}return row;});body.replaceChildren(...nodes);}
      const modeLabel=directionLabel(m.mode);
      const found=new Map();for(const hit of m.found||[]){if(!found.has(hit.i))found.set(hit.i,[]);found.get(hit.i).push(hit);}
      const foundEver=Number.isInteger(m.foundEver)?m.foundEver:found.size;
      const foundIndices=new Set(Array.isArray(m.foundIndices)?m.foundIndices:(m.found||[]).map(hit=>hit.i));
      const previous=new Map((state.foundHistory||[]).map(entry=>[entry.i,entry]));
      const first=new Map();for(const hit of state.firstFinds||[]){if(!first.has(hit.i))first.set(hit.i,[]);first.get(hit.i).push(hit);}
      nodes.forEach((node,i)=>{const current=m.enabled&&m.active?(simple?((m.found||[])[i]?[(m.found||[])[i]]:[]):found.get(i)||[]):[],prior=m.enabled&&!simple?previous.get(i):null,hits=current.length?current:prior?.hits||[],past=!current.length&&!!prior;
        const context=past?prior:m,title=hits.map(hit=>(past?'Ранее найдено · кадр '+(hit.frame??prior.frame)+': ':'Найдено на поле: ')+(context.halves===2?(hit.p?'правый':'левый')+' полумаятник · ':'')+(context.joined?'строка ромба ':'строка ')+(hit.r+1)+' · '+methodLabel(hit)).join('\n');
        const earliest=simple?current.map(hit=>({...hit,frame:m.frame,halves:m.halves})):first.get(i)||[];
        const prefix=hit=>hit.halves===2?(hit.p?'Правый: ':'Левый: '):'';
        node.querySelector('[data-column=frame]').textContent=earliest.map(hit=>prefix(hit)+(Number.isFinite(hit.frame)?hit.frame:'не записан')).join('\n')||'—';
        node.querySelector('[data-column=method]').textContent=earliest.map(hit=>prefix(hit)+methodLabel(hit)).join('\n')||'—';
        for(const key of ['frame','method']){const cell=node.querySelector('[data-column='+key+']');if(cell){cell.title=cell.textContent;cell.setAttribute?.('aria-label',cell.title);}}
        const endCell=node.querySelector('[data-column=end]');if(endCell){endCell.textContent=earliest.map(hit=>prefix(hit)+startLabel(hit.end).text).join('\n')||'—';endCell.title=earliest.map(hit=>prefix(hit)+startLabel(hit.end).title).join('\n')||'Конечный бит не записан';}
        const startCell=node.querySelector('[data-column=start]');if(startCell){startCell.textContent=earliest.map(hit=>prefix(hit)+startLabel(hit.start).text).join('\n')||'—';startCell.title=earliest.map(hit=>prefix(hit)+startLabel(hit.start).title).join('\n')||'Начальный бит не записан';startCell.setAttribute?.('aria-label',startCell.title);}
        if(node.dataset.found!==String(hits.length>0)){node.classList.toggle('is-found',hits.length>0);node.dataset.found=String(hits.length>0);}if(node.title!==title)node.title=title;
        const manual=!simple&&state.manualMatch?.i===i?state.manualMatch:null;node.classList.toggle('is-manual-found',!!manual?.found);node.classList.toggle('is-manual-partial',!!manual&&!manual.found&&manual.complete&&manual.matched>0);const code=node.querySelector('[data-column=sequence] code');if(code?.ownerDocument){const description=paintManualWord(code,shown[i],manual);if(description)node.title=(title?title+'\n':'')+description;}
      });
      const selection=state.snakeSelection?{...state.snakeSelection,rowIndices:[state.snakeSelection.i]}:state.selection,selected=new Set(simple?selection?.matchIndices:selection?.rowIndices);nodes.forEach((node,i)=>{const on=selected.has(i);node.classList.toggle('is-selected',on);if(node.getAttribute('aria-selected')!==String(on))node.setAttribute('aria-selected',String(on));});
      if(selection&&selection.token!==scrolledSelection){const first=nodes.find((node,i)=>selected.has(i));if(first){const top=first.offsetTop-list.offsetTop,bottom=top+first.offsetHeight;if(top<list.scrollTop)list.scrollTop=top;else if(bottom>list.scrollTop+list.clientHeight)list.scrollTop=Math.max(0,bottom-list.clientHeight);scrolledSelection=selection.token;}}
      if(!m.enabled)summary.textContent='';
      else if(!m.active)summary.textContent='Кадр '+m.frame+': '+(m.reason||'ожидание поиска');
      else if(simple)summary.textContent='Серии '+({ones:'111…',zeros:'000…',alternating:'1010…'}[m.pattern]||'')+': '+m.count+(m.count>shown.length?' · показаны первые '+shown.length:'')+' · кадр '+m.frame+' · '+modeLabel;
      else {
        summary.textContent=m.complete===false?String(m.reason||'Поиск не завершён'):'';
      }
    }
    const unsubscribe=api.subscribe(refresh);refresh();const catalog=Catalog?.mount(pane,api);return {refresh,save:()=>save.click(),destroy(){catalog?.destroy();columns?.destroy();unsubscribe();}};
  }
  return {KEY,COLUMN_KEYS,startLabel,parse,sierpinski,elementary,create,mount};
});
