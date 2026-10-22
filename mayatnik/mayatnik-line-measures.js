/* Длины направляющих в шагах сетки битов, разбиение в точках пересечения. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MayatnikLineMeasures = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const EPS = 1e-8, cross = (a,b) => a[0]*b[1]-a[1]*b[0];
  const sub = (a,b) => [a[0]-b[0],a[1]-b[1]], at = (a,b,t) => [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  const length = (a,b) => Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]));
  const key = n => Math.round(n*1e7)/1e7;
  function clip(a,b,box) {
    const d=sub(b,a);let lo=0,hi=1;
    for(const [p,q] of [[-d[0],a[0]-box.left],[d[0],box.right-a[0]],[-d[1],a[1]-box.top],[d[1],box.bottom-a[1]]]) {
      if(Math.abs(p)<EPS){if(q<0)return null;continue;}
      const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);
    }
    return lo<=hi+EPS ? [at(a,b,lo),at(a,b,hi)] : null;
  }
  function merge(input) {
    const groups=new Map();
    for(const line of input) {
      if(!line?.a||!line?.b||![...line.a,...line.b].every(Number.isFinite))continue;
      const delta=sub(line.b,line.a),norm=Math.hypot(...delta);if(norm<EPS)continue;
      const sign=delta[0]<-EPS||Math.abs(delta[0])<EPS&&delta[1]<0?-1:1,u=delta.map(v=>v/norm*sign);
      const offset=cross(u,line.a),id=[...u,offset].map(key).join(':'),t=p=>p[0]*u[0]+p[1]*u[1];
      if(!groups.has(id))groups.set(id,{u,offset,spans:[]});
      groups.get(id).spans.push({lo:Math.min(t(line.a),t(line.b)),hi:Math.max(t(line.a),t(line.b)),color:line.color||'#b48cff'});
    }
    const result=[];
    for(const {u,offset,spans} of groups.values()) {
      spans.sort((a,b)=>a.lo-b.lo);const united=[];
      for(const span of spans){const last=united[united.length-1];if(last&&span.lo<=last.hi+EPS)last.hi=Math.max(last.hi,span.hi);else united.push({...span});}
      const point=t=>[u[0]*t-u[1]*offset,u[1]*t+u[0]*offset];
      for(const span of united){const a=point(span.lo),b=point(span.hi);result.push({a,b,color:span.color,id:[...a,...b].map(key).join(':'),length:length(a,b)});}
    }
    return result;
  }
  function split(input) {
    const lines=merge(input),cuts=lines.map(()=>[0,1]);if(!lines.length)return [];
    const xs=lines.flatMap(l=>[l.a[0],l.b[0]]),ys=lines.flatMap(l=>[l.a[1],l.b[1]]);
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const x of xs){minX=Math.min(minX,x);maxX=Math.max(maxX,x);}for(const y of ys){minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
    const size=Math.max(maxX-minX,maxY-minY,1)/Math.min(128,Math.max(1,Math.sqrt(lines.length))),grid=new Map();
    lines.forEach((line,i)=>{
      const x0=Math.floor((Math.min(line.a[0],line.b[0])-minX)/size),x1=Math.floor((Math.max(line.a[0],line.b[0])-minX)/size);
      const y0=Math.floor((Math.min(line.a[1],line.b[1])-minY)/size),y1=Math.floor((Math.max(line.a[1],line.b[1])-minY)/size),candidates=new Set();
      for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){const id=x+':'+y;for(const j of grid.get(id)||[])candidates.add(j);if(!grid.has(id))grid.set(id,[]);grid.get(id).push(i);}
      for(const j of candidates){const other=lines[j],r=sub(line.b,line.a),s=sub(other.b,other.a),den=cross(r,s);
        if(Math.abs(den)<EPS*Math.hypot(...r)*Math.hypot(...s))continue;
        const d=sub(other.a,line.a),t=cross(d,s)/den,v=cross(d,r)/den;
        if(t>=-EPS&&t<=1+EPS&&v>=-EPS&&v<=1+EPS){cuts[i].push(Math.max(0,Math.min(1,t)));cuts[j].push(Math.max(0,Math.min(1,v)));}
      }
    });
    return lines.map((line,i)=>{
      const sorted=cuts[i].sort((a,b)=>a-b).filter((t,j,a)=>!j||t-a[j-1]>EPS),segments=[];
      for(let j=1;j<sorted.length;j++){const a=at(line.a,line.b,sorted[j-1]),b=at(line.a,line.b,sorted[j]);if(length(a,b)>EPS)segments.push({a,b,length:length(a,b)});}
      return {...line,segments};
    });
  }
  // Рисуем прежним Canvas API и одновременно сохраняем конечные отрезки, включая пилу.
  function capture(context,draw,{origin=[0,0],scale=1}={}) {
    const lines=[],stack=[];let path=[],point=null,rect=null,replace=false;
    let bounds={left:-Infinity,top:-Infinity,right:Infinity,bottom:Infinity};
    const add=(a,b,color)=>{const clipped=clip(a,b,bounds);if(!clipped)return;const convert=p=>[(p[0]-origin[0])/scale,(p[1]-origin[1])/scale];lines.push({a:convert(clipped[0]),b:convert(clipped[1]),color});};
    const proxy=new Proxy(context,{
      get(target,name){
        if(name==='measureTarget')return target;
        if(name==='recordLine')return (a,b,options={})=>{add(a,b,options.color||target.strokeStyle);if(options.replace)replace=true;};
        const value=Reflect.get(target,name,target);if(typeof value!=='function')return value;
        return (...args)=>{
          if(name==='beginPath'){path=[];point=null;rect=null;}
          else if(name==='moveTo')point=args.slice(0,2);
          else if(name==='lineTo'){const next=args.slice(0,2);if(point)path.push([point,next]);point=next;}
          else if(name==='rect')rect={left:args[0],top:args[1],right:args[0]+args[2],bottom:args[1]+args[3]};
          else if(name==='save')stack.push({...bounds});
          else if(name==='restore')bounds=stack.pop()||bounds;
          else if(name==='clip'&&rect)bounds={left:Math.max(bounds.left,rect.left),top:Math.max(bounds.top,rect.top),right:Math.min(bounds.right,rect.right),bottom:Math.min(bounds.bottom,rect.bottom)};
          else if(name==='stroke'){if(!args.length&&!replace)for(const[a,b]of path)add(a,b,target.strokeStyle);replace=false;}
          return value.apply(target,args);
        };
      },set(target,name,value){return Reflect.set(target,name,value,target);}
    });
    draw(proxy);return lines;
  }
  // Крупные размеры первыми; подписи занимают не более малой доли окна.
  function layoutLabels(candidates,width,height) {
    const limit=Math.max(4,Math.min(32,Math.floor(width*height/24000))),gap=6,used=[];
    const sorted=candidates.filter(c=>c.span+EPS>=Math.max(80,c.w+16)&&c.w<=width-4&&c.h<=height-4)
      .sort((a,b)=>(b.span*(b.whole?1.4:1))-(a.span*(a.whole?1.4:1))||a.id.localeCompare(b.id));
    for(const c of sorted){
      let chosen=null;
      for(const offset of [7,-c.h-7,24,-c.h-24,42,-c.h-42]){
        const left=Math.max(2,Math.min(width-c.w-2,c.vertical?c.x+offset:c.x-c.w/2));
        const top=Math.max(2,Math.min(height-c.h-2,c.vertical?c.y-c.h/2:c.y+offset));
        const rect={left,top,right:left+c.w,bottom:top+c.h};
        if(used.every(o=>rect.right+gap<=o.left||o.right+gap<=rect.left||rect.bottom+gap<=o.top||o.bottom+gap<=rect.top)){chosen=rect;break;}
      }
      if(!chosen)continue;used.push({...c,...chosen});if(used.length>=limit)break;
    }
    return used;
  }
  function mount(host) {
    const root=document.createElement('div');root.id='mayLineMeasures';root.setAttribute('aria-label','Длины линий в битах');
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),path=document.createElementNS(ns,'path');
    const guides=document.createElementNS(ns,'g');guides.classList.add('may-measure-guides');
    svg.setAttribute('aria-hidden','true');svg.append(guides,path);root.append(svg);document.body.append(root);
    root.addEventListener('wheel',e=>{if(!host)return;const forwarded=new WheelEvent('wheel',{deltaX:e.deltaX,deltaY:e.deltaY,deltaZ:e.deltaZ,deltaMode:e.deltaMode,clientX:e.clientX,clientY:e.clientY,ctrlKey:e.ctrlKey,altKey:e.altKey,shiftKey:e.shiftKey,metaKey:e.metaKey,bubbles:true,cancelable:true});if(!host.dispatchEvent(forwarded))e.preventDefault();},{passive:false});
    const labels=new Map();let active=null,view=null,items=new Map(),cacheKey='',cache=[];
    const format=n=>Number(n.toFixed(2)).toLocaleString('ru-RU');
    const probe=document.createElement('span');probe.className='may-line-value';probe.textContent='0';root.append(probe);
    const style=getComputedStyle(probe),metrics=document.createElement('canvas').getContext('2d');metrics.font=style.fontSize+' '+style.fontFamily;
    const padX=parseFloat(style.paddingLeft)+parseFloat(style.paddingRight),labelH=parseFloat(style.lineHeight)+parseFloat(style.paddingTop)+parseFloat(style.paddingBottom);probe.remove();
    const highlight=id=>{
      active=id;const item=items.get(id);for(const [key,node]of labels)node.classList.toggle('may-measure-active',key===id);
      if(!item||!view){path.removeAttribute('d');delete path.dataset.measure;return;}
      const p=q=>[(q[0]*view.scale+view.x),(q[1]*view.scale+view.y)];
      path.setAttribute('d','M'+p(item.a).join(',')+'L'+p(item.b).join(','));
      path.dataset.measure=id;
    };
    return {root,update(input,nextView){
      view=nextView;root.hidden=!view;if(!view){items.clear();highlight(null);return;}
      Object.assign(root.style,{left:view.left+'px',top:view.top+'px',width:view.width+'px',height:view.height+'px'});
      svg.setAttribute('viewBox',`0 0 ${view.width} ${view.height}`);
      const serialized=JSON.stringify(input.map(l=>[...l.a,...l.b,l.color].map(v=>typeof v==='number'?key(v):v)));
      if(serialized!==cacheKey){cache=split(input);cacheKey=serialized;}
      const p=q=>[q[0]*view.scale+view.x,q[1]*view.scale+view.y];
      const foreground=[...merge(input),...(view.axis?[view.axis]:[])],groups=new Map();
      for(const line of foreground){const color=/^#0{3}(?:0{3})?$/i.test(line.color)?'#b48cff':line.color,k=color+'|'+!!line.dash;
        if(!groups.has(k))groups.set(k,{color,dash:line.dash,paths:[]});groups.get(k).paths.push('M'+p(line.a).join(',')+'L'+p(line.b).join(','));}
      guides.replaceChildren(...[...groups.values()].map(group=>{const q=document.createElementNS(ns,'path');q.style.stroke=group.color;q.setAttribute('d',group.paths.join(''));if(group.dash)q.setAttribute('stroke-dasharray','4 3');return q;}));
      items=new Map();const candidates=[],box={left:-view.x/view.scale,top:-view.y/view.scale,right:(view.width-view.x)/view.scale,bottom:(view.height-view.y)/view.scale};
      for(const line of cache){
        const pieces=line.segments.length>1?[{...line,whole:true},...line.segments.map(s=>({...s,whole:false}))]:[{...line,whole:true}];
        pieces.forEach((piece,index)=>{
          const visible=clip(piece.a,piece.b,box);if(!visible)return;
          const id=line.id+'/'+index,mid=at(...visible,piece.whole&&pieces.length>1 ? .18 : .5),prefix=piece.whole&&pieces.length>1?'Σ ':'';
          const text=prefix+format(piece.length),span=length(...visible)*view.scale;
          candidates.push({id,piece,line,text,whole:piece.whole,span,w:Math.ceil(metrics.measureText(text).width+padX),h:labelH,x:view.x+mid[0]*view.scale,y:view.y+mid[1]*view.scale,vertical:Math.abs(piece.b[1]-piece.a[1])>Math.abs(piece.b[0]-piece.a[0])});
        });
      }
      const selected=layoutLabels(candidates,view.width,view.height);
      for(const {id,piece,line,text,left,top}of selected){
          items.set(id,piece);let node=labels.get(id);
          if(!node){node=document.createElement('span');node.className='may-line-value';node.tabIndex=0;node.setAttribute('role','note');
            node.addEventListener('pointerenter',()=>highlight(id));node.addEventListener('pointerleave',()=>highlight(null));node.addEventListener('focus',()=>highlight(id));node.addEventListener('blur',()=>highlight(null));
            node.addEventListener('pointerdown',e=>e.stopPropagation());node.addEventListener('keydown',e=>{if(e.key==='Escape'){node.blur();highlight(null);}});root.append(node);labels.set(id,node);}
          if(node.textContent!==text)node.textContent=text;
          node.dataset.length=String(piece.length);node.dataset.kind=piece.whole?'line':'segment';node.dataset.line=line.id;
          node.style.setProperty('--measure-color',/^#0{3}(?:0{3})?$/i.test(line.color)?'#b48cff':line.color);
          node.title=(piece.whole?'Вся линия':'Участок между пересечениями')+' — '+format(piece.length)+' бит. Длина в шагах сетки, по диагонали — шаг по клетке.';
          node.setAttribute('aria-label',node.title);node.style.left=left+'px';node.style.top=top+'px';
      }
      for(const[id,node]of labels)if(!items.has(id)){node.remove();labels.delete(id);}
      highlight(items.has(active)?active:null);
    }};
  }
  return {clip,merge,split,capture,mount,length,layoutLabels};
});
