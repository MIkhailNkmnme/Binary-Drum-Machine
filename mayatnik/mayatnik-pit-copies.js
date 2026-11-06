/* Live copies in exact logical-zero triangles. Display buffers only.
 * The host supplies the existing full-grid triangle detector; no RGB-based
 * presence inference, fabricated holes, or mutation of the master field. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikPitCopies=api;})(globalThis,function(){
  'use strict';
  const DEFAULTS=Object.freeze({pitCopiesOn:false,pitCopySource:'current',pitCopySeed:'1',pitCopyRows:32,pitCopyLevels:1,pitCopyColour:'#44d9ff'});
  function seed(value){const text=String(value).replace(/\s/g,'');if(!/^[01]{1,256}$/.test(text))throw Error('Образец: введите от 1 до 256 битов 0 и 1; пробелы разрешены.');return text;}
  function normalize(state={},strict=false){
    const out={...DEFAULTS};
    for(const key of Object.keys(DEFAULTS)){
      const value=state[key];if(value==null)continue;
      try{
        if(key==='pitCopySeed'){out[key]=seed(value);continue;}
        const valid=key==='pitCopiesOn'?typeof value==='boolean':key==='pitCopySource'?['current','sample'].includes(value):key==='pitCopyColour'?typeof value==='string'&&/^#[\da-f]{6}$/i.test(value):Number.isInteger(value)&&value>=(key==='pitCopyRows'?8:1)&&value<=(key==='pitCopyRows'?512:4);
        if(!valid)throw Error('Некорректная настройка копий во впадинах: '+key);out[key]=value;
      }catch(error){if(strict)throw error;}
    }
    return out;
  }
  function sample(sequence='1',rows=32){
    sequence=seed(sequence);rows=Math.max(8,Math.min(512,Math.round(rows)||32));
    const W=sequence.length+2*(rows-1),H=rows,val=new Int8Array(W*H).fill(-1),pixels=new Uint32Array(val.length),visible=new Uint8Array(val.length),start=rows-1;
    for(let x=0;x<sequence.length;x++)val[start+x]=Number(sequence[x]);
    for(let y=0;y<H;y++){
      const lo=start-y,hi=start+sequence.length-1+y;
      for(let x=lo;x<=hi;x++){
        const q=y*W+x;if(y){const prev=q-W,left=x?val[prev-1]:-1,right=x+1<W?val[prev+1]:-1;val[q]=(left===1?1:0)^(right===1?1:0);}
        visible[q]=1;pixels[q]=val[q]===1?0xffffffff:0xff000000;
      }
    }
    return {W,H,val,pixels,visible};
  }
  function bounds(frame){
    let left=frame.W,right=-1,top=frame.H,bottom=-1;
    for(let y=0;y<frame.H;y++)for(let x=0;x<frame.W;x++){const q=y*frame.W+x;if(!(frame.visible?frame.visible[q]:frame.val[q]>=0))continue;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    return right<left?null:{x:left,y:top,w:right-left+1,h:bottom-top+1};
  }
  function tint(colour,hex){
    const red=parseInt(hex.slice(1,3),16),green=parseInt(hex.slice(3,5),16),blue=parseInt(hex.slice(5,7),16);
    const light=(.2126*(colour&255)+.7152*(colour>>>8&255)+.0722*(colour>>>16&255))/255;
    return ((colour&0xff000000)|Math.round(red*light)|(Math.round(green*light)<<8)|(Math.round(blue*light)<<16))>>>0;
  }
  function place(master,source,triangles,box,colour){
    const pixels=master.pixels.slice(),written=new Uint8Array(pixels.length),colours=colour?new Map():null;let count=0;
    for(const tri of triangles){
      const ratio=Math.min(1,tri.w/box.w,tri.h/box.h),w=Math.max(1,Math.floor(box.w*ratio)),h=Math.max(1,Math.floor(box.h*ratio));
      const left=tri.x+Math.floor((tri.w-w)/2),top=tri.y+Math.floor((tri.h-h)/2),cx=tri.x+tri.h-1;
      for(let y=top;y<top+h;y++){
        const radius=tri.h-1-(y-tri.y),lo=Math.max(left,cx-radius),hi=Math.min(left+w-1,cx+radius);
        if(y<0||y>=master.H||radius<0)continue;
        const sy=box.y+box.h-1-Math.min(box.h-1,Math.floor((y-top+.5)*box.h/h));
        for(let x=lo;x<=hi;x++){
          if(x<0||x>=master.W)continue;const q=y*master.W+x;if(written[q]||master.val[q]!==0)continue;
          const sx=box.x+box.w-1-Math.min(box.w-1,Math.floor((x-left+.5)*box.w/w)),from=sy*source.W+sx;
          if(!(source.visible?source.visible[from]:source.val[from]>=0))continue;
          const raw=source.pixels[from];let ink=raw;if(colours){ink=colours.get(raw);if(ink===undefined){ink=tint(raw,colour);colours.set(raw,ink);}}
          pixels[q]=ink;written[q]=1;count++;
        }
      }
    }
    return {pixels,written,count};
  }
  function derive({master,source=master,levels=1,colour='#44d9ff',detect}){
    const box=bounds(source);if(!box)return null;
    const holes=detect(master,{minHeight:2});if(!holes.length)return null;
    const sourceHoles=levels>1?(source===master?holes:detect(source,{minHeight:2})):[];
    let nested=source;
    // Each pass starts from the immutable source; previous is a separate image.
    // A finite level never reads pixels it has just written to its destination.
    for(let level=1;level<levels&&sourceHoles.length;level++){
      const next=place(source,nested,sourceHoles,box,null);nested={...source,pixels:next.pixels};
    }
    const result=place(master,nested,holes,box,colour);
    return result.count?{...result,holes:holes.length}:null;
  }
  return {DEFAULTS,seed,normalize,sample,derive};
});
