/* Library identity: exact silhouette, bit values and proven source addresses.
 * Names, colours and runtime IDs never identify a captured template. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikTemplateDedup=api;})(globalThis,function(){
  'use strict';
  const integer=Number.isSafeInteger;
  function valid(proof){
    if(!proof||proof.version!==1||!integer(proof.width)||!integer(proof.height)||proof.width<1||proof.height<1||!Array.isArray(proof.runs))return false;
    const size=proof.width*proof.height;if(!integer(size))return false;let end=0;
    for(const run of proof.runs){if(!Array.isArray(run)||run.length!==5||!run.every(integer)||run[0]<end||run[1]<=run[0]||run[1]>size||run[2]<0||run[3]<0||(run[4]!==0&&run[4]!==1))return false;end=run[1];}
    return true;
  }
  function at(proof,q){
    let lo=0,hi=proof.runs.length;
    while(lo<hi){const mid=(lo+hi)>>1;if(proof.runs[mid][1]<=q)lo=mid+1;else hi=mid;}
    const run=proof.runs[lo];return run&&run[0]<=q?{c:run[2],r:run[3],bit:run[4]}:null;
  }
  function build(mask,read){
    if(!mask||!integer(mask.width)||!integer(mask.height)||mask.width<1||mask.height<1||mask.data?.length!==mask.width*mask.height)return null;
    const runs=[];for(let q=0;q<mask.data.length;q++){if(!mask.data[q])continue;const cell=read(q);if(!cell||!integer(cell.c)||!integer(cell.r)||cell.c<0||cell.r<0||(cell.bit!==0&&cell.bit!==1))return null;
      const prev=runs.at(-1);if(prev&&prev[1]===q&&prev[2]===cell.c&&prev[3]===cell.r&&prev[4]===cell.bit)prev[1]++;
      else runs.push([q,q+1,cell.c,cell.r,cell.bit]);}
    return runs.length?{version:1,width:mask.width,height:mask.height,runs}:null;
  }
  function capture(parts,read){return parts.map(part=>{
    // An old transformed origin has no trustworthy current-geometry fallback.
    if(part.librarySource||part.sourceOrigin)return part;
    const proof=build(part.mask,q=>{try{return read(part,part.mask.x+q%part.mask.width,part.mask.y+Math.floor(q/part.mask.width),q);}catch(_){return null;}});
    return proof?{...part,librarySource:proof}:part;
  });}
  function serialize(parts){
    const result=[];for(const part of parts){const source=part.sourceOrigin?.librarySource||part.librarySource;if(!valid(source))return null;
      const indices=part.sourceIndices;if(indices&&indices.length!==part.mask.data.length||!indices&&(source.width!==part.mask.width||source.height!==part.mask.height))return null;
      const proof=build(part.mask,q=>{const index=indices?indices[q]:q;if(!integer(index)||index<0||index>=source.width*source.height)return null;const cell=at(source,index);if(!cell)return null;const own=part.bitsData?.[q];return own===0||own===1?{...cell,bit:own}:cell;});
      if(!proof)return null;result.push(proof);
    }return result.length?{version:1,parts:result}:null;
  }
  function restore(parts,shape,factor=1){
    const proofs=shape?.libraryProof?.version===1?shape.libraryProof.parts:null;if(!Array.isArray(proofs)||!proofs.length||!proofs.every(valid))return parts;
    if(!Number.isFinite(factor)||factor<=0)return parts;
    return parts.map((part,i)=>{const source=proofs[Math.min(i,proofs.length-1)],mask=part.mask;
      if(mask.width!==Math.max(1,Math.round(source.width*factor))||mask.height!==Math.max(1,Math.round(source.height*factor)))return part;
      const proof=build(mask,q=>at(source,Math.min(source.height-1,Math.floor(Math.floor(q/mask.width)/factor))*source.width+Math.min(source.width-1,Math.floor(q%mask.width/factor))));
      return proof?{...part,librarySource:proof}:part;
    });
  }
  function key(shape){
    const parts=shape?.axisParts||shape?.parts,proofs=shape?.libraryProof?.version===1?shape.libraryProof.parts:null,rk=Number(shape?.rk)||1;
    if(!Array.isArray(parts)||!parts.length||!Array.isArray(proofs)||proofs.length!==parts.length||!Number.isFinite(rk)||rk<=0)return null;
    const records=[];
    for(let i=0;i<parts.length;i++){const part=parts[i],proof=proofs[i];if(!part||!valid(proof)||part.width!==proof.width||part.height!==proof.height||part.data?.length!==part.width*part.height)return null;
      // Proof is authoritative only if it describes precisely the occupied mask.
      let run=0;for(let q=0;q<part.data.length;q++){while(run<proof.runs.length&&proof.runs[run][1]<=q)run++;const covered=run<proof.runs.length&&proof.runs[run][0]<=q;if(!!part.data[q]!==covered)return null;}
      const sy=(Number(shape.height)||100)/100,sx=shape.proportional?sy:1,axis=shape.axisParts?Number(part.axis??part.x)/rk:Number(part.center)||0,baseX=shape.axisParts?Number(part.x)/rk:axis-part.width/(2*rk),baseY=(Number(part.y)||0)/rk,originY=Number.isFinite(part.axisOriginY)?part.axisOriginY/rk:baseY;
      const x=axis+(baseX-axis)*sx,y=originY+(baseY-originY)*sy;
      if(!Number.isFinite(x)||!Number.isFinite(y))return null;records.push({x,y,width:part.width,height:part.height,runs:proof.runs});
    }
    const minX=Math.min(...records.map(p=>p.x)),minY=Math.min(...records.map(p=>p.y));
    // Global placement is not a new source. Relative placement of parts is.
    const canonical=records.map(p=>JSON.stringify([p.x-minX,p.y-minY,p.width,p.height,p.runs])).sort();
    return JSON.stringify([rk,Number(shape.height)||100,!!shape.proportional,canonical]);
  }
  function find(entries,shape){const wanted=key(shape);return wanted===null?null:entries.find(entry=>key(entry.shape)===wanted)||null;}
  function append(entries,candidates){const added=[],reused=[];for(const entry of candidates){const old=find(entries,entry.shape);if(old)reused.push(old);else{entries.push(entry);added.push(entry);}}return {added,reused};}
  return {valid,at,capture,serialize,restore,key,find,append};
});
