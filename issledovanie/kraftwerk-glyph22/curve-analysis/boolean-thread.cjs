'use strict';
// Hand tracing of the supplied crop; unit edges, no photographic pixels altered.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {analyzeGraph}=require('./graph-analysis.cjs');
const lines=[[[4,0],[5,0],[5,2],[6,2],[6,4],[7,4],[7,5],[8,5],[8,6],[5,6],[5,12],[4,12],[4,11],[3,11],[3,6],[0,6],[0,5],[3,5],[3,2],[4,2],[4,0]],[[4,1],[5,1]],[[4,2],[5,2]],[[6,4],[5,4],[5,5],[6,5],[6,4]],[[5,8],[4,8],[4,9],[5,9]]];
const key=(a,b)=>[a,b].sort().join('|'),edgeMap=new Map();
for(const line of lines)for(let i=1;i<line.length;i++){
 let[x,y]=line[i-1];const[u,v]=line[i],dx=Math.sign(u-x),dy=Math.sign(v-y);
 assert(x===u||y===v);
 while(x!==u||y!==v){const a=[x,y].join(','),b=[x+dx,y+dy].join(','),id=key(a,b);edgeMap.set(id,{id,from:a,to:b});x+=dx;y+=dy;}
}
const edges=[...edgeMap.values()],nodes=[...new Set(edges.flatMap(e=>[e.from,e.to]))].map(id=>{const[x,y]=id.split(',').map(Number);return{id,x,y}}),graph={nodes,edges};
const original=analyzeGraph(graph),repeatIds=[key('4,1','5,1'),key('4,2','5,2')];
const repeated=repeatIds.map((id,i)=>({...edgeMap.get(id),id:'repeat-'+i,originalId:id}));
const open=analyzeGraph({nodes,edges:[...edges,...repeated]});
const closed=analyzeGraph({nodes,edges:[...edges,...repeated,{...edgeMap.get(key('5,8','5,9')),id:'repeat-close'}]});
assert.equal(original.edgeCount,49);assert.equal(original.componentCount,1);assert.equal(original.oddNodes.length,6);assert.equal(original.minimumTrails,3);
assert.equal(open.trails.length,1);assert.equal(open.edgeCount,51);assert.equal(open.canDrawSingleStroke,true);assert.equal(open.trails[0].closed,false);
assert.equal(closed.trails.length,1);assert.equal(closed.edgeCount,52);assert.equal(closed.trails[0].closed,true);
const route=open.trails[0].nodeIds,counts=new Map();
for(let i=1;i<route.length;i++){const id=key(route[i-1],route[i]);assert(edgeMap.has(id));counts.set(id,(counts.get(id)||0)+1);}
assert.equal(counts.size,49);assert.deepEqual([...counts].filter(([,n])=>n===2).map(([id])=>id).sort(),repeatIds.slice().sort());
assert.equal([...counts.values()].filter(n=>n%2).length,47);
const closedRoute=closed.trails[0].nodeIds,closedCounts=new Map();
assert.equal(closedRoute[0],closedRoute.at(-1));
for(let i=1;i<closedRoute.length;i++){const id=key(closedRoute[i-1],closedRoute[i]);assert(edgeMap.has(id));closedCounts.set(id,(closedCounts.get(id)||0)+1);}
assert.equal(closedCounts.size,49);assert.equal([...closedCounts.values()].filter(n=>n===2).length,3);
assert([...closedCounts.values()].every(n=>n===1||n===2));
function normalize(es){const coords=es.flatMap(e=>[e.from,e.to]).map(s=>s.split(',').map(Number)),mx=Math.min(...coords.map(c=>c[0])),my=Math.min(...coords.map(c=>c[1]));return es.map(e=>[e.from,e.to].map(id=>{const[x,y]=id.split(',').map(Number);return[x-mx,y-my].join(',')}).sort().join('|')).sort().join(';');}
const source=JSON.parse(fs.readFileSync(path.join(__dirname,'graphs.json'),'utf8')),matches=[];
source.frames.forEach((f,i)=>f.glyphs.forEach(g=>{if(normalize(g.edges)===normalize(edges))matches.push({frame:i+1,slot:g.slot,thresholdOddCounts:[g.lowThresholdEdges,g.edges,g.highThresholdEdges].map(es=>analyzeGraph({...g,edges:es}).oddNodes.length)});}));
assert(matches.some(m=>m.frame===4&&m.slot===1));assert(matches.some(m=>m.frame===13&&m.slot===1));
const operations={OR:(a,b)=>a|b,XOR:(a,b)=>a^b,AND:(a,b)=>a&b,NOR:(a,b)=>1-(a|b),NAND:(a,b)=>1-(a&b),XNOR:(a,b)=>1-(a^b)};
const truthTable=[[0,0],[0,1],[1,0],[1,1]].map(([a,b])=>({a,b,...Object.fromEntries(Object.entries(operations).map(([k,fn])=>[k,fn(a,b)]))}));
const report={version:'0.001',status:'Exact properties of a hand-traced graph, conditional on interpretation of the photograph.',source:'boolean-thread-source.png',graph,matchingEarlierObservations:matches,oddNodes:original.oddNodes,minimumStrokesWithoutRepeats:3,openRoute:route,openTraversals:51,uniqueEdges:49,repeatedEdges:repeatIds,closedRoute:closed.trails[0].nodeIds,closedTraversals:52,minimumExtraOpenTraversals:2,minimumExtraClosedTraversals:3,proof:'Each extra unit-edge traversal changes degree parity at at most two vertices. Reducing six odd vertices to two needs at least two extras; to zero needs three. The supplied routes attain these lower bounds.',orWhiteEdges:49,xorWhiteEdges:47,truthTable,checks:{continuity:true,allTargetEdgesCovered:true,addedGeometricEdges:0,onlyTwoEdgesRepeated:true,traceMatchesPreviousGraphs:true}};
fs.writeFileSync(path.join(__dirname,'boolean-thread.json'),JSON.stringify(report,null,2)+'\n');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');
let svg='<svg xmlns="http://www.w3.org/2000/svg" width="1320" height="655" viewBox="0 0 1320 655"><rect width="1320" height="655" fill="#10151f"/><g font-family="Arial,sans-serif" fill="#e1e7f0">';
const text=(x,y,s,size=19,color='#e1e7f0')=>svg+=`<text x="${x}" y="${y}" font-size="${size}" fill="${color}">${esc(s)}</text>`;
text(30,38,'Один глиф · три разных вопроса',27);text(30,68,'Осевые линии по фотографии; совпадают с графом 04/1 и 13/1. Цвет линий не меняет связность.',16);
const visits=new Map();for(const id of route)visits.set(id,(visits.get(id)||0)+1);
for(let panel=0;panel<3;panel++){
 const ox=54+panel*436,oy=144,scale=29,xy=id=>{const[x,y]=id.split(',').map(Number);return[ox+x*scale,oy+y*scale]};
 text(30+panel*436,110,['Без повторов: 3 штриха','OR: одна нить, 51 шаг','XOR: тот же маршрут'][panel],22);
 for(const e of edges){if(panel===2&&counts.get(e.id)%2===0)continue;const[x1,y1]=xy(e.from),[x2,y2]=xy(e.to);svg+=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`;}
 if(panel===0)for(const id of original.oddNodes){const[x,y]=xy(id);svg+=`<circle cx="${x}" cy="${y}" r="6" fill="#ffbb71" stroke="#10151f" stroke-width="2"/>`;}
 if(panel===1){for(const id of repeatIds){const e=edgeMap.get(id),[x1,y1]=xy(e.from),[x2,y2]=xy(e.to);svg+=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#ff89bc" stroke-width="3"/>`;}
 for(const[id,label,colour]of[[route[0],'начало','#7be6d4'],[route.at(-1),'конец','#a3beff']]){const[x,y]=xy(id);svg+=`<circle cx="${x}" cy="${y}" r="5" fill="${colour}"/>`;text(x+12,y+5,label,16,colour);}}
 if(panel===2)for(const[id,n]of visits){if(n%2===0){const[x,y]=xy(id);svg+=`<circle cx="${x}" cy="${y}" r="5" fill="#10151f"/>`;}}
 const notes=[['6 оранжевых Т-узлов — нечётные.','Для одного штриха допустимы 0 или 2.','Смена булевой операции их не убирает.'],['49 разных рёбер + 2 повтора.','Розовое: дважды пройденные рёбра;','в самом OR-следе они тоже белые.'],['2 повторённых ребра погасли.','Осталось 47 белых рёбер.','Чёрные общие точки увеличены.']][panel];notes.forEach((s,i)=>text(30+panel*436,548+i*27,s,17));
}
text(30,643,'Без отрыва ≠ без повторения участка. Замкнутая нить возможна с 3 повторами: 52 шага.',17,'#a9d9ff');svg+='</g></svg>';
fs.writeFileSync(path.join(__dirname,'boolean-thread.svg'),svg);
console.log(JSON.stringify({edges:49,odd:6,minimumStrokes:3,open:51,closed:52,matches,checks:report.checks}));
