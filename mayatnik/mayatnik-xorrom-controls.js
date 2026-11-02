/* Xorrom: compact, gesture-started music controls for the shared menu. */
(function(root,factory){
  const value=factory();
  if(typeof module==='object'&&module.exports)module.exports=value;
  else root.MayatnikXorromControls=value;
})(globalThis,function(){
  'use strict';
  const DEFAULTS={source:'rgb',bpm:96,division:8,tonic:0,scale:'major',octave:4,timbre:'triangle',gain:.25,chord:3,first:0,last:-1,stride:1,loop:true,live:false};
  function mount(host,{api,helpUrl='instruction/index.html#xorrom',download,after=()=>{}}={}){
    if(!host||!api)throw new Error('Xorrom: нужны контейнер и музыкальный API');
    const doc=host.ownerDocument,win=doc.defaultView,nodes=[],bindings=[];
    let destroyed=false,pending=false,exporting=false,error='',notice='',unsubscribe;
    const settings=()=>({...DEFAULTS,...api.getSettings()});
    const state=()=>api.getState()||{state:'stopped'};
    const shorten=text=>win?.HubButtonText?.shortCaption?.(text)||text;
    const describe=(node,title)=>{node.title=title;node.setAttribute('aria-label',title);};
    const append=node=>{node.classList.add('may-xorrom-control');if(node.dataset.xorrom)node.dataset.n='xorrom-'+node.dataset.xorrom;nodes.push(node);host.append(node);return node;};
    const caption=(node,text)=>{node.textContent=shorten(text);};
    function safe(action){
      if(destroyed)return;
      error='';notice='';
      try{action();}catch(reason){error=reason?.message||String(reason);}
      sync();after();
    }
    async function run(action,kind){
      if(destroyed||(kind==='export'?exporting:pending))return;
      if(kind==='export')exporting=true;else pending=true;
      error='';notice='';sync();
      try{await action();}catch(reason){if(reason?.name==='AbortError')notice='Чтение отменено';else error=reason?.message||String(reason);}
      finally{if(kind==='export')exporting=false;else pending=false;if(!destroyed){sync();after();}}
    }
    function button(key,text,title,action){
      const b=doc.createElement('button');b.type='button';b.className='gz-hx';b.dataset.xorrom=key;
      const label=doc.createElement('span');label.className='gz-nm';caption(label,text);b.append(label);describe(b,title);
      b.addEventListener('click',event=>{event.stopPropagation();action();});append(b);return {node:b,label};
    }
    const start=button('start','▶ Старт','Начать музыку. Звук включается только после нажатия. Повторное нажатие ставит воспроизведение на паузу.',()=>run(()=>state().state==='playing'?api.pause():api.start()));
    const stop=button('stop','■ Стоп','Остановить музыку или отменить чтение поля и вернуться к первой выбранной строке.',()=>safe(()=>{api.stop();notice='Остановлено';}));
    function field(key,text,title,build){
      const row=doc.createElement('label');row.className='gz-hx gz-pair gz-split';row.dataset.xorrom=key;
      const label=doc.createElement('span');label.className='gz-half gz-h0';caption(label,text);
      const divider=doc.createElement('span');divider.className='gz-pm';divider.setAttribute('aria-hidden','true');
      const input=build();input.classList.add('gz-half','gz-h1');describe(input,title);row.title=title;
      input.addEventListener('click',e=>e.stopPropagation());input.addEventListener('keydown',e=>e.stopPropagation());
      row.append(label,divider,input);append(row);return input;
    }
    function choice(key,text,title,values){
      const input=field(key,text,title,()=>{const select=doc.createElement('select');
        for(const [value,label]of values){const option=doc.createElement('option');option.value=String(value);caption(option,label);select.append(option);}return select;});
      input.addEventListener('change',()=>safe(()=>api.setSettings({[key]:typeof values[0][0]==='number'?+input.value:input.value})));
      bindings.push(s=>{input.value=String(s[key]);input.disabled=key==='chord'&&s.source!=='rgb';});return input;
    }
    function number(key,text,title,min,max,toView=v=>v,fromView=v=>v){
      const input=field(key,text,title,()=>{const n=doc.createElement('input');n.type='number';n.min=String(min);n.max=String(max);n.step='1';return n;});
      const apply=()=>{const value=Number(input.value),normalized=Number.isFinite(value)?Math.max(min,Math.min(max,Math.round(value))):toView(settings()[key]);input.value=String(normalized);safe(()=>api.setSettings({[key]:fromView(normalized)}));};
      input.addEventListener('change',apply);input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();apply();}});
      bindings.push(s=>{if(doc.activeElement!==input)input.value=String(toView(s[key]));});return input;
    }
    choice('source','Источник','Что озвучивать: Мелодия — число единиц в строке задаёт высоту нот; RGB — цвета становятся нотами; Ритм — клетки задают удары.',[['melody','Мелодия'],['rgb','RGB'],['rhythm','Ритм']]);
    number('bpm','Темп BPM','Темп от 60 до 180 ударов в минуту. Больше число — музыка быстрее.',60,180);
    choice('division','Доля','Длительность шага: четверть, восьмая или шестнадцатая. При том же темпе шестнадцатые идут чаще.',[[4,'1/4'],[8,'1/8'],[16,'1/16']]);
    choice('scale','Лад','Лад определяет набор высот: мажор, минор или пентатоника из пяти ступеней.',[['major','Мажор'],['minor','Минор'],['pentatonic','Пента']]);
    choice('tonic','Тоника','Главная нота выбранного лада. До = C, Ре = D, Ми = E, Фа = F, Соль = G, Ля = A, Си = B.',[[0,'До C'],[1,'До♯ C♯'],[2,'Ре D'],[3,'Ре♯ D♯'],[4,'Ми E'],[5,'Фа F'],[6,'Фа♯ F♯'],[7,'Соль G'],[8,'Соль♯ G♯'],[9,'Ля A'],[10,'Ля♯ A♯'],[11,'Си B']]);
    choice('octave','Октава','Регистр: 3 — ниже, 4 — средний, 5 — выше. Это высота звука, а не скорость.',[[3,'3'],[4,'4'],[5,'5']]);
    choice('timbre','Тембр','Окраска звука: синус — плавный; треугольник — мягкий; щипок — короткий; мягкий квадрат — насыщенный.',[['sine','Синус'],['triangle','Треуг'],['pluck','Щипок'],['softsquare','Мягк кв']]);
    number('gain','Громк %','Громкость от 0 до 100 процентов. Начальное значение — 25 процентов; 0 отключает звук.',0,100,v=>Math.round(v*100),v=>v/100);
    choice('chord','Аккорд','Максимум одновременных нот от 1 до 4. Применяется только к источнику RGB.',[[1,'1'],[2,'2'],[3,'3'],[4,'4']]);
    const toggles=[];
    for(const [key,text,title]of [['loop','Повтор','После последней строки начать снова.'],['live','Обновлять','Снимать новое текущее поле на следующем повторе. Захват приостанавливает плеер поля; Xorrom играет строки снимка и сам кадры не переключает.']]){
      const control=button(key,text,title,()=>safe(()=>api.setSettings({[key]:!settings()[key]})));toggles.push({key,...control,text});
    }
    number('first','От строки','Первая строка для музыки; отсчёт начинается с 0.',0,1000000);
    number('last','До строки','Последняя строка включительно. Значение −1 означает до конца поля.',-1,1000000);
    number('stride','Шаг строк','Брать каждую строку или пропускать: от 1 до 32. Больший шаг сокращает фразу.',1,32);
    const wav=button('wav','↓ WAV','Сохранить один проход выбранной музыки в WAV без запуска воспроизведения. Максимум 60 секунд; длинный проход обрезается.',()=>run(async()=>{
      const result=await api.exportWav();if(destroyed)return;
      if(!result?.blob)throw new Error('Не удалось создать WAV');
      if(download){await download(result.blob,result.name||'xorrom.wav');notice=result.note||'WAV сохранён';return;}
      const url=win.URL.createObjectURL(result.blob),anchor=doc.createElement('a');anchor.href=url;anchor.download=result.name||'xorrom.wav';anchor.hidden=true;host.append(anchor);anchor.click();anchor.remove();win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);notice=result.note||'WAV сохранён';
    },'export'));
    const help=doc.createElement('a');help.className='gz-hx';help.href=helpUrl;help.target='_blank';help.rel='noopener';help.dataset.xorrom='help';caption(help,'? Новичку');describe(help,'Открыть инструкцию Xorrom: как рисунок превращается в ноты, ритм и музыку.');append(help);
    const status=doc.createElement('div');status.className='gz-hx may-xorrom-status';status.dataset.xorrom='status';
    const transportStatus=doc.createElement('span');transportStatus.setAttribute('role','status');transportStatus.setAttribute('aria-live','polite');
    const rowStatus=doc.createElement('span');rowStatus.setAttribute('aria-live','off');rowStatus.dataset.xorrom='row';status.append(transportStatus,rowStatus);append(status);
    const notes=doc.createElement('div');notes.className='gz-hx may-xorrom-notes';notes.dataset.xorrom='notes';describe(notes,'Фактически прозвучавшие ноты последнего шага. Пауза означает отсутствие нот.');append(notes);
    const legend=doc.createElement('div');legend.className='gz-hx may-xorrom-legend';legend.dataset.xorrom='legend';
    legend.title='Условное назначение цветов ступеням выбранного лада, а не физический закон: 1 синий — До; 2 зелёный — Ре; 3 голубой — Ми; 4 красный — Фа; 5 пурпурный — Соль; 6 жёлтый — Ля; 7 белый — Си. Чёрный — пауза. В других ладах и тональностях ступени звучат иначе.';
    legend.setAttribute('aria-label',legend.title);
    for(const [code,color,note]of [[1,'#00f','До'],[2,'#0f0','Ре'],[3,'#0ff','Ми'],[4,'#f00','Фа'],[5,'#f0f','Соль'],[6,'#ff0','Ля'],[7,'#fff','Си']]){const chip=doc.createElement('span');chip.style.setProperty('--note-color',color);chip.textContent=code+' '+note;legend.append(chip);}append(legend);
    function sync(){
      if(destroyed)return;
      const s=settings(),current=state(),playing=current.state==='playing';
      bindings.forEach(bind=>bind(s));
      caption(start.label,pending?'…':playing?'Ⅱ Пауза':current.state==='paused'?'▶ Дальше':'▶ Старт');start.node.disabled=pending;start.node.classList.toggle('gz-on',playing);start.node.setAttribute('aria-pressed',String(playing));describe(start.node,playing?'Приостановить музыку. Повторное нажатие продолжит с того же места.':current.state==='paused'?'Продолжить музыку с места паузы без нового снимка поля.':'Снять текущее поле и начать музыку. Захват приостанавливает плеер поля; Xorrom играет строки снимка и сам кадры не переключает. Звук включается только после нажатия.');
      stop.node.disabled=false;
      toggles.forEach(t=>{caption(t.label,t.text+': '+(s[t.key]?'вкл':'выкл'));t.node.classList.toggle('gz-on',!!s[t.key]);t.node.setAttribute('aria-pressed',String(!!s[t.key]));});
      wav.node.disabled=exporting;caption(wav.label,exporting?'… WAV':'↓ WAV');wav.node.setAttribute('aria-busy',String(exporting));
      const visibleError=error||current.error;
      const message=visibleError?'Ошибка: '+visibleError:exporting?'Создание WAV…':notice||(pending?'Подготовка…':playing?'Играет':current.state==='paused'?'Пауза':'Остановлено');
      const row=(playing||current.state==='paused')&&Number.isInteger(current.index)&&current.index>=0?' · Строка '+current.index:'';
      if(transportStatus.textContent!==message)transportStatus.textContent=message;
      if(rowStatus.textContent!==row)rowStatus.textContent=row;
      status.title=message+row;
      const played=Array.isArray(current.notes)?current.notes:[];
      const noteName=note=>{if(typeof note!=='object')return String(note);if(note.drum)return {kick:'Бочка',snare:'Малый',hat:'Хэт'}[note.drum]||note.drum;if(note.name||note.note)return note.name||note.note;const midi=Number(note.midi);return Number.isFinite(midi)?['До','До♯','Ре','Ре♯','Ми','Фа','Фа♯','Соль','Соль♯','Ля','Ля♯','Си'][((midi%12)+12)%12]+(Math.floor(midi/12)-1):'♪';};
      const text=played.length?played.map(noteName).join(' · '):'— пауза';
      if(notes.textContent!==text)notes.textContent=text;describe(notes,'Прозвучало: '+text);
    }
    sync();if(typeof api.subscribe==='function')unsubscribe=api.subscribe(sync);
    return {sync,destroy(){if(destroyed)return;destroyed=true;unsubscribe?.();nodes.forEach(node=>node.remove());}};
  }
  return Object.freeze({mount});
});
