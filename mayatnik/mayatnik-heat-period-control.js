/* Heat period: open split X, masked dashed rail and independent side frames. */
(function(root){
 'use strict';
 function attachTrack(host,variant,{thumbFrame=false}={}){
  const doc=host.ownerDocument,ns='http://www.w3.org/2000/svg',svg=doc.createElementNS(ns,'svg');
  svg.classList.add('may-split-track',variant+'-outline');svg.setAttribute('viewBox','0 0 120 24');svg.setAttribute('aria-hidden','true');
  const names=['left','right','rail','left-frame','right-frame'];
  if(thumbFrame)names.push('thumb-frame');
  const paths=names.map(name=>{
   const p=doc.createElementNS(ns,'path');p.setAttribute('class',variant+'-'+name);svg.append(p);return p;
  });
  host.append(svg);
  let previousLeft,previousWidth,previousDirection;
  function sync(fraction,width=44,rightOutward=false){
   const left=24+(72-width)*Math.max(0,Math.min(1,fraction)),right=left+width;
   if(left!==previousLeft||width!==previousWidth||rightOutward!==previousDirection){
    previousLeft=left;previousWidth=width;previousDirection=rightOutward;
    paths[0].setAttribute('d',`M${left+1} 1L${left+10} 12L${left+1} 23`);
    const rightEdge=right-(rightOutward?10:1),rightTip=right-(rightOutward?1:10);
    paths[1].setAttribute('d',`M${rightEdge} 1L${rightTip} 12L${rightEdge} 23`);
    paths[2].setAttribute('d',`M12 12H${left}M${right} 12H108`);
    paths[3].setAttribute('d',`M12 1H${left+1}M12 23H${left+1}`);
    paths[4].setAttribute('d',`M${rightEdge} 1H108M${rightEdge} 23H108`);
    paths[5]?.setAttribute('d',`M${left+1} 1H${rightEdge}M${left+1} 23H${rightEdge}`);
   }
   return left;
  }
  return {svg,sync};
 }
 function attach(host,left,middle,right,input,output){
  root.ZerkControlFrame.attach(host,left,middle,right);
  host.classList.add('may-heat-period-control');host.style.setProperty('background','transparent','important');host.style.setProperty('clip-path','none','important');middle.classList.add('zcf-range');input.classList.add('zcf-input');output.classList.add('zcf-value');
  const doc=host.ownerDocument,track=attachTrack(host,'may-heat-period');
  // These chevrons are the outer ends of the control, not text glyphs.
  left.querySelector('.may-control-chevron path')?.setAttribute('d','M12 1L1 12L12 23');right.querySelector('.may-control-chevron path')?.setAttribute('d','M12 1L23 12L12 23');
  const unit=doc.createElement('span');unit.className='may-heat-period-unit';unit.textContent='кд';unit.setAttribute('data-user-label','');unit.title='Кадров';middle.append(unit);
  function sync(){
   const min=Number(input.min)||0,max=Number(input.max)||100,fraction=max>min?(Number(input.value)-min)/(max-min):0;
   const leftX=track.sync(fraction)-24;
   host.style.setProperty('--heat-thumb-left',leftX+'px');output.style.setProperty('left',(leftX+14)+'px','important');unit.style.left=(leftX+14)+'px';
  }
  sync();return {sync};
 }
 root.MayatnikHeatPeriodControl={attach,attachTrack};
})(globalThis);
