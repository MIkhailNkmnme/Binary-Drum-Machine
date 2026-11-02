/* Atlas legend and assembly navigation for the current Rombo. No frame loop. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikRomboPreview=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const choices=['L','R','L↔','R↔'],NS='http://www.w3.org/2000/svg';
 function describe(state){
  const assembly=Math.max(0,Math.min(15,Math.trunc(Number(state.assembly)||0))),slots=[Math.floor(assembly/4),assembly%4];
  const angle=((Math.round((Number(state.angle)||0)/45)*45)%360+360)%360;
  return {assembly,angle,row:state.row,on:!!state.on,slots:slots.map(choice=>({label:choices[choice],flip:choice>=2,fill:choice%2?'#d99bc9':'#78b8e8'})),name:slots.map(choice=>choices[choice]).join(' | ')};
 }
 function mount({document:doc,api,host=doc.body}){
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
  const controls=doc.createElement('div');controls.className='gz-hx gz-pair gz-split may-standard may-standard-pair may-independent-pair may-rombo-preview-controls';controls.setAttribute('role','group');controls.setAttribute('aria-label','Переключение схемы ромбосборки');
  const buttons=[-1,1].map((direction,i)=>{
   const button=doc.createElement('button');button.type='button';button.className='gz-half gz-h'+i;button.setAttribute('data-may-part',String(i));button.textContent=direction<0?'‹ Назад':'Дальше ›';
   button.title=direction<0?'Предыдущая схема ромбосборки (после первой — шестнадцатая)':'Следующая схема ромбосборки (после шестнадцатой — первая)';button.setAttribute('aria-label',button.title);
   // Native buttons retain Enter/Space activation; isolate all field gestures.
   for(const type of ['pointerdown','pointerup','mousedown','mouseup','click','dblclick','contextmenu','keydown','keyup'])button.addEventListener(type,event=>{event.stopPropagation();if(type==='contextmenu'||type==='dblclick')event.preventDefault();});
   button.addEventListener('click',()=>{const current=api(),state=current?.get?.();if(box.hidden||!state?.on||typeof current.setAssembly!=='function')return;current.setAssembly((describe(state).assembly+direction+16)%16);sync();});
   const outline=make('svg',{class:'may-half-outline',viewBox:'0 0 60 24','aria-hidden':'true',focusable:'false'},button);
   make('path',{class:'may-half-face',d:i?'M6 0H48L60 12 48 24H6L0 12Z':'M12 0H54L60 12 54 24H12L0 12Z'},outline);
   make('path',{class:'may-half-side',d:i?'M6 0L0 12 6 24M48 0L60 12 48 24':'M12 0L0 12 12 24M54 0L60 12 54 24'},outline);
   controls.append(button);return button;
  });
  box.append(controls);
  let last='';
  function sync(){
   const current=api(),state=current?.get?.();if(!state){box.hidden=true;for(const button of buttons)button.disabled=true;last='';return;}
   const s=describe(state),available=s.on&&typeof current.setAssembly==='function',key=[s.on,s.assembly,s.angle,s.row,available].join(':');if(key===last)return;last=key;box.hidden=!s.on;for(const button of buttons)button.disabled=!available;if(!s.on)return;
   title.textContent='Сборка '+(s.assembly+1)+' · '+s.name;
   footer.textContent='Ось '+s.row+' · '+s.angle+'°';
   turned.setAttribute('transform','translate(82 86) rotate('+s.angle+')');
   s.slots.forEach((slot,i)=>{parts[i].setAttribute('fill',slot.fill);labels[i].textContent=slot.label;arrows[i].setAttribute('transform','translate('+(i?18:-18)+' 25) scale('+(slot.flip?-1:1)+' 1)');});
   box.setAttribute('aria-label','Ромбо. Сборка '+(s.assembly+1)+' из 16: '+s.name+'. Верх C. Ось: строка '+s.row+'. Поворот '+s.angle+'°. L — левая исходная часть, R — правая, ↔ — горизонтальное отражение.');
  }
  host.append(box);win.addEventListener('may-rombo-change',sync);sync();
  return {sync,element:box,destroy(){win.removeEventListener('may-rombo-change',sync);box.remove();}};
 }
 return {describe,mount};
});
