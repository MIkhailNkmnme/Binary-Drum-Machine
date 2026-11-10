/* Compact controls for the shared Animatrix source and transport. */
(function(root){
  'use strict';
  function mount({host,api,after=()=>{}}){
    if(!host)throw Error('Нет контейнера Аниматрицы');
    const doc=host.ownerDocument,win=doc.defaultView||root,nodes=[],bindings=[];
    let pending=false,error='',destroyed=false;
    const service=()=>typeof api==='function'?api():api;
    const state=()=>service()?.get?.()||{};
    const describe=(node,title)=>{node.title=title;node.setAttribute('aria-label',title);};
    const append=node=>{nodes.push(node);host.append(node);return node;};
    const label=(node,value)=>{const span=doc.createElement('span');span.className='gz-nm';span.textContent=value;node.append(span);return span;};
    async function run(action){
      if(pending||state().busy||destroyed)return;
      pending=true;error='';sync();
      try{await action(service());}
      catch(reason){error=reason?.message||String(reason);}
      finally{pending=false;if(!destroyed){sync();after();}}
    }
    function command(id,caption,title,action,selected=()=>false,unavailable=()=>false){
      const b=doc.createElement('button');b.type='button';b.className='gz-hx';b.dataset.n='animatrix:'+id;
      label(b,caption);describe(b,title);b.addEventListener('click',()=>run(action));
      bindings.push({node:b,selected,unavailable});append(b);return b;
    }
    function segments(id,title,parts,unavailable=()=>false){
      const row=doc.createElement('div');row.className='gz-hx gz-pair gz-split'+(parts.length===3?' gz-split3':'');row.dataset.n='animatrix:'+id;
      row.setAttribute('role','group');describe(row,title);
      parts.forEach((part,index)=>{const b=doc.createElement('button');b.type='button';b.className='gz-half gz-h'+index;
        b.textContent=part.label;describe(b,part.title);b.addEventListener('click',()=>run(part.action));row.append(b);
        if(index===0){const divider=doc.createElement('span');divider.className='gz-pm';divider.setAttribute('aria-hidden','true');row.append(divider);}
        bindings.push({node:b,selected:part.selected||(()=>false),unavailable:s=>unavailable(s)||!!part.unavailable?.(s)});
      });append(row);return row;
    }
    const pick=(key,value)=>a=>a?.set?.({[key]:value});
    command('enabled','Включить','Включить или выключить источник Аниматрицы',a=>a?.set?.({on:!state().on}),s=>!!s.on);
    const algorithms=[
      ['two','2 ед','Два соседа'],['three','3 ед','Три соседа'],
      ['shift','ПравЛев','Сдвиг право-лево'],['horr','Хорррус','Хоррориус'],
      ['zero','00','Нулевой вариант'],['background','Фон','Фоновый вариант']
    ];
    for(let i=0;i<algorithms.length;i+=2)segments('algorithm:'+i,'Алгоритм Аниматрицы',algorithms.slice(i,i+2).map(([value,caption,title])=>({label:caption,title,selected:s=>s.algorithm===value,action:pick('algorithm',value)})));
    command('copy-rows','Копии XOR','Взять текущее поле одной решётки. Накладывать строки XOR пачками, нечётные на нечётные и чётные на чётные.',a=>a?.startCopyRows?.(),s=>s.on&&s.algorithm==='copyRows');
    command('pendulum','Маятник','Вернуться к обычному Маятнику: выключить Аниматрицу',a=>a?.set?.({on:false}),s=>!s.on);
    segments('timing','Порядок расчёта Аниматрицы',[
      {label:'Матрица',title:'Пересчитывать матрицу',selected:s=>s.timing!=='rows',unavailable:s=>s.algorithm==='copyRows',action:pick('timing','matrix')},
      {label:'Строки',title:'Аниматрица по строкам сверху вниз, без добавления вершин',selected:s=>s.timing==='rows',action:pick('timing','rows')}
    ]);
    for(const [id,parts]of [['vertical',[['down','Вниз'],['up','Вверх']]],['horizontal',[['left','Влево'],['right','Вправо']]]])
      segments('direction:'+id,'Направление расчёта',parts.map(([value,caption])=>({label:caption,title:'Направление: '+caption.toLowerCase(),selected:s=>s.timing==='rows'?value==='down':s.direction===value,action:pick('direction',value)})),s=>s.timing==='rows');
    segments('colours','Цвета Аниматрицы',[
      {label:'Исходные',title:'Наследовать исходные цвета',selected:s=>!s.colours||s.colours==='inherit',action:pick('colours','inherit')},
      {label:'Биты',title:'Цвета битов 0 и 1',selected:s=>s.colours==='bits',action:pick('colours','bits')}
    ]);
    segments('capture','Взять исходник Аниматрицы',[
      {label:'Всё поле',title:'Взять текущее поле как исходник',action:a=>a?.capture?.({scope:'field'})},
      {label:'Выделение',title:'Взять выделенную область для режима «Матрица»',unavailable:s=>s.timing==='rows',action:a=>a?.capture?.({scope:'selection'})}
    ]);
    segments('seed','Начальный рисунок',[
      {label:'1',title:'Исходник из одной верхней единицы. В «Копии XOR» строится весь треугольник.',action:a=>a?.seed?.('one')},
      {label:'Пример',title:'Исходник: учебный пример',action:a=>a?.seed?.('example')}
    ]);
    segments('cycle-mode','Повторение циклов Аниматрицы',[
      {label:'Число',title:'Выполнить заданное число циклов от 1 до 64',selected:s=>!s.cycleMode||s.cycleMode==='finite',action:pick('cycleMode','finite')},
      {label:'∞',title:'Повторять Аниматрицу без ограничения циклов',selected:s=>s.cycleMode==='infinite',action:pick('cycleMode','infinite')},
      {label:'Повтор',title:'Рассчитать точное начало и период повторения состояния, затем остановиться',selected:s=>s.cycleMode==='repeat',action:pick('cycleMode','repeat')}
    ]);
    const cycles=doc.createElement('label');cycles.className='gz-hx';cycles.dataset.n='animatrix:cycles';describe(cycles,'Количество циклов Аниматрицы: от 1 до 64. Для бесконечного повтора выберите ∞; для вычисления начала и периода — «Повтор».');
    label(cycles,'Циклы');const input=doc.createElement('input');input.type='number';input.min='1';input.max='64';input.step='1';input.style.width='44px';input.style.minWidth='0';input.setAttribute('aria-label','Количество циклов Аниматрицы');
    input.addEventListener('change',()=>{const n=Math.max(1,Math.min(64,Math.round(Number(input.value)||1)));input.value=String(n);run(a=>a?.set?.({cycles:n}));});
    cycles.append(input);bindings.push({node:input,selected:()=>false,unavailable:s=>!!s.cycleMode&&s.cycleMode!=='finite'});append(cycles);
    command('reset','Сброс исходн.','Вернуться к исходному рисунку Аниматрицы',a=>a?.reset?.());
    const info=doc.createElement('output');info.className='gz-hx';info.dataset.n='animatrix:status';info.setAttribute('aria-live','polite');const infoLabel=label(info,'0 / 0');append(info);
    function sync(){
      if(destroyed)return;const s=state(),busy=pending||!!s.busy,available=!!service();
      for(const binding of bindings){const on=!!binding.selected(s);binding.node.disabled=!available||busy||binding.unavailable(s);binding.node.classList.toggle('gz-on',on);binding.node.classList.toggle('on',on);if(binding.node.tagName==='BUTTON')binding.node.setAttribute('aria-pressed',String(on));}
      if(doc.activeElement!==input)input.value=String(Math.max(1,Math.min(64,Math.round(Number(s.cycles)||1))));
      const enable=nodes[0].querySelector('.gz-nm');enable.textContent=s.on?'Выключить':'Включить';
      const repeat=s.repeat;
      infoLabel.textContent=repeat?.complete?'С '+repeat.firstCycle+' · T '+repeat.periodCycles:(s.frame??0)+' / '+(s.cycleMode==='infinite'||s.cycleMode==='repeat'?'∞':s.total??0);
      const repetition=repeat?.complete?'Повтор состояния: начало с цикла '+repeat.firstCycle+', период '+repeat.periodCycles+' циклов; первое совпадение на цикле '+repeat.repeatCycle+'. Состояние сравнивается полностью, включая цвета и выделение.':s.cycleMode==='infinite'||s.cycleMode==='repeat'?'Поиск точного повтора: '+(repeat?.periodCycles?'период '+repeat.periodCycles+' найден, вычисляется начало.':'начало и период ещё не найдены.'):' ';
      describe(info,error||repetition+' Кадр '+(s.frame??0)+(s.cycle!=null?' · цикл '+s.cycle:'')+(s.cursor!=null?' · строка '+s.cursor:'')+(s.message?' · '+s.message:''));
      host.setAttribute('aria-busy',String(busy));
    }
    const changes=['may-animatrix-change','may-compare-change','may-reset-complete'];for(const name of changes)win.addEventListener(name,sync);sync();
    return {sync,destroy(){destroyed=true;for(const name of changes)win.removeEventListener(name,sync);for(const node of nodes)node.remove();host.removeAttribute('aria-busy');}};
  }
  root.MayatnikAnimatrixControls={mount};
})(globalThis);
