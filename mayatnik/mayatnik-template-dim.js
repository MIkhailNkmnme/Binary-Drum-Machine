/* View-only selection dimming. Cache is bounded by viewport pixels, never field size. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikTemplateDim=api;})(globalThis,function(){
  'use strict';
  const finiteRect=r=>r&&[r.x,r.y,r.width,r.height].every(Number.isFinite)&&r.width>0&&r.height>0;
  function raster(width,height,dpr,parts=[],selectedAt=null,visibleAt=null){
    dpr=Math.max(.1,Number(dpr)||1);const W=Math.max(1,Math.round(width*dpr)),H=Math.max(1,Math.round(height*dpr)),pixels=new Uint8ClampedArray(W*H*4);
    for(let i=3;i<pixels.length;i+=4)pixels[i]=255;
    if(selectedAt)for(let y=0;y<H;y++)for(let x=0;x<W;x++){const cx=(x+.5)/dpr,cy=(y+.5)/dpr;
      if((!visibleAt||visibleAt(cx,cy))&&selectedAt(cx,cy))pixels[(y*W+x)*4+3]=0;}
    for(const part of parts){const r=part.rect;if(part.visible===false||!finiteRect(r)||!part.data||!(part.width>0&&part.height>0))continue;
      const clip=finiteRect(part.clip)?part.clip:{x:0,y:0,width,height};
      const x0=Math.max(0,Math.floor(Math.max(r.x,clip.x)*dpr)),x1=Math.min(W,Math.ceil(Math.min(r.x+r.width,clip.x+clip.width)*dpr));
      const y0=Math.max(0,Math.floor(Math.max(r.y,clip.y)*dpr)),y1=Math.min(H,Math.ceil(Math.min(r.y+r.height,clip.y+clip.height)*dpr));
      for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const cx=(x+.5)/dpr,cy=(y+.5)/dpr;
        if(cx<r.x||cx>=r.x+r.width||cy<r.y||cy>=r.y+r.height||cx<clip.x||cx>=clip.x+clip.width||cy<clip.y||cy>=clip.y+clip.height||visibleAt&&!visibleAt(cx,cy))continue;
        const sx=Math.min(part.width-1,Math.floor((cx-r.x)/r.width*part.width)),sy=Math.min(part.height-1,Math.floor((cy-r.y)/r.height*part.height)),q=sy*part.width+sx;
        if(part.data[q]&&(!part.bits||part.bits[q]===0||part.bits[q]===1))pixels[(y*W+x)*4+3]=0;
      }
    }
    return {width:W,height:H,data:pixels};
  }
  function create(options={}){
    const tokens=new WeakMap();let serial=0,signature='',canvas=null,builds=0;
    const token=value=>{if(value&&typeof value==='object'){if(!tokens.has(value))tokens.set(value,++serial);return tokens.get(value);}return String(value);};
    function draw(ctx,view){
      if(!view?.active||!(view.width>0&&view.height>0)){signature='';return false;}
      const dpr=Math.max(.1,Number(view.dpr)||1),parts=view.parts||[];
      // key includes host field projection/parity. Tokens identify immutable masks and selections.
      const next=JSON.stringify([view.width,view.height,dpr,view.key,token(view.selectionToken),!!view.selectedAt,!!view.visibleAt,parts.map(p=>[token(p.data),token(p.bits),p.revision,p.width,p.height,p.visible!==false,p.rect,p.clip])]);
      if(next!==signature){
        const mask=raster(view.width,view.height,dpr,parts,view.selectedAt,view.visibleAt);
        if(!canvas)canvas=options.createCanvas?options.createCanvas():document.createElement('canvas');canvas.width=mask.width;canvas.height=mask.height;
        const g=canvas.getContext('2d'),picture=g.createImageData(mask.width,mask.height);picture.data.set(mask.data);g.putImageData(picture,0,0);signature=next;builds++;
      }
      ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=.25;ctx.imageSmoothingEnabled=false;ctx.drawImage(canvas,0,0,view.width,view.height);ctx.restore();return true;
    }
    return {draw,clear(){signature='';canvas=null;},get builds(){return builds;}};
  }
  return {create,raster};
});
