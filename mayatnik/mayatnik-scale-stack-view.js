/* Scroll-window rendering: every requested height exists, only visible rasters allocate memory. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikScaleStackView=api;})(globalThis,function(){
 'use strict';
 const LIMIT=32*1024*1024;
 function levels(width,height,step,mode='rows',base=2){
  step=Math.max(1,Math.floor(Number(step)||1));base=Math.max(2,Math.min(10000,Math.floor(Number(base)||2)));const result=[];
  const add=rows=>{rows=Math.max(8,Math.floor(rows));if(rows<height&&result.at(-1)?.height!==rows)result.push({height:rows,width:Math.max(1,Math.ceil(width*rows/height-1e-12))});};
  if(mode==='powers'||mode==='multiples'){
   for(let n=1;n<=height;n++){const factor=mode==='powers'?base**n:base*n;add(height/factor);if(factor>=height)break;}
  }else for(let rows=height-step;rows>=8;rows-=step)add(rows);
  if(height>8&&result.at(-1)?.height!==8)add(8);
  return result;
 }

 // Exact residue classes. Padding is outside the source, never an invented bit.
 function phasePlan(width,height,factor,page=0,pageSize=64){
  factor=Math.max(2,Math.min(10000,Math.floor(Number(factor)||2)));
  const total=factor*factor,pages=Math.ceil(total/pageSize);page=Math.max(0,Math.min(pages-1,Math.floor(Number(page)||0)));
  const start=page*pageSize,end=Math.min(total,start+pageSize),items=[];
  for(let index=start;index<end;index++){
   const dx=index%factor,dy=Math.floor(index/factor),validWidth=Math.max(0,Math.ceil((width-dx)/factor)),validHeight=Math.max(0,Math.ceil((height-dy)/factor));
   items.push({key:'phase:'+factor+':'+index,width:Math.ceil(width/factor),height:Math.ceil(height/factor),factor,dx,dy,index,validWidth,validHeight,sourceWidth:width,sourceHeight:height});
  }
  return {factor,total,pages,page,start,end,items};
 }
 function phaseSourceIndex(size,x,y){
  const sx=x*size.factor+size.dx,sy=y*size.factor+size.dy;
  return sx<size.sourceWidth&&sy<size.sourceHeight?sy*size.sourceWidth+sx:-1;
 }

 function create(o){
  const host=o.host,doc=host.ownerDocument,win=doc.defaultView,element=doc.createElement('div');
  element.className='may-scale-stack may-scale-stack--window';element.hidden=true;host.append(element);
  const controls=doc.createElement('div'),input=doc.createElement('input'),list=doc.createElement('div');
  controls.className='may-scale-stack__controls';controls.addEventListener('pointerdown',e=>e.stopPropagation());controls.addEventListener('pointerup',e=>e.stopPropagation());
  const mode=doc.createElement('select'),baseInput=doc.createElement('input');
  const method=doc.createElement('select');method.setAttribute('aria-label','Способ уменьшения');for(const [value,text]of [['phases','Все фазы'],['viewport','Как верхнее'],['canvas','Как на холсте'],['average','Средний цвет']]){const opt=doc.createElement('option');opt.value=value;opt.textContent=text;method.append(opt);}method.value=['phases','viewport','canvas','average'].includes(o.method?.())?o.method():'canvas';

  for(const [value,text]of [['powers','Степени x'],['multiples','Кратно x'],['rows','По строкам']]){const opt=doc.createElement('option');opt.value=value;opt.textContent=text;mode.append(opt);}
  mode.value=o.mode?.()||'rows';mode.setAttribute('aria-label','Вариант уменьшения');baseInput.type='number';baseInput.min='2';baseInput.max='10000';baseInput.step='1';baseInput.value=String(o.base?.()||2);baseInput.setAttribute('aria-label','Число x');baseInput.title='Число x';
  let exporting=false;
  const exportButton=doc.createElement('button');exportButton.type='button';exportButton.textContent='В Гиф-Масштаб';exportButton.title='Перенести все построения в окно Гиф-Масштаб';exportButton.onclick=async()=>{if(!source||exportButton.disabled)return;exporting=true;exportButton.disabled=true;try{await o.onExport?.({mode:mode.value,base:Number(baseInput.value),step:Number(input.value),method:method.value});}finally{exporting=false;exportButton.disabled=['viewport','phases'].includes(method.value);}};
  const heightMode=doc.createElement('select');heightMode.setAttribute('aria-label','Высота нижних построений');heightMode.title='Высота нижних построений';for(const [value,text]of [['original','Высота оригинала'],['cell','Высота ячейки'],['native','Истинный размер'],['integer','Целое ≥ оригинала']]){const opt=doc.createElement('option');opt.value=value;opt.textContent=text;heightMode.append(opt);}heightMode.value=['original','cell','native','integer'].includes(o.heightMode?.())?o.heightMode():'original';
  const field=(control,caption)=>{
   const box=doc.createElement('div');box.className='gz-hx may-standard may-scale-stack__field';
   const content=doc.createElement('label');if(caption){const text=doc.createElement('span');text.className='gz-nm';text.textContent=caption;content.append(text);}content.append(control);
   if(control.tagName==='INPUT'){
    box.classList.add('gz-control');box.style.setProperty('padding','0','important');box.style.setProperty('gap','0','important');
    const sides=[-1,1].map(delta=>{const button=doc.createElement('button');button.type='button';button.className='gz-a';button.textContent=delta<0?'‹':'›';button.setAttribute('aria-label',(delta<0?'Уменьшить':'Увеличить')+' '+(caption==='x'?'число x':caption==='фазы'?'страницу фаз':'шаг строк'));button.onclick=()=>{const min=control.min===''?1:Number(control.min),max=control.max===''?65535:Number(control.max);control.value=String(Math.max(min,Math.min(max,(Number(control.value)||min)+delta)));control.dispatchEvent(new win.Event('change',{bubbles:true}));};return button;});
    box.append(sides[0],content,sides[1]);win.ZerkControlFrame?.attach(box,sides[0],content,sides[1]);
   }else box.append(control);
   return box;
  };
  const stepLabel=doc.createElement('span');stepLabel.textContent='Шаг, строк';const baseField=field(baseInput,'x'),stepField=field(input,'стр');exportButton.classList.add('gz-hx','may-standard');const methodField=field(method),heightField=field(heightMode),sequenceField=field(mode);controls.append(methodField,heightField,sequenceField,baseField,stepField,exportButton);input.type='number';input.min='1';input.step='1';input.value=String(o.stepRows?.()||8);input.setAttribute('aria-label','Шаг высоты нижних треугольников, строк');list.className='may-scale-stack__list';element.append(controls,list);
  const phasePageInput=doc.createElement('input');phasePageInput.type='number';phasePageInput.min='1';phasePageInput.step='1';phasePageInput.value=String(Math.max(0,Number(o.phasePage?.())||0)+1);phasePageInput.setAttribute('aria-label','Страница фаз');
  const phasePageField=field(phasePageInput,'фазы');phasePageField.hidden=true;controls.append(phasePageField);
  const phaseNote=doc.createElement('div');phaseNote.className='may-scale-stack__phase-note';phaseNote.hidden=true;element.insertBefore(phaseNote,list);
  let phasePage=Math.max(0,Math.floor(Number(o.phasePage?.())||0)),phaseInfo=null;
  let enabled=false,destroyed=false,source=null,pending=null,job=null,timer=null,layout={},zoom=1,items=[],revision=0,lastKey,error=null;
  const schedule=o.schedule||(fn=>win.setTimeout(fn,0)),cancel=o.cancel||(id=>win.clearTimeout(id));
  const fmt=n=>Number(n.toFixed(4)).toLocaleString('ru-RU');
  function drop(item){if(item.canvas){item.canvas.width=item.canvas.height=0;item.canvas.remove();item.canvas=null;}if(item.overlay){item.overlay.width=item.overlay.height=0;item.overlay.remove();item.overlay=null;}item.bits=null;item.revision=-1;}
  function clear(){for(const item of items)drop(item);items=[];list.replaceChildren();job=null;}
  function later(){if(timer===null&&!destroyed&&enabled)timer=schedule(tick);}
  function minDisplayZoom(){
   if(method.value==='phases')return 1/512;
   if(!source)return 1/512;const dpr=win.devicePixelRatio||1,p=Number(layout.pixelScale)||1/dpr,w=Number(layout.width)>0?Number(layout.width):source.width*p,h=Number(layout.height)>0?Number(layout.height):w*source.height/source.width;
   let smallest=h;for(const item of heightMode.value==='native'?[]:items){const rows=item.size.height,size=heightMode.value==='original'?h:rows*p*(heightMode.value==='integer'?Math.ceil(source.height/rows):1);smallest=Math.min(smallest,size);}
   return Math.min(512,8/(dpr*Math.max(.000001,smallest)));
  }
  function viewportPlan(rows){
   const Grid=win.MayatnikPixelGrid,dpr=win.devicePixelRatio||1;
   const policy=layout.pixelPolicy||Grid?.policy({width:source.width,height:source.height,dpr,viewport:true,overview:true,minRows:8});
   if(!Grid||!policy?.ok)throw Error(policy?.reason||'Недоступна сетка верхнего поля');
   const density=Number(layout.sourceDensity)||1;
   const cssScale=Grid.snap(rows/source.height*density/policy.dpr,policy);
   const raster=Grid.raster(cssScale,policy);
   if(!raster)throw Error('Не удалось получить масштаб верхнего поля');
   const scale=raster.quality/density,extent=n=>Math.max(1,Math.ceil(n-16*Number.EPSILON*Math.max(1,Math.abs(n))));
   return {key:'viewport:'+rows,requestedHeight:rows,width:extent(source.width*scale),height:extent(source.height*scale),scale,caption:Grid.format(cssScale,policy)};
  }
  function syncPhaseControls(){
   const phases=method.value==='phases',native=phases||method.value==='viewport';
   element.classList.toggle('may-scale-stack--phases',phases);phasePageField.hidden=phaseNote.hidden=!phases;
   heightField.hidden=sequenceField.hidden=phases;mode.disabled=phases;heightMode.disabled=native;
   for(const option of heightMode.options)option.disabled=native;
   baseField.hidden=baseInput.hidden=!phases&&mode.value==='rows';stepField.hidden=stepLabel.hidden=input.hidden=phases||mode.value!=='rows';
   baseInput.setAttribute('aria-label',phases?'Коэффициент целочисленного уменьшения':'Число x');
   baseInput.title=phases?'Целое уменьшение от 2 до 10000; для каждого коэффициента доступны все его фазы':'Число x';
   if(native)heightMode.value='native';
  }
  function phaseGeometry(){
   syncPhaseControls();
   const dpr=win.devicePixelRatio||1,w=Math.max(240,host.clientWidth-16),centre=Number.isFinite(layout.center)?layout.center:(Number(layout.left)||0)+(Number(layout.width)||w)/2;
   element.style.width=w+'px';element.style.marginLeft=Math.max(0,centre-w/2)+'px';controls.style.marginLeft='0px';controls.style.transform='none';
   exportButton.disabled=true;exportButton.title='Все фазы показаны в живой ленте; это набор изображений, а не один GIF.';
   for(const item of items){
    const cw=item.size.width/dpr,ch=item.size.height/dpr;
    item.element.style.width=Math.max(140,cw+8)+'px';item.element.style.height=(ch+56)+'px';item.element.style.paddingTop='0px';item.element.style.marginLeft='0px';
    item.label.textContent='Фаза '+(item.size.index+1)+' · dx='+item.size.dx+', dy='+item.size.dy+(item.empty?' · нет битов':'');
    item.label.title='Исходная клетка: x='+item.size.factor+'×u+'+item.size.dx+', y='+item.size.factor+'×v+'+item.size.dy+'. Размер источника '+source.width+'×'+source.height+'. Настоящих позиций '+item.size.validWidth+'×'+item.size.validHeight+'; остальные клетки дополнения пусты.';
    if(item.axis)item.axis.style.display='none';if(item.axisBand)item.axisBand.style.display='none';if(item.overlay)item.overlay.hidden=true;
    if(item.canvas){Object.assign(item.canvas.style,{width:cw+'px',height:ch+'px',translate:''});item.canvas.style.opacity='';const r=item.canvas.getBoundingClientRect();item.canvas.style.translate=(Math.round(r.left*dpr)/dpr-r.left)+'px '+(Math.round(r.top*dpr)/dpr-r.top)+'px';}
   }
  }
  function geometry(){
   if(!source)return;
   if(method.value==='phases'){phaseGeometry();return;}
   syncPhaseControls();zoom=Math.max(zoom,minDisplayZoom());
   const viewport=method.value==='viewport';heightMode.disabled=viewport;for(const option of heightMode.options)option.disabled=viewport;if(viewport)heightMode.value='native';exportButton.disabled=viewport||exporting;exportButton.title=viewport?'Для «Как верхнее» доступен живой просмотр. Для переноса в Гиф-Масштаб выберите другой способ уменьшения.':'Перенести все построения в окно Гиф-Масштаб';
   const pixelScale=(Number(layout.pixelScale)||1/(win.devicePixelRatio||1))*zoom;
   const width=Number(layout.width)>0?Number(layout.width)*zoom:source.width*pixelScale,height=Number(layout.height)>0?Number(layout.height)*zoom:width*source.height/source.width;
   const centre=Number.isFinite(layout.center)?layout.center:(Number(layout.left)||0)+(Number(layout.width)||source.width)/2;
   element.style.width=width+'px';element.style.marginLeft=(centre-width/2)+'px';
   controls.style.marginLeft=(width*(Number.isFinite(layout.axisFraction)?layout.axisFraction:.5))+'px';controls.style.transform='translateX(-50%)';
   for(const item of items){
    const trueSize=heightMode.value==='native'||heightMode.value==='integer',factor=heightMode.value==='integer'?Math.ceil(source.height/item.size.height):1;
    const cellScale=viewport?1/(win.devicePixelRatio||1):heightMode.value==='native'?1/(win.devicePixelRatio||1):pixelScale;
    const w=viewport?item.size.width/(win.devicePixelRatio||1):trueSize?item.size.width*cellScale*factor:width,h=viewport?item.size.height/(win.devicePixelRatio||1):trueSize||heightMode.value==='cell'?item.size.height*cellScale*factor:height,axis=Number.isFinite(layout.axisFraction)?layout.axisFraction:.5,smallAxis=viewport?source.width*axis*item.size.scale/item.size.width:method.value==='canvas'?source.width*axis*item.size.height/source.height/item.size.width:axis,offset=width*axis-w*smallAxis;
    item.element.style.width=w+'px';item.element.style.marginLeft=offset+'px';item.element.dataset.axisFraction=String(smallAxis);
    const warning=doc.createElement('span');warning.className='may-scale-stack__warning';
    const fractional=viewport?item.size.scale<1:source.width%item.size.width!==0||source.height%item.size.height!==0;
    warning.hidden=!fractional;warning.textContent=viewport?' · Обзор: часть битов пропускается':' · Нецелое число исходных ячеек';
    warning.title=viewport?'Тот же масштаб и выбор по центрам физических пикселей, что у верхнего поля. Высота округлена вверх; исходные биты не изменены.':'Исходных ячеек на одну нижнюю: по ширине '+source.width+'/'+item.size.width+', по высоте '+source.height+'/'+item.size.height;
    const dpr=win.devicePixelRatio||1,screenRows=Math.max(1,Math.ceil(h*dpr-1e-9)),screenColumns=Math.max(1,Math.ceil(w*dpr-1e-9)),screenInfo=screenRows!==item.size.height||screenColumns!==item.size.width?' · сейчас '+screenRows+' строк × '+screenColumns:'';
    item.label.replaceChildren(doc.createTextNode(item.size.height+' строк · ширина '+item.size.width+(viewport?' · масштаб '+item.size.caption+' · запрос '+item.size.requestedHeight+' строк':' · часть ×'+fmt(source.height/item.size.height))+' · показ ×'+fmt(h/item.size.height*dpr)+screenInfo),warning);
    item.headerHeight=Math.max(24,item.label.offsetHeight+8);item.element.style.paddingTop=item.headerHeight+'px';item.element.style.height=(h+item.headerHeight)+'px';
    if(!item.axis){item.axis=doc.createElement('div');item.axis.className='may-scale-stack__axis';item.axis.setAttribute('aria-hidden','true');item.element.append(item.axis);}
    Object.assign(item.axis.style,{display:layout.axisEnabled===false?'none':'',left:(smallAxis*w)+'px',top:item.headerHeight+'px',height:h+'px'});
    if(!item.axisBand){item.axisBand=doc.createElement('div');item.axisBand.className='may-scale-stack__axis-band';item.axisBand.setAttribute('aria-hidden','true');item.element.append(item.axisBand);}
    const center=smallAxis*item.size.width-.5,col=win.MayatnikAxisColumn?.column(center,item.size.width)??null;Object.assign(item.axisBand.style,{display:layout.axisEnabled===false||col===null?'none':'',left:(col*w/item.size.width)+'px',top:item.headerHeight+'px',width:(w/item.size.width)+'px',height:h+'px'});
    if(item.canvas){item.canvas.style.width=w+'px';item.canvas.style.height=h+'px';
     item.canvas.style.translate='';if(viewport){const r=item.canvas.getBoundingClientRect(),d=win.devicePixelRatio||1,shift=(Math.round(r.left*d)/d-r.left)+'px '+(Math.round(r.top*d)/d-r.top)+'px';item.canvas.style.translate=shift;item.axis.style.translate=shift;item.axisBand.style.translate=shift;}else{item.axis.style.translate='';item.axisBand.style.translate='';}
    }
   }
   overlays();
  }
  function overlays(){
   if(method.value==='phases'){for(const item of items)if(item.overlay)item.overlay.hidden=true;return;}
   const hostRect=host.getBoundingClientRect(),dpr=Math.min(2,win.devicePixelRatio||1);
   for(const item of items){if(item.canvas)item.canvas.style.opacity='';if(item.overlay)item.overlay.hidden=true;if(!layout.digits||!item.canvas||!item.bits)continue;
    const rect=item.canvas.getBoundingClientRect(),cw=rect.width/item.size.width,ch=rect.height/item.size.height;if(Math.min(cw,ch)<4)continue;
    const left=Math.max(hostRect.left,rect.left),top=Math.max(hostRect.top,rect.top),right=Math.min(hostRect.right,rect.right),bottom=Math.min(hostRect.bottom,rect.bottom);if(right<=left||bottom<=top)continue;
    if(!item.overlay){item.overlay=doc.createElement('canvas');item.overlay.className='may-scale-stack__digits';item.overlay.setAttribute('aria-hidden','true');item.element.append(item.overlay);}
    const cv=item.overlay,W=Math.max(1,Math.ceil((right-left)*dpr)),H=Math.max(1,Math.ceil((bottom-top)*dpr));const used=(source?.pixels.byteLength||0)+(source?.bits?.byteLength||0)+items.reduce((sum,i)=>sum+(i.canvas?i.canvas.width*i.canvas.height*4:0)+(i.bits?.byteLength||0)+(i!==item&&i.overlay?i.overlay.width*i.overlay.height*4:0),0);if(used+W*H*4>LIMIT)continue;
    cv.hidden=false;if(layout.digitsOnly)item.canvas.style.opacity='0';cv.width=W;cv.height=H;Object.assign(cv.style,{left:(left-rect.left)+'px',top:(item.headerHeight+top-rect.top)+'px',width:(right-left)+'px',height:(bottom-top)+'px'});
    const ctx=cv.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='600 '+Math.max(3,Math.min(cw,ch)*(Number(layout.digitSize)||80)/100)+'px '+(layout.digitFont||'monospace');
    const x0=Math.max(0,Math.floor((left-rect.left)/cw)),x1=Math.min(item.size.width,Math.ceil((right-rect.left)/cw)),y0=Math.max(0,Math.floor((top-rect.top)/ch)),y1=Math.min(item.size.height,Math.ceil((bottom-rect.top)/ch));
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const bit=item.bits[y*item.size.width+x];if(bit===-1)continue;ctx.fillStyle=bit===1?(layout.digitOneColour||'#e8edf5'):bit===0?(layout.digitZeroColour||'#7cbcff'):'#ffcf73';const text=bit===0?'0':bit===1?'1':'·',tx=rect.left-left+(x+.5)*cw,ty=rect.top-top+(y+.5)*ch;if(win.MayatnikBitGlyph)win.MayatnikBitGlyph.draw(ctx,text,tx,ty);else ctx.fillText(text,tx,ty);}
   }
  }
  function rebuild(){
   job=null;if(!source)return;const previous=new Map(items.map(item=>[item.size.key??item.size.height,item]));items=[];input.max=String(Math.max(1,source.height));
   let sizes;
   if(method.value==='phases'){
    phaseInfo=phasePlan(source.width,source.height,Number(baseInput.value),phasePage);phasePage=phaseInfo.page;
    phasePageInput.max=String(phaseInfo.pages);phasePageInput.value=String(phasePage+1);o.onPhasePage?.(phasePage);
    phaseNote.textContent='÷'+phaseInfo.factor+' · '+phaseInfo.total+' фаз · показаны '+(phaseInfo.start+1)+'–'+phaseInfo.end+' · страница '+(phasePage+1)+'/'+phaseInfo.pages+' · 1 клетка = 1 физ. px. Все исходные клетки распределены по фазам; усреднения нет. Лента прокручивается горизонтально.';
    sizes=phaseInfo.items;
   }else sizes=levels(source.width,source.height,Number(input.value),mode.value,Number(baseInput.value));
   if(method.value==='viewport'){const seen=new Set();sizes=sizes.map(size=>viewportPlan(size.height)).filter(size=>{if(seen.has(size.scale))return false;seen.add(size.scale);return true;});}else if(method.value!=='canvas'&&method.value!=='phases')for(const size of sizes)size.width=Math.max(1,Math.round(source.width*size.height/source.height));
   for(const size of sizes){let item=previous.get(size.key??size.height);if(item){previous.delete(size.key??size.height);item.size=size;if(item.canvas&&(item.canvas.width!==size.width||item.canvas.height!==size.height))drop(item);item.revision=-1;}else{const el=doc.createElement('div'),label=doc.createElement('span');el.className='may-scale-stack__level';label.className='may-scale-stack__label';el.append(label);item={element:el,label,size,canvas:null,revision:-1};}list.append(item.element);items.push(item);}
   for(const item of previous.values()){drop(item);item.element.remove();}
   geometry();
  }
  function visible(){const rect=host.getBoundingClientRect(),strip=list.getBoundingClientRect(),phases=method.value==='phases';return items.filter(item=>{const r=item.element.getBoundingClientRect();return r.bottom>=rect.top-100&&r.top<=rect.bottom+100&&(!phases||r.right>=Math.max(rect.left,strip.left)-100&&r.left<=Math.min(rect.right,strip.right)+100);});}
  function fail(e){error=e;enabled=false;source=pending=null;clear();element.hidden=true;o.onError?.(e);}
  function tick(){
   timer=null;if(!enabled||destroyed)return;
   try{
    // Complete a visible paint before accepting another frame; playback cannot starve it.
    if(!job&&pending&&(!source||visible().every(item=>item.revision===revision))){const next=pending;pending=null;const s=next.source||o.captureSource?.();
     if(!s||!Number.isSafeInteger(s.width)||!Number.isSafeInteger(s.height)||s.width<1||s.height<1||!ArrayBuffer.isView(s.pixels)||s.pixels.byteLength!==s.width*s.height*4||s.pixels.byteOffset%4!==0||s.pixels.length!==s.width*s.height*4)throw Error('Повреждён кадр масштабов под полем');
     if(s.pixels.byteLength+(s.bits?.byteLength||0)>LIMIT/2)throw Error('Для масштабов под полем недостаточно памяти');
     const changed=!source||source.width!==s.width||source.height!==s.height;source=s;lastKey=next.key;revision++;if(changed)rebuild();
    }
    if(!source)return;
    const shown=visible(),set=new Set(shown);for(const item of items)if(!set.has(item))drop(item);
    if(job&&!set.has(job.item))job=null;
    if(!job){const item=shown.find(item=>item.revision!==revision);if(item){
     const bytes=source.pixels.byteLength+(source.bits?.byteLength||0)+items.reduce((sum,i)=>sum+(i.canvas?i.canvas.width*i.canvas.height*4:0),0)+item.size.width*item.size.height*12;
     if(bytes>(method.value==='phases'?64*1024*1024:LIMIT))throw Error('Для видимого масштаба недостаточно памяти');
     job={item,at:0,pixels:new Uint8ClampedArray(item.size.width*item.size.height*4)};
    }}
    if(job){const {item,pixels}=job,{width,height}=item.size,ratio=method.value==='viewport'?item.size.scale:height/source.height,end=['canvas','phases'].includes(method.value)?Math.min(width*height,job.at+1048576):width*height;
     const output=new Uint32Array(pixels.buffer),input=new Uint32Array(source.pixels.buffer,source.pixels.byteOffset,source.width*source.height);
     if(method.value==='canvas')for(let i=job.at;i<end;i++){const x=i%width,y=Math.floor(i/width),sx=Math.floor((x+.5)/ratio),sy=Math.floor((y+.5)/ratio);if(sx<source.width&&sy<source.height)output[i]=input[sy*source.width+sx];}
     if(method.value==='phases')for(let i=job.at;i<end;i++){const q=phaseSourceIndex(item.size,i%width,Math.floor(i/width));if(q>=0)output[i]=input[q];}
     if(method.value==='viewport'){
      const sample=win.MayatnikPixelExactHost?.sampleViewport;if(!sample)throw Error('Модуль верхнего поля не загружен');
      const sampled=sample({width:source.width,height:source.height,data:source.pixels},width,height,{scale:ratio,x:0,y:0});pixels.set(sampled.data);
     }
     if(!['canvas','viewport','phases'].includes(method.value)){const reduce=o.reduce||win.MayatnikGifScale?.reduce;if(!reduce)throw Error('Модуль уменьшения не загружен');const reduced=reduce(source.pixels,source.width,source.height,height,method.value,source.bits);pixels.set(reduced.pixels);job.bits=reduced.bits;}
     job.at=end;if(end<width*height){later();return;}
     if(!item.canvas){item.canvas=doc.createElement('canvas');item.canvas.className='may-scale-stack__canvas';item.element.append(item.canvas);}
     if(source.bits&&!job.bits){job.bits=new Int8Array(width*height).fill(-1);for(let q=0;q<job.bits.length;q++){if(method.value==='phases'){const at=phaseSourceIndex(item.size,q%width,Math.floor(q/width));if(at>=0)job.bits[q]=source.bits[at];}else{const sx=Math.floor((q%width+.5)/ratio),sy=Math.floor((Math.floor(q/width)+.5)/ratio);if(sx<source.width&&sy<source.height)job.bits[q]=source.bits[sy*source.width+sx];}}}item.bits=job.bits||null;item.empty=method.value==='phases'&&!!item.bits&&!item.bits.some(value=>value!==-1);const cv=item.canvas;cv.width=width;cv.height=height;const ctx=cv.getContext('2d'),image=ctx.createImageData(width,height);image.data.set(pixels);ctx.putImageData(image,0,0);item.revision=revision;job=null;geometry();o.onPaint?.({key:lastKey,levels:shown.map(i=>i.size)});
    }
    error=null;if(pending||shown.some(item=>item.revision!==revision))later();
   }catch(e){fail(e);}
  }
  function requestFrame(s,meta={}){if(!enabled||destroyed)return false;pending={source:job?undefined:s,key:meta.key};later();return true;}
  function refreshLayout(value={}){try{const before=JSON.stringify([layout.pixelPolicy,layout.sourceDensity]);layout={...layout,...value};if(source&&method.value==='viewport'&&before!==JSON.stringify([layout.pixelPolicy,layout.sourceDensity]))rebuild();else geometry();later();}catch(e){fail(e);}}
  function setZoom(value){zoom=Math.max(minDisplayZoom(),Math.min(512,Number(value)||1));geometry();later();return zoom;}
  function setEnabled(value){if(destroyed)return false;const next=!!value;if(next===enabled)return enabled;enabled=next;element.hidden=!enabled;if(enabled){input.value=String(o.stepRows?.()||input.value);const selectedHeight=o.heightMode?.();if(['original','cell','native','integer'].includes(selectedHeight))heightMode.value=selectedHeight;requestFrame();}else{if(timer!==null)cancel(timer);timer=null;source=pending=null;clear();zoom=1;}return enabled;}
  function change(){const step=Math.max(1,Math.min(Number(input.max)||65535,Math.floor(Number(input.value)||1)));input.value=String(step);o.onStepRows?.(step);rebuild();later();}
  function sequenceChange(){if(!['rows','powers','multiples'].includes(mode.value))mode.value='rows';baseInput.value=String(Math.max(2,Math.min(10000,Math.floor(Number(baseInput.value)||2))));phasePage=0;syncPhaseControls();o.onSequence?.({mode:mode.value,base:Number(baseInput.value)});rebuild();later();}
  syncPhaseControls();
  heightMode.addEventListener('change',()=>{o.onHeightMode?.(heightMode.value);geometry();later();});
  method.addEventListener('change',()=>{phasePage=0;if(!['viewport','phases'].includes(method.value))heightMode.value=o.heightMode?.()||'original';o.onMethod?.(method.value);try{rebuild();later();}catch(e){fail(e);}});
  mode.addEventListener('change',sequenceChange);baseInput.addEventListener('change',sequenceChange);
  input.addEventListener('change',change);
  phasePageInput.addEventListener('change',()=>{phasePage=Math.max(0,Math.floor(Number(phasePageInput.value)||1)-1);try{rebuild();list.scrollLeft=0;later();}catch(e){fail(e);}});
  list.addEventListener('scroll',()=>later(),{passive:true});
  const scroll=()=>{overlays();later();};host.addEventListener('scroll',scroll,{passive:true});win.addEventListener('resize',scroll);
  function destroy(){setEnabled(false);destroyed=true;host.removeEventListener('scroll',scroll);win.removeEventListener('resize',scroll);element.remove();}
  return {element,setEnabled,requestFrame,refreshLayout,setZoom,getZoom:()=>zoom,destroy,inspect:()=>({enabled,destroyed,busy:!!job,pending:!!pending,canvases:items.filter(i=>i.canvas).length,levels:items.length,canvasBytes:items.reduce((sum,i)=>sum+(i.canvas?i.canvas.width*i.canvas.height*4:0)+(i.bits?.byteLength||0)+(i.overlay?i.overlay.width*i.overlay.height*4:0),0),key:lastKey,error})};
 }
 return {create,levels,phasePlan,phaseSourceIndex};
});
