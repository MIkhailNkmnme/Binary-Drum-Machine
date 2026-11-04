/* Non-destructive edit decision list. All times are seconds in the current edit. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikMediaEdit=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const EPS=1e-7;
 const length=clip=>clip.end-clip.start;
 const duration=clips=>clips.reduce((sum,clip)=>sum+length(clip),0);
 const clone=clip=>({...clip,...(clip.crop?{crop:{...clip.crop}}:{})});
 const copy=clips=>clips.map(clone);
 function cropRect(value,source){
  if(value==null)return null;
  const {x,y,width,height}=value;
  if(![x,y,width,height].every(v=>typeof v==='number'&&Number.isFinite(v))||x<0||y<0||width<=0||height<=0||x+width>1+EPS||y+height>1+EPS)throw Error('Прямоугольник должен находиться внутри видеокадра');
  const rect={x,y,width:Math.min(width,1-x),height:Math.min(height,1-y)};
  if(rect.width*(source.width||1)<1-EPS||rect.height*(source.height||1)<1-EPS)throw Error('Минимальный вырез — один пиксель');
  return x===0&&y===0&&rect.width===1&&rect.height===1?null:rect;
 }
 function time(value){if(typeof value!=='number'||!Number.isFinite(value))throw Error('Некорректное время монтажа');return value;}
 function range(clips,start,end){const total=duration(clips);return [Math.max(0,Math.min(total,time(start))),Math.max(0,Math.min(total,time(end)))];}
 function slice(clips,start,end){
  const [a,b]=range(clips,start,end),result=[];if(b-a<=EPS)return result;
  let at=0;for(const clip of clips){const next=at+length(clip),from=Math.max(a,at),to=Math.min(b,next);if(to-from>EPS)result.push({...clone(clip),start:clip.start+from-at,end:clip.start+to-at});at=next;}return result;
 }
 function cut(clips,start,end){const [a,b]=range(clips,start,end);if(b-a<=EPS)return copy(clips);return [...slice(clips,0,a),...slice(clips,b,duration(clips))];}
 function locate(clips,seconds){
  if(!clips.length)return null;const total=duration(clips),t=Math.max(0,Math.min(total,time(seconds)));let at=0;
  for(let index=0;index<clips.length;index++){const clip=clips[index],next=at+length(clip);if(t<next-EPS||index===clips.length-1)return {index,clip:clone(clip),time:t,sourceTime:Math.max(clip.start,Math.min(clip.end,clip.start+t-at)),clipTime:t-at,offset:at,duration:total};at=next;}
 }
 function create(){
  const sources=new Map();let states=[[]],cursor=0;
  const current=()=>states[cursor];
  function commit(clips){
   if(JSON.stringify(clips)===JSON.stringify(current()))return false;
   states=states.slice(0,cursor+1);states.push(copy(clips));cursor++;
   if(states.length>101){states.shift();cursor--;}
   return true;
  }
  const api={
   get:()=>({sources:[...sources.values()].map(source=>({...source})),clips:copy(current()),duration:duration(current()),canUndo:cursor>0,canRedo:cursor<states.length-1}),
   add(source){
    const id=String(source?.id||'');if(!id||sources.has(id))throw Error('Неуникальный источник видео');
    if(!(time(source.duration)>EPS))throw Error('В видео нет доступной длительности');
    sources.set(id,{...source,id});commit([...current(),{sourceId:id,start:0,end:source.duration}]);return true;
   },
   locate(seconds){const found=locate(current(),seconds);return found?{...found,source:{...sources.get(found.clip.sourceId)}}:null;},
   setCrop(index,value){
    if(!Number.isInteger(index)||index<0||index>=current().length)return false;
    const clips=copy(current()),clip=clips[index],crop=cropRect(value,sources.get(clip.sourceId));
    if(crop)clip.crop=crop;else delete clip.crop;
    return commit(clips);
   },
   cut(start,end){return commit(cut(current(),start,end));},
   keep(start,end){const [a,b]=range(current(),start,end);return b-a>EPS?commit(slice(current(),a,b)):false;},
   split(seconds){
    const found=locate(current(),seconds);if(!found||found.sourceTime-found.clip.start<=EPS||found.clip.end-found.sourceTime<=EPS)return false;
    const clips=copy(current());clips.splice(found.index,1,{...found.clip,end:found.sourceTime},{...found.clip,start:found.sourceTime});return commit(clips);
   },
   remove(index){if(!Number.isInteger(index)||index<0||index>=current().length)return false;const clips=copy(current());clips.splice(index,1);return commit(clips);},
   move(index,direction){const next=index+direction;if(!Number.isInteger(index)||![1,-1].includes(direction)||index<0||next<0||index>=current().length||next>=current().length)return false;const clips=copy(current());[clips[index],clips[next]]=[clips[next],clips[index]];return commit(clips);},
   undo(){if(!cursor)return false;cursor--;return true;},
   redo(){if(cursor>=states.length-1)return false;cursor++;return true;},
   clear(){return commit([]);}
  };return api;
 }
 return {EPS,duration,slice,cut,locate,create};
});
