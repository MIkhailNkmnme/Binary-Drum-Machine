/* Boundaries of semantic 0/1 regions. The reader returns -1 for empty cells. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikBitContours=api;})(globalThis,function(){
  'use strict';
  // -2 is an unavailable historical semantic cell, not empty space.
  const boundary=(a,b)=>a>=-1&&b>=-1&&a!==b&&(a===0||a===1||b===0||b===1);
  function segments({width,height,read,left=0,top=0,right=width,bottom=height},visit){
    const x0=Math.max(0,Math.floor(left)),y0=Math.max(0,Math.floor(top)),x1=Math.min(width,Math.ceil(right)),y1=Math.min(height,Math.ceil(bottom));
    if(x0>=x1||y0>=y1)return 0;
    const bit=(x,y)=>x<0||y<0||x>=width||y>=height?-1:read(x,y);let count=0;
    for(let y=y0;y<=y1;y++){let start=-1;for(let x=x0;x<=x1;x++){const on=x<x1&&boundary(bit(x,y-1),bit(x,y));if(on&&start<0)start=x;if(!on&&start>=0){visit(start,y,x,y);count++;start=-1;}}}
    for(let x=x0;x<=x1;x++){let start=-1;for(let y=y0;y<=y1;y++){const on=y<y1&&boundary(bit(x-1,y),bit(x,y));if(on&&start<0)start=y;if(!on&&start>=0){visit(x,start,x,y);count++;start=-1;}}}
    return count;
  }
  function paint(ctx,{width,height,read,x=0,y=0,scale=1,screenWidth,screenHeight,lineWidth=2,colour='#ffe969'}){
    if(![width,height,x,y,scale,screenWidth,screenHeight,lineWidth].every(Number.isFinite)||!(scale>0)||width<=0||height<=0||screenWidth<=0||screenHeight<=0||lineWidth<=0)return 0;
    // Below one screen pixel per cell, use nearest-cell samples at screen-pixel
    // centres. Cost then follows the viewport, rather than the hidden cell count.
    // This intentionally drops details smaller than a screen pixel at zoom-out.
    const sampled=scale<1,spanX=width*scale,spanY=height*scale;
    const gridWidth=sampled?Math.ceil(spanX):width,gridHeight=sampled?Math.ceil(spanY):height,unit=sampled?1:scale;
    const half=lineWidth/2,left=(-x-half)/unit,top=(-y-half)/unit,right=(screenWidth-x+half)/unit,bottom=(screenHeight-y+half)/unit;
    let reader=read;
    if(sampled){
      const x0=Math.max(0,Math.floor(left)-1),y0=Math.max(0,Math.floor(top)-1),x1=Math.min(gridWidth,Math.ceil(right)+1),y1=Math.min(gridHeight,Math.ceil(bottom)+1);
      if(x0>=x1||y0>=y1)return 0;
      // Cache only the sampled viewport plus neighbours, never the full field.
      const w=x1-x0,h=y1-y0,values=new Int8Array(w*h);values.fill(-3);
      const cols=Array.from({length:w},(_,i)=>Math.min(width-1,Math.floor((x0+i+Math.min(x0+i+1,spanX))*.5/scale)));
      const rows=Array.from({length:h},(_,i)=>Math.min(height-1,Math.floor((y0+i+Math.min(y0+i+1,spanY))*.5/scale)));
      reader=(col,row)=>{const i=col-x0,j=row-y0,at=j*w+i;if(values[at]===-3)values[at]=read(cols[i],rows[j]);return values[at];};
    }
    const screenX=sampled?col=>x+Math.min(col,spanX):col=>x+col*scale;
    const screenY=sampled?row=>y+Math.min(row,spanY):row=>y+row*scale;
    ctx.save();ctx.beginPath();ctx.rect(0,0,screenWidth,screenHeight);ctx.clip();ctx.strokeStyle=colour;ctx.lineWidth=lineWidth;
    ctx.beginPath();
    const count=segments({width:gridWidth,height:gridHeight,read:reader,left,top,right,bottom},(ax,ay,bx,by)=>{ctx.moveTo(screenX(ax),screenY(ay));ctx.lineTo(screenX(bx),screenY(by));});
    ctx.stroke();ctx.restore();return count;
  }
  return {boundary,segments,paint};
});
