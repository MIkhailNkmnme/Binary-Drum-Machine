/* Keep complete searches and file preparation off the player thread. */
importScripts('xor-space.js?v=060','xor-space-sequence.js?v=019','xor-space-projection-rows.js?v=060');
const Rows=XorProjectionRows;
const previewLimit=80;
self.onmessage=async({data:{snapshot,pattern}})=>{
 try{
  const prepared=Rows.prepare(snapshot);
  const total=snapshot.codes.length;
  const results=[];
  let count=0n,lastUpdate=0;
  const compressed=!pattern&&typeof CompressionStream==='function';
  const stream=compressed?new CompressionStream('gzip'):null;
  const writer=stream?.writable.getWriter(),encoder=stream?new TextEncoder():null;
  const compressedFile=stream?new Response(stream.readable).blob():null;
  compressedFile?.catch(()=>{});
  const fileParts=[];
  let pending=[],size=0,rows=0;
  async function flush(){
   if(!size)return;
   const chunk=pending.join('');
   if(writer)await writer.write(encoder.encode(chunk));else fileParts.push(chunk);
   pending=[];size=0;
  }
  function append(text){pending.push(text);size+=text.length;}
  if(!pattern)append('# Glyphen XOR 3D · '+total+' variants\n# 0=empty; 1=body; C=neutral centre. X increases across a row; Y decreases down a block.\n# Fields: variant, orientation code, plane, first horizontal coordinate, first vertical coordinate, width, height.\n');
  for(let i=0;i<total;i++){
   const code=snapshot.codes[i];
   for(const projection of Rows.project(prepared,code)){
    if(pattern){
     const found=Rows.find(projection,pattern,previewLimit-results.length);
     count+=found.count;
     for(const {x,y}of found.matches)results.push({variant:i+1,code,plane:projection.plane,row:projection.yMax-y+1,column:x-projection.xMin+1,x,y});
    }else{
     const {plane,xMin,xMax,yMin,yMax,width,height}=projection;
     if(width>1_000_000)throw Error('Слишком широкая проекция для текстового файла. Поиск по строкам доступен.');
     append(['@'+(i+1),code,plane,xMin,yMax,width,height].join('\t')+'\n');
     const blank='0'.repeat(width)+'\n';
     for(let y=yMax;y>=yMin;y--){
      const row=projection.rows.get(y);
      append(row?Rows.rowText(row,xMin,xMax)+'\n':blank);
      if(size>=262144)await flush();
     }
     rows+=height;
    }
   }
   const now=performance.now();
   if(now-lastUpdate>120){postMessage({done:i+1,total});lastUpdate=now;}
  }
  if(pattern){postMessage({results,count,total});return;}
  await flush();
  if(writer)await writer.close();
  const blob=compressed?await compressedFile:new Blob(fileParts,{type:'text/tab-separated-values;charset=utf-8'});
  postMessage({blob,rows,total,compressed});
 }catch(error){postMessage({error:error.message||String(error)});}
};
