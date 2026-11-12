/* Immutable viewport capture for «Очки → по наложению».
 * Captures the ordinary enlarged overlay, not the lower XOR/AND copies.
 * Coordinates in region/regionSnapshot are absolute source-field cells.
 * Canvas/viewport rectangles and fieldLeft/fieldTop use the same CSS space.
 */
(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikLargeOverlay=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const DEFAULT_DENSE_LIMIT=4194304;
  function integer(value,name,min=0){if(!Number.isSafeInteger(value)||value<min)throw new RangeError('Некорректный '+name);return value;}
  function rectangle(rect){
    if(!rect||!['left','top','width','height'].every(key=>Number.isFinite(rect[key]))||rect.width<=0||rect.height<=0)throw new RangeError('Нет точной области растра наложения.');
    return rect;
  }
  function region({W,H,cell,fieldLeft,fieldTop,viewport,sourceX=0}){
    integer(W,'размер поля',1);integer(H,'размер поля',1);integer(sourceX,'начальный столбец');rectangle(viewport);
    if(!Number.isFinite(cell)||cell<=0||!Number.isFinite(fieldLeft)||!Number.isFinite(fieldTop))throw new RangeError('Некорректный масштаб наложения.');
    // Only centres actually captured by the GPU viewport can be searched.
    const x0=Math.max(0,Math.min(W,Math.ceil((viewport.left-fieldLeft)/cell-.5)));
    const x1=Math.max(x0,Math.min(W,Math.ceil((viewport.left+viewport.width-fieldLeft)/cell-.5)));
    const y0=Math.max(0,Math.min(H,Math.ceil((viewport.top-fieldTop)/cell-.5)));
    const y1=Math.max(y0,Math.min(H,Math.ceil((viewport.top+viewport.height-fieldTop)/cell-.5)));
    return x1>x0&&y1>y0?{x:sourceX+x0,y:y0,width:x1-x0,height:y1-y0}:null;
  }
  function packed(width,height){
    integer(width,'размер снимка',1);integer(height,'размер снимка',1);
    const stride=Math.ceil(width/32),length=stride*height;
    if(!Number.isSafeInteger(width*height)||!Number.isSafeInteger(length))throw new RangeError('Снимок наложения слишком велик.');
    return {width,height,stride,bits:new Uint32Array(length),present:new Uint32Array(length)};
  }
  function maskRange(first,last){
    return (0xffffffff<<first)&(last===32?0xffffffff:0xffffffff>>>(32-last));
  }
  function putRange(plane,base,first,last){
    if(last<=first)return;
    const a=Math.floor(first/32),z=Math.floor((last-1)/32);
    if(a===z){plane[base+a]|=maskRange(first&31,(last-1&31)+1);return;}
    plane[base+a]|=0xffffffff<<(first&31);
    for(let word=a+1;word<z;word++)plane[base+word]=0xffffffff;
    plane[base+z]|=maskRange(0,(last-1&31)+1);
  }
  function rowClip(snapshot,row,first,last){
    const {width,stride,bits,present}=snapshot,base=row*stride;
    first=Math.max(0,Math.min(width,first));last=Math.max(first,Math.min(width,last));
    for(let word=0;word<stride;word++){
      const lo=Math.max(0,first-word*32),hi=Math.min(32,last-word*32),mask=hi>lo?maskRange(lo,hi):0;
      present[base+word]&=mask;bits[base+word]&=present[base+word];
    }
  }
  function clipLimits(options,row,area){
    const sourceRow=area.y+row,lo=options.rowLo?.length?options.rowLo[sourceRow]:area.x,hi=options.rowHi?.length?options.rowHi[sourceRow]:area.x+area.width-1;
    if(!Number.isFinite(lo)||!Number.isFinite(hi))throw new RangeError('Неполные границы строк наложения.');
    return {first:Math.max(0,lo-area.x),last:Math.min(area.width,hi-area.x+1)};
  }
  function crop(snapshot,area,options){
    const {width,height,stride,bits,present}=snapshot||{},x=snapshot?.x??0,y=snapshot?.y??0;
    if(!Number.isSafeInteger(width)||width<1||!Number.isSafeInteger(height)||height<1||!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||
      !(bits instanceof Uint32Array)||!(present instanceof Uint32Array)||!Number.isSafeInteger(stride)||stride<Math.ceil(width/32)||
      bits.length<stride*height||present.length<stride*height||area.x<x||area.y<y||area.x+area.width>x+width||area.y+area.height>y+height)
      throw new RangeError('GPU-снимок не покрывает область наложения.');
    const out=packed(area.width,area.height),offset=area.x-x,startWord=Math.floor(offset/32),shift=offset&31;
    for(let row=0;row<out.height;row++){
      const from=(area.y-y+row)*stride+startWord,to=row*out.stride;
      for(let word=0;word<out.stride;word++){
        let b=bits[from+word]>>>shift,p=present[from+word]>>>shift;
        if(shift){b|=(bits[from+word+1]||0)<<(32-shift);p|=(present[from+word+1]||0)<<(32-shift);}
        out.present[to+word]=p;out.bits[to+word]=(options.invertBits?~b:b)&p;
      }
      const limits=clipLimits(options,row,area);rowClip(out,row,limits.first,limits.last);
    }
    return out;
  }
  function luminance(colour){return .2126*(colour&255)+.7152*(colour>>>8&255)+.0722*(colour>>>16&255);}
  function rasterCapture(area,options){
    const {raster,cell,fieldLeft,fieldTop,sourceX=0}=options,rect=rectangle(raster?.rect);
    const pw=integer(raster.width,'ширина растра',1),ph=integer(raster.height,'высота растра',1),data=raster.data;
    if(!Number.isFinite(fieldLeft)||!Number.isFinite(fieldTop))throw new RangeError('Нет положения поля в захваченном растре.');
    if(!data||data.length<pw*ph*4||!Number.isFinite(raster.zero)||!Number.isFinite(raster.one))throw new RangeError('Нет пикселей или палитры захваченного наложения.');
    const out=packed(area.width,area.height),sx=pw/rect.width,sy=ph/rect.height,step=cell*sx;
    const startX=(fieldLeft+(area.x-sourceX+.5)*cell-rect.left)*sx;
    const mid=(luminance(raster.zero)+luminance(raster.one))/2,empty=Math.min(luminance(raster.zero),luminance(raster.one))*.45;
    let previousPixelRow=-Infinity,previousLo=-Infinity,previousHi=-Infinity;
    for(let row=0;row<out.height;row++){
      const py=Math.floor((fieldTop+(area.y+row+.5)*cell-rect.top)*sy),base=row*out.stride,limits=clipLimits(options,row,area);
      if(py<0||py>=ph)continue;
      if(row&&py===previousPixelRow&&limits.first===previousLo&&limits.last===previousHi){
        out.bits.copyWithin(base,base-out.stride,base);out.present.copyWithin(base,base-out.stride,base);continue;
      }
      for(let col=0;col<out.width;){
        const px=Math.floor(startX+col*step);
        // Expand one captured raster pixel to precisely the logical centres
        // that sampled it. No dense native-resolution colour raster exists.
        let next=Math.min(out.width,Math.max(col+1,Math.ceil((px+1-startX)/step)));
        // Match direct floor sampling even at floating-point pixel boundaries.
        while(next>col+1&&Math.floor(startX+(next-1)*step)!==px)next--;
        while(next<out.width&&Math.floor(startX+next*step)===px)next++;
        if(px>=0&&px<pw){
          const q=(py*pw+px)*4,L=.2126*data[q]+.7152*data[q+1]+.0722*data[q+2];
          if(data[q+3]&&L>=empty){putRange(out.present,base,col,next);if(L>=mid)putRange(out.bits,base,col,next);}
        }
        col=next;
      }
      rowClip(out,row,limits.first,limits.last);
      previousPixelRow=py;previousLo=limits.first;previousHi=limits.last;
    }
    return out;
  }
  function read(grid,row,col){
    if(row<0||col<0||row>=grid.H||col>=grid.W)return -1;
    if(grid.val)return grid.val[row*grid.W+col];
    const snapshot=grid.packedSnapshot,q=row*snapshot.stride+Math.floor(col/32),shift=col&31;
    return (snapshot.present[q]>>>shift&1)?snapshot.bits[q]>>>shift&1:-1;
  }
  function popcount(word){word-=(word>>>1)&0x55555555;word=(word&0x33333333)+((word>>>2)&0x33333333);return (((word+(word>>>4))&0x0f0f0f0f)*0x01010101)>>>24;}
  function counts(snapshot){
    let n1=0,n0=0;for(let q=0;q<snapshot.present.length;q++){const p=snapshot.present[q],one=popcount(snapshot.bits[q]&p);n1+=one;n0+=popcount(p)-one;}
    return {n1,n0,ne:snapshot.width*snapshot.height-n1-n0};
  }
  function dense(snapshot,limit=DEFAULT_DENSE_LIMIT){
    const n=snapshot.width*snapshot.height;if(n>limit)return null;
    const val=new Int8Array(n).fill(-1);
    for(let row=0;row<snapshot.height;row++)for(let word=0;word<snapshot.stride;word++){
      const q=row*snapshot.stride+word;let p=snapshot.present[q]>>>0;
      while(p){const shift=31-Math.clz32((p&-p)>>>0),col=word*32+shift;if(col<snapshot.width)val[row*snapshot.width+col]=snapshot.bits[q]>>>shift&1;p=(p&(p-1))>>>0;}
    }
    return val;
  }
  /**
   * regionSnapshot: readPackedRegion result, covering region (32-bit aligned
   * source x is fine). anchor and meetingPoints use absolute source coords.
   * sourceX=VX; sourceWidth=VW; sourceHeight=VH. Pixel rectangles use CSS.
   * Below one CSS pixel/cell raster is REQUIRED; raster values already encode
   * visible inversion, so invertBits is only used for exact packed capture.
   * rowLo/rowHi are optional inclusive bounds indexed by absolute source row.
   */
  function capture(options){
    const {region:area,anchor,frame,sourceX=0,sourceWidth,sourceHeight,cell}=options;
    if(!area)return null;
    integer(area.x,'столбец снимка');integer(area.y,'строка снимка');integer(area.width,'ширина снимка',1);integer(area.height,'высота снимка',1);
    integer(sourceX,'начальный столбец');integer(sourceWidth,'ширина исходника',1);integer(sourceHeight,'высота исходника',1);
    if(!Number.isFinite(anchor)||!Number.isFinite(cell)||cell<=0)throw new RangeError('Нет геометрии наложения.');
    if(area.x<sourceX||area.x+area.width>sourceX+sourceWidth||area.y+area.height>sourceHeight)throw new RangeError('Область наложения выходит за исходное поле.');
    if(cell<1&&!options.raster)throw new Error('Для уменьшенного наложения нужен растр именно захваченного viewport.');
    const snapshot=cell<1?rasterCapture(area,options):crop(options.regionSnapshot,area,options);
    const grid={W:area.width,H:area.height,anchor:anchor-area.x,frame,stride:2,packed:true,packedSnapshot:snapshot,
      offsetX:area.x-sourceX,offsetY:area.y,sourceX,sourceWidth,sourceHeight,
      sampling:cell<1?'visible-raster':'exact-cells',counts:counts(snapshot),
      meetingPoints:(options.meetingPoints||[]).map(point=>({x:point.x-area.x,y:point.y-area.y}))};
    const val=dense(snapshot,options.maxDenseCells??DEFAULT_DENSE_LIMIT);if(val)grid.val=val;
    return grid;
  }
  function intervalMask(wordColumn,left,right){
    const first=Math.max(0,left-wordColumn),last=Math.min(32,right-wordColumn+1);
    return last>first?maskRange(first,last)>>>0:0;
  }
  function checkRegion(snapshot,area){
    if(!snapshot||!Number.isSafeInteger(snapshot.x)||!Number.isSafeInteger(snapshot.y)||!Number.isSafeInteger(snapshot.width)||!Number.isSafeInteger(snapshot.height)||
      !Number.isSafeInteger(snapshot.stride)||snapshot.stride<Math.ceil(snapshot.width/32)||
      !(snapshot.bits instanceof Uint32Array)||!(snapshot.present instanceof Uint32Array)||
      snapshot.bits.length<snapshot.stride*snapshot.height||snapshot.present.length<snapshot.stride*snapshot.height||
      snapshot.x>area.x||snapshot.y>area.y||snapshot.x+snapshot.width<area.x+area.width||snapshot.y+snapshot.height<area.y+area.height)
      throw new RangeError('Неполная полоса GPU для блочного наложения.');
    return snapshot;
  }
  /**
   * Exact q×q unanimity reduction. readRegion(rect,current) returns the GPU
   * packed region, with its absolute x/y (x may be aligned down to 32).
   * sourceHeight must be divisible by q; trailing source columns are dropped.
   * withoutBands: 0/off, 1/noise bounds, 2/noise bounds + parity triangles.
   * Noise bounds inspect fieldWidth, not merely the visible source window.
   * background follows bgNoise: '0' means ones, 'chess' means parity bits,
   * all other backgrounds mean zeros. occupiedBounds uses present cells.
   * Supplied nonempty rowLo/rowHi are inclusive absolute-source bounds;
   * triangleSides may likewise supply [[leftPlusRow,rightMinusRow],...].
   * Inversion changes the result value, not unanimity or raw noise bounds.
   * Returns null on cancellation; never publishes a partially reduced grid.
   */
  async function reduce(options){
    const {q,sourceX=0,sourceWidth,sourceHeight,anchor,frame,readRegion}=options;
    integer(q,'размер блока',2);integer(sourceX,'начальный столбец');integer(sourceWidth,'ширина исходника',1);integer(sourceHeight,'высота исходника',1);
    if(sourceHeight%q||sourceWidth<q)throw new RangeError('Размер блока должен делить высоту и помещаться по ширине наложения.');
    if(!Number.isSafeInteger(sourceX+sourceWidth)||!Number.isFinite(anchor)||typeof readRegion!=='function')throw new RangeError('Нет геометрии или чтения GPU для уменьшения.');
    const current=typeof options.current==='function'?options.current:()=>true;
    if(!current())return null;
    const mode=options.withoutBands===true?1:Number(options.withoutBands)||0;
    if(![0,1,2].includes(mode))throw new RangeError('Неизвестный режим «Без полос».');
    const supplied=!!(options.rowLo?.length||options.rowHi?.length);
    if(supplied&&(!options.rowLo||!options.rowHi||options.rowLo.length<sourceHeight||options.rowHi.length<sourceHeight))throw new RangeError('Неполные границы строк уменьшения.');
    const fieldWidth=options.fieldWidth??sourceX+sourceWidth;
    integer(fieldWidth,'полная ширина исходника',1);
    if(fieldWidth<sourceX+sourceWidth)throw new RangeError('Окно уменьшения выходит за исходное поле.');
    if(mode&&!supplied&&options.fieldWidth==null)throw new RangeError('Для точных границ «Без полос» нужна полная fieldWidth.');
    const byteBudget=Number.isFinite(options.stripBytes)&&options.stripBytes>0?options.stripBytes:8*1048576;
    const stripeRows=width=>Math.min(sourceHeight,Math.max(q,Math.floor(byteBudget/((Math.ceil(width/32)+1)*8)/q)*q));
    const notify=(phase,done)=>options.onProgress?.({phase,done,total:sourceHeight});
    let lastYield=Date.now();
    async function yieldIfNeeded(){if(Date.now()-lastYield>=16){await new Promise(resolve=>setTimeout(resolve,0));lastYield=Date.now();}return current();}
    async function readStripe(x,y,width,height){
      if(!current())return null;
      const area={x,y,width,height},snapshot=await readRegion(area,current);
      if(!current()||!snapshot)return null;
      return checkRegion(snapshot,area);
    }
    let bounds=supplied?{lo:Float64Array.from(options.rowLo).subarray(0,sourceHeight),hi:Float64Array.from(options.rowHi).subarray(0,sourceHeight)}:null;
    if(bounds)for(let r=0;r<sourceHeight;r++)if(!Number.isFinite(bounds.lo[r])||!Number.isFinite(bounds.hi[r]))throw new RangeError('Некорректная граница строки уменьшения.');

    if(mode&&!supplied){
      const lo=new Float64Array(sourceHeight).fill(-1),hi=new Float64Array(sourceHeight).fill(-1),rows=stripeRows(fieldWidth);
      let first=-1;
      for(let y=0;y<sourceHeight;y+=rows){
        const height=Math.min(rows,sourceHeight-y),snapshot=await readStripe(0,y,fieldWidth,height);if(!snapshot)return null;
        const lastWord=Math.floor((fieldWidth-1-snapshot.x)/32);
        for(let r=y;r<y+height;r++){
          const base=(r-snapshot.y)*snapshot.stride;
          function candidates(word){
            const col=snapshot.x+word*32,p=snapshot.present[base+word]&intervalMask(col,0,fieldWidth-1),b=snapshot.bits[base+word];
            if(options.occupiedBounds)return p>>>0;
            if(options.background==='0')return (p&b)>>>0;
            if(options.background==='chess'){
              const ones=((col-anchor-r)&1)?0x55555555:0xaaaaaaaa;
              return (p&~(b^ones))>>>0;
            }
            return (p&~b)>>>0;
          }
          for(let word=0;word<=lastWord;word++){
            const value=candidates(word);if(!value)continue;
            lo[r]=snapshot.x+word*32+31-Math.clz32((value&-value)>>>0);if(first<0)first=r;break;
          }
          if(lo[r]<0)continue;
          for(let word=lastWord;word>=0;word--){const value=candidates(word);if(value){hi[r]=snapshot.x+word*32+31-Math.clz32(value);break;}}
        }
        notify('overlay-bounds',y+height);if(!await yieldIfNeeded())return null;
      }
      if(first>=0){
        if(!options.occupiedBounds)for(let r=0;r<sourceHeight;r++)if(lo[r]<0){const from=r<first?first:r-1;lo[r]=lo[from];hi[r]=hi[from];}
        bounds={lo,hi};
      }
      // zoneCalc with no noise has empty ZL/ZR: the entire field remains
      // eligible. An all-empty occupied field will fail presence below.
    }

    let sides=null;
    if(mode===2&&bounds&&!options.occupiedBounds){
      if(options.triangleSides){
        if(!Array.isArray(options.triangleSides)||options.triangleSides.length!==2||options.triangleSides.some(pair=>!Array.isArray(pair)||pair.length!==2))throw new RangeError('Некорректные стороны треугольников.');
        sides=options.triangleSides.map(pair=>pair.slice());
      }else{
        sides=[[Infinity,-Infinity],[Infinity,-Infinity]];const rows=stripeRows(fieldWidth);
        for(let y=0;y<sourceHeight;y+=rows){
          const height=Math.min(rows,sourceHeight-y),snapshot=await readStripe(0,y,fieldWidth,height);if(!snapshot)return null;
          for(let r=y;r<y+height;r++){
            const left=Math.max(0,bounds.lo[r]),right=Math.min(fieldWidth-1,bounds.hi[r]);if(right<left)continue;
            const base=(r-snapshot.y)*snapshot.stride;
            for(let word=Math.floor((left-snapshot.x)/32),last=Math.floor((right-snapshot.x)/32);word<=last;word++){
              const col=snapshot.x+word*32,mask=snapshot.present[base+word]&intervalMask(col,left,right),firstParity=(col-anchor-r)&1;
              for(let p=0;p<2;p++){
                const visible=(mask&(firstParity===p?0x55555555:0xaaaaaaaa))>>>0;if(!visible)continue;
                const firstCol=col+31-Math.clz32((visible&-visible)>>>0),lastCol=col+31-Math.clz32(visible);
                sides[p][0]=Math.min(sides[p][0],firstCol+r);sides[p][1]=Math.max(sides[p][1],lastCol-r);
              }
            }
          }
          notify('overlay-sides',y+height);if(!await yieldIfNeeded())return null;
        }
      }
    }
    function allowedMask(row,col){
      if(!bounds)return 0xffffffff;
      let allowed=intervalMask(col,bounds.lo[row],bounds.hi[row]);
      if(sides)for(let p=0;p<2;p++)if(Number.isFinite(sides[p][0])&&Number.isFinite(sides[p][1])){
        const triangle=intervalMask(col,sides[p][0]-row,sides[p][1]+row),parity=(col-anchor-row)&1;
        allowed|=triangle&(parity===p?0x55555555:0xaaaaaaaa);
      }
      return allowed>>>0;
    }

    const W=Math.floor(sourceWidth/q),H=sourceHeight/q,snapshot=packed(W,H),sourceUsed=W*q,rows=stripeRows(sourceUsed);
    let n0=0,n1=0;
    for(let y=0;y<sourceHeight;y+=rows){
      const height=Math.min(rows,sourceHeight-y),source=await readStripe(sourceX,y,sourceUsed,height);if(!source)return null;
      for(let blockY=0;blockY<height;blockY+=q){
        const outputRow=(y+blockY)/q;
        for(let blockX=0;blockX<W;blockX++){
          const left=sourceX+blockX*q,right=left+q-1,firstWord=Math.floor((left-source.x)/32),lastWord=Math.floor((right-source.x)/32);
          const firstIndex=(y+blockY-source.y)*source.stride+firstWord,firstShift=(left-source.x)&31;
          if(!(source.present[firstIndex]>>>firstShift&1))continue;
          const value=source.bits[firstIndex]>>>firstShift&1;let uniform=true;
          for(let dy=0;dy<q&&uniform;dy++){
            const row=y+blockY+dy,base=(row-source.y)*source.stride;
            for(let word=firstWord;word<=lastWord;word++){
              const col=source.x+word*32,mask=intervalMask(col,left,right),p=source.present[base+word],b=source.bits[base+word];
              if(((p&mask)>>>0)!==mask||((allowedMask(row,col)&mask)>>>0)!==mask||((b&mask)>>>0)!==(value?mask:0)){uniform=false;break;}
            }
          }
          if(!uniform)continue;
          const at=outputRow*snapshot.stride+Math.floor(blockX/32),bit=1<<(blockX&31),outValue=value^(options.invertBits?1:0);
          snapshot.present[at]|=bit;if(outValue){snapshot.bits[at]|=bit;n1++;}else n0++;
        }
        if(!await yieldIfNeeded())return null;
      }
      notify('overlay-reduce',y+height);
    }
    if(!current())return null;
    const anchorRaw=anchor-sourceX,grid={W,H,anchor:Math.floor(anchorRaw/q),anchorRaw,frame,q,stride:1,packed:true,packedSnapshot:snapshot,
      offsetX:0,offsetY:0,sourceX,sourceWidth,sourceHeight,sampling:'block-unanimity',counts:{n1,n0,ne:W*H-n1-n0},
      meetingPoints:(options.meetingPoints||[]).map(point=>({x:(point.x-sourceX+.5)/q-.5,y:(point.y+.5)/q-.5}))};
    const val=dense(snapshot,options.maxDenseCells??DEFAULT_DENSE_LIMIT);if(val)grid.val=val;
    return current()?grid:null;
  }
  function cloneSnapshot(grid){
    const s=grid.packedSnapshot;return {width:s.width,height:s.height,stride:s.stride,bits:s.bits.slice(),present:s.present.slice()};
  }
  function searchOptions(grid,options={}){
    return {...options,overlayGrid:true,latticeStride:grid.stride||2,anchor:grid.anchor,parity:-1,meetingPoints:grid.meetingPoints,
      bounds:{x:0,y:0,width:grid.W,height:grid.H},rowLo:null,rowHi:null,withoutBands:false,invertBits:false};
  }
  return {region,capture,reduce,read,counts,dense,cloneSnapshot,searchOptions};
});
