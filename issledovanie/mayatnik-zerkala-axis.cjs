// Запуск: node mayatnik-zerkala-axis.cjs 512 [шаг кадров] [до кадра] → axis-512.json (раздел 26 «Исследований»).
// По кадрам: ровные компоненты (правило страницы); самый большой на оси якоря; самый большой целиком в застывшей зоне.
const M=require(__dirname+'/../mayatnik/mayatnik-core.js');
const N=+process.argv[2],EVERY=+process.argv[3]||1,UPTO=+process.argv[4]||N;
const {W,anchor:A}=M.geometry('pend',N,N),H=N;const f=M.field(W,H,'empty',A);
function flat(val){const fl=new Uint8Array(W*H);
  for(let y=0;y<H;y++){const row=y*W;let s=0;while(s<W){const v=val[row+s];let e=s;while(e+1<W&&val[row+e+1]===v)e++;
    if(v>=0&&s>0&&e<W-1&&val[row+s-1]>=0&&val[row+e+1]>=0&&(e-s+1>=12||y>0&&fl[row-W+s-1]&&fl[row-W+e+1]))for(let x=s;x<=e;x++)fl[row+x]=1;s=e+1;}}
  return fl;}
function spanAB(k){let a=0,b=0;for(let j=0;j<k;j++){const o=M.offset('pend',j);a=Math.min(a,o);b=Math.max(b,o);}return [a,b];}
const out=[];const lab=new Int32Array(W*H);const st=new Int32Array(W*H);
for(let k=0;k<=UPTO;k++){
  if(k>0)M.cone(f,A+M.offset('pend',k-1),N);
  if(k%EVERY&&k!==UPTO)continue;
  const fl=flat(f.val);lab.fill(-1);const C=[];
  const [a,b]=spanAB(k),pL=a-1,pR=b+1,all=k>=N;   // будущие вершины: a−1, b+1 и дальше
  const fz=(r,c)=>all||(c-A-pL>r&&pR-(c-A)>r);
  for(let q=0;q<W*H;q++){if(!fl[q]||lab[q]>=0)continue;const id=C.length;let n=0,top=H,bot=0,mn=W,mx=0,axis=false,inF=true,sp=0;lab[q]=id;st[sp++]=q;
    while(sp){const p=st[--sp];n++;const y=(p/W)|0,x=p-y*W;if(y<top)top=y;if(y>bot)bot=y;if(x<mn)mn=x;if(x>mx)mx=x;if(x===A)axis=true;if(inF&&!fz(y,x))inF=false;
      if(x>0&&fl[p-1]&&lab[p-1]<0){lab[p-1]=id;st[sp++]=p-1;}if(x<W-1&&fl[p+1]&&lab[p+1]<0){lab[p+1]=id;st[sp++]=p+1;}
      if(y>0&&fl[p-W]&&lab[p-W]<0){lab[p-W]=id;st[sp++]=p-W;}if(y<H-1&&fl[p+W]&&lab[p+W]<0){lab[p+W]=id;st[sp++]=p+W;}}
    C.push({n,top,bot,w:mx-mn+1,axis,inF,cx:(mn+mx)/2-A});}
  const big=C.filter(c=>c.n>=100),ax=big.filter(c=>c.axis).sort((x,y)=>y.n-x.n),inF=C.filter(c=>c.inF&&c.n>=1).sort((x,y)=>y.w-x.w);
  out.push({k,count:big.length,maxw:Math.max(0,...big.map(c=>c.w)),axis:ax.slice(0,3).map(c=>[c.top,c.bot,c.w,c.n]),fzW:Math.max(0,pR-pL-1),fzH:Math.max(0,Math.ceil((pR-pL)/2)-1),inF:inF[0]?[inF[0].top,inF[0].w,inF[0].n]:null});
  if(process.stderr.isTTY===false&&k%64===0)process.stderr.write(k+' ');
}
require('fs').writeFileSync(`axis-${N}.json`,JSON.stringify(out));
for(const o of out.filter((o,i)=>i%Math.max(1,Math.round(out.length/40))===0))console.log(o.k,'| треуг ≥100 кл:',o.count,'макс w',o.maxw,'| на оси',JSON.stringify(o.axis),'| застывшая зона w',o.fzW,'h',o.fzH,'| в ней крупнейший',JSON.stringify(o.inF));
