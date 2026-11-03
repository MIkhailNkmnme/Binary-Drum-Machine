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
    let valueThumb=null;
    const sync=()=>{if(!range)return;const min=range.min===''?0:Number(range.min),max=range.max===''?100:Number(range.max),value=Number(range.value)||0;const side=value<=min+(max-min)/2?'right':'left';if(middle.dataset.valueSide!==side)middle.dataset.valueSide=side;
      if(valueThumb){valueThumb.sync(min,max,value,side);return;}
      // Native 14px thumb travels through the 72px middle, not its full width.
      // Break only the frame directly behind the X; keep the native input live.
      const fraction=max>min?Math.max(0,Math.min(1,(value-min)/(max-min))):0,start=+(58*fraction).toFixed(3),end=+(start+14).toFixed(3),path=contours[1].children[0],d=`M0 0H${start}M${end} 0H72M0 24H${start}M${end} 24H72`;
      if(path.getAttribute('d')!==d)path.setAttribute('d',d);
    };
    if(range&&options.output&&options.valueInThumb===true){
      const output=options.output,svg=outline(middle,'zcf-thumb-outline',72,''),path=svg.children[0],listeners=[],originalSize=output.style.getPropertyValue?.('font-size')||'',originalPriority=output.style.getPropertyPriority?.('font-size')||'';
      let hovered=false,focused=doc.activeElement===range;
      middle.classList.add('zcf-value-in-thumb');
      const listen=(type,fn)=>{range.addEventListener(type,fn);listeners.push([type,fn]);};
      valueThumb={sync(min,max,value,side){
        const active=hovered||focused,fraction=max>min?Math.max(0,Math.min(1,(value-min)/(max-min))):0,center=7+58*fraction;
        // Measure the caller's current text at its normal font before fitting it.
        if(originalSize)output.style.setProperty('font-size',originalSize,originalPriority);else output.style.removeProperty('font-size');
        const measured=output.getBoundingClientRect?.().width||String(output.textContent||'').length*7||7;
        const width=Math.min(72,Math.max(28,measured+16)),left=Math.max(0,Math.min(72-width,center-width/2));
        const start=active?center-7:left,end=active?center+7:left+width;
        middle.classList.toggle('zcf-thumb-active',active);
        const d=`M0 0H${start}M${end} 0H72M0 24H${start}M${end} 24H72`;
        contours[1].children[0].setAttribute('d',d);
        svg.setAttribute('viewBox',`0 0 ${width} 24`);svg.style.left=left+'px';svg.style.width=width+'px';
        path.setAttribute('d',`M12 1H${width-12}L${width-1} 12 ${width-12} 23H12L1 12Z`);
        const available=active?(side==='right'?72-(center+9):center-9):width-16;
        const fitted=Math.min(measured,Math.max(1,available)),labelLeft=active?(side==='right'?center+9:center-9-fitted):left+(width-fitted)/2;
        if(measured>fitted){const size=parseFloat(doc.defaultView?.getComputedStyle(output).fontSize)||11;output.style.setProperty('font-size',(size*fitted/measured)+'px','important');}
        output.style.setProperty('left',labelLeft+'px','important');output.style.setProperty('right','auto','important');
      },dispose(){
        for(const [type,fn]of listeners)range.removeEventListener(type,fn);
        observer?.disconnect();range.removeEventListener('input',sync);range.removeEventListener('change',sync);
      }};
      listen('pointerenter',()=>{hovered=true;sync();});listen('pointerleave',()=>{hovered=false;sync();});
      listen('focus',()=>{focused=true;sync();});listen('blur',()=>{focused=false;sync();});
      const Observer=doc.defaultView?.MutationObserver,observer=Observer?new Observer(sync):null;
      observer?.observe(output,{childList:true,subtree:true,characterData:true});
    }
    if(range){middle.classList.add('zcf-range');range.classList.add('zcf-input');options.output?.classList.add('zcf-value');range.addEventListener('input',sync);range.addEventListener('change',sync);sync();}

    // Hold repeats are owned by the caller; this only keeps the pressed contour visible.
    for(const button of [left,right]){
      let held=false;const release=()=>{if(!held)return;held=false;button.classList.remove('zcf-held');doc.removeEventListener('pointerup',release,true);doc.removeEventListener('pointercancel',release,true);doc.defaultView?.removeEventListener('blur',release);};
      button.addEventListener('pointerdown',e=>{if(e.button!==0||button.disabled)return;held=true;button.classList.add('zcf-held');doc.addEventListener('pointerup',release,true);doc.addEventListener('pointercancel',release,true);doc.defaultView?.addEventListener('blur',release);});
    }
    const result={host,left,middle,right,contours,sync};if(valueThumb)result.dispose=()=>valueThumb.dispose();attached.set(host,result);return result;
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
