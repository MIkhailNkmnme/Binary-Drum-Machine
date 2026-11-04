/* Row-major cyclic search. Empty cells disappear; unknown values remain barriers. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikOchkiLoop=api;})(globalThis,function(){
  'use strict';
  function pack(lines){let offset=0;for(const L of lines){L.b=offset;offset+=L.n+1;}lines.all=lines.map(L=>L.str+',').join('');lines.bytes=Uint8Array.from(lines.all,ch=>ch.charCodeAt(0));return lines;}
  function lines({width,height,val,allowed=()=>true,all=false}){
    const out=[],eligible=new Uint8Array(width*height);for(let r=0;r<height;r++)for(let c=0;c<width;c++)if(val[r*width+c]!==-1&&allowed(r,c))eligible[r*width+c]=1;
    for(const family of all?['row','col','diag','antidiag']:['row']){
      const cells=[],bits=[],add=(r,c)=>{const q=r*width+c;if(!eligible[q])return;const v=val[q];cells.push(q);bits.push(v===0?'0':v===1?'1':'?');};
      if(family==='row')for(let r=0;r<height;r++)for(let c=0;c<width;c++)add(r,c);
      else if(family==='col')for(let c=0;c<width;c++)for(let r=0;r<height;r++)add(r,c);
      else if(family==='diag')for(let d=1-height;d<width;d++)for(let r=Math.max(0,-d);r<=Math.min(height-1,width-1-d);r++)add(r,r+d);
      else for(let sum=0;sum<width+height-1;sum++)for(let r=Math.max(0,sum-width+1);r<=Math.min(height-1,sum);r++)add(r,sum-r);
      const ring=bits.join(''),baseCells=Int32Array.from(cells);if(ring.length)out.push({p:null,dir:all?'loop-'+family:'loop',monotonic:family==='row',cycleSize:ring.length,ring,baseCells,cells:baseCells,str:ring,n:ring.length});
    }
    out.width=width;out.loop=true;return pack(out);
  }
  // Materialize only enough repeated text for the requested finite words. Starts
  // always belong to the original circuit even when a word takes several laps.
  function prepare(lines,maxLength){
    if(!lines.some(L=>L.cycleSize))return;
    for(const L of lines){if(!L.cycleSize)continue;const n=L.cycleSize+Math.max(1,maxLength)-1;if(L.n===n)continue;L.n=n;L.str=L.ring.repeat(Math.ceil(n/L.cycleSize)).slice(0,n);L.cells=Int32Array.from({length:n},(_,i)=>L.baseCells[i%L.cycleSize]);}
    pack(lines);
  }
  function firstOccurrence(L,text,width,used=()=>false){
    if(!text.length)return null;let best=null,at=L.str.indexOf(text);while(at>=0&&at<L.cycleSize){if(!used(at)){const row=Math.floor(L.cells[at]/width);if(!best||row<best.row)best={at,row};if(L.monotonic!==false||row===0)break;}at=L.str.indexOf(text,at+1);}return best;
  }
  function runs(lines,{pattern,min=2,inverse=false}={}){
    const out=[],alternate=pattern==='alternating',wanted=pattern==='zeros'?'0':'1';
    for(const L of lines){const n=L.cycleSize,s=L.ring;if(!n)continue;const valid=i=>s[i]==='0'||s[i]==='1',allowed=i=>valid(i)&&(alternate||inverse||s[i]===wanted),joins=(a,b)=>allowed(a)&&allowed(b)&&(alternate?s[a]!==s[b]:s[a]===s[b]);
      let seam=-1;for(let i=0;i<n;i++)if(!joins((i+n-1)%n,i)){seam=i;break;}
      const emit=(start,length)=>{if(length<min)return;const cells=Int32Array.from({length},(_,j)=>L.baseCells[(start+j)%n]),str=Array.from({length},(_,j)=>s[(start+j)%n]).join('');out.push({p:null,dir:L.dir,cells,str,n:length});};
      if(seam<0){emit(0,n);continue;}
      let start=seam,length=0;for(let j=0;j<n;j++){const i=(seam+j)%n;if(!allowed(i)){emit(start,length);length=0;continue;}if(length&&!joins((i+n-1)%n,i)){emit(start,length);length=0;}if(!length)start=i;length++;}emit(start,length);
    }
    out.sort((a,b)=>a.cells[0]-b.cells[0]);return out;
  }
  return {lines,prepare,firstOccurrence,runs};
});
