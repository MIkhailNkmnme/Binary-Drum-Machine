/* Research illustration of rasterCells(), not a replacement for the live SVG filter. */
(function(root){
  'use strict';
  const MASKS=[
    ['00010000','01010000','01111000','00111100','00011010','11111111','00011000','00011000','00011000','00011000','00011000','00010000'],
    ['00010000','00010000','00111000','00111000','00011100','11111111','00011000','00011000','00011000','00011000','00010000','00001000'],
    ['00001000','00001000','00011100','00011100','00101000','11111111','00011000','00011000','00011000','00011000','00001000','00011000'],
    ['00001000','00001000','00011100','00011100','00011000','11111111','00011000','00011000','00011000','00011000','00010000','00001000']
  ];
  const POINTS=MASKS.map(rows=>{const pivot=rows[0].indexOf('1');return rows.flatMap((row,y)=>Array.from(row,(bit,x)=>bit==='1'?[x-pivot,y]:null).filter(Boolean));});
  const ROTATE=(x,y,t)=>[[x,y],[-y,x],[-x,-y],[y,-x]][t];
  function mount(host){
    if(!host)return null;if(host.xorShadowDemo)return host.xorShadowDemo;
    const doc=host.ownerDocument,state={figure:'0',original:true,light:true,dark:true,grid:false,full:false,ghost:false,cell:32};
    host.classList.add('shadow-experiment');
    const style=doc.createElement('style');style.textContent='.shadow-experiment{margin:16px 0}.shadow-experiment .shadow-controls{display:flex;flex-wrap:wrap;gap:0;margin:0 0 16px}.shadow-experiment .shadow-controls button,.shadow-experiment .shadow-controls select{box-sizing:border-box;flex:0 0 128px;width:128px;height:32px;margin:0;padding:0 8px;border:1px solid #57616f;border-radius:0;background:#1b2430;color:#f1f3f5;font:13px/30px system-ui;white-space:nowrap;cursor:pointer;user-select:none}.shadow-experiment .shadow-controls button[aria-pressed=true]{border:2px solid #e4a969;line-height:28px}.shadow-experiment .shadow-controls button:focus-visible,.shadow-experiment .shadow-controls select:focus-visible{outline:2px solid #fff;outline-offset:-3px}.shadow-experiment .shadow-size{display:flex;align-items:center;gap:16px;min-height:32px;margin:0 0 16px}.shadow-experiment .shadow-size input{width:128px;height:32px;margin:0;accent-color:#e4a969}.shadow-experiment .shadow-size output{min-width:64px}.shadow-experiment .shadow-stage{max-height:560px;overflow:auto;border:1px solid #57616f;background:#fd0000;overscroll-behavior:contain}.shadow-experiment canvas{display:block;max-width:none!important;max-height:none!important}.shadow-experiment .shadow-note{font-size:14px;line-height:1.5;margin:16px 0}.shadow-experiment .shadow-measure{font-variant-numeric:tabular-nums}';host.appendChild(style);
    const controls=doc.createElement('div');controls.className='shadow-controls';controls.setAttribute('role','group');controls.setAttribute('aria-label','Слои построения декоративной тени');
    const select=doc.createElement('select');select.setAttribute('aria-label','Исходная фигура');
    for(const [value,label] of [['0','Фигура I'],['1','Фигура II'],['2','Фигура III'],['3','Фигура IV'],['cross','Крест 0·1·2·3']]){const option=doc.createElement('option');option.value=value;option.textContent=label;select.appendChild(option);}
    select.addEventListener('change',()=>{state.figure=select.value;draw();});controls.appendChild(select);
    const switches=[];
    function toggle(key,label,title){const button=doc.createElement('button');button.type='button';button.textContent=label;button.title=title;button.setAttribute('aria-label',title);button.addEventListener('click',()=>{state[key]=!state[key];draw();});controls.appendChild(button);switches.push([key,button]);}
    toggle('original','Оригинал','Показать исходные клетки поверх двух сдвинутых силуэтов');
    toggle('light','Светлая','Светлый силуэт: сдвиг −0,22 клетки по X и Y');
    toggle('dark','Тёмная','Тёмный силуэт: сдвиг +0,28 клетки по X и Y');
    const composite=doc.createElement('button');composite.type='button';composite.textContent='Вместе';composite.title='Включить оба сдвинутых силуэта и оригинал';composite.setAttribute('aria-label',composite.title);composite.addEventListener('click',()=>{state.original=state.light=state.dark=true;draw();});controls.appendChild(composite);
    toggle('grid','Сетка','Показать границы исходных клеток');toggle('full','Всё поле','Показать всё поле 29 × 29');toggle('ghost','Силуэт','Добавить сиреневые клетки, погашенные XOR, к общей маске тени');
    const size=doc.createElement('label');size.className='shadow-size';const sizeName=doc.createElement('span');sizeName.textContent='Клетка';
    const slider=doc.createElement('input');slider.type='range';slider.min='0';slider.max='2';slider.step='1';slider.value='1';slider.setAttribute('aria-label','Размер клетки: 16, 32 или 64 пикселя');
    const output=doc.createElement('output');slider.addEventListener('input',()=>{state.cell=[16,32,64][Number(slider.value)];draw();});size.append(sizeName,slider,output);
    const stage=doc.createElement('div');stage.className='shadow-stage';stage.tabIndex=0;stage.setAttribute('aria-label','Рисунок слоёв тени; область прокручивается');
    const canvas=doc.createElement('canvas');canvas.setAttribute('role','img');stage.appendChild(canvas);
    const measure=doc.createElement('p');measure.className='shadow-note shadow-measure';measure.setAttribute('aria-live','polite');
    const note=doc.createElement('p');note.className='shadow-note';note.textContent='Здесь повторён порядок слоёв Canvas-экспорта: светлая копия, тёмная копия, исходные клетки. Сдвиг относится ко всему объединённому силуэту. Сиреневый силуэт показывает погашенные XOR клетки; он тоже входит в декоративную тень. Серый центр не участвует в XOR, но участвует в маске тени.';
    host.append(controls,size,stage,measure,note);
    function cells(){
      const hits=new Map(),chosen=state.figure==='cross'?[0,1,2,3]:[Number(state.figure)];
      for(const id of chosen)for(const [sx,sy] of POINTS[id]){
        if(sx===0&&sy===0)continue;const [x,y]=ROTATE(sx,sy,state.figure==='cross'?id:0),key=x+','+y,previous=hits.get(key);
        if(previous)previous.hits++;else hits.set(key,{x,y,hits:1});
      }
      const result=[];for(const cell of hits.values())if(cell.x!==0||cell.y!==0){if(cell.hits%2)result.push({...cell,kind:1});else if(state.ghost)result.push({...cell,kind:3});}
      result.push({x:0,y:0,kind:2});return result;
    }
    function draw(){
      for(const [key,button] of switches)button.setAttribute('aria-pressed',String(state[key]));
      output.textContent=state.cell+' px';slider.setAttribute('aria-valuetext',state.cell+' пикселей');
      const data=cells(),minX=state.full?-14:Math.min(...data.map(p=>p.x))-2,minY=state.full?-14:Math.min(...data.map(p=>p.y))-2,maxX=state.full?14:Math.max(...data.map(p=>p.x))+2,maxY=state.full?14:Math.max(...data.map(p=>p.y))+2;
      const S=state.cell,W=(maxX-minX+1)*S,H=(maxY-minY+1)*S;canvas.width=W;canvas.height=H;canvas.style.width=W+'px';canvas.style.height=H+'px';
      const ctx=canvas.getContext('2d');ctx.fillStyle='#fd0000';ctx.fillRect(0,0,W,H);
      const silhouette=(shift,colour)=>{ctx.save();ctx.translate(shift*S,shift*S);ctx.fillStyle=colour;ctx.beginPath();for(const p of data)ctx.rect((p.x-minX)*S,(p.y-minY)*S,S,S);ctx.fill();ctx.restore();};
      if(state.light)silhouette(-.22,'#e9e9e9');if(state.dark)silhouette(.28,'#2b2d34');
      const colours={1:'#000000',2:'#717777',3:'#7c3aed'};
      if(state.original)for(const p of data){ctx.fillStyle=colours[p.kind];ctx.fillRect((p.x-minX)*S,(p.y-minY)*S,S,S);}
      if(state.grid){ctx.save();ctx.globalAlpha=.6;ctx.strokeStyle='#f4f0e8';ctx.lineWidth=1;ctx.beginPath();for(let x=0;x<=W;x+=S){ctx.moveTo(x+.5,0);ctx.lineTo(x+.5,H);}for(let y=0;y<=H;y+=S){ctx.moveTo(0,y+.5);ctx.lineTo(W,y+.5);}ctx.stroke();ctx.restore();
        if(state.original){ctx.fillStyle='#717777';ctx.fillRect(-minX*S,-minY*S,S,S);}}
      const number=n=>n.toLocaleString('ru-RU',{maximumFractionDigits:2});
      measure.textContent='Светлая: (−'+number(.22*S)+'; −'+number(.22*S)+') px · тёмная: (+'+number(.28*S)+'; +'+number(.28*S)+') px. Маска: '+data.length+' клеток, включая центр; без размытия.';
      canvas.setAttribute('aria-label',(state.figure==='cross'?'Крест четырёх фигур':'Фигура '+['I','II','III','IV'][Number(state.figure)])+'; '+measure.textContent);
    }
    const api={draw,getState:()=>({...state}),destroy(){host.replaceChildren();delete host.xorShadowDemo;}};host.xorShadowDemo=api;draw();return api;
  }
  root.XorBitglyphShadows={mount};
  const start=()=>mount(document.getElementById('shadowDemo'));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(window);
