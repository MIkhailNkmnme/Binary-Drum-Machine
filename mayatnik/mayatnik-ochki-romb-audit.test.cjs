const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
function fn(name){const a=html.indexOf('function '+name+'('),b=html.indexOf('{',a);assert.ok(a>=0,name);let i=b+1,d=1;for(;d;i++){if(html[i]==='{')d++;if(html[i]==='}')d--;}return html.slice(a,i);}
const finderSource=html.slice(html.indexOf('  let ochki = null;'),html.indexOf('  function updWin()'));
const colour=rgb=>(0xff000000|rgb[2]<<16|rgb[1]<<8|rgb[0])>>>0;
const T=Uint32Array.from([colour([40,40,40]),0,0,colour([220,220,220]),0,0]),empty=colour([0,0,0]),HL1=colour([255,214,70]),HL0=colour([150,86,30]);
const directions={diag:[1,1,1],antidiag:[-1,1,-1],row:[2,0,0],col:[0,2,2]};
test('screen bins union zero/one collisions once and never invent a match in an empty or unmarked cell',()=>{
  const c=fixture('flat','diag',1),hl=Uint8Array.from([1,1,1,0,1]),val=Int8Array.from([0,1,0,1,-1]);
  const bins=c.ochkiMaskBins({hl},val,3,1,q=>({x:q<2?.5:1.5,y:.5}));
  assert.deepEqual([...bins].map(a=>Array.from(a)),[[0,3],[1,1]]);assert.deepEqual(Array.from(c.ochkiBinColour(3)),[203,150,50]);
  const painted=[],ctx={save(){},restore(){},setTransform(...v){assert.deepEqual(v,[1,0,0,1,0,0]);},fillRect(...v){painted.push([this.fillStyle,this.globalAlpha,...v]);}};
  c.paintOchkiBins(ctx,bins,3,185/255);assert.deepEqual(painted,[['rgb(203,150,50)',185/255,0,0,1,1],['rgb(150,86,30)',185/255,1,0,1,1]]);
});
test('small-scale presentation retains every found centre with zero/one distinction and leaves source data unchanged',()=>{
  for(const view of ['flat','romb0','romb1','romb2'])for(const rk of [1,2,4])for(const zoom of [.125,.3,.5,.9])for(const d of [1,2]){
    if(zoom*d>=1)continue;
    const c=fixture(view,'diag',rk);c.st.zoom=zoom;c.DPR=()=>d;const O=c.ochkiGet(),before=c.f.val.slice();
    const pixels=new Uint32Array(c.img.width*c.img.height);if(view==='flat')pixels.fill(empty);else c.drawRomb(pixels,T,empty,O.hl);
    c.img.data=new Uint8ClampedArray(pixels.buffer);const source=c.img.data.slice(),w=Math.max(1,Math.round(c.img.width*zoom*d/rk)),h=Math.max(1,Math.round(c.img.height*zoom*d/rk));
    const expected=new Map();for(let q=0;q<O.hl.length;q++)if(O.hl[q]){const r=Math.floor(q/c.f.W),col=q%c.f.W,p=(col-c.geo.anchor-r)&1;
      const x=Math.floor((col-c.VX+.5+(view==='romb2'&&p===1?c.VW+c.RG:0))*w/(c.img.width/rk)),y=Math.floor((r+.5)*h/(c.img.height/rk));
      expected.set(y*w+x,(expected.get(y*w+x)||0)|(c.f.val[q]?2:1));}
    assert.deepEqual([...c.ochkiScreenBins(w,h)].map(a=>Array.from(a)),[...expected],view+'/'+rk+'/'+zoom+'/'+d);
    const base={width:w,height:h,data:new Uint8ClampedArray(w*h*4)};c.downsampleRaster(c.img,base);
    let presented;Object.assign(c,{gpuBig:null,pxView:()=>c.img,cv:{width:0,height:0,style:{}},shown:null,g:{createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}),putImageData:im=>presented=im},layerService(){}});
    for(const name of ['align','bothDraw','mirDraw','contourDraw','rowLabDraw','flashDraw','sectorDraw','axisLogTick','fixOvDraw','areaFreezeDraw','ovlDraw','queueLineMeasures'])c[name]=()=>{};
    vm.runInContext(fn('present'),c);c.present(false);
    for(let i=0;i<w*h;i++){const flags=expected.get(i),want=flags?[...c.ochkiBinColour(flags),255]:Array.from(base.data.slice(i*4,i*4+4));assert.deepEqual(Array.from(presented.data.slice(i*4,i*4+4)),want);}
    assert.deepEqual(c.img.data,source);assert.deepEqual(c.f.val,before);c.present(false);assert.deepEqual(c.img.data,source,'repainting never accumulates display colour in the source');
    const quick=[];Object.assign(c.g,{save(){},restore(){},setTransform(){},clearRect(){},drawImage(){},fillRect(x,y,bw,bh){quick.push([y*w+x,this.fillStyle,bw,bh]);}});c.document={createElement:()=>({getContext:()=>({putImageData(){}})})};
    c.present(true);assert.deepEqual(quick,[...expected].map(([i,flags])=>[i,'rgb('+c.ochkiBinColour(flags).join(',')+')',1,1]));assert.deepEqual(c.img.data,source,'quick presentation also only paints the output');
    c.st.zoom=1;assert.equal(c.ochkiScreenBins(w,h).size,0);c.st.zoom=zoom;c.resetOchkiFindings(false);assert.equal(c.ochkiScreenBins(w,h).size,0);
    c.st.view='digits';assert.equal(c.ochkiScreenBins(w,h).size,0,'old view findings cannot leak through a presentation-only redraw');
  }
});
test('local-overlay bins use the same exact projected centres after translation, scaling and grouped-cell capture',()=>{
  const c=fixture('flat','diag',1),bits={W:8,H:4,anchor:3,anchorRaw:7,val:Int8Array.from({length:32},(_,q)=>q%2)},O={hl:Uint8Array.from({length:32},(_,q)=>q%3===0?1:0)};
  for(const q of [1,3])for(const d of [1,2])for(const total of [2,4]){
    const S={bits,q,cell:.04,ax:5.2,ay:3.8},ox=-1.4,oy=2.1,before=bits.val.slice();
    const bins=c.ochkiOverlayBins(O,S,30,30,d,d,ox,oy,total),expected=new Map();
    for(let i=0;i<O.hl.length;i++)if(O.hl[i]){const col=i%8,row=Math.floor(i/8);let x,y;
      if(q>1){x=S.ax+(bits.anchor*q-bits.anchorRaw-.5)*S.cell+(col+.5)*q*S.cell;y=S.ay+(row+.5)*q*S.cell;}
      else {const originalX=S.ax+(col-bits.anchor)*S.cell,originalY=S.ay+row*S.cell,pivotY=S.ay+bits.H*S.cell/2;x=S.ax+(originalX-S.ax)*total;y=pivotY+(originalY-pivotY)*total;}
      const n=Math.floor((y+oy)*d)*30+Math.floor((x+ox)*d);expected.set(n,(expected.get(n)||0)|(bits.val[i]?2:1));}
    assert.deepEqual([...bins].map(a=>Array.from(a)),[...expected]);assert.deepEqual(bits.val,before);assert.equal(c.ochkiOverlayBins(O,{...S,cell:1},30,30,d,d,ox,oy,total),null,'large cells retain the original overlay raster');
  }
});
function fixture(view,mode,rk){
  const W=16,H=10,VX=2,VW=12,anchor=6,RG=view==='romb2'?3:0;let seed=123456;
  const val=Int8Array.from({length:W*H},()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return(seed>>>16)%2;});
  const st={view,ochki:true,ochkiMode:mode,ochkiPattern:'initial',ochkiLength:4,mode:'pend',bg:'empty',zoom:1,frozen:false};
  const nodes=new Map(),c={st,f:{W,H,val},geo:{anchor},k:4,VX,VW,VH:H,RG,RK:rk,img:{width:(view==='romb2'?2*VW+RG:VW)*rk,height:H*rk},playing:false,ZL:[],ZR:[],ovlSerial:0,TextDecoder,performance,Date,Uint32Array,Uint8Array,Uint8ClampedArray,Int8Array,Float64Array,
    $:id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:false,selectedOptions:[{textContent:'Начальная'}]});return nodes.get(id);},sequences:{rows:['1011'],revision:1,setMatches(){}},setTimeout:()=>0,clearTimeout(){},localStorage:{getItem:()=>null,setItem(){}},window:{},pairOn:()=>false,parityVisible:()=>true,outShow:()=>false,outZone:()=>false,joinedOn:()=>false,rgba:colour,HL0,HL1,
    DPR:()=>1,scale:()=>st.zoom,rombP:()=>view==='flat'?-1:view==='romb0'?0:view==='romb1'?1:2,clampInt:(v,a,b,d)=>Math.max(a,Math.min(b,+v||d))};
  c.halfOf=fx=>c.rombP()!==2?[c.rombP(),fx]:fx<VW?[0,fx]:fx>=VW+RG?[1,fx-VW-RG]:null;
  Object.assign(c,{gpuBig:null,gpuDisplay:()=>false});vm.createContext(c);vm.runInContext(finderSource,c);for(const name of ['drawRomb','downsampleRaster','rombCell','displayCell','displayPoint'])vm.runInContext(fn(name),c);return c;
}
function logicalCandidates(c){
  const [dx,dy,dir]=directions[c.st.ochkiMode],out=new Map();
  for(const p of c.st.view==='romb0'?[0]:c.st.view==='romb1'?[1]:[0,1]){
    const candidates=[];
    for(let r=0;r<c.VH;r++)for(let col=c.VX;col<c.VX+c.VW;col++){
      if(((col-c.geo.anchor-r)&1)!==p)continue;
      const cells=[];let text='';for(let j=0;j<4;j++){const x=col+dx*j,y=r+dy*j;if(x<c.VX||x>=c.VX+c.VW||y<0||y>=c.VH)break;cells.push(y*c.f.W+x);text+=c.f.val[y*c.f.W+x];}
      if(text==='1011')candidates.push({cells,dir});
    }
    out.set(p,candidates);
  }
  return out;
}
test('odd/even/both diamond searches match an independent logical oracle at small zooms and every raster scale',()=>{
  for(const view of ['romb0','romb1','romb2'])for(const mode of Object.keys(directions))for(const rk of [1,2,4,8]){
    const c=fixture(view,mode,rk),before=c.f.val.slice(),expected=logicalCandidates(c);let first;
    for(const zoom of [.125,.3,.5,.9,1,8]){
      c.st.zoom=zoom;const result=c.ochkiGet(true),cells=Array.from(result.hl);
      assert.equal(result.found.length,[...expected.values()].filter(v=>v.length).length,view+'/'+mode+'/'+rk+'/'+zoom);
      for(const hit of result.found){assert.ok(expected.get(hit.p).some(v=>v.cells.join(',')===Array.from(hit.cells).join(',')));assert.ok(hit.cells.every(q=>((q%c.f.W-c.geo.anchor-Math.floor(q/c.f.W))&1)===hit.p));}
      if(first)assert.deepEqual(cells,first);else first=cells;
    }
    assert.deepEqual(c.f.val,before);
  }
});
test('diamond raster colours and gold highlights occupy only nearest centres of the requested lattice, including ties',()=>{
  for(const view of ['romb0','romb1','romb2'])for(const rk of [1,2,4,8]){
    const c=fixture(view,'diag',rk),result=c.ochkiGet(true),pixels=new Uint32Array(c.img.width*c.img.height);c.drawRomb(pixels,T,empty,result.hl);
    for(let y=0;y<c.img.height;y++)for(let x=0;x<c.img.width;x++){
      const fx=(x+.5)/rk,fy=(y+.5)/rk,half=c.halfOf(fx),actual=pixels[y*c.img.width+x];
      if(!half){assert.equal(actual,colour([79,143,220]));continue;}
      const [p,lx]=half,near=[];let min=Infinity;
      for(let r=Math.floor(fy)-2;r<=Math.floor(fy)+2;r++)for(let col=Math.floor(lx+c.VX)-2;col<=Math.floor(lx+c.VX)+2;col++){
        if(((col-c.geo.anchor-r)&1)!==p)continue;const distance=Math.abs(lx-(col-c.VX+.5))+Math.abs(fy-(r+.5));
        if(distance<min-1e-9){min=distance;near.length=0;}if(Math.abs(distance-min)<1e-9){const valid=col>=c.VX&&col<c.VX+c.VW&&r>=0&&r<c.VH,q=r*c.f.W+col,bit=valid?c.f.val[q]:-1;near.push(bit<0?empty:result.hl[q]?(bit?HL1:HL0):T[bit*3]);}
      }
      assert.ok(near.includes(actual),view+'/'+rk+' pixel '+x+','+y);
    }
  }
});
function averageReference(pic,width,height){
  const out=new Uint8ClampedArray(width*height*4),sx=pic.width/width,sy=pic.height/height;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const sums=[0,0,0,0],L=x*sx,R=(x+1)*sx,U=y*sy,D=(y+1)*sy;
    for(let yy=Math.floor(U);yy<Math.ceil(D);yy++)for(let xx=Math.floor(L);xx<Math.ceil(R);xx++){
      const weight=(Math.min(R,xx+1)-Math.max(L,xx))*(Math.min(D,yy+1)-Math.max(U,yy)),q=(yy*pic.width+xx)*4,a=pic.data[q+3];for(let k=0;k<3;k++)sums[k]+=pic.data[q+k]*a*weight;sums[3]+=a*weight;
    }
    const q=(y*width+x)*4;for(let k=0;k<3;k++)out[q+k]=sums[3]?Math.round(sums[k]/sums[3]):0;out[q+3]=Math.round(sums[3]/(sx*sy));
  }
  return out;
}
test('small-zoom diamond display is exact colour-area averaging, with no lattice or highlight-coordinate substitution',()=>{
  for(const view of ['romb0','romb1','romb2'])for(const rk of [1,2,4]){
    const c=fixture(view,'diag',rk),result=c.ochkiGet(true),raw=new Uint32Array(c.img.width*c.img.height);c.drawRomb(raw,T,empty,result.hl);const pic={...c.img,data:new Uint8ClampedArray(raw.buffer)};
    for(const zoom of [.125,.3,.5,.9])for(const dpr of [1,2]){
      const width=Math.max(1,Math.round(pic.width*zoom*dpr/rk)),height=Math.max(1,Math.round(pic.height*zoom*dpr/rk));if(width>pic.width||height>pic.height)continue;
      const out={width,height,data:new Uint8ClampedArray(width*height*4)};c.downsampleRaster(pic,out);const expected=averageReference(pic,width,height);
      for(let i=0;i<out.data.length;i++)assert.ok(Math.abs(out.data[i]-expected[i])<=1,view+'/'+rk+'/'+zoom+'/'+dpr+' channel '+i);
    }
  }
});
