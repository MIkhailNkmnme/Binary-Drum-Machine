/* Cell geometry is an annotation layer; it never writes to the bit field. */
window.MayatnikCellInk = function(o){
  const $=id=>document.getElementById(id), key='mayatnik-cell-ink-v1';
  let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}');}catch(_){}
  const book=()=>o.state().cellInk||(o.state().cellInk=saved);
  let tool='back',undo=[];
  const bar=document.createElement('div');bar.id='cellInkBar';bar.hidden=true;
  bar.innerHTML='<strong>Грани клеток</strong><button data-tool="back" title="1 — косая сверху слева вниз вправо">1 · \\</button><button data-tool="slash" title="2 — косая снизу слева вверх вправо">2 · /</button><button data-tool="top" title="NumPad 5 — верхняя грань">5 · верх</button><button data-tool="bottom" title="NumPad 0 — нижняя грань">0 · низ</button><button data-tool="box" title="Рамка всей клетки">□</button><button data-tool="erase" title="Убрать все пометки клетки">Ластик</button><button id="cellInkUndo" title="Отменить последнюю пометку">↶</button><span id="cellInkHint"></span>';
  document.body.append(bar);
  const canvas=document.createElement('canvas');canvas.id='cellInkCanvas';canvas.hidden=true;canvas.setAttribute('aria-label','Сетка и пометки граней клеток');document.body.append(canvas);
  const persist=()=>{try{localStorage.setItem(key,JSON.stringify(book()));}catch(_){}o.save();};
  const frame=()=>{const v=o.view();return v?[v.W,v.H,v.k,v.anchor,v.mode,v.steps,v.pair,v.bg].join(':'):'';};
  const marks=()=>book()[frame()]||{};
  function choose(t){tool=t;for(const b of bar.querySelectorAll('[data-tool]'))b.setAttribute('aria-pressed',String(b.dataset.tool===t));}
  for(const b of bar.querySelectorAll('[data-tool]'))b.onclick=()=>choose(b.dataset.tool);
  $('cellInkUndo').onclick=()=>{const u=undo.pop();if(!u)return;const m=book()[u.frame]||(book()[u.frame]={});if(u.before)m[u.cell]=u.before;else delete m[u.cell];persist();draw();};
  function line(ctx,a,b,c,d){ctx.moveTo(a,b);ctx.lineTo(c,d);}
  function draw(){
    const v=o.view(),on=$('cellInk').checked;bar.hidden=!on;canvas.hidden=!on||!v||v.romb;
    if(!on)return;
    $('cellInkUndo').disabled=!undo.length;
    $('cellInkHint').textContent=v?.romb?'Для квадратных клеток выбери «Биты» или «Цифры».':v?.s<6?'Приблизь до ×6: появится сетка. Esc — выход.':'Щелчок — поставить; ПКМ — убрать косые; Esc — выход. Биты не меняются.';
    if(!v||v.romb)return;
    const host=o.wrap.getBoundingClientRect(),rect=o.canvas.getBoundingClientRect(),d=Math.min(2,devicePixelRatio||1),w=o.wrap.clientWidth,h=o.wrap.clientHeight;
    Object.assign(canvas.style,{left:host.left+'px',top:host.top+'px',width:w+'px',height:h+'px'});canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);
    const ctx=canvas.getContext('2d');ctx.setTransform(d,0,0,d,0,0);
    const s=v.s,x0=rect.left-host.left,y0=rect.top-host.top,c0=Math.max(0,Math.floor(-x0/s)),c1=Math.min(v.width,Math.ceil((w-x0)/s)),r0=Math.max(0,Math.floor(-y0/s)),r1=Math.min(v.height,Math.ceil((h-y0)/s));
    if(s<4)return; // Do not scan a multi-million-cell field when zoomed out.
    const has=(x,y)=>x>=0&&x<v.width&&y>=0&&y<v.height&&v.bit(x,y)>=0;
    // Only the visible cells are visited, including at 4096 rows.
    for(const pass of ['grid','border','marks']){
      if(pass==='grid'&&s<6)continue;
      ctx.beginPath();ctx.strokeStyle=pass==='grid'?'rgba(30,70,90,.48)':pass==='border'?'#ffd966':'#00b7ce';ctx.lineWidth=pass==='grid'?.65:pass==='border'?1.5:Math.max(1.5,Math.min(3,s*.09));
      const m=marks();
      for(let y=r0;y<r1;y++)for(let x=c0;x<c1;x++){
        if(!has(x,y))continue;const X=x0+x*s,Y=y0+y*s;
        if(pass==='grid'){ctx.rect(X,Y,s,s);continue;}
        if(pass==='border'){
          if(!has(x,y-1))line(ctx,X,Y,X+s,Y);if(!has(x,y+1))line(ctx,X,Y+s,X+s,Y+s);
          if(!has(x-1,y))line(ctx,X,Y,X,Y+s);if(!has(x+1,y))line(ctx,X+s,Y,X+s,Y+s);continue;
        }
        const a=m[y+':'+(x+v.VX)];if(!a)continue;
        if(a.back)line(ctx,X,Y,X+s,Y+s);if(a.slash)line(ctx,X,Y+s,X+s,Y);
        if(a.top)line(ctx,X,Y,X+s,Y);if(a.bottom)line(ctx,X,Y+s,X+s,Y+s);if(a.box)ctx.rect(X,Y,s,s);
      }
      ctx.stroke();
    }
  }
  function hit(e){const v=o.view();if(!v||v.romb||v.s<6)return null;const r=o.canvas.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)/v.s),y=Math.floor((e.clientY-r.top)/v.s);return x>=0&&x<v.width&&y>=0&&y<v.height&&v.bit(x,y)>=0?y+':'+(x+v.VX):null;}
  function edit(e){const cell=hit(e);if(!cell)return;const f=frame(),m=book()[f]||(book()[f]={}),before=m[cell]&&{...m[cell]},a={...m[cell]};
    if(e.button===2){delete a.back;delete a.slash;}else if(tool==='erase'){for(const k in a)delete a[k];}else{if(a[tool])delete a[tool];else a[tool]=true;}
    if(JSON.stringify(before||{})===JSON.stringify(a))return;
    undo.push({frame:f,cell,before});if(undo.length>200)undo.shift();if(Object.keys(a).length)m[cell]=a;else delete m[cell];persist();draw();
  }
  for(const name of ['pointerdown','pointerup','mousedown','mouseup','click','dblclick','contextmenu'])o.wrap.addEventListener(name,e=>{
    if(!$('cellInk').checked||e.button===1||e.target!==o.canvas&&e.target!==o.wrap)return;
    e.preventDefault();e.stopImmediatePropagation();if(name==='pointerdown'&&(e.button===0||e.button===2))edit(e);
  },true);
  addEventListener('keydown',e=>{
    if(!$('cellInk').checked||e.ctrlKey||e.altKey||e.metaKey||e.target.closest?.('input,textarea,select,[contenteditable="true"]'))return;
    const t=e.code==='Numpad5'?'top':e.code==='Numpad0'?'bottom':e.code==='Digit1'||e.code==='Numpad1'?'back':e.code==='Digit2'||e.code==='Numpad2'?'slash':null;
    if(t){e.preventDefault();e.stopImmediatePropagation();choose(t);}else if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();$('cellInk').click();}
  },true);
  $('cellInk').addEventListener('change',draw);choose(tool);
  return {draw};
};
