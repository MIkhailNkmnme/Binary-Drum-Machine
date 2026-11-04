/* МАЯ-507: organize the existing axes proxies; native source controls own all state. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikAxesPanel=api;})(globalThis,function(){
  'use strict';
  const themes=[
    ['map','Карта',['triangleMapSource','axisPalette','crossLabels','triangleMapAxes','triangleMapMask','triangleMapMirror']],
    ['symmetry','Симметрия',['autoAxes','sym','symChessDirs','symPlainDirs','symV','symH','symD','symPlainV','symPlainH','symPlainD','symBits','symTriangles','bTriangleAxes']],
    ['limits','Пределы',['symTriangleRows','symRowsRange','symBitsRange']],
    ['actions','Действия',['fixTri','fixAxis3','bFrameWindow','bRuler','clrAxes']]
  ];
  const kinds={triangleMapSource:'tri',axisPalette:'colour',crossLabels:'sector',triangleMapAxes:'target',triangleMapMask:'half',triangleMapMirror:'mirror',autoAxes:'magnet',sym:'eye',symV:'chessV',symH:'chessH',symD:'chessD',symPlainV:'axisV',symPlainH:'axisH',symPlainD:'axisD',symTriangles:'tri',bTriangleAxes:'nest',symBits:'grid4',bFrameWindow:'corners',bRuler:'line',fixTri:'pin',clrAxes:'cross'};
  function mount(row,options={}){
    if(!row||row.hasAttribute('data-axes-panel'))return null;row.dataset.axesPanel='';
    const doc=row.ownerDocument,win=doc.defaultView,frameApi=options.frame||win.ZerkControlFrame;
    const source=id=>doc.getElementById(id),short=text=>options.short?.(text)||text,refreshers=[];
    const describe=(node,title)=>{node.title=title;node.setAttribute('aria-label',title);};
    function numeric(host,id,label,infinite=false,fromId){
      const src=source(id);if(!host||!src||!frameApi)return;
      // Keep the canonical proxy node (and its data-n address); old grozd refreshers
      // may finish updating their detached readouts without touching the new input.
      host.className='may-axes-number-row';host.replaceChildren();host.removeAttribute('role');host.removeAttribute('tabindex');host.dataset.noMini='';
      const title=label+' — '+(src.closest('label')?.title||src.title||label);describe(host,title);
      const input=doc.createElement('input');input.type='range';input.id='mayAxes_'+id;input.dataset.axesSource=id;describe(input,label);
      const caption=doc.createElement('label');caption.className='may-axes-label';caption.htmlFor=input.id;caption.textContent=short(label);describe(caption,label);
      const control=doc.createElement('div');control.className='gz-hx gz-control gz-val may-axes-number';control.dataset.noMini='';describe(control,title);host.append(caption,control);
      const middle=doc.createElement('label');middle.className='gz-mid';middle.htmlFor=input.id;
      const output=doc.createElement('output');output.htmlFor=input.id;middle.append(input,output);
      const bounds=()=>{const min=src.min===''?0:Number(src.min),max=src.max===''?16384:Number(src.max),step=src.step===''||src.step==='any'?1:Number(src.step);return {min,max,step:Number.isFinite(step)&&step>0?step:1};};
      const isInfinite=()=>infinite&&(src.value===''||Number(src.value)===0);
      const write=value=>{if(src.disabled)return;src.value=value==null?'':String(value);for(const type of ['input','change'])src.dispatchEvent(new win.Event(type,{bubbles:true}));sync();options.after?.();};
      input.addEventListener('input',()=>{const {max}=bounds();write(infinite&&Number(input.value)>max?null:Number(input.value));});
      input.addEventListener('change',()=>sync());
      const arrows=[-1,1].map(delta=>{const b=doc.createElement('button');b.type='button';b.className='gz-a';b.dataset.noMini='';describe(b,(delta<0?'Уменьшить: ':'Увеличить: ')+label);
        const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg'),path=doc.createElementNS(svg.namespaceURI,'path');svg.classList.add('may-control-chevron');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');path.setAttribute('d',delta<0?'M14 7L9 12 14 17':'M10 7L15 12 10 17');svg.append(path);b.append(svg);
        const step=()=>{if(src.disabled)return;const {min,max,step}=bounds();if(isInfinite()){if(delta<0)write(Math.max(min,Math.min(max,Number(source(fromId)?.value)||max)));return;}const next=Number(src.value||min)+delta*step;if(infinite&&(next<=0||next>max))write(null);else write(Math.max(min,Math.min(max,Number(next.toFixed(10)))));};
        let timer=0,repeated=false;const stop=()=>{win.clearTimeout(timer);win.removeEventListener('pointerup',stop);win.removeEventListener('pointercancel',stop);win.removeEventListener('blur',stop);};
        b.addEventListener('click',event=>{event.stopPropagation();if(!repeated||!event.detail)step();repeated=false;});
        b.addEventListener('pointerdown',event=>{if(event.button!==0||b.disabled)return;stop();repeated=false;const again=()=>{if(b.disabled){stop();return;}repeated=true;step();timer=win.setTimeout(again,80);};timer=win.setTimeout(again,350);for(const type of ['pointerup','pointercancel','blur'])win.addEventListener(type,stop);});
        win.addEventListener('pagehide',stop,{once:true});return b;});
      control.append(arrows[0],middle,arrows[1]);const frame=frameApi.attach(control,arrows[0],middle,arrows[1],{input,output,valueInThumb:true});
      function sync(){const {min,max,step}=bounds();input.min=String(infinite?Math.max(step,min):min);input.max=String(max+(infinite?step:0));input.step=String(step);const text=isInfinite()?'∞':src.value;input.value=isInfinite()?input.max:src.value;input.disabled=src.disabled;for(const b of arrows)b.disabled=src.disabled;if(output.textContent!==text)output.textContent=text;input.setAttribute('aria-valuetext',label+': '+text);host.setAttribute('aria-disabled',String(src.disabled));frame.sync();}
      src.addEventListener('input',sync);src.addEventListener('change',sync);refreshers.push(sync);sync();
    }
    numeric(row.querySelector('[data-n="symTriangleRows"]'),'symTriangleRows','Высота ≥');
    for(const [key,a,b,label]of [['symRowsRange','symRowsMin','symRowsMax','Строк'],['symBitsRange','symBitsMin','symBitsMax','Бит']]){
      const pair=row.querySelector('[data-n="'+key+'"]');if(!pair)continue;
      pair.className='may-axes-range-pair';pair.replaceChildren();pair.removeAttribute('role');pair.removeAttribute('tabindex');
      for(const [id,suffix,inf]of [[a,' ≥',false],[b,' ≤',true]]){const host=doc.createElement('div');host.dataset.n=id;pair.append(host);numeric(host,id,label+suffix,inf,a);}
    }
    // Include both names used by the existing direction selector adapters.
    const owned=new Set();
    for(const [key,title,ids]of themes){const section=doc.createElement('div');section.className='may-axes-section';section.dataset.axesSection=key;section.setAttribute('role','group');section.setAttribute('aria-label',title);
      const heading=doc.createElement('div');heading.className='gz-hx may-axes-heading';heading.dataset.noMini='';heading.setAttribute('role','heading');heading.setAttribute('aria-level','3');heading.textContent=short(title);heading.title=title;section.append(heading);
      for(const id of ids){const node=row.querySelector('[data-n="'+id+'"]');if(!node||owned.has(node))continue;owned.add(node);section.append(node);const mark=node.querySelector('i');if(mark&&kinds[id]&&options.icon)mark.style.backgroundImage=options.icon(node,kinds[id]);}
      if(section.children.length>1)row.append(section);
    }
    // Unknown or future controls remain available in the same group.
    const leftovers=[...row.children].filter(n=>!n.matches('.may-axes-section,svg'));if(leftovers.length){const section=row.querySelector('[data-axes-section="actions"]')||row;section.append(...leftovers);}
    const sync=()=>{for(const run of refreshers)run();};return {sync};
  }
  return {mount};
});
