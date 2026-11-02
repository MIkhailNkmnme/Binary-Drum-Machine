/* Whole-region descriptors for square and single-parity Xorrom scores. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.MayatnikXorromGeometry=factory();
})(globalThis,function(){
  'use strict';
  const modes=['sides','corners','diagonal','chess0','bit'];
  const yieldTask=()=>globalThis.scheduler?.yield?.()||new Promise(resolve=>setTimeout(resolve,0));
  const axial=[[-1,0],[1,0],[0,-1],[0,1]],diagonal=[[-1,-1],[1,-1],[-1,1],[1,1]];
  const diamondCorners=[[-2,0],[2,0],[0,-2],[0,2]];

  async function analyze(score,options={}){
    const {width,height,rows}=score, n=width*height;
    if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<0||height<0||
       height>16384||n>16*1024*1024||height!==rows?.length)
      throw RangeError('Хорром: неверный размер поля для анализа областей.');
    const connectivity=options.connectivity||'sides';
    if(!modes.includes(connectivity))throw RangeError('Хорром: неизвестный режим связности.');
    const cancelled=options.cancelled||(()=>false), pause=options.yieldTask||yieldTask;
    function check(){if(cancelled()){const error=Error('Анализ областей Хоррома отменён.');error.name='AbortError';throw error;}}
    check();
    if(score.geometry?.connectivity===connectivity)return score;
    const selected=rows.map(row=>{
      if(row.bits?.length!==width)throw RangeError('Хорром: неполная строка поля.');
      return {...row,geometry:{zero:null,one:null}};
    });
    if(!n)return {...score,rows:selected,geometry:{connectivity,topology:'square'}};
    let nextYield=0;
    async function checkpoint(){
      check();
      if(Date.now()<nextYield)return;
      await pause();check();nextYield=Date.now()+7;
    }
    const bits=rows.map(row=>row.bits);
    // Two padding cells on each side permit all square/diamond offsets
    // without bounds checks or wrapping onto the next line.
    const stride=width+4,offset=2*stride+2,grid=new Uint8Array(stride*(height+4));
    let budget=32768,occupied=0;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      if(--budget===0){await checkpoint();budget=32768;}
      const bit=bits[y][x];
      if(bit===0||bit===1){
        grid[offset+y*stride+x]=bit+1;occupied|=1<<((x+y)&1);
      }
    }
    const diamond=occupied===1||occupied===2;
    const sides=diamond?diagonal:axial,corners=diamond?diamondCorners:diagonal;
    const result={...score,rows:selected,geometry:{connectivity,topology:diamond?'diamond':'square'}};
    if(connectivity==='bit'){
      for(let y=0;y<height;y++){
        const g=selected[y].geometry;
        for(let x=0;x<width;x++){
          if(--budget===0){await checkpoint();budget=32768;}
          const bit=bits[y][x],key=bit===0?'zero':'one';
          if(bit!==0&&bit!==1||g[key]&&(bit===1||!g.zero.exterior))continue;
          const exterior=sides.some(([dx,dy])=>!(bits[y+dy]?.[x+dx]>=0));
          if(g[key]&&exterior)continue;
          g[key]={id:y*width+x+1,bit,area:1,width:1,height:1,perimeter:4,top:y,bottom:y,left:x,right:x,
            symmetryHeight:1,orientation:'flat',triangleScore:0,exterior};
        }
      }
      check();return result;
    }
    // The low two bits encode missing/zero/one, independent of traversal.
    // 4 marks the current component, 8 marks a completed one.
    const offsets=steps=>Int32Array.from(steps,([dx,dy])=>dy*stride+dx);
    const side=offsets(sides),corner=offsets(corners);
    const steps=connectivity==='sides'?side:connectivity==='corners'?offsets([...sides,...corners]):corner;
    const counts=new Uint32Array(height),asymmetric=new Uint8Array(height);
    let queue=new Uint32Array(Math.min(256,n)), tail=0;
    function cornerChain(i){
      return (grid[i+corner[0]]&3)===1||(grid[i+corner[1]]&3)===1||
             (grid[i+corner[2]]&3)===1||(grid[i+corner[3]]&3)===1;
    }
    function enqueue(index){
      grid[index]|=4;
      if(tail===queue.length){
        const bigger=new Uint32Array(Math.min(n,2*tail));
        bigger.set(queue);queue=bigger;
      }
      queue[tail++]=index;
    }
    // Keep the hot cell loops synchronous. Yield between bounded blocks,
    // including while following one very large connected background.
    let left,right,top,bottom,perimeter,exterior;
    function floodBlock(i,limit,code){
      for(;i<tail&&i<limit;i++){
        const cell=queue[i],y=Math.floor((cell-offset)/stride),x=cell-offset-y*stride;
        left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
        counts[y]++;
        for(let j=0;j<steps.length;j++){
          const neighbour=cell+steps[j];if(grid[neighbour]===code)enqueue(neighbour);
        }
        if(connectivity==='chess0'&&code===1&&cornerChain(cell)){
          for(let j=0;j<4;j++){
            const neighbour=cell+side[j];if(grid[neighbour]===code&&cornerChain(neighbour))enqueue(neighbour);
          }
        }
      }
      return i;
    }
    function measureBlock(first,last,axis2){
      for(let i=first;i<last;i++){
        const cell=queue[i],y=Math.floor((cell-offset)/stride),x=cell-offset-y*stride;
        if(!(grid[cell+axis2-2*x]&4))asymmetric[y]=1;
        for(let j=0;j<4;j++){
          const neighbour=grid[cell+side[j]];
          if(!neighbour)exterior=true;
          if(!(neighbour&4))perimeter++;
        }
      }
    }
    const end=offset+(height-1)*stride+width;
    for(let seed=offset;seed<end;seed++){
      if(--budget===0){await checkpoint();budget=32768;}
      const code=grid[seed];
      if(code!==1&&code!==2)continue;
      const sy=Math.floor((seed-offset)/stride),sx=seed-offset-sy*stride,bit=code-1;
      left=right=sx;top=bottom=sy;perimeter=0;exterior=false;
      tail=0;enqueue(seed);
      for(let i=0;i<tail;){
        const last=floodBlock(i,i+budget,code);
        budget-=last-i;i=last;
        if(!budget){await checkpoint();budget=32768;}
      }
      const area=tail,h=bottom-top+1,w=right-left+1,axis2=left+right;
      for(let i=0;i<area;){
        const last=Math.min(area,i+budget);
        measureBlock(i,last,axis2);
        budget-=last-i;i=last;
        if(!budget){await checkpoint();budget=32768;}
      }
      let symRun=0,symmetryHeight=0,downError=0,upError=0;
      for(let y=top;y<=bottom;y++){
        symRun=asymmetric[y]||counts[y]===0?0:symRun+1;symmetryHeight=Math.max(symmetryHeight,symRun);
        const base=diamond?(w+1)/2:w,slope=h>1?(base-1)*(y-top)/(h-1):0;
        downError+=Math.abs(counts[y]-(base-slope));upError+=Math.abs(counts[y]-(1+slope));
        asymmetric[y]=0;
      }
      // Compare row widths against both ideal tapers, then penalize shapes
      // that fit both directions equally well (rectangles and diamonds).
      const orientation=downError<upError?'down':upError<downError?'up':'flat';
      const triangleScore=orientation==='flat'?0:Math.max(0,1-Math.min(downError,upError)/area)*
        (1-Math.min(downError,upError)/Math.max(downError,upError));
      const key=bit===0?'zero':'one';
      let region;
      for(let y=top;y<=bottom;y++){
        if(!counts[y])continue;
        counts[y]=0;
        const geometry=selected[y].geometry,old=geometry[key];
        // For zeros only, enclosed figures precede the outside background.
        // Within a class use whole area, then the first row-major seed.
        if(old&&(bit===0&&old.exterior!==exterior?!old.exterior:old.area>=area))continue;
        if(!region)region={id:sy*width+sx+1,bit,area,width:w,height:h,perimeter,top,bottom,left,right,
          symmetryHeight,orientation,triangleScore,exterior};
        geometry[key]=region;
      }
      for(let i=0;i<area;i++){
        if(--budget===0){await checkpoint();budget=32768;}
        grid[queue[i]]=code|8;
      }
    }
    // A zero background fills the other XOR parity and may join visually
    // separate holes into a single four-connected component. Recover exact
    // downward cones on the XOR lattice. Each slice must be all zero between
    // flanking ones, with no one from the other parity inside the taper.
    if(connectivity==='corners'||(!diamond&&connectivity==='sides')){
      for(let y=2;y<height;y++)for(let x=2;x<width-2;x++){
        if(--budget===0){await checkpoint();budget=32768;}
        if(bits[y][x]!==0||bits[y][x-2]!==1||bits[y][x+2]!==1)continue;
        let h=1;
        for(;h<=y;h++){
          const r=bits[y-h],l=x-h,end=x+h;
          if(r[l-2]!==1||r[end+2]!==1)break;
          let valid=true;
          for(let c=l;c<=end;c++){
            if(--budget===0){await checkpoint();budget=32768;}
            if((c-l)%2===0?r[c]!==0:r[c]===1){valid=false;break;}
          }
          if(!valid)break;
        }
        if(h<3)continue;
        const top=y-h+1,area=h*(h+1)/2;
        let triangle;
        for(let r=top;r<=y;r++){
          const g=selected[r].geometry;
          if(g.triangle?.area>=area)continue;
          if(!triangle)triangle={id:-(y*width+x+1),bit:0,area,width:2*h-1,height:h,perimeter:4*h,
            top,bottom:y,left:x-h+1,right:x+h-1,symmetryHeight:h,orientation:'down',triangleScore:1,exterior:false};
          g.triangle=triangle;
        }
      }
    }
    check();return result;
  }
  return {analyze};
});
