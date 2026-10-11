/* Affine scene composition and periodic mirror paths. No intermediate viewport clipping. */
(() => {
  'use strict';
  const identity = () => [1,0,0,1,0,0];
  const multiply = (a,b) => [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
  const point = (m,x,y) => [m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
  const placement = (x,y,a,s=1) => [s*Math.cos(a),s*Math.sin(a),-s*Math.sin(a),s*Math.cos(a),x,y];
  function copies(mirrors,reflect){let out=[{matrix:identity(),mask:0}];mirrors.forEach((m,i)=>{if(m.on){const r=reflect(m.x,m.y,m.angle);out=out.concat(out.map(c=>({matrix:multiply(r,c.matrix),mask:c.mask|(1<<i)})));}});return out;}
  function bounds(items){let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const item of items){const b=item.bounds;for(const p of [[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]]){const [x,y]=point(item.matrix,...p);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}}return [x0,y0,x1,y1];}
  function transformRows(rows,mode){return rows.map(row=>{let s=(mode&2)?[...row].reverse().join(''):row;if(mode&1)s=s.replace(/[01]/g,bit=>bit==='0'?'1':'0');return s;});}
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
  const api={identity,multiply,point,placement,copies,bounds,transformRows,expression,compile};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else window.ZZMirrorScene=api;
})();
