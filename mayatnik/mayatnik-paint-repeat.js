/* Frame paint is a display layer. Triples are native cell/raster address, original RGB, paint. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikPaintRepeat=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const mode=value=>['colour','cells'].includes(value)?value:'off';
 function normalize(value){
  if(value==null)return null;
  if(value.version!==1||!['cells','raster'].includes(value.domain)||!Number.isSafeInteger(value.width)||!Number.isSafeInteger(value.height)||value.width<1||value.height<1||value.width*value.height>100000000||typeof value.scope!=='string'||typeof value.geometry!=='string')throw Error('Повреждён перенос краски');
  const a=value.entries;if(!(a instanceof Uint32Array)&&!Array.isArray(a)||a.length%3||a.length>value.width*value.height*3)throw Error('Повреждены цвета переноса');
  const seen=new Set();for(let i=0;i<a.length;i+=3){if(![a[i],a[i+1],a[i+2]].every(n=>Number.isInteger(n)&&n>=0&&n<=0xffffffff)||a[i]>=value.width*value.height||a[i+1]>0xffffff||!a[i+2]||seen.has(a[i]))throw Error('Повреждён адрес переноса');seen.add(a[i]);}
  return {...value,entries:Uint32Array.from(a)};
 }
 function capture(previous,{scope,geometry='',domain='cells',width,height,base,paint,address,erase=[]}){
  const same=previous&&previous.scope===scope&&previous.domain===domain&&previous.width===width&&previous.height===height&&(domain!=='raster'||previous.geometry===geometry),cells=new Map();
  if(same)for(let i=0;i<previous.entries.length;i+=3)cells.set(previous.entries[i],[previous.entries[i+1],previous.entries[i+2]]);
  for(const q of erase)cells.delete(q);
  for(let i=0;i<paint.length;i++){if(!paint[i])continue;const q=address(i);if(q<0||q>=width*height)continue;const old=cells.get(q),colour=paint[i]>>>0;if(old&&old[1]===colour)continue;cells.delete(q);cells.set(q,[old?.[0]??(base[i]&0xffffff),colour]);}
  const entries=new Uint32Array(cells.size*3);let j=0;for(const [q,[rgb,colour]]of cells){entries[j++]=q;entries[j++]=rgb;entries[j++]=colour;}
  return entries.length?{version:1,scope,domain,width,height,geometry,entries}:null;
 }
 function apply(px,base,seed,options){
  if(!seed||mode(options.mode)==='off'||seed.scope!==options.scope||seed.domain==='raster'&&seed.geometry!==options.geometry)return;
  const replacements=new Map();for(let i=0;i<seed.entries.length;i+=3)replacements.set(options.mode==='colour'?seed.entries[i+1]:seed.entries[i],seed.entries[i+2]);
  for(let i=0;i<px.length;i++){if(options.blocked?.[i])continue;const key=options.mode==='colour'?base[i]&0xffffff:options.address(i),colour=replacements.get(key);if(colour)px[i]=colour;}
 }
 function erase(seed,indices,{mode:kind,base,address}){
  if(!seed)return null;const keys=new Set(Array.from(indices,i=>kind==='colour'?base[i]&0xffffff:address(i))),a=[];
  for(let i=0;i<seed.entries.length;i+=3)if(!keys.has(seed.entries[i+(kind==='colour'?1:0)]))a.push(seed.entries[i],seed.entries[i+1],seed.entries[i+2]);
  return a.length?{...seed,entries:Uint32Array.from(a)}:null;
 }
 const json=seed=>seed?{...seed,entries:Array.from(seed.entries)}:null;
 return {mode,normalize,capture,apply,erase,json};
});
