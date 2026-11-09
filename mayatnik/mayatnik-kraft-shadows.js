/* Screen-only silhouette copies from the Kraftwerk cover preset. */
(function(root){
  'use strict';
  const light={offset:-.22,colour:'#f3f5ef'},dark={offset:.28,colour:'#292d32'};
  let scratch;
  function paint(ctx,{read,cols,rows,x,y,sx,sy}){
    if(!(sx>0&&sy>0&&cols>0&&rows>0))return;
    const {width,height}=ctx.canvas;
    const stepX=Math.max(1,sx),stepY=Math.max(1,sy),spanX=cols*sx,spanY=rows*sy;
    const x0=Math.max(0,Math.floor((-x-dark.offset*sx)/stepX)),x1=Math.min(Math.ceil(spanX/stepX),Math.ceil((width-x-light.offset*sx)/stepX));
    const y0=Math.max(0,Math.floor((-y-dark.offset*sy)/stepY)),y1=Math.min(Math.ceil(spanY/stepY),Math.ceil((height-y-light.offset*sy)/stepY));
    if(x0>=x1||y0>=y1)return;
    // In overview, pick one source cell per screen pixel. Offsets still use the source pitch.
    const columns=Array.from({length:x1-x0},(_,i)=>Math.min(cols-1,Math.floor(((x0+i)*stepX+Math.min(spanX,(x0+i+1)*stepX))/2/sx)));
    const mask=new Path2D();let any=false;
    for(let row=y0;row<y1;row++){
      const top=row*stepY,bottom=Math.min(spanY,top+stepY),r=Math.min(rows-1,Math.floor((top+bottom)/2/sy));
      let start=-1;
      for(let col=x0;col<=x1;col++){
        if(col<x1&&read(columns[col-x0],r)===1){if(start<0)start=col;}
        else if(start>=0){
          const left=start*stepX;
          mask.rect(x+left,y+top,Math.min(spanX,col*stepX)-left,bottom-top);
          start=-1;any=true;
        }
      }
    }
    if(!any)return;
    scratch=scratch||ctx.canvas.ownerDocument.createElement('canvas');
    if(scratch.width!==width)scratch.width=width;
    if(scratch.height!==height)scratch.height=height;
    const g=scratch.getContext('2d');g.clearRect(0,0,width,height);
    for(const {offset,colour} of [light,dark]){
      g.setTransform(1,0,0,1,offset*sx,offset*sy);g.fillStyle=colour;g.fill(mask);
    }
    g.setTransform(1,0,0,1,0,0);
    g.globalCompositeOperation='destination-out';g.fill(mask);g.globalCompositeOperation='source-over';
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(scratch,0,0);ctx.restore();
  }
  root.MayatnikKraftShadows={paint};
})(globalThis);
