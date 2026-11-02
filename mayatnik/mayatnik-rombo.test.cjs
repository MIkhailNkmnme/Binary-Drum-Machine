const {test}=require('node:test'),assert=require('node:assert/strict');
const R=require('./mayatnik-rombo.js'),C=require('./mayatnik-center.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('all 16 assemblies and eight turns preserve the crop and inverse cell addresses',()=>{
  for(const width of [1,8,9])for(const row of [1,3,5])for(let assembly=0;assembly<16;assembly++)for(let angle=0;angle<360;angle+=45){
    const p=R.plan(width,5,{row,assembly,angle});
    assert.equal(p.row,row);assert.equal(p.angle,angle);
    for(const tile of p.parts)for(let y=0;y<row;y++)for(let x=tile.left;x<tile.right;x++){
      const src={x:x+.5,y:y+.5},q=p.forward(R.point(tile.matrix,src)),back=p.pick(q);
      assert.ok(back);
      if(back.part===tile.id){near(back.x,src.x);near(back.y,src.y);}
      else { // Odd duplicated right halves overlap by one column: the last painted copy owns it.
        const visible=p.parts.find(t=>t.id===back.part);assert.ok(p.parts.indexOf(visible)>p.parts.indexOf(tile));
        const again=p.forward(R.point(visible.matrix,back));near(again.x,q.x);near(again.y,q.y);
      }
      assert.ok(q.x>=-1e-8&&q.y>=-1e-8&&q.x<=p.outputWidth+1e-8&&q.y<=p.outputHeight+1e-8);
    }
    assert.equal(p.pick({x:-100,y:-100}),null);
    for(const tile of p.parts)near(Math.abs(tile.matrix[0]*tile.matrix[3]-tile.matrix[1]*tile.matrix[2]),1);
  }
});

test('odd half widths retain cell size; duplicated halves anchor at the outer edges',()=>{
  const left=R.plan(9,5,{assembly:0}),right=R.plan(9,5,{assembly:5});
  assert.equal(left.parts[1].right-left.parts[1].left,4);
  assert.equal(right.parts[1].right-right.parts[1].left,5);
  assert.equal(left.pick({x:4.5,y:6.5}),null);
  near(left.pick({x:5.5,y:6.5}).x,.5);
  assert.equal(right.pick({x:4.5,y:6.5}).part,'lower1');
});

test('crop axis folds only retained rows; centroid counts remain invariant through eight turns',()=>{
  for(let assembly=0;assembly<16;assembly++){
    let count;
    for(let angle=0;angle<360;angle+=45){
      const p=R.plan(9,5,{row:3,assembly,angle}),read=(x,y)=>x<=y?0:-1;
      const figure=C.compose(p.parts.map(t=>({id:t.id,width:9,height:t.height,left:t.left,right:t.right,transform:t.matrix,read})));
      assert.equal(figure.count,count??figure.count);count=figure.count;
      const turned=p.forward(figure.center),back=p.unrotate(turned);near(back.x,figure.center.x);near(back.y,figure.center.y);
      assert.equal(p.parts[0].height,3);assert.equal(p.outputHeight>0,true);
    }
  }
});

function host(){
  const state={edgeRhombOn:true,romboRow:3,romboAngle:0,romboAssembly:1},listeners={},r={left:200,top:100,width:90,height:50},classes=new Set();
  const style={},source={width:9,height:5,style:{},getBoundingClientRect:()=>({...r})};
  const ctx={canvas:null,setTransform(){},fillRect(){},save(){},restore(){},transform(){},beginPath(){},rect(){},clip(){},drawImage(){},moveTo(){},lineTo(){},stroke(){},setLineDash(){}};
  const box={style,getBoundingClientRect(){const t=/translate\(([-.\d]+)px, ([-.\d]+)px\)/.exec(style.transform||'');return {left:+(t?.[1]||0),top:r.top+r.height+2+(parseFloat(style.marginTop)||0)+ +(t?.[2]||0)};}};
  const canvas={style:{},width:1,height:1,getContext:()=>ctx,getBoundingClientRect(){const b=box.getBoundingClientRect();return {...b,width:parseFloat(canvas.style.width),height:parseFloat(canvas.style.height)};},setPointerCapture(){}};ctx.canvas=canvas;
  const win={Event:class{constructor(type){this.type=type;}},dispatchEvent(){},requestAnimationFrame:()=>1,cancelAnimationFrame(){},getComputedStyle:()=>({marginBottom:'2px'}),addEventListener(type,fn){listeners[type]=fn;}};
  const doc={defaultView:win,body:{classList:{toggle(key,on){on?classes.add(key):classes.delete(key);}}},createElement:()=>({getContext:()=>({drawImage(){}})})};
  const api=R.mount({host:{ownerDocument:doc},source,box,canvas,state:()=>state,geometry:()=>({width:9,height:5}),changed(){api.render();}});
  function event(type,x,y){const e={type,target:canvas,clientX:x,clientY:y,pointerId:1,button:0,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};listeners[type](e);return e;}
  return {api,state,source,box,canvas,r,classes,event};
}

test('projection follows fractional zoom and scroll without clamping or changing cell aspect',()=>{
  const h=host();
  for(const scale of [.125,1,2.75,20])for(const angle of [0,45,90,180,315]){
    Object.assign(h.r,{left:17.25-scale,top:-60.5+scale,width:9*scale,height:5*scale});h.state.romboAngle=angle;h.api.render();
    const p=h.api.plan(),r=h.canvas.getBoundingClientRect();near(r.width/p.outputWidth,scale);near(r.height/p.outputHeight,scale);
    near(r.left+r.width/2,h.r.left+h.r.width/2);near(r.top,h.r.top);
  }
  h.api.set(false);assert.equal(h.box.style.display,'none');assert.equal(h.classes.has('may-rombo-active'),false);
});

test('rotated copy input maps to native source cells; axis drag changes row without forwarding pointer events',()=>{
  const h=host();h.state.romboAngle=45;h.api.render();
  const p=h.api.plan(),q=p.forward(R.point(p.parts[1].matrix,{x:1.5,y:.5})),r=h.canvas.getBoundingClientRect();
  const e=h.event('pointermove',r.left+q.x*10,r.top+q.y*10);near(e.clientX,h.r.left+15);near(e.clientY,h.r.top+5);
  const a=p.forward({x:4,y:3}),down=h.event('pointerdown',r.left+a.x*10,r.top+a.y*10);assert.equal(down.stopped,true);
  const move=h.event('pointermove',down.clientX-Math.sin(Math.PI/4)*10,down.clientY+Math.cos(Math.PI/4)*10);assert.equal(move.stopped,true);assert.equal(h.state.romboRow,4);
  assert.equal(h.event('pointerup',move.clientX,move.clientY).stopped,true);
  assert.equal(h.event('click',move.clientX,move.clientY).stopped,true);
});
