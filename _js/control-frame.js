/* Three independent contour regions; X is the native range thumb. Existing controls stay live. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ZerkControlFrame=api;})(globalThis,function(){
  'use strict';
  const attached=new WeakMap(),pairSwitches=new WeakMap();
  function attach(host,left,middle,right,options={}){
    if(attached.has(host))return attached.get(host);
    const doc=host.ownerDocument||document;
    const outline=(parent,cls,width,path)=>{const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg'),p=doc.createElementNS(svg.namespaceURI,'path');svg.classList.add(cls);svg.setAttribute('viewBox',`0 0 ${width} 24`);svg.setAttribute('aria-hidden','true');p.setAttribute('d',path);svg.append(p);parent.append(svg);return svg;};
    host.classList.add('zcf-control');left.classList.add('zcf-side','zcf-left');right.classList.add('zcf-side','zcf-right');middle.classList.add('zcf-middle');
    const contours=[outline(left,'zcf-outline',24,'M24 0H12L0 12 12 24H24'),outline(middle,'zcf-outline',72,'M0 0H72M0 24H72'),outline(right,'zcf-outline',24,'M0 0H12L24 12 12 24H0')];
    const range=options.input?.type==='range'?options.input:null;
    const sync=()=>{if(!range)return;const min=Number(range.min)||0,max=Number(range.max)||100,value=Number(range.value)||0;const side=value<=min+(max-min)/2?'right':'left';if(middle.dataset.valueSide!==side)middle.dataset.valueSide=side;};
    if(range){middle.classList.add('zcf-range');range.classList.add('zcf-input');options.output?.classList.add('zcf-value');range.addEventListener('input',sync);sync();}

    // Hold repeats are owned by the caller; this only keeps the pressed contour visible.
    for(const button of [left,right]){
      let held=false;const release=()=>{if(!held)return;held=false;button.classList.remove('zcf-held');doc.removeEventListener('pointerup',release,true);doc.removeEventListener('pointercancel',release,true);doc.defaultView?.removeEventListener('blur',release);};
      button.addEventListener('pointerdown',e=>{if(e.button!==0||button.disabled)return;held=true;button.classList.add('zcf-held');doc.addEventListener('pointerup',release,true);doc.addEventListener('pointercancel',release,true);doc.defaultView?.addEventListener('blur',release);});
    }
    const result={host,left,middle,right,contours,sync};attached.set(host,result);return result;
  }
  const pairShapes=[
    {face:'M12 0H60L48 12 60 24H12L0 12Z',outer:'M60 0H12L0 12 12 24H60',side:'M12 0L0 12 12 24'},
    {face:'M0 0H48L60 12 48 24H0L12 12Z',outer:'M0 0H48L60 12 48 24H0',side:'M48 0L60 12 48 24'}
  ];
  function pairGeometry(index){return pairShapes[index];}
  function pairSwitch(host,options){
    if(pairSwitches.has(host))return pairSwitches.get(host);
    const doc=host.ownerDocument||document,button=doc.createElement('button');button.type='button';button.className='zcf-pair-switch';button.dataset.noMini='';
    const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg'),polygon=doc.createElementNS(svg.namespaceURI,'polygon');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');polygon.setAttribute('points','12,0 24,12 12,24 0,12');svg.append(polygon);button.append(svg);
    const sync=()=>{const states=options.read(),all=states.every(Boolean),some=states.some(Boolean),pressed=all?'true':some?'mixed':'false',label=all?'Выключить обе стороны':'Включить обе стороны';if(button.getAttribute('aria-pressed')!==pressed)button.setAttribute('aria-pressed',pressed);if(button.title!==label){button.title=label;button.setAttribute('aria-label',label);}};
    button.addEventListener('pointerdown',e=>e.stopPropagation());
    button.addEventListener('click',e=>{e.stopPropagation();options.onToggle(!options.read().every(Boolean));sync();});
    host.classList.add('zcf-switch-pair');host.append(button);const result={button,sync};pairSwitches.set(host,result);sync();return result;
  }
  return {version:2,attach,pairSwitch,pairGeometry};
});
