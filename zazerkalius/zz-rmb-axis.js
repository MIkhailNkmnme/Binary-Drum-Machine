/* Manual mirror axes v4. Preview is separate from committing reflected bits. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./zz-rmb-editor.js'):root.ZZRmbEditor,typeof module==='object'&&module.exports?require('./zz-grid-shapes.js'):root.ZZGridShapes);if(typeof module==='object'&&module.exports)module.exports=api;else root.ZZRmbAxis=api;})(globalThis,function(Editor,Shapes){
  'use strict';const K=Math.sqrt(3)/2;
  function basis(axis){
    if(!axis||!Array.isArray(axis.a)||!Array.isArray(axis.b)||axis.a.length!==2||axis.b.length!==2||![...axis.a,...axis.b].every(Number.isFinite))return null;
    const dx=axis.b[0]-axis.a[0],dy=axis.b[1]-axis.a[1],length=Math.hypot(dx,dy);if(length<1e-8)return null;
    let nx=-dy/length,ny=dx/length;const vertical=Math.abs(dy)>=Math.abs(dx);
    if(vertical?nx<0:ny<0){nx=-nx;ny=-ny;}
    return {dx:dx/length,dy:dy/length,nx,ny,length,positive:vertical?'Право':'Низ',negative:vertical?'Лево':'Верх'};
  }
  function reflected(point,axis){const b=basis(axis);if(!b)return point.slice();const d=(point[0]-axis.a[0])*b.nx+(point[1]-axis.a[1])*b.ny;return [point[0]-2*d*b.nx,point[1]-2*d*b.ny];}
  function reflectRows(rows,g,axis,side='positive'){
    const b=basis(axis);if(!b)return {ok:false,changed:false,rows};const next=rows.slice(),copies=[],sign=side==='negative'?-1:1,world={...g,rows,tw:1,ox:0,oy:0};
    for(let r=0;r<rows.length&&(Shapes?.supported(g)||r<g.hs.length);r++){
      const row=rows[r].split('');
      for(let c=0;c<row.length;c++){
        const p=Shapes?.supported(g)?Shapes.center(r,c,world):g.rm===false?[g.hs[r]/2+c/2+.5,(r+(((c+g.u0)&1)?1/3:2/3))*K]:[g.hs[r]/2+c+.75,(r+.5)*K],x=p[0]-axis.a[0],y=p[1]-axis.a[1],distance=x*b.nx+y*b.ny;
        if(distance*sign>=-1e-8)continue;
        const along=x*b.dx+y*b.dy;if(axis.segment&&(along<0||along>b.length))continue;
        const q=reflected(p,axis),source=Editor.hit(rows,world,q[0],q[1]);row[c]=source?rows[source[0]][source[1]]:'0';copies.push([source,[r,c]]);
      }
      next[r]=row.join('');
    }
    return {ok:true,rows:next,copies,changed:next.some((s,i)=>s!==rows[i])};
  }
  function reflectSequence(rows,g,axes){
    let next=rows;const origins=new Map(),key=p=>p.join(','),touched=new Map();
    for(const axis of axes){if(axis.preview===false||!basis(axis))continue;const result=reflectRows(next,g,axis,axis.side||'positive'),before=new Map(origins);
      for(const [source,target] of result.copies){const original=source?(before.has(key(source))?before.get(key(source)):source):null;origins.set(key(target),original);touched.set(key(target),target);}
      next=result.rows;
    }
    return {ok:true,rows:next,copies:[...touched].map(([k,target])=>[origins.get(k),target]),changed:next.some((row,i)=>row!==rows[i])};
  }
  function snapVertex(rows,g,p){
    if(Shapes?.supported(g))return Shapes.snapVertex(rows,g,p);
    let best=null,distance=Infinity;const r0=Math.floor(p[1]/K),candidates=new Set([r0-1,r0,r0+1].map(r=>Math.max(0,Math.min(rows.length-1,r))));
    for(const r of candidates){if(!rows[r]?.length||g.hs[r]===undefined)continue;const c0=Math.floor((p[0]-g.hs[r]/2)*(g.rm===false?2:1));
      for(const raw of [c0-2,c0-1,c0,c0+1]){const c=Math.max(0,Math.min(rows[r].length-1,raw)),x=g.hs[r]/2+c*(g.rm===false?.5:1),y=r*K;
        const vertices=g.rm===false?(((c+g.u0)&1)?[[x,y],[x+1,y],[x+.5,y+K]]:[[x,y+K],[x+1,y+K],[x+.5,y]]):(g.u0&1)?[[x,y],[x+1,y],[x+1.5,y+K],[x+.5,y+K]]:[[x+.5,y],[x+1.5,y],[x+1,y+K],[x,y+K]];
        for(const q of vertices){const d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(d<distance){distance=d;best=q;}}
      }
    }
    return best;
  }
  const segmentDistance=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],n=dx*dx+dy*dy,t=n?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/n)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
  function mount(cv,cfg){
    let selectedId=cfg.axes().at(-1)?.id,drag=null,space=false,touchHandles=false,previewCache=null;
    const selected=()=>cfg.axes().find(a=>a.id===selectedId)||null;
    const consume=e=>{e.preventDefault();e.stopImmediatePropagation();};
    const world=e=>{const box=cv.getBoundingClientRect(),g=cfg.geometry();return [(e.clientX-box.left-g.ox)/g.tw,(e.clientY-box.top-g.oy)/g.tw];};
    const snap=p=>snapVertex(cfg.rows(),cfg.geometry(),p);
    function finish(cancel,e){const d=drag;drag=null;if(!d)return;if(e)try{cv.releasePointerCapture(e.pointerId);}catch(_){}
      if(!cancel&&basis(d.preview)){const exists=cfg.axes().some(a=>a.id===d.preview.id),axes=cfg.axes().map(a=>a.id===d.preview.id?d.preview:a);if(!exists)axes.push(d.preview);selectedId=d.preview.id;cfg.setAxes(axes);cfg.save();}cfg.redraw();
    }
    cv.addEventListener('pointerdown',e=>{
      if(!cfg.enabled()||e.button!==0||space)return;consume(e);cv.focus({preventScroll:true});touchHandles=e.pointerType==='touch';const p=world(e),tol=(touchHandles?22:9)/cfg.geometry().tw;
      let found=null,part='line';
      for(const axis of [...cfg.axes()].reverse()){
        const da=Math.hypot(p[0]-axis.a[0],p[1]-axis.a[1]),db=Math.hypot(p[0]-axis.b[0],p[1]-axis.b[1]);
        if(Math.min(da,db)<=tol){found=axis;part=da<=db?'a':'b';break;}
        if(segmentDistance(p,axis.a,axis.b)<=tol){found=axis;break;}
      }
      const point=snap(p);if(!point)return;
      const axis=found||{id:Math.max(0,...cfg.axes().map(a=>+a.id||0))+1,a:point,b:point,segment:false,side:'positive',preview:true};
      selectedId=axis.id;drag={part:found?part:'b',anchor:point,original:{...axis,a:axis.a.slice(),b:axis.b.slice()},preview:{...axis,a:axis.a.slice(),b:axis.b.slice()}};
      cv.setPointerCapture(e.pointerId);cfg.redraw();
    },true);
    cv.addEventListener('pointermove',e=>{
      if(!drag)return;consume(e);const p=snap(world(e));if(!p)return;
      if(drag.part==='line'){const d=[p[0]-drag.anchor[0],p[1]-drag.anchor[1]];drag.preview.a=drag.original.a.map((x,i)=>x+d[i]);drag.preview.b=drag.original.b.map((x,i)=>x+d[i]);}
      else drag.preview[drag.part]=p;drag.preview.preview=true;cfg.redraw();
    },true);
    cv.addEventListener('pointerup',e=>{if(drag){consume(e);finish(false,e);}},true);
    cv.addEventListener('pointercancel',e=>{if(drag){consume(e);finish(true,e);}},true);
    cv.addEventListener('lostpointercapture',()=>{if(drag)finish(true);});
    cv.addEventListener('keydown',e=>{if(!cfg.enabled())return;
      if(e.key===' '){space=true;return;}
      if(e.key==='Escape'&&drag){consume(e);finish(true);}
      else if((e.key==='Delete'||e.key==='Backspace')&&selected()){consume(e);remove();}
    },true);
    cv.addEventListener('keyup',e=>{if(e.key===' ')space=false;},true);
    cv.addEventListener('blur',()=>{space=false;if(drag)finish(true);});
    function remove(){if(!selected())return;cfg.setAxes(cfg.axes().filter(a=>a.id!==selectedId));selectedId=cfg.axes().at(-1)?.id;cfg.save();cfg.redraw();}
    function toggleSegment(){const axis=selected();if(!axis)return;cfg.setAxes(cfg.axes().map(a=>a===axis?{...a,segment:!a.segment,preview:true}:a));cfg.save();cfg.redraw();}
    function preview(side){const axis=selected();if(!axis)return;cfg.setAxes(cfg.axes().map(a=>a===axis?{...a,side,preview:true}:a));cfg.save();cfg.redraw();}
    function activeAxes(){const axes=cfg.axes().map(a=>drag&&a.id===drag.preview.id?drag.preview:a);if(drag&&!axes.some(a=>a.id===drag.preview.id))axes.push(drag.preview);return axes;}
    function pending(){return activeAxes().some(a=>a.preview!==false&&basis(a));}
    function previewResult(){const rows=cfg.rows(),g=cfg.geometry(),axes=activeAxes(),identity=rows.join('/')+'|'+JSON.stringify([g.hs,g.u0,g.rm,g.cell,rows.map(row=>row.length),axes]);
      if(previewCache?.identity!==identity)previewCache={identity,result:reflectSequence(rows,g,axes)};return previewCache.result;}
    function apply(){if(drag)return;if(!pending()){cfg.message('Нет зеркал для применения.');return;}if(cfg.locked())return;
      const result=previewResult();if(result.copies.length)cfg.commit(result.rows,result);
      cfg.setAxes(cfg.axes().map(a=>({...a,preview:false})));previewCache=null;cfg.save();cfg.redraw();}
    function paintPreview(g,geometry){if(!pending()||!cfg.polygon)return;const result=previewResult();g.save();g.globalAlpha=1;
      for(const [source,[r,c]] of result.copies){const points=cfg.polygon(r,c,geometry);if(points.every(p=>p[0]<0)||points.every(p=>p[0]>geometry.Wc)||points.every(p=>p[1]<0)||points.every(p=>p[1]>geometry.Hc))continue;
        g.beginPath();points.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.closePath();const bit=result.rows[r][c];g.fillStyle=cfg.color?cfg.color(source,bit):(bit==='1'?'#ffd166':'#7d8699');g.fill();g.strokeStyle='rgba(255,191,105,.5)';g.lineWidth=.7;g.stroke();
      }g.restore();}
    function paint(g,geometry){
      const axes=cfg.axes().filter(a=>!drag||a.id!==drag.preview.id);if(drag)axes.push(drag.preview);
      if(!axes.length)return;g.save();g.globalAlpha=1;
      const screen=p=>[geometry.ox+p[0]*geometry.tw,geometry.oy+p[1]*geometry.tw];
      for(const axis of axes){const a=screen(axis.a),b=screen(axis.b),active=axis.id===selectedId;
        g.beginPath();g.moveTo(...a);g.lineTo(...b);g.strokeStyle='#000';g.lineWidth=4;g.stroke();g.strokeStyle=active?'#ffbf69':'#b59bff';g.lineWidth=1.5;g.stroke();
        if(active&&cfg.enabled())for(const p of [a,b]){const size=touchHandles?9:5;g.beginPath();g.moveTo(p[0],p[1]-size);g.lineTo(p[0]+size,p[1]);g.lineTo(p[0],p[1]+size);g.lineTo(p[0]-size,p[1]);g.closePath();g.fillStyle='#ffbf69';g.fill();}
      }g.restore();
    }
    return {selected,preview,pending,previewResult,apply,remove,toggleSegment,paintPreview,paint,cancel(){if(drag)finish(true);space=false;}};
  }
  return {basis,reflected,reflectRows,reflectSequence,snapVertex,mount};
});
