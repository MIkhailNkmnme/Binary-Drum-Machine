/* Visual axis bands only: fractional cell-centre axes use the previous whole column. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikAxisColumn=api;})(globalThis,function(){
 'use strict';
 function column(center,width){if(!Number.isFinite(center)||Math.abs(center-Math.round(center))<1e-9)return null;const col=Math.floor(center);return col>=0&&col<width?col:null;}
 function mount(host){
  const doc=host.ownerDocument,root=doc.createElement('div');root.className='may-axis-columns';root.setAttribute('aria-hidden','true');Object.assign(root.style,{position:'fixed',pointerEvents:'none',overflow:'hidden',zIndex:'2'});doc.body.append(root);
  function update(view){root.hidden=!view;if(!view)return;Object.assign(root.style,{left:view.left+'px',top:view.top+'px',width:view.width+'px',height:view.height+'px'});
   const cells=[...new Set(view.axes.map(x=>column(x,view.columns)).filter(x=>x!==null))],nodes=[];
   for(const col of cells){const left=view.x+col*view.scale,top=Math.max(0,view.y),bottom=Math.min(view.height,view.y+view.rows*view.scale);if(bottom<=top||left>=view.width||left+view.scale<=0)continue;const strip=doc.createElement('div');strip.dataset.column=col;Object.assign(strip.style,{position:'absolute',left:left+'px',top:top+'px',width:view.scale+'px',height:(bottom-top)+'px',background:'color-mix(in srgb,var(--may-axis-primary,#b48cff) 22%,transparent)'});nodes.push(strip);}
   root.replaceChildren(...nodes);
  }
  return {root,update};
 }
 return {column,mount};
});
