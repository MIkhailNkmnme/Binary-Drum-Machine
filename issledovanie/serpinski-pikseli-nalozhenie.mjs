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
const B=[276,552,882], R=[370,830,1290];
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
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
function fraction(n,d=6){
 const q=Math.floor(n/d),r=n%d;
 if(!r)return String(q);
 const glyph=r*2===d?'½':r*3===d?'⅓':r*3===2*d?'⅔':null;
 return glyph?(q?String(q):'')+glyph:n+'/'+d;
}
export function makeSvg(){
 const s=['<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1050" viewBox="0 0 1400 1050"><title>Серпинский: единая сетка и размеры в частях первого бита</title><desc>Девять изображений, три ряда и три столбца. Третий столбец: исходники 16, 24, 32 с красными квадратами предыдущего увеличения. Одна часть u равна стороне бита первого рисунка; H₀=8u. Размер клетки единичной сетки неизменен, 6 px. Размерные линии без стрелок: ширина снизу, высота слева.</desc><rect width="1400" height="1050" fill="'+BG+'"/>'];
 const txt=(x,y,t,size=14,c=FG,anchor='end')=>s.push('<text x="'+x+'" y="'+y+'" text-anchor="'+anchor+'" fill="'+c+'" font-family="DejaVu Sans,Arial,sans-serif" font-size="'+size+'">'+esc(t)+'</text>');
 txt(700,37,'Серпинский: увеличение и наложение',28,FG,'middle');
 txt(370,83,'Исходник',23);txt(830,83,'Увеличение',23);txt(1290,83,'На следующем исходнике',23);
 txt(700,117,'1 часть u = сторона бита первого рисунка; его высота H₀ = 8u',16,'#c8d8ee','middle');
 for(const y of B)s.push('<path d="M60 '+y+'H1320" fill="none" stroke="#273343" stroke-dasharray="3 5"/>');
 for(const x of R)s.push('<path d="M'+x+' 145V882" fill="none" stroke="#1d2632" stroke-dasharray="2 6"/>');
 for(const p of panels){
  const a=bitmap(p.rows),x=p.right-p.width,y=p.bottom-p.height;
  s.push('<g data-aligned-panel="'+p.id+'" data-row-bottom="'+p.bottom+'" data-column-right="'+p.right+'"><g id="'+p.id+'" data-source-rows="'+p.rows+'" data-cell-size="'+p.p+'" data-height="'+p.height+'" data-grid-step="'+U+'" shape-rendering="crispEdges"><rect x="'+x+'" y="'+y+'" width="'+p.width+'" height="'+p.height+'" fill="#000"/>');
  for(let j=0;j<p.rows;j++)for(let i=0;i<a[j].length;i++)if(a[j][i])s.push('<rect data-bit="1" x="'+(x+i*p.p)+'" y="'+(y+j*p.p)+'" width="'+p.p+'" height="'+p.p+'" fill="'+FG+'"/>');
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
  if(p.previous){
   const coarse=bitmap(p.previous),cp=p.previousP,cx=x+p.width/2,cl=cx-coarse[0].length*cp/2,edges=new Map();
   for(let j=0;j<coarse.length;j++)for(let i=0;i<coarse[j].length;i++)if(coarse[j][i]){
    const l=cl+i*cp,t=y+j*cp;
    for(const e of [[l,t,l+cp,t],[l,t+cp,l+cp,t+cp],[l,t,l,t+cp],[l+cp,t,l+cp,t+cp]])edges.set(e.join(','),'M'+e[0]+' '+e[1]+'L'+e[2]+' '+e[3]);
   }
   s.push('<g id="previous-'+p.previous+'-squares" data-previous-rows="'+p.previous+'" data-square-size="'+cp+'" fill="none" stroke="#ff4048" stroke-width="1" shape-rendering="crispEdges"><path d="'+[...edges.values()].join('')+'" vector-effect="non-scaling-stroke"/></g>');
  }
  s.push('</g>');
  txt(p.right,y-17,p.title,18);
  // Dimension annotations stay outside the aligned image group.
  const dy=p.bottom+12,dx=x-18,DC='#7cc7ff';
  s.push('<g class="panel-dimensions" data-for="'+p.id+'" fill="none" stroke="'+DC+'" stroke-width="1"><path data-dimension="width" data-value-units="'+p.width/U+'" d="M'+x+' '+dy+'H'+p.right+'M'+x+' '+(p.bottom+3)+'V'+(dy+5)+'M'+p.right+' '+(p.bottom+3)+'V'+(dy+5)+'"/><path data-dimension="height" data-value-units="'+p.height/U+'" d="M'+dx+' '+y+'V'+p.bottom+'M'+(dx-5)+' '+y+'H'+(x-3)+'M'+(dx-5)+' '+p.bottom+'H'+(x-3)+'"/></g>');
  txt(x+p.width/2,p.bottom+30,fraction(p.width)+'u',14,DC,'middle');
  txt(dx-8,y+p.height/2+5,fraction(p.height)+'u',14,DC);
  if(p.previous){
   txt(p.right,p.bottom+50,'Белый бит: 1u · красный: '+fraction(p.previousP)+'u',13,MUT);
   txt(p.right,p.bottom+68,'Высота: '+p.ratio+'H₀ · красные линии 1 px',13,MUT);
  }else{
   txt(p.right,p.bottom+50,'Бит: '+fraction(p.p)+'u · высота: '+(p.ratio==='1'?'H₀':p.ratio+'H₀'),13,MUT);
   txt(p.right,p.bottom+68,p.rows+' исходных рядов'+(p.col===1?' · ×'+(p.p===12?'2':p.p===9?'1,5':'1⅓'):''),13,MUT);
  }
 }
 txt(700,985,'Размерные линии без стрелок: ширина снизу, высота слева. Все размеры — в частях u.',15,MUT,'middle');
 txt(700,1009,'Серая сетка: 1u везде; границы исходных битов заметнее. Красные квадраты — предыдущее увеличение.',14,MUT,'middle');
 txt(700,1033,'Высота первой фигуры H₀ = 8u. На этой схеме 1u = 6 px. Размеры даны точно, без округления.',14,MUT,'middle');
 s.push('</svg>');return s.join('\n');
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 writeFileSync(new URL('./serpinski-pikseli-nalozhenie.svg',import.meta.url),makeSvg()+'\n');
 console.log(JSON.stringify({unit:U,panels:panels.map(p=>({id:p.id,rows:p.rows,cell:p.p,width:p.width,height:p.height,right:p.right,bottom:p.bottom}))}));
}
