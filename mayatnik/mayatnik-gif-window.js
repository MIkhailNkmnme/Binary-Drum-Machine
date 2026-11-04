/* Keep the complete GIF workspace in a reusable same-origin browser window. */
(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports={create:factory};
 else root.MayatnikGifStrip=factory(root,root.MayatnikGifStrip);
})(typeof window==='object'?window:globalThis,function(win,source){
 'use strict';
 let popup=null,viewer=null,local=false,cached=null,settings={},selection=0,busy=false,progress='',recording=false,recordInfo={},stackEnabled=false;
 const target=()=>popup&&!popup.closed?viewer:local?source:null;
 function options(value){
  return {...value,onSelection(detail){selection=detail.index;if(cached)cached.options.selectedVariant=detail.variant?.id;value.onSelection?.(detail);},onDelayChange(delay){settings.delay=delay;if(cached)cached.options.delay=delay;value.onDelayChange?.(delay);}};
 }
 function render(api){
  if(cached){const o=options({...cached.options,...settings,selectedIndex:selection,selectedVariant:cached.options.selectedVariant});
   if(cached.kind==='variants')api.showVariants(cached.data,o);else api.show(cached.data,o);
  }
  api.setBusy(busy);api.setRecording?.(recording,recordInfo);api.setStackEnabled?.(stackEnabled);if(progress)api.setProgress(progress);
 }
 function ensure(){
  if(target()){popup?.focus();return target();}
  let child;try{child=win.open('','mayatnik-gif-scale','popup,width=1100,height=800,resizable=yes,scrollbars=yes');}catch{}
  if(!child){local=true;render(source);return source;}
  popup=child;local=false;
  const doc=child.document;doc.title='Гиф-Масштаб';doc.documentElement.lang='ru';doc.head.replaceChildren();doc.body.replaceChildren();
  const title=doc.createElement('title');title.textContent='Гиф-Масштаб';doc.head.append(title);
  for(const filename of ['grozd.css','mayatnik-gif-strip.css']){
   const original=[...win.document.querySelectorAll('link[rel="stylesheet"]')].find(n=>new URL(n.href).pathname.endsWith('/'+filename));
   const link=doc.createElement('link');link.rel='stylesheet';link.href=original?.href||new URL(filename==='grozd.css'?'../_js/grozd.css?v=50':'mayatnik-gif-strip.css?v=896',win.location.href).href;doc.head.append(link);
  }
  const style=doc.createElement('style');style.textContent='html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#0e1116;color:#dfe6f5;font:12px/1.4 monospace;--mono:monospace;--gz-n:12px;--gz-bg:#1b2430}#mayGifStrip{left:0!important;top:0!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;resize:none}#mayGifStrip .gz-hx{background:#1b2430!important;user-select:none}#mayGifStrip .gz-hx::before{display:none}';doc.head.append(style);
  child.HubButtonText=win.HubButtonText;
  viewer=source.create(child,{onHide:()=>{if(!child.closed)child.close();}});
  render(viewer);child.focus();return viewer;
 }
 function remember(kind,data,value){cached={kind,data,options:{...value}};settings={...value};selection=Number.isInteger(value.selectedIndex)?value.selectedIndex:0;}
 const api={
  openSettings(value={}){settings={...value};const active=ensure();const result=active.openSettings(options(settings));if(local)active.setProgress('Отдельное окно заблокировано браузером. Разрешите всплывающие окна для Маятника.');return result;},
  showVariants(data,value={}){remember('variants',data,value);return target()?.showVariants(data,options(value))??true;},
  show(data,value={}){remember('frames',data,value);return target()?.show(data,options(value))??true;},
  open(){if(!cached)return false;ensure();return target().open();},
  hide(){target()?.hide();},
  setBusy(value){busy=!!value;target()?.setBusy(busy);},
  setRecording(value,info={}){recording=!!value;recordInfo=info;target()?.setRecording?.(recording,info);},
  setStackEnabled(value){stackEnabled=!!value;target()?.setStackEnabled?.(stackEnabled);},
  setProgress(text){progress=String(text||'');target()?.setProgress(progress);},
  refreshSearch(){return target()?.refreshSearch();}
 };
 win.addEventListener('may-gif-search-change',event=>{if(popup&&!popup.closed)popup.dispatchEvent(new popup.CustomEvent('may-gif-search-change',{detail:event.detail}));});
 win.addEventListener('pagehide',()=>{if(popup&&!popup.closed)popup.close();cached=null;});
 return api;
});
