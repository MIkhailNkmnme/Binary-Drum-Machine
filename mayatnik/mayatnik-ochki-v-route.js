/* Exact upper-left → meeting point → upper-right search paths.
 * Coordinates name logical cell centres, independently of display scale. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./mayatnik-variants.js'):root.MayatnikVariants);if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikOchkiVRoute=api;})(globalThis,function(Variants){
  'use strict';
  function verticalPoints(points,height){
    if(!Number.isSafeInteger(height)||height<1)throw new RangeError('Invalid V-route height');
    const axes=[...new Set((points||[]).map(p=>p.x))].sort((a,b)=>a-b);
    if(axes.some(x=>!Number.isFinite(x)))throw new RangeError('Invalid V-route axis');
    if(axes.length*height*2>262144)throw Object.assign(new RangeError('Слишком много положений V-вершины для полного поиска; частичный поиск не выполнен.'),{code:'OCHKI_LIMIT'});
    const out=[];for(const x of axes)for(let y=0;y<=height-.5;y+=.5)out.push({x,y});return out;
  }
  function lines({width,height,val,read=null,points,allowed=null,partition=null,pack=true}){
    if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||!Number.isSafeInteger(width*height)||
      (typeof read!=='function'&&(!val||val.length<width*height)))throw new RangeError('Incomplete V-route field');
    const value=typeof read==='function'?read:(r,c)=>val[r*width+c];
    // Large packed fields can exceed signed 32-bit cell addresses. Their
    // bounded route arrays must retain exact positive source coordinates.
    const CellArray=width*height<=0x80000000?Int32Array:Float64Array;
    const out=[],seen=new Set();let totalCells=0;
    for(const point of points||[]){
      const {x:X,y:Y}=point;
      if(!Number.isFinite(X)||!Number.isFinite(Y))throw new RangeError('Invalid V-route meeting point');
      const key=X+':'+Y;if(seen.has(key))continue;seen.add(key);
      let cells=[],bits=[],lastPartition=null;
      const emit=()=>{
        // A surviving straight arm is not a V. Both upper rays must belong to
        // this uninterrupted fragment; an off-screen/empty turn cannot join them.
        if(cells.length&&cells[0]%width<X&&cells[cells.length-1]%width>X){
          totalCells+=cells.length;if(totalCells>16777216)throw Object.assign(new RangeError('Полные V-маршруты превышают безопасный бюджет памяти; частичный поиск не выполнен.'),{code:'OCHKI_LIMIT'});
          out.push({dir:'v',p:lastPartition,cells:CellArray.from(cells),str:bits.join(''),n:cells.length,monotonic:false,meeting:{x:X,y:Y}});}
        cells=[];bits=[];
      };
      // Do not round an axis onto another lattice. Half-cell meetings naturally
      // pass between the two adjacent centres above their geometric vertex.
      for(let c=Math.max(0,Math.ceil(X-Y));c<=Math.min(width-1,Math.floor(X+Y));c++){
        const r=Y-Math.abs(c-X),q=r*width+c;
        if(!Number.isInteger(r)||r<0||r>=height){emit();lastPartition=null;continue;}
        const v=value(r,c);
        if(v<0||allowed&&!allowed(r,c,q)){emit();lastPartition=null;continue;}
        if(v!==0&&v!==1)throw new RangeError('Invalid V-route bit');
        const p=partition?partition(r,c,q):null;
        if(cells.length&&p!==lastPartition)emit();
        lastPartition=p;cells.push(q);bits.push(String(v));
      }
      emit();
    }
    out.sort((a,b)=>a.cells[0]-b.cells[0]||(a.p??-1)-(b.p??-1)||a.meeting.y-b.meeting.y||a.meeting.x-b.meeting.x);
    // Coincident projected crosses describe one occurrence.
    const unique=[],paths=new Set();let offset=0;
    for(const L of out){const key=L.p+':'+L.cells.join(',');if(paths.has(key))continue;paths.add(key);L.b=offset;offset+=L.n+1;unique.push(L);}
    if(pack){unique.all=unique.map(L=>L.str+',').join('');unique.bytes=Uint8Array.from(unique.all,ch=>ch.charCodeAt(0));}unique.width=width;
    return unique;
  }
  // Stream one compact route at a time. A continuous fragment crossing both
  // arms is uniquely identified by its first/last cells: those endpoints
  // determine X and Y. Distinct axes/vertices therefore cannot duplicate it.
  // No vertex-count or total-route-cell limit is needed for this API.
  function* verticalRoutes({width,height,val,read=null,points,allowed=null,partition=null,onProgress=null}){
    if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||!Number.isSafeInteger(width*height)||
      (typeof read!=='function'&&(!val||val.length<width*height)))throw new RangeError('Incomplete V-route field');
    const value=typeof read==='function'?read:(r,c)=>val[r*width+c];
    const axes=[...new Set((points||[]).map(point=>point.x))].sort((a,b)=>a-b);
    if(axes.some(x=>!Number.isFinite(x)))throw new RangeError('Invalid V-route axis');
    let visited=0;const total=axes.length*height*2;
    for(const X of axes){
      const coreLeft=Math.ceil(X)-1,coreRight=Math.floor(X)+1;
      if(coreLeft<0||coreRight>=width){visited+=height*2;continue;}
      for(let Y=0;Y<=height-.5;Y+=.5){
        if(onProgress&&(visited++&255)===0)onProgress(visited,total);
        function valid(c,p,checkPartition=true){
          const r=Y-Math.abs(c-X),q=r*width+c;
          if(!Number.isInteger(r)||r<0||r>=height)return false;
          const v=value(r,c);if(v<0||allowed&&!allowed(r,c,q))return false;
          if(v!==0&&v!==1)throw new RangeError('Invalid V-route bit');
          return !checkPartition||!partition||partition(r,c,q)===p;
        }
        if(!valid(coreLeft,null,false))continue;
        const firstRow=Y-Math.abs(coreLeft-X),p=partition?partition(firstRow,coreLeft,firstRow*width+coreLeft):null;
        let connected=true;
        for(let c=coreLeft+1;c<=coreRight;c++)if(!valid(c,p)){connected=false;break;}
        if(!connected)continue;
        let left=coreLeft,right=coreRight;
        while(left>0&&valid(left-1,p))left--;
        while(right+1<width&&valid(right+1,p))right++;
        yield {dir:'v',p,left,right,n:right-left+1,firstCell:(Y-Math.abs(left-X))*width+left,meeting:{x:X,y:Y}};
      }
    }
    if(onProgress)onProgress(total,total);
  }
  // Cell rows decrease after the turn. A binary search on source indices would
  // omit valid occurrences on that arm, including the highest occurrence.
  function firstOccurrence(line,pattern,width,used=null){
    if(!pattern.length)return null;
    let best=null;
    for(let at=Variants.indexOf(line.str,pattern);at>=0;at=Variants.indexOf(line.str,pattern,at+1)){
      if(used&&used(at))continue;
      const row=Math.floor(line.cells[at]/width);
      if(!best||row<best.row)best={at,row};
    }
    return best;
  }
  function recoverRuns(lines,cell,{pattern,min=2,inverse=false}={}){
    const found=[],seen=new Set(),alternate=pattern==='alternating',wanted=pattern==='zeros'?'0':'1';
    for(const L of lines){
      const at=L.cells.indexOf(cell);if(at<0||!alternate&&!inverse&&L.str[at]!==wanted)continue;
      const joins=(a,b)=>alternate?L.str[a]!==L.str[b]:L.str[a]===L.str[b];
      let first=at,last=at;while(first>0&&joins(first-1,first))first--;while(last+1<L.n&&joins(last,last+1))last++;
      if(last-first+1<min)continue;const cells=Array.from(L.cells.subarray(first,last+1)),key=L.p+':'+cells.join(',');if(seen.has(key))continue;seen.add(key);
      found.push({n:cells.length,r:Math.floor(cells[0]/lines.width),c:cells[0]%lines.width,p:L.p,dir:'v',text:L.str.slice(first,last+1),cells});
    }
    return found;
  }
  return {lines,verticalPoints,verticalRoutes,firstOccurrence,recoverRuns};
});
