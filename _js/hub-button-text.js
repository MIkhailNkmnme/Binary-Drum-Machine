/* Хаб: правила видимых подписей. Исходные контролы и ключи меню не меняются. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else{root.HubButtonText=api;const start=()=>api.observe(document);if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});}
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const controls='button,[role="button"],a.menu-btn,.gz-hx,.gz-half,.gz-vh,.gz-vt,summary,label.hubRhomb,.panel-title';
  const excluded='script,style,noscript,textarea,select,input,svg,canvas,.gz-ic,.hubIcG,.hubPgIcon,.gz-mico,.hubPresetName,[data-user-label],[contenteditable],#hubFieldTools,#hubMenuSources,#hubZoom';
  const shortCaption=text=>text.replace(/[а-яё]+/giu,word=>{
    const compact=word.replace(/(?<=[бвгджзйклмнпрстфхцчшщ])[аеёиоуыэюя](?=[бвгджзйклмнпрстфхцчшщ])/giu,'');
    return /[бвгджзйклмнпрстфхцчшщ]$/iu.test(compact)?compact+(word===word.toLocaleUpperCase('ru')?'Ъ':'ъ'):compact;
  });
  function observe(doc){
    const sources=new WeakMap(),managedAria=new WeakMap(),managedTitle=new WeakMap();
    const ownerOf=node=>{const p=node.parentElement;return p&&!p.closest(excluded)?p.closest(controls):null;};
    function describe(owner){
      if(!owner.isConnected)return;
      const parts=[],walker=doc.createTreeWalker(owner,NodeFilter.SHOW_TEXT);
      while(walker.nextNode()){const node=walker.currentNode;if(ownerOf(node))parts.push(sources.get(node)?.full||node.data);}
      const full=parts.join('').trim();if(!full)return;
      // hub-tips temporarily owns title while hovered. Restoring it here would
      // make its observer remove it again forever and freeze pointer input.
      const hoveredTip=owner.dataset.hubTip;
      if(hoveredTip==null&&(!owner.title||owner.title===managedTitle.get(owner))){
        if(owner.title!==full)owner.title=full;managedTitle.set(owner,full);
      }
      const aria=owner.getAttribute('aria-label');
      if(aria===null||aria===managedAria.get(owner)){
        // У копируемых кнопок title также служит устойчивым ключом ромбосетки.
        const label=owner.title||hoveredTip||full;if(aria!==label)owner.setAttribute('aria-label',label);managedAria.set(owner,label);
      }
    }
    function apply(root){
      const owners=new Set();
      const visit=node=>{
        const owner=ownerOf(node);if(!owner)return;
        const old=sources.get(node),full=old&&node.data===old.short?old.full:node.data,short=shortCaption(full);
        sources.set(node,{full,short});if(node.data!==short)node.data=short;owners.add(owner);
      };
      if(root.nodeType===Node.TEXT_NODE)visit(root);
      else if(root.nodeType===Node.ELEMENT_NODE&&!root.matches(excluded)){
        const walker=doc.createTreeWalker(root,NodeFilter.SHOW_TEXT);while(walker.nextNode())visit(walker.currentNode);
      }
      for(const owner of owners)describe(owner);
    }
    apply(doc.body);
    const observer=new MutationObserver(records=>{
      for(const record of records){
        if(record.type==='characterData')apply(record.target);
        else if(record.type==='childList')for(const node of record.addedNodes)apply(node);
        else if(record.target.matches(controls)&&!record.target.closest(excluded))describe(record.target);
      }
    });
    observer.observe(doc.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title']});
    return {disconnect:()=>observer.disconnect(),apply};
  }
  return {shortCaption,observe};
});
