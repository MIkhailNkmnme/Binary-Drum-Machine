/* Rhomboid field editor v3: edits source bits, one shared undo step per gesture. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./zz-grid-shapes.js'):root.ZZGridShapes);if(typeof module==='object'&&module.exports)module.exports=api;else root.ZZRmbEditor=api;})(globalThis,function(Shapes){
  'use strict';
  const key=([r,c])=>r+','+c;
  const inside=(rows,[r,c])=>Number.isInteger(r)&&Number.isInteger(c)&&r>=0&&r<rows.length&&c>=0&&c<rows[r].length;
  const unique=cells=>[...new Map(cells.map(p=>[key(p),p])).values()];
  const gridFloor=n=>{const nearest=Math.round(n);return Math.floor(Math.abs(n-nearest)<=32*Number.EPSILON*Math.max(1,Math.abs(n))?nearest:n);};
  const same=(a,b)=>a.length===b.length&&a.every((s,i)=>s===b[i]);
  function hit(rows,g,x,y,clamp=false){
    if(Shapes?.supported(g))return Shapes.hit(rows,g,x,y,clamp);
    if(!rows.length||!(g.tw>0))return null;
    const h=g.tw*Math.sqrt(3)/2;let row=gridFloor((y-g.oy)/h);
    if(clamp)row=Math.max(0,Math.min(rows.length-1,row));
    if(row<0||row>=rows.length||!rows[row].length||g.hs[row]===undefined)return null;
    if(g.rm===false){const px=(x-g.ox)/g.tw-g.hs[row]/2,fy=(y-g.oy)/h-row,c0=Math.floor(px*2);
      for(const c of [c0,c0-1]){if(c<0||c>=rows[row].length)continue;const local=px-c/2,down=(c+(g.u0||0))&1,left=down?fy/2:(1-fy)/2;if(local>=left-1e-10&&local<=1-left+1e-10)return [row,c];}
      return clamp?[row,Math.max(0,Math.min(rows[row].length-1,c0))]:null;
    }
    const f=Math.max(0,Math.min(1,(y-g.oy)/h-row)),left=g.ox+g.hs[row]*g.tw/2+((g.u0&1)?f:1-f)*g.tw/2;
    let col=gridFloor((x-left)/g.tw);if(clamp)col=Math.max(0,Math.min(rows[row].length-1,col));
    return inside(rows,[row,col])?[row,col]:null;
  }
  function rectangle(rows,a,b){const cells=[];if(!a||!b)return cells;
    for(let r=Math.max(0,Math.min(a[0],b[0]));r<=Math.min(rows.length-1,Math.max(a[0],b[0]));r++)
      for(let c=Math.max(0,Math.min(a[1],b[1]));c<=Math.min(rows[r].length-1,Math.max(a[1],b[1]));c++)if(rows[r][c]==='1')cells.push([r,c]);
    return cells;
  }
  function apply(rows,cells,{dr=0,dc=0,copy=false,erase=false,create=false}={}){
    if(create&&!cells.every(p=>inside(rows,p)))return {ok:false,changed:false,rows,selection:[]};
    const source=unique(cells).filter(p=>inside(rows,p)&&(create||rows[p[0]][p[1]]==='1'));
    const target=source.map(([r,c])=>[r+dr,c+dc]);
    if(!target.every(p=>inside(rows,p)))return {ok:false,changed:false,rows,selection:source};
    const edits=new Map(),write=([r,c],v)=>{if(!edits.has(r))edits.set(r,rows[r].split(''));edits.get(r)[c]=v;};
    if(!copy&&!create)source.forEach(p=>write(p,'0'));
    if(!erase)target.forEach(p=>write(p,'1'));
    const next=rows.map((s,r)=>edits.has(r)?edits.get(r).join(''):s);
    return {ok:true,changed:!same(rows,next),rows:next,selection:erase?[]:target,moves:erase?[]:source.map((p,i)=>[p,target[i]]),copy:copy||create};
  }
  function mount(cv,cfg){
    let selected=[],drag=null,hover=null,clipboard=[],space=false,known=cfg.rows().slice();
    cv.tabIndex=0;cv.setAttribute('aria-label','Ромбоиды: поле; в Правке щёлкните пустую клетку, чтобы создать ромб');
    const enabled=()=>cfg.enabled(),redraw=()=>cfg.redraw(),consume=e=>{e.preventDefault();e.stopImmediatePropagation();};
    const xy=e=>{const b=cv.getBoundingClientRect();return [e.clientX-b.left,e.clientY-b.top];};
    const visible=p=>!cfg.visible||cfg.visible(...p);
    const at=(e,clamp=false)=>{const p=hit(cfg.rows(),cfg.geometry(),...xy(e),clamp);return p&&visible(p)?p:null;};
    function sync(){const rows=cfg.rows();selected=selected.filter(visible);if(!same(known,rows)){selected=[];drag=null;known=rows.slice();}if(!enabled()){selected=[];drag=null;space=false;}}
    function commit(result){
      if(result.selection?.some(p=>!visible(p))){cfg.message('Скрытые клетки недоступны для правки.');redraw();return false;}
      if(!result.ok){cfg.message('Перенос выходит за границы поля.');return false;}
      if(cfg.locked())return false;
      if(result.changed){known=result.rows.slice();selected=result.selection;cfg.commit(result.rows,result);}else{selected=result.selection;redraw();}
      return true;
    }
    function finish(cancel=false,e){const d=drag;drag=null;if(!d)return;
      if(e)try{cv.releasePointerCapture(e.pointerId);}catch(_){}
      cv.style.cursor='';
      if(cancel){if(d.kind==='view')cfg.pan(d.ox,d.oy);redraw();return;}
      if(d.kind==='pan'){cfg.save();return;}
      if(d.kind==='view'){
        if(d.moved){cfg.save();return;}
        if(!d.cell||cfg.locked())return;
        if(cfg.rows()[d.cell[0]]?.[d.cell[1]]==='1'){selected=[d.cell];redraw();}
        else commit(apply(cfg.rows(),[d.cell],{create:true}));return;
      }
      if(!same(d.rows,cfg.rows())){selected=[];cfg.message('Поле изменилось во время жеста — повторите правку.');redraw();return;}
      if(d.kind==='move'&&d.moved){if(!d.invalid)commit(apply(d.rows,d.cells,{dr:d.dr,dc:d.dc,copy:d.copy}));else redraw();return;}
      if(d.kind==='box'){
        if(d.moved){selected=unique([...d.base,...rectangle(d.rows,d.anchor,d.end)]).filter(visible);redraw();}
        else if(!d.add)commit(apply(d.rows,[d.anchor],{create:true}));
        return;
      }
      redraw();
    }
    cv.addEventListener('pointerdown',e=>{
      if(!enabled()||(e.button!==0&&e.button!==1))return;consume(e);sync();cv.focus({preventScroll:true});
      const [x,y]=xy(e),g=cfg.geometry();
      if(e.button===1||space){drag={kind:'pan',x,y,ox:g.ox,oy:g.oy};cv.setPointerCapture(e.pointerId);return;}
      const options=cfg.options?.()||{},multi=e.shiftKey||options.multi,cell=at(e);
      if(options.panUnselected&&!multi&&!e.ctrlKey&&!e.metaKey&&!options.copy&&(!cell||!selected.some(p=>key(p)===key(cell))||cfg.locked())){
        drag={kind:'view',cell,x,y,ox:g.ox,oy:g.oy,moved:false};cv.setPointerCapture(e.pointerId);return;
      }
      if(cfg.locked()||!cell)return;hover=cell;
      if(cfg.rows()[cell[0]][cell[1]]==='1'){
        const has=selected.some(p=>key(p)===key(cell));
        if(multi)selected=has?selected.filter(p=>key(p)!==key(cell)):[...selected,cell];else if(!has)selected=[cell];
        drag={kind:'move',rows:cfg.rows().slice(),cells:selected.slice(),anchor:cell,x,y,moved:false,dr:0,dc:0,copy:e.ctrlKey||e.metaKey||!!options.copy};
      }else drag={kind:'box',rows:cfg.rows().slice(),anchor:cell,end:cell,base:multi?selected.slice():[],add:multi,x,y,moved:false};
      cv.setPointerCapture(e.pointerId);redraw();
    },true);
    cv.addEventListener('pointermove',e=>{
      if(!enabled())return;hover=at(e);if(!drag)return;consume(e);const [x,y]=xy(e);
      if(drag.kind==='pan'){cv.style.cursor='grabbing';cfg.pan(drag.ox+x-drag.x,drag.oy+y-drag.y);return;}
      if(Math.abs(x-drag.x)+Math.abs(y-drag.y)>3)drag.moved=true;
      if(drag.kind==='view'){if(drag.moved){cv.style.cursor='grabbing';cfg.pan(drag.ox+x-drag.x,drag.oy+y-drag.y);}return;}
      const cell=at(e,true);drag.invalid=!!cfg.visible&&!cell;if(!cell){redraw();return;}
      if(drag.kind==='move'){drag.dr=cell[0]-drag.anchor[0];drag.dc=cell[1]-drag.anchor[1];drag.copy=e.ctrlKey||e.metaKey||!!cfg.options?.().copy;cv.style.cursor=drag.copy?'copy':'grabbing';}
      else drag.end=cell;redraw();
    },true);
    cv.addEventListener('pointerup',e=>{if(!drag)return;consume(e);finish(false,e);},true);
    cv.addEventListener('pointercancel',e=>{if(!drag)return;consume(e);finish(true,e);},true);
    cv.addEventListener('lostpointercapture',()=>{if(drag)finish(true);});
    cv.addEventListener('pointerleave',()=>{if(!drag)hover=null;});
    cv.addEventListener('dblclick',e=>{if(enabled())consume(e);},true);
    cv.addEventListener('keydown',e=>{
      if(!enabled())return;
      if(e.key===' '){consume(e);space=true;return;}
      if(e.key==='Escape'){consume(e);if(drag)finish(true);else{selected=[];redraw();}return;}
      const mod=e.ctrlKey||e.metaKey,letter=e.key.toLowerCase();
      if(mod&&letter==='a'){consume(e);selectAll();return;}
      if(mod&&(letter==='c'||letter==='x')){
        if(!selected.length)return;consume(e);const r=Math.min(...selected.map(p=>p[0])),c=Math.min(...selected.map(p=>p[1]));clipboard=selected.map(p=>[p[0]-r,p[1]-c]);
        if(letter==='x')commit(apply(cfg.rows(),selected,{erase:true}));return;
      }
      if(mod&&letter==='v'){
        if(!clipboard.length)return;consume(e);const anchor=hover||selected[0]||[0,0];commit(apply(cfg.rows(),clipboard.map(([r,c])=>[r+anchor[0],c+anchor[1]]),{create:true}));return;
      }
      if((e.key==='Delete'||e.key==='Backspace')&&selected.length){consume(e);commit(apply(cfg.rows(),selected,{erase:true}));return;}
      const delta={ArrowLeft:[0,-1],ArrowRight:[0,1],ArrowUp:[-1,0],ArrowDown:[1,0]}[e.key];
      if(delta&&selected.length){consume(e);commit(apply(cfg.rows(),selected,{dr:delta[0],dc:delta[1]}));}
    },true);
    cv.addEventListener('keyup',e=>{if(e.key===' '){space=false;if(enabled())consume(e);}},true);
    cv.addEventListener('blur',()=>{space=false;if(drag)finish(true);});
    function paint(g,geometry){
      sync();if(!enabled())return;
      let cells=selected,color='#79c6ff',fill=false;
      if(drag?.kind==='box'&&drag.moved){cells=unique([...drag.base,...rectangle(drag.rows,drag.anchor,drag.end)]);fill=true;}
      if(drag?.kind==='move'&&drag.moved){cells=drag.cells.map(([r,c])=>[r+drag.dr,c+drag.dc]);color=cells.every(p=>inside(cfg.rows(),p))?'#ffffff':'#ff6b6b';fill=true;}
      if(!cells.length)return;const path=new Path2D();
      for(const [r,c] of cells){if(!inside(cfg.rows(),[r,c])||r>=geometry.M||!visible([r,c]))continue;const points=cfg.polygon(r,c,geometry);path.moveTo(...points[0]);for(const p of points.slice(1))path.lineTo(...p);path.closePath();}
      g.save();g.strokeStyle=color;g.lineWidth=2;g.lineJoin='miter';if(fill){g.globalAlpha=.25;g.fillStyle=color;g.fill(path);}g.globalAlpha=1;g.stroke(path);g.restore();
    }
    function selectAll(){selected=[];for(let r=0;r<cfg.rows().length;r++)for(let c=0;c<cfg.rows()[r].length;c++)if(cfg.rows()[r][c]==='1'&&visible([r,c]))selected.push([r,c]);redraw();}
    return {paint,sync,selectAll,setSelection(cells){selected=unique(cells).filter(p=>inside(cfg.rows(),p)&&visible(p));redraw();},erase(){commit(apply(cfg.rows(),selected,{erase:true}));},cancelGesture(){if(drag)finish(true);space=false;},clear(){selected=[];drag=null;space=false;known=cfg.rows().slice();},selection:()=>selected.map(p=>p.slice())};
  }
  return {inside,hit,rectangle,apply,mount};
});
