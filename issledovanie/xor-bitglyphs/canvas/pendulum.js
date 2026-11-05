/* Geometry XOR is independent of the colour of each occupied SVG cell. */
(function(){
  'use strict';
  const api=window.ZerkGlyphCanvas,pack=window.ZerkKraftwerk;if(!api)return;
  const dialog=document.createElement('dialog');dialog.className='glyph-pendulum';
  dialog.innerHTML=`<form><strong>Маятник из SVG</strong>
    <label>Правило<select id="gpMode"><option value="glyph">Глифы · XOR клеток</option><option value="bits">Биты строки SVG</option><option value="unit">Целый глиф = 1</option></select></label>
    <label id="gpSourceLabel">Начало<select id="gpSource"><option value="tape">Вся лента глифов</option><option value="row">Один ряд глифов</option></select></label>
    <label id="gpRowLabel">Ряд глифов<input id="gpRow" type="number" min="1" value="1"></label>
    <label id="gpYLabel">Строка Y SVG<input id="gpY" type="number" min="0" value="0"></label>
    <label id="gpGlyphLabel">Номер глифа<input id="gpGlyph" type="number" min="1" value="1"></label>
    <label>Всего строк<input id="gpDepth" type="number" min="1" max="512" value="32"></label>
    <p id="gpExplanation"></p><p id="gpError" role="status"></p>
    <div class="dialog-actions"><button type="submit">Построить</button><button type="button" id="gpCancel">Отмена</button></div></form>`;
  document.body.appendChild(dialog);const get=id=>dialog.querySelector('#'+id);let original=null,ordered=[],groups=[];
  function integer(id,low,high){const value=Number(get(id).value);if(!Number.isFinite(value))throw Error('Введите число');const result=Math.max(low,Math.min(high,Math.round(value)));get(id).value=result;return result;}
  function shape(project,index){
    const placement=project.placements[index],p=pack.palette(project.paletteId),result=new Map();
    if(placement.points)for(const [x,y,c]of placement.points)result.set(y*23+x,c);
    else{const m=pack.mask(placement.maskId);for(const [x,y]of m.points)result.set((y+11)*23+x+11,m.pivotOccupied&&!x&&!y?p.pivot:p.bit);}
    for(const [key,c]of Object.entries(project.edits[String(index)]||{})){if(c===null)result.delete(Number(key));else result.set(Number(key),c);}
    return result;
  }
  function xor(a,b){const result=new Map(a);for(const [q,c]of b){if(result.has(q))result.delete(q);else result.set(q,c);}return result;}
  const pointList=map=>Array.from(map,([q,c])=>[q%23,Math.floor(q/23),c]);
  function project(width,height,placements){return {format:'zerk-bitglyph-canvas',version:1,width,height,background:original.background,paletteId:original.paletteId,showNumbers:false,placements,edits:{},annotations:[]};}
  function glyphs(depth){
    const indices=get('gpSource').value==='row'?groups[integer('gpRow',1,groups.length)-1]:ordered;
    if(!indices?.length)throw Error('Нет исходных глифов');
    const rows=Math.min(depth,indices.length),slots=rows*(2*indices.length-rows+1)/2;
    if(slots>10000)throw Error('Больше 10 000 ячеек. Выберите один ряд глифов или уменьшите глубину.');
    let row=indices.map(index=>shape(original,index));const width=row.length*32,placements=[];
    for(let y=0;y<rows;y++){
      const left=(width-row.length*32)/2;
      row.forEach((cells,x)=>placements.push({index:placements.length,x:left+x*32+4,y:y*32+4,points:pointList(cells)}));
      row=row.slice(0,-1).map((a,x)=>xor(a,row[x+1]));
    }
    return {value:project(width,rows*32,placements),info:`Глифы: ${indices.length} вверху → ${rows} строк. Каждый нижний — XOR двух соседних верхних; центры масок совмещены. Цвет одиночной клетки сохраняется.`};
  }
  function bits(depth){
    const y=integer('gpY',0,Math.max(0,Math.ceil(original.height)-1)),seed=new Map();
    for(const [x,wy,c]of api.getCells().bits)if(Math.floor(wy)===y)seed.set(Math.floor(x),c);
    if(!seed.size)throw Error('В этой строке SVG нет битов. Выберите другую Y.');
    let min=Infinity,max=-Infinity;for(const x of seed.keys()){min=Math.min(min,x);max=Math.max(max,x);}const width=max-min+1+2*(depth-1),tiles=new Map();let row=seed,total=0;
    for(let r=0;r<depth;r++){
      for(const [x,c]of row){const wx=x-min+depth-1,tx=Math.floor(wx/23),ty=Math.floor(r/23),key=tx+','+ty;let tile=tiles.get(key);if(!tile){tile={index:tiles.size,x:tx*23,y:ty*23,points:[]};tiles.set(key,tile);}tile.points.push([wx%23,r%23,c]);total++;}
      const next=new Map();for(const [x,c]of row)for(const nx of [x-1,x+1]){if(next.has(nx))next.delete(nx);else next.set(nx,c);}row=next;
    }
    if(tiles.size>10000)throw Error('Слишком большое построение');
    return {value:project(width,depth,[...tiles.values()]),info:`Биты SVG: Y=${y}, ${seed.size} начальных единиц → ${depth} строк, ${total} единиц. Правило90; фон — 0, любой цвет занятой клетки — 1.`};
  }
  function units(depth){
    const source=ordered[integer('gpGlyph',1,ordered.length)-1],motif=pointList(shape(original,source)),placements=[],width=(2*depth-1)*32;let row=new Set([0]);
    for(let y=0;y<depth;y++){
      for(const x of row){if(placements.length===10000)throw Error('Больше 10 000 глифов. Уменьшите число строк.');placements.push({index:placements.length,x:(x+depth-1)*32+4,y:y*32+4,points:motif});}
      const next=new Set();for(const x of row)for(const nx of [x-1,x+1]){if(next.has(nx))next.delete(nx);else next.add(nx);}row=next;
    }
    return {value:project(width,depth*32,placements),info:`Целый глиф = 1: ${depth} строк. XOR управляет только наличием одинакового мотива; внутренняя форма остаётся прежней.`};
  }
  function sync(){const mode=get('gpMode').value;get('gpSourceLabel').hidden=mode!=='glyph';get('gpRowLabel').hidden=mode!=='glyph'||get('gpSource').value!=='row';get('gpYLabel').hidden=mode!=='bits';get('gpGlyphLabel').hidden=mode!=='unit';get('gpExplanation').textContent=mode==='glyph'?'Маски двух соседних глифов совмещаются по локальному центру0. 1 XOR 1 исчезает, 1 XOR 0 остаётся. Ряды сужаются вниз; одинаковые глифы дают пустоту.':mode==='bits'?'Одна горизонтальная строка занятых клеток SVG становится началом правила90. Подписи не входят в биты. Цвет не означает 0 или1.':'Одинаковый целый глиф — одна единица. Получается треугольник одинаковых мотивов; их внутренние клетки не смешиваются.';}
  api.addAction({id:'pendulum',label:'Маятник',title:'Построить маятник по битам SVG или по XOR клеток соседних глифов',width:64,onClick(){
    original=api.getProject();if(!original.placements.length)throw Error('На холсте нет фигур');
    ordered=original.placements.map((_,i)=>i).sort((a,b)=>original.placements[a].y-original.placements[b].y||original.placements[a].x-original.placements[b].x);
    const rows=new Map();for(const i of ordered){const y=original.placements[i].y;if(!rows.has(y))rows.set(y,[]);rows.get(y).push(i);}groups=[...rows.values()];
    get('gpSource').value=ordered.length>256?'row':'tape';get('gpRow').value=groups.reduce((best,row,i)=>row.length>groups[best].length?i:best,0)+1;get('gpRow').max=groups.length;get('gpGlyph').max=ordered.length;
    let firstY=0;for(const index of ordered){const cells=shape(original,index);if(cells.size){firstY=original.placements[index].y+Math.min(...Array.from(cells.keys(),q=>Math.floor(q/23)));break;}}
    get('gpY').value=Math.max(0,Math.floor(firstY));get('gpY').max=Math.max(0,Math.ceil(original.height)-1);get('gpError').textContent='';sync();dialog.showModal();
  }});
  get('gpMode').addEventListener('change',sync);get('gpSource').addEventListener('change',sync);get('gpCancel').onclick=()=>dialog.close();
  dialog.querySelector('form').onsubmit=event=>{event.preventDefault();try{const depth=integer('gpDepth',1,512),mode=get('gpMode').value,result=mode==='bits'?bits(depth):mode==='unit'?units(depth):glyphs(depth);api.replaceProject(result.value);api.showStatus(result.info+' Отмена вернёт исходный SVG.');dialog.close();}catch(error){get('gpError').textContent=error.message;}};
})();
