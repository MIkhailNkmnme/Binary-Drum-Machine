const assert=require('node:assert/strict');
const {test}=require('node:test');
const M=require('./mayatnik-line-measures.js');
const line=(a,b)=>({a,b});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const label=(id,x,y,span=100)=>({id,x,y,span,w:42,h:16,whole:false,vertical:false});

test('dense dimensions have a viewport budget and never touch each other',()=>{
  const candidates=[];for(let y=0;y<1000;y+=10)for(let x=0;x<1200;x+=10)candidates.push(label(x+':'+y,x,y));
  for(const [w,h,max]of[[1200,1000,32],[400,500,8]]){
    const placed=M.layoutLabels(candidates,w,h);assert.ok(placed.length>0&&placed.length<=max);
    for(const a of placed){assert.ok(a.left>=2&&a.top>=2&&a.right<=w-2&&a.bottom<=h-2);
      for(const b of placed)if(a!==b)assert.ok(a.right+6<=b.left||b.right+6<=a.left||a.bottom+6<=b.top||b.bottom+6<=a.top);
    }
  }
});
test('short dimensions wait for zoom and larger visible lines keep priority',()=>{
  const short=label('short',50,50,79),large={...label('large',50,50,400),whole:true},small=label('small',50,50,100);
  assert.deepEqual(M.layoutLabels([short],300,200),[]);
  assert.equal(M.layoutLabels([{...short,span:80}],300,200).length,1);
  const placed=M.layoutLabels([small,large],300,200);assert.equal(placed[0].id,'large');
  assert.deepEqual(M.layoutLabels([large,small],300,200),placed);
});

test('crossings divide both lines; their parts sum to the full bit length',()=>{
  const lines=M.split([line([0,0],[10,0]),line([4,-4],[4,4])]);
  assert.deepEqual(lines.map(l=>l.segments.map(s=>s.length)),[[4,6],[4,4]]);
  for(const l of lines)near(l.segments.reduce((n,s)=>n+s.length,0),l.length);
});
test('diagonal steps, half-bit intersections and shared endpoints',()=>{
  const lines=M.split([line([0,0],[10,10]),line([2.5,-2],[2.5,8]),line([0,0],[-3,0])]);
  assert.deepEqual(lines[0].segments.map(s=>Math.round(s.length*100)/100),[2.5,7.5]);
  assert.equal(lines[2].segments.length,1);
  near(lines[0].length,10);
});
test('overlapping copies form one line while separated collinear lines stay separate',()=>{
  const lines=M.split([line([0,0],[10,0]),line([12,0],[4,0]),line([20,0],[25,0]),line([0,2],[12,2])]);
  assert.deepEqual(lines.map(l=>l.length),[12,5,12]);
  assert.ok(lines.every(l=>l.segments.length===1));
});
test('degenerate and invalid lines do not produce numbers or spurious cuts',()=>{
  assert.deepEqual(M.split([line([0,0],[0,0]),line([NaN,0],[1,1])]),[]);
  assert.equal(M.clip([0,0],[10,0],{left:2,right:8,top:1,bottom:3}),null);
  assert.deepEqual(M.clip([0,0],[10,10],{left:2,right:8,top:1,bottom:9}),[[2,2],[8,8]]);
});
test('many guide lines use exact intersections without losing endpoints',()=>{
  const input=[];for(let i=0;i<50;i++){input.push(line([0,i],[49,i]));input.push(line([i,0],[i,49]));}
  const result=M.split(input);assert.equal(result.length,100);
  assert.ok(result.every(l=>l.segments.length===49));
  assert.ok(result.every(l=>l.segments.every(s=>Math.abs(s.length-1)<1e-8)));
});
test('Canvas capture preserves drawing calls, clip rectangles and bit coordinates',()=>{
  let strokes=0;const context={strokeStyle:'#ffffff',beginPath(){},moveTo(){},lineTo(){},save(){},restore(){},rect(){},clip(){},stroke(){strokes++;}};
  const captured=M.capture(context,G=>{
    assert.equal(G.measureTarget,context);G.save();G.beginPath();G.rect(14,18,12,10);G.clip();
    G.beginPath();G.moveTo(10,20);G.lineTo(30,20);G.stroke();G.restore();
    G.beginPath();G.moveTo(10,20);G.lineTo(10,1000);G.recordLine([10,20],[10,40],{replace:true});G.stroke();
  },{origin:[10,20],scale:2});
  assert.equal(strokes,2);
  assert.deepEqual(captured.map(l=>[l.a,l.b]),[[[2,0],[8,0]],[[0,0],[0,10]]]);
});

test('manual axis metadata survives measurement splitting and renders two SVG passes in both palettes',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),AxisStyle=require('./mayatnik-axis-style.js'),source=fs.readFileSync(__dirname+'/mayatnik-line-measures.js','utf8'),start=source.indexOf('      const foreground='),end=source.indexOf('      items=new Map();',start);
 const input=[{a:[0,0],b:[20,0],color:'#7cbcff',axisPrimary:'#7cbcff'},{a:[10,-10],b:[10,10],color:'#ffcf73',axisPrimary:'#ffcf73'},{a:[0,-10],b:[20,10],color:'#c89aff',axisPrimary:'#c89aff'},{a:[0,30],b:[20,30],color:'#123456'}];
 const split=M.split(input);assert.deepEqual(split.map(l=>l.axisPrimary),['#7cbcff','#ffcf73','#c89aff',undefined]);assert.ok(split.slice(0,3).every(l=>l.segments.length===2));
 for(const axisPalette of ['purple-black','purple-red']){let drawn;const document={createElementNS(){return{style:{},attrs:{},setAttribute(k,v){this.attrs[k]=v;}};}};
  vm.runInNewContext(source.slice(start,end),{input,view:{axisPalette},p:v=>v,merge:M.merge,PURPLE:AxisStyle.PURPLE,AxisStyle,document,ns:'svg',guides:{replaceChildren(...paths){drawn=paths;}}});
  assert.equal(drawn.length,7);for(let i=0;i<3;i++){assert.equal(drawn[2*i].style.stroke,AxisStyle.palette(axisPalette)[1]);assert.equal(drawn[2*i].attrs['stroke-dasharray'],undefined);assert.equal(drawn[2*i+1].style.stroke,input[i].color);assert.equal(drawn[2*i+1].attrs['stroke-dasharray'],'6 6');}assert.equal(drawn[6].style.stroke,'#123456');assert.equal(drawn[6].attrs['stroke-dasharray'],undefined);
 }
});
