/* Screen-only cell selection and row/column collapse. The source canvas and bits
 * remain untouched; only the visible viewport is copied to the projection. */
(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports) module.exports=factory();
  else root.MayatnikCellSelectionView=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function intersect(a,b){
    var left=Math.max(a.left,b.left),top=Math.max(a.top,b.top);
    var right=Math.min(a.left+a.width,b.left+b.width),bottom=Math.min(a.top+a.height,b.top+b.height);
    return {left:left,top:top,width:Math.max(0,right-left),height:Math.max(0,bottom-top)};
  }
  function geometry(source,model,viewport){
    if(!source||!source.rect||!source.cols||!source.rows) return null;
    var cellWidth=source.rect.width/source.cols,cellHeight=source.rect.height/source.rows;
    if(!(cellWidth>0&&cellHeight>0)) return null;
    var field={left:source.rect.left+(source.rect.width-model.visibleCols*cellWidth)/2,
      top:source.rect.top,width:model.visibleCols*cellWidth,height:model.visibleRows*cellHeight};
    return {field:field,clip:intersect(intersect(source.clipRect||viewport,viewport),field),
      cellWidth:cellWidth,cellHeight:cellHeight};
  }
  // Trim each run before making the cross product: work is proportional to the
  // visible discontinuities, never to the field's total number of cells.
  function clipRuns(runs,origin,cellSize,clipStart,clipSize){
    var start=(clipStart-origin)/cellSize,end=(clipStart+clipSize-origin)/cellSize;
    return runs.map(function(run){
      var a=Math.max(start,run.visibleStart),b=Math.min(end,run.visibleStart+run.length);
      return b>a?{originalStart:run.originalStart+a-run.visibleStart,visibleStart:a,length:b-a}:null;
    }).filter(Boolean);
  }
  function tiles(source,model,g){
    if(!g||!g.clip.width||!g.clip.height||!source.canvas) return [];
    var xs=clipRuns(model.visibleRuns('cols'),g.field.left,g.cellWidth,g.clip.left,g.clip.width);
    var ys=clipRuns(model.visibleRuns('rows'),g.field.top,g.cellHeight,g.clip.top,g.clip.height);
    var sx=source.canvas.width/source.cols,sy=source.canvas.height/source.rows,result=[];
    ys.forEach(function(y){xs.forEach(function(x){result.push({
      sx:x.originalStart*sx,sy:y.originalStart*sy,sw:x.length*sx,sh:y.length*sy,
      dx:g.field.left+x.visibleStart*g.cellWidth-g.clip.left,
      dy:g.field.top+y.visibleStart*g.cellHeight-g.clip.top,
      dw:x.length*g.cellWidth,dh:y.length*g.cellHeight});});});
    return result;
  }
  function hit(g,model,x,y,clamp){
    if(!g||!model.visibleCols||!model.visibleRows) return null;
    if(!clamp&&(x<g.clip.left||y<g.clip.top||x>=g.clip.left+g.clip.width||y>=g.clip.top+g.clip.height)) return null;
    var c=Math.max(0,Math.min(model.visibleCols-1,Math.floor((x-g.field.left)/g.cellWidth)));
    var r=Math.max(0,Math.min(model.visibleRows-1,Math.floor((y-g.field.top)/g.cellHeight)));
    return {col:model.visibleToOriginal('cols',c),row:model.visibleToOriginal('rows',r),visibleCol:c,visibleRow:r};
  }
  function layerTiles(source,baseTiles,layer){
    if(!layer||!layer.canvas||!layer.rect||!layer.rect.width||!layer.rect.height)return [];
    var result=[],rect=layer.rect;
    baseTiles.forEach(function(t){
      var original={left:source.rect.left+t.sx/source.canvas.width*source.rect.width,
        top:source.rect.top+t.sy/source.canvas.height*source.rect.height,
        width:t.sw/source.canvas.width*source.rect.width,height:t.sh/source.canvas.height*source.rect.height};
      var piece=intersect(original,rect);if(!piece.width||!piece.height)return;
      result.push({sx:(piece.left-rect.left)/rect.width*layer.canvas.width,
        sy:(piece.top-rect.top)/rect.height*layer.canvas.height,
        sw:piece.width/rect.width*layer.canvas.width,sh:piece.height/rect.height*layer.canvas.height,
        dx:t.dx+(piece.left-original.left)/original.width*t.dw,
        dy:t.dy+(piece.top-original.top)/original.height*t.dh,
        dw:piece.width/original.width*t.dw,dh:piece.height/original.height*t.dh});
    });return result;
  }
  function selectedSpan(runs,start,end){
    var first=null,last=null;
    runs.forEach(function(run){
      var a=Math.max(run.originalStart,start),b=Math.min(run.originalStart+run.length-1,end);
      if(a<=b){if(first===null) first=run.visibleStart+a-run.originalStart;last=run.visibleStart+b-run.originalStart+1;}
    });
    return first===null?null:[first,last];
  }
  function tintPixels(bytes,hex){
    var out=new Uint8ClampedArray(bytes);if(!/^#[\da-f]{6}$/i.test(hex||''))return out;
    var rgb=[1,3,5].map(function(i){return parseInt(hex.slice(i,i+2),16);});
    for(var i=0;i<out.length;i+=4){
      if(!out[i+3])continue;
      var brightness=(.2126*out[i]+.7152*out[i+1]+.0722*out[i+2])/255;
      for(var c=0;c<3;c++)out[i+c]=rgb[c]*brightness;
    }return out;
  }
  function drawLayer(ctx,source,baseTiles,layer,options){
    if(!layer||layer.visible===false||layer.opacity===0)return;
    options=options||{};
    function paint(target){
      if(typeof layer.drawTile==='function'){
        baseTiles.forEach(function(t){
          target.save();
          try{target.beginPath();target.rect(t.dx,t.dy,t.dw,t.dh);target.clip();layer.drawTile(target,t,source);}
          finally{target.restore();}
        });
      }else layerTiles(source,baseTiles,layer).forEach(function(t){target.drawImage(layer.canvas,t.sx,t.sy,t.sw,t.sh,t.dx,t.dy,t.dw,t.dh);});
    }
    ctx.save();
    try{
      ctx.globalAlpha=layer.opacity==null?1:layer.opacity;
      if(!layer.tint){paint(ctx);return;}
      var dpr=options.dpr||1,scratch=options.scratch||options.makeCanvas();
      var width=Math.ceil(options.width*dpr),height=Math.ceil(options.height*dpr);
      if(!width||!height)return;
      if(scratch.width!==width)scratch.width=width;if(scratch.height!==height)scratch.height=height;
      var sg=scratch.getContext('2d');sg.setTransform(dpr,0,0,dpr,0,0);sg.clearRect(0,0,options.width,options.height);
      sg.globalAlpha=1;paint(sg);
      var pixels=sg.getImageData(0,0,width,height);pixels.data.set(tintPixels(pixels.data,layer.tint));sg.putImageData(pixels,0,0);
      ctx.drawImage(scratch,0,0,width,height,0,0,options.width,options.height);
    }finally{ctx.restore();}
  }
  function mount(options){
    var host=options.host,model=options.model,doc=host.ownerDocument,win=doc.defaultView;
    var canvas=doc.createElement('canvas'),seamLayer=doc.createElement('div');
    canvas.className='mcsv-canvas';canvas.setAttribute('aria-hidden','true');
    seamLayer.className='mcsv-seams';doc.body.appendChild(canvas);doc.body.appendChild(seamLayer);
    var mode='off',drag=null,currentGeometry=null,destroyed=false,lastSuppress=0,scratch=null;
    var seamKey='',seamNodes=[],listeners=[];
    function listen(target,type,fn,capture){target.addEventListener(type,fn,capture);listeners.push([target,type,fn,capture]);}
    function viewport(){return {left:0,top:0,width:win.innerWidth,height:win.innerHeight};}
    function refresh(){var source=options.getSource();currentGeometry=geometry(source,model,viewport());return source;}
    function changed(kind,action){
      var before=model.serialize();if(!action())return false;
      if(options.onChange)options.onChange({kind:kind,before:before,after:model.serialize()});
      render();return true;
    }
    function seams(g){
      var area=intersect(options.getSource().clipRect||viewport(),viewport()),items=[];
      ['cols','rows'].forEach(function(axis){model.seams(axis).forEach(function(seam){
        var vertical=axis==='cols',pos=(vertical?g.field.left:g.field.top)+seam.at*(vertical?g.cellWidth:g.cellHeight);
        var start=vertical?Math.max(area.top,g.field.top):Math.max(area.left,g.field.left);
        var length=vertical?Math.min(area.top+area.height,g.field.top+g.field.height)-start:Math.min(area.left+area.width,g.field.left+g.field.width)-start;
        // An entirely hidden opposite axis has no line length; keep a small
        // accessible recovery target at the source origin.
        if(length<=0)length=18;
        if(pos<(vertical?area.left:area.top)-4||pos>(vertical?area.left+area.width:area.top+area.height)+4)return;
        items.push({axis:axis,from:seam.from,to:seam.to,pos:pos,start:start,length:length});
      });});
      var key=JSON.stringify(items);
      if(key===seamKey)return;seamKey=key;
      seamNodes.forEach(function(node){node.remove();});seamNodes=[];
      items.forEach(function(item){
        var button=doc.createElement('button');button.type='button';button.className='mcsv-seam mcsv-seam-'+item.axis;
        var label='Раскрыть '+(item.axis==='rows'?'строки ':'столбцы ')+(item.from+1)+'–'+(item.to+1);
        button.title=label;button.setAttribute('aria-label',label);
        if(item.axis==='cols'){button.style.left=(item.pos-4)+'px';button.style.top=item.start+'px';button.style.height=item.length+'px';}
        else{button.style.left=item.start+'px';button.style.top=(item.pos-4)+'px';button.style.width=item.length+'px';}
        button.addEventListener('pointerdown',function(e){e.stopPropagation();});
        button.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();changed('reveal',function(){return model.reveal(item.axis,item.from);});});
        seamLayer.appendChild(button);seamNodes.push(button);
      });
    }
    function render(){
      if(destroyed)return;
      var source=refresh(),g=currentGeometry,hidden=model.hiddenRows.length||model.hiddenCols.length;
      host.classList.toggle('mcsv-selecting',mode!=='off');
      canvas.hidden=!g||(!hidden&&!model.selection)||!g.clip.width||!g.clip.height;
      if(!g){seamNodes.forEach(function(n){n.remove();});seamNodes=[];seamKey='';return;}
      seams(g);
      if(canvas.hidden)return;
      var dpr=win.devicePixelRatio||1,w=Math.ceil(g.clip.width*dpr),h=Math.ceil(g.clip.height*dpr);
      if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;
      canvas.style.left=g.clip.left+'px';canvas.style.top=g.clip.top+'px';
      canvas.style.width=g.clip.width+'px';canvas.style.height=g.clip.height+'px';
      var ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,g.clip.width,g.clip.height);ctx.imageSmoothingEnabled=false;
      if(hidden){
        if(source.background){ctx.fillStyle=source.background;ctx.fillRect(0,0,g.clip.width,g.clip.height);}
        var baseTiles=tiles(source,model,g);
        if(source.baseVisible!==false){
          if(typeof source.drawTile==='function')drawLayer(ctx,source,baseTiles,{drawTile:source.drawTile});
          else baseTiles.forEach(function(t){ctx.drawImage(source.canvas,t.sx,t.sy,t.sw,t.sh,t.dx,t.dy,t.dw,t.dh);});
        }
        (source.layers||[]).forEach(function(layer){
          if(layer.tint&&!scratch)scratch=doc.createElement('canvas');
          drawLayer(ctx,source,baseTiles,layer,{scratch:scratch,width:g.clip.width,height:g.clip.height,dpr:dpr});
        });ctx.globalAlpha=1;
      }
      var selection=model.selection;
      if(selection){
        var xs=selectedSpan(model.visibleRuns('cols'),selection.c0,selection.c1);
        var ys=selectedSpan(model.visibleRuns('rows'),selection.r0,selection.r1);
        if(xs&&ys){
          var x=g.field.left+xs[0]*g.cellWidth-g.clip.left,y=g.field.top+ys[0]*g.cellHeight-g.clip.top;
          var rw=(xs[1]-xs[0])*g.cellWidth,rh=(ys[1]-ys[0])*g.cellHeight;
          ctx.fillStyle='rgba(59,163,255,.19)';ctx.fillRect(x,y,rw,rh);
          ctx.strokeStyle='#53b6ff';ctx.lineWidth=2;ctx.strokeRect(x+1,y+1,Math.max(0,rw-2),Math.max(0,rh-2));
        }
      }
    }
    function point(e,clamp){refresh();return hit(currentGeometry,model,e.clientX,e.clientY,clamp);}
    function select(a,b){changed('select',function(){return model.selectVisible({r0:a.visibleRow,c0:a.visibleCol,r1:b.visibleRow,c1:b.visibleCol,mode:mode});});}
    function pointerDown(e){
      if(mode==='off'||e.button!==0)return false;
      var p=point(e,false);if(!p)return false;
      drag={id:e.pointerId,start:p,before:model.serialize()};select(p,p);return true;
    }
    function pointerMove(e){if(!drag||drag.id!==e.pointerId)return false;var p=point(e,true);if(p)select(drag.start,p);return true;}
    function pointerUp(e){if(!drag||drag.id!==e.pointerId)return false;pointerMove(e);drag=null;lastSuppress=Date.now();return true;}
    function cancelGesture(){
      var previous=drag&&drag.before;drag=null;
      if(previous)changed('select',function(){return model.restore(previous);});
    }
    function stop(e){e.preventDefault();e.stopImmediatePropagation();}
    // Touch is routed by the page after it has registered pointers for pinch.
    // Consuming the first touch here would hide it from the existing pinch map.
    if(options.autoMouse!==false){
      listen(host,'pointerdown',function(e){if(e.pointerType==='touch')return;if(pointerDown(e)){try{host.setPointerCapture(e.pointerId);}catch(ignore){}stop(e);}},true);
      listen(host,'pointermove',function(e){if(e.pointerType!=='touch'&&pointerMove(e))stop(e);},true);
      listen(host,'pointerup',function(e){if(e.pointerType!=='touch'&&pointerUp(e))stop(e);},true);
    }
    listen(host,'pointercancel',function(e){if(drag&&drag.id===e.pointerId)cancelGesture();},true);
    listen(host,'click',function(e){if(Date.now()-lastSuppress<500)stop(e);},true);
    listen(doc,'keydown',function(e){
      if(e.key!=='Escape'||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable)return;
      cancelGesture();changed('select',function(){return model.clear();});
    },false);
    listen(win,'resize',render,false);listen(win,'scroll',render,true);
    render();
    return {
      get mode(){return mode;},
      setMode:function(value){mode=['cells','rows','cols'].indexOf(value)>=0?value:'off';cancelGesture();if(options.onMode)options.onMode(mode);render();},
      render:render,hit:function(x,y){refresh();return hit(currentGeometry,model,x,y,false);},
      hide:function(axis){return changed('hide',function(){return model.hide(axis);});},
      revealAll:function(axis){return changed('revealAll',function(){return model.revealAll(axis);});},
      snapshot:function(){return model.serialize();},restore:function(value){cancelGesture();var result=model.restore(value);render();return result;},
      pointerDown:pointerDown,pointerMove:pointerMove,pointerUp:pointerUp,cancelGesture:cancelGesture,
      destroy:function(){destroyed=true;listeners.forEach(function(l){l[0].removeEventListener(l[1],l[2],l[3]);});canvas.remove();seamLayer.remove();host.classList.remove('mcsv-selecting');}
    };
  }
  return {mount:mount,geometry:geometry,tiles:tiles,layerTiles:layerTiles,drawLayer:drawLayer,tintPixels:tintPixels,hit:hit,clipRuns:clipRuns,selectedSpan:selectedSpan};
});
