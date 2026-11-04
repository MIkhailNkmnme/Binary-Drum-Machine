/* Optional live reduced copies of the main field. No GIF palette or source mutation. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikScaleStack=api;})(globalThis,function(){
  'use strict';
  const DEFAULT_BYTES=32*1024*1024;
  function sourceBytes(source){return source.pixels.byteLength+(source.bits?.byteLength||0);}
  function validate(source){
    if(!source||!Number.isSafeInteger(source.width)||!Number.isSafeInteger(source.height)||source.width<1||source.height<1||!source.pixels||source.pixels.length!==source.width*source.height*4||!ArrayBuffer.isView(source.pixels))throw Error('Повреждён кадр масштабов под полем');
  }
  function levels(width,height,maxLevels=5){
    const result=[];let rows=height;
    for(let i=0;i<maxLevels&&rows>8;i++){
      rows=Math.max(8,Math.floor(rows/2));
      result.push({width:Math.max(1,Math.ceil(width*rows/height-1e-12)),height:rows});
    }
    return result;
  }
  function create(options={}){
    const host=options.host,doc=host?.ownerDocument||globalThis.document;
    if(!host||!doc)throw Error('Нет области для масштабов под полем');
    const schedule=options.schedule||(callback=>setTimeout(callback,0)),cancel=options.cancel||clearTimeout;
    const maxBytes=Math.min(DEFAULT_BYTES,Math.max(1,Number(options.maxBytes)||DEFAULT_BYTES));
    const maxLevels=Math.max(1,Math.min(5,Math.floor(Number(options.maxLevels)||5)));
    const chunkPixels=Math.max(1,Math.min(65536,Math.floor(Number(options.chunkPixels)||32768)));
    const element=doc.createElement('div');element.className='may-scale-stack';element.hidden=true;
    element.setAttribute('aria-label','Уменьшенные копии текущего кадра');host.appendChild(element);
    let enabled=false,destroyed=false,ticket=null,pending=null,active=null,generation=0,paintedKey,hasPaintedKey=false,layout={},nodes=[],error=null;
    function later(){if(ticket===null)ticket=schedule(tick);}
    function removeCanvas(canvas){canvas.width=canvas.height=0;canvas.parentNode?.className==='may-scale-stack__level'?canvas.parentNode.remove():canvas.remove();}
    function releaseNodes(){for(const canvas of nodes)removeCanvas(canvas);nodes=[];}
    function stop(){generation++;pending=active=null;if(ticket!==null){cancel(ticket);ticket=null;}}
    function fail(reason){error=reason;active=pending=null;releaseNodes();hasPaintedKey=false;element.hidden=true;options.onError?.(reason);}
    function applyLayout(){
      element.style.marginLeft=Math.max(0,Number(layout.left)||0)+'px';
      for(const canvas of nodes){
        const sourceWidth=Number(canvas.dataset.sourceWidth)||canvas.width,sourceHeight=Number(canvas.dataset.sourceHeight)||canvas.height;
        if(options.fillWidth){
          const width=Number(layout.width)>0?Number(layout.width):sourceWidth;
          canvas.style.width=width+'px';canvas.style.height=width*sourceHeight/sourceWidth+'px';
        }else{
          const scale=Number(layout.width)>0?Number(layout.width)/sourceWidth:1;
          canvas.style.width=canvas.width*scale+'px';canvas.style.height=canvas.height*scale+'px';
        }
      }
    }
    function refreshLayout(value={}){layout={...layout,...value};applyLayout();}
    function requestFrame(source,meta={}){
      if(!enabled||destroyed)return false;
      const hasKey=Object.prototype.hasOwnProperty.call(meta,'key');
      if(hasKey&&((active?.hasKey&&Object.is(active.key,meta.key))||(pending?.hasKey&&Object.is(pending.key,meta.key))||(!active&&!pending&&hasPaintedKey&&Object.is(paintedKey,meta.key))))return false;
      // Finish the active frame so continuous playback cannot starve every paint.
      // Only the newest pending request survives. Prefer a lazy recapture when
      // retaining another caller-owned snapshot would exceed the admission cap.
      if(active&&source&&source!==active.source){
        const bytes=source.pixels?.byteLength+(source.bits?.byteLength||0);
        if(!Number.isFinite(bytes)||active.reservedBytes+bytes>maxBytes){
          if(typeof options.captureSource==='function')source=undefined;
          else return false;
        }
      }
      pending={source,key:meta.key,hasKey,generation};later();return true;
    }
    function begin(){
      const job=pending;pending=null;
      const source=job.source||options.captureSource?.({maxBytes});
      // captureSource may itself disable or request a newer frame.
      if(!enabled||destroyed||job.generation!==generation)return;
      validate(source);
      let sizes=levels(source.width,source.height,maxLevels);
      const existing=nodes.reduce((n,c)=>n+c.width*c.height*4,0),input=sourceBytes(source);
      // Reserve existing canvas backing + new backing, ImageData and compositor scratch.
      while(sizes.length&&input+existing+sizes.reduce((n,s)=>n+s.width*s.height*12,0)>maxBytes)sizes.shift();
      if(!sizes.length){
        if(source.height>8&&input>maxBytes)throw Error('Для масштабов под полем недостаточно памяти');
        releaseNodes();element.hidden=true;paintedKey=job.key;hasPaintedKey=job.hasKey;return;
      }
      active={...job,source,sizes,outputs:[],index:0,at:0,reservedBytes:input+existing+sizes.reduce((n,s)=>n+s.width*s.height*12,0)};
    }
    function tick(){
      ticket=null;if(!enabled||destroyed)return;
      try{
        if(pending&&!active)begin();
        const job=active;if(!job)return;
        let remaining=chunkPixels;
        while(remaining>0&&job.index<job.sizes.length){
          const size=job.sizes[job.index],scale=size.height/job.source.height;
          if(!job.outputs[job.index])job.outputs[job.index]=new Uint8ClampedArray(size.width*size.height*4);
          const pixels=job.outputs[job.index],end=Math.min(size.width*size.height,job.at+remaining),input=job.source.pixels;
          for(let i=job.at;i<end;i++){
            const x=i%size.width,y=Math.floor(i/size.width),sx=Math.floor((x+.5)/scale),sy=Math.floor((y+.5)/scale),q=i*4;
            if(sx<job.source.width&&sy<job.source.height){const from=(sy*job.source.width+sx)*4;pixels[q]=input[from];pixels[q+1]=input[from+1];pixels[q+2]=input[from+2];pixels[q+3]=input[from+3];}
          }
          remaining-=end-job.at;job.at=end;
          if(end===size.width*size.height){job.index++;job.at=0;}
        }
        if(job.index<job.sizes.length){later();return;}
        if(job.generation!==generation)return;
        while(nodes.length>job.sizes.length)removeCanvas(nodes.pop());
        for(let i=0;i<job.sizes.length;i++){
          const size=job.sizes[i];let canvas=nodes[i];
          if(!canvas){
            const level=doc.createElement('div'),label=doc.createElement('span');level.className='may-scale-stack__level';label.className='may-scale-stack__label';
            canvas=doc.createElement('canvas');canvas.className='may-scale-stack__canvas';canvas.scaleLabel=label;level.appendChild(label);level.appendChild(canvas);element.appendChild(level);nodes.push(canvas);
          }
          if(canvas.width!==size.width)canvas.width=size.width;if(canvas.height!==size.height)canvas.height=size.height;
          canvas.dataset.sourceWidth=String(job.source.width);canvas.dataset.sourceHeight=String(job.source.height);canvas.scaleLabel.textContent=size.height+' строк';canvas.setAttribute('aria-label',size.height+' строк, текущий кадр');
          const context=canvas.getContext('2d');if(!context)throw Error('Недоступен холст масштабов');
          const image=context.createImageData(size.width,size.height);image.data.set(job.outputs[i]);context.putImageData(image,0,0);
          job.outputs[i]=null;
        }
        applyLayout();element.hidden=false;paintedKey=job.key;hasPaintedKey=job.hasKey;active=null;error=null;options.onPaint?.({key:paintedKey,levels:job.sizes});if(pending)later();
      }catch(reason){fail(reason);}
    }
    function setEnabled(value){
      if(destroyed)return false;const next=!!value;if(next===enabled)return enabled;
      enabled=next;stop();hasPaintedKey=false;
      if(enabled)requestFrame();else{releaseNodes();element.hidden=true;error=null;}
      return enabled;
    }
    function destroy(){if(destroyed)return;enabled=false;stop();releaseNodes();element.remove();destroyed=true;}
    function inspect(){return {enabled,destroyed,busy:!!active,pending:!!pending,canvases:nodes.length,canvasBytes:nodes.reduce((n,c)=>n+c.width*c.height*4,0),key:paintedKey,error};}
    return {element,setEnabled,requestFrame,refreshLayout,destroy,inspect};
  }
  return {create,levels};
});
