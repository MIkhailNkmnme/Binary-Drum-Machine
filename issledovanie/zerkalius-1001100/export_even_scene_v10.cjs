const fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto');
const P=__dirname,repo=path.join(P,'even-scene');
const Work=require(path.join(repo,'mayatnik-work-file.js')),Core=require(path.join(repo,'mayatnik-core.js')),Fill=require(path.join(repo,'mayatnik-fill.js'));
const input=path.join(P,'even-scene','source.mayatnik');
const dir=path.join(P,'even-scene-v10');fs.mkdirSync(dir,{recursive:true});
(async()=>{
const bytes=fs.readFileSync(input),doc=await Work.decode(new Blob([bytes])),d=doc.data,st=d.st;
const W=d.manualPattern.width,H=st.rows,A=d.frameView.source.x+d.frameView.anchor;
const f={W,H,val:new Int8Array(d.field)},count=720,start=d.k,frameStep=2;
const crop={x:d.frameView.source.x,width:d.frameView.field.W,height:H};
if(start%2||st.mode!=='pend'||st.pair||st.bg!=='empty')throw Error('Unsupported source settings');
const L=new Int32Array(H),R=new Int32Array(H);
function semantic(){
 L.fill(-1);R.fill(-1);let first=-1;const sides=[[Infinity,-Infinity],[Infinity,-Infinity]];
 for(let r=0;r<H;r++){
  const row=r*W;
  for(let c=0;c<W;c++)if(f.val[row+c]===0){L[r]=c;break;}
  if(L[r]<0)continue;
  for(let c=W-1;c>=L[r];c--)if(f.val[row+c]===0){R[r]=c;break;}
  if(first<0)first=r;
 }
 if(first<0)throw Error('No noise boundary');
 for(let r=0;r<H;r++)if(L[r]<0){const q=r<first?first:r-1;L[r]=L[q];R[r]=R[q];}
 for(let r=0;r<H;r++)for(let c=L[r];c<=R[r];c++){
  if(f.val[r*W+c]<0)continue;const p=(c-A-r)&1;
  sides[p][0]=Math.min(sides[p][0],c+r);sides[p][1]=Math.max(sides[p][1],c-r);
 }
 const out=new Int8Array(crop.width*H).fill(-1);
 for(let r=0;r<H;r++)for(let x=0;x<crop.width;x++){
  const c=crop.x+x,v=f.val[r*W+c];if(v<0)continue;
  const p=(c-A-r)&1,allowed=(c>=L[r]&&c<=R[r])||(c>=sides[p][0]-r&&c<=sides[p][1]+r);
  if(allowed)out[r*crop.width+x]=v;
 }
 return out;
}
const originalSemantic=semantic();let mismatch=0;
for(let q=0;q<originalSemantic.length;q++)if(originalSemantic[q]!==d.frameView.field.val[q])mismatch++;
if(mismatch)throw Error('Source geometry mismatch: '+mismatch);
console.log('Saved frame 126 geometry matched cell-for-cell');
const initial=d.frameView.image.pixels,initialLabels=new Uint8Array(originalSemantic.length);
for(let q=0;q<initialLabels.length;q++){
 if(originalSemantic[q]<0)continue;
 const r=initial[q*4],g=initial[q*4+1],b=initial[q*4+2];
 initialLabels[q]=r===255&&g===215?2:r===255&&b===102?4:r===191&&g===13?3:1;
}
let current=start;const frames=[];
for(let index=0;index<count;index++){
 const target=start+index*frameStep;
 while(current<target){Core.cone(f,A+Core.offset(st.mode,current),H);current++;}
 const sem=index?semantic():originalSemantic,labels=new Uint8Array(sem.length),fb=new Uint8Array(sem.length);
 for(let q=0;q<sem.length;q++){labels[q]=sem[q]<0?0:sem[q]===1?2:1;fb[q]=sem[q]+1;}
 for(const [bit,label] of [[1,4],[0,3]])for(const q of Fill.down(fb,crop.width,A-crop.x,[bit+1]).indices)labels[q]=label;
 if(index===0){let colorDifference=0;for(let q=0;q<labels.length;q++)if(labels[q]!==initialLabels[q])colorDifference++;
  console.log('Calculated central-fill differences from saved image: '+colorDifference);
  // Preserve the exact supplied initial picture, including any manual paint.
  labels.set(initialLabels);
 }
 const file='frame-'+target+'.idxz';fs.writeFileSync(path.join(dir,file),zlib.deflateSync(labels,{level:4}));
 frames.push({index,frame:target,file});
 if(index%32===0)console.log('Exported '+(index+1)+'/'+count+' even frames; current '+target);
}
const manifest={input,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),savedFrame:start,rows:H,fieldWidth:W,anchor:A,crop,count,step:2,first:start,last:frames.at(-1).frame,secondsPerState:.625,frames,initialGeometryMismatches:mismatch,source:'Exact stored field followed by actual XOR cone updates; application triangle clipping and central connected-region filling.',paletteLabels:['transparent','dark bit zero','bit one','central zero','central one']};
fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2));
fs.copyFileSync(input,path.join(dir,'source.mayatnik'));
for(const name of ['mayatnik-core.js','mayatnik-fill.js','mayatnik-work-file.js'])fs.copyFileSync(path.join(repo,name),path.join(dir,name));
console.log('All even frames ready');
})().catch(e=>{console.error(e);process.exitCode=1;});
