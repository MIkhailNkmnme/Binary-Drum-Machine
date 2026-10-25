/* Сетки: scale preferences and the shared Mayatnik scale controls. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SetkaScale=api;})(globalThis,function(){
  'use strict';
  const IDS={axis:'setkaScaleAxis',top:'setkaScaleTop',bottom:'setkaScaleBottom',lock:'setkaScaleLock',base:'setkaScaleBase'};
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function prefs(view){
    const p=view.scalePrefs||(view.scalePrefs={});
    for(const k of ['axis','top','bottom','lock'])p[k]=!!p[k];
    p.base=clamp(Math.round(Number(p.base)||2),1,10);return p;
  }
  function bounds(rows,layout,cell){
    const count=Math.min(rows.length,4096);
    if(cell==='ring')return {minX:-count,maxX:count,minY:-count,maxY:count};
    let minX=Infinity,maxX=-Infinity;
    for(let i=0;i<count;i++){const n=rows[i].length;if(!n)continue;const x=(layout.hs[i]||0)/2;
      minX=Math.min(minX,x);maxX=Math.max(maxX,x+(cell==='square'?n:cell==='rmb'?n+.5:(n+1)/2));}
    return {minX:Number.isFinite(minX)?minX:0,maxX:Number.isFinite(maxX)?maxX:0,minY:0,maxY:count*(cell==='square'?1:Math.sqrt(3)/2)};
  }
  function quantize(value,base,dpr=1,min=2,max=160){
    if(base<=1)return clamp(value,min,max);
    const lo=Math.ceil(Math.log(min*dpr)/Math.log(base)-1e-9),hi=Math.floor(Math.log(max*dpr)/Math.log(base)+1e-9);
    if(lo>hi)return clamp(value,min,max);
    return base**clamp(Math.round(Math.log(value*dpr)/Math.log(base)),lo,hi)/dpr;
  }
  function mount(host){
    const doc=host.canvas.ownerDocument,win=doc.defaultView;let want=0;const syncJobs=[];
    const view=()=>host.view(),read=()=>prefs(view()),size=()=>({w:host.canvas.clientWidth||300,h:host.canvas.clientHeight||200});
    const extent=()=>{const v=view(),r=host.rows();return bounds(r,host.layout(r,Math.min(r.length,4096),v.al,v.cell),v.cell);};
    const locked=()=>{const p=read();return p.lock||(p.top&&p.bottom);};
    function hold(){const v=view();if(!(v.s>0))return;const p=read();if(!p.axis&&!p.top&&!p.bottom)return;const {w,h}=size();
      // x=0 is the grid's axis, including square and concentric ring modes.
      if(p.axis)v.ox=w/2;
      if(p.top||p.bottom){const b=extent();if(p.top)v.oy=10-b.minY*v.s;else v.oy=h-10-b.maxY*v.s;}
    }
    function sync(){const p=read();for(const k of Object.keys(IDS)){const e=doc.getElementById(IDS[k]);if(!e)continue;
      e.setAttribute('aria-pressed',String(k==='base'?p.base>1:p[k]));if(k==='base'){e.dataset.base=p.base;e.textContent='Кратный ×'+p.base;}}
      for(const run of syncJobs)run();}
    function changed(){hold();sync();host.save();host.render();host.refresh?.();}
    function set(key,value){const p=read();if(key==='base'){p.base=clamp(Math.round(value)||1,1,10);want=0;
        if(!locked()&&view().s>0)zoom(view().s,size().w/2,size().h/2,false);
      }else p[key]=!!value;changed();}
    function zoom(value,x,y,notify=true){const v=view();if(locked())return false;
      if(!(v.s>0))host.fit();if(!(v.s>0))return false;
      const s=quantize(value,read().base,host.dpr?.()||win.devicePixelRatio||1,host.min||2,host.max||160),f=s/v.s;
      v.ox=x-(x-v.ox)*f;v.oy=y-(y-v.oy)*f;v.s=s;hold();if(notify)changed();return true;
    }
    function wheel(e){e.preventDefault();if(locked()){want=0;return true;}const v=view();if(!(v.s>0))host.fit();
      want=clamp((want||v.s)*Math.exp(-clamp(e.deltaY,-300,300)*.0025),host.min||2,host.max||160);
      zoom(want,e.offsetX,e.offsetY);return true;
    }
    function gesture({start,current,view:initial}){
      want=0;if(locked())return false;
      const raw=initial.s*current.distance/start.distance;
      const s=quantize(raw,read().base,host.dpr?.()||win.devicePixelRatio||1,host.min||2,host.max||160),ratio=s/initial.s;
      Object.assign(view(),{s,ox:current.x-(start.x-initial.ox)*ratio,oy:current.y-(start.y-initial.oy)*ratio});
      hold();sync();host.render();host.refresh?.();return true;
    }
    function sourceControls(toolbar){
      let group=doc.getElementById('setkaScaleSources');if(group)return group;
      group=doc.createElement('div');group.id='setkaScaleSources';group.className='grids-toolgroup';group.dataset.gridGroup='scale';group.style.setProperty('--grid-group-color','#7cbcff');
      const title=doc.createElement('span');title.className='grids-toolheading';title.textContent='Масштаб';group.append(title);
      const definitions=[['axis','Ширина по оси','Ширина по оси: середина поля по оси в середине окна · масштаб не меняет'],['top','Верх','Закрепить верх: при масштабе верх поля остаётся у верхнего края окна'],['bottom','Вниз','Вниз: при масштабе нижняя строка поля держится у низа окна · вместе с «Верхом» — держатся обе, масштаб не меняется'],['lock','Блок','Блокировать масштаб: колесо и вписывание его не меняют · ещё раз — снять'],['base','Кратный ×2','Кратность масштаба: 1 — плавно; 2–10 — степени основания в пикселях монитора · стрелки меняют на 1']];
      for(const [k,text,tip]of definitions){const e=doc.createElement('button');e.type='button';e.id=IDS[k];e.textContent=text;e.title=tip;e.onclick=()=>set(k,k==='base'?(read().base===1?2:1):!read()[k]);group.append(e);}
      const pair=doc.createElement('span');pair.dataset.setkaPair='Верх · Вниз';pair.setAttribute('aria-label','Верх и низ: два независимых закрепления');
      const top=group.querySelector('#'+IDS.top),bottom=group.querySelector('#'+IDS.bottom);top.before(pair);pair.append(top,bottom);
      toolbar.append(group);sync();return group;
    }
    function menuItems(proxy){
      const item=k=>proxy(doc.getElementById(IDS[k])),axis={...item('axis'),icon:'corners'},top=item('top');
      const pair={...top,type:'pair',cls:'gz-split gz-bs setka-scale-edges',name:'Верх · Вниз',mid:'',parts:['top','bottom'].map((k,i)=>({label:i?'Вниз':'Верх',tip:doc.getElementById(IDS[k]).title,on:()=>read()[k],click:()=>set(k,!read()[k])}))};
      return [axis,pair,{...item('lock'),icon:'pin'},{...item('base'),icon:'grid4'}];
    }
    function decorate(rail){
      const edges=rail.el.querySelector('.setka-scale-edges');if(edges){
        for(const [i,k]of ['top','bottom'].entries()){const n=edges.querySelector('.gz-h'+i);if(!n)continue;n.dataset.source=IDS[k];n.tabIndex=0;n.setAttribute('role','button');n.setAttribute('aria-label',i?'Вниз':'Верх');n.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();n.click();}});syncJobs.push(()=>n.setAttribute('aria-pressed',String(read()[k])));}
        const joint=win.ZerkControlFrame?.pairSwitch(edges,{read:()=>[read().top,read().bottom],onToggle:on=>{read().top=read().bottom=on;changed();}});if(joint)syncJobs.push(joint.sync);
      }
      const cell=rail.el.querySelector('[data-source="'+IDS.base+'"]');if(cell){
        cell.classList.add('may-snap-control');cell.replaceChildren();const label=doc.createElement('span');label.className='gz-nm';label.textContent='Кратность';cell.append(label);
        const defs=[['1','Плавный масштаб',()=>set('base',1)],['◀','Уменьшить кратность на 1',()=>set('base',read().base-1)],['','Текущая кратность',null],['▶','Увеличить кратность на 1',()=>set('base',read().base+1)]];
        const nodes=defs.map(([text,title,act])=>{const n=doc.createElement('span');n.className='may-snap-part';n.textContent=text;n.title=title;if(act){n.tabIndex=0;n.setAttribute('role','button');n.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();act();}});}cell.append(n);return n;});cell.prepend(nodes[1]);
        cell.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();const i=nodes.indexOf(e.target.closest('.may-snap-part'));defs[i]?.[2]?.();},true);
        syncJobs.push(()=>{nodes[2].textContent=read().base;nodes[0].classList.toggle('gz-on',read().base===1);nodes[2].classList.toggle('gz-on',read().base>1);});
      }sync();
    }
    sync();return {read,locked,hold,sync,set,zoom,wheel,gesture,sourceControls,menuItems,decorate};
  }
  return {mount,prefs,bounds,quantize,IDS};
});
