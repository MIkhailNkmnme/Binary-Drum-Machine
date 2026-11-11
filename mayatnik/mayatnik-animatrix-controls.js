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
    command('copy-rows','Копии XOR','Взять текущее поле одной решётки. Отражать верхний треугольник через новую строку-ось на каждом кадре и накладывать XOR всех её пар.',a=>a?.startCopyRows?.(),s=>s.on&&s.algorithm==='copyRows'&&!s.copyRowsWrap&&!s.copyRowsExcel);
    command('copy-rows-wrap','Край XOR','Отражать верхний треугольник. Строки за нижним краем переносить наверх с сохранением чётности и накладывать XOR.',a=>a?.startCopyRows?.({wrap:true}),s=>s.on&&s.copyRowsWrap);
    command('copy-rows-excel','Зеркалиус','Версия из Excel: новая строка-ось за кадр; результат NAND симметричных битов записывается в верхнюю строку. Цифра 1 синяя жирная, 0 светло-серая обычная.',a=>a?.startCopyRows?.({excel:true}),s=>s.on&&s.copyRowsExcel);
    const excelPart=(value,caption,title)=>({label:caption,title,selected:s=>s.on&&s.algorithm===value,action:a=>a?.startExcel?.(value)});
    segments('excel-rows','Строки из Excel',[
      excelPart('excelBounce','Отскок','Xoroorius: копия первой строки проходит вторую через XOR, отражаясь от краёв. Синий — ход вперёд, красный — обратный.'),
      excelPart('excelChain','ИнтерXOR','InterXoroorius: соседние строки накладываются XOR при чётной разности длин и переплетаются при нечётной. Последняя строка замыкается с первой.'),
      excelPart('excelChainDown','Цепь XOR','InterXoroorius: в XOR-ветке накладываются все строки сверху до цели, в ветке переплетения только соседняя пара.')
    ]);
    const interxorActive = s => s.on && (s.algorithm === 'excelChain' || s.algorithm === 'excelChainDown');
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
      patternRow.style.display = found.style.display = visible ? '' : 'none';
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
    segments('excel-cones','Треугсжатия из Excel',[
      excelPart('excelTriangleDown','Конус ↓','От вершины вниз. Цель XOR два диагональных родителя. Повторное наложение чередует цвет цифры с чёрным.'),
      excelPart('excelTriangleUp','Конус ↑','От вершины вверх, родители из строки ниже.'),
      excelPart('excelTriangleBoth','Ромб','Конусы вверх и вниз. Следующая вершина на один столбец правее.')
    ]);
    segments('excel-motion','Качание и столкновение из Excel',[
      excelPart('excelTrianglePend','Качание','Конусы из вершин 0, −1, +1, −2, +2 и далее. Один ромб за кадр.'),
      excelPart('excelCollision','Столкн.','Один проход XOR с поворотом на 180°. Выделение задаёт прямоугольник. Без выделения пары из двух пустых клеток остаются пустыми.')
    ]);
    const coneActive=s=>s.on&&s.algorithm?.startsWith('excelTriangle');
    const coneColours=segments('excel-cone-colours','Раскраска конусов',[
      {label:'Смена',title:'Перекрашивать только клетки, где изменился бит. Неизменившиеся цифры сохраняют цвет.',selected:s=>s.excelColourChangesOnly!==false,action:pick('excelColourChangesOnly',true)},
      {label:'Excel',title:'Перекрашивать все посещённые клетки по правилу макроса Excel.',selected:s=>s.excelColourChangesOnly===false,action:pick('excelColourChangesOnly',false)}
    ],s=>!coneActive(s));
    const depthRow=doc.createElement('label');depthRow.className='gz-hx';depthRow.dataset.n='animatrix:excel-depth';
    describe(depthRow,'Глубина конуса Excel в строках, включая вершину. Для ромба глубина применяется в каждом направлении.');
    label(depthRow,'Глубина');const depth=doc.createElement('input');depth.type='number';depth.min='1';depth.max='4096';depth.step='1';depth.style.width='52px';depth.setAttribute('aria-label','Глубина конуса Excel');
    depth.addEventListener('change',()=>{const n=Math.max(1,Math.min(4096,Math.round(Number(depth.value)||128)));depth.value=String(n);run(a=>a?.set?.({excelDepth:n}));});
    depthRow.append(depth);bindings.push({node:depth,selected:()=>false,unavailable:s=>!s.on||!s.algorithm?.startsWith('excelTriangle')});append(depthRow);
    command('pendulum','Маятник','Вернуться к обычному Маятнику: выключить Аниматрицу',a=>a?.set?.({on:false}),s=>!s.on);
    segments('timing','Порядок расчёта Аниматрицы',[
      {label:'Матрица',title:'Пересчитывать матрицу',selected:s=>s.timing!=='rows',unavailable:s=>s.algorithm==='copyRows',action:pick('timing','matrix')},
      {label:'Строки',title:'Аниматрица по строкам сверху вниз, без добавления вершин',selected:s=>s.timing==='rows',action:pick('timing','rows')}
    ],s=>!!s.excelMode);
    for(const [id,parts]of [['vertical',[['down','Вниз'],['up','Вверх']]],['horizontal',[['left','Влево'],['right','Вправо']]]])
      segments('direction:'+id,'Направление расчёта',parts.map(([value,caption])=>({label:caption,title:'Направление: '+caption.toLowerCase(),selected:s=>s.timing==='rows'?value==='down':s.direction===value,action:pick('direction',value)})),s=>s.timing==='rows'||s.excelMode);
    segments('colours','Цвета Аниматрицы',[
      {label:'Исходные',title:'Наследовать исходные цвета',selected:s=>!s.colours||s.colours==='inherit',action:pick('colours','inherit')},
      {label:'Биты',title:'Цвета битов 0 и 1',selected:s=>s.colours==='bits',action:pick('colours','bits')}
    ],s=>!!s.copyRowsExcel||!!s.excelMode);
    segments('capture','Взять исходник Аниматрицы',[
      {label:'Всё поле',title:'Взять текущее поле как исходник',action:a=>a?.capture?.({scope:'field'})},
      {label:'Выделение',title:'Взять выделенную область для режима «Матрица»',unavailable:s=>s.timing==='rows',action:a=>a?.capture?.({scope:'selection'})}
    ]);
    segments('seed','Начальный рисунок',[
      {label:'1',title:'Исходник из одной верхней единицы. Для отражений и режимов Excel строится весь треугольник.',action:a=>a?.seed?.('one')},
      {label:'Пример',title:'Исходник: учебный пример',action:a=>a?.seed?.('example')}
    ]);
    const collisionActive=s=>s.on&&s.algorithm==='excelCollision';
    const cycleMode=segments('cycle-mode','Повторение циклов Аниматрицы',[
      {label:'Число',title:'Выполнить заданное число циклов от 1 до 64',selected:s=>!s.cycleMode||s.cycleMode==='finite',action:pick('cycleMode','finite')},
      {label:'∞',title:'Повторять Аниматрицу без ограничения циклов',selected:s=>s.cycleMode==='infinite',action:pick('cycleMode','infinite')},
      {label:'Повтор',title:'Рассчитать точное начало и период повторения состояния, затем остановиться',selected:s=>s.cycleMode==='repeat',action:pick('cycleMode','repeat')}
    ],collisionActive);
    const cycles=doc.createElement('label');cycles.className='gz-hx';cycles.dataset.n='animatrix:cycles';describe(cycles,'Количество циклов Аниматрицы: от 1 до 64. Для бесконечного повтора выберите ∞; для вычисления начала и периода — «Повтор».');
    label(cycles,'Циклы');const input=doc.createElement('input');input.type='number';input.min='1';input.max='64';input.step='1';input.style.width='44px';input.style.minWidth='0';input.setAttribute('aria-label','Количество циклов Аниматрицы');
    input.addEventListener('change',()=>{const n=Math.max(1,Math.min(64,Math.round(Number(input.value)||1)));input.value=String(n);run(a=>a?.set?.({cycles:n}));});
    cycles.append(input);bindings.push({node:input,selected:()=>false,unavailable:s=>collisionActive(s)||!!s.cycleMode&&s.cycleMode!=='finite'});append(cycles);
    command('reset','Сброс исходн.','Вернуться к исходному рисунку Аниматрицы',a=>a?.reset?.());
    const info=doc.createElement('output');info.className='gz-hx';info.dataset.n='animatrix:status';info.setAttribute('aria-live','polite');const infoLabel=label(info,'0 / 0');append(info);
    function sync(){
      if(destroyed)return;const s=state(),busy=pending||!!s.busy,available=!!service();
      for(const binding of bindings){const on=!!binding.selected(s);binding.node.disabled=!available||busy||binding.unavailable(s);binding.node.classList.toggle('gz-on',on);binding.node.classList.toggle('on',on);if(binding.node.tagName==='BUTTON')binding.node.setAttribute('aria-pressed',String(on));}
      if(doc.activeElement!==input)input.value=String(Math.max(1,Math.min(64,Math.round(Number(s.cycles)||1))));
      if(doc.activeElement!==depth)depth.value=String(s.excelDepth??128);
      depthRow.style.display=coneColours.style.display=coneActive(s)?'':'none';
      cycles.style.display=cycleMode.style.display=collisionActive(s)?'none':'';
      syncInterxor(s);
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
