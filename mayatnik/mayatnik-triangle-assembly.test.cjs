const {test} = require('node:test');
const assert = require('node:assert/strict');
const geo = require('./mayatnik-triangle-assembly.js');

const line=(a,b)=>({a,b});
const loop=vertices=>vertices.map((p,i)=>line(p,vertices[(i+1)%vertices.length]));
const find=(...segments)=>geo.find({width:10,height:10,segments});
const diagonal=line([0,0],[10,10]), other=line([10,0],[0,10]);
const near=(p,q)=>p.every((n,i)=>Math.abs(n-q[i])<1e-7);
const piece=(id,vertices)=>geo.normalize({width:10,height:10,pieces:[{id,vertices}]}).pieces[0];

test('finite diagonals and field boundaries divide only triangular faces',()=>{
  assert.deepEqual(find(),[]);
  assert.deepEqual(find(line([4,-1],[4,11])),[]);
  assert.deepEqual(find(diagonal).map(p=>p.area),[50,50]);
  assert.deepEqual(find(diagonal,other).map(p=>p.area),[25,25,25,25]);
  assert.deepEqual(find(line([-2,-2],[15,15])),find(diagonal));
});
test('finite T junctions split where connected; dangling pieces and gaps stay open',()=>{
  assert.deepEqual(find(line([0,0],[9,9])),[]);
  assert.deepEqual(find(line([0,0],[2,2]),line([3,3],[10,10])),[]);
  assert.deepEqual(find(diagonal,line([5,5],[7,4])),find(diagonal));
  assert.deepEqual(find(diagonal,line([5,5],[10,0])).map(p=>p.area).sort((a,b)=>a-b),[25,25,50]);
  assert.deepEqual(find(diagonal,line([5,5],[10,5])).map(p=>p.area).sort((a,b)=>a-b),[12.5,50]);
});
test('overlap, reversed input order, fractional endpoints and repeated lines',()=>{
  const a=line([0,.5],[4.75,0]), b=line([2.375,.25],[0,.5]);
  const p=find(a,b,line(b.b,b.a));
  assert.deepEqual(p,find(line(a.b,a.a)));
  assert.equal(p.length,1);
  assert.ok(Math.abs(p[0].area-1.1875)<1e-7);
  assert.deepEqual(find(diagonal,other),find(line(other.b,other.a),line(diagonal.b,diagonal.a)));
});
test('holes, multiple components and bridges between loops',()=>{
  const tri=loop([[2,1],[6,1],[6,3]]);
  const inside=loop([[4,1.25],[5,1.25],[5,1.5]]);
  const island=loop([[1,5],[2,5],[1,6]]);
  assert.deepEqual(find(diagonal,...tri).map(p=>p.area).sort((a,b)=>a-b),[4,50]);
  assert.deepEqual(find(diagonal,...tri,...inside,...island).map(p=>p.area).sort((a,b)=>a-b),[.125,.5]);
  assert.deepEqual(find(diagonal,...tri,line([6,3],[6,6])),find(diagonal,...tri));
  assert.deepEqual(find(diagonal,line([3,1],[4,1])),find(diagonal));
  const square=loop([[6,1],[7,1],[7,2],[6,2]]);
  assert.deepEqual(find(diagonal,...square).map(p=>p.area),[50]);
});
test('normalize detaches source geometry and preserves serializable layout and frame identity',()=>{
  const raw={width:10,height:10,scope:'flat/grid',sourceFrame:17,pieces:find(diagonal)};
  const result=geo.normalize(JSON.parse(JSON.stringify(raw)));
  assert.equal(result.scope,raw.scope); assert.equal(result.sourceFrame,17);
  assert.deepEqual(geo.normalize(JSON.parse(JSON.stringify(result))),result);
  assert.ok(Object.isFrozen(result.pieces[0].vertices[0]));
  const bad=overrides=>assert.equal(geo.normalize({...raw,...overrides}),null);
  bad({width:NaN}); bad({scope:{}}); bad({sourceFrame:-1}); bad({pieces:[raw.pieces[0],raw.pieces[0]]});
  bad({pieces:[{...raw.pieces[0],pose:{turn:0,flip:false,x:Infinity,y:0}}]});
  bad({pieces:[{id:'x',vertices:[[0,0],[2,2],[4,4]]}]});
  bad({pieces:[{id:'x',vertices:[[0,0],[2,2],[11,2]]}]});
  assert.throws(()=>find(line([NaN,0],[1,1])),/координаты/);
  assert.throws(()=>find(...Array.from({length:550},(_,i)=>line([i/60,0],[i/60,10]))),/Скрыть/);
});
test('all eight orientations and both parities round trip about the translated centroid',()=>{
  const base=piece('a',[[1,2],[7,2],[1,5]]), original=JSON.stringify(base.vertices);
  for(let turn=0; turn<8; turn++) for(const flip of [false,true]) {
    const p={...base,pose:{x:3,y:-2,turn,flip}};
    assert.ok(near(geo.forward(p,[3,3]),[6,1]));
    assert.ok(near(geo.inverse(p,geo.forward(p,[2.25,1.1])),[2.25,1.1]));
    const [a,b,c,d]=geo.matrix(p);
    assert.ok(Math.abs(a*d-b*c-(flip?-1:1))<1e-12);
    assert.equal(geo.rotate(p).turn,(turn+1)%8); assert.equal(geo.reflect(p).flip,!flip);
  }
  assert.equal(JSON.stringify(base.vertices),original);
  assert.deepEqual(geo.bounds({...base,pose:{x:1,y:2,turn:2,flip:false}}),{left:2,top:3,right:5,bottom:9});
});
test('pick uses reverse painter order and the transformed triangle, including its boundary',()=>{
  const a=piece('a',[[0,0],[3,0],[0,3]]), b={...a,id:'b',pose:{x:1,y:0,turn:0,flip:false}};
  assert.equal(geo.pick([a,b],[1.5,.5]).id,'b');
  assert.equal(geo.pick([a,b],[0,0]).id,'a');
  assert.equal(geo.pick([a,b],[2.1,2]),null);
  const reflected={...b,pose:{x:0,y:0,turn:1,flip:true}};
  assert.equal(geo.pick([reflected],geo.forward(reflected,[.2,.3])).id,'b');
});
test('snap full sides, partial parallel sides and vertices within the supplied distance',()=>{
  const moving=piece('moving',[[0,0],[4,0],[0,4]]), short=piece('short',[[2,4],[3,4],[3,5]]);
  const pos=(x,y)=>({...moving,pose:{...moving.pose,x,y}});
  const other=piece('other',[[0,4],[4,4],[4,8]]);
  assert.ok(near([geo.snap(pos(.13,4.11),[other],.3).x,geo.snap(pos(.13,4.11),[other],.3).y],[0,4]));
  assert.deepEqual(geo.snap(pos(0,4.12),[short],.2),pos(0,4).pose);
  assert.deepEqual(geo.snap(pos(-6,4.12),[short],.2),pos(-6,4.12).pose);
  const tip=piece('tip',[[5,5],[6,7],[8,8]]);
  const p=pos(5.1,5.05);
  assert.ok(near([geo.snap(p,[tip],.2).x,geo.snap(p,[tip],.2).y],[5,5]));
  assert.deepEqual(geo.snap(p,[tip],.01),p.pose);
  const left={...pos(-.125,0),id:'left'}, right={...pos(.125,0),id:'right'};
  assert.deepEqual(geo.snap(moving,[right,left],.2),left.pose);
  assert.deepEqual(geo.snap(moving,[left,right],.2),left.pose);
});
