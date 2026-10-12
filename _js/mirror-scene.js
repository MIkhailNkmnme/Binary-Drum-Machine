/* v0.1123: contrast-safe controls, triangular face mapping and constrained axis motion; v0.1121: manual mirror snapping; affine scene composition and periodic mirror paths. */
(() => {
  'use strict';
  const identity = () => [1,0,0,1,0,0];
  const multiply = (a,b) => [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
  const point = (m,x,y) => [m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
  const placement = (x,y,a,s=1) => [s*Math.cos(a),s*Math.sin(a),-s*Math.sin(a),s*Math.cos(a),x,y];
  function copies(mirrors,reflect){let out=[{matrix:identity(),mask:0}];mirrors.forEach((m,i)=>{if(m.on){const r=reflect(m.x,m.y,m.angle);out=out.concat(out.map(c=>({matrix:multiply(r,c.matrix),mask:c.mask|(1<<i)})));}});return out;}
  function bounds(items){let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const item of items){const b=item.bounds;for(const p of [[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]]){const [x,y]=point(item.matrix,...p);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}}return [x0,y0,x1,y1];}
  function transformRows(rows,mode){return rows.map(row=>{let s=(mode&2)?[...row].reverse().join(''):row;if(mode&1)s=s.replace(/[01]/g,bit=>bit==='0'?'1':'0');return s;});}
  // UI colours may brighten a dark mirror; the actual drawing colour stays intact.
  function controlColor(hex){
    const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)),lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
    if(lum(rgb)>=.24)return hex;let lo=0,hi=1;
    for(let i=0;i<16;i++){const t=(lo+hi)/2;if(lum(rgb.map(v=>v+(255-v)*t))<.24)lo=t;else hi=t;}
    return '#'+rgb.map(v=>Math.ceil(v+(255-v)*hi).toString(16).padStart(2,'0')).join('');
  }
  // Triangular rows are mapped once, so the flat net and solid receive identical bits.
  function faceRows(rows,limit=160){const n=Math.max(2,Math.min(limit,rows.length));return Array.from({length:n},(_,r)=>Array.from({length:r+1},(_,k)=>String(rows[r]||'')[k]==='1'?1:0));}
  function facePairs(rows,nb){const u=faceRows(rows),d=u.map(row=>row.map(bit=>bit^1));return Array.from({length:nb},()=>({u:u.map(row=>row.slice()),d:d.map(row=>row.slice())}));}
  function axisMove(x,y,dx,dy,angle,width,height){const c=Math.cos(angle),s=Math.sin(angle);let lo=-Infinity,hi=Infinity;for(const [p,d,size] of [[x,c,width],[y,s,height]])if(Math.abs(d)>1e-10){const a=(.01*size-p)/d,b=(.99*size-p)/d;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));}const t=Math.max(lo,Math.min(hi,dx*c+dy*s));return [x+t*c,y+t*s];}
  function axisFromPoints(p,q,width,height){
    const dx=q[0]-p[0],dy=q[1]-p[1];if(Math.hypot(dx,dy)<1e-9)return null;
    const pi=Math.PI,angle=((Math.atan2(dy,dx)%pi)+pi)%pi;
    return {x:p[0]/width,y:p[1]/height,angle,turnGrip:(dx*Math.cos(angle)+dy*Math.sin(angle))/Math.hypot(width,height)};
  }
  function axisRotate(m,delta,width,height,anchor=0){
    const diag=Math.hypot(width,height),span=m.turnGrip==null?Math.min(width,height)*.18:m.turnGrip*diag;
    const target=m.angle+delta,pi=Math.PI,angle=((target%pi)+pi)%pi;
    const nextSpan=Math.cos(target-angle)<0?-span:span;
    const x=m.x*width+(anchor?span*Math.cos(m.angle)-nextSpan*Math.cos(angle):0);
    const y=m.y*height+(anchor?span*Math.sin(m.angle)-nextSpan*Math.sin(angle):0);
    return {x:x/width,y:y/height,angle,turnGrip:nextSpan/diag};
  }
  function snapAngle(angle,mirrors=[],tolerance=4*Math.PI/180){
    const pi=Math.PI,wrap=a=>((a%pi)+pi)%pi,targets=[0,30,45,60,90,120,135,150].map(d=>d*pi/180);
    for(const m of mirrors)targets.push(wrap(m.angle),wrap(m.angle+pi/2));
    let result=wrap(angle),distance=tolerance,locked=false;
    for(const target of targets){const delta=Math.abs(wrap(angle)-target),d=Math.min(delta,pi-delta);if(d<=distance){distance=d;result=target;locked=true;}}
    return {angle:result,snapped:locked,label:Math.round(result*180/pi)+'°'};
  }
  function snapPosition(x,y,mirrors,width,height,radius=10,allowed=[0,0,width,height],origin=[width/2,height/2]){
    const inside=p=>p[0]>=allowed[0]&&p[0]<=allowed[2]&&p[1]>=allowed[1]&&p[1]<=allowed[3];
    const anchors=[{point:origin,label:'центр холста'}],segments=[];
    for(const m of mirrors){const dx=Math.cos(m.angle),dy=Math.sin(m.angle);let lo=-Infinity,hi=Infinity,valid=true;
      for(const [c,d,size] of [[m.x,dx,width],[m.y,dy,height]]){if(Math.abs(d)<1e-10){if(c<0||c>size)valid=false;}else{const a=-c/d,b=(size-c)/d;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));}}
      if(!valid||lo>hi)continue;segments.push({m,dx,dy,lo,hi});anchors.push({point:[m.x,m.y],label:'центр зеркала'});
      for(const point of m.anchors||[])anchors.push({point,label:'точка оси'});
      for(const [t,label] of [[lo,'конец линии'],[hi,'конец линии'],[(lo+hi)/2,'½ линии'],[(3*lo+hi)/4,'½ половины'],[(lo+3*hi)/4,'½ половины']])anchors.push({point:[m.x+t*dx,m.y+t*dy],label});
    }
    for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){const a=segments[i],b=segments[j],cross=a.dx*b.dy-a.dy*b.dx;if(Math.abs(cross)<1e-10)continue;const t=((b.m.x-a.m.x)*b.dy-(b.m.y-a.m.y)*b.dx)/cross;if(t>=a.lo&&t<=a.hi)anchors.push({point:[a.m.x+t*a.dx,a.m.y+t*a.dy],label:'пересечение линий'});}
    let best=null,distance=radius;
    for(const a of anchors){if(!inside(a.point))continue;const d=Math.hypot(x-a.point[0],y-a.point[1]);if(d<=distance){distance=d;best={x:a.point[0],y:a.point[1],snapped:true,label:a.label};}}
    if(best)return best;
    for(const s of segments){const t=(x-s.m.x)*s.dx+(y-s.m.y)*s.dy;if(t<s.lo||t>s.hi)continue;const p=[s.m.x+t*s.dx,s.m.y+t*s.dy],d=Math.hypot(x-p[0],y-p[1]);if(inside(p)&&d<=distance){distance=d;best={x:p[0],y:p[1],snapped:true,label:'линия зеркала'};}}
    return best||{x,y,snapped:false,label:''};
  }
  // A small expression grammar, deliberately limited to numbers, t, constants and math.
  function expression(raw){
    const src=String(raw).replace(/\s/g,'');if(!src||src.length>256)throw Error('Формула: от 1 до 256 символов');
    const tokens=src.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[a-z]+|[()+\-*/^,]/gi)||[];
    if(tokens.join('')!==src||tokens.length>128)throw Error('Недопустимый символ или слишком длинная формула');
    let pos=0,depth=0;
    const functions={sin:Math.sin,cos:Math.cos,tan:Math.tan,abs:Math.abs,sqrt:Math.sqrt};
    const constants={pi:Math.PI,tau:Math.PI*2,e:Math.E};
    function primary(){if(++depth>32)throw Error('Формула слишком вложенная');let f;const token=tokens[pos++];
      if(token==='('){f=sum();if(tokens[pos++]!==')')throw Error('Не закрыта скобка');}
      else if(token==='t')f=t=>t;
      else if(Object.hasOwn(constants,token))f=()=>constants[token];
      else if(Object.hasOwn(functions,token)){if(tokens[pos++]!=='(')throw Error('После '+token+' нужна скобка');const arg=sum();if(tokens[pos++]!==')')throw Error('Не закрыта скобка');f=t=>functions[token](arg(t));}
      else if(token&&/^(?:\d|\.)/.test(token)){const value=Number(token);f=()=>value;}
      else throw Error('Неизвестное имя: '+(token||'конец формулы'));--depth;return f;}
    function power(){const a=primary();if(tokens[pos]==='^'){pos++;const b=unary();return t=>a(t)**b(t);}return a;}
    function unary(){if(tokens[pos]==='-'||tokens[pos]==='+'){const sign=tokens[pos++]==='-'?-1:1;const f=unary();return t=>sign*f(t);}return power();}
    function product(){let a=unary();while(tokens[pos]==='*'||tokens[pos]==='/'){const op=tokens[pos++],b=unary(),left=a;a=op==='*'?t=>left(t)*b(t):t=>left(t)/b(t);}return a;}
    function sum(){let a=product();while(tokens[pos]==='+'||tokens[pos]==='-'){const op=tokens[pos++],b=product(),left=a;a=op==='+'?t=>left(t)+b(t):t=>left(t)-b(t);}return a;}
    const fn=sum();if(pos!==tokens.length)throw Error('Лишний фрагмент формулы');return t=>{const v=fn(t);if(!Number.isFinite(v)||Math.abs(v)>100)throw Error('Значение формулы должно быть конечным, от −100 до 100');return v;};
  }
  function compile(path){
    let fx,fy;if(path.kind==='custom'){fx=expression(path.fx);fy=expression(path.fy);}else if(path.kind==='eight'){fx=t=>Math.sin(2*Math.PI*t);fy=t=>Math.sin(4*Math.PI*t);}else if(path.kind==='line'){fx=t=>Math.sin(2*Math.PI*t);fy=()=>0;}else{fx=t=>Math.cos(2*Math.PI*t);fy=t=>Math.sin(2*Math.PI*t);}
    const fa=path.orient==='custom'?expression(path.fa):path.orient==='turn'?t=>2*Math.PI*t:path.orient==='swing'?t=>Math.sin(2*Math.PI*t)*(path.swing||30)*Math.PI/180:()=>0;
    for(let i=0;i<=256;i++){fx(i/256);fy(i/256);fa(i/256);}
    if(Math.abs(fx(0)-fx(1))>1e-6||Math.abs(fy(0)-fy(1))>1e-6||Math.abs(Math.sin(fa(0)-fa(1)))>1e-6)throw Error('Начало и конец кривой должны совпадать');
    return t=>[fx(t),fy(t),fa(t)];
  }
  const api={identity,multiply,point,placement,copies,bounds,transformRows,controlColor,faceRows,facePairs,axisMove,axisFromPoints,axisRotate,snapAngle,snapPosition,expression,compile};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else window.ZZMirrorScene=api;
})();
