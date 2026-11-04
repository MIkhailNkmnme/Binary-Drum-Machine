/* Search the saved reduced cell grid. Loop skips empty cells; mixed cells always break a match. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./mayatnik-variants.js'):root.MayatnikVariants);if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikGifSearch=api;})(globalThis,function(Variants){
 'use strict';
 const directions={row:[1,0],col:[0,1],diag:[1,1],antidiag:[-1,1]};
 function* orderedCells(family,W,H){
  if(family==='row'){for(let q=0;q<W*H;q++)yield q;}
  else if(family==='col'){for(let x=0;x<W;x++)for(let y=0;y<H;y++)yield y*W+x;}
  else if(family==='diag'){for(let k=1-H;k<W;k++)for(let y=Math.max(0,-k),end=Math.min(H-1,W-1-k);y<=end;y++)yield y*W+y+k;}
  else{for(let sum=0;sum<W+H-1;sum++)for(let y=Math.max(0,sum-W+1),end=Math.min(H-1,sum);y<=end;y++)yield y*W+sum-y;}
 }
 function abort(){const e=Error('Поиск в GIF отменён');e.name='AbortError';return e;}
 async function search(grid,options={}){
  const {width:W,height:H,bits}=grid||{},n=W*H;
  if(!Number.isSafeInteger(W)||!Number.isSafeInteger(H)||W<1||H<1||n>16777216||!bits||bits.length!==n)throw Error('В кадре нет точной битовой сетки');
  const mode=options.direction||'row',dirs=mode==='loop'||mode==='loops'?[]:mode==='all'?Object.entries(directions):directions[mode]?[[mode,directions[mode]]]:null;
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
  if(mode==='loop'||mode==='loops')for(const family of mode==='loop'?['row']:Object.keys(directions)){
   // Each family forms its own ring. Empty cells disappear; unknowns remain barriers.
   const direction=mode==='loop'?'loop':'loop-'+family;
   const cells=[],chars=[];
   for(const q of orderedCells(family,W,H)){if(bits[q]!==-1){cells.push(q);chars.push(bits[q]===0?'0':bits[q]===1?'1':'?');}if(due())await pause();}
   const text=chars.join(''),size=cells.length;let wholeMask=false;
   const rememberLoop=async(start,length,word,metadata={})=>{
    count++;const saved=hits.length<limit?new Uint32Array(length):null;
    if(!wholeMask){
     const mark=Math.min(length,size);
     for(let j=0;j<mark;j++){mask[cells[(start+j)%size]]=1;if(due())await pause();}
     if(length>=size)wholeMask=true;
    }
    if(saved)for(let j=0;j<length;j++){saved[j]=cells[(start+j)%size];if(due())await pause();}
    if(saved)hits.push({cells:saved,text:word,direction,...metadata});
   };
   if(pattern==='initial'){
    // Finite words may span several laps; every ring origin is considered once.
    for(const item of patterns){
     if(size){
      // KMP keeps periodic rings linear in ring + word length, including overlapping hits.
      const word=item.word,prefix=new Uint32Array(word.length);
      for(let j=1,matched=0;j<word.length;j++){
       while(matched&&word[j]!==word[matched]){matched=prefix[matched-1];if(due())await pause();}
       if(word[j]===word[matched])matched++;prefix[j]=matched;if(due())await pause();
      }
      for(let j=0,matched=0,end=size+word.length-1;j<end;j++){
       const bit=text[j%size];
       while(matched&&bit!==word[matched]){matched=prefix[matched-1];if(due())await pause();}
       if(bit===word[matched])matched++;
       if(matched===word.length){await rememberLoop(j-word.length+1,word.length,word,{i:item.i,variantLabel:item.label,variantFlags:item.flags});matched=prefix[matched-1];}
       if(due())await pause();
      }
     }
     if(due())await pause();
    }
   }else if(size){
    const allowed=pattern==='ones'?(options.inverse?'01':'1'):pattern==='zeros'?(options.inverse?'01':'0'):'01';
    const linked=(a,b)=>allowed.includes(a)&&allowed.includes(b)&&(pattern==='alternating'?a!==b:a===b);
    let hasStart=false;
    for(let from=0;from<size;from++){
     if(allowed.includes(text[from])&&!linked(text[(from+size-1)%size],text[from])){
      hasStart=true;let length=1;
      while(length<size&&linked(text[(from+length-1)%size],text[(from+length)%size])){length++;if(due())await pause();}
      if(length>=min){const word=from+length<=size?text.slice(from,from+length):text.slice(from)+text.slice(0,from+length-size);await rememberLoop(from,length,word);}
     }
     if(due())await pause();
    }
    if(!hasStart&&allowed.includes(text[0])&&size>=min)await rememberLoop(0,size,text);
   }
  }
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
