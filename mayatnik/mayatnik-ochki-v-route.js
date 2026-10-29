/* Exact upper-left → meeting point → upper-right search paths.
 * Coordinates name logical cell centres, independently of display scale. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikOchkiVRoute=api;})(globalThis,function(){
  'use strict';
  function lines({width,height,val,points,allowed=null,partition=null}){
    if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||!Number.isSafeInteger(width*height)||!val||val.length<width*height)throw new RangeError('Incomplete V-route field');
    const out=[],seen=new Set();
    for(const point of points||[]){
      const {x:X,y:Y}=point;
      if(!Number.isFinite(X)||!Number.isFinite(Y))throw new RangeError('Invalid V-route meeting point');
      const key=X+':'+Y;if(seen.has(key))continue;seen.add(key);
      let cells=[],bits=[],lastPartition=null;
      const emit=()=>{
        // A surviving straight arm is not a V. Both upper rays must belong to
        // this uninterrupted fragment; an off-screen/empty turn cannot join them.
        if(cells.length&&cells[0]%width<X&&cells[cells.length-1]%width>X)
          out.push({dir:'v',p:lastPartition,cells:Int32Array.from(cells),str:bits.join(''),n:cells.length,monotonic:false,meeting:{x:X,y:Y}});
        cells=[];bits=[];
      };
      // Do not round an axis onto another lattice. Half-cell meetings naturally
      // pass between the two adjacent centres above their geometric vertex.
      for(let c=Math.max(0,Math.ceil(X-Y));c<=Math.min(width-1,Math.floor(X+Y));c++){
        const r=Y-Math.abs(c-X),q=r*width+c;
        if(!Number.isInteger(r)||r<0||r>=height||val[q]<0||allowed&&!allowed(r,c,q)){emit();lastPartition=null;continue;}
        if(val[q]!==0&&val[q]!==1)throw new RangeError('Invalid V-route bit');
        const p=partition?partition(r,c,q):null;
        if(cells.length&&p!==lastPartition)emit();
        lastPartition=p;cells.push(q);bits.push(String(val[q]));
      }
      emit();
    }
    out.sort((a,b)=>a.cells[0]-b.cells[0]||(a.p??-1)-(b.p??-1)||a.meeting.y-b.meeting.y||a.meeting.x-b.meeting.x);
    // Coincident projected crosses describe one occurrence.
    const unique=[],paths=new Set();let offset=0;
    for(const L of out){const key=L.p+':'+L.cells.join(',');if(paths.has(key))continue;paths.add(key);L.b=offset;offset+=L.n+1;unique.push(L);}
    unique.all=unique.map(L=>L.str+',').join('');unique.bytes=Uint8Array.from(unique.all,ch=>ch.charCodeAt(0));unique.width=width;
    return unique;
  }
  // Cell rows decrease after the turn. A binary search on source indices would
  // omit valid occurrences on that arm, including the highest occurrence.
  function firstOccurrence(line,pattern,width,used=null){
    if(!pattern.length)return null;
    let best=null;
    for(let at=line.str.indexOf(pattern);at>=0;at=line.str.indexOf(pattern,at+1)){
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
  return {lines,firstOccurrence,recoverRuns};
});
