/* Heat period: open split X, masked dashed rail and independent side frames. */
(function(root){
 'use strict';
 function attach(host,left,middle,right,input,output){
  root.ZerkControlFrame.attach(host,left,middle,right);
  host.classList.add('may-heat-period-control');host.style.setProperty('background','transparent','important');host.style.setProperty('clip-path','none','important');middle.classList.add('zcf-range');input.classList.add('zcf-input');output.classList.add('zcf-value');
  const doc=host.ownerDocument,ns='http://www.w3.org/2000/svg',svg=doc.createElementNS(ns,'svg');svg.classList.add('may-heat-period-outline');svg.setAttribute('viewBox','0 0 120 24');svg.setAttribute('aria-hidden','true');
  const paths=['left','grip','right','rail','left-frame','right-frame'].map(name=>{const p=doc.createElementNS(ns,'path');p.setAttribute('class','may-heat-period-'+name);svg.append(p);return p;});host.append(svg);
  // These chevrons are the outer ends of the control, not text glyphs.
  left.querySelector('.may-control-chevron path')?.setAttribute('d','M12 1L1 12L12 23');right.querySelector('.may-control-chevron path')?.setAttribute('d','M12 1L23 12L12 23');
  const unit=doc.createElement('span');unit.className='may-heat-period-unit';unit.textContent='кд';unit.setAttribute('data-user-label','');unit.title='Кадров';middle.append(unit);
  function sync(){
   const min=Number(input.min)||0,max=Number(input.max)||100,fraction=max>min?Math.max(0,Math.min(1,(Number(input.value)-min)/(max-min))):0,leftX=28*fraction,x=24+leftX;
   host.style.setProperty('--heat-thumb-left',leftX+'px');output.style.setProperty('left',(leftX+14)+'px','important');unit.style.left=(leftX+14)+'px';
   paths[0].setAttribute('d',`M${x+1} 1L${x+10} 12L${x+1} 23`);
   paths[1].setAttribute('d','');
   paths[2].setAttribute('d',`M${x+43} 1L${x+34} 12L${x+43} 23`);
   paths[3].setAttribute('d',`M12 12H${x}M${x+44} 12H108`);
   paths[4].setAttribute('d',`M12 1H${x+1}M12 23H${x+1}`);
   paths[5].setAttribute('d',`M${x+43} 1H108M${x+43} 23H108`);
  }
  sync();return {sync};
 }
 root.MayatnikHeatPeriodControl={attach};
})(globalThis);
