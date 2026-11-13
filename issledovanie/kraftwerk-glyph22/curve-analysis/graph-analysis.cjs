/* Exact undirected multigraph analysis of a supplied ideal centerline.
 * This module does not extract topology from photographs, merge close nodes,
 * turn contour boundaries into centerlines, or invent connecting edges.
 * A connected nonempty edge support admits a single edge-once stroke iff it
 * has zero or two odd-degree vertices (Euler). Isolated points are reported
 * separately. Passing through a vertex again is allowed; repeating an edge is
 * not. A geometric crossing must be explicitly split into a shared vertex by
 * the extractor; line segments that merely cross in an image are not joined.
 * Degree four alone is not evidence of a transverse crossing: incident local
 * tangents must form two different opposite pairs. This is a classification
 * of the supplied geometry, never certainty about an ambiguous photograph.
 * Decomposition uses ONLY supplied edges: maximal open trails plus closed
 * trails spliced at shared vertices. There are no temporary artificial edges.
 * Each nonempty component needs max(1, oddCount/2) separate strokes.
 * For a closed stroke the last displayed visit repeats its first point;
 * cyclicVisitCount excludes that duplicate cut endpoint.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GlyphCurveAnalysis=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const EPS=1e-8;
  function analyzeGraph(graph){
    if(!graph||!Array.isArray(graph.nodes)||!Array.isArray(graph.edges))throw new Error('Graph requires nodes and edges arrays');
    const nodes=new Map(),edges=new Map(),adj=new Map();
    function id(value,label){if(typeof value!=='string'&&typeof value!=='number')throw new Error('Invalid '+label);return String(value);}
    for(const input of graph.nodes){
      if(!input||typeof input!=='object')throw new Error('Invalid node');
      const key=id(input.id,'node id');if(nodes.has(key))throw new Error('Duplicate node '+key);
      const xy=input.x!==undefined||input.y!==undefined;
      if(xy&&(!Number.isFinite(input.x)||!Number.isFinite(input.y)))throw new Error('Invalid node coordinates');
      nodes.set(key,{...input,id:key});adj.set(key,[]);
    }
    for(const input of graph.edges){
      if(!input||typeof input!=='object')throw new Error('Invalid edge');
      const key=id(input.id,'edge id'),from=id(input.from,'edge endpoint'),to=id(input.to,'edge endpoint');
      if(edges.has(key))throw new Error('Duplicate edge '+key);
      if(!nodes.has(from)||!nodes.has(to))throw new Error('Unknown endpoint of '+key);
      let points=input.points;
      if(points!==undefined){
        if(!Array.isArray(points)||points.length<2||points.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)))throw new Error('Invalid edge polyline');
        points=points.map(p=>p.slice());
      }else if(Number.isFinite(nodes.get(from).x)&&Number.isFinite(nodes.get(to).x))points=[[nodes.get(from).x,nodes.get(from).y],[nodes.get(to).x,nodes.get(to).y]];
      else points=null;
      if(points){
        for(const [endpoint,point]of [[from,points[0]],[to,points[points.length-1]]]){
          const node=nodes.get(endpoint);
          if(Number.isFinite(node.x)&&(Math.abs(node.x-point[0])>EPS||Math.abs(node.y-point[1])>EPS))throw new Error('Polyline endpoint mismatch '+key);
        }
      }
      let length=points?points.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0):0;
      if(input.length!==undefined){if(!Number.isFinite(input.length)||input.length<=0)throw new Error('Invalid edge length');length=input.length;}
      const lengthKnown=length>0;if(!lengthKnown)length=1;
      edges.set(key,{id:key,from,to,points,length,lengthKnown});
      adj.get(from).push(key);adj.get(to).push(key); // a loop contributes two incidences
    }
    const nodeOrder=[...nodes.keys()].sort((a,b)=>{
      const p=nodes.get(a),q=nodes.get(b);return (p.y-q.y||p.x-q.x||a.localeCompare(b,'en',{numeric:true}));
    });
    const degree=key=>adj.get(key).length;
    const other=(edge,key)=>edge.from===key?edge.to:edge.from;
    const active=nodeOrder.filter(key=>degree(key)>0),isolatedNodes=nodeOrder.filter(key=>degree(key)===0);
    const seen=new Set(),components=[];
    for(const first of active){
      if(seen.has(first))continue;
      const pending=[first],ids=[],edgeIds=new Set();seen.add(first);
      while(pending.length){const current=pending.pop();ids.push(current);for(const edgeId of adj.get(current)){
        edgeIds.add(edgeId);const next=other(edges.get(edgeId),current);if(!seen.has(next)){seen.add(next);pending.push(next);}
      }}
      ids.sort((a,b)=>nodeOrder.indexOf(a)-nodeOrder.indexOf(b));
      components.push({id:components.length,nodeIds:ids,edgeIds:[...edgeIds],oddNodes:ids.filter(key=>degree(key)%2===1)});
    }
    function tangent(edge,atStart){
      if(!edge.points)return null;const points=atStart?edge.points:edge.points.slice().reverse(),p=points[0];
      for(let i=1;i<points.length;i++){const dx=points[i][0]-p[0],dy=points[i][1]-p[1],d=Math.hypot(dx,dy);if(d>EPS)return [dx/d,dy/d];}
      return null;
    }
    function crossingKind(key){
      const d=degree(key);if(d<3)return d===0?'isolated':d===1?'endpoint':'regular';
      if(d!==4)return 'junction';
      const tangents=[];
      for(const edge of edges.values()){
        if(edge.from===key)tangents.push(tangent(edge,true));if(edge.to===key)tangents.push(tangent(edge,false));
      }
      if(tangents.some(t=>!t))return 'degree4-unknown';
      const opposite=(a,b)=>Math.abs(a[0]+b[0])<EPS&&Math.abs(a[1]+b[1])<EPS;
      for(let j=1;j<4;j++)if(opposite(tangents[0],tangents[j])){
        const rest=[1,2,3].filter(i=>i!==j),a=tangents[0],b=tangents[rest[0]];
        if(opposite(tangents[rest[0]],tangents[rest[1]])&&Math.abs(a[0]*b[1]-a[1]*b[0])>EPS)return 'crossing';
      }
      return 'junction';
    }
    let labelIndex=0;
    const analysisNodes=nodeOrder.map(key=>({id:key,x:nodes.get(key).x,y:nodes.get(key).y,degree:degree(key),kind:crossingKind(key),
      label:degree(key)>=3?'J'+(++labelIndex):null,visits:[],visitCount:0,cyclicVisitCount:0}));
    const nodeResult=new Map(analysisNodes.map(n=>[n.id,n]));
    const trails=[];
    for(const component of components){
      const remaining=new Set(component.edgeIds),raw=[];
      const remainingDegree=key=>adj.get(key).reduce((count,e)=>count+Number(remaining.has(e)),0);
      function walk(start){
        const nodeIds=[start],edgeSteps=[];let current=start;
        while(true){const edgeId=adj.get(current).find(e=>remaining.has(e));if(edgeId===undefined)break;
          remaining.delete(edgeId);const edge=edges.get(edgeId),next=other(edge,current);
          edgeSteps.push({id:edgeId,from:current,to:next,reversed:current!==edge.from});nodeIds.push(next);current=next;
        }
        return {nodeIds,edgeSteps};
      }
      // Every such walk consumes exactly two odd endpoints. Other leftover
      // components have only even degree and are closed walks to splice.
      while(component.nodeIds.some(key=>remainingDegree(key)%2===1)){
        raw.push(walk(component.nodeIds.find(key=>remainingDegree(key)%2===1)));
      }
      if(!raw.length&&remaining.size)raw.push(walk(component.nodeIds.find(key=>remainingDegree(key)>0)));
      while(remaining.size){
        let target=null,at=-1;
        for(const candidate of raw){at=candidate.nodeIds.findIndex(key=>remainingDegree(key)>0);if(at>=0){target=candidate;break;}}
        if(!target)throw new Error('Internal error: leftover edges have no shared vertex');
        const cycle=walk(target.nodeIds[at]);
        if(cycle.nodeIds[0]!==cycle.nodeIds[cycle.nodeIds.length-1])throw new Error('Internal error: leftover walk is open');
        target.edgeSteps.splice(at,0,...cycle.edgeSteps);
        target.nodeIds.splice(at+1,0,...cycle.nodeIds.slice(1));
      }
      component.trailIds=[];
      for(const ordered of raw){
        let distance=0;
        const closed=ordered.nodeIds[0]===ordered.nodeIds[ordered.nodeIds.length-1],trailId=trails.length;
        const steps=ordered.edgeSteps.map(step=>{const edge=edges.get(step.id),startDistance=distance;distance+=edge.length;
          return {...step,points:edge.points?(step.reversed?edge.points.slice().reverse():edge.points).map(p=>p.slice()):null,length:edge.length,startDistance,endDistance:distance};});
        const counts=new Map(),visits=ordered.nodeIds.map((key,index)=>{
          const node=nodeResult.get(key),occurrence=(counts.get(key)||0)+1;counts.set(key,occurrence);
          const d=index===0?0:steps[index-1].endDistance,isClosure=closed&&index===ordered.nodeIds.length-1;
          const visit={node:key,index,distance:d,u:distance?d/distance:0,label:node.label,occurrence,isClosure};
          node.visits.push({trail:trailId,index,distance:d,u:visit.u,isClosure});node.visitCount++;if(!isClosure)node.cyclicVisitCount++;
          return visit;
        });
        trails.push({id:trailId,component:component.id,closed,nodeIds:ordered.nodeIds,edgeCount:steps.length,length:distance,
          metric:steps.every(s=>edges.get(s.id).lengthKnown)?'arc-length':'unit-fallback',edges:steps,visits});
        component.trailIds.push(trailId);
      }
      component.minimumTrails=Math.max(1,component.oddNodes.length/2);
      component.canDrawSingleStroke=component.oddNodes.length<=2;
      component.classification=component.oddNodes.length===0?'circuit':component.oddNodes.length===2?'path':'too-many-odd';
    }
    const oddNodes=active.filter(key=>degree(key)%2===1),canDrawSingleStroke=components.length===1&&oddNodes.length<=2;
    const classification=!edges.size?'empty':components.length>1?'disconnected':oddNodes.length>2?'too-many-odd':oddNodes.length===2?'path':'circuit';
    return {schemaVersion:1,classification,canDrawSingleStroke,connected:components.length===1,
      edgeCount:edges.size,nodeCount:nodes.size,activeNodeCount:active.length,isolatedNodes,oddNodes,componentCount:components.length,
      minimumTrails:components.reduce((n,c)=>n+c.minimumTrails,0),totalLength:trails.reduce((n,t)=>n+t.length,0),
      metric:trails.every(t=>t.metric==='arc-length')?'arc-length':'unit-fallback',
      junctionCount:analysisNodes.filter(n=>n.degree>=3).length,
      crossingCount:analysisNodes.filter(n=>n.kind==='crossing').length,
      degree4Count:analysisNodes.filter(n=>n.degree===4).length,
      repeatedNodeCount:analysisNodes.filter(n=>n.cyclicVisitCount>1).length,
      nodes:analysisNodes,components,trails};
  }
  return {analyzeGraph};
});
