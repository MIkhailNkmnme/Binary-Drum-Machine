// Offline generator for the research figure. One unit u is the first source bit.
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const U=6, FG='#e8edf5', BG='#080b11', MUT='#aab5c6';
export function bitmap(h){
 const w=2*h-1,a=Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>Math.abs(x-(h-1))<=y?1:0));
 for(const [sy,c,hh] of [[h/2,h-1,h/2],[h/4,h-1,h/4],[3*h/4,h/2-1,h/4],[3*h/4,3*h/2-1,h/4]])
  for(let j=0;j<hh;j++)for(let x=c-hh+1+j;x<=c+hh-1-j;x++)a[sy+j][x]=0;
 return a;
}
const B=[276,552,882], R=[370,830,1290,1730];
export const panels=[
 {id:'original-8',rows:8,p:6,col:0,row:0,title:'8 пикселей',ratio:'1'},
 {id:'enlarged-8-to-16',rows:8,p:12,col:1,row:0,title:'8 → 16 пикселей',ratio:'2'},
 {id:'overlay-base-16',rows:16,p:6,col:2,row:0,title:'16 + квадраты 8 → 16',previous:8,previousP:12,ratio:'2'},
 {id:'original-16',rows:16,p:6,col:0,row:1,title:'16 пикселей',ratio:'2'},
 {id:'enlarged-16-to-24',rows:16,p:9,col:1,row:1,title:'16 → 24 пикселя',ratio:'3'},
 {id:'overlay-base-24',rows:24,p:6,col:2,row:1,title:'24 + квадраты 16 → 24',previous:16,previousP:9,ratio:'3'},
 {id:'original-24',rows:24,p:6,col:0,row:2,title:'24 пикселя',ratio:'3'},
 {id:'enlarged-24-to-32',rows:24,p:8,col:1,row:2,title:'24 → 32 пикселя',ratio:'4'},
 {id:'overlay-base-32',rows:32,p:6,col:2,row:2,title:'32 + квадраты 24 → 32',previous:24,previousP:8,ratio:'4'}
].map(p=>({...p,right:R[p.col],bottom:B[p.row],width:(2*p.rows-1)*p.p,height:p.rows*p.p}));
export const gridPanels=panels.filter(p=>p.col===2).map(p=>({...p,id:'full-grid-'+p.rows,col:3,right:R[3],title:p.rows+' · полная сетка'}));
export const allPanels=[...panels,...gridPanels];
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
function fraction(n,d=6){
 const q=Math.floor(n/d),r=n%d;
 if(!r)return String(q);
 const glyph=r*2===d?'½':r*3===d?'⅓':r*3===2*d?'⅔':r*6===d?'⅙':r*6===5*d?'⅚':null;
 return glyph?(q?String(q):'')+glyph:n+'/'+d;
}
export function makeSvg({gridPhase='overlay'}={}){
 if(!['grid','overlay','bits'].includes(gridPhase))throw Error('Unknown grid phase: '+gridPhase);
 const s=['<svg xmlns="http://www.w3.org/2000/svg" width="1840" height="1050" viewBox="0 0 1840 1050" data-grid-phase="'+gridPhase+'"><title>Серпинский: единая сетка и размеры в частях первого бита</title><desc>Двенадцать изображений, три ряда и четыре столбца. Четвёртый столбец показывает полную сетку предыдущего увеличения: отдельно, с битами и биты без неё. Третий столбец: исходники 16, 24, 32 с красными квадратами предыдущего увеличения. Единица размеров равна стороне бита первого рисунка; H₀=8. Размер клетки единичной сетки неизменен, 6 px. Размерные линии без стрелок: ширина снизу, высота слева.</desc><rect width="1840" height="1050" fill="'+BG+'"/>'];
 const txt=(x,y,t,size=14,c=FG,anchor='end')=>s.push('<text x="'+x+'" y="'+y+'" text-anchor="'+anchor+'" fill="'+c+'" font-family="DejaVu Sans,Arial,sans-serif" font-size="'+size+'">'+esc(t)+'</text>');
 txt(920,37,'Серпинский: увеличение и наложение',28,FG,'middle');
 txt(370,83,'Исходник',23);txt(830,83,'Увеличение',23);txt(1290,83,'На следующем исходнике',23);txt(1730,83,'Полная сетка · GIF',23);
 txt(920,117,'Единица размеров — сторона бита первого рисунка; его высота H₀ = 8',16,'#c8d8ee','middle');
 // Project both images' boundaries through each gap; never over the bitmaps.
 s.push('<g id="edge-guides" fill="none" stroke="#7b91ac" stroke-opacity=".55" stroke-width=".8" stroke-dasharray="1 5" stroke-linecap="round">');
 for(let row=0;row<3;row++){
  const rowPanels=allPanels.filter(p=>p.row===row).sort((a,b)=>a.col-b.col);
  const levels=[...new Set(rowPanels.flatMap(p=>[p.bottom-p.height,p.bottom]))];
  for(let col=0;col<3;col++){
   const left=rowPanels[col],right=rowPanels[col+1];
   for(const y of levels)s.push('<path data-edge-guide="horizontal" data-between="'+left.id+' '+right.id+'" d="M'+(left.right+1)+' '+y+'H'+(right.right-right.width-1)+'"/>');
  }
 }
 for(let col=0;col<4;col++)for(let row=1;row<3;row++){
  const upper=allPanels.find(p=>p.col===col&&p.row===row-1),lower=allPanels.find(p=>p.col===col&&p.row===row);
  const edges=[...new Set([upper.right-upper.width,upper.right,lower.right-lower.width,lower.right])];
  for(const x of edges)s.push('<path data-edge-guide="vertical" data-between="'+upper.id+' '+lower.id+'" d="M'+x+' '+(upper.bottom+1)+'V'+(lower.bottom-lower.height-1)+'"/>');
 }
 s.push('</g>');
 for(const p of allPanels){
  const a=bitmap(p.rows),x=p.right-p.width,y=p.bottom-p.height;
  s.push('<g data-aligned-panel="'+p.id+'" data-row-bottom="'+p.bottom+'" data-column-right="'+p.right+'"><g id="'+p.id+'" data-source-rows="'+p.rows+'" data-cell-size="'+p.p+'" data-height="'+p.height+'" data-grid-step="'+U+'" shape-rendering="crispEdges"><rect x="'+x+'" y="'+y+'" width="'+p.width+'" height="'+p.height+'" fill="#000"/>');
  for(let j=0;j<p.rows;j++)for(let i=0;i<a[j].length;i++)if(a[j][i]&&(p.col!==3||gridPhase!=='grid'))s.push('<rect data-bit="1" x="'+(x+i*p.p)+'" y="'+(y+j*p.p)+'" width="'+p.p+'" height="'+p.p+'" fill="'+FG+'"/>');
  let grid='';
  for(let gy=p.bottom;gy>=y;gy-=U)grid+='M'+x+' '+gy+'h'+p.width;
  for(let gx=p.right;gx>=x;gx-=U)grid+='M'+gx+' '+y+'v'+p.height;
  s.push('<path class="unit-grid" d="'+grid+'" fill="none" stroke="#647188" stroke-opacity=".6" stroke-width=".45"/>');
  if(p.p!==U){
   let bits='';
   for(let j=0;j<=p.rows;j++)bits+='M'+x+' '+(y+j*p.p)+'h'+p.width;
   for(let i=0;i<=a[0].length;i++)bits+='M'+(x+i*p.p)+' '+y+'v'+p.height;
   s.push('<path class="source-grid" d="'+bits+'" fill="none" stroke="#8793a8" stroke-opacity=".65" stroke-width=".65"/>');
  }
  s.push('<rect x="'+x+'" y="'+y+'" width="'+p.width+'" height="'+p.height+'" fill="none" stroke="#718095" stroke-width=".7"/></g>');
  if(p.previous&&p.col===2){
   const coarse=bitmap(p.previous),cp=p.previousP,cx=x+p.width/2,cl=cx-coarse[0].length*cp/2,edges=new Map();
   for(let j=0;j<coarse.length;j++)for(let i=0;i<coarse[j].length;i++)if(coarse[j][i]){
    const l=cl+i*cp,t=y+j*cp;
    for(const e of [[l,t,l+cp,t],[l,t+cp,l+cp,t+cp],[l,t,l,t+cp],[l+cp,t,l+cp,t+cp]])edges.set(e.join(','),'M'+e[0]+' '+e[1]+'L'+e[2]+' '+e[3]);
   }
   s.push('<g id="previous-'+p.previous+'-squares" data-previous-rows="'+p.previous+'" data-square-size="'+cp+'" fill="none" stroke="#ff4048" stroke-width="1" shape-rendering="crispEdges"><path d="'+[...edges.values()].join('')+'" vector-effect="non-scaling-stroke"/></g>');
  }
  if(p.col===3&&gridPhase!=='bits'){
   const columns=2*p.previous-1,cp=p.previousP,left=x+(p.width-columns*cp)/2;
   let lines='';
   for(let i=0;i<=columns;i++)lines+='M'+(left+i*cp)+' '+y+'v'+p.height;
   for(let j=0;j<=p.previous;j++)lines+='M'+left+' '+(y+j*cp)+'h'+(columns*cp);
   s.push('<g data-full-grid="'+p.id+'" data-columns="'+columns+'" data-rows="'+p.previous+'" data-cell-size="'+cp+'" data-left="'+left+'" data-top="'+y+'" fill="none" stroke="#ff4048" stroke-width="1" shape-rendering="crispEdges"><path d="'+lines+'" vector-effect="non-scaling-stroke"/></g>');
  }
  s.push('</g>');
  txt(p.right,y-17,p.title,18);
  // Dimension annotations stay outside the aligned image group.
  const dy=p.bottom+12,dx=x-18,DC='#7cc7ff';
  s.push('<g class="panel-dimensions" data-for="'+p.id+'" fill="none" stroke="'+DC+'" stroke-width="1"><path data-dimension="width" data-value-units="'+p.width/U+'" d="M'+x+' '+dy+'H'+p.right+'M'+x+' '+(p.bottom+3)+'V'+(dy+5)+'M'+p.right+' '+(p.bottom+3)+'V'+(dy+5)+'"/><path data-dimension="height" data-value-units="'+p.height/U+'" d="M'+dx+' '+y+'V'+p.bottom+'M'+(dx-5)+' '+y+'H'+(x-3)+'M'+(dx-5)+' '+p.bottom+'H'+(x-3)+'"/></g>');
  txt(x+p.width/2,p.bottom+30,fraction(p.width),14,DC,'middle');
  txt(dx-8,y+p.height/2+5,fraction(p.height),14,DC);
  // Equal height parts use the first figure's full height (8 first bits).
  const partHeight=8*U,partCount=p.height/partHeight,PC='#ff737a';
  s.push('<g data-height-parts="'+p.id+'" data-part-size="8" data-part-count="'+partCount+'" fill="none" stroke="'+PC+'" stroke-width="1"><path d="M'+dx+' '+y+'V'+p.bottom+'"/>');
  for(let k=0;k<=partCount;k++)s.push('<path d="M'+(dx-4)+' '+(y+k*partHeight)+'h8"/>');
  s.push('</g>');
  for(let k=0;k<partCount;k++)txt(dx+9,y+(k+.5)*partHeight+4,'8',11,PC,'middle');
  if(p.col===3){
   txt(p.right,p.bottom+50,'Сетка: '+(2*p.previous-1)+' × '+p.previous+' · клетка '+fraction(p.previousP),13,MUT);
   txt(p.right,p.bottom+68,({grid:'Сетка отдельно',overlay:'Сетка и биты',bits:'Биты без красной сетки'})[gridPhase]+' · линии 1 px',13,MUT);
  }else if(p.previous){
   txt(p.right,p.bottom+50,'Белый бит: 1 · красный: '+fraction(p.previousP),13,MUT);
   txt(p.right,p.bottom+68,'Высота: '+p.ratio+'H₀ · красные линии 1 px',13,MUT);
  }else{
   txt(p.right,p.bottom+50,'Бит: '+fraction(p.p)+' · высота: '+(p.ratio==='1'?'H₀':p.ratio+'H₀'),13,MUT);
   txt(p.right,p.bottom+68,p.rows+' исходных рядов'+(p.col===1?' · ×'+(p.p===12?'2':p.p===9?'1,5':'1⅓'):''),13,MUT);
  }
 }
 // Compare consecutive widths in each column, preserving the shared right edge.
 for(let row=1;row<3;row++)for(let col=0;col<4;col++){
  const previous=allPanels.find(p=>p.row===row-1&&p.col===col),current=allPanels.find(p=>p.row===row&&p.col===col);
  const left=current.right-current.width,seam=previous.right-previous.width,right=current.right,by=row===1?370:649,PC='#ff737a';
  s.push('<g data-width-parts="'+current.id+'" data-previous-width="'+previous.width/U+'" data-increase="'+(current.width-previous.width)/U+'" fill="none" stroke="'+PC+'" stroke-width="1"><path d="M'+left+' '+by+'H'+right+'M'+left+' '+(by-5)+'v10M'+seam+' '+(by-5)+'v10M'+right+' '+(by-5)+'v10"/></g>');
  txt((left+seam)/2,by-9,'+'+fraction(current.width-previous.width),13,PC,'middle');
  txt((seam+right)/2,by-9,fraction(previous.width),13,PC,'middle');
 }
 txt(920,985,'Голубые размеры — целиком; красные — части. Высота разбита на отрезки по 8.',15,MUT,'middle');
 txt(920,1009,'Между рядами: прибавка к ширине со знаком + и прежняя ширина. Их сумма — новая ширина.',14,MUT,'middle');
 txt(920,1033,'Единица размеров — первый бит (6 px); серая сетка — 1. Высота первой фигуры H₀ = 8. Дроби точные.',14,MUT,'middle');
 s.push('</svg>');return s.join('\n');
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 writeFileSync(new URL('./serpinski-pikseli-nalozhenie.svg',import.meta.url),makeSvg()+'\n');
 console.log(JSON.stringify({unit:U,panels:allPanels.map(p=>({id:p.id,rows:p.rows,cell:p.p,width:p.width,height:p.height,right:p.right,bottom:p.bottom}))}));
}

