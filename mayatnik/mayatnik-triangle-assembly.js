/* Faces of the finite, displayed axes. Geometry and piece poses use field units. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./mayatnik-line-measures.js'));
  else root.MayatnikTriangleAssembly = factory(root.MayatnikLineMeasures);
})(typeof globalThis === 'object' ? globalThis : this, function (lines) {
  'use strict';
  const EPS = 1e-7, MAX_PIECES = 4096;
  const originPose = Object.freeze({x: 0, y: 0, turn: 0, flip: false});
  const validPoint = p => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);
  const dimensionsOK = (w,h) => [w,h].every(v => Number.isFinite(v) && v > EPS && v <= 1e6);
  const compare = (a,b) => a[0]-b[0] || a[1]-b[1];
  const dist = (a,b) => Math.hypot(a[0]-b[0], a[1]-b[1]);
  const cross = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const limit = () => {throw new RangeError('Слишком много осей или частей. Скрыть часть осей и повторить поиск.');};
  function canonical(vertices) {
    const [a,b,c] = vertices;
    const ccw = cross(a,b,c) >= 0 ? [a,b,c] : [a,c,b];
    let start = 0;
    for (let i=1; i<3; i++) if (compare(ccw[i],ccw[start]) < 0) start=i;
    return Object.freeze([0,1,2].map(i => Object.freeze(ccw[(start+i)%3].slice())));
  }
  function contains(vertices,p,margin=-EPS) {
    return vertices.every((a,i) => {
      const b = vertices[(i+1)%3];
      return cross(a,b,p) >= margin * dist(a,b);
    });
  }

  function graph(splitLines) {
    const points=[], adjacency=[], ends=[], cells=new Map(), unique=new Set();
    function index(raw) {
      const p=raw.map(v=>Math.round(v/EPS)*EPS || 0);
      const x=Math.round(p[0]/EPS), y=Math.round(p[1]/EPS);
      for (let dx=-1; dx<=1; dx++) for (let dy=-1; dy<=1; dy++) {
        const hit=cells.get((x+dx)+','+(y+dy));
        if (hit !== undefined && dist(p,points[hit]) <= EPS*1.01) return hit;
      }
      const id=points.length;
      cells.set(x+','+y,id); points.push(p); adjacency.push([]);
      return id;
    }
    for (const line of splitLines) for (const part of line.segments) {
      const a=index(part.a), b=index(part.b), key=Math.min(a,b)+','+Math.max(a,b);
      if (a===b || unique.has(key)) continue;
      unique.add(key);
      const e=ends.length;
      adjacency[a].push(e); adjacency[b].push(e+1); ends.push(b,a);
      if (ends.length > 65536) limit();
    }
    for (let i=0; i<points.length; i++) {
      const p=points[i];
      const angle=e=>Math.atan2(points[ends[e]][1]-p[1],points[ends[e]][0]-p[0]);
      adjacency[i].sort((a,b)=>angle(a)-angle(b));
    }
    return {points, adjacency, ends};
  }
  // At each arrival take the preceding outgoing ray. A bridge then occurs in
  // both directions in the same face walk, including a bridge between loops.
  function walk(adjacency,ends) {
    const next=new Int32Array(ends.length), face=new Int32Array(ends.length).fill(-1), cycles=[];
    for (const fan of adjacency) for (let i=0; i<fan.length; i++)
      next[fan[i]^1]=fan[(i+fan.length-1)%fan.length];
    for (const fan of adjacency) for (const start of fan) {
      if (face[start] !== -1) continue;
      const cycle=[];
      let e=start;
      do {
        face[e]=cycles.length; cycle.push(ends[e]); e=next[e];
      } while (e!==start);
      cycles.push(cycle);
    }
    return {face,cycles};
  }
  function components(adjacency,ends) {
    const labels=new Int32Array(adjacency.length).fill(-1), roots=[];
    for (let i=0; i<adjacency.length; i++) {
      if (!adjacency[i].length || labels[i]!==-1) continue;
      const label=roots.length, stack=[i];
      roots.push(i); labels[i]=label;
      while (stack.length) for (const e of adjacency[stack.pop()]) {
        const j=ends[e];
        if (labels[j]===-1) {labels[j]=label; stack.push(j);}
      }
    }
    return {labels,roots};
  }
  function find({width,height,segments}={}) {
    if (!dimensionsOK(width,height) || !Array.isArray(segments)) throw new TypeError('Некорректные размеры поля или список осей.');
    if (segments.length>32768) limit();
    const box={left:0, top:0, right:width, bottom:height};
    const corners=[[0,0],[width,0],[width,height],[0,height]];
    const clipped=corners.map((a,i)=>({a,b:corners[(i+1)%4]}));
    for (const line of segments) {
      if (!validPoint(line?.a) || !validPoint(line.b)) throw new TypeError('Некорректные координаты оси.');
      const segment=lines.clip(line.a,line.b,box);
      if (!segment) continue;
      if (!segment.every(validPoint)) throw new RangeError('Координаты оси превышают точность поля.');
      const [a,b]=segment.sort(compare);
      clipped.push({a,b});
    }
    clipped.sort((l,r)=>compare(l.a,r.a)||compare(l.b,r.b));
    const merged=lines.merge(clipped);
    if (merged.length>512) limit(); // bound pair intersections inside the shared splitter
    const {points,adjacency,ends}=graph(lines.split(merged));
    const raw=walk(adjacency,ends);
    const fans=adjacency.map(fan=>fan.filter(e=>raw.face[e]!==raw.face[e^1]));
    const {cycles}=walk(fans,ends), {labels,roots}=components(fans,ends);
    const pieces=[];
    let containmentChecks=0;
    for (const cycle of cycles) {
      const vertices=cycle.map(i=>points[i]);
      const corners=vertices.filter((p,i)=>{
        const a=vertices[(i+vertices.length-1)%vertices.length], b=vertices[(i+1)%vertices.length];
        return Math.abs(cross(a,p,b)) > EPS*dist(a,b);
      });
      if (corners.length!==3 || cross(...corners)<=0) continue;
      // Each disjoint cyclic component lies wholly inside or wholly outside
      // this walk. An interior component is a hole of the candidate face.
      containmentChecks+=roots.length;
      if (containmentChecks>2e6) limit();
      if (roots.some((r,i)=>i!==labels[cycle[0]] && contains(corners,points[r],0))) continue;
      const v=canonical(corners);
      const id='t/'+v.flat().map(x=>Math.round(x/EPS)).join('/');
      pieces.push({id,vertices:v,area:cross(...v)/2});
      if (pieces.length>MAX_PIECES) limit();
    }
    return pieces.sort((a,b)=>compare(a.vertices[0],b.vertices[0])||compare(a.vertices[1],b.vertices[1])||compare(a.vertices[2],b.vertices[2]));
  }

  const wrap = n => (n%8+8)%8;
  function normalize(layout) {
    if (!layout || !dimensionsOK(layout.width,layout.height) || !Array.isArray(layout.pieces) || layout.pieces.length>MAX_PIECES) return null;
    const sourceFrame=layout.sourceFrame??0, scope=layout.scope;
    if (!Number.isSafeInteger(sourceFrame) || sourceFrame<0 || (scope!==undefined && (typeof scope!=='string' || scope.length>500))) return null;
    const ids=new Set(), pieces=[];
    for (const raw of layout.pieces) {
      if (!raw || typeof raw.id!=='string' || !raw.id.length || raw.id.length>200 || ids.has(raw.id)) return null;
      const v=raw.vertices;
      if (!Array.isArray(v) || v.length!==3 || ![...v].every(p=>validPoint(p) && p[0]>=-EPS && p[1]>=-EPS && p[0]<=layout.width+EPS && p[1]<=layout.height+EPS)) return null;
      const vertices=canonical(v), area=cross(...vertices)/2;
      if (!(area>EPS*Math.max(...vertices.map((p,i)=>dist(p,vertices[(i+1)%3])))/2)) return null;
      const {x,y,turn,flip}=raw.pose===undefined ? originPose : raw.pose||{};
      if (![x,y].every(n=>Number.isFinite(n)&&Math.abs(n)<=1e7) || !Number.isSafeInteger(turn) || typeof flip!=='boolean') return null;
      ids.add(raw.id); pieces.push({id:raw.id,vertices,area,pose:{x,y,turn:wrap(turn),flip}});
    }
    return {width:layout.width,height:layout.height,sourceFrame,...(scope===undefined?{}:{scope}),pieces};
  }
  const trig=[1,Math.SQRT1_2,0,-Math.SQRT1_2,-1,-Math.SQRT1_2,0,Math.SQRT1_2];
  function matrix(piece) {
    const {x,y,turn,flip}=piece.pose||originPose, v=piece.vertices;
    const cx=(v[0][0]+v[1][0]+v[2][0])/3, cy=(v[0][1]+v[1][1]+v[2][1])/3;
    const cos=trig[wrap(turn)], sin=trig[wrap(turn-2)], a=flip?-cos:cos, b=flip?-sin:sin;
    return [a,b,-sin,cos, x+cx-a*cx+sin*cy,y+cy-b*cx-cos*cy];
  }
  const apply=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
  const forward=(piece,p)=>apply(matrix(piece),p);
  function inverse(piece,p) {
    const [a,b,c,d,e,f]=matrix(piece), x=p[0]-e, y=p[1]-f;
    return [a*x+b*y,c*x+d*y]; // transpose of an orthogonal matrix
  }
  const world=piece=>{const m=matrix(piece); return piece.vertices.map(p=>apply(m,p));};
  function bounds(piece) {
    const v=world(piece), xs=v.map(p=>p[0]), ys=v.map(p=>p[1]);
    return {left:Math.min(...xs),top:Math.min(...ys),right:Math.max(...xs),bottom:Math.max(...ys)};
  }
  function pick(pieces,p) {
    for (let i=pieces.length-1; i>=0; i--) if (contains(pieces[i].vertices,inverse(pieces[i],p),-EPS)) return pieces[i];
    return null;
  }
  function rotate(piece,steps=1) {
    const pose=piece.pose||originPose;
    return {...pose,turn:wrap(pose.turn+steps)};
  }
  function reflect(piece) {
    const pose=piece.pose||originPose;
    return {...pose,flip:!pose.flip};
  }
  function snap(piece,others,threshold) {
    const pose=piece.pose||originPose;
    if (!Number.isFinite(threshold) || threshold<0) return {...pose};
    const source=world(piece);
    let best=null;
    function offer(dx,dy,rank) {
      const length=Math.hypot(dx,dy);
      if (length>threshold) return;
      // Equal candidates have a geometric tie-break independent of painter order.
      if (best && (rank-best.rank || length-best.length || dx-best.dx || dy-best.dy)>=0) return;
      best={dx,dy,rank,length};
    }
    for (const other of others) {
      if (other.id===piece.id) continue;
      const target=world(other);
      for (let i=0; i<3; i++) for (let j=0; j<3; j++) {
        const a=source[i], b=source[(i+1)%3], c=target[j], d=target[(j+1)%3];
        offer(c[0]-a[0],c[1]-a[1],1);
        const len=dist(a,b), tx=(b[0]-a[0])/len, ty=(b[1]-a[1])/len;
        if (Math.abs(tx*(d[1]-c[1])-ty*(d[0]-c[0])) > EPS*dist(c,d)) continue;
        // Collinear supporting lines only attract where the finite edges overlap.
        const proj=p=>(p[0]-a[0])*tx+(p[1]-a[1])*ty;
        const left=Math.min(proj(c),proj(d)), right=Math.max(proj(c),proj(d));
        if (Math.min(len,right)-Math.max(0,left)<=EPS) continue;
        const normal=tx*(c[1]-a[1])-ty*(c[0]-a[0]);
        if (Math.abs(len-dist(c,d))<=EPS) {
          const endpoint=proj(c)<proj(d)?c:d;
          offer(endpoint[0]-a[0],endpoint[1]-a[1],0);
        }
        offer(-ty*normal,tx*normal,2);
      }
    }
    return best ? {...pose,x:pose.x+best.dx,y:pose.y+best.dy} : {...pose};
  }
  return {find,normalize,matrix,forward,inverse,bounds,contains,pick,snap,rotate,reflect};
});
