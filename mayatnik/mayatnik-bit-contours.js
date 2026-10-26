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
  function paint(ctx,{width,height,read,x=0,y=0,scale=1,screenWidth,screenHeight,lineWidth=2,colour='#ffe969',mode='single',colours=['#ffffff','#000000']}){
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
    if(mode==='same'||mode==='double'){
      // Each cell owns its inner strips. Even four-way junctions never put
      // another bit's contour colour into this cell. The outer edge is inward.
      const bit=(col,row)=>col<0||row<0||col>=gridWidth||row>=gridHeight?-1:reader(col,row);
      const x0=Math.max(0,Math.floor(left)),y0=Math.max(0,Math.floor(top)),x1=Math.min(gridWidth,Math.ceil(right)),y1=Math.min(gridHeight,Math.ceil(bottom));
      const paths=[[],[]];let count=0;
      for(let row=y0;row<y1;row++){
        let run=-1,runBit=-1;
        const flush=end=>{if(run>=0){paths[runBit].push([screenX(run),screenY(row),screenX(end)-screenX(run),screenY(row+1)-screenY(row)]);count++;run=-1;}};
        for(let col=x0;col<x1;col++){
          const a=bit(col,row);if(a!==0&&a!==1){flush(col);continue;}
          const thick=b=>b===-1?lineWidth:b===a||mode==='double'&&(b===0||b===1)?half:0;
          const l=thick(bit(col-1,row)),r=thick(bit(col+1,row)),t=thick(bit(col,row-1)),b=thick(bit(col,row+1));
          const X=screenX(col),Y=screenY(row),W=screenX(col+1)-X,H=screenY(row+1)-Y;
          if(l+r>=W||t+b>=H){if(runBit!==a)flush(col);if(run<0){run=col;runBit=a;}continue;}
          flush(col);const add=(x,y,w,h)=>{if(w>0&&h>0){paths[a].push([x,y,w,h]);count++;}};
          add(X,Y,Math.min(l,W),H);add(X+W-Math.min(r,W),Y,Math.min(r,W),H);
          add(X,Y,W,Math.min(t,H));add(X,Y+H-Math.min(b,H),W,Math.min(b,H));
        }flush(x1);
      }
      ctx.save();ctx.beginPath();ctx.rect(0,0,screenWidth,screenHeight);ctx.clip();
      for(let bit=0;bit<2;bit++){ctx.fillStyle=colours[bit];ctx.beginPath();for(const rect of paths[bit])ctx.rect(...rect);ctx.fill();}
      ctx.restore();return count;
    }
    ctx.save();ctx.beginPath();ctx.rect(0,0,screenWidth,screenHeight);ctx.clip();ctx.strokeStyle=colour;ctx.lineWidth=lineWidth;
    ctx.beginPath();
    const count=segments({width:gridWidth,height:gridHeight,read:reader,left,top,right,bottom},(ax,ay,bx,by)=>{ctx.moveTo(screenX(ax),screenY(ay));ctx.lineTo(screenX(bx),screenY(by));});
    ctx.stroke();ctx.restore();return count;
  }
  return {boundary,segments,paint};
});
