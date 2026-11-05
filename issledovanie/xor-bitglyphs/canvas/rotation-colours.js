/* Colour the four common rotations, retaining every cell of the original mask. */
(function(){
  'use strict';
  const api=window.ZerkGlyphCanvas,pack=window.ZerkKraftwerk;if(!api||!pack)return;
  const colours=['#ff5a5f','#ffd166','#43d9ad','#63a6ff'];
  const signature=points=>[...new Set(points.map(([x,y])=>y*23+x))].sort((a,b)=>a-b).join(',');
  let phases=null;
  function phaseFor(placement){
    if(!phases){phases=new Map();for(const mask of pack.masks().filter(m=>m.type==='combination'))phases.set(signature(mask.points.map(([x,y])=>[x+11,y+11])),mask.source.turns[0]);}
    const points=placement.points||pack.mask(placement.maskId).points.map(([x,y])=>[x+11,y+11]);
    return phases.get(signature(points));
  }
  function fill(){
    const project=api.getProject();let matched=0,skipped=0;
    project.placements.forEach((placement,index)=>{
      const phase=phaseFor(placement);if(phase===undefined){skipped++;return;}
      const points=placement.points||pack.mask(placement.maskId).points.map(([x,y])=>[x+11,y+11]);
      const present=new Set(points.map(([x,y])=>String(y*23+x))),changes=project.edits[String(index)]||{};
      for(const [key,value]of Object.entries(changes)){if(value===null)present.delete(key);else present.add(key);}
      const edits=project.edits[String(index)]||(project.edits[String(index)]={});
      for(const key of present)edits[key]=colours[phase];matched++;
    });
    if(!matched){api.showStatus('На холсте нет масок из набора256. «4 цвета» различает четыре общих поворота этих масок.',true);return;}
    api.replaceProject(project);
    legend.hidden=false;
    api.showStatus('4 цвета: '+matched+' фигур. Общие повороты 0° / 90° / 180° / 270° относительно положения I=0°. Маски и номера сохранены.'+(skipped?' Не распознано: '+skipped+'.':''));
  }
  const action=api.addAction({id:'rotation-colours',label:'4 цвета',title:'Раскрасить четыре общих поворота внутри каждой из64групп разными цветами. Маски не изменяются; Отмена возвращает прежние цвета.',width:64,onClick:fill});
  const legend=document.createElement('span');legend.className='rotation-colours';legend.hidden=true;legend.setAttribute('role','group');legend.setAttribute('aria-label','Цвета четырёх общих поворотов');
  colours.forEach((colour,index)=>{const label=document.createElement('label');label.title='Цвет общего поворота '+index*90+'°';const text=document.createElement('span');text.textContent=index*90+'°';const input=document.createElement('input');input.type='color';input.value=colour;input.setAttribute('aria-label',label.title);input.addEventListener('change',()=>{colours[index]=input.value;fill();});label.append(text,input);legend.appendChild(label);});
  action.button.after(legend);
})();
