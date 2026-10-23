// Additional magnified bit samples; the main RGB figure is not changed.
// Coordinates use 12 integer ticks per first source bit (6 px in the main SVG).
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {bitmap,gridColors,panels} from './serpinski-pikseli-nalozhenie.mjs';
const T=12, HALF=T/2, BG='#080b11', FG='#e8edf5', MUT='#aab5c6';
const phases=['right','center','left'],names={right:'R · справа',center:'G · центр',left:'B · слева'};
const gcd=(a,b)=>b?gcd(b,a%b):a;
function fraction(n,d=T){
 const whole=Math.floor(n/d),r=n%d;if(!r)return String(whole);
 const g=gcd(r,d),key=(r/g)+'/'+(d/g),glyph={'1/2':'½','1/3':'⅓','2/3':'⅔','1/4':'¼','3/4':'¾','1/6':'⅙','5/6':'⅚'}[key];
 return (whole?whole+'':'')+(glyph||key);
}
function cuts(start,size,step,origin=0){
 const out=[];for(let q=Math.floor((start-origin)/step)+1;origin+q*step<start+size;q++)out.push(origin+q*step);
 return out;
}
function parts(start,size,boundaries){
 const points=[start,...boundaries,start+size];return points.slice(1).map((p,i)=>p-points[i]);
}
export const samples=panels.filter(p=>p.col===2).flatMap(p=>phases.flatMap(position=>{
 const cell=p.previousP*2,gap=(p.width-(2*p.previous-1)*p.previousP)*2;
 const offset=gap*({right:1,center:.5,left:0})[position];
 return ['large','small'].map(kind=>{
  const size=kind==='large'?cell:T;
  // The apex source bit, or the right-hand white bit in row 1 of the target.
  const row=kind==='large'?0:1,col=kind==='large'?p.previous-1:p.rows;
  const x=kind==='large'?offset+col*cell:col*T,y=kind==='large'?0:T;
  const step=kind==='large'?T:cell,origin=kind==='large'?0:offset;
  if(bitmap(kind==='large'?p.previous:p.rows)[row][col]!==1)throw Error('Sample must be an actual white bit');
  return {id:p.previous+'-'+p.rows+'-'+kind+'-'+position,from:p.previous,to:p.rows,kind,position,row,col,x,y,size,cell,offset,
   xCuts:cuts(x,size,step,origin),yCuts:cuts(y,size,step),fineX:cuts(x,size,HALF),fineY:cuts(y,size,HALF)};
 });
}));
export function makeBitDetailsSvg(){
 const s=['<svg xmlns="http://www.w3.org/2000/svg" width="1840" height="1240" viewBox="0 0 1840 1240"><title>Серпинский: как другая сетка делит бит</title><desc>Отдельная дополнительная схема. Для каждого перехода крупный бит разделён исходной сеткой, а единичный бит — сеткой увеличения. Положения R справа, G центр, B слева. Мелкая сетка с постоянным шагом половина первого бита перенесена с первой строки на вторую и третью. Это точные фрагменты реальных белых битов; новые биты не создаются.</desc><rect width="1840" height="1240" fill="'+BG+'"/>'];
 const text=(x,y,value,size=15,color=FG,anchor='middle')=>s.push('<text x="'+x+'" y="'+y+'" text-anchor="'+anchor+'" fill="'+color+'" font-family="DejaVu Sans,Arial,sans-serif" font-size="'+size+'">'+value+'</text>');
 text(920,38,'Как другая сетка делит бит',28);
 text(920,72,'Дополнение к RGB-схеме · размеры в частях первого бита',17,MUT);
 text(920,103,'Тонкая золотая сетка: ½ из первой строки — тот же шаг на всех трёх уровнях',17,'#d4ad63');
 text(475,145,'Крупный бит → исходная сетка 1',23);
 text(1390,145,'Бит 1 → сетка увеличения',23);
 s.push('<path d="M920 155V1175" stroke="#263344"/>');
 for(const p of samples){
  const level=[8,16,24].indexOf(p.from),index=phases.indexOf(p.position),left=(p.kind==='large'?140:1055)+index*265;
  const top=225+level*335,side=160,scale=side/p.size,color=gridColors[p.position];
  if(index===0&&p.kind==='large')text(32,top+85,p.from+' → '+p.to,18,MUT,'start');
  text(left+side/2,top-44,names[p.position],17,color);
  text(left+side/2,top-18,'Бит '+fraction(p.size)+' × '+fraction(p.size),15);
  s.push('<g data-bit-sample="'+p.id+'" data-source-row="'+p.row+'" data-source-column="'+p.col+'" data-source-level="'+(p.kind==='large'?p.from:p.to)+'" data-size-ticks="'+p.size+'" data-origin-x="'+p.x+'" data-origin-y="'+p.y+'" data-ticks-per-unit="12"><rect x="'+left+'" y="'+top+'" width="'+side+'" height="'+side+'" fill="#e8edf5"/>');
  // The same physical half-bit grid is clipped to each sample, never rescaled
  // to a different mathematical step; only the magnification of the sample varies.
  let fine='';for(const x of p.fineX)fine+='M'+(left+(x-p.x)*scale)+' '+top+'v'+side;
  for(const y of p.fineY)fine+='M'+left+' '+(top+(y-p.y)*scale)+'h'+side;
  s.push('<path data-first-row-grid="'+p.id+'" data-step-ticks="6" d="'+fine+'" fill="none" stroke="#9b762f" stroke-width="1" stroke-dasharray="2 3"/>');
  const cutColor=p.kind==='large'?'#45566c':color;
  let main='';for(const x of p.xCuts)main+='M'+(left+(x-p.x)*scale)+' '+top+'v'+side;
  for(const y of p.yCuts)main+='M'+left+' '+(top+(y-p.y)*scale)+'h'+side;
  s.push('<path data-other-grid="'+p.id+'" data-x-parts="'+parts(p.x,p.size,p.xCuts).join(' ')+'" data-y-parts="'+parts(p.y,p.size,p.yCuts).join(' ')+'" d="'+main+'" fill="none" stroke="'+cutColor+'" stroke-width="2"/><rect x="'+left+'" y="'+top+'" width="'+side+'" height="'+side+'" fill="none" stroke="'+color+'" stroke-width="2"/></g>');
  text(left+side/2,top+185,'Ш: '+parts(p.x,p.size,p.xCuts).map(v=>fraction(v)).join(' + '),15);
  text(left+side/2,top+209,'В: '+parts(p.y,p.size,p.yCuts).map(v=>fraction(v)).join(' + '),15);
  text(left+side/2,top+235,'бит ['+p.row+', '+p.col+'] · уровень '+(p.kind==='large'?p.from:p.to),12,MUT);
 }
 text(920,1197,'Ш и В — деление другой основной сеткой. Золотой пунктир отдельно показывает сетку ½.',15,MUT);
 text(920,1221,'½ получена в первой строке: центральное наложение делит бит 1 пополам. Адреса битов — с нуля.',14,MUT);
 s.push('</svg>');return s.join('\n');
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 writeFileSync(new URL('./serpinski-delenie-bita.svg',import.meta.url),makeBitDetailsSvg()+'\n');
 console.log(JSON.stringify({samples:samples.length,firstRowGridStep:'1/2',levels:[8,16,24]}));
}
