/* Temporary visual folds preserve the menu controllers' pins and saved state. */
(function(root){
  'use strict';
  root.MayatnikLibraryMenuFold={mount({groups,panel,popups=()=>[],onLayout=()=>{}}){
    const doc=root.document,saved=new Map(),floating=new Map();let generation=0,queuedGeneration=null;
    const head=group=>group.querySelector(':scope > .pt-l,:scope > .gz-head');
    const logicalOpen=group=>group.matches('.pt-open,.gz-open');
    const intersects=(a,b)=>a.width>0&&a.height>0&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
    const syncHeads=()=>{for(const group of saved.keys())if(group.hasAttribute('data-library-folded'))head(group)?.setAttribute('aria-expanded','false');};
    function unmask(group){group.removeAttribute('data-library-folded');head(group)?.setAttribute('aria-expanded',String(logicalOpen(group)));for(const [node,owner]of floating)if(owner===group)node.removeAttribute('data-library-folded-popup');}
    function restore(){const previous=[...saved.keys()];saved.clear();for(const [node]of floating)node.removeAttribute('data-library-folded-popup');floating.clear();for(const group of previous){unmask(group);if(group.isConnected&&!logicalOpen(group))head(group)?.click();}onLayout();}
    function capture(){const library=panel();if(!library||library.hidden)return;const bounds=library.getBoundingClientRect(),extras=popups().filter(entry=>entry.node?.isConnected),matches=[];
      // Measure all groups before folding any: closing one column can move others.
      for(const group of groups()){if(!logicalOpen(group)||group.matches('.pt-btn'))continue;const regions=[];for(const content of group.querySelectorAll(':scope > .pt-r,:scope > .may-rail-list,:scope > .gz-soty,:scope > .gz-wide')){const rect=content.getBoundingClientRect();if(rect.width&&rect.height)regions.push(rect);else for(const cell of content.querySelectorAll('.gz-hx,.pt-b,.gz-control'))regions.push(cell.getBoundingClientRect());}for(const entry of extras)if(entry.group===group)regions.push(entry.node.getBoundingClientRect());if(regions.some(rect=>intersects(rect,bounds)))matches.push(group);}
      for(const group of matches){saved.set(group,true);group.setAttribute('data-library-folded','');for(const entry of extras)if(entry.group===group){floating.set(entry.node,group);entry.node.setAttribute('data-library-folded-popup','');}}
      syncHeads();onLayout();
    }
    // Coalesce drag frames without cancelling pending captures on every pointer move.
    function queueCapture(){const ticket=generation;if(queuedGeneration===ticket)return;queuedGeneration=ticket;root.requestAnimationFrame(()=>root.requestAnimationFrame(()=>{if(queuedGeneration===ticket)queuedGeneration=null;if(ticket===generation)capture();}));}
    function change(open){++generation;if(!open){restore();return;}queueCapture();}
    const changed=event=>change(!!event.detail?.open);root.addEventListener('mayatnik-template-panel-change',changed);
    root.addEventListener('mayatnik-template-panel-resize',queueCapture);
    function foldedHead(target){const header=target.closest?.('.pt-l,.gz-head'),group=header?.parentElement;return group?.hasAttribute('data-library-folded')?group:null;}
    const clicked=event=>{const group=foldedHead(event.target);if(!group||event.target.closest('.pt-pin,.gz-pin,.zgh-pin'))return;event.preventDefault();event.stopImmediatePropagation();unmask(group);onLayout();};
    const hovered=event=>{if(event.pointerType!=='mouse')return;const group=foldedHead(event.target);if(group){unmask(group);onLayout();}};
    doc.addEventListener('click',clicked,true);doc.addEventListener('pointerover',hovered,true);
    if(root.MayatnikTemplatePanel?.isOpen())change(true);
    return {syncHeads,destroy(){generation++;root.removeEventListener('mayatnik-template-panel-change',changed);root.removeEventListener('mayatnik-template-panel-resize',queueCapture);doc.removeEventListener('click',clicked,true);doc.removeEventListener('pointerover',hovered,true);for(const group of saved.keys())unmask(group);saved.clear();floating.clear();}};
  }};
})(window);
