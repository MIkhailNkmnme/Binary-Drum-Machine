/* Every preview polygon comes from the same source plan as the rendered Rombo. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikRomboPreview=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const NS='http://www.w3.org/2000/svg',identity=[1,0,0,1,0,0];
 const point=(m,p)=>({x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]});
 function geometry(plan){
  const parts=(plan?.parts||[]).map(part=>({...part,points:(part.outline||[]).map(p=>point(plan.rotation||identity,point(part.matrix||identity,p)))})).filter(part=>part.points.length>=3);
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const part of parts)for(const p of part.points){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}
  const width=parts.length?maxX-minX:0,height=parts.length?maxY-minY:0,pad=Math.max(width,height)*.035||1;
  return {parts,viewBox:parts.length?[minX-pad,minY-pad,width+2*pad,height+2*pad]:[0,0,1,1],fontSize:Math.max(width,height)*.12||1};
 }
 function mount({document:doc,api,host=doc.body,viewport=null,figure=null,fallbackFigure=null}){
  const win=doc.defaultView,box=doc.createElement('div');box.id='mayRomboPreview';box.hidden=true;box.setAttribute('role','group');box.setAttribute('data-no-mini','');
  const make=(tag,attrs={},parent=box)=>{const el=doc.createElementNS(NS,tag);for(const [key,value]of Object.entries(attrs))el.setAttribute(key,String(value));parent.append(el);return el;};
  const isolate=node=>{for(const type of ['pointerdown','pointerup','mousedown','mouseup','click','dblclick','contextmenu','keydown','keyup'])node.addEventListener(type,event=>{event.stopPropagation();if(type==='contextmenu'||type==='dblclick')event.preventDefault();});};
  const options=()=>api()?.options?.()||[];
  const select=id=>{const current=api(),state=current?.get?.(),entry=options().find(option=>option.id===id);if(box.hidden||!state?.on||!entry||entry.available===false||typeof current.setAssembly!=='function')return;current.setAssembly(id);sync(true);};
  const table=doc.createElement('div');table.className='may-rombo-preview-table';table.setAttribute('role','group');box.append(table);
  let cells=[];
  function rebuild(entries){
   for(const cell of cells)cell.button.remove();
   cells=entries.map((entry,index)=>{const button=doc.createElement('button');button.type='button';button.className='may-rombo-preview-cell';
    const caption=doc.createElement('span');caption.className='may-rombo-preview-caption';caption.textContent=String(index+1);button.append(caption);
    const svg=make('svg',{'aria-hidden':'true',focusable:'false'},button);isolate(button);button.addEventListener('click',()=>select(entry.id));table.append(button);return {id:entry.id,button,svg};
   });
  }
  function draw(cell,plan){
   for(const child of [...cell.svg.children])child.remove();
   const g=geometry(plan);cell.svg.setAttribute('viewBox',g.viewBox.join(' '));
   for(const part of g.parts){
    make('polygon',{points:part.points.map(p=>p.x+','+p.y).join(' '),fill:part.color||'#e5be68',stroke:'#080b10','stroke-width':g.fontSize*.045},cell.svg);
    const x=part.points.reduce((v,p)=>v+p.x,0)/part.points.length,y=part.points.reduce((v,p)=>v+p.y,0)/part.points.length;
    const label=make('text',{x,y,'text-anchor':'middle','dominant-baseline':'central','font-size':g.fontSize,class:'may-rombo-preview-part'},cell.svg);label.textContent=part.quadrant?String(part.quadrant):(part.sourceKey||'')+(/↔/.test(part.label||'')?'↔':'');
    const title=make('title',{},label);title.textContent=part.label||part.sourceKey||'';
   }
   if(plan?.axis?.length===2){const axis=plan.axis.map(p=>point(plan.rotation||identity,p));make('path',{d:'M'+axis[0].x+' '+axis[0].y+'L'+axis[1].x+' '+axis[1].y,fill:'none',stroke:'#fff4b5','stroke-width':g.fontSize*.05,'stroke-dasharray':g.fontSize*.18+' '+g.fontSize*.12},cell.svg);}
  }
  const footer=doc.createElement('div');footer.className='may-rombo-preview-footer';box.append(footer);
  const controls=doc.createElement('div');controls.className='gz-hx gz-control gz-val may-layer-value may-standard may-rombo-preview-controls';controls.setAttribute('role','group');controls.setAttribute('aria-label','Переключение схемы ромбосборки');
  const mid=doc.createElement('label');mid.className='gz-mid';
  const number=doc.createElement('input');number.type='number';number.min='1';number.step='1';
  const count=doc.createElement('span');count.className='may-layer-axis';mid.append(number);mid.append(count);isolate(number);isolate(controls);
  const change=()=>{const entries=options(),value=Number(number.value);if(number.value.trim()&&Number.isFinite(value)&&entries.length)select(entries[Math.max(0,Math.min(entries.length-1,Math.round(value)-1))].id);sync(true);};
  number.addEventListener('change',change);number.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();change();}});
  const buttons=[-1,1].map(direction=>{
   const button=doc.createElement('button');button.type='button';button.className='gz-a';button.textContent=direction<0?'‹':'›';button.title=direction<0?'Предыдущая доступная схема ромбосборки':'Следующая доступная схема ромбосборки';button.setAttribute('aria-label',button.title);isolate(button);
   button.addEventListener('click',()=>{const entries=options(),index=entries.findIndex(entry=>entry.id===api()?.get?.().assembly);for(let step=1;step<=entries.length;step++){const target=entries[(index+direction*step+entries.length*2)%entries.length];if(target.available!==false){select(target.id);break;}}});return button;
  });
  controls.append(buttons[0]);controls.append(mid);controls.append(buttons[1]);win.ZerkControlFrame.attach(controls,buttons[0],mid,buttons[1],{input:number});box.append(controls);
  let last='',positionFrame=0,positionKey='',spacer=null,observer=null;
  if(viewport&&figure){
   spacer=doc.createElement('div');spacer.id='mayRomboPreviewSpace';spacer.hidden=true;spacer.setAttribute('aria-hidden','true');viewport.append(spacer);box.style.visibility='hidden';
  }
  function place(){
   positionFrame=0;if(!spacer||box.hidden)return;
   const primary=figure.getBoundingClientRect(),r=primary.width>0&&primary.height>0?primary:fallbackFigure?.getBoundingClientRect()||primary,v=viewport.getBoundingClientRect(),height=box.offsetHeight,gap=12,left=r.left+r.width/2,top=r.bottom+gap;
   if(!(r.width>0&&r.height>0)){box.style.visibility='hidden';spacer.hidden=true;positionKey='';return;}
   const key=[left,top,height,v.top,v.bottom,v.left,v.right,box.offsetWidth].join(':');if(key===positionKey)return;positionKey=key;
   const width=box.offsetWidth;
   box.style.left=left+'px';box.style.top=top+'px';box.style.visibility='visible';
   box.style.clipPath=`inset(${Math.max(0,v.top-top)}px ${Math.max(0,left+width/2-v.right)}px ${Math.max(0,top+height-v.bottom)}px ${Math.max(0,v.left-(left-width/2))}px)`;
   spacer.style.height=(height+gap*2)+'px';spacer.hidden=false;
  }
  function queuePosition(){if(spacer&&!positionFrame)positionFrame=win.requestAnimationFrame(place);}
  if(spacer){viewport.addEventListener('scroll',queuePosition,{passive:true});win.addEventListener('resize',queuePosition);if(win.ResizeObserver){observer=new win.ResizeObserver(queuePosition);for(const node of [figure,fallbackFigure,viewport,box])if(node)observer.observe(node);}}
  function sync(force=false){
   const current=api(),state=current?.get?.(),entries=options(),plans=entries.map(entry=>current?.plan?.(entry.id));
   const writable=!!state?.on&&typeof current?.setAssembly==='function',key=JSON.stringify([state,entries,plans,writable]);if(key===last&&force!==true)return;last=key;
   if(cells.length!==entries.length||cells.some((cell,index)=>cell.id!==entries[index].id))rebuild(entries);
   box.hidden=!state?.on||state?.mode==='custom';for(const control of [...buttons,number])control.disabled=!writable||!entries.some(entry=>entry.available!==false);
   if(spacer){spacer.hidden=box.hidden;queuePosition();}if(box.hidden)positionKey='';
   const index=entries.findIndex(entry=>entry.id===state?.assembly),selected=entries[index];number.value=index<0?'':String(index+1);number.max=String(entries.length);number.setAttribute('aria-label','Номер схемы ромбосборки от 1 до '+entries.length);count.textContent='/'+entries.length;
   table.setAttribute('aria-label','Все '+entries.length+' схем ромбосборки');footer.textContent=state?'Ось '+state.row+' · '+state.angle+'°'+(selected?.available===false||state.available===false?' · '+(selected?.reason||state.reason||'Сборка недоступна'):''):'';
   cells.forEach((cell,i)=>{const entry=entries[i],plan=plans[i],available=entry.available!==false&&plan?.available!==false;cell.button.disabled=!writable||!available;cell.button.setAttribute('aria-pressed',String(i===index));cell.button.title='Сборка '+(i+1)+': '+entry.label+(!available?' — '+(entry.reason||plan?.reason||'Недоступна'):'');cell.button.setAttribute('aria-label',cell.button.title);draw(cell,plan);});
   box.setAttribute('aria-label','Ромбо. Сборка '+(index+1)+' из '+entries.length+': '+(selected?.label||'')+'. Ось: строка '+(state?.row||'')+'. Поворот '+(state?.angle||0)+'°.');
  }
  host.append(box);win.addEventListener('may-rombo-change',sync);sync();
  return {sync,element:box,scrollSpace:()=>spacer&&!spacer.hidden?spacer.offsetHeight:0,destroy(){win.removeEventListener('may-rombo-change',sync);viewport?.removeEventListener('scroll',queuePosition);win.removeEventListener('resize',queuePosition);observer?.disconnect();if(positionFrame)win.cancelAnimationFrame(positionFrame);spacer?.remove();box.remove();}};
 }
 return {geometry,mount};
});
