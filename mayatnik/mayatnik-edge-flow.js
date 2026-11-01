/* Optional continuous edge transport. Frames remain global across crossings;
 * the legacy edge loop keeps its own reset-to-zero transport unchanged.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikEdgeFlow=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const MAX_FRAME=1048576,MAX_CELLS=100000000;
  const MODES=['pend','pendR','left','right','one'];
  const KEY_PATTERN=/^edge-flow-v1\|[1-9]\d{0,3}\|[2468]\|(?:pend|pendR|left|right|one)\|[01]\|[01]\|[01]\|[01]$/;
  const fail=message=>{throw Error(message);};
  const active=state=>!!(state?.edgeWrap&&state.edgeContinuous&&!state.sequenceSourceOn&&!state.compareSource&&!state.animatrixOn);
  const paired=state=>!!state?.pair&&state.mode==='pend';
  function frame(value){
    if(!Number.isSafeInteger(value)||value<0||value>MAX_FRAME)fail('Кадр непрерывного Перескока должен быть от 0 до 1 048 576.');
    return value;
  }
  function base(state){
    if(state?.mode==='one')return 1;
    const steps=state?.steps;
    if(!Number.isSafeInteger(steps)||steps<1||steps>MAX_FRAME)fail('Некорректное число шагов Перескока.');
    return paired(state)?Math.floor(steps/2):steps;
  }
  function widthFactor(state){
    const rows=state?.rows;
    if(!Number.isSafeInteger(rows)||rows<8||rows>4096)fail('Число строк Перескока должно быть от 8 до 4096.');
    let factor=Number(state.edgeWidth)||4;
    if(![2,4,6,8].includes(factor))fail('Неизвестная ширина Перескока.');
    while(factor>2&&(factor*rows-1)*rows>MAX_CELLS)factor-=2;
    return factor;
  }
  function key(state){
    if(!MODES.includes(state?.mode))fail('Неизвестное направление Перескока.');
    return ['edge-flow-v1',state.rows,widthFactor(state),state.mode,+paired(state),+!!state.sequenceOwnGrid,+!!state.sequenceInverseAbove,+!!state.edgeBounce].join('|');
  }
  function limit(state){
    const first=base(state);
    if(!active(state))return first;
    const saved=state.edgeFlowMax;
    return state.edgeFlowKey===key(state)&&Number.isSafeInteger(saved)&&saved>=0&&saved<=MAX_FRAME?Math.max(first,saved):first;
  }
  function range(state,requested){
    frame(requested);const chunk=base(state);
    if(!chunk&&requested)fail('Для продолжения парного Перескока задайте не меньше двух шагов.');
    const maximum=chunk?Math.min(MAX_FRAME,Math.ceil(requested/chunk)*chunk):0;
    return {edgeFlowKey:key(state),edgeFlowMax:maximum};
  }
  function counts(state,at,width){
    frame(at);
    if(!Number.isSafeInteger(width)||width<1||width%2!==1)fail('Некорректная ширина поля непрерывного Перескока.');
    const pair=paired(state),jumps=pair?2*Math.max(0,at-(width-1)/2):Math.max(0,at-width);
    return {jumps,laps:Math.floor(at/(pair?width:2*width))};
  }
  function snapshotInterval(frames,cells){
    frame(frames);
    if(!Number.isSafeInteger(cells)||cells<1||cells>MAX_CELLS)fail('Некорректный размер опорного кадра Перескока.');
    return Math.max(1,Math.ceil(frames*cells*2/200e6));
  }
  function validate(state){
    if(!active(state))return state;
    frame(base(state));key(state);
    if(state.edgeFlowKey!=null&&state.edgeFlowKey!==''&&(typeof state.edgeFlowKey!=='string'||!KEY_PATTERN.test(state.edgeFlowKey)))fail('Повреждён ключ непрерывного Перескока.');
    if(state.edgeFlowMax!=null)frame(state.edgeFlowMax);
    return state;
  }
  return {MAX_FRAME,MAX_CELLS,active,base,key,limit,range,counts,snapshotInterval,validate};
});
