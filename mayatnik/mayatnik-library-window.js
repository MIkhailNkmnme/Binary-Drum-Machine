/* A second view of the opener's live library. No field or library is cloned. */
(function(root){
  'use strict';
  root.MayatnikLibraryDetached=true;
  const doc=root.document;let source,api,timer,saveObserver;const listeners=[];
  function disconnected(text){doc.documentElement.classList.add('may-library-disconnected');const status=doc.getElementById('mayLibraryConnection');status.hidden=false;status.textContent=text;root.clearInterval(timer);}
  try{
    source=root.opener;api=source&&!source.closed&&source.mayTemplateLibrary;
    if(!api||!source.MayatnikTemplatePanel)throw Error('source');
    root.mayTemplateLibrary=api;root.mayViewLibrary=source.mayViewLibrary;root.mayFrameLibrary=source.mayFrameLibrary;root.mayLayers=source.mayLayers;root.maySettingsLibrary=source.maySettingsLibrary;
    root.MayatnikTemplateFolderStore=source.MayatnikTemplatePanel.getFolderStore();
  }catch(_){disconnected('Откройте это окно кнопкой «Окно» в Библиотеке работающего Маятника.');return;}
  const proxy=doc.getElementById('bTemplateSave'),original=source.document.getElementById('bTemplateSave');
  const syncSave=()=>{proxy.disabled=!original||original.disabled;};syncSave();proxy.onclick=()=>{if(!proxy.disabled)original.click();};
  if(original){saveObserver=new root.MutationObserver(syncSave);saveObserver.observe(original,{attributes:true,attributeFilter:['disabled']});}
  for(const type of ['may-template-saved','may-template-library-ready','may-view-library-ready','may-frame-library-ready','may-layers-ready','may-settings-library-ready']){
    const listener=e=>root.dispatchEvent(new root.CustomEvent(type,{detail:e.detail}));source.addEventListener(type,listener);listeners.push([type,listener]);
  }
  const ready=()=>root.queueMicrotask(()=>root.MayatnikTemplatePanel?.openTab('templates'));
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
  timer=root.setInterval(()=>{try{if(source.closed||source.mayTemplateLibrary!==api)disconnected('Маятник закрыт или перезагружен. Откройте Библиотеку заново из его окна.');}catch(_){disconnected('Связь с Маятником потеряна. Откройте Библиотеку заново из его окна.');}},1000);
  root.addEventListener('pagehide',()=>{root.clearInterval(timer);saveObserver?.disconnect();for(const [type,listener]of listeners)try{source.removeEventListener(type,listener);}catch(_){}},{once:true});
})(window);
