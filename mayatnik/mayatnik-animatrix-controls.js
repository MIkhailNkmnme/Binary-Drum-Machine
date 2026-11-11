/* Compact controls for the shared Animatrix source and transport. */
(function(root){
  'use strict';
  function mount({host,api,after=()=>{}}){
    if(!host)throw Error('Нет контейнера Аниматрицы');
    const doc=host.ownerDocument,win=doc.defaultView||root,nodes=[],bindings=[];
    const group=host.closest('.pt-g');
    const popup=doc.createElement('div');popup.className='may-animatrix-popup';
    popup.hidden=true;popup.mayAnimatrixOwner=group;doc.body.append(popup);
    const sections=new Map(),storageKey='mayatnik-animatrix-section-v1';
    let pending=false,error='',destroyed=false,container=host,openSection=null,previousFamily=null,revision=0;
    let preferredSection;
    try{preferredSection=win.localStorage.getItem(storageKey);}catch(_){}
    const basic=s=>s.algorithm!=='copyRows'&&!s.algorithm?.startsWith('excel');
    const coneActive=s=>s.on&&s.algorithm?.startsWith('excelTriangle');
    const interxorActive=s=>s.on&&(s.algorithm==='excelChain'||s.algorithm==='excelChainDown');
    const collisionActive=s=>s.on&&s.algorithm==='excelCollision';
    const family=s=>basic(s)?'cells':s.algorithm==='copyRows'?'reflections':
      s.algorithm==='excelBounce'||s.algorithm==='excelChain'||s.algorithm==='excelChainDown'?'excel-rows':'excel-shapes';
    const directionActive=s=>s.on&&basic(s)&&s.timing==='matrix'&&!['zero','background'].includes(s.algorithm);
    const selectionSupported=s=>s.algorithm?.startsWith('excel')||basic(s)&&s.timing==='matrix';
    const service=()=>typeof api==='function'?api():api;
    const state=()=>service()?.get?.()||{};
    const describe=(node,title)=>{node.title=title;node.setAttribute('aria-label',title);};
    const append=node=>{nodes.push(node);container.append(node);return node;};
    const label=(node,value)=>{const span=doc.createElement('span');span.className='gz-nm';span.textContent=value;node.append(span);return span;};
    function place(){
      const section=sections.get(openSection),head=section?.head;
      const visible=!!(head?.getClientRects().length&&group?.classList.contains('pt-open'));
      for(const {head:owner,body} of sections.values()){
        if((!visible||owner!==head)&&body.parentNode===popup)owner.after(body);
      }
      if(!visible){popup.hidden=true;return;}
      if(section.body.parentNode!==popup)popup.append(section.body);
      popup.hidden=false;
      const viewport=win.visualViewport;
      const left=(viewport?.offsetLeft||0)+4,top=(viewport?.offsetTop||0)+4;
      const right=left+(viewport?.width||win.innerWidth)-8,bottom=top+(viewport?.height||win.innerHeight)-8;
      const owner=head.getBoundingClientRect(),width=popup.offsetWidth,gap=6;
      const onRight=owner.right+gap+width<=right||(owner.left-gap-width<left&&right-owner.right>=owner.left-left);
      popup.style.maxHeight=Math.max(24,bottom-top)+'px';
      const height=popup.offsetHeight;
      popup.style.left=Math.max(left,Math.min(onRight?owner.right+gap:owner.left-gap-width,right-width))+'px';
      popup.style.top=Math.max(top,Math.min(owner.top,bottom-height))+'px';
      head.dataset.listSide=onRight?'right':'left';
    }
    function showSection(id){
      openSection=id;
      for(const [key,{head,body}] of sections){
        const open=key===id;
        head.setAttribute('aria-expanded',String(open));
        body.inert=!open;
        body.classList.toggle('may-animatrix-section-open',open);
      }
      place();
    }
    function section(id,caption){
      container=host;
      const head=doc.createElement('button');head.type='button';head.className='gz-hx may-animatrix-section';
      head.dataset.n='animatrix:section:'+id;head.dataset.noMini='';
      label(head,caption).dataset.userLabel='';
      const body=doc.createElement('div');body.className='may-animatrix-section-body';
      body.id='may-animatrix-'+id;body.dataset.animatrixSection=id;
      head.setAttribute('aria-controls',body.id);head.setAttribute('aria-haspopup','true');describe(head,caption+' Аниматрицы');
      const arrow=doc.createElement('span');arrow.className='may-animatrix-chevron';arrow.setAttribute('aria-hidden','true');head.append(arrow);
      head.addEventListener('click',()=>{
        revision++;preferredSection=openSection===id?'':id;
        try{win.localStorage.setItem(storageKey,preferredSection);}catch(_){}
        showSection(preferredSection||null);after();
      });
      append(head);append(body);sections.set(id,{head,body});container=body;
    }
    async function run(action){
      if(pending||state().busy||destroyed)return;
      pending=true;error='';sync();
      try{await action(service());}
      catch(reason){error=reason?.message||String(reason);}
      finally{pending=false;if(!destroyed){sync();after();}}
    }
    function command(id,caption,title,action,selected=null,unavailable=()=>false){
      const b=doc.createElement('button');b.type='button';b.className='gz-hx';b.dataset.n='animatrix:'+id;
      label(b,caption).dataset.userLabel='';describe(b,title);b.addEventListener('click',()=>run(action));
      bindings.push({node:b,selected,unavailable});append(b);return b;
    }
    function segments(id,title,parts,unavailable=()=>false){
      const row=doc.createElement('div');row.className='gz-hx gz-pair gz-split'+(parts.length===3?' gz-split3':'');row.dataset.n='animatrix:'+id;
      row.setAttribute('role','group');describe(row,title);
      parts.forEach((part,index)=>{const b=doc.createElement('button');b.type='button';b.className='gz-half gz-h'+index;
        b.textContent=part.label;describe(b,part.title);b.addEventListener('click',()=>run(part.action));row.append(b);
        if(index===0){const divider=doc.createElement('span');divider.className='gz-pm';divider.setAttribute('aria-hidden','true');row.append(divider);}
        bindings.push({node:b,selected:part.selected,unavailable:s=>unavailable(s)||!!part.unavailable?.(s)});
      });append(row);return row;
    }
    const pick=(key,value)=>a=>{if(state()[key]!==value)return a?.set?.({[key]:value});};
    const enable=command('enabled','Включить','Включить или выключить Аниматрицу',a=>a?.set?.({on:!state().on}));
    const info=doc.createElement('output');
    info.className='may-animatrix-status';info.dataset.n='animatrix:status';
    const infoLabel=label(info,'Выключена');infoLabel.dataset.userLabel='';
    append(info);
    section('cells','Клетки');
    const algorithms=[
      ['two','2 ед','Два соседа'],['three','3 ед','Три соседа'],
      ['shift','ПравЛев','Сдвиг право-лево'],['horr','Хорррус','Хоррориус'],
      ['zero','00','Нулевой вариант'],['background','Фон','Фоновый вариант']
    ];
    for(let i=0;i<algorithms.length;i+=2)segments('algorithm:'+i,'Алгоритм Аниматрицы',algorithms.slice(i,i+2).map(([value,caption,title])=>({label:caption,title,selected:s=>s.on&&s.algorithm===value,action:a=>a?.set?.({on:true,algorithm:value})})));
    const timing=segments('timing','Порядок расчёта Аниматрицы',[
      {label:'Матрица',title:'Пересчитывать матрицу',selected:s=>s.timing==='matrix',action:pick('timing','matrix')},
      {label:'Строки',title:'Пересчитывать строки сверху вниз',selected:s=>s.timing==='rows',action:pick('timing','rows')}
    ],s=>!s.on||!basic(s));
    const directions=[['vertical',[['down','Вниз'],['up','Вверх']]],['horizontal',[['left','Влево'],['right','Вправо']]]].map(([id,parts])=>
      segments('direction:'+id,'Направление расчёта',parts.map(([value,caption])=>({label:caption,title:'Направление: '+caption.toLowerCase(),selected:s=>s.direction===value,action:pick('direction',value)})),s=>!directionActive(s)));
    section('reflections','Отражения');
    command('copy-rows','Копии XOR','Взять текущее поле одной решётки. Отражать верхний треугольник через новую строку-ось на каждом кадре и накладывать XOR всех её пар.',a=>a?.startCopyRows?.(),s=>s.on&&s.algorithm==='copyRows'&&!s.copyRowsWrap&&!s.copyRowsExcel);
    command('copy-rows-wrap','Край XOR','Отражать верхний треугольник. Строки за нижним краем переносить наверх с сохранением чётности и накладывать XOR.',a=>a?.startCopyRows?.({wrap:true}),s=>s.on&&s.copyRowsWrap);
    command('copy-rows-excel','Зеркалиус','Версия из Excel: новая строка-ось за кадр; результат NAND симметричных битов записывается в верхнюю строку. Цифра 1 синяя жирная, 0 светло-серая обычная.',a=>a?.startCopyRows?.({excel:true}),s=>s.on&&s.copyRowsExcel);
    section('excel-rows','Строки Excel');
    const excelPart=(value,caption,title)=>({label:caption,title,selected:s=>s.on&&s.algorithm===value,action:a=>a?.startExcel?.(value)});
    command('excel-bounce','Отскок','Xoroorius: копия первой строки проходит вторую через XOR, отражаясь от краёв. Синий показывает ход вперёд, красный — обратный.',a=>a?.startExcel?.('excelBounce'),s=>s.on&&s.algorithm==='excelBounce');
    segments('excel-rows','Цепочки строк Excel',[
      excelPart('excelChain','ИнтерXOR','InterXoroorius: соседние строки накладываются XOR при чётной разности длин и переплетаются при нечётной. Последняя строка замыкается с первой.'),
      excelPart('excelChainDown','Цепь XOR','InterXoroorius: в XOR-ветке накладываются все строки сверху до цели, в ветке переплетения только соседняя пара.')
    ]);
    const patternHelp = 'Введите двоичные шаблоны от двух бит через пробел или запятую и нажмите Enter. Поиск идёт по кольцу из активной пары и полностью серых использованных строк. Первый бит шаблона может отличаться. Каждый шаблон ищется один раз за прогон. На поле видна последняя находка. Красный — прямое совпадение, фиолетовый — инверсия, зелёный — реверс.';
    const patternRow = doc.createElement('label');
    patternRow.className = 'gz-hx';
    patternRow.dataset.n = 'animatrix:interxor-patterns';
    describe(patternRow, patternHelp);
    label(patternRow, 'Шаблоны').dataset.userLabel = '';
    const patterns = doc.createElement('input');
    patterns.type = 'text';
    patterns.autocomplete = 'off';
    patterns.spellcheck = false;
    patterns.enterKeyHint = 'done';
    patterns.placeholder = '01, 101';
    Object.assign(patterns.style, { flex: '1', width: '0', minWidth: '0', height: '18px', boxSizing: 'border-box', padding: '0 2px' });
    describe(patterns, patternHelp);
    patternRow.append(patterns);
    bindings.push({ node: patterns, selected: () => false, unavailable: s => !interxorActive(s) });
    append(patternRow);

    const found = doc.createElement('output');
    found.className = 'gz-hx';
    found.dataset.n = 'animatrix:interxor-found';
    found.setAttribute('aria-live', 'polite');
    const foundLabel = label(found, 'Найдено 0 / 0');
    foundLabel.dataset.userLabel = '';
    append(found);

    let patternError = '', foundTitle = '';
    patterns.addEventListener('input', () => {
      if (!patternError) return;
      patternError = '';
      sync();
    });
    patterns.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.isComposing) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        patternError = '';
        patterns.value = state().interxorPatterns ?? '';
        sync();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const draft = patterns.value;
        run(async a => {
          try {
            await a?.set?.({ interxorPatterns: draft });
            patternError = '';
            patterns.value = state().interxorPatterns ?? '';
          } catch (reason) {
            patternError = reason?.message || String(reason);
            patterns.value = draft;
          }
        });
      }
    });
    function syncInterxor(s) {
      const visible = interxorActive(s);
      patternRow.hidden=found.hidden=!visible;
      if (!visible) patternError = '';
      const canonical = s.interxorPatterns ?? '';
      if (!patternError && doc.activeElement !== patterns) patterns.value = canonical;
      patterns.setAttribute('aria-invalid', String(!!patternError));
      const count = canonical ? canonical.split(' ').length : 0;
      const { direct = 0, inverse = 0, reverse = 0, total = 0 } = s.interxorFound || {};
      const text = patternError ? 'Исправьте ввод' : 'Найдено ' + total + ' / ' + count;
      if (foundLabel.textContent !== text) foundLabel.textContent = text;
      const title = patternError || text + '. Прямых ' + direct + ', инверсий ' + inverse + ', реверсов ' + reverse + '.';
      if (foundTitle !== title) {
        foundTitle = title;
        describe(found, title);
      }
    }
    section('excel-shapes','Фигуры Excel');
    segments('excel-cones','Направление конуса Excel',[
      excelPart('excelTriangleDown','Конус ↓','От вершины вниз. Цель XOR два диагональных родителя.'),
      excelPart('excelTriangleUp','Конус ↑','От вершины вверх, родители из строки ниже.')
    ]);
    segments('excel-motion','Ромб и качание из Excel',[
      excelPart('excelTriangleBoth','Ромб','Конусы вверх и вниз. Следующая вершина на один столбец правее.'),
      excelPart('excelTrianglePend','Качание','Конусы из вершин 0, −1, +1, −2, +2 и далее. Один ромб за кадр.')
    ]);
    command('excel-collision','Столкновение','Один проход XOR с поворотом на 180°. Выделение задаёт прямоугольник.',a=>a?.startExcel?.('excelCollision'),collisionActive);
    const coneColours=segments('excel-cone-colours','Раскраска конусов',[
      {label:'Смена',title:'Перекрашивать только клетки, где изменился бит. Фон неизменившихся клеток сохраняет цвет.',selected:s=>s.excelColourChangesOnly!==false,action:pick('excelColourChangesOnly',true)},
      {label:'Excel',title:'Перекрашивать все посещённые клетки по правилу макроса Excel.',selected:s=>s.excelColourChangesOnly===false,action:pick('excelColourChangesOnly',false)}
    ],s=>!coneActive(s));
    const depthRow=doc.createElement('label');depthRow.className='gz-hx';depthRow.dataset.n='animatrix:excel-depth';
    describe(depthRow,'Глубина конуса Excel в строках, включая вершину. Для ромба глубина применяется в каждом направлении.');
    label(depthRow,'Глубина');const depth=doc.createElement('input');depth.type='number';depth.min='1';depth.max='4096';depth.step='1';depth.style.width='52px';depth.setAttribute('aria-label','Глубина конуса Excel');
    depth.addEventListener('change',()=>{const n=Math.max(1,Math.min(4096,Math.round(Number(depth.value)||128)));depth.value=String(n);run(a=>a?.set?.({excelDepth:n}));});
    depthRow.append(depth);bindings.push({node:depth,selected:()=>false,unavailable:s=>!s.on||!s.algorithm?.startsWith('excelTriangle')});append(depthRow);
    section('source','Исходник');
    const sourceInfo=doc.createElement('output');sourceInfo.className='may-animatrix-status';append(sourceInfo);
    segments('capture','Взять исходник Аниматрицы',[
      {label:'Весь кадр',title:'Взять все строки и столбцы текущего кадра как исходник. У конуса глубина равна высоте поля.',action:a=>a?.capture?.({scope:'field'})},
      {label:'Область',title:'Взять выделенный прямоугольник. Сначала выделите область в меню «Ячейки». В построчном расчёте и отражениях используется всё поле.',unavailable:s=>!selectionSupported(s)||!s.hasSelection,action:a=>a?.capture?.({scope:'selection'})}
    ]);
    segments('seed','Начальный рисунок',[
      {label:'С нуля',title:'Начать текущее построение с чистого исходника',action:a=>a?.seed?.('one')},
      {label:'Пример',title:'Открыть учебный исходник для текущего построения',action:a=>a?.seed?.('example')}
    ]);
    command('reset','Кадр 0','Вернуться к исходному рисунку Аниматрицы',a=>a?.reset?.(),null,s=>!s.on||s.frame===0);
    section('colours','Цвета');
    segments('colours','Цвета Аниматрицы',[
      {label:'Исходные',title:'Наследовать цвета исходника',selected:s=>s.colours==='inherit',action:pick('colours','inherit')},
      {label:'Биты',title:'Использовать цвета битов 0 и 1',selected:s=>s.colours==='bits',action:pick('colours','bits')}
    ],s=>!s.on||s.copyRowsExcel||s.excelMode);
    section('cycles','Циклы');
    segments('cycle-mode','Повторение циклов Аниматрицы',[
      {label:'Число',title:'Выполнить заданное число циклов от 1 до 64',selected:s=>!s.cycleMode||s.cycleMode==='finite',action:pick('cycleMode','finite')},
      {label:'∞',title:'Повторять Аниматрицу без ограничения циклов',selected:s=>s.cycleMode==='infinite',action:pick('cycleMode','infinite')},
      {label:'Повтор',title:'Рассчитать точное начало и период повторения состояния, затем остановиться',selected:s=>s.cycleMode==='repeat',action:pick('cycleMode','repeat')}
    ],collisionActive);
    const cycles=doc.createElement('label');cycles.className='gz-hx';cycles.dataset.n='animatrix:cycles';describe(cycles,'Количество циклов Аниматрицы: от 1 до 64. Для бесконечного повтора выберите ∞; для вычисления начала и периода — «Повтор».');
    label(cycles,'Циклы');const input=doc.createElement('input');input.type='number';input.min='1';input.max='64';input.step='1';input.style.width='44px';input.style.minWidth='0';input.setAttribute('aria-label','Количество циклов Аниматрицы');
    input.addEventListener('change',()=>{const n=Math.max(1,Math.min(64,Math.round(Number(input.value)||1)));input.value=String(n);run(a=>a?.set?.({cycles:n}));});
    cycles.append(input);bindings.push({node:input,selected:()=>false,unavailable:s=>collisionActive(s)||!!s.cycleMode&&s.cycleMode!=='finite'});append(cycles);
    const names=Object.fromEntries(algorithms.map(([value,,title])=>[value,title]));
    Object.assign(names,{excelBounce:'Отскок',excelChain:'ИнтерXOR',excelChainDown:'Цепь XOR',
      excelTriangleDown:'Конус вниз',excelTriangleUp:'Конус вверх',excelTriangleBoth:'Ромб',
      excelTrianglePend:'Качание',excelCollision:'Столкновение'});
    function sync(){
      if(destroyed)return;const s=state(),busy=pending||!!s.busy,available=!!service();
      for(const {node,selected,unavailable} of bindings){
        const disabled=!available||busy||unavailable(s),on=!disabled&&!!selected?.(s);
        if(node.disabled!==disabled)node.disabled=disabled;
        node.classList.toggle('gz-on',on);node.classList.toggle('on',on);
        if(selected&&node.getAttribute('aria-pressed')!==String(on))node.setAttribute('aria-pressed',String(on));
      }
      const activeFamily=family(s),coloursAvailable=s.on&&!s.copyRowsExcel&&!s.excelMode;
      sections.get('colours').head.hidden=!coloursAvailable;
      sections.get('cycles').head.hidden=!s.on||collisionActive(s);
      if(previousFamily===null){
        const initial=sections.get(preferredSection);
        showSection(preferredSection===''?null:initial&&!initial.head.hidden?preferredSection:activeFamily);
      }else if((openSection&&sections.get(openSection).head.hidden)||(previousFamily!==activeFamily&&openSection===previousFamily)){
        showSection(activeFamily);
      }
      previousFamily=activeFamily;
      for(const [id,{head}] of sections)head.classList.toggle('gz-on',s.on&&id===activeFamily);
      if(doc.activeElement!==input)input.value=String(Math.max(1,Math.min(64,Math.round(Number(s.cycles)||1))));
      if(doc.activeElement!==depth)depth.value=String(s.excelDepth??128);
      depthRow.hidden=coneColours.hidden=!coneActive(s);
      timing.hidden=!s.on||!basic(s);
      for(const row of directions)row.hidden=!directionActive(s);
      cycles.hidden=s.cycleMode!=='finite'||collisionActive(s);
      syncInterxor(s);
      const enableText=s.on?'Выключить':'Включить';
      if(enable.firstElementChild.textContent!==enableText)enable.firstElementChild.textContent=enableText;
      enable.classList.toggle('gz-on',!!s.on);
      enable.setAttribute('aria-pressed',String(!!s.on));
      const repeat=s.repeat;
      const mode=s.algorithm==='copyRows'?(s.copyRowsExcel?'Зеркалиус':s.copyRowsWrap?'Край XOR':'Копии XOR'):names[s.algorithm];
      const count=repeat?.complete?'С '+repeat.firstCycle+' · T '+repeat.periodCycles:(s.frame??0)+' / '+(s.cycleMode==='infinite'||s.cycleMode==='repeat'?'∞':s.total??0);
      const status=error||(s.on?mode+' · '+count:'Выключена');
      if(infoLabel.textContent!==status)infoLabel.textContent=status;
      const inputKind=({clean:'С нуля',frame:'Весь кадр',selection:'Выделенная область',example:'Учебный пример'})[s.sourceKind]||(s.on?'Сохранённый исходник':'С нуля');
      if(sourceInfo.textContent!==inputKind)sourceInfo.textContent=inputKind;
      const repetition=repeat?.complete?'Повтор состояния: начало с цикла '+repeat.firstCycle+', период '+repeat.periodCycles+' циклов; первое совпадение на цикле '+repeat.repeatCycle+'. Состояние сравнивается полностью, включая цвета и выделение.':s.cycleMode==='infinite'||s.cycleMode==='repeat'?'Поиск точного повтора: '+(repeat?.periodCycles?'период '+repeat.periodCycles+' найден, вычисляется начало.':'начало и период ещё не найдены.'):' ';
      describe(info,error||repetition+' Кадр '+(s.frame??0)+(s.cycle!=null?' · цикл '+s.cycle:'')+(s.cursor!=null?' · строка '+s.cursor:'')+(s.message?' · '+s.message:''));
      host.setAttribute('aria-busy',String(busy));
    }
    const changes=['may-animatrix-change','may-compare-change','may-reset-complete','may-cell-selection-change'];
    for(const name of changes)win.addEventListener(name,sync);
    const layout=new win.MutationObserver(place);if(group)layout.observe(group,{attributes:true,attributeFilter:['class','style']});
    const sizes=new win.ResizeObserver(place);sizes.observe(host);sizes.observe(popup);
    win.addEventListener('resize',place);doc.addEventListener('scroll',place,true);
    win.visualViewport?.addEventListener('resize',place);win.visualViewport?.addEventListener('scroll',place);
    popup.addEventListener('pointerenter',()=>clearTimeout(group?._leave));
    popup.addEventListener('pointerleave',()=>group?._popupLeave?.());
    const keys=event=>{
      if(event.key!=='Escape'||popup.hidden||!popup.contains(event.target)&&!host.contains(event.target))return;
      const search=win.mayButtonSearch?.getState();
      if(search?.open||search?.current)return;
      event.preventDefault();event.stopImmediatePropagation();
      const head=sections.get(openSection)?.head;
      head?.click();head?.focus({preventScroll:true});
    };
    doc.addEventListener('keydown',keys,true);sync();
    return {sync,popup,place,
      contains(owner,target){return owner===group&&!popup.hidden&&(target?popup.contains(target):popup.matches(':hover'));},
      reveal(control){
        const body=control?.closest('[data-animatrix-section]');
        if(!body||sections.get(body.dataset.animatrixSection)?.body!==body)return null;
        const previous=openSection,stamp=revision;
        showSection(body.dataset.animatrixSection);
        return ()=>{if(stamp===revision)showSection(previous);};
      },
      destroy(){
        destroyed=true;layout.disconnect();sizes.disconnect();
        for(const name of changes)win.removeEventListener(name,sync);
        win.removeEventListener('resize',place);doc.removeEventListener('scroll',place,true);
        win.visualViewport?.removeEventListener('resize',place);win.visualViewport?.removeEventListener('scroll',place);
        doc.removeEventListener('keydown',keys,true);
        for(const node of nodes)node.remove();popup.remove();host.removeAttribute('aria-busy');
      }
    };
  }
  root.MayatnikAnimatrixControls={mount};
})(globalThis);
