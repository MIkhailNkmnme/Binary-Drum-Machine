const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]||process.cwd()),C=require(path.join(root,'mayatnik/mayatnik-core.js')),A=require(path.join(root,'mayatnik/mayatnik-auto-axes.js'));
const params={rows:64,steps:127,k:8,mode:'pend',background:'empty',minHeight:4},g=C.geometry(params.mode,params.steps,params.rows),f=C.field(g.W,params.rows,params.background,g.anchor);
for(let j=0;j<params.k;j++)C.cone(f,g.anchor+C.offset(params.mode,j),params.rows);
const {triangles,segments}=A.analyze(f,{minHeight:params.minHeight});
for(const t of triangles){const c=t.x+t.h-1;let n=0;for(let y=0;y<t.h;y++)for(let x=c-t.h+1+y;x<=c+t.h-1-y;x++){assert.equal(f.val[(t.y+y)*f.W+x],0);n++;}assert.equal(n,t.n);}
let lo=f.W,hi=0;for(let q=0;q<f.val.length;q++)if(f.val[q]>=0){lo=Math.min(lo,q%f.W);hi=Math.max(hi,q%f.W);}
const by=new Map();for(const s of segments){if(!by.has(s.x))by.set(s.x,[]);by.get(s.x).push(s);for(let r=s.y0;r<s.y1;r++)assert.ok(f.val[r*f.W+Math.floor(s.x)]>=0);}
const S=8,X=60,Y=150,W=1600,H=1080,pal=['#ffbb57','#48baff','#66e5a3'],ink='#e7edf6',muted='#a9b6c9';let svg=[];
const text=(x,y,s,size=18,fill=ink,extra='')=>svg.push(`<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${s}</text>`);
const line=(x1,y1,x2,y2,col,width=2)=>svg.push(`<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${col}" stroke-width="${width}"/>`);
const sx=x=>X+(x-lo)*S,sy=y=>Y+y*S;
svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc"><title id="title">Автооси между нулевыми треугольниками Маятника</title><desc id="desc">Настоящее поле: 64 строки, 8 конусов, череда, пустой фон. Все 8 принятых треугольников h≥4 и 14 интервалов на 6 вертикалях. Цвет: верхний оранжевый, между голубой, нижний зелёный.</desc><rect width="${W}" height="${H}" fill="#111824"/><g font-family="Arial, sans-serif">`);
text(60,48,'Автооси МЕЖДУ нулевыми ▼',32);text(60,80,'Настоящее поле Маятника · 64 строки · k = 8 конусов · череда 0, −1, +1, −2, +2, −3, +3, −4',20,muted);
text(60,110,`Пустой фон · h ≥ 4 · найдено ${triangles.length} ▼ · ${by.size} вертикалей · ${segments.length} непустых участков`,18,muted);
svg.push(`<rect x="${X}" y="${Y}" width="${(hi-lo+1)*S}" height="${params.rows*S}" fill="#090e16"/>`);
for(const bit of [0,1]){let d='';for(let r=0;r<f.H;r++)for(let c=lo;c<=hi;c++)if(f.val[r*f.W+c]===bit)d+=`M${sx(c)} ${sy(r)}h${S}v${S}h-${S}z`;svg.push(`<path d="${d}" fill="${bit?'#a8b3c6':'#1a2739'}" shape-rendering="crispEdges"/>`);}
for(const t of triangles){const c=t.x+t.h-1+.5;svg.push(`<path d="M${sx(c-t.h)} ${sy(t.y)}L${sx(c+t.h)} ${sy(t.y)}L${sx(c)} ${sy(t.y+t.h)}Z" fill="none" stroke="#d194ed" stroke-opacity=".85" stroke-width="1.6"/>`);}
for(const [x,ss]of by)ss.forEach((s,i)=>line(sx(x),sy(s.y0),sx(x),sy(s.y1),pal[i===0?0:i===ss.length-1?2:1],3));
for(let r=0;r<=64;r+=8){text(44,sy(r)+5,String(r),14,muted,'text-anchor="end"');line(X-7,sy(r),X-1,sy(r),'#8391a7',1);}
text(60,697,'Строки — от 0; координата x в таблице — смещение центра клетки от оси якоря.',16,muted);
text(60,722,'Показана вся записанная фигура, пустые поля слева и справа обрезаны. 1 клетка = 8 px.',16,muted);
text(1180,159,'Легенда',23);for(const [i,label]of ['До первой дыры','Между двумя дырами','После последней дыры'].entries()){line(1180,192+i*30,1212,192+i*30,pal[i],4);text(1223,198+i*30,label,17);}
line(1180,288,1212,288,'#d194ed',2);text(1223,294,'Граница нулевого ▼',17);
text(1180,332,'Ось x = −1 крупнее',22);const sel=by.get(g.anchor-.5),barX=1200,barY=358,scale=4.5;
svg.push(`<rect x="${barX-7}" y="${barY}" width="14" height="${64*scale}" fill="#332942"/>`);
for(let i=0;i<sel.length;i++){const s=sel[i];line(barX,barY+s.y0*scale,barX,barY+s.y1*scale,pal[i],6);}
for(const r of [0,15,26,31,58,64]){line(barX-13,barY+r*scale,barX+13,barY+r*scale,'#dbe5f3',1);text(1230,barY+r*scale+5,String(r),16);}
text(1270,barY+20,'0…15 — сверху',16,pal[0]);text(1270,barY+95,'15…26 — дыра',16,'#d194ed');text(1270,barY+131,'26…31 — между',16,pal[1]);text(1270,barY+205,'31…58 — дыра',16,'#d194ed');text(1270,barY+278,'58…64 — снизу',16,pal[2]);
text(60,773,'Все найденные ▼: две соседние фигуры показаны отдельно',20);const tx=[60,130,260,360,450,580];['№','x центра','верх y','h','ширина','нулевых клеток'].forEach((v,i)=>text(tx[i],802,v,17,muted));
triangles.forEach((t,i)=>[i+1,t.x+t.h-1-g.anchor,t.y,t.h,t.w,t.n].forEach((v,j)=>text(tx[j],830+i*24,v,17,ink)));
text(855,773,'Все интервалы [начало, конец), в строках',20);['x','сверху','между','снизу'].forEach((v,i)=>text([855,970,1155,1340][i],802,v,17,muted));
[...by].forEach(([x,ss],i)=>{const ys=ss.map(s=>`${s.y0}…${s.y1}`);text(855,837+i*30,String(x-g.anchor-.5),18,ink);text(970,837+i*30,ys[0],18,pal[0]);text(1155,837+i*30,ss.length===3?ys[1]:'—',18,pal[1]);text(1340,837+i*30,ys.at(-1),18,pal[2]);});
text(60,1050,'Новая расчётная карта · 27.10.2026 · mayatnik-core.js + mayatnik-auto-axes.js · исходные биты не окрашивались',16,muted);
svg.push('</g></svg>');
const dir=path.join(root,'issledovanie'),stem='mayatnik-auto-axes-map';fs.writeFileSync(path.join(dir,stem+'.svg'),svg.join('\n'));
const data={params,geometry:g,crop:{left:lo,right:hi},sha256:crypto.createHash('sha256').update(f.val).digest('hex'),triangles,segments};fs.writeFileSync(path.join(dir,stem+'.json'),JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({triangles:triangles.length,segments:segments.length,axes:by.size,crop:[lo,hi],sha256:data.sha256}));
if(process.argv.includes('--png'))(async()=>{const{chromium}=require(process.env.MAYATNIK_PLAYWRIGHT_MODULE||'playwright'),browser=await chromium.launch({channel:'chrome',headless:true});try{const page=await browser.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});await page.goto('file:///'+path.join(dir,stem+'.svg').replaceAll('\\','/'));await page.screenshot({path:path.join(dir,stem+'.png')});}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
