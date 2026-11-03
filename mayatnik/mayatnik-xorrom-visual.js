/* One score clock and one exact bit renderer for the carpet, library and video. */
(function(root,factory){
 const node=typeof module==='object'&&module.exports;
 const api=factory(root,node?require('./mayatnik-work-file'):root.MayatnikWorkFile,node?require('./mayatnik-xorrom-field'):root.MayatnikXorromField,node?require('./mayatnik-xorrom-geometry'):root.MayatnikXorromGeometry,node?require('./mayatnik-xorrom'):root.MayatnikXorrom);
 if(node)module.exports=api;else root.MayatnikXorromVisual=api;
})(globalThis,function(root,Work,Field,Geometry,Music){
 'use strict';
 const palette=Object.freeze({background:'#000000',zero:'#5b6475',one:'#e8edf5',row:'#243447',active:'#65eaa6',outline:'#ffd166'});
 function runs(bits,width,row,value=1){
  const result=[];for(let x=0;x<width;){if(bits[row*width+x]!==value){x++;continue;}const start=x;while(x<width&&bits[row*width+x]===value)x++;result.push([start,x-start]);}return result;
 }
 async function prepare(entry){
  if(!entry?.frame?.base64)throw Error('У примера нет исходного кадра.');
  const bytes=Uint8Array.from(root.atob(entry.frame.base64),character=>character.charCodeAt(0));
  const saved=await Work.decode(new Blob([bytes])),data=saved?.data;
  if(saved?.format!=='mayatnik-work'||saved.version!==2||!data?.st||!(data.field instanceof Int8Array)||data.field.length!==data.width*data.height)throw Error('Повреждён исходный кадр музыкального примера.');
  const settings=Music.validateSettings(entry.settings),source={width:data.width,height:data.height,bits:data.field.slice()};
  let snapshot=await Field.capture({width:source.width,height:source.height,readBit:(x,y)=>source.bits[y*source.width+x]});
  if(settings.autoGeometry)snapshot=await Geometry.analyze(snapshot,{connectivity:settings.geometryConnectivity});
  const timeline=Music.scoreTimeline(snapshot,settings).map(step=>({...step,onesRuns:runs(source.bits,source.width,step.index)}));
  return {source,settings,timeline,duration:Number(entry.duration)||timeline.at(-1)?.end||0,palette};
 }
 function stateAt(prepared,time){
  if(!Number.isFinite(time)||time<0)return null;
  const timeline=prepared.timeline;let lo=0,hi=timeline.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(timeline[mid].start<=time)lo=mid+1;else hi=mid;}
  const step=timeline[lo-1];return step&&time<step.end?step:null;
 }
 function layout(source,{width,height}){
  const scale=Math.max(1,Math.floor(Math.min(width/source.width,height/source.height))),w=source.width*scale,h=source.height*scale;
  return {left:Math.floor((width-w)/2),top:Math.floor((height-h)/2),scale,width:w,height:h};
 }
 function draw(ctx,prepared,time,box={}){
  const width=box.width||ctx.canvas.width,height=box.height||ctx.canvas.height,source=prepared.source,position=layout(source,{width,height}),step=stateAt(prepared,time),p=prepared.palette||palette;
  ctx.imageSmoothingEnabled=false;ctx.fillStyle=p.background;ctx.fillRect(0,0,width,height);
  for(const [bit,colour]of [[0,p.zero],[1,p.one]]){
   ctx.fillStyle=colour;
   for(let y=0;y<source.height;y++)for(const [x,length]of runs(source.bits,source.width,y,bit))ctx.fillRect(position.left+x*position.scale,position.top+y*position.scale,length*position.scale,position.scale);
  }
  if(step){
   const y=position.top+step.index*position.scale;
   // The thin frame shows the reader; only actual ones get the bright fill.
   ctx.strokeStyle=p.row;ctx.lineWidth=1;ctx.strokeRect(position.left+.5,y+.5,position.width-1,Math.max(0,position.scale-1));
   for(const [x,length]of step.onesRuns){
    const left=position.left+x*position.scale,w=length*position.scale;
    ctx.fillStyle=p.active;ctx.fillRect(left,y,w,position.scale);
    ctx.strokeStyle=p.outline;ctx.strokeRect(left+.5,y+.5,Math.max(0,w-1),Math.max(0,position.scale-1));
   }
  }
  return {...position,index:step?.index??null};
 }
 return {prepare,stateAt,layout,draw,runs,palette};
});
