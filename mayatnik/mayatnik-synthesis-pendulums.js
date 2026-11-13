/* Two exact pendulums, independent of the UI and its redraw clock.
 * -1 is absent, never a zero bit. XOR/OR use the union of supports (an absent
 * operand contributes 0); AND intersects supports. Mask retains A only where
 * B is 1; subtraction retains A's support, clearing its ones where B is 1.
 * A/B return the chosen operand verbatim. Inversion never fills empty cells.
 * Each generated cycle has 128 frames. Frame 0 is the initial anchor cone;
 * frame k adds vertices 1..k using the original core, including simultaneous
 * conePair. Full support is computed BEFORE cropping to the requested field.
 * B is reflected about canvas axes, then shifted. Source and memory do not
 * animate. Rates/phase affect generated sources only. Public arrays are
 * read-only views; snapshots own copies and are safe to JSON serialize.
 * History includes the current frame exactly once: updateSource replaces it,
 * step commits it. Accumulation XORs frames, including a repeated slow frame.
 * Feedback reads the previous clocked output, initially the captured source.
 * delayB delays raw B before reflection/translation/inversion. Its first raw
 * frame is held until the delay fills; only step advances the delay queue.
 * Retained snapshot arrays are limited to 20 Mi cells (under 64 MiB JSON).
 */
(function(root,factory){
  const core=typeof module==='object'&&module.exports?require('./mayatnik-core.js'):
    (typeof MAYATNIK!=='undefined'?MAYATNIK:root.MAYATNIK);
  const api=factory(core);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.MayatnikSynthesisPendulums=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(core){
  'use strict';
  const CYCLE=128;
  const defaults=Object.freeze({sourceA:'pend',sourceB:'pendR',depth:64,rateA:1,rateB:1,
    phaseB:0,delayB:0,transformB:'identity',shiftX:0,shiftY:0,invertB:false,operation:'xor',history:'none',trailLength:8});
  const choices={sourceA:['source','memory','feedback','pend','pendR','left','right','pair','cone'],
    sourceB:['source','memory','feedback','pend','pendR','left','right','pair','cone'],depth:[16,32,64,128],
    rateA:[0,.5,1,1.5,2,3],rateB:[0,.5,1,1.5,2,3],
    transformB:['identity','mirrorX','mirrorY','rotate180'],
    operation:['xor','and','or','subtract','mask','a','b'],history:['none','trail','accumulate']};
  function integer(value,lo,hi,label){
    if(!Number.isSafeInteger(value)||value<lo||value>hi)throw new Error('Invalid '+label);
    return value;
  }
  function optionsFor(patch={},base=defaults){
    if(!patch||typeof patch!=='object'||Array.isArray(patch))throw new Error('Invalid options');
    const next={...base};
    for(const [key,value] of Object.entries(patch)){
      if(!Object.prototype.hasOwnProperty.call(defaults,key))throw new Error('Unknown option '+key);
      if(choices[key]){if(!choices[key].includes(value))throw new Error('Invalid '+key);}
      else if(key==='invertB'){if(typeof value!=='boolean')throw new Error('Invalid invertB');}
      else if(key==='phaseB')integer(value,0,127,key);
      else if(key==='delayB')integer(value,0,16,key);
      else if(key==='trailLength')integer(value,1,64,key);
      else integer(value,-128,128,key);
      next[key]=value;
    }
    return Object.freeze(next);
  }
  function checkBudget(options,n){
    const frames=6+options.delayB+(options.history==='trail'?options.trailLength-1:0);
    if(n*frames>20*1024*1024)throw new Error('History memory limit: reduce trail length or B delay');
  }
  function bitsFor(value,n,label){
    if(!(Array.isArray(value)||ArrayBuffer.isView(value))||value.length!==n)throw new Error('Invalid '+label+' dimensions');
    const result=new Int8Array(n);
    for(let i=0;i<n;i++){
      if(value[i]!==-1&&value[i]!==0&&value[i]!==1)throw new Error('Invalid '+label+' bit');
      result[i]=value[i];
    }
    return result;
  }
  function combine(a,b,operation){
    const out=new Int8Array(a.length).fill(-1);
    for(let i=0;i<out.length;i++){
      const x=a[i],y=b[i];
      if(operation==='a')out[i]=x;
      else if(operation==='b')out[i]=y;
      else if(operation==='mask')out[i]=y===1?x:-1;
      else if(operation==='subtract')out[i]=x<0?-1:Number(x===1&&y!==1);
      else if(operation==='and')out[i]=x<0||y<0?-1:x&y;
      else if(x>=0||y>=0)out[i]=operation==='xor'?Number((x===1)!==(y===1)):Number(x===1||y===1);
    }
    return out;
  }
  function create(config){
    if(!core||typeof core.conePair!=='function')throw new Error('Mayatnik core is required');
    if(!config||typeof config!=='object')throw new Error('Invalid configuration');
    const width=integer(config.width,1,2048,'width'),height=integer(config.height,1,512,'height'),n=width*height;
    const anchor=integer(config.anchor===undefined?Math.floor(width/2):config.anchor,0,width-1,'anchor');
    let options=optionsFor(config.options||{}),tick=0;
    checkBudget(options,n);
    let source=config.sourceBits===undefined?new Int8Array(n).fill(-1):bitsFor(config.sourceBits,n,'source');
    let memory=source.slice(),feedback=source.slice(),prefix=new Int8Array(n).fill(-1),trail=[];
    let delaySeed=null,delayQueue=[],rawB;
    let a,b,result,output,changed=new Uint8Array(n),age=new Uint16Array(n),stats;
    const cache=new Map();
    function generated(mode,frame,slot){
      // Separate cursors let two copies of the same mode run at different
      // rates/phases without repeatedly rewinding each other's builder.
      const depth=Math.min(options.depth,height),key=slot+':'+mode+':'+depth;
      if(mode==='cone')frame=0;
      let item=cache.get(key);
      if(!item||item.frame>frame){
        // The maximum displacement of pair/left/right is 127, so no cone can
        // touch this boundary before its last row. Cropping cannot feed back.
        const pad=depth-1+CYCLE-1,W=pad*2+1;
        item={field:core.field(W,depth,'empty'),anchor:pad,frame:0};
        core.cone(item.field,pad,depth);
        cache.set(key,item);
      }
      for(let k=item.frame+1;k<=frame;k++){
        if(mode==='pair')core.conePair(item.field,item.anchor-k,item.anchor+k,depth);
        else core.cone(item.field,item.anchor+core.offset(mode,k),depth);
      }
      item.frame=frame;
      const out=new Int8Array(n).fill(-1),{W,val}=item.field;
      for(let y=0;y<depth;y++)for(let x=0;x<width;x++){
        const sx=x-anchor+item.anchor;
        if(sx>=0&&sx<W)out[y*width+x]=val[y*W+sx];
      }
      return out;
    }
    function operand(which){
      const mode=options['source'+which];
      if(mode==='source')return source.slice();
      if(mode==='memory')return memory.slice();
      if(mode==='feedback')return feedback.slice();
      // Half-integer speeds are exact in binary arithmetic; reduce tick
      // before multiplication so even very long sessions keep exact phase.
      const frame=Math.floor((tick%(CYCLE*2))*options['rate'+which]+(which==='B'?options.phaseB:0))%CYCLE;
      return generated(mode,frame,which);
    }
    function transformed(input){
      const out=new Int8Array(n).fill(-1),t=options.transformB;
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){
        const v=input[y*width+x];if(v<0)continue;
        const dx=(t==='mirrorX'||t==='rotate180'?width-1-x:x)+options.shiftX;
        const dy=(t==='mirrorY'||t==='rotate180'?height-1-y:y)+options.shiftY;
        if(dx>=0&&dx<width&&dy>=0&&dy<height)out[dy*width+dx]=options.invertB?1-v:v;
      }
      return out;
    }
    function render(){
      const before=output;
      a=operand('A');rawB=operand('B');
      if(!delaySeed)delaySeed=rawB.slice();
      const delayed=options.delayB?(delayQueue.length>=options.delayB?delayQueue[delayQueue.length-options.delayB]:delaySeed):rawB;
      b=transformed(delayed);result=combine(a,b,options.operation);
      age=new Uint16Array(n);
      if(options.history==='accumulate')output=combine(prefix,result,'xor');
      else if(options.history==='trail'){
        output=result.slice();
        // The oldest retained 1 has the greatest age. More recent hits win.
        for(let k=0;k<trail.length;k++)for(let i=0;i<n;i++)if(trail[k][i]===1){output[i]=1;age[i]=trail.length-k;}
        for(let i=0;i<n;i++)if(result[i]===1)age[i]=0;
      }else output=result.slice();
      changed=new Uint8Array(n);
      let ones=0,zeros=0,changes=0,aOnes=0,bOnes=0;
      for(let i=0;i<n;i++){
        if(output[i]===1)ones++;else if(output[i]===0)zeros++;
        if(a[i]===1)aOnes++;if(b[i]===1)bOnes++;
        if(before?before[i]!==output[i]:output[i]!==-1){changed[i]=1;changes++;}
      }
      stats=Object.freeze({tick,ones,zeros,empty:n-ones-zeros,changed:changes,aOnes,bOnes});
    }
    function clearHistory(){tick=0;prefix=new Int8Array(n).fill(-1);trail=[];feedback=source.slice();delaySeed=null;delayQueue=[];cache.clear();}
    const api={
      get width(){return width;},get height(){return height;},get anchor(){return anchor;},get options(){return options;},
      get tick(){return tick;},get a(){return a;},get b(){return b;},get result(){return result;},get output(){return output;},
      get changed(){return changed;},get age(){return age;},get stats(){return stats;},
      reset(bits){const next=bits===undefined?source:bitsFor(bits,n,'source');source=next;clearHistory();render();return api;},
      step(bits){
        const next=bits===undefined?source:bitsFor(bits,n,'source');
        integer(tick+1,0,Number.MAX_SAFE_INTEGER,'tick');
        feedback=output.slice();
        if(options.delayB){
          delayQueue.push(rawB);
          if(delayQueue.length>options.delayB)delayQueue.shift();
        }
        if(options.history==='accumulate')prefix=combine(prefix,result,'xor');
        if(options.history==='trail'){
          trail.push(result.slice());
          if(trail.length>=options.trailLength)trail.shift();
        }
        source=next;tick++;render();return api;
      },
      updateSource(bits){source=bitsFor(bits,n,'source');render();return api;},
      configure(patch){const next=optionsFor(patch,options);checkBudget(next,n);options=next;clearHistory();render();return api;},
      setMemory(bits){memory=bitsFor(bits===undefined?source:bits,n,'memory');render();return api;},
      snapshot(){return {version:1,width,height,anchor,options:{...options},tick,source:Array.from(source),memory:Array.from(memory),
        prefix:Array.from(prefix),trail:trail.map(frame=>Array.from(frame)),changed:Array.from(changed),
        feedback:Array.from(feedback),delaySeed:Array.from(delaySeed),delayQueue:delayQueue.map(frame=>Array.from(frame))};},
      restore(saved){
        // Validate and construct a complete candidate before touching this engine.
        if(!saved||saved.version!==1||saved.width!==width||saved.height!==height||saved.anchor!==anchor)throw new Error('Incompatible pendulum snapshot');
        const nextOptions=optionsFor(saved.options),nextTick=integer(saved.tick,0,Number.MAX_SAFE_INTEGER,'tick');
        checkBudget(nextOptions,n);
        for(const key of Object.keys(defaults))if(!Object.prototype.hasOwnProperty.call(saved.options,key))throw new Error('Incomplete snapshot options');
        const nextSource=bitsFor(saved.source,n,'source'),nextMemory=bitsFor(saved.memory,n,'memory'),nextPrefix=bitsFor(saved.prefix,n,'prefix');
        const nextFeedback=bitsFor(saved.feedback,n,'feedback'),nextDelaySeed=bitsFor(saved.delaySeed,n,'delay seed');
        if(!Array.isArray(saved.delayQueue)||saved.delayQueue.length!==Math.min(nextTick,nextOptions.delayB))throw new Error('Invalid delay queue');
        const nextDelayQueue=saved.delayQueue.map(frame=>bitsFor(frame,n,'delay queue'));
        if(!Array.isArray(saved.trail)||saved.trail.length>Math.min(nextTick,nextOptions.trailLength-1)||
          (nextOptions.history!=='trail'&&saved.trail.length))throw new Error('Invalid trail');
        const nextTrail=saved.trail.map(frame=>bitsFor(frame,n,'trail'));
        const nextChanged=bitsFor(saved.changed,n,'changed');
        if(nextChanged.some(value=>value<0))throw new Error('Invalid changed');
        if(nextOptions.history!=='accumulate'&&nextPrefix.some(value=>value!==-1))throw new Error('Invalid prefix');
        options=nextOptions;tick=nextTick;source=nextSource;memory=nextMemory;prefix=nextPrefix;trail=nextTrail;
        feedback=nextFeedback;delaySeed=nextDelaySeed;delayQueue=nextDelayQueue;cache.clear();render();
        changed=Uint8Array.from(nextChanged);stats=Object.freeze({...stats,changed:changed.reduce((sum,value)=>sum+value,0)});
        return api;
      }
    };
    render();return api;
  }
  const recipes=Object.freeze([
    {id:'duet',name:'Зеркальный дуэт',description:'Маятники начинают в разные стороны; XOR проявляет различия.',options:{sourceA:'pend',sourceB:'pendR',operation:'xor'}},
    {id:'counter',name:'Встречное движение',description:'Два точных ряда вершин расходятся от общего якоря.',options:{sourceA:'left',sourceB:'right',operation:'or'}},
    {id:'canon',name:'Фазовый канон',description:'Второй маятник опережает первый на 16 шагов.',options:{sourceA:'pend',sourceB:'pend',phaseB:16,operation:'xor'}},
    {id:'polyrhythm',name:'Полиритм 2:3',description:'Независимые темпы двух маятников.',options:{sourceA:'pend',sourceB:'pendR',rateA:2,rateB:3,operation:'xor'}},
    {id:'mask',name:'Живая маска',description:'Единицы пары вершин пропускают клетки исходного поля.',options:{sourceA:'source',sourceB:'pair',operation:'mask'}},
    {id:'weave',name:'Переплетение',description:'Второй маятник сдвинут на клетку; сохраняются пересечения.',options:{sourceA:'pend',sourceB:'pendR',shiftX:1,operation:'and'}},
    {id:'memory',name:'Эхо памяти',description:'Сравнение текущего поля с сохранённым источником.',options:{sourceA:'source',sourceB:'memory',operation:'xor'}},
    {id:'trail',name:'След дуэта',description:'Единицы последних восьми кадров сохраняют след.',options:{sourceA:'pend',sourceB:'pendR',operation:'xor',history:'trail',trailLength:8}},
    {id:'accumulate',name:'Накопление XOR',description:'Каждый кадр переключает накопленные биты.',options:{sourceA:'pend',sourceB:'pair',operation:'xor',history:'accumulate'}},
    {id:'feedback',name:'Обратная связь',description:'Маятник складывается XOR с предыдущим результатом.',options:{sourceA:'pend',sourceB:'feedback',operation:'xor'}},
    {id:'delay',name:'Задержанное эхо',description:'Исходное поле сравнивается с собой восемь кадров назад.',options:{sourceA:'source',sourceB:'source',delayB:8,operation:'xor'}},
    {id:'cone',name:'Конус и маятник',description:'Неподвижный исходный конус вычитается из растущего маятника.',options:{sourceA:'pend',sourceB:'cone',operation:'subtract'}}
  ].map(recipe=>Object.freeze({...recipe,options:Object.freeze({...defaults,...recipe.options})})));
  return Object.freeze({create,normalizeOptions:optionsFor,defaults,recipes,CYCLE});
});
