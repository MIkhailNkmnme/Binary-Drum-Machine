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
  const svg=make('svg',{viewBox:'0 0 164 174','aria-hidden':'true',focusable:'false'});
  const title=make('text',{x:82,y:11,'text-anchor':'middle',class:'may-rombo-preview-caption'},svg);
  const turned=make('g',{},svg);
  const path=(d,fill,parent=turned)=>make('path',{d,fill,stroke:'#080b10','stroke-width':1},parent);
  path('M0-44-54 0H54Z','#e5be68');
  const top=make('text',{x:0,y:-15,'text-anchor':'middle',class:'may-rombo-preview-part'},turned);top.textContent='C';
  const parts=[path('M-54 0H0V44Z','#78b8e8'),path('M0 0H54L0 44Z','#78b8e8')];
  const labels=[],arrows=[];
  for(const x of [-18,18]){
   labels.push(make('text',{x,y:13,'text-anchor':'middle',class:'may-rombo-preview-part'},turned));
   const arrow=make('g',{},turned);arrows.push(arrow);
   make('path',{d:'M-9 0H9M5-4l4 4-4 4',fill:'none',stroke:'#f9fcff','stroke-width':1.5,'stroke-linecap':'round','stroke-linejoin':'round'},arrow);
   path('M-8 4h5v5Z','#ffe486',arrow);
  }
  make('path',{d:'M-59 0H59',fill:'none',stroke:'#dfe6f5','stroke-width':1,'stroke-dasharray':'4 3'},turned);
  const footer=make('text',{x:82,y:168,'text-anchor':'middle',class:'may-rombo-preview-caption'},svg);
  const controls=doc.createElement('div');controls.className='gz-hx gz-control gz-val may-layer-value may-standard may-rombo-preview-controls';controls.setAttribute('role','group');controls.setAttribute('aria-label','Переключение схемы ромбосборки');
  const mid=doc.createElement('label');mid.className='gz-mid';
  const number=doc.createElement('input');number.type='number';number.min='1';number.max='16';number.step='1';number.setAttribute('aria-label','Номер схемы ромбосборки от 1 до 16');
  const count=doc.createElement('span');count.className='may-layer-axis';count.textContent='/16';mid.append(number);mid.append(count);
  const isolate=node=>{for(const type of ['pointerdown','pointerup','mousedown','mouseup','click','dblclick','contextmenu','keydown','keyup'])node.addEventListener(type,event=>{event.stopPropagation();if(type==='contextmenu'||type==='dblclick')event.preventDefault();});};
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
   const current=api(),state=current?.get?.();if(!state){box.hidden=true;if(spacer)spacer.hidden=true;for(const button of [...buttons,number])button.disabled=true;last='';positionKey='';return;}
   const s=describe(state),available=s.on&&typeof current.setAssembly==='function',key=[s.on,s.assembly,s.angle,s.row,available].join(':');if(key===last&&force!==true)return;last=key;box.hidden=!s.on;if(spacer){spacer.hidden=!s.on;queuePosition();}for(const button of [...buttons,number])button.disabled=!available;if(!s.on){positionKey='';return;}
   title.textContent='Сборка '+(s.assembly+1)+' · '+s.name;
   number.value=String(s.assembly+1);
   footer.textContent='Ось '+s.row+' · '+s.angle+'°';
   turned.setAttribute('transform','translate(82 86) rotate('+s.angle+')');
   s.slots.forEach((slot,i)=>{parts[i].setAttribute('fill',slot.fill);labels[i].textContent=slot.label;arrows[i].setAttribute('transform','translate('+(i?18:-18)+' 25) scale('+(slot.flip?-1:1)+' 1)');});
   box.setAttribute('aria-label','Ромбо. Сборка '+(s.assembly+1)+' из 16: '+s.name+'. Верх C. Ось: строка '+s.row+'. Поворот '+s.angle+'°. L — левая исходная часть, R — правая, ↔ — горизонтальное отражение.');
  }
  host.append(box);win.addEventListener('may-rombo-change',sync);sync();
  return {sync,element:box,scrollSpace:()=>spacer&&!spacer.hidden?spacer.offsetHeight:0,destroy(){win.removeEventListener('may-rombo-change',sync);viewport?.removeEventListener('scroll',queuePosition);win.removeEventListener('resize',queuePosition);observer?.disconnect();if(positionFrame)win.cancelAnimationFrame(positionFrame);spacer?.remove();box.remove();}};
 }
 return {describe,mount};
});
