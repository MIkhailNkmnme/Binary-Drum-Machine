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

 function create(o){
  const host=o.host,doc=host.ownerDocument,win=doc.defaultView,element=doc.createElement('div');
  element.className='may-scale-stack may-scale-stack--window';element.hidden=true;host.append(element);
  const controls=doc.createElement('label'),input=doc.createElement('input'),list=doc.createElement('div');
  controls.className='may-scale-stack__controls';controls.addEventListener('pointerdown',e=>e.stopPropagation());controls.addEventListener('pointerup',e=>e.stopPropagation());
  const mode=doc.createElement('select'),baseInput=doc.createElement('input');
  const method=doc.createElement('select');method.setAttribute('aria-label','Способ уменьшения');for(const [value,text]of [['canvas','Как на холсте'],['average','Средний цвет']]){const opt=doc.createElement('option');opt.value=value;opt.textContent=text;method.append(opt);}method.value=['canvas','average'].includes(o.method?.())?o.method():'canvas';

  for(const [value,text]of [['powers','Степени x'],['multiples','Кратно x'],['rows','По строкам']]){const opt=doc.createElement('option');opt.value=value;opt.textContent=text;mode.append(opt);}
  mode.value=o.mode?.()||'rows';mode.setAttribute('aria-label','Вариант уменьшения');baseInput.type='number';baseInput.min='2';baseInput.max='10000';baseInput.step='1';baseInput.value=String(o.base?.()||2);baseInput.setAttribute('aria-label','Число x');baseInput.title='Число x';
  const exportButton=doc.createElement('button');exportButton.type='button';exportButton.textContent='В Гиф-Масштаб';exportButton.title='Перенести все построения в окно Гиф-Масштаб';exportButton.onclick=async()=>{if(!source||exportButton.disabled)return;exportButton.disabled=true;try{await o.onExport?.({mode:mode.value,base:Number(baseInput.value),step:Number(input.value),method:method.value});}finally{exportButton.disabled=false;}};
  const stepLabel=doc.createElement('span');stepLabel.textContent='Шаг, строк';controls.append(method,mode,baseInput,stepLabel,input,exportButton);input.type='number';input.min='1';input.step='1';input.value=String(o.stepRows?.()||8);input.setAttribute('aria-label','Шаг высоты нижних треугольников, строк');list.className='may-scale-stack__list';element.append(controls,list);
  let enabled=false,destroyed=false,source=null,pending=null,job=null,timer=null,layout={},zoom=1,items=[],revision=0,lastKey,error=null;
  const schedule=o.schedule||(fn=>win.setTimeout(fn,0)),cancel=o.cancel||(id=>win.clearTimeout(id));
  const fmt=n=>Number(n.toFixed(4)).toLocaleString('ru-RU');
  function drop(item){if(item.canvas){item.canvas.width=item.canvas.height=0;item.canvas.remove();item.canvas=null;}if(item.overlay){item.overlay.width=item.overlay.height=0;item.overlay.remove();item.overlay=null;}item.bits=null;item.revision=-1;}
  function clear(){for(const item of items)drop(item);items=[];list.replaceChildren();job=null;}
  function later(){if(timer===null&&!destroyed&&enabled)timer=schedule(tick);}
  function geometry(){
   if(!source)return;
   const pixelScale=(Number(layout.pixelScale)||1/(win.devicePixelRatio||1))*zoom;
   const width=Number(layout.width)>0?Number(layout.width)*zoom:source.width*pixelScale,height=Number(layout.height)>0?Number(layout.height)*zoom:width*source.height/source.width;
   const centre=Number.isFinite(layout.center)?layout.center:(Number(layout.left)||0)+(Number(layout.width)||source.width)/2;
   element.style.width=width+'px';element.style.marginLeft=(centre-width/2)+'px';
   for(const item of items){const w=width,h=item.size.height*pixelScale,axis=Number.isFinite(layout.axisFraction)?layout.axisFraction:.5,smallAxis=method.value==='canvas'?source.width*axis*item.size.height/source.height/item.size.width:axis,offset=width*(axis-smallAxis);item.element.style.width=w+'px';item.element.style.height=(h+24)+'px';item.element.style.marginLeft=offset+'px';item.element.dataset.axisFraction=String(smallAxis);if(!item.axis){item.axis=doc.createElement('div');item.axis.className='may-scale-stack__axis';item.axis.setAttribute('aria-hidden','true');item.element.append(item.axis);}Object.assign(item.axis.style,{display:layout.axisEnabled===false?'none':'',left:(smallAxis*w)+'px',height:h+'px'});item.label.textContent=item.size.height+' строк · часть ×'+fmt(source.height/item.size.height)+' · показ ×'+fmt(pixelScale*(win.devicePixelRatio||1));if(item.canvas){item.canvas.style.width=w+'px';item.canvas.style.height=h+'px';}}
   overlays();
  }
  function overlays(){
   const hostRect=host.getBoundingClientRect(),dpr=Math.min(2,win.devicePixelRatio||1);
   for(const item of items){if(item.overlay)item.overlay.hidden=true;if(!layout.digits||!item.canvas||!item.bits)continue;
    const rect=item.canvas.getBoundingClientRect(),cw=rect.width/item.size.width,ch=rect.height/item.size.height;if(Math.min(cw,ch)<4)continue;
    const left=Math.max(hostRect.left,rect.left),top=Math.max(hostRect.top,rect.top),right=Math.min(hostRect.right,rect.right),bottom=Math.min(hostRect.bottom,rect.bottom);if(right<=left||bottom<=top)continue;
    if(!item.overlay){item.overlay=doc.createElement('canvas');item.overlay.className='may-scale-stack__digits';item.overlay.setAttribute('aria-hidden','true');item.element.append(item.overlay);}
    const cv=item.overlay,W=Math.max(1,Math.ceil((right-left)*dpr)),H=Math.max(1,Math.ceil((bottom-top)*dpr));const used=(source?.pixels.byteLength||0)+(source?.bits?.byteLength||0)+items.reduce((sum,i)=>sum+(i.canvas?i.canvas.width*i.canvas.height*4:0)+(i.bits?.byteLength||0)+(i!==item&&i.overlay?i.overlay.width*i.overlay.height*4:0),0);if(used+W*H*4>LIMIT)continue;
    cv.hidden=false;cv.width=W;cv.height=H;Object.assign(cv.style,{left:(left-rect.left)+'px',top:(24+top-rect.top)+'px',width:(right-left)+'px',height:(bottom-top)+'px'});
    const ctx=cv.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=Math.max(3,Math.min(cw*.75,ch*(Number(layout.digitSize)||80)/100))+'px '+(layout.digitFont||'monospace');
    const x0=Math.max(0,Math.floor((left-rect.left)/cw)),x1=Math.min(item.size.width,Math.ceil((right-rect.left)/cw)),y0=Math.max(0,Math.floor((top-rect.top)/ch)),y1=Math.min(item.size.height,Math.ceil((bottom-rect.top)/ch));
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const bit=item.bits[y*item.size.width+x];if(bit===-1)continue;ctx.fillStyle=bit===1?(layout.digitOneColour||'#e8edf5'):bit===0?(layout.digitZeroColour||'#7cbcff'):'#ffcf73';const text=bit===0?'0':bit===1?'1':'·',tx=rect.left-left+(x+.5)*cw,ty=rect.top-top+(y+.5)*ch;if(win.MayatnikBitGlyph)win.MayatnikBitGlyph.draw(ctx,text,tx,ty);else ctx.fillText(text,tx,ty);}
   }
  }
  function rebuild(){
   job=null;if(!source)return;const previous=new Map(items.map(item=>[item.size.height,item]));items=[];input.max=String(Math.max(1,source.height));
   const sizes=levels(source.width,source.height,Number(input.value),mode.value,Number(baseInput.value));if(method.value!=='canvas')for(const size of sizes)size.width=Math.max(1,Math.round(source.width*size.height/source.height));
   for(const size of sizes){let item=previous.get(size.height);if(item){previous.delete(size.height);item.size=size;if(item.canvas&&(item.canvas.width!==size.width||item.canvas.height!==size.height))drop(item);item.revision=-1;}else{const el=doc.createElement('div'),label=doc.createElement('span');el.className='may-scale-stack__level';label.className='may-scale-stack__label';el.append(label);item={element:el,label,size,canvas:null,revision:-1};}list.append(item.element);items.push(item);}
   for(const item of previous.values()){drop(item);item.element.remove();}
   geometry();
  }
  function visible(){const rect=host.getBoundingClientRect();return items.filter(item=>{const r=item.element.getBoundingClientRect();return r.bottom>=rect.top-100&&r.top<=rect.bottom+100;});}
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
     if(bytes>LIMIT)throw Error('Для видимого масштаба недостаточно памяти');
     job={item,at:0,pixels:new Uint8ClampedArray(item.size.width*item.size.height*4)};
    }}
    if(job){const {item,pixels}=job,{width,height}=item.size,ratio=height/source.height,end=method.value==='canvas'?Math.min(width*height,job.at+1048576):width*height;
     const output=new Uint32Array(pixels.buffer),input=new Uint32Array(source.pixels.buffer,source.pixels.byteOffset,source.width*source.height);
     if(method.value==='canvas')for(let i=job.at;i<end;i++){const x=i%width,y=Math.floor(i/width),sx=Math.floor((x+.5)/ratio),sy=Math.floor((y+.5)/ratio);if(sx<source.width&&sy<source.height)output[i]=input[sy*source.width+sx];}
     if(method.value!=='canvas'){const reduce=o.reduce||win.MayatnikGifScale?.reduce;if(!reduce)throw Error('Модуль уменьшения не загружен');const reduced=reduce(source.pixels,source.width,source.height,height,method.value,source.bits);pixels.set(reduced.pixels);job.bits=reduced.bits;}
     job.at=end;if(end<width*height){later();return;}
     if(!item.canvas){item.canvas=doc.createElement('canvas');item.canvas.className='may-scale-stack__canvas';item.element.append(item.canvas);}
     if(source.bits&&!job.bits){job.bits=new Int8Array(width*height).fill(-1);for(let q=0;q<job.bits.length;q++){const sx=Math.floor((q%width+.5)/ratio),sy=Math.floor((Math.floor(q/width)+.5)/ratio);if(sx<source.width&&sy<source.height)job.bits[q]=source.bits[sy*source.width+sx];}}item.bits=job.bits||null;const cv=item.canvas;cv.width=width;cv.height=height;const ctx=cv.getContext('2d'),image=ctx.createImageData(width,height);image.data.set(pixels);ctx.putImageData(image,0,0);item.revision=revision;job=null;geometry();o.onPaint?.({key:lastKey,levels:shown.map(i=>i.size)});
    }
    error=null;if(pending||shown.some(item=>item.revision!==revision))later();
   }catch(e){fail(e);}
  }
  function requestFrame(s,meta={}){if(!enabled||destroyed)return false;pending={source:job?undefined:s,key:meta.key};later();return true;}
  function refreshLayout(value={}){layout={...layout,...value};geometry();later();}
  function setZoom(value){zoom=Math.max(1/Math.max(1,source?.width||1,source?.height||1),Math.min(512,Number(value)||1));geometry();later();return zoom;}
  function setEnabled(value){if(destroyed)return false;const next=!!value;if(next===enabled)return enabled;enabled=next;element.hidden=!enabled;if(enabled){input.value=String(o.stepRows?.()||input.value);requestFrame();}else{if(timer!==null)cancel(timer);timer=null;source=pending=null;clear();zoom=1;}return enabled;}
  function change(){const step=Math.max(1,Math.min(Number(input.max)||65535,Math.floor(Number(input.value)||1)));input.value=String(step);o.onStepRows?.(step);rebuild();later();}
  function sequenceChange(){if(!['rows','powers','multiples'].includes(mode.value))mode.value='rows';baseInput.value=String(Math.max(2,Math.min(10000,Math.floor(Number(baseInput.value)||2))));baseInput.hidden=mode.value==='rows';stepLabel.hidden=input.hidden=mode.value!=='rows';o.onSequence?.({mode:mode.value,base:Number(baseInput.value)});rebuild();later();}
  baseInput.hidden=mode.value==='rows';stepLabel.hidden=input.hidden=mode.value!=='rows';
  method.addEventListener('change',()=>{o.onMethod?.(method.value);rebuild();later();});
  mode.addEventListener('change',sequenceChange);baseInput.addEventListener('change',sequenceChange);
  input.addEventListener('change',change);
  const scroll=()=>{overlays();later();};host.addEventListener('scroll',scroll,{passive:true});win.addEventListener('resize',scroll);
  function destroy(){setEnabled(false);destroyed=true;host.removeEventListener('scroll',scroll);win.removeEventListener('resize',scroll);element.remove();}
  return {element,setEnabled,requestFrame,refreshLayout,setZoom,getZoom:()=>zoom,destroy,inspect:()=>({enabled,destroyed,busy:!!job,pending:!!pending,canvases:items.filter(i=>i.canvas).length,levels:items.length,canvasBytes:items.reduce((sum,i)=>sum+(i.canvas?i.canvas.width*i.canvas.height*4:0)+(i.bits?.byteLength||0)+(i.overlay?i.overlay.width*i.overlay.height*4:0),0),key:lastKey,error})};
 }
 return {create,levels};
});
