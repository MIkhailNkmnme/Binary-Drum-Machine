/* Regenerate the illustrative arrays and SVGs using the application's modules.
 * Run: node issledovanie/animatrix-excel/generate.cjs
 * Share-link metadata is written to the system temporary directory.
 */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const Source=require('../../mayatnik/mayatnik-animatrix-source.js');
const Core=require('../../mayatnik/mayatnik-animatrix-core.js');
const Share=require('../../mayatnik/mayatnik-share-link.js');
function blank(width=19,height=9){
  const s={width,height,areas:[{x:0,y:0,width,height}]};
  for(const k of ['bits','present','bold','automatic','filled','selection'])s[k]=new Uint8Array(width*height);
  s.colours=new Uint32Array(width*height);s.fills=new Uint32Array(width*height);s.automatic.fill(1);return s;
}
function put(s,x,y,v){const q=y*s.width+x;s.bits[q]=+v;s.present[q]=1;}
function strings(values,width=25,height=8){
  const s=blank(width,height),anchor=(width-1)/2;
  values.forEach((row,y)=>{let x=anchor-row.length+1;if(((x-anchor-y)%2+2)%2)x--;[...row].forEach((v,j)=>put(s,x+2*j,y,v));});return s;
}
function coneSeed(algorithm){const s=blank(19,9),y=algorithm==='excelTriangleDown'?0:algorithm==='excelTriangleUp'?8:4;put(s,9,y,1);return s;}
const specs=[
  {id:'zerkalius',name:'Зеркалиус',algorithm:'copyRows',frame:2,source:Source.demo(8,'one','copyRows'),
    stage:'Оси 2 и 3',caption:'NAND симметричных битов записывается в верхнюю строку.',note:'Синий жирный 1; светло-серый обычный 0. Биты вычислены общим ядром.'},
  {id:'otskok',name:'Отскок',algorithm:'excelBounce',frame:2,seed:strings(['10110','0000']),
    stage:'Две копии строки',caption:'Копия идёт по полосе и отражается, повторяя крайние клетки.',note:'Синий — вперёд; красный — после разворота. Прошлая копия становится чёрной.'},
  {id:'interxor',name:'ИнтерXOR',algorithm:'excelChain',frame:3,seed:strings(['10','101','11','100']),
    stage:'Пары 1→2, 2→3, 3→4',caption:'Нечётная разность длин: переплетение. Чётная: XOR пары.',note:'После последней пары следующая операция замкнёт строку 4 со строкой 1.'},
  {id:'tsep-xor',name:'Цепь XOR',algorithm:'excelChainDown',frame:3,seed:strings(['10','101','11','100']),
    stage:'Те же три пары',caption:'В XOR-ветке участвуют все строки сверху до цели включительно.',note:'Исходник тот же, что у ИнтерXOR; результат строки 4 отличается.'},
  {id:'konus-vniz',name:'Конус вниз',algorithm:'excelTriangleDown',frame:1,seed:coneSeed('excelTriangleDown'),
    stage:'Один конус, глубина 9',caption:'Каждая цель XOR два диагональных родителя сверху.',note:'Начальные пустые клетки показаны фоном; появившиеся нули — полноценные биты.'},
  {id:'konus-vverh',name:'Конус вверх',algorithm:'excelTriangleUp',frame:1,seed:coneSeed('excelTriangleUp'),
    stage:'Один конус, глубина 9',caption:'Тот же расчёт вверх: родители находятся в строке ниже.',note:'Показан настоящий результат ядра, а не поворот готовой картинки.'},
  {id:'romb',name:'Ромб',algorithm:'excelTriangleBoth',frame:3,seed:coneSeed('excelTriangleBoth'),
    stage:'Вершины 0, +1, +2',caption:'Из каждой вершины строятся конусы вверх и вниз.',note:'В следующем кадре вершина на один столбец правее; цвет сохраняет правило Excel.'},
  {id:'kachanie',name:'Качание',algorithm:'excelTrianglePend',frame:5,seed:coneSeed('excelTrianglePend'),
    stage:'Вершины 0, −1, +1, −2, +2',caption:'Один двусторонний конус за кадр, размах растёт.',note:'Синий и красный — собственные отметки алгоритма, чёрный — его обычный шрифт.'},
  {id:'stolknovenie',name:'Столкновение',algorithm:'excelCollision',frame:1,
    stage:'Один поворот на 180° и XOR',caption:'Обе клетки пары получают XOR исходных значений.',note:'Центральная клетка сталкивается сама с собой и становится нулём.'}
];
const collision=blank(15,9);collision.areas=[{x:5,y:2,width:5,height:5}];
['10010','01000','00100','10010','00101'].forEach((row,y)=>[...row].forEach((v,x)=>put(collision,5+x,2+y,v)));
specs.at(-1).seed=collision;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const hex=n=>'#'+(n>>>0).toString(16).padStart(6,'0');
function rowRecords(s){
  const out=[];for(let y=0;y<s.height;y++){const cells=[];for(let x=0;x<s.width;x++){const q=y*s.width+x;if(s.present[q])cells.push({x,bit:s.bits[q]});}if(cells.length)out.push({row:y+1,bits:cells.map(c=>c.bit).join(''),cells});}return out;
}
function svg(spec,before,after){
  const positions=[];for(const s of [before,after])for(let q=0;q<s.present.length;q++)if(s.present[q])positions.push([q%s.width,Math.floor(q/s.width)]);
  const minX=Math.min(...positions.map(p=>p[0])),maxX=Math.max(...positions.map(p=>p[0])),minY=Math.min(...positions.map(p=>p[1])),maxY=Math.max(...positions.map(p=>p[1]));
  const cell=Math.min(27,390/(maxX-minX+1)),plotHeight=(maxY-minY+1)*cell,panelHeight=Math.max(220,plotHeight+72),H=panelHeight+175;
  const text=(x,y,s,size=16,fill='#e4edf8',extra='')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${escape(s)}</text>`;
  let out=`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="${H}" viewBox="0 0 960 ${H}" role="img" aria-labelledby="title desc"><title id="title">${escape(spec.name)}: исходник и кадр ${spec.frame}</title><desc id="desc">${escape(spec.caption+' '+spec.stage+'. '+spec.note)}</desc><rect width="960" height="${H}" rx="12" fill="#0c131d"/><g font-family="Arial, sans-serif">`;
  out+=text(24,34,spec.name,24)+text(24,61,spec.caption,17,'#a9bdd4');
  for(const [index,s]of [before,after].entries()){
    const panelX=20+index*480,ox=panelX+35+(390-(maxX-minX+1)*cell)/2,oy=132;
    out+=`<rect x="${panelX}" y="80" width="440" height="${panelHeight}" rx="8" fill="#17212e" stroke="#314155"/>`;
    out+=text(panelX+16,108,index?'Кадр '+spec.frame+' · '+spec.stage:'Исходник · кадр 0',15);
    for(let y=minY;y<=maxY;y++){
      out+=text(panelX+12,oy+(y-minY+.66)*cell,y+1,12,'#a9bdd4');
      for(let x=minX;x<=maxX;x++){
        const q=y*s.width+x;if(!s.present[q])continue;
        const bit=s.bits[q],px=ox+(x-minX)*cell,py=oy+(y-minY)*cell;
        const fill=s.filled[q]?hex(s.fills[q]):bit?'#edf2f8':'#b9c7d5';
        const colour=spec.id==='zerkalius'?(bit?'#0066cc':'#dcdcdc'):s.automatic[q]?'#000000':hex(s.colours[q]);
        const weight=spec.id==='zerkalius'?(bit?700:400):(s.bold[q]?700:400);
        out+=`<rect x="${px}" y="${py}" width="${cell-.6}" height="${cell-.6}" rx="1.5" fill="${fill}"/>`;
        out+=text(px+(cell-.6)/2,py+cell*.72,bit,Math.min(18,cell*.74),colour,`text-anchor="middle" font-family="Consolas, monospace" font-weight="${weight}"${spec.id==='zerkalius'&&!bit?' stroke="#17202d" stroke-width=".8" paint-order="stroke"':''}`);
      }
    }
  }
  out+=text(480,80+panelHeight/2,'→',26,'#6fc7ff','text-anchor="middle"');
  out+=text(24,panelHeight+110,spec.note,15,'#bdd0e4');
  out+=text(24,panelHeight+140,'Пусто ≠ 0. Положение и значения клеток взяты из расчёта приложения.',14,'#8ea6bf');
  return out+'</g></svg>\n';
}
(async()=>{
  const metadata=[];
  for(const spec of specs){
    let source=spec.source||Source.encode(spec.seed,{anchor:Math.floor((spec.seed.width-1)/2)});
    if(spec.algorithm!=='copyRows')source=Source.prepareExcel(source,spec.algorithm);
    const state=Source.normalize({...Source.defaults(),animatrixOn:true,animatrixAlgorithm:spec.algorithm,animatrixSource:source,animatrixCopyRowsUnit:'row',...(spec.algorithm==='copyRows'?{animatrixCopyRowsLayout:'mirrorExcel'}:{}),animatrixCycleMode:'infinite',animatrixColours:'inherit',animatrixExcelDepth:9,rows:source.height,steps:source.height,mode:'one',bg:'empty',view:'bits',viewDigits:true,staggeredGrid:false,zoom:'fit',speed:1,bitOneColour:'#edf2f8',bitZeroColour:'#b9c7d5',digitOneColour:'#000000',digitZeroColour:'#000000',digitSize:80,anchorAxis:false,sequenceSourceOn:false,compareSource:''});
    const engine=Source.create(state),before=Core.snapshot(engine);Source.advance(engine,spec.frame);const after=Core.snapshot(engine);
    const filename=spec.id+'.svg';fs.writeFileSync(path.join(__dirname,filename),svg(spec,before,after));
    const code=await Share.encode({v:1,k:engine.sourceFrame,state,tools:{},colours:{},colourAuto:{}});
    metadata.push({id:spec.id,name:spec.name,algorithm:spec.algorithm,image:'animatrix-excel/'+filename,frame:engine.sourceFrame,stage:spec.stage,caption:spec.caption,note:spec.note,link:'../mayatnik/Zerkalius-mayatnik.html#s='+code,code,beforeRows:rowRecords(before),afterRows:rowRecords(after),width:engine.width,height:engine.height,cycleFrames:Source.cycleFrames(state)});
  }
  const target=path.join(os.tmpdir(),'codex-animatrix-excel-research.json');fs.writeFileSync(target,JSON.stringify(metadata,null,2));
  console.log(JSON.stringify({metadata:target,assets:metadata.map(({id,frame,width,height,beforeRows,afterRows})=>({id,frame,width,height,before:beforeRows.map(r=>r.bits),after:afterRows.map(r=>r.bits)}))},null,2));
})();
