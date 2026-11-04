(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikBitGlyph=api;})(globalThis,function(){
 'use strict';
 function draw(ctx,text,x,y,stroke=false){const baseline=ctx.textBaseline,align=ctx.textAlign;ctx.textBaseline='alphabetic';ctx.textAlign='center';const m=ctx.measureText?.(text);if(m&&[m.actualBoundingBoxAscent,m.actualBoundingBoxDescent,m.actualBoundingBoxLeft,m.actualBoundingBoxRight].every(Number.isFinite)){x+=(m.actualBoundingBoxLeft-m.actualBoundingBoxRight)/2;y+=(m.actualBoundingBoxAscent-m.actualBoundingBoxDescent)/2;}else ctx.textBaseline='middle';if(stroke)ctx.strokeText(text,x,y);ctx.fillText(text,x,y);ctx.textBaseline=baseline;ctx.textAlign=align;}
 return {draw};
});
