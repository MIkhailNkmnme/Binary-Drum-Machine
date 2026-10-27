'use strict';
// Exact source data, no screenshot resampling and no invented visual content.
// Run: node issledovanie/mayatnik-ekran-1024/generate.cjs
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const compare=require(path.join(root,'mayatnik/mayatnik-compare.js'));
const rows=1024,frames=[8,36,128],W=2*rows-1,H=rows;
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const palette={'-1':[0,0,0],0:[91,100,117],1:[232,237,245]};
const table=Uint32Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc(b){let c=0xffffffff;for(const n of b)c=table[(c^n)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length,0);t.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc(Buffer.concat([t,data])),data.length+8);return out;}
function png(bits){const scan=Buffer.alloc(H*(1+W*3));for(let y=0;y<H;y++)for(let x=0;x<W;x++){const at=y*(1+W*3)+1+x*3,c=palette[bits[y*W+x]];scan[at]=c[0];scan[at+1]=c[1];scan[at+2]=c[2];}const ih=Buffer.alloc(13);ih.writeUInt32BE(W,0);ih.writeUInt32BE(H,4);ih[8]=8;ih[9]=2;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(scan,{level:9})),chunk('IEND',Buffer.alloc(0))]);}
const sources=['mayatnik/Zerkalius-mayatnik-test.html','mayatnik/mayatnik-compare.js','mayatnik/mayatnik-core.js'].map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}));
const engine=compare.create({rows,direction:'pend',pair:true,checkpointBytes:0}),bits=new Int8Array(W*H),items=[];
for(const frame of frames){const info=engine.seek(frame);engine.copyTo(bits,'field',false);const counts={empty:0,zero:0,one:0};for(const v of bits)counts[v<0?'empty':v?'one':'zero']++;const file=`pair-field-1024-k${String(frame).padStart(3,'0')}.png`,data=png(bits);fs.writeFileSync(path.join(__dirname,file),data);items.push({frame,vertices:info.vertices,file,width:W,height:H,counts,bitsSha256:sha(bits),pngSha256:sha(data)});}
const metadata={status:'Exact frames from pair-field test1024; source and parameters recorded',sourcePage:'../../mayatnik/Zerkalius-mayatnik-test.html?test=field&n=1024&sides=both',hubReference:{field:'5.9 / hubPair / middle pane',source:'../../_js/hub-xor-background.js',frameConvention:'test k = 1 + ceil(hub frame / 2); test k8,36,128 correspond to hub frames13-14,69-70,253-254. These PNG use data orientation; no CSS transform.'},parameters:{rows,width:W,height:H,source:'field',direction:'pend',pair:true,mirror:false,background:'empty',palette,scale:'one source cell per image pixel; no smoothing; full uncropped field'},frameConvention:'k counts operations: k=0 empty, k=1 centre seed, each next operation adds both seeds at anchor ±(k−1) before one rowwise sweep. mayTestXorFrame(q) uses k=q+1; use mayComparison.set(field,{rows:1024,frame:k}) for these exact frames.',recurrence:'Each operation sets new row-0 seed(s) to 1. Rows then update top to bottom; each cell XORs its existing value with available upper-left and upper-right neighbours; −1 is absent and skipped. Horizontal boundaries are finite, not toroidal.',sources,frames:items};
fs.writeFileSync(path.join(__dirname,'metadata.json'),JSON.stringify(metadata,null,2)+'\n');console.log(JSON.stringify(items,null,2));
