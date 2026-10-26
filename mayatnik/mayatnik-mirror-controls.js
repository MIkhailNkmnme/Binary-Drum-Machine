/* One menu for existing mirror engines. Selecting a source never changes the field. */
(() => {
  'use strict';
  const KEY='mayatnik-mirror-menu';
  const profiles=[
    {id:'template',name:'Шаблон',axis:'Ось шаблона',side:'Целиком',op:'Копия',result:'На месте',nodes:['templateMirrorPair','bMirrorLine','bMirrorByLine']},
    {id:'manual',name:'Биты / краска',axis:'Своя ось',side:'Сверху вниз',op:'Копия / XOR / AND',result:'Правка клеток',nodes:['bAxisLine','bAxisMirror','bAxisXor','bAxisLinesClear','mirCol']},
    {id:'canvas',name:'Поле за осью',axis:'Подвижная ось',side:'За ось',op:'Копия',result:'Отдельный холст',nodes:['mayMirAxis','mirCol']},
    {id:'upper',name:'Растр: треугольник',axis:'Горизонталь встречи',side:'Снизу вверх',op:'Копия / XOR / AND',result:'Только вид',nodes:['fixMirror','fixDown','fixWide','fixRot','fixLock','mirCol','mirOp']},
    {id:'lower',name:'Растр: клинья',axis:'Две диагонали',side:'Левая / правая',op:'Копия / XOR / AND',result:'Только вид',nodes:['fixLow','fixLowOut','mirCol','mirOp']},
    {id:'lines',name:'Растр: линии',axis:'Линия',side:'Через линию',op:'Копия / XOR / AND',result:'Только вид',nodes:['mirCol','mirOp']},
    {id:'black',name:'Краска / весь растр',axis:'Найденные треугольники',side:'Внутрь',op:'Копия / XOR / AND',result:'Только вид',nodes:['bBlackMirror','mirCol','mirOp']},
    {id:'tri',name:'Верхний узор',axis:'Треугольники',side:'Вниз рекурсивно',op:'Только XOR',result:'Только вид',nodes:['bTriTop']},
    {id:'fill',name:'Заливка',axis:'Центральная ось',side:'Парная клетка',op:'Тот же бит',result:'Правка краски',nodes:['fillMirror']}
  ];
  const details={template:'Один активный шаблон. На месте отражаются маска и биты; копия за край или по линии создаёт отдельный шаблон. XOR/AND шаблона отсутствуют.',manual:'Правка клеток по последней ручной оси. Есть краска — отражается её силуэт; без краски — исходные биты. Ось можно двигать при включённом отражении.',canvas:'Основной холст отражается в отдельный холст за подвижной осью. Фильтр цвета действует, XOR/AND не применяются; данные поля сохраняются.',upper:'Растровый треугольник у точки встречи. Собственные режимы шахматки и предварительного XOR/AND остаются настройками этого источника; общая операция применяется поверх них.',lower:'Растровые боковые клинья. Левая и правая диагонали независимы; Наружу меняет направление. Исходные клетки сохраняются.',lines:'Последовательные растровые отражения по выбранным линиям. Полуклеточный сдвиг диагонали не поддерживается; нужен целый сдвиг.',black:'Растр внутри найденных треугольников после окраски. Отдельно выбирается только краска или весь растр.',tri:'Рекурсивная вставка верхнего узора в нижние треугольники. Собственная фиксированная операция XOR; общая операция зеркал этот источник не меняет.',fill:'При заливке добавляется симметричная парная клетка того же бита. Shift также временно добавляет пару; это не копия всего растра.'};
  function migrate(storage,moves){
    const key='mayatnik-control-mini-v464',mark='mayatnik-mirror-menu-before';
    try{const raw=storage.getItem(key),saved=JSON.parse(raw||'[]');if(!Array.isArray(saved))return;
      const merged=new Set(saved);for(const [from,to]of moves)if(merged.has(from))merged.add(to);
      if(merged.size!==saved.length){if(!storage.getItem(mark))storage.setItem(mark,raw);storage.setItem(key,JSON.stringify([...merged]));}
    }catch(_){}
  }
  function migrateGroup(storage){
    const mark='mayatnik-mirror-group-merge',old='gz:mirrors',name='Зеркала';
    try{if(storage.getItem(mark))return;
      const keys=['mayatnik-dd-grid','mayatnik-botx','mayatnik-dd-order','mayatnik-dd-pins','mayatnik-dd-fold','mayatnik-dd-mini','mayatnik-bot','mayatnik-dd-open'];
      const raw=Object.fromEntries(keys.map(k=>[k,storage.getItem(k)]));
      const read=(k,fallback)=>{try{return JSON.parse(raw[k])||fallback;}catch(_){return fallback;}};
      storage.setItem(mark+'-before',JSON.stringify(raw));
      for(const key of keys.slice(0,2)){const data=read(key,{});if(Object.hasOwn(data,old)&&!Object.hasOwn(data,name))data[name]=data[old];delete data[old];storage.setItem(key,JSON.stringify(data));}
      for(const key of keys.slice(2,-1)){const data=read(key,[]);if(Array.isArray(data))storage.setItem(key,JSON.stringify([...new Set(data.map(id=>id===old?name:id))]));}
      if(raw['mayatnik-dd-open']===old)storage.setItem('mayatnik-dd-open',name);storage.setItem(mark,'1');
    }catch(_){}
  }
  function mount({row,take,storage=localStorage,after=()=>{},listHover,window:win=window}){
    if(!row)return null;
    const doc=row.ownerDocument,group=row.parentElement,nodes=new Map(),moves=[];
    group.dataset.k='Зеркала';group.classList.add('may-mirror-group');group.classList.remove('pt-view');row.classList.remove('pt-cols');
    let saved={};try{saved=JSON.parse(storage.getItem(KEY)||'{}')||{};}catch(_){}
    const state={source:profiles.some(p=>p.id===saved.source)?saved.source:'template',axis:['h','v','line'].includes(saved.axis)?saved.axis:'h',copy:!!saved.copy,side:['left','right','top','bottom'].includes(saved.side)?saved.side:'right',line:saved.line??'main'};
    const save=()=>{try{storage.setItem(KEY,JSON.stringify(state));}catch(_){}};
    const allIds=[...new Set(profiles.flatMap(p=>p.nodes))];
    for(const id of allIds){const node=take(id);if(!node)continue;
      const owner=node.closest('[data-id],.pt-g'),old=owner?.dataset.id||owner?.dataset.k||owner?.querySelector('.may-group-title')?.textContent.trim()||'';
      const parent=node.parentElement,peers=[...parent.children].filter(n=>n.matches('button,.gz-hx,[role="button"]'));
      const from=node.dataset.n?'group:'+old+':data:'+node.dataset.n:'group:'+old+':parent:'+(parent.id||parent.className)+':slot:'+peers.indexOf(node);
      moves.push([from,'group:Зеркала:data:'+id]);node.dataset.n=id;node.dataset.mirrorSetting=id;node.style.left=node.style.top='';nodes.set(id,node);row.append(node);
    }
    migrate(storage,moves);migrateGroup(storage);
    const make=(id,caption)=>{const b=doc.createElement('button');b.type='button';b.className='pt-b gz-hx';b.dataset.n=id;const n=doc.createElement('span');n.className='gz-nm';n.textContent=caption;b.append(n);row.append(b);return b;};
    const caption=(b,text,title=text)=>{const n=b.querySelector('.gz-nm');if(n.textContent!==text)n.textContent=text;b.title=title;b.setAttribute('aria-label',title);};
    const source=make('mirrorSource','Что: шаблон'),axis=make('mirrorAxis','Ось'),side=make('mirrorSide','Сторона'),op=make('mirrorOperation','Операция'),result=make('mirrorResult','Результат'),apply=make('mirrorApply','Отразить');
    const controls=[source,axis,side,op,result,apply];row.prepend(...controls);
    const retained=doc.createElement('div');retained.hidden=true;retained.dataset.mirrorRetained='';row.append(retained);
    const current=()=>profiles.find(p=>p.id===state.source),lines=()=>win.mayLineMirrors?.list()||[],line=()=>lines().find(l=>String(l.id)===String(state.line))||lines()[0];
    const operation=()=>state.source==='manual'&&win.mayManualMirror?win.mayManualMirror.op():win.mayMir?.op()||'';
    const setOperation=value=>{if(state.source==='manual'&&win.mayManualMirror)win.mayManualMirror.setOp(value);else win.mayMir?.set('op',value);};
    // Legacy XOR remains an addressable source for old pins, while the visible action uses the effective operation.
    nodes.get('bAxisMirror')?.addEventListener('click',event=>{if(!win.mayManualMirror)return;event.preventDefault();event.stopImmediatePropagation();win.mayManualMirror.setOn(!win.mayManualMirror.on());sync();after();},true);
    const setSource=id=>{if(!profiles.some(p=>p.id===id))return;state.source=id;save();sync();after();};
    const optionsFor=b=>{
      if(b===source)return profiles.map(p=>({key:p.id,name:p.name,on:p.id===state.source,pick:()=>setSource(p.id)}));
      if(b===axis&&state.source==='template')return [['h','Слева ↔ справа'],['v','Сверху ↔ снизу'],['line','Линия-зеркало']].map(([id,name])=>({key:id,name,on:state.axis===id,pick:()=>{state.axis=id;save();sync();after();}}));
      if(b===axis&&state.source==='lines')return lines().map(l=>({key:'line:'+l.id,name:(l.id==='main'?'Главная':({h:'Горизонталь',v:'Вертикаль',d1:'Диагональ ╲',d2:'Диагональ ╱',d:'Диагональ',a:'Диагональ'}[l.kind]||l.kind))+' '+l.position,on:String(line()?.id)===String(l.id),pick:()=>{state.line=l.id;save();sync();after();}}));
      if(b===side&&state.source==='template'&&state.copy&&state.axis!=='line')return(state.axis==='h'?[['left','Влево'],['right','Вправо']]:[['top','Вверх'],['bottom','Вниз']]).map(([id,name])=>({key:id,name,on:state.side===id,pick:()=>{state.side=id;save();sync();after();}}));
      if(b===side&&state.source==='lines')return line()?.disabled?[]:[['Выключено',0],['Вниз / вправо',1],['Вверх / влево',2]].map(([name,m])=>({key:m,name,on:line()?.mode===m,pick:()=>{const l=line();if(l&&!l.disabled)win.mayLineMirrors.set(l.id,m);sync();after();}}));
      if(b===op&&['manual','upper','lower','lines','black'].includes(state.source))return [['','Копия'],['xor','XOR'],['and','AND']].map(([id,name])=>({key:id,name,on:operation()===id,pick:()=>{setOperation(id);sync();after();}}));
      if(b===result&&state.source==='template'&&state.axis!=='line')return [[false,'На месте'],[true,'Копией за край']].map(([id,name])=>({key:id,name,on:state.copy===id,pick:()=>{state.copy=id;save();sync();after();}}));
      return [];
    };
    for(const b of [source,axis,side,op,result]){
      b.dataset.listTitle=({mirrorSource:'Что отражать',mirrorAxis:'Ось',mirrorSide:'Сторона',mirrorOperation:'Операция',mirrorResult:'Результат'})[b.dataset.n];
      b.onclick=()=>{const opts=optionsFor(b);if(!opts.length)return;const i=opts.findIndex(o=>o.on);opts[(i+1)%opts.length].pick();};
      listHover?.(b,{options:()=>optionsFor(b),after:()=>{sync();after();},host:()=>group,col:()=>row});
    }
    apply.onclick=()=>{if(state.source==='template'){const v=state.axis==='v';let s=state.side;if(v&&!['top','bottom'].includes(s))s='bottom';if(!v&&!['left','right'].includes(s))s='right';win.mayTemplateMirror?.apply({axis:state.axis,copy:state.copy||state.axis==='line',side:s});}else if(state.source==='lines')win.mayLineMirrors?.ensure();sync();after();};
    let arranged='';
    function sync(){
      const p=current();caption(source,'Что: '+p.name,'Что отражать: '+p.name+'. '+details[p.id]+' Выбор источника не выключает другие зеркала.');
      const template=p.id==='template',lineMode=p.id==='lines';
      caption(axis,'Ось: '+(template?{h:'↔',v:'↕',line:'по линии'}[state.axis]:lineMode?(line()?((line().id==='main'?'Главная ':line().kind+' ')+line().position):'нет линий'):p.axis));
      let copySide=state.side;if(template&&state.axis==='v'&&!['top','bottom'].includes(copySide))copySide='bottom';if(template&&state.axis==='h'&&!['left','right'].includes(copySide))copySide='right';
      const rasterSide=p.id==='upper'?(win.mayFixDown?.get()?'сверху вниз':'снизу вверх'):p.id==='lower'?(win.mayFixLow?.out()?'наружу':'внутрь'):p.side;
      caption(side,'Сторона: '+(template?(state.axis==='line'?'за линию':state.copy?({left:'влево',right:'вправо',top:'вверх',bottom:'вниз'}[copySide]):'целиком'):lineMode?(line()?.disabled?'нужен целый сдвиг':['выкл','вниз / вправо','вверх / влево'][line()?.mode||0]):rasterSide));
      const configurable=['manual','upper','lower','lines','black'].includes(p.id);
      caption(op,'Операция: '+(configurable?({'':'Копия',xor:'XOR',and:'AND'}[operation()]):p.op),p.id==='manual'?'Фактическая операция отражения клеток: копия, XOR или AND. Выбор заменяет прежний принудительный Хор-режим.':p.id==='upper'?'Общая операция растра. Режимы XOR/AND в Зеркале ↑ дополнительно задают собственное предварительное наложение.':'Операция: '+(configurable?operation()||'Копия':p.op));
      if(p.id==='manual'&&win.mayManualMirror){const action=nodes.get('bAxisMirror');if(action){const on=!!win.mayManualMirror.on();caption(action,'Отражение: '+(on?'вкл':'выкл'),'Отражение по своей оси с операцией '+({'':'Копия',xor:'XOR',and:'AND'}[operation()])+'. Повторное нажатие выключает.');action.classList.toggle('gz-on',on);action.classList.toggle('on',on);action.setAttribute('aria-pressed',String(on));}}
      caption(result,'Результат: '+(template?(state.axis==='line'?'копия за линию':state.copy?'копия за край':'на месте'):p.result));
      caption(apply,template?'Отразить':'Создать линии');apply.hidden=!template&&!lineMode;apply.disabled=template?!win.mayTemplateMirror?.canApply(state.axis):!win.mayLineMirrors;
      for(const b of [axis,side,op,result]){const available=optionsFor(b).length>0;b.disabled=!available;b.setAttribute('aria-haspopup',String(available));}
      // Source controls remain live for legacy pins, observers and handlers; only relevant controls are visible.
      const settings=p.nodes.filter(id=>!['templateMirrorPair','bMirrorByLine','mirOp','bAxisXor'].includes(id)&&!(id==='bMirrorLine'&&state.axis!=='line'));
      for(const [id,node]of nodes){if(settings.includes(id)){if(node.parentElement!==row)row.insertBefore(node,retained);if(node.hidden)node.hidden=false;if(node.style.display)node.style.removeProperty('display');}else{if(node.parentElement!==retained)retained.append(node);if(!node.hidden)node.hidden=true;}}
      const arrangement=p.id+':'+(template?state.axis:'');
      if(arranged!==arrangement){
        const axisIds=['bMirrorLine','bAxisLine','bAxisLinesClear','mayMirAxis'],opIds=['mirCol','bAxisMirror','bAxisXor'];
        const settingNodes=ids=>ids.filter(id=>settings.includes(id)).map(id=>nodes.get(id)).filter(Boolean);
        row.append(source,axis,...settingNodes(axisIds),side,...settingNodes(settings.filter(id=>!axisIds.includes(id)&&!opIds.includes(id))),op,...settingNodes(opIds),result,apply,retained);arranged=arrangement;
      }
    }
    sync();return {sync,setSource,state,profiles,nodes,optionsFor,controls};
  }
  window.MayatnikMirrorControls={mount,profiles,migrate,migrateGroup};
})();
