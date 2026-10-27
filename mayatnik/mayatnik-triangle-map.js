/* Exact original-map geometry. The CSV/SVG vertices are cell CENTRES, not the
 * outer boundaries used by the unrelated full-grid automatic-triangle tool. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikTriangleMap=api;})(globalThis,function(){
  'use strict';
  const parity=n=>((n%2)+2)%2;
  function records(data,source,frame,anchor=0){
    if(source!=='static'&&source!=='time')throw Error('Неизвестный источник карты');
    if(source==='time'&&(!Number.isInteger(frame)||frame<data.firstFrame||frame>data.lastFrame))throw Error('Карта по времени доступна для кадров 1–500');
    const flat=source==='static'?data.initial:(data.frames[frame]||[]),out=[];
    for(let i=0;i<flat.length;i+=6)out.push({id:flat[i],p:flat[i+1],x:anchor+flat[i+2],base:flat[i+3],tip:flat[i+4],h:flat[i+5]});
    return out;
  }
  function contains(t,c,r,anchor){return parity(c-r-anchor)===t.p&&r>=t.base&&r<=t.tip&&Math.abs(c-t.x)<=t.tip-r;}
  function build(data,{source='static',frame=1,field,anchor=0}){
    const {W,H,val}=field;if(!Number.isInteger(W)||H!==data.rows||!val||val.length<W*H)throw Error('Карта рассчитана для поля 512 строк');
    const triangles=records(data,source,frame,anchor),blocked=new Uint8Array(W*H),mirrors=new Int32Array(W*H).fill(-1),axes=[];
    for(const t of triangles){
      axes.push({kind:'h',p:t.p,id:t.id,a:[t.x-t.h+1.5,t.base+.5],b:[t.x+t.h-.5,t.base+.5]});
      for(let r=Math.max(0,t.base);r<=Math.min(H-1,t.tip);r++){
        let lo=Math.max(0,t.x-(t.tip-r)),hi=Math.min(W-1,t.x+t.tip-r);
        if(parity(lo-r-anchor)!==t.p)lo++;
        for(let c=lo;c<=hi;c+=2){const q=r*W+c;blocked[q]=1;
          const sr=2*t.base-r;if(r>t.base&&sr>=0&&sr<H&&val[sr*W+c]>=0&&mirrors[q]<0)mirrors[q]=sr*W+c;
        }
      }
    }
    // Each lattice has its own complete source geometry. Other-lattice cells
    // inside a polygon remain eligible for paint if their own map allows them.
    for(const p of [0,1]){
      const ts=triangles.filter(t=>t.p===p),columns=[...new Set(ts.map(t=>t.x))].sort((a,b)=>a-b);
      for(const c of columns){if(c<0||c>=W)continue;
        const intervals=[];for(const t of ts){const distance=Math.abs(c-t.x),end=t.tip+.5-distance;if(end>t.base+.5)intervals.push([t.base+.5,end]);}
        intervals.sort((a,b)=>a[0]-b[0]);const holes=[];
        for(const range of intervals){const prev=holes[holes.length-1];if(prev&&range[0]<=prev[1])prev[1]=Math.max(prev[1],range[1]);else holes.push(range.slice());}
        let first=0;while(first<H&&val[first*W+c]<0)first++;let cursor=first;
        const add=end=>{if(end>cursor)axes.push({kind:'v',p,a:[c+.5,cursor],b:[c+.5,end]});};
        for(const [lo,hi]of holes){if(hi<=cursor)continue;add(Math.min(H,lo));cursor=Math.max(cursor,hi);if(cursor>=H)break;}
        add(H);
      }
    }
    return {source,frame,triangles,blocked,mirrors,axes};
  }
  function reflect(pixels,mapping,{width,height,sourceWidth,x0=0,read=null,write=null}={}){
    const source=pixels.slice();let count=0;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const q=y*sourceWidth+x+x0,s=mapping[q];if(s<0)continue;
      const sx=s%sourceWidth-x0,sy=Math.floor(s/sourceWidth);if(sx<0||sx>=width||sy<0||sy>=height)continue;
      const from=sy*width+sx,to=y*width+x,value=read?read(source,from):source[from];
      if(write)write(pixels,to,value,from);else pixels[to]=value;count++;
    }
    return count;
  }
  return {records,contains,build,reflect};
});
