/* Persistent fill picker. Host contract:
 * mount({wrap,canvas,colourInput,isActive:()=>fillMode,paintAt:(x,y,o)=>fillAt(x,y,o.shiftKey,true),bounds?})
 * Call sync() after tool-mode changes. Call handleContextMenu(e) before other
 * field context actions; it consumes only pointer context clicks on the field.
 * The host must also give fill-mode right pointerdown priority over template drag.
 * bounds() may return the field viewport excluding docked menus/library panels.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikFillPalette=api;})(globalThis,function(){
  'use strict';
  const RAINBOW=Object.freeze(['#ff0000','#ff7f00','#ffff00','#00ff00','#00bfff','#0000ff','#8b00ff']);
  const NAMES=['Красный','Оранжевый','Жёлтый','Зелёный','Голубой','Синий','Фиолетовый'];
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
  function normalise(value){let hex=String(value||'').trim();if(/^#?[0-9a-f]{3}$/i.test(hex)){hex=hex.replace('#','');hex='#'+[...hex].map(c=>c+c).join('');}else if(/^[0-9a-f]{6}$/i.test(hex))hex='#'+hex;return /^#[0-9a-f]{6}$/i.test(hex)?hex.toLowerCase():null;}
  function rgb(hex){const value=normalise(hex);return value?[1,3,5].map(i=>parseInt(value.slice(i,i+2),16)):null;}
  function hexToHsv(hex){
    const values=rgb(hex);if(!values)return null;const [r,g,b]=values.map(v=>v/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
    let h=!d?0:max===r?60*((g-b)/d%6):max===g?60*((b-r)/d+2):60*((r-g)/d+4);if(h<0)h+=360;
    return {h,s:max?d/max*100:0,v:max*100};
  }
  function hsvToHex(h,s,v){
    h=((Number(h)||0)%360+360)%360;s=clamp(s,0,100)/100;v=clamp(v,0,100)/100;
    const c=v*s,x=c*(1-Math.abs(h/60%2-1)),m=v-c,parts=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
    return '#'+parts.map(n=>Math.round((n+m)*255).toString(16).padStart(2,'0')).join('');
  }
  function nextRainbow(hex){
    const hsv=hexToHsv(hex);if(!hsv||hsv.s<1)return RAINBOW[0];let nearest=0,best=Infinity;
    RAINBOW.forEach((colour,i)=>{const diff=Math.abs(hexToHsv(colour).h-hsv.h),distance=Math.min(diff,360-diff);if(distance<best){best=distance;nearest=i;}});
    return RAINBOW[(nearest+1)%RAINBOW.length];
  }
  function placement(bounds,width,height,inset=8){
    const availableWidth=Math.max(0,bounds.right-bounds.left-2*inset),availableHeight=Math.max(0,bounds.bottom-bounds.top-2*inset),w=Math.min(width,availableWidth),h=Math.min(height,availableHeight);
    return {left:bounds.right-inset-w,top:bounds.bottom-inset-h,width:w,maxHeight:availableHeight,visible:w>=100&&h>=48};
  }
  function mount({wrap,canvas,colourInput,isActive,paintAt,bounds,document:doc=wrap?.ownerDocument,window:win=doc?.defaultView}){
    if(!wrap||!canvas||!colourInput||typeof isActive!=='function'||typeof paintAt!=='function')throw Error('Fill palette requires field, colour input, active state and paint callback');
    const panel=doc.createElement('section');panel.className='may-fill-palette';panel.dataset.noMini='';panel.setAttribute('aria-label','Палитра заливки');panel.hidden=true;
    panel.innerHTML='<div class="may-fill-palette-title">Заливка</div><div class="may-fill-sv" role="slider" tabindex="0" aria-label="Насыщенность и яркость" aria-valuemin="0" aria-valuemax="100"><i aria-hidden="true"></i></div>'
      +'<label class="may-fill-hue-label">Тон<input class="may-fill-hue" type="range" min="0" max="360" step="1" aria-label="Цветовой тон"></label>'
      +'<label class="may-fill-hex-label"><span class="may-fill-sample" aria-hidden="true"></span>HEX<input class="may-fill-hex" type="text" maxlength="7" spellcheck="false" aria-label="Цвет HEX"></label>'
      +'<div class="may-fill-rgb" aria-label="Цвет RGB">'+['R','G','B'].map(n=>'<label>'+n+'<input type="number" min="0" max="255" step="1" data-fill-channel="'+n+'" aria-label="'+({R:'Красный',G:'Зелёный',B:'Синий'})[n]+' канал"></label>').join('')+'</div>'
      +'<div class="may-fill-rainbow" role="group" aria-label="Цвета радуги">'+RAINBOW.map((colour,i)=>'<button type="button" data-fill-colour="'+colour+'" aria-label="'+NAMES[i]+'" title="'+NAMES[i]+'" aria-pressed="false"><svg class="may-fill-swatch-outline" viewBox="0 0 120 24" preserveAspectRatio="none" aria-hidden="true"><polygon points="12,0 108,0 120,12 108,24 12,24 0,12"/></svg></button>').join('')+'</div>';
    doc.body.append(panel);
    const sv=panel.querySelector('.may-fill-sv'),marker=sv.querySelector('i'),hue=panel.querySelector('.may-fill-hue'),hex=panel.querySelector('.may-fill-hex'),channels=[...panel.querySelectorAll('[data-fill-channel]')],swatches=[...panel.querySelectorAll('[data-fill-colour]')],sample=panel.querySelector('.may-fill-sample');
    const dispose=[];let colour=normalise(colourInput.value)||'#ff7f27',hsv=hexToHsv(colour),drag=null,destroyed=false;
    const listen=(node,type,fn,options)=>{node.addEventListener(type,fn,options);dispose.push(()=>node.removeEventListener(type,fn,options));};
    function render(){
      panel.style.setProperty('--fill-hue',String(hsv.h));marker.style.left=hsv.s+'%';marker.style.top=(100-hsv.v)+'%';sample.style.backgroundColor=colour;
      sv.setAttribute('aria-valuenow',String(Math.round(hsv.s)));sv.setAttribute('aria-valuetext','Насыщенность '+Math.round(hsv.s)+'%, яркость '+Math.round(hsv.v)+'%');hue.value=String(Math.round(hsv.h));
      if(doc.activeElement!==hex)hex.value=colour;const values=rgb(colour);channels.forEach((node,i)=>{if(doc.activeElement!==node)node.value=String(values[i]);});
      for(const swatch of swatches){swatch.style.backgroundColor=swatch.dataset.fillColour;swatch.setAttribute('aria-pressed',String(swatch.dataset.fillColour===colour));}
    }
    function read(){const value=normalise(colourInput.value);if(value&&value!==colour){colour=value;hsv=hexToHsv(value);}render();}
    function publish(final){
      render();const changed=colourInput.value!==colour;colourInput.value=colour;
      if(changed)colourInput.dispatchEvent(new win.Event('input',{bubbles:true}));if(final)colourInput.dispatchEvent(new win.Event('change',{bubbles:true}));
    }
    function setColour(value,final=true){const valueHex=normalise(value);if(!valueHex)return false;colour=valueHex;hsv=hexToHsv(colour);publish(final);return true;}
    function fromHsv(final=false){colour=hsvToHex(hsv.h,hsv.s,hsv.v);publish(final);}
    function fieldBounds(){
      if(bounds)return bounds();const r=wrap.getBoundingClientRect(),b={left:Math.max(0,r.left),top:Math.max(0,r.top),right:Math.min(win.innerWidth,r.right),bottom:Math.min(win.innerHeight,r.bottom)};
      for(const node of doc.querySelectorAll('.may-dock-side,#mayBottomBar,header,#mayatnikTemplatePanel')){
        if(node.hidden||!node.getClientRects().length)continue;const q=node.getBoundingClientRect();if(q.width<=0||q.height<=0)continue;
        if(q.left>=b.left+(b.right-b.left)/2&&q.right>=b.right-8)b.right=Math.min(b.right,q.left-4);
        else if(q.right<=b.left+(b.right-b.left)/2&&q.left<=b.left+8)b.left=Math.max(b.left,q.right+4);
        else if(q.width>=(b.right-b.left)/2&&q.top<=b.top+8)b.top=Math.max(b.top,q.bottom+4);
        else if(q.width>=(b.right-b.left)/2&&q.bottom>=b.bottom-8)b.bottom=Math.min(b.bottom,q.top-4);
      }
      return b;
    }
    function position(){
      if(panel.hidden)return;const p=placement(fieldBounds(),240,panel.scrollHeight||280);Object.assign(panel.style,{left:p.left+'px',top:p.top+'px',width:p.width+'px',maxHeight:p.maxHeight+'px'});panel.hidden=!p.visible;
    }
    function sync(){if(destroyed)return;const active=!!isActive();panel.hidden=!active;if(!active)drag=null;doc.body.classList.toggle('may-fill-active',active);wrap.classList.toggle('may-fill-pencil',active);canvas.classList.toggle('may-fill-pencil',active);if(active){read();position();}}
    function handleContextMenu(e){
      if(destroyed||!isActive()||e.button!==2||!Number.isFinite(e.clientX)||!Number.isFinite(e.clientY)||!wrap.contains(e.target)||e.target.closest?.('button,input,select,textarea,a,[role="button"],[role="slider"],.may-fill-palette'))return false;
      const r=canvas.getBoundingClientRect();if(e.clientX<r.left||e.clientX>=r.right||e.clientY<r.top||e.clientY>=r.bottom)return false;
      e.preventDefault();e.stopImmediatePropagation();setColour(nextRainbow(colourInput.value));paintAt(e.clientX,e.clientY,{forcePaint:true,shiftKey:!!e.shiftKey});return true;
    }
    function svAt(e){const r=sv.getBoundingClientRect();if(!r.width||!r.height)return;hsv.s=clamp((e.clientX-r.left)/r.width*100,0,100);hsv.v=100-clamp((e.clientY-r.top)/r.height*100,0,100);fromHsv();}
    listen(sv,'pointerdown',e=>{if(e.button!==0)return;e.preventDefault();drag=e.pointerId;sv.setPointerCapture?.(e.pointerId);svAt(e);});
    listen(sv,'pointermove',e=>{if(drag===e.pointerId)svAt(e);});
    for(const type of ['pointerup','pointercancel'])listen(sv,type,e=>{if(drag!==e.pointerId)return;drag=null;publish(true);});
    listen(sv,'keydown',e=>{const step=e.shiftKey?10:1;switch(e.key){case'ArrowLeft':hsv.s-=step;break;case'ArrowRight':hsv.s+=step;break;case'ArrowUp':hsv.v+=step;break;case'ArrowDown':hsv.v-=step;break;case'Home':hsv.s=0;break;case'End':hsv.s=100;break;default:return;}e.preventDefault();e.stopPropagation();hsv.s=clamp(hsv.s,0,100);hsv.v=clamp(hsv.v,0,100);fromHsv(true);});
    listen(hue,'input',()=>{hsv.h=clamp(hue.value,0,360);fromHsv();});listen(hue,'change',()=>publish(true));
    for(const type of ['input','change'])listen(hex,type,()=>{const valid=!!normalise(hex.value);hex.setAttribute('aria-invalid',String(!valid));if(valid)setColour(hex.value,type==='change');});
    for(const node of channels)for(const type of ['input','change'])listen(node,type,()=>{const valid=channels.every(n=>/^\d{1,3}$/.test(n.value)&&+n.value<=255);for(const n of channels)n.setAttribute('aria-invalid',String(!/^\d{1,3}$/.test(n.value)||+n.value>255));if(valid)setColour('#'+channels.map(n=>(+n.value).toString(16).padStart(2,'0')).join(''),type==='change');});
    for(const swatch of swatches)listen(swatch,'click',()=>setColour(swatch.dataset.fillColour));
    for(const type of ['input','change'])listen(colourInput,type,read);
    listen(win,'resize',position);listen(doc,'scroll',position,true);sync();
    return {panel,sync,setColour,handleContextMenu,destroy(){if(destroyed)return;destroyed=true;for(const cleanup of dispose)cleanup();doc.body.classList.remove('may-fill-active');wrap.classList.remove('may-fill-pencil');canvas.classList.remove('may-fill-pencil');panel.remove();}};
  }
  return {RAINBOW,normalise,rgb,hexToHsv,hsvToHex,nextRainbow,placement,mount};
});
