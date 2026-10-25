/* Editable binary rows shared by Очки and the live/detached library. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikSequences=api;})(globalThis,function(){
  'use strict';
  const KEY='mayatnik-sequences-v1',MAX_BITS=2100000,MAX_ROWS=4096;
  function parse(text){const value=String(text).replace(/\r\n?/g,'\n').trim();if(!value)return[];const rows=value.split('\n');if(rows.length>MAX_ROWS)throw Error('Не более '+MAX_ROWS+' строк. Данные не изменены.');let bits=0;rows.forEach((row,i)=>{if(!/^[01]+$/.test(row))throw Error('Строка '+(i+1)+': допустимы только 0 и 1, без пробелов.');bits+=row.length;});if(bits>MAX_BITS)throw Error('Больше '+MAX_BITS+' бит. Данные не изменены.');return rows;}
  function sierpinski(count){count=Number(count);if(!Number.isInteger(count)||count<1||count>2048)throw Error('Для Серпинского задайте от 1 до 2048 строк.');const rows=['1'];for(let i=1;i<count;i++){const prev=rows[i-1];let next='';for(let j=0;j<=i;j++)next+=Number(prev[j-1]||0)^Number(prev[j]||0);rows.push(next);}return rows;}
  function create(storage,{rows:count=512}={}){
    let state=null,error='',revision=0,matches={enabled:false,active:false,found:[]},matchKey='',listeners=new Set();
    try{const raw=storage?.getItem(KEY);if(raw!==null&&raw!==undefined){const saved=JSON.parse(raw);if(saved?.version!==1||!Array.isArray(saved.rows)||saved.rows.some(row=>typeof row!=='string'))throw Error('format');state={rows:parse(saved.rows.join('\n')),source:saved.source==='serp'?'serp':'user',count:saved.count||saved.rows.length};}}catch(_){state={rows:[],source:'user',count:0};error='Сохранённая последовательность повреждена. Исходная запись сохранена; исправьте строки и нажмите «Применить».';}
    const emit=kind=>{for(const listener of listeners)listener(kind);};
    const write=(rows,source,count)=>{const next={version:1,rows,source,count};try{storage?.setItem(KEY,JSON.stringify(next));}catch(_){throw Error('Не удалось сохранить последовательность в браузере. Освободите место и повторите.');}state=next;error='';revision++;emit('sequence');};
    const api={get rows(){return state.rows;},get revision(){return revision;},snapshot:()=>({rows:state.rows,source:state.source,count:state.count,revision,error,matches}),subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},setText(text){const rows=parse(text);write(rows,'user',rows.length);},generate(count){const rows=sierpinski(count);write(rows,'serp',rows.length);},setMatches(value){const key=JSON.stringify(value);if(key===matchKey)return;matchKey=key;matches=value;emit('matches');}};
    if(!state){const n=Math.max(1,Math.min(512,Math.floor(Number(count)||512)));state={rows:sierpinski(n),source:'serp',count:n};try{storage?.setItem(KEY,JSON.stringify({version:1,...state}));}catch(_){error='Начальные строки созданы, но браузер не смог их сохранить.';}}
    return api;
  }
  function mount(pane,api){
    const doc=pane.ownerDocument;pane.classList.add('mtp-sequences');pane.dataset.noMini='';
    const intro=doc.createElement('p');intro.textContent='Своя последовательность для режима «Начальная» в Очках. Одна строка — один ряд из 0 и 1. Серпинский 90: сжатые строки, как в Хабе (1, 11, 101…).';
    const label=doc.createElement('label');label.textContent='Своя последовательность';const editor=doc.createElement('textarea');editor.id='maySequenceEditor';editor.setAttribute('aria-label','Строки своей последовательности');editor.spellcheck=false;editor.wrap='off';label.append(editor);
    const commands=doc.createElement('div');commands.className='mtp-sequence-actions';
    const notice=doc.createElement('output');notice.className='mtp-sequence-notice';notice.setAttribute('role','status');let dirty=false,rendered=-1;
    const button=(text,run)=>{const b=doc.createElement('button');b.type='button';b.className='mtp-command';b.textContent=text;b.addEventListener('click',()=>{try{run();}catch(e){notice.textContent=e.message;}});commands.append(b);return b;};
    const save=button('Применить',()=>{api.setText(editor.value);dirty=false;rendered=-1;notice.textContent='Сохранено. Очки используют эти строки.';refresh();});save.dataset.sequenceSave='';
    editor.addEventListener('input',()=>{dirty=true;notice.textContent='Есть изменения — нажмите «Применить». Они ещё не участвуют в поиске.';});
    const append=doc.createElement('input');append.type='text';append.inputMode='numeric';append.placeholder='Новая строка: 01…';append.setAttribute('aria-label','Добавить строку последовательности');commands.append(append);
    button('＋ Строка',()=>{if(!append.value.trim())throw Error('Введите новую строку из 0 и 1.');parse(append.value);editor.value+=(editor.value.trim()?'\n':'')+append.value.trim();append.value='';dirty=true;notice.textContent='Строка добавлена в редактор — нажмите «Применить».';});
    const count=doc.createElement('input');count.type='number';count.min='1';count.max='2048';count.value=String(api.snapshot().count||512);count.setAttribute('aria-label','Число строк Серпинского');commands.append(count);
    button('Серпинский 90',()=>{api.generate(Number(count.value));dirty=false;rendered=-1;notice.textContent='Созданы и сохранены '+count.value+' сжатых строк Серпинского 90.';refresh();});
    const summary=doc.createElement('output');summary.className='mtp-sequence-summary';summary.setAttribute('aria-live','polite');const list=doc.createElement('ol');list.className='mtp-sequence-rows';list.setAttribute('aria-label','Строки и совпадения Очков');let nodes=[],listKey='';
    pane.append(intro,label,commands,notice,summary,list);
    function refresh(){
      if(pane.closest('[hidden]'))return;const state=api.snapshot(),m=state.matches||{},simple=m.pattern&&m.pattern!=='initial',shown=simple&&m.active?(m.found||[]).map(hit=>hit.text||''):state.rows;
      if(rendered!==state.revision){if(!dirty)editor.value=state.rows.join('\n');rendered=state.revision;if(state.error)notice.textContent=state.error;}
      const key=simple&&m.active?'runs:'+shown.join('|'):'sequence:'+state.revision;if(key!==listKey){listKey=key;nodes=shown.map((text,i)=>{const li=doc.createElement('li'),code=doc.createElement('code');li.dataset.sequenceRow=String(i);code.textContent=text;li.append(code);return li;});list.replaceChildren(...nodes);}
      const found=new Map((m.found||[]).map(hit=>[hit.i,hit]));nodes.forEach((node,i)=>{const hit=m.enabled&&m.active&&(simple?(m.found||[])[i]:found.get(i)),title=hit?'Найдено на поле: строка '+(hit.r+1)+(hit.vn?' · '+hit.vn:''):'';if(node.dataset.found!==String(!!hit)){node.classList.toggle('is-found',!!hit);node.dataset.found=String(!!hit);}if(node.title!==title)node.title=title;});
      summary.textContent=!m.enabled?'Очки выключены.':!m.active?'Кадр '+m.frame+': '+(m.reason||'ожидание поиска'):(simple?'Серии '+({ones:'111…',zeros:'000…',alternating:'1010…'}[m.pattern]||'')+': '+m.count+(m.count>shown.length?' · показаны первые '+shown.length:''):'Найдено '+found.size+' из '+state.rows.length+' строк')+' · кадр '+m.frame+' · '+(m.mode==='row'?'по рядам':'по диагоналям');
    }
    const unsubscribe=api.subscribe(refresh);refresh();return {refresh,save:()=>save.click(),destroy:unsubscribe};
  }
  return {KEY,parse,sierpinski,create,mount};
});
