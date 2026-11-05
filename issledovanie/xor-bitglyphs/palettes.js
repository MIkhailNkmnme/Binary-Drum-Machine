(function(){
  'use strict';
  const host=document.getElementById('kraftwerkPalettes');if(!host)return;
  const pack=window.ZerkKraftwerk;let chosenPalette='cover';
  host.innerHTML=`<div class="triangle-controls"><label>Маски <select id="kwType"><option value="figure">4 фигуры</option><option value="cross">24 креста</option><option value="combination">256 сочетаний</option></select></label><label>Номер <input id="kwNumber" type="number" min="1" max="4" value="1"></label><output id="kwMaskInfo"></output></div><div class="kw-palettes" id="kwCards"></div><div class="triangle-controls"><button type="button" id="kwSave">В Битотеку</button><button type="button" id="kwOpen">В Маятник</button><button type="button" id="kwSet">Набор 4 + 24</button><button type="button" id="kwAll">Все палитры</button><button type="button" id="kwDownload">JSON шаблона</button></div><p id="kwStatus" role="status"></p>`;
  const get=id=>document.getElementById(id);
  function selectedMask(){const items=pack.masks().filter(m=>m.type===get('kwType').value),raw=Number(get('kwNumber').value),i=Number.isFinite(raw)?Math.max(1,Math.min(items.length,Math.round(raw))):1;get('kwNumber').value=i;get('kwNumber').max=items.length;return items[i-1];}
  function draw(){
    const m=selectedMask();get('kwMaskInfo').textContent=m.name+' · '+m.points.length+' занятых клеток';
    const cards=get('kwCards');cards.replaceChildren();
    for(const p of pack.palettes){
      const card=document.createElement('button');card.type='button';card.className='kw-palette';card.setAttribute('aria-pressed',String(p.id===chosenPalette));card.setAttribute('aria-label',p.name);card.title=p.name;
      card.innerHTML=pack.svg(m.id,p.id,8);
      const label=document.createElement('span');label.textContent=p.name;card.appendChild(label);
      card.addEventListener('click',()=>{chosenPalette=p.id;draw();});cards.appendChild(card);
    }
  }
  function single(){return [pack.entry(selectedMask().id,chosenPalette)];}
  function download(entries){const url=URL.createObjectURL(new Blob([JSON.stringify(pack.portable(entries))],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='kraftwerk-templates.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
  async function store(entries,label,open=false){
    const buttons=[...host.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);get('kwStatus').textContent='Сохраняю…';
    try{
      const selected=selectedMask(),p=pack.palette(chosenPalette),id=entries.length===1?'mayatnik:template:'+entries[0].id:entries.length===28?'kraftwerk:pack28:'+p.id:'kraftwerk:pack252';
      const url=new URL('../../mayatnik/Zerkalius-mayatnik.html',location.href);url.hash='bitoteka='+encodeURIComponent(id);
      await window.ZerkBitoteka.save({id,kind:'template',name:label,filename:entries.length===1?'kraftwerk-'+p.id+'-'+selected.id.replace(':','-')+'.json':'kraftwerk-collection.json',blob:new Blob([JSON.stringify(pack.portable(entries))],{type:'application/json'}),thumbnail:new Blob([pack.svg(selected.id,chosenPalette,8)],{type:'image/svg+xml'}),source:{name:'Kraftwerk · исследование битглифов',page:location.pathname},meta:{folder:'Kraftwerk',collection:'Kraftwerk',paletteName:entries.length===252?'9 палитр':p.name,nativeId:entries.length===1?entries[0].id:undefined,openUrl:url.href,templateCount:entries.length,sourceImage:'/sources/kraftwerk/3d-der-katalog-palettes.png'}});
      get('kwStatus').textContent='Сохранено в Битотеку · Kraftwerk: '+entries.length+' шаблонов.';
      if(open)location.assign(url.href);
    }catch(error){get('kwStatus').textContent='Не удалось сохранить: '+error.message;}finally{buttons.forEach(b=>b.disabled=false);}
  }
  get('kwType').addEventListener('change',()=>{get('kwNumber').value=1;draw();});get('kwNumber').addEventListener('change',draw);
  get('kwSave').addEventListener('click',()=>store(single(),selectedMask().name+' · '+pack.palette(chosenPalette).name));
  get('kwOpen').addEventListener('click',()=>store(single(),selectedMask().name+' · '+pack.palette(chosenPalette).name,true));
  get('kwSet').addEventListener('click',()=>store(pack.masks().filter(m=>m.type!=='combination').map(m=>pack.entry(m.id,chosenPalette)),'Kraftwerk · 4 фигуры + 24 креста · '+pack.palette(chosenPalette).name));
  get('kwAll').addEventListener('click',()=>store(pack.palettes.flatMap(p=>pack.masks().filter(m=>m.type!=='combination').map(m=>pack.entry(m.id,p.id))),'Kraftwerk · 252 цветных шаблона'));
  get('kwDownload').addEventListener('click',()=>download(single()));draw();
})();
