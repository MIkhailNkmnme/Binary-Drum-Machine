/* Heat period: native range grip between two X boundaries, extended arrow hit areas. */
(function(root){
 'use strict';
 function attach(host,left,middle,right,input,output){
  root.ZerkControlFrame.attach(host,left,middle,right);
  host.classList.add('may-heat-period-control');middle.classList.add('zcf-range');input.classList.add('zcf-input');output.classList.add('zcf-value');
  const doc=host.ownerDocument,ns='http://www.w3.org/2000/svg',svg=doc.createElementNS(ns,'svg');svg.classList.add('may-heat-period-outline');svg.setAttribute('viewBox','0 0 120 24');svg.setAttribute('aria-hidden','true');
  const paths=['left','grip','right'].map(name=>{const p=doc.createElementNS(ns,'path');p.setAttribute('class','may-heat-period-'+name);svg.append(p);return p;});host.append(svg);
  const unit=doc.createElement('span');unit.className='may-heat-period-unit';unit.textContent='кд';unit.setAttribute('data-user-label','');unit.title='Кадров';middle.append(unit);
  function sync(){
   const min=Number(input.min)||0,max=Number(input.max)||100,fraction=max>min?Math.max(0,Math.min(1,(Number(input.value)-min)/(max-min))):0,leftX=28*fraction,x=24+leftX;
   host.style.setProperty('--heat-thumb-left',leftX+'px');output.style.setProperty('left',(leftX+14)+'px','important');unit.style.left=(leftX+14)+'px';
   paths[0].setAttribute('d',`M12 1H${x+1}L${x+13} 23H12L1 12Z`);
   paths[1].setAttribute('d',`M${x+13} 1L${x+1} 23M${x+31} 1L${x+43} 23`);
   paths[2].setAttribute('d',`M${x+43} 1H108L119 12 108 23H${x+31}Z`);
  }
  sync();return {sync};
 }
 root.MayatnikHeatPeriodControl={attach};
})(globalThis);
