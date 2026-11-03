/* Xorrom: compact, gesture-started music controls for the shared menu. */
(function(root,factory){
  const value=factory(typeof module==='object'&&module.exports?require('../_js/control-frame.js'):root.ZerkControlFrame);
  if(typeof module==='object'&&module.exports)module.exports=value;
  else root.MayatnikXorromControls=value;
})(globalThis,function(Frame){
  'use strict';
  const DEFAULTS={source:'rgb',bpm:96,division:8,tonic:0,scale:'major',octave:4,timbre:'triangle',gain:.25,chord:3,first:0,last:-1,stride:1,loop:true,live:false,restartOnFrame:false,autoGeometry:false,geometrySource:'all',geometryConnectivity:'sides',backing:'off',backingGain:.3,backingTimbre:'sine',backingRows:4,envelopeOn:false,attack:.005,decay:.08,sustain:.7,release:.12,filterType:'off',cutoff:8000,resonance:.7,lfoTarget:'off',lfoRate:2,lfoDepth:0,delayTime:.25,delayFeedback:.25,delayMix:0,reverbMix:0,reverbTime:1,pan:0,arpMode:'off',arpGate:.8,swing:0};
  const AUTO_FIELDS={all:new Set(['division','scale','tonic','octave','timbre','gain','chord']),regions:new Set(['division','timbre']),areas:new Set(['tonic','gain','chord']),symmetry:new Set(['scale','octave'])};
  function mount(host,{api,helpUrl='instruction/index.html#xorrom',download,after=()=>{}}={}){
    if(!host||!api)throw new Error('Xorrom: нужны контейнер и музыкальный API');
    const doc=host.ownerDocument,win=doc.defaultView,nodes=[],bindings=[],steppers=[],controlFrame=win.ZerkControlFrame||Frame;
    let destroyed=false,pending=false,exporting=false,importing=false,importGeneration=0,activeReader=null,error='',notice='',unsubscribe;
    const settings=()=>({...DEFAULTS,...win.MayatnikXorrom?.DEFAULTS,...api.getSettings()});
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
      const row=doc.createElement('div');row.className='gz-hx gz-pair gz-split';row.dataset.xorrom=key;
      const label=doc.createElement('span');label.className='gz-half gz-h0';caption(label,text);
      const divider=doc.createElement('span');divider.className='gz-pm';divider.setAttribute('aria-hidden','true');
      const input=build();input.classList.add('gz-half','gz-h1');describe(input,title);row.title=title;
      input.addEventListener('click',e=>e.stopPropagation());input.addEventListener('keydown',e=>e.stopPropagation());
      row.append(label,divider,input);append(row);
      if((input.tagName==='SELECT'||input.type==='number')&&controlFrame){
        const middle=doc.createElement('span');middle.className='may-xorrom-value';middle.append(label,divider,input);
        const side=dir=>{const b=doc.createElement('button');b.type='button';b.className='may-xorrom-side';b.textContent=dir<0?'‹':'›';b.dataset.xorromStep=String(dir);describe(b,(dir<0?'Предыдущее / меньше: ':'Следующее / больше: ')+title);
          b.addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();});
          b.addEventListener('click',e=>{e.stopPropagation();if(input.disabled||b.disabled)return;
            if(input.tagName==='SELECT'){const available=Array.from(input.options).filter(o=>!o.disabled&&!o.hidden),at=available.indexOf(input.selectedOptions[0]),next=available[at+dir];if(next)input.value=next.value;else return;}
            else{const n=Number(input.value),step=input.step==='any'?1:Number(input.step)||1,min=input.min===''?-Infinity:Number(input.min),max=input.max===''?Infinity:Number(input.max);if(!Number.isFinite(n))return;let next=+(n+dir*step).toPrecision(12);next=Math.max(min,Math.min(max,next));if(key==='bpm'&&next<=0)return;input.value=String(next);}
            input.dispatchEvent(new win.Event('change',{bubbles:true}));sync();
          });return b;};
        const left=side(-1),right=side(1);row.replaceChildren(left,middle,right);controlFrame.attach(row,left,middle,right,{input});
        steppers.push(()=>{if(input.tagName==='SELECT'){const available=Array.from(input.options).filter(o=>!o.disabled&&!o.hidden),at=available.indexOf(input.selectedOptions[0]);left.disabled=input.disabled||at<=0;right.disabled=input.disabled||at<0||at>=available.length-1;}
          else {const n=Number(input.value),step=input.step==='any'?1:Number(input.step)||1;left.disabled=input.disabled||(input.min!==''?n<=Number(input.min):key==='bpm'&&n-step<=0);right.disabled=input.disabled||(input.max!==''&&n>=Number(input.max));}
          for(const b of [left,right]){b.title=(b===left?'Предыдущее / меньше: ':'Следующее / больше: ')+input.title;b.setAttribute('aria-label',b.title);}
        });
      }
      return input;
    }
    function bindField(input,key,title,toView=v=>v){
      const row=input.closest('.may-xorrom-control');
      const label=value=>input.tagName==='SELECT'?Array.from(input.options).find(option=>option.value===String(value))?.textContent||String(value):String(toView(value));
      bindings.push((s,current)=>{
        const automatic=!!s.autoGeometry&&(AUTO_FIELDS[s.geometrySource]||AUTO_FIELDS.all).has(key)&&current.effective?.[key]!=null;
        const value=automatic?current.effective[key]:s[key];
        if(doc.activeElement!==input)input.value=String(toView(value));
        input.disabled=automatic||(key==='chord'&&s.source!=='rgb')||(key==='timbre'&&s.source==='rhythm')||(key.startsWith('backing')&&key!=='backing'&&s.backing==='off');
        row.classList.toggle('may-xorrom-auto',automatic);
        row.classList.toggle('may-xorrom-modulated',automatic&&value!==s[key]);
        const hint=automatic?'По рисунку: '+label(value)+'; вручную: '+label(s[key])+'. Выключите «Авто рисунок», чтобы изменить ручное значение. '+title:key==='timbre'&&s.source==='rhythm'?'В источнике Ритм используются бочка, малый барабан и хэт. Для выбора тембра включите Мелодию или RGB. '+title:title;
        describe(input,hint);row.title=hint;
      });
    }
    function choice(key,text,title,values){
      const input=field(key,text,title,()=>{const select=doc.createElement('select');
        for(const [value,label,fullTitle]of values){const option=doc.createElement('option');option.value=String(value);caption(option,label);if(fullTitle)option.title=fullTitle;select.append(option);}return select;});
      input.addEventListener('change',()=>{if(!input.disabled)safe(()=>api.setSettings({[key]:typeof values[0][0]==='number'?+input.value:input.value}));});
      bindField(input,key,title);return input;
    }
    function number(key,text,title,min,max,toView=v=>v,fromView=v=>v,step=1){
      const positive=min===undefined;
      const input=field(key,text,title,()=>{const n=doc.createElement('input');n.type='number';if(positive)n.step='any';else{n.min=String(min);n.max=String(max);n.step=String(step);}return n;});
      const apply=()=>{if(input.disabled)return;const value=Number(input.value);let normalized=toView(settings()[key]);
        if(Number.isFinite(value)){if(!positive)normalized=Math.max(min,Math.min(max,step===1?Math.round(value):value));else if(value>0)normalized=value;}
        input.value=String(normalized);safe(()=>api.setSettings({[key]:fromView(normalized)}));};
      input.addEventListener('change',apply);input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();apply();}});
      bindField(input,key,title,toView);return input;
    }
    // The same controls move into Library → Music, including its detached window.
    // Keep the selector alive while beats update, so an open list keeps focus.
    if(api.getRack){
      const pick=field('track','Дорожка','Цвет и имя выбранной дорожки. Настройки ниже относятся к ней.',()=>doc.createElement('select'));
      pick.addEventListener('change',()=>safe(()=>api.select(Number(pick.value))));
      const name=field('trackName','Имя','Название выбранной дорожки',()=>{const el=doc.createElement('input');el.type='text';return el;});
      name.addEventListener('change',()=>safe(()=>api.rename(name.value)));
      button('trackAdd','＋ Дорожка','Добавить независимую дорожку с настройками выбранной, без запуска.',()=>safe(()=>api.add()));
      const remove=button('trackRemove','− Дорожка','Удалить выбранную дорожку. Должна остаться хотя бы одна.',()=>safe(()=>api.remove()));
      const play=button('trackPlay','▶ Дорожка','Пуск или пауза выбранной дорожки.',()=>run(()=>state().state==='playing'?api.pause():api.start()));
      button('trackStop','■ Дорожка','Остановить выбранную дорожку.',()=>safe(()=>api.stop()));
      const mute=button('trackMute','Без звука','Заглушить или вернуть звук выбранной дорожки. Линия продолжает читать поле.',()=>safe(()=>{const r=api.getRack();api.setMuted(!r.tracks.find(t=>t.id===r.selected).muted);}));
      button('tracksStart','▶ Все','Одновременно запустить все дорожки.',()=>run(()=>api.startAll()));
      button('tracksStop','■ Все','Остановить все дорожки.',()=>safe(()=>api.stopAll()));
      if(api.setAxis){
        let catalogue=[];
        if(api.addTemplates)button('tracksTemplates','＋ Шаблоны','Создать по дорожке для каждого выделенного шаблона. Весь шаблон звучит одним срезом из текущих битов под маской.',()=>safe(()=>{const ids=api.addTemplates();notice='Добавлено дорожек: '+ids.length;}));
        const take=field('trackAxis','Линия','Какую линию перемещать: строки, свою ось или видимый отрезок поля.',()=>doc.createElement('select'));
        const presets=[['row','Строки'],['h','Горизонталь'],['v','Вертикаль'],['d','Диагональ ↘'],['u','Диагональ ↗']];
        function choices(){take.replaceChildren(...[...presets,['current',api.getAxisName()||'Своя ось'],...catalogue.map((a,i)=>['a'+i,a.name])].map(([v,t])=>{const o=doc.createElement('option');o.value=v;o.textContent=t;return o;}));}
        choices();
        button('trackAxes','↻ Оси поля','Получить видимые оси поля и части между их пересечениями в список «Линия».',()=>safe(()=>{catalogue=api.getAxes();choices();notice='Осей и частей: '+catalogue.length;}));
        take.addEventListener('change',()=>safe(()=>{const key=take.value;if(key==='row'){api.setAxis(null);return;}if(key==='current')return;
          if(key.startsWith('a')){const a=catalogue[Number(key.slice(1))];if(a)api.setAxis(a.spec,a.name);return;}
          const size=api.getSize(),x=Math.max(0,size.width-1),y=Math.max(0,size.height-1),cx=Math.floor(x/2),cy=Math.floor(y/2),side=Math.min(x,y);
          const points={h:[0,cy,x,cy],v:[cx,0,cx,y],d:[0,0,side,side],u:[0,y,side,y-side]}[key];
          if(points){const [x1,y1,x2,y2]=points;api.setAxis({x1,y1,x2,y2},presets.find(p=>p[0]===key)[1]);}
        }));
        const inputs=[];
        for(const [a,label] of [['x1','Начало X'],['y1','Начало Y'],['x2','Конец X'],['y2','Конец Y']]){
          const input=field('trackAxis'+a,label,'Логическая координата центра клетки (от нуля). Можно задать отрезок любого направления.',()=>{const el=doc.createElement('input');el.type='number';el.step='any';return el;});
          input.addEventListener('change',()=>safe(()=>{const v=input.valueAsNumber,spec=api.getAxis();if(spec&&Number.isFinite(v))api.setAxis({...spec,[a]:v},'Свой отрезок');}));inputs.push([a,input]);
        }
        const fixed=button('trackAxisFixed','Фикс оси','Закрепить текущую позицию в клетках поля. При смене кадра звучат новые биты на том же отрезке.',()=>safe(()=>{const a=api.getAxis();if(a)api.fixAxis(!a.fixed);else {const t=api.getTemplate?.();if(t)api.fixTemplate(!t.fixed);}}));
        const reverse=button('trackAxisReverse','⇄ Ход','Сменить направление движения перпендикулярно оси. Повтор управляет возвратом к началу цикла.',()=>safe(()=>{const a=api.getAxis();if(a)api.setAxis({...a,reverse:!a.reverse},api.getAxisName());}));
        bindings.push(()=>{const a=api.getAxis(),t=api.getTemplate?.();take.value=a||t?'current':'row';const label=t?'Шаблон: '+t.name:api.getAxisName()||'Своя ось';if(take.options[5].textContent!==label)take.options[5].textContent=label;
          for(const [key,input] of inputs){input.disabled=!a;if(input.ownerDocument.activeElement!==input)input.value=a?String(a[key]):'';}
          for(const [control,on] of [[fixed,!!(a?.fixed||t?.fixed)],[reverse,!!a?.reverse]]){control.node.disabled=control===fixed?!a&&!t:!a;control.node.classList.toggle('gz-on',on);control.node.setAttribute('aria-pressed',String(on));}
        });
      }
      let signature='';
      bindings.push((s,current)=>{
        const rack=api.getTrackList?api.getTrackList():api.getRack(),all=rack.tracks,sel=all.find(t=>t.id===rack.selected);
        const key=JSON.stringify(all.map(t=>[t.id,t.name,t.color,t.muted]));if(signature!==key){
          signature=key;pick.replaceChildren(...all.map(t=>{const op=doc.createElement('option');op.value=String(t.id);op.textContent=(t.muted?'◌ ':'● ')+t.name;op.style.color=t.color;return op;}));}
        pick.style.color=sel.color;pick.value=String(sel.id);if(name.ownerDocument.activeElement!==name)name.value=sel.name;
        remove.node.disabled=all.length===1;mute.node.classList.toggle('gz-on',sel.muted);mute.node.setAttribute('aria-pressed',String(sel.muted));
        caption(play.label,current.state==='playing'?'Ⅱ Дорожка':'▶ Дорожка');play.node.disabled=pending||importing;
      });
    }
    choice('source','Источник','Что озвучивать: Мелодия — число единиц в строке задаёт высоту нот; RGB — цвета становятся нотами; Ритм — клетки задают удары.',[['melody','Мелодия'],['rgb','RGB'],['rhythm','Ритм']]);
    const electroPreset=win.MayatnikXorrom?.ELECTRO_PRESET||{source:'rgb',bpm:112,division:16,tonic:0,scale:'minor',octave:3,timbre:'pulse',gain:.25,chord:1,autoGeometry:false};
    const electro=button('electro','♫ Электро','Электронный набор: RGB, 112 BPM, 1/16, До минор, октава 3, Пульс, одна нота, громкость 25%. Авто рисунок выключается; диапазон строк и транспорт сохраняются. Нажмите Старт для игры.',()=>safe(()=>api.setSettings(electroPreset)));
    const auto=button('autoGeometry','Авто рисунок','Автоматически менять музыкальные настройки по рисунку. Поля показывают фактические значения звучащей строки; выключение возвращает ручные настройки. Громкость ограничена ручным значением.',()=>safe(()=>api.setSettings({autoGeometry:!settings().autoGeometry})));
    choice('geometrySource','От рисунка','Что управляет музыкой: всё вместе, связные области, площади областей или их вертикальная симметрия.',[['all','Всё'],['regions','Области'],['areas','Площади'],['symmetry','Симметрия']]);
    choice('geometryConnectivity','Связи','Как соединять биты рисунка: По сторонам; Стороны + углы; Только углы; Шахматки 0; Один бит. Правила соответствуют режимам Область в Краске.',[['sides','Стороны','По сторонам'],['corners','Углы','Стороны + углы'],['diagonal','Диаг…','Только углы'],['chess0','Шахм0','Шахматки 0'],['bit','Один бит','Один бит']]);
    number('bpm','Темп BPM','Удары в минуту. Можно ввести любое положительное значение, включая дробное.');
    choice('division','Доля','Длительность шага: четверть, восьмая или шестнадцатая. При том же темпе шестнадцатые идут чаще.',[[4,'1/4'],[8,'1/8'],[16,'1/16']]);
    choice('scale','Лад','Лад определяет набор высот: мажор, минор или пентатоника из пяти ступеней.',[['major','Мажор'],['minor','Минор'],['pentatonic','Пента']]);
    choice('tonic','Тоника','Главная нота выбранного лада. До = C, Ре = D, Ми = E, Фа = F, Соль = G, Ля = A, Си = B.',[[0,'До C'],[1,'До♯ C♯'],[2,'Ре D'],[3,'Ре♯ D♯'],[4,'Ми E'],[5,'Фа F'],[6,'Фа♯ F♯'],[7,'Соль G'],[8,'Соль♯ G♯'],[9,'Ля A'],[10,'Ля♯ A♯'],[11,'Си B']]);
    choice('octave','Октава','Регистр от 1 до 7: 3 — ниже, 4 — средний, 5 — выше. Авто рисунок может менять октаву на одну ступень. Это высота звука, а не скорость.',[[1,'1'],[2,'2'],[3,'3'],[4,'4'],[5,'5'],[6,'6'],[7,'7']]);
    choice('timbre','Тембр','Окраска звука: Синус, Треугольник, Щипок, Мягкий квадрат; Бас — затухающий фильтр, Пульс — короткая импульсная волна, Металл — звонкие частичные тоны, Робот — синтез гласных.',[['sine','Синус'],['triangle','Треуг'],['pluck','Щипок'],['softsquare','Мягк кв'],['bass','Бас'],['pulse','Пульс'],['metal','Металл'],['robot','Робот']]);
    number('gain','Громк %','Громкость от 0 до 100 процентов. Начальное значение — 25 процентов; 0 отключает звук.',0,100,v=>Math.round(v*100),v=>v/100);
    choice('chord','Аккорд','Максимум одновременных нот от 1 до 4. Применяется только к источнику RGB.',[[1,'1'],[2,'2'],[3,'3'],[4,'4']]);
    choice('backing','♫ Фон','Второй тихий инструмент одновременно с основной партией. Созвучие держит тонику и квинту, Бас — низкую ведущую ноту, Вторая — другую ноту рисунка. Полностью пустая фраза молчит.',[['off','Выкл'],['pad','Созвучие'],['bass','Бас'],['counter','Вторая']]);
    choice('backingTimbre','Волна фона','Форма волны второго инструмента: Синус — чистый мягкий тон; Треугольник — чуть ярче; Мягкий квадрат — насыщеннее. Волна меняет окраску, а не порядок нот.',[['sine','Синус'],['triangle','Треуг'],['softsquare','Мягк кв']]);
    number('backingGain','Фон %','Громкость второго инструмента относительно основной партии, 0–100%. Начните с 20–30%. Общая громкость ограничивает оба слоя; смешивание оставляет запас от перегрузки.',0,100,v=>Math.round(v*100),v=>v/100);
    number('backingRows','Фраза строк','Сколько выбранных строк держать одну фоновую фразу, от 1 до 16. Четыре дают медленный фон под четырьмя шагами мелодии; учитываются диапазон и шаг строк.',1,16);
    number('attack','Атака с','Время нарастания громкости огибающей, от 0 до 10 секунд.',0,10,v=>v,v=>v,.001);
    number('decay','Спад с','Время спада к уровню удержания, от 0 до 10 секунд.',0,10,v=>v,v=>v,.001);
    number('sustain','Удерж %','Громкость удержания огибающей, от 0 до 100 процентов.',0,100,v=>Math.round(v*100),v=>v/100);
    number('release','Хвост с','Время затухания после ноты, от 0 до 10 секунд.',0,10,v=>v,v=>v,.001);
    choice('filterType','Фильтр','Фильтр: выключен, низкие частоты, высокие частоты или полоса.',[['off','Выкл'],['lowpass','Низкие'],['highpass','Высокие'],['bandpass','Полоса']]);
    number('cutoff','Срез Гц','Частота среза фильтра, от 20 до 10000 Гц.',20,10000);
    number('resonance','Резонанс','Резонанс фильтра Q, от 0,1 до 20.',.1,20,v=>v,v=>v,.1);
    choice('lfoTarget','LFO куда','Медленная модуляция: выключена, высота, фильтр, громкость или панорама.',[['off','Выкл'],['pitch','Высота'],['filter','Фильтр'],['gain','Громк'],['pan','Пан']]);
    number('lfoRate','LFO Гц','Частота медленной модуляции, от 0,01 до 40 Гц.',.01,40,v=>v,v=>v,.01);
    number('lfoDepth','LFO %','Глубина модуляции, от 0 до 100 процентов.',0,100,v=>Math.round(v*100),v=>v/100);
    number('delayTime','Эхо с','Задержка эха, от 0 до 2 секунд.',0,2,v=>v,v=>v,.01);
    number('delayFeedback','Возврат %','Доля повторов эха, от 0 до 90 процентов.',0,90,v=>Math.round(v*100),v=>v/100);
    number('delayMix','Эхо %','Доля эха в звуке, от 0 до 100 процентов. Ноль выключает эхо.',0,100,v=>Math.round(v*100),v=>v/100);
    number('reverbMix','Реверб %','Доля реверберации, от 0 до 100 процентов. Ноль выключает эффект.',0,100,v=>Math.round(v*100),v=>v/100);
    number('reverbTime','Реверб с','Длина затухания реверберации, от 0 до 5 секунд.',0,5,v=>v,v=>v,.01);
    number('pan','Пан %','Панорама: −100 слева, 0 по центру, 100 справа.',-100,100,v=>Math.round(v*100),v=>v/100);
    choice('arpMode','Арпеджио','Порядок нот аккорда: вместе без арпеджио, вверх, вниз или вверх-вниз.',[['off','Выкл'],['up','Вверх'],['down','Вниз'],['updown','Вверх↕']]);
    number('arpGate','Нота %','Длина ноты арпеджио в долях шага, от 5 до 100 процентов.',5,100,v=>Math.round(v*100),v=>v/100);
    number('swing','Свинг %','Сдвиг слабых долей, от 0 до 75 процентов. Ноль даёт ровные доли.',0,75,v=>Math.round(v*100),v=>v/100);
    const toggles=[];
    for(const [key,text,title]of [['envelopeOn','Огибающая','Включить свою огибающую: атака, спад, удержание и хвост. Выключение возвращает обычное звучание тембра.'],['loop','Повтор','После последней строки начать снова.'],['live','Обновлять','Дополнительно снимать текущее поле на каждом повторе. Смена кадра и правки битов обновляют музыку сразу, независимо от этой кнопки; Xorrom сам кадры не переключает.'],['restartOnFrame','С начала кадра','При смене кадра вручную или плеером линия чтения возвращается к первой выбранной строке. Во время паузы линия перемещается без звука.']]){
      const control=button(key,text,title,()=>safe(()=>api.setSettings({[key]:!settings()[key]})));toggles.push({key,...control,text});
    }
    number('first','От строки','Первая строка для музыки; отсчёт начинается с 0.',0,1000000);
    number('last','До строки','Последняя строка включительно. Значение −1 означает до конца поля.',-1,1000000);
    number('stride','Шаг строк','Брать каждую строку или пропускать: от 1 до 32. Больший шаг сокращает фразу.',1,32);
    const wav=button('wav','↓ WAV','Сохранить общий WAV: один проход каждой дорожки от её выбранной позиции; заглушённые дорожки не звучат. Воспроизведение не запускается. Максимум 60 секунд; длинный проход обрезается.',()=>run(async()=>{
      const result=await api.exportWav();if(destroyed)return;
      if(!result?.blob)throw new Error('Не удалось создать WAV');
      if(download){await download(result.blob,result.name||'xorrom.wav');notice=result.note||'WAV сохранён';return;}
      const url=win.URL.createObjectURL(result.blob),anchor=doc.createElement('a');anchor.href=url;anchor.download=result.name||'xorrom.wav';anchor.hidden=true;host.append(anchor);anchor.click();anchor.remove();win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);notice=result.note||'WAV сохранён';
    },'export'));
    const fileInput=doc.createElement('input');fileInput.type='file';fileInput.accept='.json,application/json';fileInput.hidden=true;fileInput.dataset.xorrom='jsonFile';nodes.push(fileInput);
    const validate=value=>{
      const check=win.MayatnikXorrom?.validateSettings;
      if(typeof check!=='function')throw new Error('Проверка настроек недоступна. Обновите страницу.');
      return check(value);
    };
    async function saveBlob(blob,name){
      if(download){await download(blob,name);return;}
      const url=win.URL.createObjectURL(blob),anchor=doc.createElement('a');anchor.href=url;anchor.download=name;anchor.hidden=true;host.append(anchor);anchor.click();anchor.remove();win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);
    }
    function readFile(file){
      if(typeof file.text==='function')return file.text();
      return new Promise((resolve,reject)=>{const reader=activeReader=new win.FileReader();
        const done=()=>{if(activeReader===reader)activeReader=null;};
        reader.onload=()=>{done();resolve(reader.result);};reader.onerror=()=>{done();reject(new Error('Не удалось прочитать JSON.'));};reader.onabort=()=>{done();const reason=new Error('Импорт отменён');reason.name='AbortError';reject(reason);};reader.readAsText(file,'UTF-8');
      });
    }
    async function importFile(file){
      if(destroyed||importing||pending)return;
      const generation=++importGeneration;importing=true;error='';notice='';sync();
      try{
        if(file.size>65536)throw new Error('JSON больше 64 КиБ.');
        const text=String(await readFile(file));if(destroyed||generation!==importGeneration)return;
        if(new win.Blob([text]).size>65536)throw new Error('JSON больше 64 КиБ.');
        let value;try{value=JSON.parse(text.replace(/^\uFEFF/,''));}catch(_){throw new Error('Неверный JSON настроек.');}
        const valid=validate(value);
        await api.pause();
        if(destroyed||generation!==importGeneration)return;
        api.setSettings(valid);notice='Настройки JSON загружены. Нажмите Старт для игры.';
      }catch(reason){if(!destroyed&&generation===importGeneration){if(reason?.name==='AbortError')notice='Импорт отменён';else error=reason?.message||String(reason);}}
      finally{if(!destroyed&&generation===importGeneration){importing=false;sync();after();}}
    }
    const jsonLoad=button('jsonLoad','↑ JSON','Загрузить полный набор настроек синтезатора из JSON до 64 КиБ. Проверка выполняется до изменения настроек; игра ставится на паузу, автоматического старта нет.',()=>{if(!destroyed&&!importing&&!pending){fileInput.value='';fileInput.click();}});
    const jsonSave=button('jsonSave','↓ JSON','Сохранить полный ручной набор настроек синтезатора в JSON. Текущие автоматические значения рисунка не заменяют ручные настройки.',()=>run(async()=>{
      const valid=validate(settings()),blob=new win.Blob([JSON.stringify(valid,null,2)+'\n'],{type:'application/json'});await saveBlob(blob,'xorrom-settings.json');if(!destroyed)notice='Настройки JSON сохранены';
    },'json'));
    fileInput.addEventListener('change',()=>{const file=fileInput.files?.[0];fileInput.value='';if(file)void importFile(file);else safe(()=>{notice='Импорт отменён';});});
    fileInput.addEventListener('cancel',()=>safe(()=>{notice='Импорт отменён';}));
    const help=doc.createElement('a');help.className='gz-hx';help.href=helpUrl;help.target='_blank';help.rel='noopener';help.dataset.xorrom='help';caption(help,'? Новичку');describe(help,'Открыть инструкцию Xorrom: как рисунок превращается в ноты, ритм и музыку.');append(help);
    const status=doc.createElement('div');status.className='gz-hx may-xorrom-status';status.dataset.xorrom='status';
    const transportStatus=doc.createElement('span');transportStatus.setAttribute('role','status');transportStatus.setAttribute('aria-live','polite');
    const rowStatus=doc.createElement('span');rowStatus.setAttribute('aria-live','off');rowStatus.dataset.xorrom='row';status.append(transportStatus,rowStatus,fileInput);append(status);
    const geometry=doc.createElement('div');geometry.className='gz-hx may-xorrom-geometry';geometry.dataset.xorrom='geometry';geometry.setAttribute('aria-live','off');append(geometry);
    const notes=doc.createElement('div');notes.className='gz-hx may-xorrom-notes';notes.dataset.xorrom='notes';describe(notes,'Фактически прозвучавшие ноты последнего шага. Пауза означает отсутствие нот.');append(notes);
    const legend=doc.createElement('div');legend.className='gz-hx may-xorrom-legend';legend.dataset.xorrom='legend';
    legend.title='Условное назначение цветов ступеням выбранного лада, а не физический закон: 1 синий — До; 2 зелёный — Ре; 3 голубой — Ми; 4 красный — Фа; 5 пурпурный — Соль; 6 жёлтый — Ля; 7 белый — Си. Чёрный — пауза. В других ладах и тональностях ступени звучат иначе.';
    legend.setAttribute('aria-label',legend.title);
    for(const [code,color,note]of [[1,'#00f','До'],[2,'#0f0','Ре'],[3,'#0ff','Ми'],[4,'#f00','Фа'],[5,'#f0f','Соль'],[6,'#ff0','Ля'],[7,'#fff','Си']]){const chip=doc.createElement('span');chip.style.setProperty('--note-color',color);chip.textContent=code+' '+note;legend.append(chip);}append(legend);
    // These existing nodes move together into Library → Music. Quick transport
    // stays directly on the rail; grouping never replaces the live inputs.
    const categories=[
      ['tracks','Дорожки',['track','trackName','trackAdd','trackRemove','trackPlay','trackStop','trackMute','tracksStart','tracksStop']],
      ['reading','Чтение / Оси',['tracksTemplates','trackAxis','trackAxes','trackAxisx1','trackAxisy1','trackAxisx2','trackAxisy2','trackAxisFixed','trackAxisReverse','first','last','stride','loop','live','restartOnFrame']],
      ['notes','Ноты / Ритм',['source','bpm','division','scale','tonic','octave','chord','arpMode','arpGate','swing','autoGeometry','geometrySource','geometryConnectivity']],
      ['sound','Тембр / Громкость / Фон',['electro','timbre','gain','backing','backingTimbre','backingGain','backingRows']],
      ['effects','Огибающая / Фильтр / LFO / Эффекты',['envelopeOn','attack','decay','sustain','release','filterType','cutoff','resonance','lfoTarget','lfoRate','lfoDepth','delayTime','delayFeedback','delayMix','reverbMix','reverbTime','pan']],
      ['files','Файлы / Сведения',['wav','jsonLoad','jsonSave','help','status','geometry','notes','legend']]
    ];
    for(const [id,title,keys]of categories){const controls=keys.map(key=>nodes.find(node=>node.dataset.xorrom===key&&node.parentElement===host)).filter(Boolean);if(!controls.length)continue;
      const section=doc.createElement('section');section.className='may-xorrom-group';section.dataset.xorromGroup=id;section.setAttribute('aria-label',title);
      const heading=doc.createElement('h4');heading.className='may-xorrom-group-title';heading.textContent=title;
      const grid=doc.createElement('div');grid.className='may-xorrom-grid';grid.append(...controls);section.append(heading,grid);host.append(section);nodes.push(section);
    }
    function sync(){
      if(destroyed)return;
      const s=settings(),current=state(),playing=current.state==='playing';
      bindings.forEach(bind=>bind(s,current));
      steppers.forEach(update=>update());
      const matchesElectro=Object.entries(electroPreset).every(([key,value])=>s[key]===value);
      const electronic=['bass','pulse','metal','robot'].includes(s.timbre);
      electro.node.classList.toggle('gz-on',electronic);electro.node.setAttribute('aria-pressed',String(electronic));electro.node.dataset.presetMatch=String(matchesElectro);
      describe(electro.node,(electronic?'Выбран электронный тембр. ':'')+'Нажать — применить базовый электронный набор: RGB, 112 BPM, 1/16, До минор, Пульс, одна нота.');
      auto.node.classList.toggle('gz-on',!!s.autoGeometry);auto.node.setAttribute('aria-pressed',String(!!s.autoGeometry));
      const g=s.autoGeometry?current.geometry:null;
      const geometryText=g?'Обл '+(g.id??'—')+' · S '+(g.area??'—')+' · H '+(g.height??'—')+' · сим '+(g.symmetryHeight??'—'):s.autoGeometry?'Рисунок: ожидание':'Рисунок: вручную';
      if(geometry.textContent!==geometryText)geometry.textContent=geometryText;
      describe(geometry,g?'Звучащая область '+(g.id??'—')+'; площадь '+(g.area??'—')+' клеток; высота '+(g.height??'—')+' строк; высота вертикальной симметрии '+(g.symmetryHeight??'—')+' строк.':geometryText);
      caption(start.label,pending?'…':playing?'Ⅱ Пауза':current.state==='paused'?'▶ Дальше':'▶ Старт');start.node.disabled=pending||importing;start.node.classList.toggle('gz-on',playing);start.node.setAttribute('aria-pressed',String(playing));describe(start.node,playing?'Приостановить музыку. Повторное нажатие продолжит с того же места.':current.state==='paused'?'Продолжить музыку с места паузы без нового снимка поля.':'Снять текущее поле и начать музыку. Захват приостанавливает плеер поля; Xorrom играет строки снимка и сам кадры не переключает. Звук включается только после нажатия.');
      stop.node.disabled=false;
      toggles.forEach(t=>{caption(t.label,t.text+': '+(s[t.key]?'вкл':'выкл'));t.node.classList.toggle('gz-on',!!s[t.key]);t.node.setAttribute('aria-pressed',String(!!s[t.key]));});
      wav.node.disabled=exporting||!!current.updating;caption(wav.label,exporting?'… WAV':'↓ WAV');wav.node.setAttribute('aria-busy',String(exporting));
      jsonLoad.node.disabled=importing||pending;jsonSave.node.disabled=pending||importing;jsonLoad.node.setAttribute('aria-busy',String(importing));
      const visibleError=error||current.error;
      const message=visibleError?'Ошибка: '+visibleError:importing?'Чтение JSON…':exporting?'Создание WAV…':current.updating?'Обновляю кадр…':notice||(pending?'Подготовка…':playing?'Играет':current.state==='paused'?'Пауза':'Остановлено');
      const row=(playing||current.state==='paused')&&Number.isInteger(current.index)&&current.index>=0?' · Строка '+current.index:'';
      if(transportStatus.textContent!==message)transportStatus.textContent=message;
      if(rowStatus.textContent!==row)rowStatus.textContent=row;
      status.title=message+row;
      const played=Array.isArray(current.notes)?current.notes:[];
      const noteName=note=>{if(typeof note!=='object')return String(note);if(note.drum)return {kick:'Бочка',snare:'Малый',hat:'Хэт'}[note.drum]||note.drum;if(note.name||note.note)return note.name||note.note;const midi=Number(note.midi);return Number.isFinite(midi)?['До','До♯','Ре','Ре♯','Ми','Фа','Фа♯','Соль','Соль♯','Ля','Ля♯','Си'][((midi%12)+12)%12]+(Math.floor(midi/12)-1):'♪';};
      const backing=Array.isArray(current.backingNotes)?current.backingNotes:[];
      const text=(played.length?played.map(noteName).join(' · '):'— пауза')+(backing.length?' / Фон '+backing.map(noteName).join(' · '):'');
      if(notes.textContent!==text)notes.textContent=text;describe(notes,'Прозвучало: '+text);
    }
    sync();if(typeof api.subscribe==='function')unsubscribe=api.subscribe(sync);
    return {sync,destroy(){if(destroyed)return;destroyed=true;importGeneration++;activeReader?.abort();activeReader=null;unsubscribe?.();nodes.forEach(node=>node.remove());}};
  }
  return Object.freeze({mount});
});
