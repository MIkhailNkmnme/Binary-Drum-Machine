/* Codex — независимый исследователь Хоррориуса · 12.10.2026.
 * Exact local reflection domains in four lattice directions. No interpolation.
 * Input: width, height, palette byte file. Output: certified rectangles/diamonds.
 */
'use strict';
const fs=require('node:fs');
if(process.argv[2]==='--test-pal'){
  let seed=234771;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
  for(let trial=0;trial<300;trial++){const s=Uint8Array.from({length:1+rnd()%80},()=>rnd()%3);const[o,e]=pal(s);
    for(let i=0;i<s.length;i++){let k=1;while(i-k>=0&&i+k<s.length&&s[i-k]===s[i+k])k++;if(o[i]!==k)throw Error('Odd radius');
      k=0;while(i-k-1>=0&&i+k<s.length&&s[i-k-1]===s[i+k])k++;if(e[i]!==k)throw Error('Even radius');}}
  console.log('300 independent brute-force palindrome checks passed');process.exit(0);
}
const [w,h,input,output]=process.argv.slice(2);const W=+w,H=+h;
const a=new Uint8Array(fs.readFileSync(input));if(a.length!==W*H)throw Error('Dimensions');
const limits=[16,32,64,128],findings=[],keys=new Set();
function pal(s){
  const n=s.length,o=new Uint16Array(n),e=new Uint16Array(n);let l=0,r=-1;
  for(let i=0;i<n;i++){let k=i>r?1:Math.min(o[l+r-i],r-i+1);while(i-k>=0&&i+k<n&&s[i-k]===s[i+k])k++;o[i]=k;if(i+k-1>r){l=i-k+1;r=i+k-1;}}
  l=0;r=-1;for(let i=0;i<n;i++){let k=i>r?0:Math.min(e[l+r-i+1],r-i+1);while(i-k-1>=0&&i+k<n&&s[i-k-1]===s[i+k])k++;e[i]=k;if(i+k-1>r){l=i-k;r=i+k-1;}}return [o,e];
}
function xy(f,n,t){if(f==='V')return [n/2,t];if(f==='H')return [t,n/2];if(f==='D+')return [(t+n)/2,(t-n)/2];const v=t-H+1;return [(n+v)/2,(n-v)/2];}
function pair(f,axis,t,d){const p=xy(f,axis-d,t),q=xy(f,axis+d,t);if(p.some(v=>!Number.isInteger(v))||q.some(v=>!Number.isInteger(v)))throw Error('Parity');if(p[0]<0||p[0]>=W||p[1]<0||p[1]>=H||q[0]<0||q[0]>=W||q[1]<0||q[1]>=H)return null;return [a[p[1]*W+p[0]],a[q[1]*W+q[0]],p,q];}
function parity(f,axis,t){return f==='V'||f==='H'?axis&1:(t+(f==='D-'?-H+1:0)-axis)&1;}
function mismatch(f,axis,t,m,outside=false){let d=parity(f,axis,t);if(outside){while(d<=m)d+=2;const p=pair(f,axis,t,d);return p&&p[0]!==p[1]?p.slice(2):null;}for(;d<=m;d+=2){const p=pair(f,axis,t,d);if(p&&p[0]!==p[1])return p.slice(2);}return null;}
function certify(f,axis,t0,t1,m){
  const key=[f,axis,t0,t1,m].join(',');if(keys.has(key)||t1-t0<15)return;keys.add(key);
  const before=mismatch(f,axis,t0-1,m),after=mismatch(f,axis,t1+1,m);if(!before||!after)return;
  let border=null,white=0,count=0;
  for(let t=t0;t<=t1;t++){
    border ||= mismatch(f,axis,t,m,true);
    for(let d=parity(f,axis,t);d<=m;d+=2){const p=pair(f,axis,t,d);if(!p||p[0]!==p[1]||p[0]===0)return;const weight=d===0?1:2;count+=weight;if(p[0]===2)white+=weight;}
  }
  if(!border||count<384||white/count<.08||white/count>.92)return;
  findings.push({family:f,axis,tangent:[t0,t1],normalRadius:m,pixels:count,whiteFraction:white/count,
    exactReflection:true,witnesses:{normalOutside:border,before,after}});
}
function scan(f,map,N,T,offset=0){let accepted=0;for(let ni=0;ni<N;ni++){const base=ni*T,axis=ni-offset;
  for(const min of limits){let start=-1,m=65535;for(let t=0;t<=T;t++){const r=t<T?map[base+t]:0;
    if(r>=min){if(start<0){start=t;m=r;}else if(r<m)m=r;}else if(start>=0){certify(f,axis,start,t-1,m);start=-1;}}
  }}console.error(f,findings.length,'cumulative');
}
for(const f of ['V','H','D+','D-']){
  let N,T,offset=0,map;
  if(f==='V'||f==='H'){
    const n=f==='V'?W:H;T=f==='V'?H:W;N=2*n-1;map=new Uint16Array(N*T);
    for(let t=0;t<T;t++){const line=new Uint8Array(n);for(let i=0;i<n;i++)line[i]=f==='V'?a[t*W+i]:a[i*W+t];const[o,e]=pal(line);
      for(let i=0;i<n;i++){map[(2*i)*T+t]=2*(o[i]-1);if(i>0&&e[i])map[(2*i-1)*T+t]=2*e[i]-1;}}
  }else{
    const L=W+H-1;N=T=L;map=new Uint16Array(N*T);offset=f==='D+'?H-1:0;
    for(let t=0;t<T;t++){
      const v=t-H+1,x0=f==='D+'?Math.max(0,t-H+1):Math.max(0,v),x1=f==='D+'?Math.min(W-1,t):Math.min(W-1,H-1+v);
      if(x1<x0)continue;const line=new Uint8Array(x1-x0+1);
      for(let x=x0;x<=x1;x++){const y=f==='D+'?t-x:x-v;line[x-x0]=a[y*W+x];}
      const[o,e]=pal(line);for(let i=0;i<line.length;i++){const x=x0+i,y=f==='D+'?t-x:x-v;const axis=f==='D+'?x-y:x+y;
        map[(axis+offset)*T+t]=2*(o[i]-1);if(i>0&&e[i])map[(axis-1+offset)*T+t]=2*e[i]-1;}
    }
  }
  scan(f,map,N,T,offset);
}
fs.writeFileSync(output,JSON.stringify({author:'Codex — независимый исследователь Хоррориуса · 12.10.2026',
  width:W,height:H,normalThresholds:limits,minTangentSpan:16,minPixels:384,
  scope:'four exact raster reflections; mixed nonempty pixels only; bounded in both tangent directions and at maximal normal radius; finite width thresholds',
  count:findings.length,findings}));console.log(findings.length);
