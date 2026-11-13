'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {analyzeGraph}=require('./graph-analysis.cjs');
function graph(pairs,coordinates={}){
  const ids=[...new Set(pairs.flat())];return {nodes:ids.map(id=>({id,...(coordinates[id]||{})})),edges:pairs.map(([from,to],i)=>({id:'e'+i,from,to}))};
}
function verify(g,a=analyzeGraph(g)){
  const visited=[];
  for(const trail of a.trails){
    assert.equal(trail.edgeCount,trail.edges.length);assert.equal(trail.visits.length,trail.edges.length+1);
    for(let i=0;i<trail.edges.length;i++){
      const edge=trail.edges[i];assert.equal(edge.from,trail.nodeIds[i]);assert.equal(edge.to,trail.nodeIds[i+1]);
      const original=g.edges.find(e=>String(e.id)===edge.id);
      assert.ok(original);assert.ok((String(original.from)===edge.from&&String(original.to)===edge.to)||(String(original.to)===edge.from&&String(original.from)===edge.to));
      visited.push(edge.id);
    }
  }
  assert.equal(visited.length,g.edges.length);assert.equal(new Set(visited).size,g.edges.length);assert.equal(a.trails.length,a.minimumTrails);
  return a;
}
test('open chain and circuit have valid single strokes; closure is not an intersection',()=>{
  const chain=verify(graph([['a','b'],['b','c']]));assert.equal(chain.classification,'path');assert.equal(chain.minimumTrails,1);assert.equal(chain.repeatedNodeCount,0);
  const cycle=verify(graph([['a','b'],['b','c'],['c','a']]));assert.equal(cycle.classification,'circuit');assert.equal(cycle.repeatedNodeCount,0);assert.equal(cycle.trails[0].visits.at(-1).isClosure,true);
});
test('a four-arm crossing is impossible as one stroke despite a degree-four center',()=>{
  const g=graph([['o','w'],['o','e'],['o','n'],['o','s']],{o:{x:0,y:0},w:{x:-1,y:0},e:{x:1,y:0},n:{x:0,y:-1},s:{x:0,y:1}});
  const a=verify(g);assert.equal(a.classification,'too-many-odd');assert.equal(a.minimumTrails,2);assert.equal(a.crossingCount,1);assert.equal(a.oddNodes.length,4);
});
test('figure eight revisits its shared crossing exactly twice cyclically',()=>{
  const g=graph([['o','w'],['w','n'],['n','o'],['o','e'],['e','s'],['s','o']],{o:{x:0,y:0},w:{x:-1,y:0},e:{x:1,y:0},n:{x:0,y:-1},s:{x:0,y:1}});
  const a=verify(g),o=a.nodes.find(n=>n.id==='o');assert.equal(a.classification,'circuit');assert.equal(a.crossingCount,1);assert.equal(o.cyclicVisitCount,2);
  assert.ok(a.trails[0].visits.filter(v=>v.label===o.label).length>=2);
});
test('degree-four junction without opposite tangent pairs is not called a crossing',()=>{
  const g=graph([['o','a'],['o','b'],['o','c'],['o','d']],{o:{x:0,y:0},a:{x:1,y:0},b:{x:1,y:1},c:{x:0,y:1},d:{x:-1,y:1}});
  const a=verify(g);assert.equal(a.degree4Count,1);assert.equal(a.crossingCount,0);assert.equal(a.nodes.find(n=>n.id==='o').kind,'junction');
  const unknown=verify(graph([['o','a'],['o','b'],['o','c'],['o','d']]));assert.equal(unknown.nodes.find(n=>n.id==='o').kind,'degree4-unknown');
});
test('disconnected contour loops require separate strokes, and isolated points are explicit',()=>{
  const g=graph([['a','b'],['b','c'],['c','a'],['d','e'],['e','f'],['f','d']]);g.nodes.push({id:'dot'});
  const a=verify(g);assert.equal(a.classification,'disconnected');assert.equal(a.minimumTrails,2);assert.deepEqual(a.isolatedNodes,['dot']);
});
test('self-loops and parallel edges are individual edges, not duplicate adjacency errors',()=>{
  const g=graph([['a','a'],['a','b'],['a','b'],['b','b']]);const a=verify(g);
  assert.equal(a.classification,'circuit');assert.deepEqual(a.nodes.map(n=>n.degree),[4,4]);
});
test('closed leftovers splice into open trails without inserting joins or edge repeats',()=>{
  const g=graph([['o','a'],['o','b'],['o','c'],['o','d'],['o','p'],['p','q'],['q','o'],['p','u'],['u','v'],['v','p']]);
  const a=verify(g);assert.equal(a.minimumTrails,2);assert.equal(a.edgeCount,10);
});
test('crossing drawn between edges is not automatically converted to a shared vertex',()=>{
  const g=graph([['a','b'],['c','d']],{a:{x:-1,y:0},b:{x:1,y:0},c:{x:0,y:-1},d:{x:0,y:1}});
  const a=verify(g);assert.equal(a.componentCount,2);assert.equal(a.crossingCount,0);
});
test('arclength, oriented polylines and normalized visit positions are usable for unrolling',()=>{
  const g={nodes:[{id:'a',x:0,y:0},{id:'b',x:2,y:1},{id:'c',x:2,y:4}],edges:[{id:'ab',from:'a',to:'b',points:[[0,0],[2,0],[2,1]]},{id:'cb',from:'c',to:'b'}]};
  const a=verify(g);assert.equal(a.totalLength,6);assert.equal(a.metric,'arc-length');assert.equal(a.trails[0].visits[1].u,.5);
  assert.equal(a.trails[0].edges[1].reversed,true);assert.deepEqual(a.trails[0].edges[1].points,[[2,1],[2,4]]);
});
test('empty graph has no strokes; malformed topology is rejected without mutation',()=>{
  const g={nodes:[{id:'a'}],edges:[]};assert.equal(verify(g).classification,'empty');assert.equal(analyzeGraph(g).minimumTrails,0);
  assert.throws(()=>analyzeGraph({nodes:[{id:'a'},{id:'a'}],edges:[]}));
  assert.throws(()=>analyzeGraph({nodes:[{id:'a'}],edges:[{id:'e',from:'a',to:'missing'}]}));
  const bad={nodes:[{id:'a',x:0,y:0}],edges:[{id:'e',from:'a',to:'a',points:[[1,0],[0,0]]}]};const copy=structuredClone(bad);assert.throws(()=>analyzeGraph(bad));assert.deepEqual(bad,copy);
});
test('deterministic seeded multigraph samples satisfy minimal decomposition and full coverage',()=>{
  let seed=19;const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
  for(let k=0;k<400;k++){
    const count=1+random(12),pairs=Array.from({length:random(45)},()=>['n'+random(count),'n'+random(count)]);
    const g=graph(pairs),a=verify(g);assert.deepEqual(analyzeGraph(g),a);
  }
});
