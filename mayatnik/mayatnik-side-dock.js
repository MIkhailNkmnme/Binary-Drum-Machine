/* Desktop geometry is CSS-only; the live commands keep their native parents and handlers. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.MayatnikSideDock=api;const start=()=>{root.maySideDock ||= api.mount(root);};if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',start,{once:true});else start();}})(globalThis,function(){
 'use strict';
 const mounted=new WeakMap();
 function mount(win){
  const doc=win.document,body=doc.body,button=doc.getElementById('bTemplatePanel');
  if(!body||!button)return {destroy(){}};
  if(mounted.has(body))return mounted.get(body);
  // Add a desktop contour alongside the original 24px SVG, never alter its attributes.
  const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg'),path=doc.createElementNS(svg.namespaceURI,'path');
  svg.classList.add('may-side-library-outline');svg.setAttribute('viewBox','0 0 48 48');svg.setAttribute('aria-hidden','true');path.setAttribute('d','M24 1L47 24L24 47L1 24Z');svg.append(path);button.append(svg);
  body.classList.add('may-side-dock-ready');
  let disposed=false;
  const result={destroy(){if(disposed)return;disposed=true;body.classList.remove('may-side-dock-ready');svg.remove();win.removeEventListener('pagehide',result.destroy);mounted.delete(body);}};
  mounted.set(body,result);win.addEventListener('pagehide',result.destroy,{once:true});return result;
 }
 return {mount};
});
