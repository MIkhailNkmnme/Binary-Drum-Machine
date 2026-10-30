/* Runtime-only pinned start and displayed-frame progression. No storage. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikManualSnakeFollow=api;})(globalThis,function(){
 'use strict';
 function createSession(){
  let state=null,serial=0,retry=false;
  function reserve(value,index){const done=index>=value.length;state={...value,index:done?Math.max(0,value.length-1):index,done,token:++serial,pending:!done,result:done?state?.result:null};retry=false;return {...state};}
  return {
   choose(value){if(!Number.isInteger(value.length)||value.length<0)throw RangeError('Некорректное число строк ручного поиска.');const same=state&&state.owner===value.owner&&state.start===value.start&&state.revision===value.revision;return reserve({...value,anchor:same?state.anchor:value.anchor},same?state.index+1:0);},
   shown(value){if(!state?.anchor||state.owner!==value.owner)return null;const sequence=state.revision!==value.revision,variants=state.variantKey!==value.variantKey,different=state.frame!==value.frame;if(!sequence&&!variants&&!different&&!retry)return null;const index=sequence?0:different?state.index+1:state.index;return reserve({...state,...value,anchor:state.anchor,start:state.start},index);},
   complete(token,result){if(!state||state.token!==token||!state.pending)return false;state={...state,pending:false,result};return true;},
   reidentify(token,start){if(!state||state.token!==token||!state.pending)return false;state={...state,start};return true;},
   cancel(again=false){if(state)state={...state,pending:false,result:null,token:++serial};retry=!!again;},
   current(){return state?{...state}:null;},clear(){state=null;retry=false;serial++;}
  };
 }
 function anchor(point,source,fx,fy,fragment=false,fragmentIdentity=null){return {source:source?{c:source.c,r:source.r,q:source.q,...(Number.isInteger(source.copy)?{copy:source.copy}:{})}:null,display:{x:fx,y:fy},center:{x:point.x,y:point.y},fragment:!!fragment,...(fragmentIdentity?{fragmentIdentity:{id:fragmentIdentity.id,geometry:fragmentIdentity.geometry}}:{})};}
 function identity(value){if(value.source)return 'source:'+value.source.c+':'+value.source.r+(Number.isInteger(value.source.copy)?':copy:'+value.source.copy:'');const part=value.fragmentIdentity;if(value.fragment&&Number.isInteger(part?.id)&&part.id>=0&&typeof part.geometry==='string')return 'fragment:'+JSON.stringify([part.geometry,part.id]);return 'display:'+value.display.x+':'+value.display.y+':'+value.center.x+':'+value.center.y;}
 function resolve(value,{width,height,point,visible=()=>true}){if(!value)return null;if(value.source){const {c,r}=value.source;if(c<0||c>=width||r<0||r>=height||!visible(c,r))return null;return point(c,r);}return {...value.display};}
 function sameFragment(value,point){return !value?.fragment||!!point&&Math.abs(point.x-value.center.x)<1e-8&&Math.abs(point.y-value.center.y)<1e-8;}
 return {createSession,anchor,identity,resolve,sameFragment};
});
