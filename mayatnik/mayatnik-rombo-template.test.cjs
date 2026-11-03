const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync(require.resolve('./Zerkalius-mayatnik.html'),'utf8');
function source(name){const a=html.indexOf('  function '+name+'('),b=html.indexOf('\n  }',a);assert.ok(a>0&&b>a,name);return html.slice(a,b+4);}
test('real tiled canvas keeps two CSS pixels of template edge on every zoomed or reflected copy',async t=>{
 let chromium;try{chromium=require(process.env.PLAYWRIGHT_PATH||'C:/Users/Mhl/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright').chromium;}catch{t.skip('Playwright unavailable');return;}
 const executablePath=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';if(!fs.existsSync(executablePath)){t.skip('Chromium unavailable');return;}
 const browser=await chromium.launch({executablePath,headless:true});
 try{
  const page=await browser.newPage();for(const name of ['mayatnik-triangle-assembly','mayatnik-rombo','mayatnik-template'])await page.addScriptTag({path:require.resolve('./'+name+'.js')});
  await page.addScriptTag({content:`
   const playing=false,templateCanvas={hidden:false},templatePickedIds=new Set(['a']),RK=1;
   const part={ox:0,mask:{width:1,height:1,data:Uint32Array.of(1)}},item={id:'a',view:{visible:true,alpha:100},parts:[part]},templateItems=[item];
   const colourTemplate=null,templateVisible=true,templatePartWidth=()=>31,dispH=()=>8,templatePaintCanvas=()=>null,rememberTemplate=()=>{},templateRect=()=>part.mask;
   `+[source('paintTemplate'),source('paintTemplateBox'),source('paintRomboTemplate')].join('\n')});
  const result=await page.evaluate(()=>{
   const unit=128,canvas=document.createElement('canvas');canvas.width=canvas.height=33;
   const g=canvas.getContext('2d',{willReadFrequently:true}),R=MayatnikRombo;
   let count=0;for(const {id} of R.variants)for(let angle=0;angle<360;angle+=45)for(const seam of ['dedupe','between']){
    const plan=R.plan(31,8,{assembly:id,angle,row:8,seam},{sides:true});
    for(const copy of plan.parts){
     const row=copy.rows.find(r=>r.right-r.left>=3);if(!row)continue;
     Object.assign(part.mask,{x:row.left+1,y:row.y});const native={x:part.mask.x+1,y:row.y+.5};
     const project=p=>plan.forward(R.point(copy.matrix,p)),a=project(native),b=project({...native,x:native.x+.01}),len=Math.hypot(b.x-a.x,b.y-a.y),nx=(b.x-a.x)/len,ny=(b.y-a.y)/len;
     for(const dpr of [1,1.25,2]){
      const q=unit*dpr,ox=Math.floor(a.x*q)-16,oy=Math.floor(a.y*q)-16,cx=a.x*q-ox,cy=a.y*q-oy;
      // An independent 33 px tile around the transformed edge. Native source
      // screen coordinates can be thousands of pixels outside this canvas.
      g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,33,33);g.setTransform(q,0,0,q,-ox,-oy);
      paintRomboTemplate(g,plan,q,unit);const pixels=g.getImageData(0,0,33,33).data;
      const sample=d=>{const i=(Math.floor(cy+ny*d)*33+Math.floor(cx+nx*d))*4;return pixels.slice(i,i+4);};
      const mid=sample(0),offset=3*dpr;if(mid[0]<200||mid[3]<100||sample(-offset)[3]||sample(offset)[3])return {id,angle,seam,part:copy.id,dpr,mid:Array.from(mid),count};
      count++;
     }
    }
   }
   return {count};
  });
  assert.ok(result.count>1000&&!('mid' in result),JSON.stringify(result));
 }finally{await browser.close();}
});
