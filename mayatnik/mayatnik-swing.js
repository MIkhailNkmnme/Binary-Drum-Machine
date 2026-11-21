/* Seven equal base divisions; an affine shear keeps the suspension and base height fixed. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikSwing=api;})(globalThis,function(){
  'use strict';
  const STEPS=Object.freeze([0,-1,-2,-3,-2,-1,0,1,2,3,2,1]);
  function advance(index,previous,frame){return ((index+(Number.isFinite(previous)?Math.sign(frame-previous):0))%12+12)%12;}
  function triangle(width,height,read){
    let top=-1,bottom=-1,left=width,right=-1;
    for(let y=0;y<height&&top<0;y++)for(let x=0;x<width;x++)if(read(x,y)>=0){top=y;break;}
    if(top<0)return null;
    for(let y=height-1;y>=top&&bottom<0;y--)for(let x=0;x<width;x++)if(read(x,y)>=0){bottom=y;left=Math.min(left,x);right=Math.max(right,x);}
    return {top,bottom,left,right,width:right-left+1,height:bottom-top+1};
  }
  function point(p,amount,apexY){return {x:p.x+amount*(p.y-apexY),y:p.y};}
  function rect(r,amount,apexY){const x1=amount*(r.top-apexY),x2=amount*(r.top+r.height-apexY),left=r.left+Math.min(x1,x2),width=r.width+Math.abs(amount)*r.height;return {x:left,y:r.top,left,top:r.top,width,height:r.height,right:left+width,bottom:r.top+r.height};}
  function unrect(r,amount,apexY){const x1=amount*(r.top-apexY),x2=amount*(r.top+r.height-apexY),left=r.left-Math.min(x1,x2),width=Math.max(0,r.width-Math.abs(amount)*r.height);return {x:left,y:r.top,left,top:r.top,width,height:r.height,right:left+width,bottom:r.top+r.height};}
  function capture(canvas,amount,makeCanvas){
    if(!amount)return canvas;
    const shift=Math.min(0,amount*canvas.height),out=makeCanvas?makeCanvas():canvas.ownerDocument.createElement('canvas');
    out.width=Math.ceil(canvas.width+Math.abs(amount)*canvas.height);out.height=canvas.height;
    const g=out.getContext('2d');g.setTransform(1,0,amount,1,-shift,0);g.imageSmoothingEnabled=false;g.drawImage(canvas,0,0);return out;
  }
  return {STEPS,advance,triangle,point,rect,unrect,capture};
});
