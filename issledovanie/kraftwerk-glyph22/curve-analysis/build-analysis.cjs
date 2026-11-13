'use strict';
const fs=require('node:fs'),path=require('node:path');
const {analyzeGraph}=require('./graph-analysis.cjs');
const source=JSON.parse(fs.readFileSync(path.join(__dirname,'graphs.json'),'utf8'));
const totals={frames:source.frames.length,glyphs:0,singleTrail:0,notSingleTrail:0,thresholdStableTopology:0,thresholdStableDecision:0,lowConfidence:0};
const frames=source.frames.map((frame,index)=>({
  index:index+1,state:frame.state,transition:frame.transition,witness:frame.witness,
  glyphs:frame.glyphs.map(graph=>{
    const primary=analyzeGraph(graph),low=analyzeGraph({...graph,edges:graph.lowThresholdEdges}),high=analyzeGraph({...graph,edges:graph.highThresholdEdges});
    const signature=a=>JSON.stringify([a.canDrawSingleStroke,a.componentCount,a.oddNodes.length,a.crossingCount,a.junctionCount,a.minimumTrails]);
    const stableTopology=signature(primary)===signature(low)&&signature(primary)===signature(high);
    const stableDecision=primary.canDrawSingleStroke===low.canDrawSingleStroke&&primary.canDrawSingleStroke===high.canDrawSingleStroke;
    const seen=primary.trails.flatMap(t=>t.edges.map(e=>e.id));
    if(seen.length!==graph.edges.length||new Set(seen).size!==seen.length)throw new Error(`Traversal coverage failed ${index+1}/${graph.slot}`);
    totals.glyphs++;totals.singleTrail+=+primary.canDrawSingleStroke;totals.notSingleTrail+=+!primary.canDrawSingleStroke;
    totals.thresholdStableTopology+=+stableTopology;totals.thresholdStableDecision+=+stableDecision;totals.lowConfidence+=+(graph.confidence==='low');
    return {slot:graph.slot,confidence:graph.confidence,confidenceNotes:graph.confidenceReasons||graph.confidenceNotes||graph.notes||null,
      alignment:graph.alignment,uncertainEdges:graph.uncertainEdges,edgeModel:graph.edges,
      analysis:primary,thresholdComparison:{stableTopology,stableDecision,variants:[{threshold:.36,analysis:low},{threshold:.48,analysis:primary},{threshold:.60,analysis:high}].map(v=>({threshold:v.threshold,analysis:{canDrawSingleStroke:v.analysis.canDrawSingleStroke,classification:v.analysis.classification,componentCount:v.analysis.componentCount,oddCount:v.analysis.oddNodes.length,crossingCount:v.analysis.crossingCount,junctionCount:v.analysis.junctionCount,minimumTrails:v.analysis.minimumTrails,edgeCount:v.analysis.edgeCount}}))}};
  })
}));
const report={version:'0.001',status:'research draft; counts exact for inferred graphs, not certified source animation',
  model:'Undirected zero-width graph of inferred yellow stroke centrelines; no edges added for traversal.',
  criterion:'One edge-containing component and zero or two odd-degree vertices. Each edge used exactly once.',
  totals,frames};
fs.writeFileSync(path.join(__dirname,'analysis.json'),JSON.stringify(report)+'\n');
console.log(JSON.stringify(totals));
