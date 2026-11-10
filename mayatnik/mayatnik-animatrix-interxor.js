/* InterXoroorius.xlsm / InterleavingCore: RunXorPasses and RunChainDown.
 * One pair per frame, downward, then last -> first (at least three rows).
 * Strings include their leading/trailing zeroes. Empty lattice cells are not
 * string characters. Worksheet patterns/search and their stopping conditions
 * are not part of this port; the chosen nonempty rows form one data column.
 * Excel centre alignment is floor((long-short)/2). A centred result is packed
 * onto the receiving row's fixed parity; a tie moves half a bit to the left.
 * Fonts/fills retain the no-pattern worksheet semantics, not change markers.
 * No counters, timers, browser objects or source arrays are owned here.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.MayatnikAnimatrixInterxor=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const GRAY=0x969696,INTERLEAVE_FILL=0xc6efce,CELL_LIMIT=32767;
  const ARRAY_KEYS=['bits','present','colours','bold','automatic','fills','filled','selection'];
  const rowCache=new WeakMap();
  function seedOf(s){return s._seed||s;}
  function dataRows(seed){
    let cached=rowCache.get(seed);if(cached)return cached;
    const all=[],chosen=[];
    for(let r=0;r<seed.height;r++){
      let present=false,selected=false;
      for(let c=0;c<seed.width;c++){
        const q=r*seed.width+c;
        if(seed.present[q]){present=true;if(seed.selection?.[q])selected=true;}
      }
      if(present){all.push(r);if(selected)chosen.push(r);}
    }
    cached=chosen.length?chosen:all;rowCache.set(seed,cached);return cached;
  }
  function cycleFrames(seed){const n=dataRows(seedOf(seed)).length;return n>=3?n:1;}
  function pair(rows,phase){
    if(rows.length<2)return null;
    if(rows.length===2)return {top:rows[0],bottom:rows[1],target:rows[1],source:rows[0],wrap:false};
    const at=phase%rows.length;
    return at===rows.length-1?{top:rows[0],bottom:rows[at],target:rows[0],source:rows[at],wrap:true}:
      {top:rows[at],bottom:rows[at+1],target:rows[at+1],source:rows[at],wrap:false};
  }
  function readRow(s,r){
    const result=[];
    for(let c=0;c<s.width;c++){const q=r*s.width+c;if(s.present[q])result.push(s.bits[q]?1:0);}
    return result;
  }
  function pairResult(top,bottom,xor){
    const longer=top.length>=bottom.length?top:bottom,shorter=longer===top?bottom:top;
    const shift=Math.floor((longer.length-shorter.length)/2),result=[];
    for(let i=0;i<longer.length;i++){
      const j=i-shift,inside=j>=0&&j<shorter.length;
      if(xor)result.push(longer[i]^(inside?shorter[j]:0));
      else{result.push(longer[i]);if(inside)result.push(shorter[j]);}
    }
    return result;
  }
  function accumulatedResult(s,bottom){
    const rows=[];let length=0;
    for(let r=0;r<=bottom;r++){const row=readRow(s,r);rows.push(row);length=Math.max(length,row.length);}
    const result=new Uint8Array(length);
    for(const row of rows){const shift=Math.floor((length-row.length)/2);for(let i=0;i<row.length;i++)result[shift+i]^=row[i];}
    return result;
  }
  function requiredWidth(seed,options={}){
    const rows=dataRows(seedOf(seed)),lengths=[];
    for(let r=0;r<seed.height;r++)lengths.push(readRow(seed,r).length);
    let largest=Math.max(0,...lengths);
    for(let phase=0;phase<cycleFrames(seed);phase++){
      const p=pair(rows,phase);if(!p)break;
      const a=lengths[p.top],b=lengths[p.bottom],xor=((a-b)&1)===0;
      let length=xor?Math.max(a,b):a+b;
      if(xor&&(options.algorithm||seed.algorithm)==='excelChainDown')
        for(let r=0;r<=p.bottom;r++)length=Math.max(length,lengths[r]);
      lengths[p.target]=length;largest=Math.max(largest,length);
    }
    // A centred anchor and one extra raw column on either side cover either
    // fixed row parity. The caller applies its finite-field allocation cap.
    return Math.max(seed.width,2*largest+1);
  }
  function clearFormatting(s){
    for(let r=0;r<s.height;r++){
      const start=r*s.width,end=start+s.width;let has=false,gray=true;
      for(let q=start;q<end;q++)if(s.present[q]){has=true;if(s.colours[q]!==GRAY||s.automatic[q])gray=false;}
      for(let q=start;q<end;q++){
        s.fills[q]=0;s.filled[q]=0;s.colours[q]=has&&gray?GRAY:0;s.automatic[q]=has&&gray?0:1;
        if(has&&gray)s.bold[q]=0;
      }
    }
  }
  function selectPair(s,p){
    s.selection.fill(0);s.areas=[];
    if(!p)return;
    for(const r of [p.top,p.bottom])for(let c=0;c<s.width;c++){
      const q=r*s.width+c;if(!s.present[q])continue;
      s.selection[q]=1;s.areas.push({x:c,y:r,width:1,height:1});
    }
  }
  function step(s){
    const rows=dataRows(seedOf(s)),phase=Math.max(0,Math.trunc(s.excelPhase||0)),p=pair(rows,phase);
    if(!p)return false;
    const top=readRow(s,p.top),bottom=readRow(s,p.bottom);
    if(!top.length||!bottom.length)return false;
    const xor=((top.length-bottom.length)&1)===0;
    const result=xor&&s.algorithm==='excelChainDown'?accumulatedResult(s,p.bottom):pairResult(top,bottom,xor);
    const anchor=Number.isInteger(s.excelAnchor)?s.excelAnchor:Math.floor(s.width/2);
    let left=anchor-(result.length-1);
    if(((left-anchor-p.target)%2+2)%2)left--;
    const right=left+2*(result.length-1);
    // Excel also refuses an overlong cell. Leave bits, styles and selection
    // entirely unchanged so the owner can stop on the last complete frame.
    if(!result.length||result.length>CELL_LIMIT||left<0||right>=s.width)return false;
    clearFormatting(s);
    const sourceStart=p.source*s.width;
    const didGray=!p.wrap&&phase%cycleFrames(s)<rows.length-2;
    for(let c=0;c<s.width;c++){
      const q=sourceStart+c;if(!s.present[q])continue;
      if(didGray){s.colours[q]=GRAY;s.automatic[q]=0;s.bold[q]=0;}
      else{s.fills[q]=INTERLEAVE_FILL;s.filled[q]=1;}
    }
    const targetStart=p.target*s.width;
    for(const key of ARRAY_KEYS)s[key].fill(0,targetStart,targetStart+s.width);
    for(let i=0;i<result.length;i++){
      const q=targetStart+left+2*i;s.bits[q]=result[i];s.present[q]=1;s.automatic[q]=1;
    }
    selectPair(s,pair(rows,(phase+1)%cycleFrames(s)));
    return true;
  }
  return {cycleFrames,requiredWidth,step};
});
