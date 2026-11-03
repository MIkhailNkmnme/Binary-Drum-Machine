/* A score keeps one entry per shown cell and one step per shown row. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.MayatnikXorromField=factory();
})(globalThis,function(){
  'use strict';
  const MAX_CELLS=16*1024*1024,MAX_ROWS=16384;
  const yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0));
  function colourCode(left,centre,right){
    return 4*centre+(left===1?2:0)+(right===1?1:0);
  }

  // readBit returns -1 for a missing cell. In RGB view readRGB returns the
  // categorical colour before the black/white display palette, or -1 if hidden.
  async function capture(source,options={}){
    const {width,height,readBit,readRGB,readRed,current}=source;
    if(!Number.isSafeInteger(width)||width<1||!Number.isSafeInteger(height)||height<1||typeof readBit!=='function')
      throw Error('Хорром: нет прямоугольного поля для чтения.');
    if(height>MAX_ROWS||width*height>MAX_CELLS)
      throw RangeError('Хорром: снимок превышает 16 777 216 клеток или 16 384 строки. Уменьшите показ поля.');
    const check=()=>{
      if(options.cancelled?.()||current&&!current()){
        const error=Error('Чтение Хоррома отменено или показанное поле изменилось.');
        error.name='AbortError';throw error;
      }
    };
    const rows=[],pause=options.yieldTask||yieldTask;
    let cellsSinceYield=0;
    check();
    for(let y=0;y<height;y++){
      const bits=new Int8Array(width),colors=new Uint32Array(8),rgb=readRGB&&options.cellRGB?new Int8Array(width).fill(-1):null;
      const red=readRed?new Uint8Array(width):null;let ones=0,total=0;
      for(let x=0;x<width;x++){
        if(cellsSinceYield===32768){await pause();check();cellsSinceYield=0;}
        cellsSinceYield++;
        let bit=readBit(x,y);
        if(bit!==-1&&bit!==0&&bit!==1)throw Error('Хорром: неизвестное значение бита.');
        if(readRGB&&bit>=0){
          const code=readRGB(x,y);
          if(code===-1||code===255)bit=-1;
          else if(Number.isInteger(code)&&code>=0&&code<8){colors[code]++;if(rgb)rgb[x]=code;}
          else throw Error('Хорром: неизвестный цвет RGB-соседей.');
        }
        bits[x]=bit;if(red&&bit>=0)red[x]=+!!readRed(x,y);
        // The current bit completes the RGB triplet for the preceding cell.
        if(!readRGB&&bits[x-1]>=0)colors[colourCode(bits[x-2],bits[x-1],bit)]++;
        if(bit>=0){ones+=bit;total++;}
      }
      if(!readRGB&&bits[width-1]>=0)colors[colourCode(bits[width-2],bits[width-1],0)]++;
      rows.push({bits,ones,total,colors,...(rgb?{rgb}:{}),...(red?{red}:{})});
    }
    check();
    return {width,height,rows};
  }
  return {capture,MAX_CELLS,MAX_ROWS};
});
