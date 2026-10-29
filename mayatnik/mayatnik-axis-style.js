/* One axis palette for Canvas, SVG and DOM. This module never computes geometry. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikAxisStyle=api;})(globalThis,function(){
 'use strict';
 const PURPLE='#b48cff',BLACK='#000000',RED='#ff5a4f',DASH=6;
 const normalise=mode=>mode==='purple-red'?'purple-red':'purple-black';
 const palette=mode=>[PURPLE,normalise(mode)==='purple-red'?RED:BLACK];
 const positive=(v,fallback)=>Number.isFinite(v)&&v>0?v:fallback;
 // The solid lower stroke fills every gap in the upper stroke. A measurement
 // proxy sees only the upper pass, so one geometric line remains one line.
 function stroke(ctx,{mode='purple-black',primary:overridePrimary,width=ctx.lineWidth,unit=1,path,offset=0}={}){
  const [basePrimary,secondary]=palette(mode),primary=overridePrimary||basePrimary,step=DASH*positive(unit,1),raw=ctx.measureTarget||ctx;
  ctx.save();try{ctx.globalAlpha=1;ctx.lineWidth=positive(width,1);ctx.lineCap='butt';ctx.lineDashOffset=Number.isFinite(offset)?offset:0;
   ctx.setLineDash([]);ctx.strokeStyle=secondary;if(path===undefined)raw.stroke();else raw.stroke(path);
   ctx.setLineDash([step,step]);ctx.strokeStyle=primary;if(path===undefined)ctx.stroke();else ctx.stroke(path);
  }finally{ctx.restore();}
 }
 function css(mode){const [primary,secondary]=palette(mode);return {'--may-axis-primary':primary,'--may-axis-secondary':secondary,'--may-axis-dash':DASH+'px'};}
 function applyRoot(root,mode){for(const [key,value]of Object.entries(css(mode)))root.style.setProperty(key,value);root.dataset.axisPalette=normalise(mode);}
 function domLine(element,{width=1}={}){const w=positive(width,1);element.classList.add('may-axis-stroke');element.style.height='0';element.style.setProperty('--may-axis-width',w+'px');element.style.borderTop='0';}
 function svgPaths(doc,d,{mode='purple-black',primary:overridePrimary,width=1,unit=1,offset=0}={}){
  const [basePrimary,secondary]=palette(mode),primary=overridePrimary||basePrimary,step=DASH*positive(unit,1);
  return [secondary,primary].map((colour,i)=>{const p=doc.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',d);p.setAttribute('fill','none');p.style.stroke=colour;p.style.strokeWidth=String(positive(width,1));p.setAttribute('stroke-linecap','butt');if(i){p.setAttribute('stroke-dasharray',step+' '+step);p.setAttribute('stroke-dashoffset',String(Number.isFinite(offset)?offset:0));}return p;});
 }
 return {PURPLE,BLACK,RED,DASH,normalise,palette,stroke,css,applyRoot,domLine,svgPaths};
});
