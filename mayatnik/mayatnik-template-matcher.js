/* Exact translated binary silhouettes. No rotations, colour comparison or polling. */
(function(root){
  'use strict';
  const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
  const abort=()=>{const e=new Error('Поиск отменён');e.name='AbortError';return e;};
  function compile(part,rk=1,options={}){
    const width=Math.max(1,Math.round(part.width/rk)),height=Math.max(1,Math.round(part.height/rk));
    const data=new Uint8Array(width*height),filled=[];
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const q=y*width+x;data[q]=part.data[Math.min(part.height-1,Math.floor((y+.5)*rk))*part.width+Math.min(part.width-1,Math.floor((x+.5)*rk))]?1:0;
      if(data[q])filled.push(q);
    }
    if(!filled.length)throw Error('В шаблоне нет клеток');
    // Spread the first probes over the rectangle, before the exhaustive check.
    const order=[...new Set([0,data.length-1,width-1,(height-1)*width,Math.floor(data.length/2),...Array.from({length:12},(_,i)=>Math.floor(i*data.length/12))])];
    const used=new Set(order);for(let q=0;q<data.length;q++)if(!used.has(q))order.push(q);
    const pattern={width,height,data,filled:Uint32Array.from(filled),order:Uint32Array.from(order)};
    if(options.silhouette){
      // A transparent pixel is not an opposite bit. Only the immediate side
      // boundary belongs to this silhouette, including neighbours outside its box.
      const boundary=new Set(),stride=width+2;
      for(const q of filled){const x=q%width,y=Math.floor(q/width);
        for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]){const xx=x+dx,yy=y+dy;
          if(xx<0||xx>=width||yy<0||yy>=height||!data[yy*width+xx])boundary.add((yy+1)*stride+xx+1);
        }
      }
      pattern.order=Uint32Array.from(order.filter(q=>data[q]));
      pattern.boundary=Int32Array.from([...boundary].flatMap(q=>[q%stride-1,Math.floor(q/stride)-1]));
    }
    return pattern;
  }
  async function find(field,patterns,options={}){
    const {width:W,height:H,data}=field,N=W*H,selected=options.existsOnly?null:new Uint8Array(N);
    if(data.length!==N)throw Error('Размер поля не совпадает');
    const cancelled=options.cancelled||(()=>false),yieldTask=options.yieldTask||pause;
    const clock=options.now||(()=>performance.now()),budget=options.budgetMs??8;
    let operations=0,yields=0,count=0,selectedCount=0,firstMatch=null,sliceStart=clock(),maxSliceMs=0;
    const due=()=>{if(cancelled())throw abort();return clock()-sliceStart>=budget;};
    const checkpoint=async()=>{maxSliceMs=Math.max(maxSliceMs,clock()-sliceStart);yields++;await yieldTask();sliceStart=clock();if(cancelled())throw abort();};
    for(let pi=0;pi<patterns.length;pi++){
      const p=patterns[pi],pw=p.width,ph=p.height;
      if(pw>W||ph>H)continue;
      const offsets=Uint32Array.from(p.order,q=>Math.floor(q/pw)*W+q%pw),ones=Uint32Array.from(p.filled,q=>Math.floor(q/pw)*W+q%pw);
      for(let y=0;y<=H-ph;y++)for(let x=0;x<=W-pw;x++){
        const start=y*W+x,first=data[start+offsets[0]],inverse=first^p.data[p.order[0]];
        let match=first>=0;
        for(let j=1;match&&j<offsets.length;j++){
          match=data[start+offsets[j]]===(p.data[p.order[j]]^inverse);
          if(++operations>=8192){operations=0;if(due())await checkpoint();}
        }
        if(match&&p.boundary)for(let j=0;match&&j<p.boundary.length;j+=2){
          const xx=x+p.boundary[j],yy=y+p.boundary[j+1];
          // Empty cells and the field edge terminate a figure; never wrap rows.
          if(xx>=0&&xx<W&&yy>=0&&yy<H)match=data[yy*W+xx]!==first;
          if(++operations>=8192){operations=0;if(due())await checkpoint();}
        }
        if(match){
          if(!firstMatch)firstMatch={x,y,width:pw,height:ph,patternIndex:pi};
          if(options.existsOnly)return {count:1,yields,maxSliceMs:Math.max(maxSliceMs,clock()-sliceStart)};
          count++;
          for(const offset of ones){const q=start+offset;if(!selected[q]){selected[q]=1;selectedCount++;}
            if(++operations>=8192){operations=0;if(due())await checkpoint();}}
        }
        if(++operations>=8192){operations=0;if(due())await checkpoint();}
      }
    }
    if(cancelled())throw abort();
    maxSliceMs=Math.max(maxSliceMs,clock()-sliceStart);
    return {count,selectedCount,selected,first:firstMatch,width:W,height:H,yields,maxSliceMs};
  }
  const api={compile,find,abort};if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikTemplateMatcher=api;
})(typeof window==='object'?window:globalThis);
