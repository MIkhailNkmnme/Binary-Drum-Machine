'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync(require('node:path').join(__dirname, 'Zerkalius-mayatnik.html'), 'utf8');
const source = html.slice(html.indexOf('  function downsampleRaster('), html.indexOf('  function present()'));
const downsample = new Function(source + '\nreturn downsampleRaster;')();
// A segment is the exact union of the old square dots, including clipped windows.
const outlineSource=html.slice(html.indexOf('  function outline(px)'),html.indexOf('  // v0.031:'));
for(const t of [1,2,3,7,17])for(const VX of [0,2,6]){
  const W=13,H=9,VW=7,VH=7,GOLD=12345,h=t>>1,val=Int8Array.from({length:W*H},(_,i)=>(i*7+Math.floor(i/W)*3)%5===0?1:0);
  const expected=new Uint32Array(VW*VH),actual=new Uint32Array(VW*VH),f={W,H,val};
  const dot=(r,c)=>{for(let y=r-h;y<r-h+t;y++)if(y>=0&&y<VH)for(let x=c-h;x<c-h+t;x++)if(x>=VX&&x<VX+VW)expected[y*VW+x-VX]=GOLD;};
  const seg=(r,a,b)=>{for(let c=Math.min(a,b);c<=Math.max(a,b);c++)dot(r,c);};
  let pl=-1,pr=-1;for(let r=0;r<VH;r++){let l=-1,rr=-1;for(let c=0;c<W;c++)if(val[r*W+c]===1){l=c;break;}if(l<0){pl=pr=-1;continue;}for(let c=W-1;c>=l;c--)if(val[r*W+c]===1){rr=c;break;}if(pl<0)seg(r,l,rr);else{seg(r,pl,l);seg(r,pr,rr);}pl=l;pr=rr;}
  new Function('f','VH','VW','VX','GOLD','bgNoise','scale',outlineSource+';return outline;')(f,VH,VW,VX,GOLD,()=>()=>1,()=>1.5/(t-.1))(actual);
  assert.deepEqual(actual,expected);
}
const image = (width, height, pixel = () => [0, 0, 0, 0]) => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(pixel(x, y), (y * width + x) * 4);
  return {width, height, data};
};
const near = (a, b) => assert.ok(Math.abs(a - b) <= 1, `${a} != ${b}`);

// Moving either lattice phase must not turn a zoomed-out checkerboard entirely black or white.
for (const phase of [0, 1]) for (const divisor of [2, 4, 8]) {
  const src = image(32, 32, (x, y) => {const v = (x + y + phase) % 2 * 255; return [v, v, v, 255];});
  const out = downsample(src, image(32 / divisor, 32 / divisor));
  for (let i = 0; i < out.data.length; i += 4) { near(out.data[i], 127.5); assert.equal(out.data[i + 3], 255); }
}

// Fractional scaling includes the last row and column and preserves total colour coverage.
const src = image(7, 5, (x, y) => [x * 30, y * 50, (x + y) * 20, 255]);
for (const [w, h] of [[3, 2], [1, 1], [6, 4]]) {
  const out = downsample(src, image(w, h));
  for (let c = 0; c < 3; c++) {
    let a = 0, b = 0;
    for (let i = c; i < src.data.length; i += 4) a += src.data[i];
    for (let i = c; i < out.data.length; i += 4) b += out.data[i];
    near(a / (src.width * src.height), b / (w * h));
  }
}

// Transparent colours must not bleed into visible pixels when averaging.
assert.deepEqual([...downsample(image(2, 1, x => x ? [0, 0, 255, 255] : [255, 0, 0, 0]), image(1, 1)).data], [0, 0, 255, 128]);
const solid = image(9, 7, () => [23, 89, 211, 255]);
for (const [w, h] of [[1, 1], [4, 3], [9, 7]]) {
  const out = downsample(solid, image(w, h));
  for (let i = 0; i < out.data.length; i += 4) assert.deepEqual([...out.data.slice(i, i + 4)], [23, 89, 211, 255]);
}
