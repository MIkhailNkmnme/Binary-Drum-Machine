/* Shared menu hover focus: raise the owner without dimming peers or moving fixed popups. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ZerkMenuGroupFocus=api;})(globalThis,function(){
  'use strict';
  function mount({document:doc=globalThis.document,groups,ownerOf,onChange=()=>{}}){
    let current=null;const saved=[],win=doc.defaultView||globalThis;
    function changeStyle(node,key,value){saved.push({node,key,value,old:node.style.getPropertyValue(key),priority:node.style.getPropertyPriority(key)});node.style.setProperty(key,value,'important');}
    function restore(){for(const {node,key,value,old,priority}of saved.splice(0).reverse())if(node.style.getPropertyValue(key)===value&&node.style.getPropertyPriority(key)==='important'){if(old)node.style.setProperty(key,old,priority);else node.style.removeProperty(key);}}
    function set(group){const all=[...groups()].filter(g=>!g.classList.contains('pt-btn'));if(!all.includes(group))group=null;if(current===group)return;
      restore();current?.classList.remove('may-menu-hover-front');current=group;
      if(group){group.classList.add('may-menu-hover-front');
        // Elevate its existing stacking ancestors too (header versus side rail).
        // Do not reparent nodes or transform a group: its fixed children stay put.
        for(let node=group;node&&node!==doc.body;node=node.parentElement)changeStyle(node,'z-index','2147483642');
      }onChange(group);
    }
    const owner=target=>target?.nodeType===1?ownerOf(target):null;
    const over=e=>{if(e.pointerType!=='touch')set(owner(e.target));};
    const out=e=>{if(e.pointerType!=='touch')set(owner(e.relatedTarget));};
    const clear=()=>set(null);
    doc.addEventListener('pointerover',over,true);doc.addEventListener('pointerout',out,true);doc.addEventListener('pointercancel',clear,true);win.addEventListener('blur',clear);
    return {active:()=>current,clear,destroy(){clear();doc.removeEventListener('pointerover',over,true);doc.removeEventListener('pointerout',out,true);doc.removeEventListener('pointercancel',clear,true);win.removeEventListener('blur',clear);}};
  }
  return {mount};
});
