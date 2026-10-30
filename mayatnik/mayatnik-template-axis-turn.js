/* Template-local half turns. Source pixels and their provenance never move. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikTemplateAxisTurn=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const PURPLE='#b48cff',SIZE=24;
  const DEFINITIONS=[['centerH','h','центральной горизонтальной'],['centerV','v','центральной вертикальной'],['top','h','верхней граничной'],['right','v','правой граничной'],['bottom','h','нижней граничной'],['left','v','левой граничной']];
  function bounds(rects){
    if(!rects.length)return null;
    const x=Math.min(...rects.map(r=>r.x)),y=Math.min(...rects.map(r=>r.y)),right=Math.max(...rects.map(r=>r.x+r.width)),bottom=Math.max(...rects.map(r=>r.y+r.height));
    return [x,y,right,bottom].every(Number.isFinite)&&right>x&&bottom>y?{x,y,width:right-x,height:bottom-y}:null;
  }
  function axes(box,manual){
    if(!box)return [];
    const values={centerH:box.y+box.height/2,centerV:box.x+box.width/2,top:box.y,right:box.x+box.width,bottom:box.y+box.height,left:box.x};
    const out=DEFINITIONS.map(([id,direction,name])=>({id,direction,position:values[id],title:'Повернуть шаблон на 180° вокруг '+name+' оси'}));
    for(const [id,direction,name]of [['manualH','h','ручной горизонтальной'],['manualV','v','ручной вертикальной']])if(manual?.[id]?.visible&&Number.isFinite(manual[id].position))out.push({id,direction,position:manual[id].position,manual:true,title:'Повернуть шаблон на 180° вокруг '+name+' оси'});
    return out;
  }
  function validFrame(frame,pose){
    const b=frame?.box;
    return !!b&&[b.x,b.y,b.width,b.height].every(Number.isFinite)&&b.width>0&&b.height>0&&Array.isArray(frame.pose)&&frame.pose.length===pose.length&&frame.pose.every((v,i)=>v===pose[i]);
  }
  function frameBox(previous,box,pose){return validFrame(previous?.fixedFrame,pose)?previous.fixedFrame.box:box;}
  function freezeFrame(previous,box,pose){
    if(validFrame(previous?.fixedFrame,pose))return previous;
    return {...previous,fixedFrame:{box:{...box},pose:[...pose]}};
  }
  function toggleManual(previous,box,id){
    if(!box||!['manualH','manualV'].includes(id))return previous;
    if(!previous?.manualH&&!previous?.manualV)return {...previous,manualH:{visible:true,position:box.y+box.height/2},manualV:{visible:true,position:box.x+box.width/2}};
    const initial=id==='manualH'?box.y+box.height/2:box.x+box.width/2,old=previous[id];
    return {...previous,[id]:{position:Number.isFinite(old?.position)?old.position:initial,visible:!old?.visible}};
  }
  function moveManual(previous,id,position){return previous?.[id]&&Number.isFinite(position)?{...previous,[id]:{...previous[id],position}}:previous;}
  function operation(value){return value==='xor'||value==='and'?value:'';}
  function toggleOperation(previous,requested){const op=operation(requested);return op?{...previous,operation:operation(previous?.operation)===op?'':op}:previous;}
  function rebaseFrame(previous,box,pose){const frame=previous?.fixedFrame;return {...previous,fixedFrame:{box:{...(frame?.box||box)},pose:[...pose]}};}
  // Extra contributions keep the other operand's real source addresses. The
  // primary source remains sourceOrigin/sourceIndices for ordinary transforms.
  // No derived pixel retains a librarySource proof of an unmodified source bit.
  function sourceContributions(part,q){
    const out=part.sourceOrigin?[{origin:part.sourceOrigin,index:part.sourceIndices?.[q]??q,proof:part.sourceOrigin.compositionSourceProof||part.sourceOrigin.librarySource||part.librarySource}]:[];
    for(const record of part.compositionSources||[]){const a=record.pairs;let lo=0,hi=a.length/2;while(lo<hi){const mid=(lo+hi)>>1;if(a[mid*2]<q)lo=mid+1;else hi=mid;}for(let i=lo*2;i<a.length&&a[i]===q;i+=2)out.push({origin:record.origin,index:a[i+1],proof:record.origin.compositionSourceProof});}
    return out;
  }
  function remapCompositionSources(records,newToOld,mask){
    if(!records?.length)return undefined;const inverse=new Map();for(let q=0;q<newToOld.length;q++){if(mask&&!mask[q])continue;const old=newToOld[q];if(!inverse.has(old))inverse.set(old,[]);inverse.get(old).push(q);}
    return records.map(record=>{const pairs=[];for(let i=0;i<record.pairs.length;i+=2)for(const q of inverse.get(record.pairs[i])||[])pairs.push([q,record.pairs[i+1]]);pairs.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);return {origin:record.origin,pairs:Uint32Array.from(pairs.flat())};}).filter(r=>r.pairs.length);
  }
  function semanticParts(parts,read){return prepareParts(parts).map(part=>{
    if(part.bitsData)return part;const bitsData=new Int8Array(part.mask.data.length).fill(-1);
    for(let q=0;q<bitsData.length;q++)if(part.mask.data[q]){const bit=read(part,q);if(bit!==-1&&bit!==0&&bit!==1)throw Error('Для операции нужны сохранённые значения битов шаблона');bitsData[q]=bit;}
    return {...part,bitsData};
  });}
  function compose(oldParts,oldRects,turnedParts,turnedRects,op,{zero=0xff202020,one=0xffffffff,clipWidth=Infinity,maxPixels=12e6}={}){
    op=operation(op);if(!op)throw Error('Не выбрана операция шаблона');const box=bounds([...oldRects,...turnedRects]);if(!box)throw Error('Нет геометрии шаблона');
    const x=Math.floor(box.x),y=Math.floor(box.y),w=Math.max(1,Math.ceil(box.x+box.width)-x),h=Math.max(1,Math.ceil(box.y+box.height)-y),size=w*h;if(!Number.isSafeInteger(size)||size>maxPixels)throw Error('Результат слишком большой — приблизьте ось к шаблону');
    const origins=new Map(),groups=new Map();
    const origin=(o,proof)=>{if(!origins.has(o.key)){const copy={...o},saved=proof||o.compositionSourceProof||o.librarySource;if(saved)copy.compositionSourceProof=saved;delete copy.librarySource;origins.set(o.key,copy);}return origins.get(o.key);};
    function sample(parts,rects,px,py){for(let i=parts.length-1;i>=0;i--){const p=parts[i],r=rects[i],m=p.mask;if(px<r.x||py<r.y||px>=r.x+r.width||py>=r.y+r.height)continue;const q=Math.floor((py-r.y)/r.height*m.height)*m.width+Math.floor((px-r.x)/r.width*m.width),bit=p.bitsData?.[q];if(m.data[q]&&(bit===0||bit===1))return {part:p,q,bit};}return null;}
    function group(o,proof){o=origin(o,proof);if(!groups.has(o.key))groups.set(o.key,{origin:o,data:new Uint32Array(size),bits:new Int8Array(size).fill(-1),indices:new Uint32Array(size),extra:new Map(),count:0});return groups.get(o.key);}
    for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){
      const a=sample(oldParts,oldRects,x+xx+.5,y+yy+.5),b=sample(turnedParts,turnedRects,x+xx+.5,y+yy+.5);if(op==='and'?(!a||!b):(!a&&!b))continue;
      const bit=a&&b?(op==='xor'?a.bit^b.bit:a.bit&b.bit):(b||a).bit,contributions=[],seen=new Set();
      for(const v of [b,a])if(v)for(const c of sourceContributions(v.part,v.q)){const key=c.origin.key+':'+c.index;if(!seen.has(key)){seen.add(key);contributions.push(c);}}
      if(!contributions.length)throw Error('У результата нет исходных адресов шаблона');const primary=contributions[0],g=group(primary.origin,primary.proof),q=yy*w+xx;g.data[q]=((bit?one:zero)|0xff000000)>>>0;g.bits[q]=bit;g.indices[q]=primary.index;g.count++;
      for(const c of contributions.slice(1)){const o=origin(c.origin,c.proof);if(!g.extra.has(o.key))g.extra.set(o.key,{origin:o,pairs:[]});g.extra.get(o.key).pairs.push(q,c.index);}
    }
    // Empty AND keeps a geometric frame so the active controls and Undo remain.
    if(!groups.size){const first=oldParts[0]||turnedParts[0];if(!first?.sourceOrigin)throw Error('Нет исходной маски шаблона');group(first.sourceOrigin);}
    return [...groups.values()].map(g=>({mask:{x,y,width:w,height:h,data:g.data,count:g.count},axis:x+w/2,axisOriginY:y,p:-1,ox:0,axisClipWidth:Number.isFinite(clipWidth)?clipWidth:Math.max(1,x+w),sourceOrigin:g.origin,sourceIndices:g.indices,sourceData:g.data,bitsData:g.bits,librarySource:null,compositionSources:[...g.extra.values()].map(r=>({origin:r.origin,pairs:Uint32Array.from(r.pairs)})),canvas:null,bitCanvas:null,edges:null}));
  }
  let sourceSerial=0;
  function prepareParts(parts){return parts.map(part=>part.sourceOrigin?part:{...part,sourceOrigin:{key:'axis-source:'+Date.now()+':'+(++sourceSerial),mask:{...part.mask,data:part.sourceData||part.mask.data},axis:part.axis,ox:part.ox,p:part.p},sourceIndices:Uint32Array.from({length:part.mask.data.length},(_,i)=>i)});}
  // flipParts owns pixel orientation; this step reflects part placement as ONE
  // figure, including the gaps between its parts. No source array is mutated.
  function placeReflected(parts,rects,axis,clipWidth){
    return parts.map((part,i)=>{
      const r=rects[i],m=part.mask,horizontal=axis.direction==='v',sx=r.width/m.width,sy=r.height/m.height,viewX=r.x-(part.axis+(m.x-part.axis)*sx),originY=part.axisOriginY??m.y,viewY=r.y-(originY+(m.y-originY)*sy);
      const sourceOrigin=part.sourceOrigin||{mask:{...part.mask,data:part.sourceData||part.mask.data},axis:part.axis,ox:part.ox,p:part.p};
      const nextAxis=horizontal?2*axis.position-part.axis-2*viewX:part.axis,nextY=horizontal?originY:2*axis.position-originY-2*viewY;
      return {...part,sourceOrigin,mask:{...m,x:horizontal?nextAxis-(m.x-part.axis)-m.width:m.x,y:horizontal?m.y:nextY-(m.y-originY)-m.height},axis:nextAxis,axisOriginY:nextY,ox:0,p:-1,axisClipWidth:clipWidth};
    });
  }
  function originalPart(part){return part.sourceOrigin?{...part,...part.sourceOrigin}:part;}
  function validatePart(part){
    if(part.axisClipWidth!=null&&(!Number.isFinite(part.axisClipWidth)||part.axisClipWidth<=0))throw Error('Повреждена область шаблона');
    if(part.axisOriginY!=null&&!Number.isFinite(part.axisOriginY))throw Error('Повреждено начало шаблона');
    if(!part.sourceOrigin){if(part.sourceIndices!=null||part.compositionSources?.length)throw Error('Нет исходной маски шаблона');return;}
    const o=part.sourceOrigin,m=o.mask;if(!m||typeof o.key!=='string'||o.key.length>200||!Number.isFinite(m.x)||!Number.isFinite(m.y)||!Number.isFinite(o.axis)||!Number.isFinite(o.ox)||!Number.isInteger(m.width)||!Number.isInteger(m.height)||m.width<1||m.height<1||m.width*m.height>100e6||!(m.data instanceof Uint32Array)||m.data.length!==m.width*m.height||!(part.sourceIndices instanceof Uint32Array)||part.sourceIndices.length!==part.mask.data.length||part.sourceIndices.some(q=>q>=m.data.length))throw Error('Повреждены исходные адреса шаблона');
    if(part.compositionSources!=null){if(!Array.isArray(part.compositionSources))throw Error('Повреждены адреса операции шаблона');for(const record of part.compositionSources){const origin=record?.origin,source=origin?.mask,pairs=record?.pairs;if(!origin||typeof origin.key!=='string'||origin.key.length>200||!source||![source.x,source.y,origin.axis,origin.ox].every(Number.isFinite)||!Number.isInteger(source.width)||!Number.isInteger(source.height)||source.width<1||source.height<1||source.width*source.height>100e6||!(source.data instanceof Uint32Array)||source.data.length!==source.width*source.height||!(pairs instanceof Uint32Array)||pairs.length%2)throw Error('Повреждены адреса операции шаблона');let last=0;for(let i=0;i<pairs.length;i+=2){if(pairs[i]<last||pairs[i]>=part.mask.data.length||pairs[i+1]>=source.data.length)throw Error('Повреждены адреса операции шаблона');last=pairs[i];}}}
  }
  function libraryParts(parts,anchor){return parts.map(p=>({x:p.mask.x-anchor,y:p.mask.y,width:p.mask.width,height:p.mask.height,axis:p.axis-anchor,axisOriginY:p.axisOriginY,data:Array.from(p.mask.data),bits:p.bitsData?Array.from(p.bitsData):null}));}
  function libraryPreview(parts,rects,rk,anchor,viewX=0,viewY=0){
    const box=bounds(rects),g=grid(parts,rects,box);if(!g||g.w*g.h>12e6)return null;
    const data=new Uint32Array(g.w*g.h);
    for(let i=0;i<parts.length;i++){const p=parts[i],m=p.mask,o=g.offsets[i];for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++){const colour=m.data[y*m.width+x];if(colour)data[(o.y+y)*g.w+o.x+x]=colour;}}
    return {width:g.w,height:g.h,y:box.y-viewY,center:(box.x+box.width/2-viewX)/rk-anchor,data:Array.from(data)};
  }
  function fromLibrary(parts,factor,anchor,clipWidth){
    if(!Array.isArray(parts)||!parts.length||parts.length>100000)throw Error('Повреждён состав шаблона');let total=0;
    return parts.map(src=>{if(!Number.isInteger(src.width)||!Number.isInteger(src.height)||src.width<1||src.height<1||!Number.isFinite(src.x)||!Number.isFinite(src.y)||!Number.isFinite(src.axis)||!Array.isArray(src.data)||src.data.length!==src.width*src.height||src.bits&&(!Array.isArray(src.bits)||src.bits.length!==src.data.length||src.bits.some(b=>![-1,0,1].includes(b))))throw Error('Повреждена часть шаблона');
      const width=Math.max(1,Math.round(src.width*factor)),height=Math.max(1,Math.round(src.height*factor));total+=width*height;if(total>12e6)throw Error('Большой шаблон');
      const data=new Uint32Array(width*height),bitsData=src.bits?new Int8Array(width*height):null;let count=0;
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){const q=Math.min(src.height-1,Math.floor(y/factor))*src.width+Math.min(src.width-1,Math.floor(x/factor)),j=y*width+x;data[j]=src.data[q];if(data[j])count++;if(bitsData)bitsData[j]=src.bits[q];}
      return {mask:{x:anchor+src.x*factor,y:src.y*factor,width,height,data,count},axis:anchor+src.axis*factor,...(Number.isFinite(src.axisOriginY)?{axisOriginY:src.axisOriginY*factor}:{}),p:-1,ox:0,axisClipWidth:clipWidth,...(bitsData?{bitsData}:{})};
    });
  }
  function grid(parts,rects,box){
    if(!parts.length||!box)return null;
    const sx=rects[0].width/parts[0].mask.width,sy=rects[0].height/parts[0].mask.height,w=box.width/sx,h=box.height/sy,near=v=>Math.abs(v-Math.round(v))<1e-7;
    if(!(sx>0&&sy>0)||!near(w)||!near(h))return null;
    const cells=new Map(),offsets=[];
    for(let i=0;i<parts.length;i++){
      const p=parts[i],m=p.mask,r=rects[i],x=(r.x-box.x)/sx,y=(r.y-box.y)/sy;
      if(Math.abs(r.width/m.width-sx)>1e-7||Math.abs(r.height/m.height-sy)>1e-7||!near(x)||!near(y))return null;
      const ox=Math.round(x),oy=Math.round(y);offsets.push({x:ox,y:oy});
      for(let yy=0;yy<m.height;yy++)for(let xx=0;xx<m.width;xx++){const q=yy*m.width+xx;if(!m.data[q])continue;const key=(oy+yy)*Math.round(w)+ox+xx,bit=p.bitsData?p.bitsData[q]:null;
        if(cells.has(key)&&cells.get(key)!==bit)return null;cells.set(key,bit);}
    }
    return {sx,sy,w:Math.round(w),h:Math.round(h),cells,offsets};
  }
  function symmetricGrid(g,axis,box){
    if(!g||Math.abs(axis.position-(axis.direction==='v'?box.x+box.width/2:box.y+box.height/2))>1e-7)return false;
    for(const [q,bit]of g.cells){const x=q%g.w,y=Math.floor(q/g.w),other=axis.direction==='v'?y*g.w+g.w-1-x:(g.h-1-y)*g.w+x;if(!g.cells.has(other)||g.cells.get(other)!==bit)return false;}
    return g.cells.size>0;
  }
  // Reflect each half inside its own strip. On odd grids the central row or
  // column stays untouched. Splitting a multipart mask preserves exact source
  // pixel addresses, even after another half turn, save/restore, or source lift.
  function insideOut(parts,rects,axis,clipWidth){
    const box=bounds(rects);if(!box||Math.abs(axis.position-(axis.direction==='v'?box.x+box.width/2:box.y+box.height/2))>1e-7)return null;
    const g=grid(parts,rects,box);if(!symmetricGrid(g,axis,box))return null;
    const horizontal=axis.direction==='v',length=horizontal?g.w:g.h,half=Math.floor(length/2),right=length-half,result=[];
    const bands=[[0,half,true],[half,right,false],[right,length,true]];
    for(let i=0;i<parts.length;i++){
      const p=parts[i],m=p.mask,r=rects[i],offset=g.offsets[i],start=horizontal?offset.x:offset.y,extent=horizontal?m.width:m.height;
      for(const [lo,hi,flip]of bands){const a=Math.max(start,lo),b=Math.min(start+extent,hi);if(b<=a)continue;
        // Retain the full half-strip, including empty outer cells, so the next
        // press uses the same geometric frame and inside-out is an involution.
        const w=horizontal?hi-lo:m.width,h=horizontal?m.height:hi-lo,data=new Uint32Array(w*h),bits=p.bitsData?new Int8Array(w*h).fill(-1):null,indices=new Uint32Array(w*h),working=p.compositionSources?.length?new Uint32Array(w*h):null;let count=0;
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){const u=horizontal?(flip?hi-1-x:lo+x)-start:x,v=horizontal?y:(flip?hi-1-y:lo+y)-start;if(u<0||v<0||u>=m.width||v>=m.height)continue;const q=v*m.width+u,j=y*w+x;data[j]=m.data[q];if(data[j])count++;if(bits)bits[j]=p.bitsData[q];indices[j]=p.sourceIndices?p.sourceIndices[q]:q;if(working)working[j]=q;}
        if(!count)continue;
        const dest=lo,targetX=horizontal?box.x+dest*g.sx:r.x,targetY=horizontal?r.y:box.y+dest*g.sy,viewX=r.x-(p.axis+(m.x-p.axis)*g.sx),oldY=p.axisOriginY??m.y,viewY=r.y-(oldY+(m.y-oldY)*g.sy),commonX=box.x+box.width/2-viewX,commonY=box.y-viewY,mx=commonX+(targetX-viewX-commonX)/g.sx,my=commonY+(targetY-viewY-commonY)/g.sy;
        result.push({...p,mask:{...m,x:mx,y:my,width:w,height:h,data,count},axis:commonX,axisOriginY:commonY,ox:0,p:-1,axisClipWidth:clipWidth,sourceData:data,sourceIndices:indices,...(bits?{bitsData:bits}:{}),...(working?{compositionSources:remapCompositionSources(p.compositionSources,working,data)}:{}),canvas:null,bitCanvas:null,edges:null});
      }
    }
    return result;
  }
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  // Controls stay on an axis whenever there is room. Small masks use alternating
  // ends and staggered extension lengths; only viewport edges need a leader.
  function layout(box,list,width,height){
    const used=[],margin=SIZE/2+3,step=SIZE+6,left=box.x,right=box.x+box.width,top=box.y,bottom=box.y+box.height;
    return list.map((axis,index)=>{
      const h=axis.direction==='h',at=axis.position,near=h?left:top,far=h?right:bottom,limit=h?width:height;
      let best=null;
      for(let n=0;n<14;n++)for(const sign of [index%2?-1:1,index%2?1:-1]){
        const along=sign>0?far+margin+n*step:near-margin-n*step;
        const x=clamp(h?along:at,margin,Math.max(margin,width-margin)),y=clamp(h?at:along,margin,Math.max(margin,height-margin));
        const collisions=used.filter(p=>Math.abs(p.x-x)<step&&Math.abs(p.y-y)<step).length;
        const covers=x>left-margin&&x<right+margin&&y>top-margin&&y<bottom+margin;
        const cost=collisions*1e6+(covers?10000:0)+Math.abs((h?x:y)-along)*10+n*step;
        if(!best||cost<best.cost)best={x,y,cost};
      }
      // At an edge several parallel axes can coincide after clamping. A short
      // leader frees the buttons without changing the true geometric axis.
      if(used.some(p=>Math.abs(p.x-best.x)<step&&Math.abs(p.y-best.y)<step)){
        for(let n=1;n<12;n++)for(const sign of [-1,1]){
          const x=clamp(best.x+(h?0:sign*n*step),margin,Math.max(margin,width-margin)),y=clamp(best.y+(h?sign*n*step:0),margin,Math.max(margin,height-margin));
          if(!used.some(p=>Math.abs(p.x-x)<step&&Math.abs(p.y-y)<step)){best={x,y,cost:0};n=12;break;}
        }
      }
      used.push(best);
      const a=h?[clamp(left,0,width),at]:[at,clamp(top,0,height)],b=h?[clamp(right,0,width),at]:[at,clamp(bottom,0,height)];
      const along=h?best.x:best.y;if(along<near)a[h?0:1]=along;else if(along>far)b[h?0:1]=along;
      return {...axis,button:{x:best.x,y:best.y},a,b,leader:h?[best.x,at]:[at,best.y],outside:at<0||at>(h?height:width),limit};
    });
  }
  function mount(options){
    const doc=options.document||document,host=doc.createElement('div'),svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');
    host.className='may-template-axis-controls may-layer-service';host.setAttribute('aria-label','Оси выбранного шаблона');host.setAttribute('data-no-mini','');host.append(svg);doc.body.append(host);
    const buttons=new Map(),handles=new Map();let current=null,drag=null;
    function swallow(e){e.stopPropagation();}
    function finish(e,cancel=false){if(!drag||e.pointerId!==drag.pointerId)return;const d=drag;drag=null;try{d.node.releasePointerCapture(e.pointerId);}catch(_){}options.endMove?.(cancel);e.preventDefault();e.stopPropagation();}
    function handle(axis){
      if(handles.has(axis.id))return handles.get(axis.id);
      const node=doc.createElementNS(svg.namespaceURI,'line');node.classList.add('may-template-axis-grab');node.setAttribute('tabindex','0');node.setAttribute('role','slider');node.setAttribute('aria-label',axis.direction==='h'?'Переместить горизонтальную ось шаблона':'Переместить вертикальную ось шаблона');node.setAttribute('aria-orientation',axis.direction==='h'?'vertical':'horizontal');svg.append(node);handles.set(axis.id,node);
      node.addEventListener('pointerdown',e=>{if(e.button!==0||!current)return;options.beginMove?.();drag={pointerId:e.pointerId,id:axis.id,node};node.setPointerCapture(e.pointerId);node.focus();e.preventDefault();e.stopPropagation();});
      node.addEventListener('pointermove',e=>{if(!drag||drag.pointerId!==e.pointerId||!current)return;const vertical=axis.direction==='v',coordinate=(vertical?e.clientX-current.left-current.ox:e.clientY-current.top-current.oy)/current.factor;options.move(axis.id,coordinate);e.preventDefault();e.stopPropagation();});
      node.addEventListener('pointerup',e=>finish(e));node.addEventListener('pointercancel',e=>finish(e,true));node.addEventListener('lostpointercapture',e=>finish(e,true));
      node.addEventListener('keydown',e=>{if(e.key==='Escape'&&drag){finish({pointerId:drag.pointerId,preventDefault(){},stopPropagation(){}},true);return;}const direction=axis.direction==='v'?(e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0):(e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0);if(!direction||!current)return;const value=current.axes.find(a=>a.id===axis.id);if(!value)return;options.beginMove?.();options.move(axis.id,value.position+direction*current.rk*(e.shiftKey?1:.5));options.endMove?.(false);e.preventDefault();e.stopPropagation();});
      return node;
    }
    function button(axis){
      if(buttons.has(axis.id))return buttons.get(axis.id);
      const node=doc.createElement('button');node.type='button';node.className='may-template-axis-turn';node.dataset.templateAxis=axis.id;node.title=axis.title;node.setAttribute('aria-label',axis.title);
      node.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path class="axis-turn-face" d="M12 1 23 12 12 23 1 12Z"/><path class="axis-turn-hover" d="m6 6-5 6 5 6m12-12 5 6-5 6"/><path class="axis-turn-icon" d="M7 13a5 5 0 1 0 2-5M6 5v5h5"/></svg>';
      for(const name of ['pointerdown','pointerup','dblclick','contextmenu','keydown'])node.addEventListener(name,swallow);
      node.addEventListener('click',e=>{e.stopPropagation();options.turn(axis.id);});host.append(node);buttons.set(axis.id,node);return node;
    }
    function hide(){host.hidden=true;current=null;if(drag){options.endMove?.(true);drag=null;}}
    function render(ctx,state){
      if(!state?.box||state.width<SIZE+6||state.height<SIZE+6){hide();return;}
      current=state;host.hidden=false;Object.assign(host.style,{left:state.left+'px',top:state.top+'px',width:state.width+'px',height:state.height+'px'});svg.setAttribute('width',state.width);svg.setAttribute('height',state.height);
      const screenBox={x:state.ox+state.box.x*state.factor,y:state.oy+state.box.y*state.factor,width:state.box.width*state.factor,height:state.box.height*state.factor},list=state.axes.map(a=>({...a,position:(a.direction==='h'?state.oy:state.ox)+a.position*state.factor})),placed=layout(screenBox,list,state.width,state.height),active=new Set(list.map(a=>a.id));
      for(const [id,node]of buttons)node.hidden=!active.has(id);for(const [id,node]of handles)node.style.display=active.has(id)?'':'none';
      ctx.save();ctx.strokeStyle=PURPLE;ctx.lineWidth=1;ctx.globalAlpha=1;ctx.setLineDash([4,3]);ctx.beginPath();
      for(const a of placed){
        if(!a.outside){ctx.moveTo(...a.a);ctx.lineTo(...a.b);ctx.moveTo(...a.leader);ctx.lineTo(a.button.x,a.button.y);}
        const node=button(a);node.hidden=false;node.style.left=(a.button.x-SIZE/2)+'px';node.style.top=(a.button.y-SIZE/2)+'px';
        if(a.manual){const grab=handle(a);grab.style.display=a.outside?'none':'';for(const [key,value]of Object.entries({x1:a.a[0],y1:a.a[1],x2:a.b[0],y2:a.b[1],'aria-valuenow':state.axes.find(v=>v.id===a.id).position/state.rk}))grab.setAttribute(key,value);}
      }
      ctx.stroke();ctx.restore();
    }
    return {render,hide,destroy(){hide();host.remove();},host};
  }
  return {bounds,axes,frameBox,freezeFrame,toggleManual,moveManual,operation,toggleOperation,rebaseFrame,sourceContributions,remapCompositionSources,semanticParts,compose,prepareParts,placeReflected,originalPart,validatePart,libraryParts,libraryPreview,fromLibrary,grid,symmetricGrid,insideOut,layout,mount};
});
