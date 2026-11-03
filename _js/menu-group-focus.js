/* Shared menu hover focus: raise the owner without dimming peers or moving fixed popups. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ZerkMenuGroupFocus=api;})(globalThis,function(){
  'use strict';
  function outlineOwner(groups,x,y,preferred){
    if(!Number.isFinite(x)||!Number.isFinite(y))return null;
    const visible=node=>{const r=node.getBoundingClientRect(),s=node.ownerDocument.defaultView.getComputedStyle(node);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
    const inside=(points,px,py)=>{let hit=false;for(let i=0,j=points.length-1;i<points.length;j=i++){
      const [ax,ay]=points[j],[bx,by]=points[i],cross=(px-ax)*(by-ay)-(py-ay)*(bx-ax);
      if(Math.abs(cross)<1e-7&&px>=Math.min(ax,bx)&&px<=Math.max(ax,bx)&&py>=Math.min(ay,by)&&py<=Math.max(ay,by))return true;
      if((ay>py)!==(by>py)&&px<(bx-ax)*(py-ay)/(by-ay)+ax)hit=!hit;
    }return hit;};
    const all=[...groups],ordered=preferred?[preferred,...all.filter(g=>g!==preferred)]:all;
    for(const group of ordered){
      if(!all.includes(group)||!group.matches('.pt-open,.gz-open')||group.matches('.pt-btn,[data-library-folded]'))continue;
      const head=group.querySelector(':scope > .pt-l,:scope > .gz-head');if(!head||!visible(head))continue;
      const owned=node=>node.closest('.pt-g,.gz-group')===group;
      for(const svg of group.querySelectorAll('.may-standard-contours')){
        if(!owned(svg)||!visible(svg.parentElement))continue;
        try{const matrix=svg.getScreenCTM()?.inverse();if(!matrix)continue;
          const px=matrix.a*x+matrix.c*y+matrix.e,py=matrix.b*x+matrix.d*y+matrix.f;
          for(const polygon of svg.querySelectorAll(':scope > polygon')){
            const values=(polygon.getAttribute('points')||'').trim().split(/[\s,]+/).map(Number),points=[];
            if(values.length<6||values.length%2||!values.every(Number.isFinite))continue;
            for(let i=0;i<values.length;i+=2)points.push([values[i],values[i+1]]);
            if(inside(points,px,py))return group;
          }
        }catch(_){}
      }
      const h=head.getBoundingClientRect();let nearest=null;
      for(const button of group.querySelectorAll('button,.gz-hx,[role="button"]')){
        if(button===head||head.contains(button)||!owned(button)||!visible(button))continue;
        const r=button.getBoundingClientRect(),left=Math.max(h.left,r.left),right=Math.min(h.right,r.right);
        const top=r.bottom<=h.top?h.top:r.top>=h.bottom?h.bottom:null,bottom=r.bottom<=h.top?r.bottom:r.top>=h.bottom?r.top:null;
        if(top===null||left>=right)continue;const gap=Math.abs(bottom-top);
        if(gap<=24&&(!nearest||gap<nearest.gap))nearest={left,right,top:Math.min(top,bottom),bottom:Math.max(top,bottom),gap};
      }
      if(nearest&&x>=nearest.left&&x<=nearest.right&&y>=nearest.top&&y<=nearest.bottom)return group;
    }return null;
  }
  function mount({document:doc=globalThis.document,groups,ownerOf,ownerAtPoint,onChange=()=>{}}){
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
    const resolve=(e,target)=>owner(target)||ownerAtPoint?.(e,current)||null;
    const over=e=>{if(e.pointerType!=='touch')set(resolve(e,e.target));};
    const out=e=>{if(e.pointerType!=='touch')set(e.relatedTarget?resolve(e,e.relatedTarget):null);};
    const move=e=>{if(e.pointerType!=='touch')set(resolve(e,e.target));};
    const clear=()=>set(null);
    doc.addEventListener('pointerover',over,true);doc.addEventListener('pointerout',out,true);if(ownerAtPoint)doc.addEventListener('pointermove',move,true);doc.addEventListener('pointercancel',clear,true);win.addEventListener('blur',clear);
    return {active:()=>current,clear,destroy(){clear();doc.removeEventListener('pointerover',over,true);doc.removeEventListener('pointerout',out,true);doc.removeEventListener('pointermove',move,true);doc.removeEventListener('pointercancel',clear,true);win.removeEventListener('blur',clear);}};
  }
  return {mount,outlineOwner};
});
