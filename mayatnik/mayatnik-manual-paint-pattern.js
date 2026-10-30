/* Exact pattern propagation from explicitly recorded manual paint.
 * No template/library or automatic-paint state is inferred here. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikManualPaintPattern=api;})(globalThis,function(){
  'use strict';
  function size(width,height){if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||!Number.isSafeInteger(width*height))throw Error('Неверный размер поля');return width*height;}
  function abort(){const error=Error('Поле или ручная краска изменились — поиск отменён');error.name='AbortError';return error;}
  function cell(value,n){
    if(!value||!Number.isSafeInteger(value.q)||value.q<0||value.q>=n||!Number.isInteger(value.colour)||value.colour<0||value.colour>0xffffffff)throw Error('Неверная клетка ручной краски');
    if(value.colour!==0&&value.bit!==0&&value.bit!==1)throw Error('Ручная краска должна указывать исходный бит 0 или 1');
    return {q:value.q,bit:value.bit,colour:value.colour>>>0};
  }
  // An immutable provenance update. A zero colour removes manual ownership.
  // The host supplies changes only for actual manual painting/erasing gestures.
  function record(previous,changes,{width=previous?.width,height=previous?.height}={}){
    const n=size(width,height),map=new Map();
    if(previous){if(previous.width!==width||previous.height!==height)throw Error('Ручная краска относится к другому размеру поля');for(const raw of previous.cells||[]){const c=cell(raw,n);if(c.colour)map.set(c.q,c);}}
    for(const raw of changes){const c=cell(raw,n);if(c.colour)map.set(c.q,c);else map.delete(c.q);}
    return {width,height,cells:[...map.values()].sort((a,b)=>a.q-b.q)};
  }
  async function find(field,sample,options={}){
    const {width:W,height:H,data}=field,n=size(W,H),mode=options.mode||'same',step=options.step??1;
    if(!Number.isSafeInteger(step)||step<1)throw Error('Неверный шаг переноса образца');
    if(!data||data.length!==n)throw Error('Размер полного снимка поля не совпадает');
    if(mode!=='same'&&mode!=='mirror')throw Error('Неизвестный способ поиска ручной краски');
    const source=record(sample,[],{width:W,height:H});if(!source.cells.length)throw Error('Нет образца ручной краски. Раскрасьте биты вручную; старая и автоматическая краска не становятся образцом.');
    const cancelled=options.cancelled||(()=>false),yieldTask=options.yieldTask||(()=>new Promise(resolve=>setTimeout(resolve,0))),now=options.now||(()=>performance.now()),budget=options.budgetMs??8;
    const check=()=>{if(cancelled())throw abort();};check();
    const paint=new Uint32Array(n),manual=new Map(source.cells.map(c=>[c.q,c.colour]));let conflicts=null,collisions=0,selectedCount=0,matches=0,scanned=0,operations=0,yields=0,first=null,start=now();
    const due=()=>{check();return now()-start>=budget;};
    const pause=async()=>{await yieldTask();yields++;check();start=now();};
    const conflict=q=>{if(!conflicts)conflicts=new Uint8Array(Math.ceil(n/8));const b=1<<(q%8),i=Math.floor(q/8);if(!(conflicts[i]&b)){conflicts[i]|=b;collisions++;}};
    const put=(q,colour)=>{
      // Original manual colours win, then the first row-major match wins.
      const protectedColour=manual.get(q),chosen=protectedColour||colour;
      if(protectedColour&&protectedColour!==colour)conflict(q);
      if(!paint[q]){paint[q]=chosen;selectedCount++;}else if(paint[q]!==colour)conflict(q);
    };
    if(mode==='mirror'){
      // axisX is the actual continuous axis coordinate in full-field cell units.
      // Cell c has centre c+.5; never replace this axis by width/2 or round it.
      const axisFor=typeof options.axisX==='function'?options.axisX:()=>options.axisX;
      for(const c of source.cells){const row=Math.floor(c.q/W),axis=axisFor(c.q%W,row);if(!Number.isFinite(axis)||!Number.isInteger(2*axis))throw Error('Ось должна проходить через центры клеток или между ними');const target=2*axis-1-c.q%W;scanned++;
        if(target>=0&&target<W){const q=row*W+target;if(data[q]===c.bit){put(q,c.colour);matches++;if(!first)first={c:target,r:row};}}
        if(++operations>=8192){operations=0;if(due())await pause();}
      }
    }else{
      let x0=W,x1=-1,y0=H,y1=-1;for(const c of source.cells){const x=c.q%W,y=Math.floor(c.q/W);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
      const width=x1-x0+1,height=y1-y0+1,cells=source.cells.map(c=>({...c,offset:(Math.floor(c.q/W)-y0)*W+c.q%W-x0}));
      // Only explicitly painted cells constrain a match. Holes in their box do not.
      for(let y=y0%step;y<=H-height;y+=step)for(let x=x0%step;x<=W-width;x+=step){
        const base=y*W+x;let match=true;scanned++;
        for(const c of cells){if(data[base+c.offset]!==c.bit){match=false;break;}if(++operations>=8192){operations=0;if(due())await pause();}}
        if(match){matches++;if(!first)first={c:x,r:y};for(const c of cells){put(base+c.offset,c.colour);if(++operations>=8192){operations=0;if(due())await pause();}}}
        if(++operations>=8192){operations=0;if(due())await pause();}
      }
    }
    check();return {mode,width:W,height:H,paint,matches,selectedCount,collisions,manualCells:source.cells.length,scanned,yields,first};
  }
  return {record,find,abort};
});
