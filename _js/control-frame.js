/* Three independent contour regions and separate X joints. Existing controls stay live. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ZerkControlFrame=api;})(globalThis,function(){
  'use strict';
  const attached=new WeakMap();
  function attach(host,left,middle,right){
    if(attached.has(host))return attached.get(host);
    const doc=host.ownerDocument||document;
    const outline=(parent,cls,width,path)=>{const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg'),p=doc.createElementNS(svg.namespaceURI,'path');svg.classList.add(cls);svg.setAttribute('viewBox',`0 0 ${width} 24`);svg.setAttribute('aria-hidden','true');p.setAttribute('d',path);svg.append(p);parent.append(svg);return svg;};
    host.classList.add('zcf-control');left.classList.add('zcf-side','zcf-left');right.classList.add('zcf-side','zcf-right');middle.classList.add('zcf-middle');
    const contours=[outline(left,'zcf-outline',24,'M18 0H12L0 12 12 24H18'),outline(middle,'zcf-outline',72,'M6 0H66M6 24H66'),outline(right,'zcf-outline',24,'M6 0H12L24 12 12 24H6')];
    const joints=outline(host,'zcf-joints',120,'M18 0L30 24M30 0L18 24M90 0L102 24M102 0L90 24');
    // Hold repeats are owned by the caller; this only keeps the pressed contour visible.
    for(const button of [left,right]){
      let held=false;const release=()=>{if(!held)return;held=false;button.classList.remove('zcf-held');doc.removeEventListener('pointerup',release,true);doc.removeEventListener('pointercancel',release,true);doc.defaultView?.removeEventListener('blur',release);};
      button.addEventListener('pointerdown',e=>{if(e.button!==0||button.disabled)return;held=true;button.classList.add('zcf-held');doc.addEventListener('pointerup',release,true);doc.addEventListener('pointercancel',release,true);doc.defaultView?.addEventListener('blur',release);});
    }
    const result={host,left,middle,right,contours,joints};attached.set(host,result);return result;
  }
  return {version:1,attach};
});
