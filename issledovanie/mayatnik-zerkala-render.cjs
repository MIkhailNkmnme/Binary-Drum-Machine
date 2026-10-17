// Кадр маятника с подсветкой и зеркалом в чёрных треугольниках (раздел 26 «Исследований»).
// node mayatnik-zerkala-render.cjs N кадр шаг_столбов масштаб имя → имя.raw + имя.json
// Кадр маятника с подсветкой: биты, центр краской (красный), столбы через step (жёлтый), Аниматрица, зеркало в чёрных.
const M=require(__dirname+'/../mayatnik/mayatnik-core.js');
const F=require(__dirname+'/../mayatnik/mayatnik-fill.js');
const fs=require('fs');
function setup(N,S){const g=M.geometry('pend',S,N);return {N,S,W:g.W,A:g.anchor,H:N,f:M.field(g.W,N,'empty',g.anchor),k:0};}
function advance(P,k){while(P.k<k){M.cone(P.f,P.A+M.offset('pend',P.k),P.N);P.k++;}}
const C={one:[245,237,232],zero:[91,100,117],empty:[16,20,28],red:[230,90,100],yel:[235,232,90],gold:[255,211,91],cyan:[92,225,230]};
function flatUp(val,W,H){const up=new Int32Array(W*H),flat=new Uint8Array(W*H);
  for(let y=0;y<H;y++){const row=y*W;let s=0;while(s<W){const v=val[row+s];let e=s;while(e+1<W&&val[row+e+1]===v)e++;
    if(v>=0&&s>0&&e<W-1&&val[row+s-1]>=0&&val[row+e+1]>=0&&(e-s+1>=12||y>0&&flat[row-W+s-1]&&flat[row-W+e+1]))for(let x=s;x<=e;x++){flat[row+x]=1;up[row+x]=(y>0?up[row-W+x]:0)+1;}s=e+1;}}
  return up;}
// paint: Uint8 0 нет, 1 красный (центр), 2 жёлтый (столбы)
function paint(P,step){const {W,H,A,f}=P,fb=new Uint32Array(W*H);for(let q=0;q<W*H;q++)fb[q]=f.val[q]+1;
  for(let y=0;y<H;y++){const row=y*W;let a=-1,b=-1;for(let x=0;x<W;x++)if(f.val[row+x]===0){if(a<0)a=x;b=x;}for(let x=0;x<W;x++)if(a<0||x<a||x>b)fb[row+x]=9;}   // полоса «1» снаружи шума — не краска
  const p=new Uint8Array(W*H);
  const cols=[[A,1]];if(step)for(let j=1;A-j*step>=0;j++){cols.push([A-j*step,2]);cols.push([A+j*step,2]);}
  for(const [c,col] of cols){if(c<0||c>=W)continue;for(const q of F.down(fb,W,c,[2]).indices)if(!p[q])p[q]=col;}
  return p;}
function frame(P,{step=0,mirror=1,anim=null,scale=1,crop=null}={}){
  const {W,H,f}=P,val=f.val,p=paint(P,step),up=mirror?flatUp(val,W,H):null;
  const col=new Uint8Array(W*H*3),mark=new Uint8Array(W*H);for(let q=0;q<W*H;q++)if(p[q])mark[q]=1;
  for(let q=0;q<W*H;q++){const v=val[q];let c=v<0?C.empty:v?C.one:C.zero;if(up&&up[q])c=[24,38,64];
    if(p[q])c=p[q]===1?C.red:C.yel;
    if(anim&&anim[q]){const h=anim[q]/4,t=anim.to[q]?C.gold:C.cyan;c=c.map((x,i)=>Math.round(t[i]*h+x*(1-h)));}
    col.set(c,q*3);}
  if(up)for(let y=1;y<H;y++)for(let x=0;x<W;x++){const q=y*W+x,u=up[q];if(!u)continue;const sy=y-2*u+1;if(sy<0)continue;const s=sy*W+x;
    if(mirror===1&&!p[s])continue;if(p[s])mark[q]=1;for(let i=0;i<3;i++)col[q*3+i]=Math.round(col[s*3+i]*.8+col[q*3+i]*.2);}
  // кадрирование по конусу якоря и уменьшение блоками
  const [x0,x1,y0,y1]=crop||[P.A-H+1,P.A+H,0,H],w=x1-x0,h=y1-y0,ow=Math.ceil(w/scale),oh=Math.ceil(h/scale),out=new Uint8Array(ow*oh*3);
  for(let oy=0;oy<oh;oy++)for(let ox=0;ox<ow;ox++){let r=0,g=0,b=0,n=0,hi=null;
    for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){const y=y0+oy*scale+dy,x=x0+ox*scale+dx;if(y>=y1||x>=x1||x<0||x>=W)continue;const q=(y*W+x)*3;
      const pc=mark[y*W+x];if(pc&&!hi)hi=q;r+=col[q];g+=col[q+1];b+=col[q+2];n++;}
    const o=(oy*ow+ox)*3;if(hi!==null){out[o]=col[hi];out[o+1]=col[hi+1];out[o+2]=col[hi+2];}else{out[o]=r/n;out[o+1]=g/n;out[o+2]=b/n;}}
  return {w:ow,h:oh,data:out};}
module.exports={setup,advance,frame,flatUp,paint};
if(require.main===module){const [N,k,step,scale,out]=process.argv.slice(2).map((v,i)=>i<4?+v:v);
  const P=setup(N,N);advance(P,k);const fr=frame(P,{step,scale});fs.writeFileSync(out+'.raw',fr.data);fs.writeFileSync(out+'.json',JSON.stringify({w:fr.w,h:fr.h}));}
