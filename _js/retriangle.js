/* Reflow a bit tape; never evolve, invert, repeat or pad its values. */
(function(root){
  'use strict';
  function pack(input,options={}){
    const step=options.step===1?1:2,maxCells=options.maxCells??16777216;
    if(!Number.isSafeInteger(maxCells)||maxCells<1)throw RangeError('Некорректный предел числа битов');
    let values;
    if(input?.[Symbol.iterator])values=input;
    else if(Number.isSafeInteger(input?.length)&&input.length>=0)values=(function*(){for(let i=0;i<input.length;i++)yield input[i];})();
    else throw TypeError('Нужна последовательность битов');
    const rows=[];let current=new Uint8Array(1),filled=0,count=0;
    for(const value of values){
      if(value!==0&&value!==1)continue;
      if(count===maxCells)throw RangeError('Слишком много битов для перестройки');
      current[filled++]=value;count++;
      if(filled===current.length){rows.push(current);current=new Uint8Array(current.length+step);filled=0;}
    }
    if(filled)rows.push(current.slice(0,filled));
    const height=rows.length,width=height?1+(height-1)*step:0,capacity=height*(2+(height-1)*step)/2;
    return {rows,count,height,width,capacity,incomplete:count<capacity,lastLength:height?rows.at(-1).length:0,step};
  }
  const api={pack};if(typeof module==='object'&&module.exports)module.exports=api;else root.ZerkRetriangle=api;
})(typeof globalThis!=='undefined'?globalThis:this);
