/* Final display cover. Never edits the field, paint or saved template masks. */
(function(root){
  'use strict';
  function create(options={}){
    const doc=options.document||document,key='may-template-visibility-v1',tokens=new WeakMap();let serial=0,canvas=null,signature='',mode='';
    try{const saved=localStorage.getItem(key);if(saved==='hide'||saved==='only')mode=saved;}catch(_){}
    const token=value=>{if(!value||typeof value!=='object')return value;if(!tokens.has(value))tokens.set(value,++serial);return tokens.get(value);};
    function toggle(value){mode=mode===value?'':value;signature='';try{localStorage.setItem(key,mode);}catch(_){}return mode;}
    function hide(){if(canvas)canvas.style.display='none';}
    function draw(view){
      if(!mode||!view?.available||!view.active||!(view.width>0&&view.height>0)){hide();return;}
      if(!canvas){canvas=doc.createElement('canvas');canvas.id='mayTemplateVisibility';canvas.className='may-layer-service';canvas.setAttribute('aria-hidden','true');
        Object.assign(canvas.style,{position:'fixed',pointerEvents:'none',margin:'0',background:'transparent',imageRendering:'pixelated',zIndex:'5'});doc.body.append(canvas);}
      Object.assign(canvas.style,{display:'',left:view.left+'px',top:view.top+'px',width:view.width+'px',height:view.height+'px'});
      const parts=view.parts||[],next=JSON.stringify([mode,view.width,view.height,view.dpr,view.key,view.colour,token(view.selectionToken),parts.map(p=>[token(p.data),token(p.bits),p.width,p.height,p.rect,p.clip])]);
      if(signature===next)return;
      const picture=root.MayatnikTemplateDim.raster(view.width,view.height,view.dpr,parts,view.selectedAt,view.visibleAt),data=picture.data,colour=view.colour;
      for(let q=0;q<data.length;q+=4){const selected=data[q+3]===0;data[q]=colour[0];data[q+1]=colour[1];data[q+2]=colour[2];data[q+3]=(mode==='hide'?selected:!selected)?255:0;}
      canvas.width=picture.width;canvas.height=picture.height;const g=canvas.getContext('2d'),image=g.createImageData(picture.width,picture.height);image.data.set(data);g.putImageData(image,0,0);signature=next;
    }
    return {draw,toggle,hide,get mode(){return mode;}};
  }
  root.MayatnikTemplateVisibility={create};
})(globalThis);
