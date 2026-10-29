(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikManualMirrorRaster=api;})(globalThis,function(){
  'use strict';
  function transform(axis,anchor){
    const p=axis.p,k=axis.k||axis.kind;
    if(k==='h')return {matrix:[1,0,0,-1,0,2*p],side:[0,1,-p],positive:axis.m===1};
    if(k==='v'){const x=anchor+.5+p;return {matrix:[-1,0,0,1,2*x,0],side:[1,0,-x],positive:axis.m===1};}
    if(k==='d'){const x=anchor+p;return {matrix:[0,1,1,0,x,-x],side:[1,-1,-x],positive:axis.m!==1};}
    if(k==='e'){const x=anchor+1+p;return {matrix:[0,-1,-1,0,x,x],side:[1,1,-x],positive:axis.m!==1};}
    return null;
  }
  function mapper(base,traces,width,height,scale){
    if(!traces.length)return base;
    return (x,y)=>{
      let xx=(x+.5)/scale,yy=(y+.5)/scale,q=y*width+x,a=1,b=0,c=0,d=1,tx=0,ty=0;
      for(let i=traces.length-1;i>=0;i--){const {mask,matrix:M}=traces[i];if(!(mask[q>>3]&(1<<(q&7))))continue;
        const nx=M[0]*xx+M[1]*yy+M[4],ny=M[2]*xx+M[3]*yy+M[5];xx=nx;yy=ny;
        const na=M[0]*a+M[1]*c,nb=M[0]*b+M[1]*d,nc=M[2]*a+M[3]*c,nd=M[2]*b+M[3]*d,ntx=M[0]*tx+M[1]*ty+M[4],nty=M[2]*tx+M[3]*ty+M[5];a=na;b=nb;c=nc;d=nd;tx=ntx;ty=nty;
        const sx=Math.floor(xx*scale),sy=Math.floor(yy*scale);if(sx<0||sx>=width||sy<0||sy>=height)return null;q=sy*width+sx;
      }
      const cell=base(q%width,Math.floor(q/width),q);if(!cell)return null;
      const cx=cell.x-tx,cy=cell.y-ty;return {...cell,x:a*cx+c*cy,y:b*cx+d*cy};
    };
  }
  function apply(pixels,{width,height,scale=1,anchor=0,axes=[],targetAllowed,put,cellAt,trace=false}){
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||pixels.length!==width*height||!(scale>0))throw Error('Invalid manual mirror raster');
    const plan=axes.filter(z=>(z.m===1||z.m===2)&&Number.isFinite(z.p)).map(axis=>({axis,...transform(axis,anchor)})).filter(x=>x.matrix),traces=[],bytes=Math.ceil(pixels.length/8);
    let allowed=null;
    if(targetAllowed&&plan.some(({axis})=>(axis.k||axis.kind)==='h'&&axis.m===2)){
      allowed=new Uint8Array(bytes);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const q=y*width+x;if(targetAllowed(x,y,q))allowed[q>>3]|=1<<(q&7);}
    }
    for(const {axis,matrix:M,side,positive}of plan){
      const source=pixels.slice(),clip=allowed&&(axis.k||axis.kind)==='h'&&axis.m===2,mask=trace&&cellAt&&!axis.op?new Uint8Array(bytes):null;
      for(let y=0;y<height;y++){const yy=(y+.5)/scale;for(let x=0;x<width;x++){
        const xx=(x+.5)/scale,sd=side[0]*xx+side[1]*yy+side[2],q=y*width+x;
        if(sd===0||(positive?sd<0:sd>0)||clip&&!(allowed[q>>3]&(1<<(q&7))))continue;
        const sx=Math.floor((M[0]*xx+M[1]*yy+M[4])*scale),sy=Math.floor((M[2]*xx+M[3]*yy+M[5])*scale);
        if(sx<0||sx>=width||sy<0||sy>=height)continue;const sq=sy*width+sx;
        const written=put?put(q,source[sq],sq,axis)!==false:(pixels[q]=source[sq],true);
        if(written&&mask)mask[q>>3]|=1<<(q&7);
      }}
      if(mask)traces.push({mask,matrix:M});
    }
    return {cellAt:cellAt?mapper(cellAt,traces,width,height,scale):null,traceBytes:traces.length*bytes};
  }
  return {apply,transform};
});
