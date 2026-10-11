/* Codex — независимый исследователь Хоррориуса · 12.10.2026.
   Scale laboratory v0.001: build once, keep EVERY construction frame as packed bits.
   Calculation, rasterisation, and archive encoding run outside the UI thread. */
'use strict';
self.module={exports:{}};
importScripts('horrorius-packed.js');
const packed=self.module.exports;
importScripts('horrorius-view.js');
const colorView=self.module.exports;
let frames=[],meta=null;
function covered(r,c,n){const lo=-(n>>1),hi=(n-1)>>1,a=Math.max(lo,c-r),b=Math.min(hi,c+r);return a+((c+r-a)&1)<=b;}
function encode(buffer){const bytes=new Uint8Array(buffer);let out='';for(let i=0;i<bytes.length;i+=32768)out+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(out);}
function decode(s){const raw=atob(s),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return new Uint32Array(bytes.buffer);}
async function checksum(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');}
self.onmessage=async({data:m})=>{
 try{
  if(m.type==='build'){
   const N=m.rows,S=m.steps;if(!Number.isInteger(N)||N<8||N>512||!Number.isInteger(S)||S<1||S>2048)throw Error('Лаборатория: 8–512 строк, 1–2048 вершин.');
   if(Math.ceil((2*N+S-2)/32)*N*S*4>180000000)throw Error('Архив битов превышает 180 МБ. Уменьшите число вершин.');
   const f=packed.create(N,S);frames=[];meta={rows:N,steps:S,width:f.width,anchor:f.anchor,stride:f.stride};
   while(f.next()){frames.push(f.bits.slice());if(f.completed%16===0)self.postMessage({type:'progress',done:f.completed,total:S});}
   self.postMessage({type:'ready',meta,bytes:frames.reduce((n,a)=>n+a.byteLength,0)});
  }else if(m.type==='image'){
   const bits=m.frame===0?new Uint32Array(meta.stride*meta.rows):frames[m.frame-1];if(!bits)throw Error('Кадр отсутствует');
   const {width:W,rows:H,anchor,stride}=meta,canvas=new OffscreenCanvas(W,H),ctx=canvas.getContext('2d'),pixels=ctx.createImageData(W,H),a=pixels.data;
   for(let r=0;r<H;r++)for(let x=0;x<W;x++){
    const i=(r*W+x)*4;if(!covered(r,x-anchor,m.frame))continue;
    const v=(bits[r*stride+(x>>>5)]>>>(x&31))&1,rgb=colorView.horrorRGB(r,x-anchor,v,m.frame,m.color);
    a[i]=rgb[0];a[i+1]=rgb[1];a[i+2]=rgb[2];a[i+3]=255;
   }
   ctx.putImageData(pixels,0,0);const bitmap=canvas.transferToImageBitmap();self.postMessage({type:'image',frame:m.frame,color:m.color,bitmap},[bitmap]);
  }else if(m.type==='export'){
   const saved=frames.slice(),geometry={...meta},hashes=[];
   for(const a of saved)hashes.push(await checksum(a));
   const out={format:'horrorius-scale-archive-1',author:'Codex — независимый исследователь Хоррориуса · 12.10.2026',
    engine:'horrorius-packed v1; empty field; pendulum',renderer:'nearest; rotateY; perspective when WebGL is available, parallel otherwise',palette:{zero:[91,100,117],one:[232,237,245],blue:[79,155,255],red:[255,90,79]},initialField:'empty',meta:geometry,byteOrder:'little-endian',frames:saved.map(a=>encode(a.buffer)),hashes,views:m.views};
   const blob=new Blob([JSON.stringify(out)],{type:'application/json'});self.postMessage({type:'archive',blob});
  }else if(m.type==='import'){
   const a=JSON.parse(await m.file.text());if(a.format!=='horrorius-scale-archive-1'||a.byteOrder!=='little-endian')throw Error('Неизвестный формат архива');
   const p=a.meta;
   if(!p||!Number.isInteger(p.rows)||p.rows<8||p.rows>512||!Number.isInteger(p.steps)||p.steps<1||p.steps>2048||p.width!==2*p.rows+p.steps-2||p.stride!==Math.ceil(p.width/32)||p.anchor!==p.rows-1+Math.floor(p.steps/2))throw Error('Некорректная геометрия');
   if(!Array.isArray(a.frames)||a.frames.length!==p.steps||p.rows*p.stride*p.steps*4>180000000||!Array.isArray(a.views))throw Error('Некорректные кадры');
   if(!Array.isArray(a.hashes)||a.hashes.length!==p.steps)throw Error('Нет контрольных сумм кадров');
   const expectedBytes=p.rows*p.stride*4;
   const loaded=a.frames.map(s=>{if(typeof s!=='string'||s.length!==4*Math.ceil(expectedBytes/3))throw Error('Повреждённый битовый кадр');const b=decode(s);if(b.byteLength!==expectedBytes)throw Error('Повреждённый битовый кадр');return b;});
   for(let i=0;i<loaded.length;i++)if(await checksum(loaded[i])!==a.hashes[i])throw Error('Не совпадает контрольная сумма кадра '+(i+1));
   for(const v of a.views)if(!Number.isInteger(v.frame)||v.frame<0||v.frame>p.steps||![v.zoom,v.x,v.y,v.w,v.h,v.t,v.dpr].every(Number.isFinite)||v.zoom<=0||v.w<1||v.h<1||v.w*v.h>16000000||v.t<0||v.dpr<=0)throw Error('Повреждённая запись масштаба');
   for(const v of a.views)if((v.angle!==undefined&&!Number.isFinite(v.angle))||(v.color!==undefined&&typeof v.color!=='boolean'))throw Error('Повреждённые параметры поворота или цвета');
   frames=loaded;meta=p;self.postMessage({type:'imported',meta,views:a.views,bytes:frames.reduce((n,b)=>n+b.byteLength,0)});
  }
 }catch(error){self.postMessage({type:'error',message:error.message});}
};
