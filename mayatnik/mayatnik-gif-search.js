/* Search the saved reduced cell grid. Empty and mixed cells break a match. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./mayatnik-variants.js'):root.MayatnikVariants);if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikGifSearch=api;})(globalThis,function(Variants){
 'use strict';
 const directions={row:[1,0],col:[0,1],diag:[1,1],antidiag:[-1,1]};
 function abort(){const e=Error('Поиск в GIF отменён');e.name='AbortError';return e;}
 async function search(grid,options={}){
  const {width:W,height:H,bits}=grid||{},n=W*H;
  if(!Number.isSafeInteger(W)||!Number.isSafeInteger(H)||W<1||H<1||n>16777216||!bits||bits.length!==n)throw Error('В кадре нет точной битовой сетки');
  const mode=options.direction||'row',dirs=mode==='all'?Object.entries(directions):directions[mode]?[[mode,directions[mode]]]:null;
  if(!dirs)throw Error('Выберите направление поиска в кадре GIF');
  const pattern=options.pattern||'initial',min=Number(options.min??5),limit=options.maxHits??2000,mask=new Uint8Array(n),hits=[];
  if(!['initial','ones','zeros','alternating'].includes(pattern)||!Number.isInteger(min)||min<1||min>4096||!Number.isInteger(limit)||limit<0)throw Error('Некорректные настройки поиска GIF');
  const cancelled=options.cancelled||(()=>false),yieldTask=options.yieldTask||(()=>new Promise(r=>setTimeout(r,0))),now=options.now||(()=>performance.now()),budget=options.budgetMs??8;
  let started=now(),ops=0,count=0,yields=0;
  const check=()=>{if(cancelled())throw abort();};
  const due=()=>{if(++ops%1024)return false;check();return now()-started>=budget;};
  const pause=async()=>{await yieldTask();yields++;check();started=now();};
  const valid=(x,y)=>x>=0&&x<W&&y>=0&&y<H&&(bits[y*W+x]===0||bits[y*W+x]===1);
  const remember=(cells,start,length,text,direction,metadata={})=>{count++;for(let j=start;j<start+length;j++)mask[cells[j]]=1;if(hits.length<limit)hits.push({cells:Uint32Array.from(cells.slice(start,start+length)),text,direction,...metadata});};
  let patterns=[];
  if(pattern==='initial'){
   if(!Array.isArray(options.patterns)||!options.patterns.length)throw Error('Введите последовательность из 0 и 1 или задайте строки Поиска');
   let size=0;const seen=new Set();for(let i=0;i<options.patterns.length;i++){
    const text=options.patterns[i];if(typeof text!=='string'||!/^[01]+$/.test(text)||text.length>1048576||(size+=text.length)>2097152)throw Error('Некорректная последовательность для поиска GIF');
    for(const variant of Variants.generate(text,{inverse:!!options.inverse,reverse:!!options.reverse,half:!!options.half}))if(!seen.has(variant.word)){seen.add(variant.word);patterns.push({...variant,i});}
   }
  }
  check();
  for(const [direction,[dx,dy]]of dirs)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   if(!valid(x,y)||valid(x-dx,y-dy)){if(due())await pause();continue;}
   const cells=[],chars=[];for(let xx=x,yy=y;valid(xx,yy);xx+=dx,yy+=dy){const q=yy*W+xx;cells.push(q);chars.push(String(bits[q]));}const text=chars.join('');
   if(pattern==='initial')for(const item of patterns){let from=0;while(from<=text.length-item.word.length){const at=text.indexOf(item.word,from);if(at<0)break;remember(cells,at,item.word.length,item.word,direction,{i:item.i,variantLabel:item.label,variantFlags:item.flags});from=at+1;if(due())await pause();}if(due())await pause();}
   else{
    const allowed=pattern==='ones'?(options.inverse?'01':'1'):pattern==='zeros'?(options.inverse?'01':'0'):'01';
    for(let from=0;from<text.length;){let end=from+1;if(!allowed.includes(text[from])){from=end;continue;}while(end<text.length&&(pattern==='alternating'?text[end]!==text[end-1]:text[end]===text[from]))end++;if(end-from>=min)remember(cells,from,end-from,text.slice(from,end),direction);from=end;if(due())await pause();}
   }
   if(due())await pause();
  }
  check();return {count,hits,mask,complete:true,yields,width:W,height:H,reason:count?'': 'Совпадений нет'};
 }
 return {search,abort};
});
