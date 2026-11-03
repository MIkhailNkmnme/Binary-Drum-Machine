/* Selected-template adapters. No independent template state or saved control values. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikTemplateInline=api;})(globalThis,function(){
  'use strict';
  const unknownItems=new WeakMap();let unknownSerial=0;
  function unknownItem(item){if(!unknownItems.has(item))unknownItems.set(item,++unknownSerial);return 'item:'+unknownItems.get(item);}
  function proofBits(proof,mask){
    const bits=new Int8Array(mask.data.length).fill(-1);if(!proof||proof.version!==1||proof.width!==mask.width||proof.height!==mask.height||!Array.isArray(proof.runs))return bits;
    let end=0;for(const run of proof.runs){if(!Array.isArray(run)||run.length!==5||!run.every(Number.isSafeInteger)||run[0]<end||run[1]<=run[0]||run[1]>bits.length||run[2]<0||run[3]<0||(run[4]!==0&&run[4]!==1))return new Int8Array(mask.data.length).fill(-1);bits.fill(run[4],run[0],run[1]);end=run[1];}return bits;
  }
  function signature(item){
    if(typeof item?.inlineSourceKey==='string')return item.inlineSourceKey;
    const groups=new Map();for(const part of item?.parts||[]){const origin=part.sourceOrigin,key=origin?.key||origin||part,mask=origin?.mask||part.mask;if(!mask||!Number.isSafeInteger(mask.width)||!Number.isSafeInteger(mask.height)||!Number.isFinite(mask.x)||!Number.isFinite(mask.y)||mask.data?.length!==mask.width*mask.height)return null;
      let group=groups.get(key);if(!group){group={mask,bits:proofBits(origin?.librarySource||part.librarySource,mask),own:new Map(),unknown:typeof origin?.key==='string'?'origin:'+origin.key:unknownItem(item)};groups.set(key,group);}
      if(part.bitsData?.length===part.mask?.data?.length){for(let q=0;q<part.mask.data.length;q++)if(part.mask.data[q]){const index=origin?part.sourceIndices?.[q]:q,bit=part.bitsData[q];if(!Number.isSafeInteger(index)||index<0||index>=mask.data.length||bit!==0&&bit!==1){group.invalid=true;continue;}if(group.own.has(index)&&group.own.get(index)!==bit)group.invalid=true;group.own.set(index,bit);group.bits[index]=bit;}}
    }
    const sources=[...groups.values()];if(!sources.length)return null;
    const x0=Math.min(...sources.map(g=>g.mask.x)),y0=Math.min(...sources.map(g=>g.mask.y)),x1=Math.max(...sources.map(g=>g.mask.x+g.mask.width)),y1=Math.max(...sources.map(g=>g.mask.y+g.mask.height)),points=new Map(),unknown=new Set();
    for(const g of sources){const m=g.mask;if(g.invalid)unknown.add(unknownItem(item));for(let q=0;q<m.data.length;q++)if(m.data[q]){const x=m.x-x0+q%m.width,y=m.y-y0+Math.floor(q/m.width),key=x+','+y,bit=g.bits[q];if(bit!==0&&bit!==1)unknown.add(g.unknown);const previous=points.get(key);if(previous&&previous[2]!==bit)unknown.add(unknownItem(item));points.set(key,[x,y,bit]);}}
    if(!points.size)return null;const w=x1-x0,h=y1-y0,values=[...points.values()],variants=[];
    for(const flipX of [false,true])for(const flipY of [false,true])variants.push(JSON.stringify([unknown.size?['unknown',...[...unknown].sort()]:'bits',w,h,values.map(([x,y,bit])=>[flipX?w-1-x:x,flipY?h-1-y:y,bit]).sort((a,b)=>a[1]-b[1]||a[0]-b[0])]));
    return variants.sort()[0];
  }
  function matching(active,items,picked){if(!active)return [];const selected=new Set(picked),key=signature(active);return items.filter(t=>selected.has(t.id)&&(t===active||key!==null&&signature(t)===key));}
  function constrained(direction,dx,dy,rk=1,diamond=false){const step=diamond?2:1,value=direction==='h'?dx:dy,delta=Math.sign(value)*Math.round(Math.abs(value)/rk/step)*step||0;return {x:direction==='h'?delta:0,y:direction==='v'?delta:0};}
  function receipt(previous,before,after){
    const result={};for(const [name,fallback]of [['paint',0],['bits',-1],['matchPaint',0],['matchBits',2]]){const values=new Map((previous?.[name]||[]).map(v=>[v[0],v.slice()])),a=before[name],b=after[name],n=Math.max(a?.length||0,b?.length||0);for(let q=0;q<n;q++){const old=a?.[q]??fallback,next=b?.[q]??fallback;if(old===next)continue;const saved=values.get(q);values.set(q,[q,saved&&saved[2]===old?saved[1]:old,next]);}if(values.size)result[name]=[...values.values()];}return Object.keys(result).length?result:null;
  }
  function restoreReceipt(receipt,current){const result={...current};for(const [name,fallback,Type]of [['paint',0,Uint32Array],['bits',-1,Int8Array],['matchPaint',0,Uint32Array],['matchBits',2,Uint8Array]]){const entries=receipt?.[name];if(!entries?.length)continue;let output=current[name];for(const [q,before,last]of entries){if((output?.[q]??fallback)!==last)continue;if(output===current[name])output=output?.slice()||new Type(current.size||q+1).fill(fallback);output[q]=before;}result[name]=output;}return result;}
  const commands=[
    ['colour','Цвет выбранных шаблонов','●'],['save','Сохранить выбранные шаблоны в библиотеку','▣'],['clone','Добавить копии выбранных шаблонов','⧉'],['remove','Убрать выбранные шаблоны с поля','×'],['show','Показать / скрыть выбранные шаблоны','◉'],['find','Найти все такие же шаблоны','⌕'],
    ['flipH','Отразить выбранные шаблоны слева направо','↔'],['flipV','Отразить выбранные шаблоны сверху вниз','↕'],['return','Туда / назад','⇄'],['reset','Восстановить выбранные шаблоны','↶'],['taller','Увеличить высоту на 10 процентов','+'],['shorter','Уменьшить высоту на 10 процентов','−'],
    ['up','Сдвинуть вверх на одну строку','↑'],['down','Сдвинуть вниз на одну строку','↓'],['fall','Спуск выбранных шаблонов до меняющихся битов','⇓'],['move','Двигать выбранные шаблоны за оси','✥'],['transfer','Переносить без следа','⇢'],['paint','Прокрасить выбранные шаблоны','▧'],['trail','Инвертировать след','◐'],['proportional','Пропорциональное изменение размера','⤢'],['line','Зеркальная копия по линии','⇅'],['xor1','XOR на строку ниже','⊕'],['xorNext','Следующий шаг XOR','⊕↓']
  ];
  const groups=[
    ['Копии / библиотека',['save','clone','remove','find']],
    ['Цвет / видимость',['colour','show','paint']],
    ['Размер',['taller','shorter','proportional']],
    ['Сдвиг / след',['move','up','down','fall','transfer','trail']],
    ['Зеркала / XOR',['flipH','flipV','line','xor1','xorNext']],
    ['Возврат',['return','reset']]
  ];
  const captions={save:'В библиотеку',clone:'Копия',remove:'Убрать',find:'Найти такие',colour:'Цвет',show:'Показать',paint:'Прокрасить',taller:'Высота +10%',shorter:'Высота −10%',proportional:'Пропорции',move:'Двигать',up:'Вверх',down:'Вниз',fall:'Спуск',transfer:'Без следа',trail:'Инв. след',flipH:'Лево / право',flipV:'Верх / низ',line:'По линии',xor1:'XOR +1',xorNext:'Шаг XOR',return:'Туда / назад',reset:'Восстановить'};
  function mount(options){
    const doc=options.document||document,root=doc.defaultView||globalThis,caption=text=>typeof root.sharedHubButtonText==='function'?root.sharedHubButtonText(text):(root.HubButtonText?.shortCaption(text)||text),host=doc.createElement('div');host.className='may-template-inline';host.setAttribute('aria-label','Действия выбранного шаблона');host.setAttribute('data-no-mini','');host.hidden=true;doc.body.append(host);
    const buttons=new Map(),inputs=new Map(),sections=new Map(),palette=doc.createElement('div');let currentState=null,dismissed=false,dismissedKey=null;palette.className='may-template-inline-palette';palette.hidden=true;
    const events=['pointerdown','pointerup','pointermove','dblclick','contextmenu'];for(const name of events)host.addEventListener(name,e=>e.stopPropagation());
    for(const [name,ids]of groups){const section=doc.createElement('section');section.className='may-template-inline-group';section.setAttribute('aria-label',name);const heading=doc.createElement('div');heading.className='may-template-inline-heading';heading.textContent=caption(name);heading.title=name;section.append(heading);host.append(section);for(const id of ids)sections.set(id,section);}
    function button(id,title,glyph,parent,swatch=false){const node=doc.createElement('button');node.type='button';node.className=swatch?'may-template-inline-button may-template-inline-swatch':'gz-hx may-standard may-template-inline-button';node.dataset.command=id;node.title=title;node.setAttribute('aria-label',title);
      if(swatch)node.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path class="inline-face" d="M12 1 23 12 12 23 1 12Z"/><path class="inline-hover" d="m6 6-5 6 5 6m12-12 5 6-5 6"/></svg>';
      else{const icon=doc.createElement('span');icon.className='gz-ic';icon.setAttribute('aria-hidden','true');icon.textContent=glyph;const label=doc.createElement('span');label.className='gz-nm';label.textContent=caption(captions[id]);node.append(icon,label);const outline=doc.createElementNS('http://www.w3.org/2000/svg','svg');outline.setAttribute('class','may-standard-outline');outline.setAttribute('viewBox','0 0 120 24');outline.setAttribute('aria-hidden','true');const polygon=doc.createElementNS(outline.namespaceURI,'polygon');polygon.setAttribute('points','12,0 108,0 120,12 108,24 12,24 0,12');outline.append(polygon);node.append(outline);}
      parent.append(node);return node;}
    for(const [id,title,glyph]of commands){const node=button(id,title,glyph,sections.get(id));buttons.set(id,node);node.addEventListener('click',e=>{e.stopPropagation();if(id==='colour'){palette.hidden=!palette.hidden;if(currentState)render(currentState);return;}palette.hidden=true;options.action(id);});}
    for(const colour of options.colours||['#ffffff','#000000','#ff4040','#ffb347','#ffd646','#74df76','#65d9ff','#5795ff','#b48cff','#5b6475']){const swatch=button('colour:'+colour,'Цвет '+colour,'',palette,true);swatch.style.setProperty('--sample',colour);swatch.addEventListener('click',()=>options.action('colour',colour));}
    const custom=doc.createElement('input');custom.type='color';custom.title='Собственный цвет выбранных шаблонов';custom.setAttribute('aria-label',custom.title);custom.addEventListener('input',()=>options.action('colour',custom.value));palette.append(custom);sections.get('colour').append(palette);
    for(const [id,title,label,unit,min,max,step,group]of [['height','Высота шаблона, проценты','Высота','%',1,3200,10,'taller'],['downValue','Сдвиг вниз, строки','Сдвиг','строк',-4096,4096,1,'move'],['alpha','Видимость шаблона, проценты','Видимость','%',0,100,10,'colour']]){const row=doc.createElement('label');row.className='may-template-inline-field';row.title=title;const name=doc.createElement('span');name.textContent=caption(label);const input=doc.createElement('input');input.type='number';input.min=min;input.max=max;input.step=step;input.title=title;input.setAttribute('aria-label',title);input.dataset.field=id;input.addEventListener('change',()=>options.action(id,Number(input.value)));const units=doc.createElement('span');units.textContent=caption(unit);row.append(name,input,units);sections.get(group).append(row);inputs.set(id,input);}
    function render(state){if(!state||state.width<130){hide();return;}if(dismissed&&dismissedKey===state.key)return;dismissed=false;dismissedKey=null;currentState=state;host.hidden=false;
      const available=state.width-8,columns=available>=374?3:available>=248?2:1,w=columns*120+(columns-1)*6+2,viewportHeight=state.viewportHeight||state.height,bottom=state.top+viewportHeight-4;
      Object.assign(host.style,{boxSizing:'border-box',width:w+'px',maxHeight:Math.max(24,viewportHeight-8)+'px',left:Math.max(state.left+4,Math.min(state.left+state.width-w-4,state.box.x))+'px',top:(state.top+4)+'px'});host.style.setProperty('--inline-columns',columns);
      for(const [id,node]of buttons){node.disabled=!!state.busy||state.disabled?.includes(id);if(['show','move','transfer','paint','trail','proportional','fall'].includes(id))node.setAttribute('aria-pressed',String(!!state[id]));}custom.value=state.colour||'#ffffff';buttons.get('colour').style.setProperty('--sample',custom.value);for(const swatch of palette.children)swatch.disabled=!!state.busy;
      for(const [id,input]of inputs){if(doc.activeElement!==input){const value=state[id],nearest=Math.round(value);input.value=typeof value==='number'&&Math.abs(value-nearest)<1e-9?nearest:value??'';}input.disabled=!!state.busy;}
      // Measure the rendered groups after width, palette and values are applied.
      // The scroll viewport, rather than an icon-count estimate, determines placement.
      const height=Math.min(host.scrollHeight||host.getBoundingClientRect?.().height||0,Math.max(24,viewportHeight-8)),below=state.box.y+state.box.height+6,above=state.box.y-height-6;
      const desired=below+height<=bottom?below:above>=state.top+4?above:below;
      host.style.top=Math.max(state.top+4,Math.min(bottom-height,desired))+'px';}
    function hide(resetDismissal=true){host.hidden=true;palette.hidden=true;currentState=null;if(resetDismissal){dismissed=false;dismissedKey=null;}}
    // Capture outside presses before field/menu handlers can stop propagation.
    // Keep the dismissal across redraws of this selection; its palette is inside host.
    function outside(event){if(host.hidden||host.contains(event.target))return;dismissed=true;dismissedKey=currentState?.key;hide(false);}
    doc.addEventListener('pointerdown',outside,true);
    return {host,render,hide,destroy(){doc.removeEventListener('pointerdown',outside,true);host.remove();}};
  }
  // The existing axis component owns turns and perpendicular manual-axis edits.
  // This adapter contributes translation grips only while the Move control is on.
  function axisDrag(controls,geometry,options){
    const doc=options.document||document,svg=doc.createElementNS('http://www.w3.org/2000/svg','svg'),grips=new Map();svg.classList.add('may-template-translate-layer');controls.host.prepend(svg);let state=null,drag=null;
    function end(event,cancel=false){if(!drag||event.pointerId!==drag.id)return;const old=drag;drag=null;try{old.node.releasePointerCapture(old.id);}catch(_){}options.end(cancel||!old.moved);event.preventDefault();event.stopPropagation();}
    doc.addEventListener?.('pointerdown',e=>{if(e.pointerType==='touch'&&drag&&e.pointerId!==drag.id&&options.secondTouch){options.secondTouch(e,{id:drag.id,x:drag.lastX??drag.x,y:drag.lastY??drag.y});e.preventDefault();e.stopImmediatePropagation();}},true);
    function grip(axis){if(grips.has(axis.id))return grips.get(axis.id);const line=doc.createElementNS(svg.namespaceURI,'line');line.classList.add('may-template-translate-grip');line.setAttribute('tabindex','0');line.setAttribute('role','slider');line.setAttribute('aria-label',axis.direction==='h'?'Двигать шаблоны вдоль горизонтальной оси':'Двигать шаблоны вдоль вертикальной оси');line.dataset.direction=axis.direction;
      line.addEventListener('pointerdown',e=>{if(e.button!==0||!state||!state.translateEnabled||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;if(options.begin(axis.id,axis.direction,e)===false)return;drag={id:e.pointerId,node:line,x:e.clientX,y:e.clientY,direction:axis.direction,factor:state.factor,rk:state.rk,moved:false};line.setPointerCapture(e.pointerId);line.focus();e.preventDefault();e.stopPropagation();});
      line.addEventListener('pointermove',e=>{const d=drag;if(!d||d.id!==e.pointerId)return;d.lastX=e.clientX;d.lastY=e.clientY;if(!d.moved&&Math.hypot(e.clientX-d.x,e.clientY-d.y)<3)return;d.moved=true;options.move(d.direction,(e.clientX-d.x)/d.factor,(e.clientY-d.y)/d.factor,d.rk);e.preventDefault();e.stopPropagation();});
      line.addEventListener('pointerup',e=>end(e));line.addEventListener('pointercancel',e=>end(e,true));line.addEventListener('lostpointercapture',e=>end(e,true));
      line.addEventListener('keydown',e=>{if(e.key==='Escape'&&drag){end({pointerId:drag.id,preventDefault(){},stopPropagation(){}},true);return;}if(!state?.translateEnabled)return;const delta=axis.direction==='h'?(e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0):(e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0);if(!delta||e.altKey||e.ctrlKey||e.metaKey)return;if(options.begin(axis.id,axis.direction)!==false){options.move(axis.direction,axis.direction==='h'?delta*state.rk:0,axis.direction==='v'?delta*state.rk:0,state.rk);options.end(false);}e.preventDefault();e.stopPropagation();});svg.append(line);grips.set(axis.id,line);return line;
    }
    return {render(next){state=next;const on=!!next?.translateEnabled;controls.host.classList.toggle('may-template-translate',on);svg.style.display=on?'':'none';if(!on){if(drag)end({pointerId:drag.id,preventDefault(){},stopPropagation(){}},true);return;}svg.setAttribute('width',next.width);svg.setAttribute('height',next.height);const box={x:next.ox+next.box.x*next.factor,y:next.oy+next.box.y*next.factor,width:next.box.width*next.factor,height:next.box.height*next.factor},axes=next.axes.map(a=>({...a,position:(a.direction==='h'?next.oy:next.ox)+a.position*next.factor})),placed=geometry.layout(box,axes,next.width,next.height),active=new Set(placed.map(a=>a.id));for(const [id,node]of grips)node.style.display=active.has(id)?'':'none';for(const a of placed){const node=grip(a);node.style.display=a.outside?'none':'';for(const [key,value]of Object.entries({x1:a.a[0],y1:a.a[1],x2:a.b[0],y2:a.b[1]}))node.setAttribute(key,value);}},cancel(){if(drag)end({pointerId:drag.id,preventDefault(){},stopPropagation(){}},true);},get dragging(){return !!drag;}};
  }
  return {signature,matching,constrained,receipt,restoreReceipt,commands,mount,axisDrag};
});
