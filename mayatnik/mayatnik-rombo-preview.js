/* Atlas legend and assembly navigation for the current Rombo. No frame loop. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikRomboPreview=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const choices=['L','R','L↔','R↔'],NS='http://www.w3.org/2000/svg';
 function describe(state){
  const assembly=Math.max(0,Math.min(15,Math.trunc(Number(state.assembly)||0))),slots=[Math.floor(assembly/4),assembly%4];
  const angle=((Math.round((Number(state.angle)||0)/45)*45)%360+360)%360;
  return {assembly,angle,row:state.row,on:!!state.on,slots:slots.map(choice=>({label:choices[choice],flip:choice>=2,fill:choice%2?'#d99bc9':'#78b8e8'})),name:slots.map(choice=>choices[choice]).join(' | ')};
 }
 function mount({document:doc,api,host=doc.body,viewport=null,figure=null}){
  const win=doc.defaultView,box=doc.createElement('div');box.id='mayRomboPreview';box.hidden=true;box.setAttribute('role','group');box.setAttribute('data-no-mini','');
  const make=(tag,attrs={},parent=box)=>{const el=doc.createElementNS(NS,tag);for(const [key,value]of Object.entries(attrs))el.setAttribute(key,String(value));parent.append(el);return el;};
  const isolate=node=>{for(const type of ['pointerdown','pointerup','mousedown','mouseup','click','dblclick','contextmenu','keydown','keyup'])node.addEventListener(type,event=>{event.stopPropagation();if(type==='contextmenu'||type==='dblclick')event.preventDefault();});};
  const select=assembly=>{const current=api(),state=current?.get?.();if(box.hidden||!state?.on||typeof current.setAssembly!=='function')return;current.setAssembly(assembly);sync();};
  const table=doc.createElement('div');table.className='may-rombo-preview-table';table.setAttribute('role','group');table.setAttribute('aria-label','Все 16 схем ромбосборки');box.append(table);
  const cells=Array.from({length:16},(_,assembly)=>{
   const s=describe({assembly}),button=doc.createElement('button');button.type='button';button.className='may-rombo-preview-cell';button.title='Сборка '+(assembly+1)+': '+s.name;button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed','false');
   const caption=doc.createElement('span');caption.className='may-rombo-preview-caption';caption.textContent=(assembly+1)+' · '+s.name;button.append(caption);
   const svg=make('svg',{viewBox:'0 0 128 128','aria-hidden':'true',focusable:'false'},button),turned=make('g',{},svg);
   const path=(d,fill,parent=turned)=>make('path',{d,fill,stroke:'#080b10','stroke-width':1},parent);
   path('M0-44-54 0H54Z','#e5be68');
   const top=make('text',{x:0,y:-15,'text-anchor':'middle',class:'may-rombo-preview-part'},turned);top.textContent='C';
   s.slots.forEach((slot,i)=>{
    path(i?'M0 0H54L0 44Z':'M-54 0H0V44Z',slot.fill);
    const x=i?18:-18,label=make('text',{x,y:13,'text-anchor':'middle',class:'may-rombo-preview-part'},turned);label.textContent=slot.label;
    const arrow=make('g',{transform:'translate('+x+' 25) scale('+(slot.flip?-1:1)+' 1)'},turned);
    make('path',{d:'M-9 0H9M5-4l4 4-4 4',fill:'none',stroke:'#f9fcff','stroke-width':1.5,'stroke-linecap':'round','stroke-linejoin':'round'},arrow);
    path('M-8 4h5v5Z','#ffe486',arrow);
   });
   make('path',{d:'M-59 0H59',fill:'none',stroke:'#dfe6f5','stroke-width':1,'stroke-dasharray':'4 3'},turned);
   isolate(button);button.addEventListener('click',()=>select(assembly));table.append(button);return {button,turned};
  });
  const footer=doc.createElement('div');footer.className='may-rombo-preview-footer';box.append(footer);
  const controls=doc.createElement('div');controls.className='gz-hx gz-control gz-val may-layer-value may-standard may-rombo-preview-controls';controls.setAttribute('role','group');controls.setAttribute('aria-label','Переключение схемы ромбосборки');
  const mid=doc.createElement('label');mid.className='gz-mid';
  const number=doc.createElement('input');number.type='number';number.min='1';number.max='16';number.step='1';number.setAttribute('aria-label','Номер схемы ромбосборки от 1 до 16');
  const count=doc.createElement('span');count.className='may-layer-axis';count.textContent='/16';mid.append(number);mid.append(count);
  isolate(number);isolate(controls);
  const change=()=>{const current=api(),state=current?.get?.(),value=Number(number.value);if(!box.hidden&&state?.on&&typeof current.setAssembly==='function'&&number.value.trim()&&Number.isFinite(value))current.setAssembly(Math.max(1,Math.min(16,Math.round(value)))-1);sync(true);};
  number.addEventListener('change',change);number.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();change();}});
  const buttons=[-1,1].map(direction=>{
   const button=doc.createElement('button');button.type='button';button.className='gz-a';button.textContent=direction<0?'‹':'›';
   button.title=direction<0?'Предыдущая схема ромбосборки (после первой — шестнадцатая)':'Следующая схема ромбосборки (после шестнадцатой — первая)';button.setAttribute('aria-label',button.title);
   // Native buttons retain Enter/Space activation; isolate all field gestures.
   isolate(button);
   button.addEventListener('click',()=>{const current=api(),state=current?.get?.();if(box.hidden||!state?.on||typeof current.setAssembly!=='function')return;current.setAssembly((describe(state).assembly+direction+16)%16);sync();});
   return button;
  });
  controls.append(buttons[0]);controls.append(mid);controls.append(buttons[1]);win.ZerkControlFrame.attach(controls,buttons[0],mid,buttons[1],{input:number});
  box.append(controls);
  let last='',positionFrame=0,positionKey='',spacer=null,observer=null;
  if(viewport&&figure){
   spacer=doc.createElement('div');spacer.id='mayRomboPreviewSpace';spacer.hidden=true;spacer.setAttribute('aria-hidden','true');viewport.append(spacer);box.style.visibility='hidden';
  }
  function place(){
   positionFrame=0;if(!spacer||box.hidden)return;
   const r=figure.getBoundingClientRect(),v=viewport.getBoundingClientRect(),height=box.offsetHeight,gap=12,left=r.left+r.width/2,top=r.bottom+gap;
   if(!(r.width>0&&r.height>0)){box.style.visibility='hidden';spacer.hidden=true;positionKey='';return;}
   const key=[left,top,height,v.top,v.bottom,v.left,v.right,box.offsetWidth].join(':');if(key===positionKey)return;positionKey=key;
   const width=box.offsetWidth;
   box.style.left=left+'px';box.style.top=top+'px';box.style.visibility='visible';
   box.style.clipPath=`inset(${Math.max(0,v.top-top)}px ${Math.max(0,left+width/2-v.right)}px ${Math.max(0,top+height-v.bottom)}px ${Math.max(0,v.left-(left-width/2))}px)`;
   spacer.style.height=(height+gap*2)+'px';spacer.hidden=false;
  }
  function queuePosition(){if(spacer&&!positionFrame)positionFrame=win.requestAnimationFrame(place);}
  if(spacer){viewport.addEventListener('scroll',queuePosition,{passive:true});win.addEventListener('resize',queuePosition);if(win.ResizeObserver){observer=new win.ResizeObserver(queuePosition);for(const node of [figure,viewport,box])observer.observe(node);}}
  function sync(force=false){
   const current=api(),state=current?.get?.();if(!state){box.hidden=true;if(spacer)spacer.hidden=true;for(const button of [...cells.map(cell=>cell.button),...buttons,number])button.disabled=true;last='';positionKey='';return;}
   const s=describe(state),available=s.on&&typeof current.setAssembly==='function',key=[s.on,s.assembly,s.angle,s.row,available].join(':');if(key===last&&force!==true)return;last=key;box.hidden=!s.on;if(spacer){spacer.hidden=!s.on;queuePosition();}for(const button of [...cells.map(cell=>cell.button),...buttons,number])button.disabled=!available;if(!s.on){positionKey='';return;}
   number.value=String(s.assembly+1);
   footer.textContent='Ось '+s.row+' · '+s.angle+'°';
   for(const cell of cells){cell.button.setAttribute('aria-pressed',String(cell===cells[s.assembly]));cell.turned.setAttribute('transform','translate(64 64) rotate('+s.angle+')');}
   box.setAttribute('aria-label','Ромбо. Сборка '+(s.assembly+1)+' из 16: '+s.name+'. Верх C. Ось: строка '+s.row+'. Поворот '+s.angle+'°. L — левая исходная часть, R — правая, ↔ — горизонтальное отражение.');
  }
  host.append(box);win.addEventListener('may-rombo-change',sync);sync();
  return {sync,element:box,scrollSpace:()=>spacer&&!spacer.hidden?spacer.offsetHeight:0,destroy(){win.removeEventListener('may-rombo-change',sync);viewport?.removeEventListener('scroll',queuePosition);win.removeEventListener('resize',queuePosition);observer?.disconnect();if(positionFrame)win.cancelAnimationFrame(positionFrame);spacer?.remove();box.remove();}};
 }
 return {describe,mount};
});
