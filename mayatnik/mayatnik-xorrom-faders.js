/* Independent right-edge volume and tempo controls for the Xorrom transport. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.MayatnikXorromFaders=factory();
})(globalThis,function(){
  'use strict';
  function mount({document:doc,api,anchor}){
    const win=doc.defaultView,panel=doc.createElement('div');
    panel.id='mayXorromFaders';panel.setAttribute('role','group');panel.setAttribute('aria-label','Громкость и темп Xorrom');
    function fader(key,icon,name,max){
      const label=doc.createElement('label'),caption=doc.createElement('span'),input=doc.createElement('input'),value=doc.createElement('output');
      label.dataset.xorromFader=key;caption.textContent=icon;caption.setAttribute('aria-hidden','true');
      input.type='range';input.min='0';input.max=String(max);input.step='1';input.setAttribute('aria-label',name);
      value.setAttribute('aria-hidden','true');label.append(caption,input,value);panel.append(label);
      return {label,input,value,name};
    }
    const volume=fader('gain','♪','Громкость Xorrom',100),tempo=fader('bpm','BPM','Темп Xorrom',1000);
    doc.body.append(panel);
    const positive=n=>Number.isFinite(n)&&n>0;
    const initial=api.getSettings().bpm;
    const below=v=>Math.max(Number.MIN_VALUE,v/4),above=v=>Math.min(Number.MAX_VALUE,v*4);
    let low=Math.min(1,below(positive(initial)?initial:96)),high=Math.max(400,above(positive(initial)?initial:96));
    let disposed=false;
    function at(position){
      if(position<=0)return low;if(position>=1000)return high;
      return Math.exp(Math.log(low)+(Math.log(high)-Math.log(low))*position/1000);
    }
    function show(f,position,text,description){
      if(+f.input.value!==position)f.input.value=String(position);
      if(f.value.textContent!==text)f.value.textContent=text;
      if(f.input.getAttribute('aria-valuetext')!==description){
        f.input.setAttribute('aria-valuetext',description);f.label.title=f.name+' · '+description;
      }
    }
    function sync(){
      if(disposed)return;const s=api.getSettings(),bpm=s.bpm,gain=s.gain;
      if(Number.isFinite(gain)){
        const percent=Number((gain*100).toPrecision(12));
        show(volume,Math.round(percent),String(percent),percent+' %');
      }
      if(!positive(bpm))return;
      if(bpm<low)low=below(bpm);if(bpm>high)high=above(bpm);
      const position=Math.round(1000*(Math.log(bpm)-Math.log(low))/(Math.log(high)-Math.log(low)));
      const exact=String(bpm),short=exact.length<=6?exact:bpm.toPrecision(3).replace(/\.0+(e|$)/,'$1');
      show(tempo,position,short,exact+' BPM');
    }
    volume.input.addEventListener('input',()=>{
      if(disposed)return;
      const gain=+volume.input.value/100;if(api.getSettings().gain!==gain)api.setSettings({gain});sync();
    });
    tempo.input.addEventListener('input',()=>{
      if(disposed)return;
      const bpm=at(+tempo.input.value);if(positive(bpm)&&api.getSettings().bpm!==bpm)api.setSettings({bpm});sync();
    });
    function extend(){
      if(disposed)return;
      const pos=+tempo.input.value;
      if(pos<50)low=below(low);else if(pos>950)high=above(high);
      sync();
    }
    tempo.input.addEventListener('change',extend);
    // Explicit vertical direction also works in browsers that give native
    // range arrows a horizontal direction in vertical writing mode.
    for(const {input} of [volume,tempo])input.addEventListener('keydown',event=>{
      if(disposed)return;
      const dir={ArrowUp:1,ArrowRight:1,ArrowDown:-1,ArrowLeft:-1,PageUp:10,PageDown:-10}[event.key];
      if(!dir&&event.key!=='Home'&&event.key!=='End')return;
      event.preventDefault();event.stopPropagation();
      const max=+input.max,next=event.key==='Home'?0:event.key==='End'?max:Math.min(max,Math.max(0,+input.value+dir));
      input.value=String(next);input.dispatchEvent(new win.Event('input',{bubbles:true}));
      if(input===tempo.input)extend();
    });
    let observed,queued=null;
    const observer=win.ResizeObserver?new win.ResizeObserver(position):null;
    function position(){
      if(disposed)return;
      const target=typeof anchor==='function'?anchor():anchor,r=target?.getBoundingClientRect?.()||target;
      if(target?.nodeType===1&&observed!==target){if(observed)observer?.unobserve(observed);observed=target;observer?.observe(target);}
      if(!r||!(r.width>0&&r.height>0)){panel.style.removeProperty('right');panel.style.removeProperty('top');return;}
      panel.style.right=Math.max(0,Math.min(win.innerWidth-52,Math.max(94,win.innerWidth-r.left+6)))+'px';
      panel.style.top=Math.max(60,Math.min(win.innerHeight-60,r.top+r.height/2))+'px';
    }
    const events=['resize','load','mayatnik-template-panel-change','mayatnik-template-panel-resize'];
    events.forEach(type=>win.addEventListener(type,position));win.visualViewport?.addEventListener('resize',position);
    const unsubscribe=api.subscribe(sync);
    sync();position();if(win.requestAnimationFrame)queued=win.requestAnimationFrame(position);
    function destroy(){
      if(disposed)return;disposed=true;unsubscribe?.();observer?.disconnect();if(queued!==null)win.cancelAnimationFrame?.(queued);
      events.forEach(type=>win.removeEventListener(type,position));win.visualViewport?.removeEventListener('resize',position);panel.remove();
    }
    return {element:panel,sync,position,destroy};
  }
  return {mount};
});
