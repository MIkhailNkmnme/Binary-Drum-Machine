/* The live Xorrom settings have their own side window; opening it never starts audio. */
(function(root){
 'use strict';
 const doc=root.document;if(!doc)return;
 const OPEN='mayatnik-music-panel-open',WIDTH='mayatnik-music-panel-width';
 let panel,pane,handle,host,launcher,drag,widthPreference=null,opened=false;
 const read=key=>{try{return root.localStorage.getItem(key);}catch(_){return null;}};
 const save=(key,value)=>{try{root.localStorage.setItem(key,String(value));}catch(_){} };
 const stored=Number(read(WIDTH));if(stored>0&&Number.isFinite(stored))widthPreference=stored;
 function bounds(){const viewport=root.visualViewport?.width||root.innerWidth||800,wrap=doc.getElementById('wrap'),rect=wrap?.getBoundingClientRect(),mobile=doc.body.classList.contains('may-mobile-menu');
  const field=!mobile&&rect?.width>0&&rect?.height>0?rect:null,max=Math.max(120,(field?.width||viewport)-56);
  return {min:Math.min(332,max),max,top:field?Math.max(0,field.top):root.visualViewport?.offsetTop||0,height:field?.height||root.visualViewport?.height||root.innerHeight,right:field?Math.max(0,root.innerWidth-field.right):0};
 }
 function layout(){if(!panel)return;const b=bounds(),width=Math.round(Math.max(b.min,Math.min(b.max,widthPreference??root.innerWidth/2)));
  Object.assign(panel.style,{width:width+'px',top:b.top+'px',height:b.height+'px',right:b.right+'px'});
  Object.assign(handle.style,{height:b.height+'px',right:b.right+width+'px'});handle.style.setProperty('top',b.top+'px','important');
  handle.setAttribute('aria-valuemin',String(b.min));handle.setAttribute('aria-valuemax',String(b.max));handle.setAttribute('aria-valuenow',String(width));handle.setAttribute('aria-valuetext',width+' пикселей');
 }
 function endResize(cancel=false){if(!drag)return;const old=drag;drag=null;if(cancel)widthPreference=old.preference;else save(WIDTH,widthPreference);try{handle.releasePointerCapture(old.id);}catch(_){}doc.body.classList.remove('may-music-panel-resizing');layout();}
 function make(){if(panel)return;panel=doc.createElement('section');panel.id='mayMusicSettingsPanel';panel.hidden=true;panel.setAttribute('role','region');panel.setAttribute('aria-label','Настройки музыки Xorrom');
  const heading=doc.createElement('div');heading.className='may-music-heading';const title=doc.createElement('strong');title.textContent='Музыка / Настройки';
  const close=doc.createElement('button');close.type='button';close.className='may-music-close';close.title='Свернуть настройки музыки';close.setAttribute('aria-label',close.title);close.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path class="may-music-close-edge" d="M12 1 23 12 12 23 1 12Z"/><path class="may-music-close-glyph" d="m8 8 8 8m0-8-8 8"/></svg>';close.addEventListener('click',()=>setOpen(false));heading.append(title,close);
  pane=doc.createElement('div');pane.id='mayMusicSettingsPane';if(host)pane.append(host);panel.append(heading,pane);doc.body.append(panel);
  handle=doc.createElement('div');handle.className='mtp-resize may-music-resize';handle.hidden=true;handle.tabIndex=0;handle.setAttribute('role','separator');handle.setAttribute('aria-orientation','vertical');handle.setAttribute('aria-controls',panel.id);handle.setAttribute('aria-label','Ширина настроек музыки');handle.title='Тянуть левую границу · ← шире · → уже · Home минимум · End максимум';doc.body.append(handle);
  handle.addEventListener('pointerdown',e=>{if(e.button!==0||drag)return;e.preventDefault();e.stopPropagation();drag={id:e.pointerId,x:e.clientX,width:panel.getBoundingClientRect().width,preference:widthPreference};handle.focus({preventScroll:true});try{handle.setPointerCapture(e.pointerId);}catch(_){}doc.body.classList.add('may-music-panel-resizing');});
  handle.addEventListener('pointermove',e=>{if(drag?.id!==e.pointerId)return;e.preventDefault();const b=bounds();widthPreference=Math.max(b.min,Math.min(b.max,drag.width+drag.x-e.clientX));layout();root.dispatchEvent(new root.CustomEvent('mayatnik-music-panel-resize'));});
  handle.addEventListener('pointerup',e=>{if(drag?.id===e.pointerId)endResize();});for(const name of ['pointercancel','lostpointercapture'])handle.addEventListener(name,e=>{if(drag?.id===e.pointerId)endResize(true);});
  handle.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();if(drag)endResize(true);else setOpen(false);return;}if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const b=bounds(),step=e.shiftKey?40:10;widthPreference=e.key==='Home'?b.min:e.key==='End'?b.max:Math.max(b.min,Math.min(b.max,panel.getBoundingClientRect().width+(e.key==='ArrowLeft'?step:-step)));save(WIDTH,widthPreference);layout();root.dispatchEvent(new root.CustomEvent('mayatnik-music-panel-resize'));});
  handle.addEventListener('dblclick',()=>setOpen(false));panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();setOpen(false);}e.stopPropagation();});for(const name of ['pointerdown','click','dblclick'])panel.addEventListener(name,e=>e.stopPropagation());layout();
 }
 function setOpen(value,source){make();const next=!!value,restoreFocus=panel.contains(doc.activeElement)||doc.activeElement===handle;if(next)root.MayatnikTemplatePanel?.setOpen(false);if(source)launcher=source;const changed=opened!==next;opened=next;panel.hidden=handle.hidden=!next;doc.body.classList.toggle('may-music-panel-open',next);save(OPEN,next?'1':'0');if(!next){endResize(true);if(restoreFocus)launcher?.focus({preventScroll:true});}layout();if(changed){root.dispatchEvent(new root.CustomEvent('mayatnik-music-panel-change',{detail:{open:next}}));root.dispatchEvent(new root.Event('resize'));}}
 root.MayatnikMusicPanel={registerControls(node,source){host=node;if(source)launcher=source;make();pane.replaceChildren(node);if(read(OPEN)==='1')setOpen(true);},open(source){setOpen(true,source);},close(){setOpen(false);},toggle(source){setOpen(!opened,source);},isOpen:()=>opened,getElement:()=>panel};
 root.addEventListener('mayatnik-template-panel-change',e=>{if(e.detail?.open&&opened)setOpen(false);});root.addEventListener('resize',layout);root.addEventListener('blur',()=>endResize(true));root.visualViewport?.addEventListener('resize',layout);root.visualViewport?.addEventListener('scroll',layout);
 if(root.ResizeObserver){const observe=()=>{const wrap=doc.getElementById('wrap');if(wrap)new root.ResizeObserver(layout).observe(wrap);};if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',observe,{once:true});else observe();}
})(globalThis);
