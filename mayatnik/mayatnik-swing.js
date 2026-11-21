/* Seven equal base divisions; an affine shear keeps the suspension and base height fixed. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikSwing=api;})(globalThis,function(){
  'use strict';
  const STEPS=Object.freeze([0,-1,-2,-3,-2,-1,0,1,2,3,2,1]);
  function advance(index,previous,frame,wrapped=false){return ((index+(wrapped?1:Number.isFinite(previous)?Math.sign(frame-previous):0))%12+12)%12;}
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
  // A display-only copy: neither the scene pixels nor its semantic bits move.
  function lightPicture(pic,geometry,readBit,phaseIndex){
    const out=new ImageData(new Uint8ClampedArray(pic.data),pic.width,pic.height);
    if(!geometry||typeof readBit!=='function')return out;
    const {width,height,data}=out,g=geometry;
    if(!(g.width>0&&g.height>0))return out;
    const phase=((Math.trunc(Number(phaseIndex)||0)%STEPS.length)+STEPS.length)%STEPS.length;
    const swing=-Math.sin(phase*2*Math.PI/STEPS.length);
    const top=Math.max(0,Math.ceil(g.top)),bottom=Math.min(height-1,Math.floor(g.bottom));
    if(top>bottom)return out;
    // The real first occupied row is the suspension, including asymmetric scenes.
    let first=-1,last=-1;
    for(let x=0;x<width;x++)if(readBit(x,top)>=0){if(first<0)first=x;last=x;}
    if(first<0)return out;
    const apexX=(first+last)/2,slope=swing*3*g.width/(7*g.height);
    const sceneLeft=Math.max(0,Math.floor(Math.min(g.left,first))),sceneRight=Math.min(width-1,Math.ceil(Math.max(g.right,last)));
    // Leave headroom even when the user's base palette is already near white.
    for(let i=0;i<data.length;i+=4){data[i]*=.56;data[i+1]*=.56;data[i+2]*=.56;}
    for(let y=top;y<=bottom;y++){
      const depth=(y-top)/Math.max(1,g.height-1),center=apexX+slope*(y-top);
      const radius=Math.max(1.25,g.width*(.012+.038*depth));
      const left=Math.max(sceneLeft,Math.ceil(center-radius)),right=Math.min(sceneRight,Math.floor(center+radius));
      for(let x=left;x<=right;x++){
        const bit=readBit(x,y);if(bit<0)continue;
        const distance=Math.abs(x-center)/radius,t=1-distance;
        const beam=t*t*(3-2*t),i=(y*width+x)*4;
        const one=bit===1,mix=beam*(one ? .96 : .80);
        const r=one?255:169,green=one?222:153,b=one?116:116;
        data[i]+=(r-data[i])*mix;data[i+1]+=(green-data[i+1])*mix;data[i+2]+=(b-data[i+2])*mix;
      }
    }
    // A small optical image of actual nearby bits; its faceted silhouette rocks.
    const radius=Math.max(2,Math.min(9,Math.round(g.height*.035)));
    const centerY=top>=2*radius+3?top-radius-2:Math.min(bottom,top+radius+2);
    const angle=-Math.atan(slope),cos=Math.cos(angle),sin=Math.sin(angle);
    const sampleY=Math.min(bottom,top+Math.max(radius+1,Math.round(g.height*.07)));
    const sampleScale=Math.max(.25,Math.min(2,g.width/Math.max(1,g.height)*.5));
    const reach=Math.ceil(radius*1.4);
    for(let y=Math.max(0,Math.floor(centerY-reach));y<=Math.min(height-1,Math.ceil(centerY+reach));y++){
      for(let x=Math.max(0,Math.floor(apexX-reach));x<=Math.min(width-1,Math.ceil(apexX+reach));x++){
        const dx=x-apexX,dy=y-centerY,u=Math.round(dx*cos+dy*sin),v=Math.round(-dx*sin+dy*cos);
        if(Math.abs(u)+Math.abs(v)>radius)continue;
        const sx=Math.round(apexX+u*sampleScale),sy=Math.round(sampleY+v);
        if(sx<0||sx>=width||sy<top||sy>bottom)continue;
        const bit=readBit(sx,sy);if(bit<0)continue;
        const i=(y*width+x)*4,one=bit===1;
        data[i]=one?255:63;data[i+1]=one?231:80;data[i+2]=one?149:104;data[i+3]=255;
      }
    }
    return out;
  }
  return {STEPS,advance,triangle,point,rect,unrect,capture,lightPicture};
});
