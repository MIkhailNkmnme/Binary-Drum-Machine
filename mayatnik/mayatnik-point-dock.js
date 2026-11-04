/* The original follow-point command remains live in an independent fixed dock. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.MayatnikPointDock=api;const start=()=>{root.mayPointDock ||= api.mount(root);};if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',start,{once:true});else start();}})(globalThis,function(){
 'use strict';
 function mount(win){
  const doc=win.document,button=doc.querySelector('[data-n="fixTri"]');if(!doc.body||!button)return {mounted:false,destroy(){}};
  const existing=doc.getElementById('mayPointDock');if(existing)return {mounted:true,destroy(){}};
  const home=doc.createComment('follow point command home');button.before(home);
  const host=doc.createElement('div');host.id='mayPointDock';host.dataset.noMini='';host.setAttribute('role','group');host.setAttribute('aria-label','Следование точки встречи за кадром');
  const svg=(cls,viewBox,path)=>{const shape=doc.createElementNS('http://www.w3.org/2000/svg','svg'),p=doc.createElementNS(shape.namespaceURI,'path');shape.classList.add(cls);shape.setAttribute('viewBox',viewBox);shape.setAttribute('aria-hidden','true');p.setAttribute('d',path);shape.append(p);return shape;};
  const outline=svg('may-point-outline','0 0 48 48','M24 1L47 24 24 47 1 24Z'),glyph=svg('may-point-glyph','0 0 24 24','M12 2V22M2 12H22M12 6L18 12 12 18 6 12Z');
  const label=button.querySelector('.gz-nm');const oldLabel=label?.textContent;if(label)label.textContent='Точк';
  button.dataset.noMini='';button.classList.add('may-point-command');button.append(glyph,outline);host.append(button);doc.body.append(host);
  const guide=doc.createElement('div');guide.id='mayAnchorToPoint';guide.setAttribute('aria-hidden','true');Object.assign(guide.style,{position:'fixed',pointerEvents:'none',zIndex:'4',width:'0',borderLeft:'1px dashed #b48cff',display:'none'});doc.body.append(guide);
  let queued=0;
  function place(){const x=win.mayPointAxisX?.();if(Number.isFinite(x)){const left=x+'px';if(host.style.left!==left)host.style.left=left;}const axis=win.mayAnchorGuide?.(),end=button.getBoundingClientRect().top;if(axis&&Number.isFinite(axis.x)&&Number.isFinite(axis.top)&&end>axis.top){Object.assign(guide.style,{display:'',left:axis.x+'px',top:axis.top+'px',height:(end-axis.top)+'px'});}else guide.style.display='none';}
  function queue(){if(!queued)queued=win.requestAnimationFrame(()=>{queued=0;place();});}
  const viewport=doc.getElementById('wrap');viewport?.addEventListener('scroll',queue,{passive:true});win.addEventListener('resize',queue);win.addEventListener('may-rombo-change',queue);place();
  const events=['pointerdown','pointermove','pointerup','pointercancel','click','dblclick','contextmenu','keydown','keyup','wheel'],isolate=event=>event.stopPropagation();for(const type of events)host.addEventListener(type,isolate);
  let disposed=false;function destroy(){if(disposed)return;disposed=true;if(queued)win.cancelAnimationFrame(queued);viewport?.removeEventListener('scroll',queue);win.removeEventListener('resize',queue);win.removeEventListener('may-rombo-change',queue);for(const type of events)host.removeEventListener(type,isolate);win.removeEventListener('pagehide',onPageHide);guide.remove();outline.remove();glyph.remove();button.classList.remove('may-point-command');if(label)label.textContent=oldLabel;if(home.isConnected)home.after(button);home.remove();host.remove();}
  function onPageHide(event){if(!event.persisted)destroy();}
  win.addEventListener('pagehide',onPageHide);return {mounted:true,button,host,place,destroy};
 }
 return {mount};
});
