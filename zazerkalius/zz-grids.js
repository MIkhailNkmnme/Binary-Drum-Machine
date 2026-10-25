/* Independent grids v1: binary cells, color/group metadata, nodes, edges and scenes. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ZZGrids=api;})(globalThis,function(){
 'use strict';const clone=v=>JSON.parse(JSON.stringify(v)),key=(r,c)=>r+','+c;
 const own=(s,r,c)=>r>=0&&r<s.rows.length&&c>=0&&c<s.rows[r].length;
 function write(s,r,c,color){if(!own(s,r,c))return false;const bit=color?'1':'0',k=key(r,c),changed=s.rows[r][c]!==bit||s.colors[k]!==color;
  s.rows[r]=s.rows[r].slice(0,c)+bit+s.rows[r].slice(c+1);if(color)s.colors[k]=color;else delete s.colors[k];delete s.groups[k];return changed;}
 function reconcile(s,rows,op){
  if(op?.moves){for(const name of ['colors','groups']){const before={...s[name]};if(!op.copy)for(const [from] of op.moves)delete s[name][key(...from)];for(const [from,to] of op.moves){const v=before[key(...from)];if(v!==undefined)s[name][key(...to)]=clone(v);else delete s[name][key(...to)];}}}
  if(op?.copies){for(const name of ['colors','groups']){const before={...s[name]};for(const [from,to] of op.copies){const v=from&&before[key(...from)];if(v!==undefined&&v!==null)s[name][key(...to)]=clone(v);else delete s[name][key(...to)];}}}
  s.rows.splice(0,s.rows.length,...rows);for(const name of ['colors','groups'])for(const k of Object.keys(s[name])){const [r,c]=k.split(',').map(Number);if(!own(s,r,c)||s.rows[r][c]!=='1')delete s[name][k];}
  s.cur=Math.max(0,Math.min(s.rows.length-1,s.cur||0));
 }
 function scene(s){const out=clone(s);delete out.scenes;delete out.scene;delete out.legacyImported;return out;}
 function shiftRows(s,index,remove,add){const next=s.rows.slice();next.splice(index,remove,...add);for(const name of ['colors','groups']){const map={};for(const [k,v] of Object.entries(s[name])){const [r,c]=k.split(',').map(Number);if(r>=index&&r<index+remove)continue;map[key(r>=index?r+add.length-remove:r,c)]=v;}s[name]=map;}s.rows=next.length?next:['0'];s.textBlocks=[];s.text='';s.textWidth=null;s.cur=Math.max(0,Math.min(s.rows.length-1,index));}
 function component(s,cell,polygon){
  if(!cell||s.rows[cell[0]]?.[cell[1]]!=='1')return [];
  const color=s.colors[key(...cell)]||'',edges=new Map(),cells=new Map(),edgeKey=(a,b)=>{a=a.map(x=>Math.round(x*1e7)).join(',');b=b.map(x=>Math.round(x*1e7)).join(',');return a<b?a+'/'+b:b+'/'+a;};
  for(let r=0;r<s.rows.length;r++)for(let c=0;c<s.rows[r].length;c++){if(s.rows[r][c]!=='1'||(s.colors[key(r,c)]||'')!==color)continue;const p=polygon(r,c),k=key(r,c),es=p.map((a,i)=>edgeKey(a,p[(i+1)%p.length]));cells.set(k,es);for(const e of es){if(!edges.has(e))edges.set(e,[]);edges.get(e).push(k);}}
  const seen=new Set([key(...cell)]),queue=[key(...cell)];for(let i=0;i<queue.length;i++)for(const e of cells.get(queue[i])||[])for(const k of edges.get(e))if(!seen.has(k)){seen.add(k);queue.push(k);}return queue.map(k=>k.split(',').map(Number));
 }
 function legacyScene(item,base){
  const cells=Object.entries(item.c||{}),coords=cells.map(([k,v])=>[...k.split('_').map(Number),v]);
  const N=Math.max(1,item.N||0,...coords.map(v=>v[1]+1))+2,R=Math.max(1,item.R||0,...coords.map(v=>v[0]+1)),data={...scene(base),rows:Array.from({length:R},()=> '0'.repeat(N)),colors:{},groups:{},dots:{},lines:{},text:'',textBlocks:[],textWidth:null};
  const palette=['','#8b949e','#ffd166','#e5484d','#22d3ee','#f472b6','#4ade80','#a78bfa','#f8fafc'];
  for(const [r,c,color] of coords){const column=c+2-(r%2),k=r+'_'+c;write(data,r,column,palette[color]||'#ffd166');if(item.gl?.[k]||item.gi?.[k]!==undefined||item.gt?.[k])data.groups[key(r,column)]={id:'legacy-'+color,outline:item.gl?.[k],inner:item.gi?.[k],symbol:item.gt?.[k]};}
  const node=k=>{const [r,c]=k.split('_').map(Number);return [(c-N+2)/2,r*Math.sqrt(3)/2].map(x=>Math.round(x*1e8)/1e8).join(',');};
  for(const [k,value] of Object.entries(item.d||{})){const v=Array.isArray(value)?value:[value,3];data.dots[node(k)]={color:palette[v[0]]||'#ffd166',size:v[1]||3};}
  for(const [k,value] of Object.entries(item.l||{})){const v=Array.isArray(value)?value:[value,2];data.lines[k.split('|').map(node).sort().join('|')]={color:palette[v[0]]||'#ffd166',size:v[1]||2};}
  return data;
 }
 let cfg,canvas,gesture=null,selection=[],rowsKey='',sceneKey='';
 function redraw(){cfg.redraw();}
 function change(fn){if(cfg.locked())return;cfg.stop?.();cfg.snapshot();fn(cfg.state());redraw();cfg.save();}
 function cancel(){if(!gesture)return;const s=cfg.state(),before=gesture.before;Object.assign(s,clone(before));gesture=null;redraw();}
 function mount(cv,config){if(canvas)return;canvas=cv;cfg=config;const $=id=>document.getElementById(id),s=()=>cfg.state();
  const xy=e=>{const b=cv.getBoundingClientRect();return [e.clientX-b.left,e.clientY-b.top];};
  const hit=e=>cfg.hit(s().rows,cfg.geometry(),...xy(e));
  const poly=(r,c)=>cfg.polygon(r,c,cfg.geometry());
  const consume=e=>{e.preventDefault();e.stopImmediatePropagation();};
  const put=e=>{const cell=hit(e);if(!cell)return;const state=s(),tool=state.tool,points=poly(...cell),p=xy(e),g=cfg.geometry();
   if(tool==='brush'||tool==='erase'){write(state,...cell,tool==='brush'?state.color:null);return;}
   const world=q=>[(q[0]-g.ox)/g.tw,(q[1]-g.oy)/g.tw],nodeKey=q=>world(q).map(x=>Math.round(x*1e8)/1e8).join(',');
   if(tool==='dot'){let q=points.reduce((a,b)=>Math.hypot(a[0]-p[0],a[1]-p[1])<Math.hypot(b[0]-p[0],b[1]-p[1])?a:b),k=nodeKey(q);if(gesture.visited.has(k))return;gesture.visited.add(k);if(gesture.erase)delete state.dots[k];else state.dots[k]={color:state.color,size:state.stroke};}
   if(tool==='line'){let best,dist=Infinity;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy))),d=Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);if(d<dist){dist=d;best=[nodeKey(a),nodeKey(b)].sort().join('|');}}if(gesture.visited.has(best))return;gesture.visited.add(best);if(gesture.erase)delete state.lines[best];else state.lines[best]={color:state.color,size:state.stroke};}
  };
  cv.addEventListener('pointerdown',e=>{if(!s().tool||!['brush','erase','group','dot','line'].includes(s().tool)||e.button>2)return;consume(e);if(cfg.locked())return;cfg.stop?.();cv.focus({preventScroll:true});
   if(s().tool==='group'){selection=component(s(),hit(e),poly);cfg.editor()?.setSelection(selection);s().tool='';cfg.view().edit=true;cfg.message('Группа выделена: тяните для переноса; Копия — для копирования.');redraw();return;}
   gesture={before:clone(s()),visited:new Set(),erase:e.button===2};cv.setPointerCapture(e.pointerId);put(e);redraw();
  },true);
  cv.addEventListener('pointermove',e=>{if(!gesture)return;consume(e);put(e);redraw();},true);
  cv.addEventListener('pointerup',e=>{if(!gesture)return;consume(e);const before=gesture.before;gesture=null;try{cv.releasePointerCapture(e.pointerId);}catch(_){}if(JSON.stringify(before)!==JSON.stringify(s()))cfg.snapshot(before);cfg.save();redraw();},true);
  cv.addEventListener('pointercancel',e=>{if(gesture){consume(e);cancel();}},true);cv.addEventListener('lostpointercapture',cancel);cv.addEventListener('blur',cancel);
  cv.addEventListener('contextmenu',e=>{if(s().tool)consume(e);});
  document.querySelectorAll('[data-grid-tool]').forEach(b=>b.onclick=()=>{cancel();cfg.stop?.();const tool=b.dataset.gridTool;s().tool=s().tool===tool?'':tool;cfg.view().edit=s().tool==='group';cfg.view().axisMode=false;cfg.axis()?.cancel();redraw();cfg.save();});
  $('gridsColor').oninput=e=>{s().color=e.target.value;cfg.save();};$('gridsStroke').onchange=e=>{s().stroke=Math.max(1,Math.min(20,+e.target.value||2));cfg.save();};
  const selected=()=>cfg.editor()?.selection()||selection;
  $('gridsRecolor').onclick=()=>change(st=>{for(const [r,c] of selected())if(st.rows[r]?.[c]==='1')st.colors[key(r,c)]=st.color;});
  const group=(field,value)=>change(st=>{const id=Date.now().toString(36);for(const cell of selected()){const k=key(...cell);st.groups[k]={...st.groups[k],id,[field]:value(st.groups[k]||{})};}});
  $('gridsOutline').onclick=()=>group('outline',()=>s().color);$('gridsInner').onclick=()=>group('inner',v=>!v.inner);$('gridsSymbol').onclick=()=>{const text=prompt('Символ выбранной группы:','');if(text!==null)group('symbol',()=>text.slice(0,12));};
  $('gridsClear').onclick=()=>change(st=>{st.rows=st.rows.map(r=>'0'.repeat(r.length));st.colors={};st.groups={};st.dots={};st.lines={};});
  $('gridsSceneNew').onclick=()=>{const state=s();state.scenes.push({name:'Сцена '+(state.scenes.length+1),data:scene(state),view:clone(cfg.view())});state.scene=state.scenes.length-1;cfg.save();sync();};
  $('gridsSceneSave').onclick=()=>{if(!s().scenes[s().scene])return $('gridsSceneNew').click();s().scenes[s().scene]={name:s().scenes[s().scene].name,data:scene(s()),view:clone(cfg.view())};cfg.save();sync();};
  $('gridsScenes').onchange=e=>{const index=+e.target.value,item=s().scenes[index];if(!item)return;change(st=>{const scenes=st.scenes;Object.assign(st,clone(item.data),{scenes,scene:index});if(item.view)Object.assign(cfg.view(),clone(item.view));cfg.editor()?.clear();cfg.fit();});};
  $('gridsSceneDelete').onclick=()=>{if(!s().scenes[s().scene])return;change(st=>{st.scenes.splice(st.scene,1);st.scene=-1;});};
  $('gridsExport').onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify({format:'zerklus-grids-v1',scenes:s().scenes,current:scene(s())},null,2));cfg.message('Сцены скопированы.');}catch(_){cfg.message('Буфер недоступен. Разрешите доступ к буферу в браузере.');}};
  $('gridsLegacy').onclick=()=>{if(s().legacyImported){cfg.message('Старые сцены уже добавлены.');return;}const old=cfg.legacy(),list=[{c:old.cells,d:old.dots,l:old.lines},...old.scenes];change(st=>{list.forEach((item,i)=>{if(!Object.keys(item.c||{}).length&&!Object.keys(item.d||{}).length&&!Object.keys(item.l||{}).length)return;st.scenes.push({name:i?'Старая сцена '+i:'Старая сетка',data:legacyScene(item,st),view:{...clone(cfg.view()),cell:'tri',al:'zz',axes:[]}});});st.legacyImported=true;});};
  $('gridsRowsLock').onclick=()=>{cfg.stop?.();s().locked=!s().locked;cfg.save();sync();};
  $('gridsRowsImport').onclick=()=>{
   if(cfg.locked())return;
   const rows=(cfg.importRows?.()||[]).slice();
   if(!rows.length||rows.some(row=>typeof row!=='string'||!/^[01]{1,4096}$/.test(row))){cfg.message('Импорт: нужны строки из 0 и 1, до 4096 бит в строке.');return;}
   if(rows.length>4096){cfg.message('Импорт превышает максимум 4096 строк сетки.');return;}
   cancel();cfg.axis()?.cancel();
   change(st=>{Object.assign(st,{rows,cur:0,colors:{},groups:{},dots:{},lines:{},text:'',textBlocks:[],textWidth:null,scene:-1});cfg.view().axes=[];selection=[];cfg.editor()?.clear();$('gridsRowsList').scrollTop=0;cfg.fit();});
   cfg.message('Сетка очищена и заменена копией Строк. Отмена вернёт прежнее поле.');
  };
  $('gridsRowAdd').onclick=()=>{if(s().rows.length>=4096){cfg.message('Максимум 4096 строк сетки.');return;}change(st=>shiftRows(st,st.cur+1,0,['0'.repeat(st.rows[st.cur]?.length||32)]));};
  $('gridsRowCopy').onclick=()=>change(st=>{const r=st.cur,row=st.rows[r];shiftRows(st,r+1,0,[row]);for(const name of ['colors','groups'])for(let c=0;c<row.length;c++){const v=st[name][key(r,c)];if(v!==undefined)st[name][key(r+1,c)]=clone(v);}});
  $('gridsRowDelete').onclick=()=>change(st=>shiftRows(st,st.cur,1,[]));
  $('gridsColAdd').onclick=()=>{if(s().rows.some(r=>r.length>=4096)){cfg.message('Максимум 4096 бит в строке.');return;}change(st=>{st.rows=st.rows.map(row=>row+'0');st.textWidth=st.rows[0].length;});};
  const list=$('gridsRowsList');list.onscroll=()=>{if(list.contains(document.activeElement)&&document.activeElement.matches('input'))document.activeElement.blur();renderRows(true);};
  list.onchange=e=>{const i=+e.target.dataset.row;if(!Number.isInteger(i)||!e.target.matches('input'))return;const value=e.target.value.replace(/\s/g,'');if(!/^[01]{1,4096}$/.test(value)){e.target.value=s().rows[i];cfg.message('Строка сетки: от 1 до 4096 символов 0 или 1.');return;}if(value===s().rows[i])return;if(cfg.locked()){e.target.value=s().rows[i];return;}change(st=>{const rows=st.rows.slice();rows[i]=value;reconcile(st,rows);});};
  list.onclick=e=>{const row=e.target.closest('[data-row]');if(!row)return;s().cur=+row.dataset.row;redraw();cfg.save();};
  list.addEventListener('focusout',()=>setTimeout(()=>renderRows(true),0));
  list.tabIndex=0;
  list.title='Delete — удалить выбранную строку; Backspace — удалить символ при вводе.';
  list.onkeydown=e=>{
   if(e.key==='Delete'&&!e.isComposing&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&!e.shiftKey){
    consume(e);if(e.repeat||cfg.locked())return;
    const row=e.target.closest('[data-row]'),index=row?Number(row.dataset.row):s().cur;
    if(!Number.isInteger(index)||index<0||index>=s().rows.length)return;
    if(e.target.matches('input')){e.target.value=s().rows[index];e.target.blur();}
    change(st=>shiftRows(st,index,1,[]));renderRows(true);list.focus({preventScroll:true});return;
   }
   if(e.key==='Enter'&&e.target.matches('input'))e.target.blur();
  };
  sync();
 }
 function renderRows(force=false){if(!cfg)return;const list=document.getElementById('gridsRowsList'),s=cfg.state(),mobile=matchMedia('(max-width:760px), (pointer:coarse) and (max-width:1100px)').matches,height=mobile?36:26,start=Math.max(0,Math.floor(list.scrollTop/height)-3),end=Math.min(s.rows.length,start+Math.ceil((list.clientHeight||260)/height)+7),identity=start+':'+end+':'+s.cur+':'+s.locked+':'+s.rows.slice(start,end).join('/');
  if(identity===rowsKey&&!force)return;if(list.contains(document.activeElement)&&document.activeElement.matches('input'))return;rowsKey=identity;
  const fragment=document.createDocumentFragment(),spacer=h=>{const d=document.createElement('div');d.style.height=h+'px';fragment.append(d);};spacer(start*height);
  for(let r=start;r<end;r++){const row=document.createElement('div');row.className='grids-row'+(r===s.cur?' current':'');row.dataset.row=r;const no=document.createElement('button');no.textContent=r+1;no.title='Выбрать строку '+(r+1);no.dataset.row=r;const input=document.createElement('input');input.value=s.rows[r];input.dataset.row=r;input.setAttribute('aria-label','Строка сетки '+(r+1));input.inputMode='numeric';input.spellcheck=false;input.disabled=!!s.locked;row.append(no,input);fragment.append(row);}spacer((s.rows.length-end)*height);list.replaceChildren(fragment);
 }
 function sync(){if(!cfg)return;const s=cfg.state();s.colors||={};s.groups||={};s.dots||={};s.lines||={};s.scenes||=[];s.color||='#ffd166';s.stroke||=2;const $=id=>document.getElementById(id);
  renderRows();$('gridsRowsInfo').textContent=s.rows.length+' строк · '+Math.max(0,...s.rows.map(r=>r.length))+' бит';$('gridsRowsLock').textContent=s.locked?'🔒':'🔓';$('gridsRowsLock').classList.toggle('on',!!s.locked);
  document.querySelectorAll('[data-grid-tool]').forEach(b=>{b.classList.toggle('on',s.tool===b.dataset.gridTool);b.setAttribute('aria-pressed',String(s.tool===b.dataset.gridTool));});
  if(document.activeElement!==$('gridsColor'))$('gridsColor').value=s.color;
  const identity=JSON.stringify(s.scenes.map(x=>x.name))+'/'+s.scene;if(identity!==sceneKey){sceneKey=identity;const select=$('gridsScenes');select.replaceChildren();const first=document.createElement('option');first.value=-1;first.textContent='Сцны';select.append(first);s.scenes.forEach((x,i)=>{const opt=document.createElement('option');opt.value=i;opt.textContent=x.name;select.append(opt);});select.value=s.scene??-1;}
 }
 function paint(ctx,g){if(!cfg)return;const s=cfg.state(),P=(r,c)=>cfg.polygon(r,c,g),path=points=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();},symbols=new Map();ctx.save();
  for(const [k,color] of Object.entries(s.colors||{})){const [r,c]=k.split(',').map(Number);if(!own(s,r,c)||s.rows[r][c]!=='1'||r>=g.M)continue;path(P(r,c));ctx.fillStyle=color;ctx.fill();if(!s.groups[k]&&cfg.view().ln==='each'){ctx.strokeStyle=cfg.view().lc||'rgba(5,7,11,.45)';ctx.lineWidth=1;ctx.stroke();}}
  const outlines=new Map();
  for(const [k,style] of Object.entries(s.groups||{})){const [r,c]=k.split(',').map(Number);if(!own(s,r,c)||s.rows[r][c]!=='1'||r>=g.M)continue;const p=P(r,c),id=style.id||k;
   if(!outlines.has(id))outlines.set(id,{edges:new Map(),style});const outline=outlines.get(id);
   p.forEach((a,i)=>{const b=p[(i+1)%p.length],ka=a.map(x=>Math.round(x*1e6)).join(','),kb=b.map(x=>Math.round(x*1e6)).join(','),edge=ka<kb?ka+'/'+kb:kb+'/'+ka;if(outline.edges.has(edge)&&!style.inner)outline.edges.delete(edge);else outline.edges.set(edge,[a,b]);});
   if(style.symbol){const item=symbols.get(id)||{text:style.symbol,x:0,y:0,n:0};item.x+=p.reduce((sum,q)=>sum+q[0],0)/p.length;item.y+=p.reduce((sum,q)=>sum+q[1],0)/p.length;item.n++;symbols.set(id,item);}}
  for(const {edges,style} of outlines.values()){ctx.beginPath();for(const [a,b] of edges.values()){ctx.moveTo(...a);ctx.lineTo(...b);}ctx.strokeStyle=style.outline||cfg.view().lc||'#fff';ctx.lineWidth=1.5;ctx.stroke();}
  for(const item of symbols.values()){ctx.fillStyle='#fff';ctx.font='bold 16px sans-serif';ctx.textAlign='center';ctx.fillText(item.text,item.x/item.n,item.y/item.n);}
  const xy=k=>{const [x,y]=k.split(',').map(Number);return [g.ox+x*g.tw,g.oy+y*g.tw];};
  for(const [k,v] of Object.entries(s.lines||{})){const [a,b]=k.split('|').map(xy);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.strokeStyle=v.color;ctx.lineWidth=v.size;ctx.stroke();}
  for(const [k,v] of Object.entries(s.dots||{})){const [x,y]=xy(k);ctx.beginPath();ctx.arc(x,y,Math.max(2,v.size),0,Math.PI*2);ctx.fillStyle=v.color;ctx.fill();}ctx.restore();
 }
 return {mount,sync,paint,cancel,reconcile,write,shiftRows,scene,component,legacyScene};
});
