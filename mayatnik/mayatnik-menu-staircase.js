/* Маятник v0.493 · МАЯ-022: один ровный столбец справа от владельца, без изменения содержимого. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.mayStaircase = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const states = new WeakMap();
  const finite = (n, fallback = 0) => Number.isFinite(Number(n)) ? Number(n) : fallback;
  const step = (r, gap) => ({x:0,y:r.height+gap});
  function plan(items, {gap = 0} = {}) {
    gap = Math.max(0, finite(gap, 0));
    let x=0,y=0,width=0,height=0;
    const rows = items.map(item => {
      const w=finite(item.width),h=finite(item.height);
      if (w<=0 || h<=0) throw new RangeError('Staircase items must have positive finite dimensions');
      const r={x,y,width:w,height:h};width=Math.max(width,x+w);height=Math.max(height,y+h);
      const d=step(r,gap);x+=d.x;y+=d.y;return r;
    });
    return {items:rows,width,height,gap};
  }
  function place(p, {anchor,viewport,preferAbove=false,pad=14} = {}) {
    pad=Math.max(0,finite(pad,14));
    const v={left:finite(viewport.left),top:finite(viewport.top),width:Math.max(1,finite(viewport.width,1)),height:Math.max(1,finite(viewport.height,1))};
    const contentWidth=p.width+2*pad,contentHeight=p.height+2*pad;
    const a={width:Math.max(1,finite(anchor.width,120)),height:Math.max(1,finite(anchor.height,24))};
    const first=p.items[0]||a,minW=Math.min(v.width,first.width+2*pad),minH=Math.min(v.height,first.height+2*pad);
    const clamp=(n,lo,hi)=>Math.max(lo,Math.min(n,hi));
    const cut=Math.min(12,a.width/2,a.height/2);
    const left=clamp(finite(anchor.right,finite(anchor.left)+a.width)-cut-pad,v.left,v.left+v.width-minW);
    const desiredTop=finite(anchor.top)+a.height-cut-pad;
    const top=clamp(desiredTop,v.top,v.top+v.height-minH);
    const width=Math.min(contentWidth,v.left+v.width-left),height=Math.min(contentHeight,v.top+v.height-top);
    return {left,top,width,height,contentWidth,contentHeight,offsetX:pad,offsetY:pad,overflowX:contentWidth>width,overflowY:contentHeight>height};
  }
  const dimensionProps=['width','height','min-width','max-width','min-height','max-height'];
  const itemProps=['position','left','top','right','bottom','margin','--may-stair-x','--may-stair-y',...dimensionProps];
  const hostProps=['position','left','top','right','bottom','display','box-sizing','padding','margin','overflow-x','overflow-y',...dimensionProps];
  const remember=(el,props)=>new Map(props.map(k=>[k,[el.style.getPropertyValue(k),el.style.getPropertyPriority(k)]]));
  const restore=(el,saved,keys=[...saved.keys()])=>{for(const k of keys){const [v,p]=saved.get(k);if(v)el.style.setProperty(k,v,p);else el.style.removeProperty(k);}};
  const put=(el,k,v)=>{if(el.style.getPropertyValue(k)!==v||el.style.getPropertyPriority(k)!=='important')el.style.setProperty(k,v,'important');};
  const px=n=>n+'px';
  function restoreItem(el,saved){restore(el,saved);el.classList.remove('may-staircase-item');}
  function destroy(host) {
    const s=states.get(host);if(!s)return;
    for(const [el,saved]of s.items)restoreItem(el,saved);
    restore(host,s.host);s.spacer?.remove();host.classList.remove('may-staircase-host');delete host.dataset.mayStaircase;delete host._mayStaircase;states.delete(host);
  }
  function apply(host, {items=[],anchor,preferAbove=false,viewport,pad=14,gap=0} = {}) {
    if(!host||!anchor)return null;
    const win=host.ownerDocument.defaultView;
    viewport=viewport||{left:4,top:4,width:Math.max(1,win.innerWidth-8),height:Math.max(1,win.innerHeight-8)};
    let s=states.get(host);
    if(!s){s={host:remember(host,hostProps),items:new Map(),spacer:null};states.set(host,s);}
    const unique=[...new Set(items)].filter(el=>el!==host&&!el.hidden&&!el.dataset.mayStairIgnore);
    for(const [el,saved]of s.items)if(!unique.includes(el)){restoreItem(el,saved);s.items.delete(el);}
    const measured=[];
    // Restore natural dimensions before measuring: changing a control to a mini rhombus must take effect.
    for(const el of unique){let saved=s.items.get(el);if(!saved){saved=remember(el,itemProps);s.items.set(el,saved);}
      // Standard controls get their dimensions from the current full/mini CSS class,
      // even if an older layout left an inline mini width before our first measurement.
      if(el.classList.contains('may-standard')||el.classList.contains('may-control-mini'))for(const k of dimensionProps)el.style.removeProperty(k);
      else restore(el,saved,dimensionProps);
    }
    for(const el of unique){const r=el.getBoundingClientRect();if(r.width>0&&r.height>0)measured.push({element:el,width:r.width,height:r.height});}
    if(!measured.length){destroy(host);return null;}
    const p=plan(measured,{gap}),g=place(p,{anchor:anchor.getBoundingClientRect(),viewport,preferAbove,pad});
    const scrollLeft=host.scrollLeft,scrollTop=host.scrollTop;
    host.classList.add('may-staircase-host');host.dataset.mayStaircase='1';
    for(const [k,v]of Object.entries({position:'fixed',left:px(g.left),top:px(g.top),right:'auto',bottom:'auto',display:'block','box-sizing':'border-box',padding:'0',margin:'0',width:px(g.width),height:px(g.height),'min-width':'0','min-height':'0','max-width':px(g.width),'max-height':px(g.height),'overflow-x':g.overflowX?'auto':'hidden','overflow-y':g.overflowY?'auto':'hidden'}))put(host,k,v);
    const rows=p.items.map((r,i)=>({...r,x:r.x+g.offsetX,y:r.y+g.offsetY,element:measured[i].element}));
    for(const r of rows){const el=r.element;el.classList.add('may-staircase-item');
      for(const [k,v]of Object.entries({position:'absolute',left:'var(--may-stair-x)',top:'var(--may-stair-y)',right:'auto',bottom:'auto',margin:'0','--may-stair-x':px(r.x),'--may-stair-y':px(r.y),width:px(r.width),height:px(r.height),'min-width':px(r.width),'max-width':px(r.width),'min-height':px(r.height),'max-height':px(r.height)}))put(el,k,v);
    }
    if(!s.spacer?.parentNode){s.spacer=host.ownerDocument.createElement('div');s.spacer.className='may-staircase-spacer';s.spacer.dataset.mayStairIgnore='1';s.spacer.setAttribute('aria-hidden','true');host.append(s.spacer);}
    for(const [k,v]of Object.entries({position:'absolute',left:'0',top:'0',width:px(g.contentWidth),height:px(g.contentHeight),'pointer-events':'none',visibility:'hidden'}))put(s.spacer,k,v);
    host.scrollLeft=Math.max(0,Math.min(scrollLeft,g.contentWidth-(host.clientWidth||g.width)));host.scrollTop=Math.max(0,Math.min(scrollTop,g.contentHeight-(host.clientHeight||g.height)));
    const result={...g,items:rows,plan:p};host._mayStaircase=result;return result;
  }
  return {plan,place,apply,destroy};
});
