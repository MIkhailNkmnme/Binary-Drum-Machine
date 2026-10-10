/* Bit faces: exact turns in the model, canvas numbers only in the view.
   A traversal is an entrance and an exit of the SAME bit by the SAME source. */
(() => {
  "use strict";
  const Q = ZZExact.from, ZERO = Q(0), ONE = Q(1), HALF = Q(1,2), QUARTER = Q(1,4);
  const $ = id => document.getElementById(id);
  let previous = null, busy = false, pending = new Map(), writes = 0, last = "", flashes = [], flashTimer = 0;
  const lerp = (a,b,t) => a.add(b.sub(a).mul(t));
  const full = () => [{lo:ZERO,hi:ONE,l:null,r:null}];
  function split(lo,hi,l,r){
    if (hi.sub(lo).cmp(ONE) >= 0) return full();
    const span = hi.sub(lo), a = lo.mod(), b = a.add(span);
    if (b.cmp(ONE) <= 0) return [{lo:a,hi:b,l,r}];
    return [{lo:a,hi:ONE,l,r:null},{lo:ZERO,hi:b.sub(ONE),l:null,r}];
  }
  function intersect(a,b){
    const out = [];
    for (const x of a) for (const y of b) {
      const lo = ZZExact.max(x.lo,y.lo), hi = ZZExact.min(x.hi,y.hi);
      if (lo.cmp(hi) > 0) continue;
      out.push({lo,hi,l:x.lo.cmp(y.lo) >= 0 ? x.l : y.l,r:x.hi.cmp(y.hi) <= 0 ? x.r : y.r});
    }
    return out;
  }
  const inArcs = (angle,arcs) => arcs.some(a => angle.mod().cmp(a.lo) >= 0 && angle.mod().cmp(a.hi) <= 0);
  function snapshot(withSources=true){
    const N = Math.min(Z.rows.length,CONE_MAX), spin = coneMotionClock().degrees.div(360);
    const slice = window.zzBallFaceGeometry ? window.zzBallFaceGeometry() : null;
    const rings = [], pieces = [], sources = new Map(), endpoints = new Map();
    const fill = !slice && coneFlat() && Z.rows.length <= CONE_MAX && Z.coneBallArm !== "slice";
    for (let k = 0; k < N + (fill ? 1 : 0); k++) {
      const row = k === N ? fillDraft() : Z.rows[k], R = coneMotionRing(k);
      const phase = R.phase.sub(QUARTER).add(spin), cells = [];
      const add = (j,lo,width,tag=j) => {
        const p = {id:k+":"+tag,k,j,lo,width,writeK:k,inverted:false,value:row[j] ?? "."};
        cells.push(p); pieces.push(p);
        endpoints.set(p.id+":L",{id:p.id+":L",angle:lo,owner:k});
        endpoints.set(p.id+":R",{id:p.id+":R",angle:lo.add(width),owner:k});
      };
      if (slice) {
        const offset = slice.rings[k].phaseQ.add(slice.spinQ);
        if (!k) {
          const gap = Q(Z.coneSliceGap || "1/4"), lo = offset.sub(QUARTER).add(gap.div(2));
          add(0,lo,ONE.sub(gap));
        } else {
          const cuts = (slice.cuts[k] || []).slice().sort((a,b) => a.cmp(b));
          if (!cuts.length) add(0,offset.sub(QUARTER),ONE);
          else cuts.forEach((a,j) => add(j % row.length,offset.add(a), (cuts[(j+1)%cuts.length].add(j === cuts.length-1 ? ONE : ZERO)).sub(a),j));
        }
      } else if (!k && coneRow1Slit()) {
        const gap=ZZExact.min(ONE,Q(Z.row1SlitDeg || Z.coneSlit || 2).div(360)), centre=R.aim.add(spin);
        if(gap.cmp(ONE)<0) add(0,centre.add(gap.div(2)),ONE.sub(gap));
      } else if (!k && coneQuadOn()) {
        for (let j=1;j<R.n;j+=2) add(0,phase.add(Q(j,R.P)),Q(1,R.P),j);
      } else if (!k && coneHalfOn()) {
        add(0,phase.add(HALF),HALF);
        if(cutPrevOwn()) { add(0,phase,HALF,"inverse"); const p=cells[cells.length-1]; p.inverted=true; p.value=cpInv(row[0]); }
      }
      else for (let j=0;j<row.length;j++) {
        const pos = R.cut ? cutPrevMode() === "alt" && !coneCutSym() ? Q(2*j) : coneMotionBitPosition(j,row.length) : Q(j);
        add(j,phase.add(pos.div(R.P)),Q(1,R.P));
      }
      if(!slice && k>0 && k<N && R.cut && cutPrevMode()) for(const [position,bit] of cutPrevCells(k,row.length)) {
        add(bit,phase.add(Q(position).div(R.P)),Q(1,R.P),"prev:"+position);
        const p=cells[cells.length-1]; p.writeK=cutPrevSourceIndex(k); p.inverted=true; p.value=cpInv(cutPrevSource(k)[bit] ?? ".");
      }
      rings.push({k,phase,cells,row,cut:R.cut});
    }
    const byId=new Map(pieces.map(p=>[p.id,p]));
    if(!withSources) return {rings,pieces,byId,spin};
    const gate=coneMotionRing(0).aim.add(spin);
    const attach = (e,kind,target=null) => {
      const id = kind+":"+e.id+(target === null ? "" : ":"+target);
      sources.set(id,{...e,id,kind,target});
    };
    const sunStart = kind => {
      const R = coneMotionRing(0), phase = R.phase.sub(QUARTER).add(spin), out=[];
      const arc = (a,b,key) => {
        const l={id:kind+":"+key+":L",angle:a,owner:0},r={id:kind+":"+key+":R",angle:b,owner:0};
        endpoints.set(l.id,l); endpoints.set(r.id,r); out.push(...split(a,b,l,r));
      };
      if (coneQuadOn()) { for (let j=kind === "moon" ? 1 : 0;j<R.n;j+=2) arc(phase.add(Q(j,R.P)),phase.add(Q(j+1,R.P)),j); }
      else if (coneSunHalf()) {
        if (kind === "sun" && Z.rows[0]?.[0] === "0" && !Z.sunMoon) return full();
        arc(phase.add(kind === "moon" ? HALF : ZERO),phase.add(kind === "moon" ? ONE : HALF),0);
      } else if (coneSunSlit()) {
        if (Z.rows[0]?.[0] === "0") return full();
        const centre = gate, half = ZZExact.min(HALF,Q(Z.row1SlitDeg || Z.coneSlit || 2).div(720));
        arc(centre.sub(half),centre.add(half),0);
      } else return full();
      return out;
    };
    // The incoming sector edges, including shadows cast by inner rings, are
    // sources. Artificial splits at turn 0/1 are not new light fronts.
    const solar = {};
    if (coneSunOn()) for (const kind of coneSunMoon() ? ["sun","moon"] : ["sun"]) {
      let lit = sunStart(kind); solar[kind]=[];
      for (let k=1;k<rings.length;k++) {
        solar[kind][k]=lit;
        for (const a of lit) { if (a.l) attach(a.l,kind,k); if (a.r) attach(a.r,kind,k); }
        const R=rings[k], opaque=R.cells.filter(p => !sunPass(kind,p.value === "." ? "E" : p.value));
        let open=full();
        for (const p of opaque) {
          const l=endpoints.get(p.id+":L"),r=endpoints.get(p.id+":R");
          open=intersect(open,split(p.lo.add(p.width),p.lo.add(ONE),r,l));
        }
        lit=intersect(lit,open);
      }
    } else if (Z.coneClock) {
      const ids=coneFanOn() ? coneFanAlive() : [coneLaserK()], count=coneFanOn() ? coneFanN() : coneLasersN();
      for (const id of ids) sources.set("laser:"+id,{id:"laser:"+id,kind:"laser",owner:null,target:null,
        angle:QUARTER.neg().add(Q(Z.coneLaser0 || 0).div(360)).add(Q(id,count)).add(coneLaserFixed() ? ZERO : spin)});
    }
    if (Z.r1Ray && rings[0]) sources.set("thread",{id:"thread",kind:"thread",owner:0,target:null,
      angle:rings[0].phase.add(Q(Z.r1RayX ?? "1/2").div(coneMotionRing(0).P))});
    if (coneRayOn() && rings.length) for (const p of rings[Math.min(coneRayClosed(),rings.length-1)].cells) {
      attach(endpoints.get(p.id+":L"),"ray"); attach(endpoints.get(p.id+":R"),"ray");
    }
    if (window.zzBallFaceSources) for (const b of window.zzBallFaceSources()) sources.set(b.id,{...b,kind:"ball",owner:null});
    const sig=[Z.lane,Z.rows.map(s=>s.length).join("/"),Z.coneSlits,Z.row1Parts,!!Z.laserQuad,!!Z.sunHalf,!!slice,
      !!Z.coneClock,!!Z.coneSun,coneFanOn(),!!Z.coneRay,!!Z.r1Ray,!!Z.sunMoon,!!Z.sunMoonTurn,!!Z.cutRow1Slit,Z.row1SlitDeg,cutPrevMode(),coneLaserFixed(),Z.coneSpinMode,Z.coneNotch,Z.row1Whole].join("|");
    return {sig,rings,pieces,byId,sources,endpoints,spin,gate,solar};
  }
  function visible(source,angle,k,state,t,end){
    const cells = i => state.rings[i].cells.map(p => ({...p,lo:lerp(p.lo,end.byId.get(p.id)?.lo || p.lo,t),value:p.inverted ? cpInv(Z.rows[p.writeK]?.[p.j] ?? p.value) : (p.writeK===Z.rows.length ? fillDraft()[p.j] : Z.rows[p.writeK]?.[p.j]) ?? p.value}));
    const isEdge = i => cells(i).some(p=>angle.sub(p.lo).mod().eq(ZERO) || angle.sub(p.lo.add(p.width)).mod().eq(ZERO));
    if (source.kind === "ball") return source.target === k;
    if (source.kind === "ray") return k >= source.owner && state.rings.every((r,i)=>i < source.owner || isEdge(i));
    if (source.kind === "thread") return true;
    if (source.kind === "sun" || source.kind === "moon") {
      if (source.owner !== null && source.owner >= k) return false;
      const initial=state.solar[source.kind]?.[1] || full(), shift=lerp(state.rings[0].phase,end.rings[0].phase,t).sub(state.rings[0].phase);
      if(!inArcs(angle,initial.flatMap(a=>split(a.lo.add(shift),a.hi.add(shift),null,null)))) return false;
      for (let i=1;i<k;i++) for (const p of cells(i)) {
        const d=angle.sub(p.lo).mod();
        if (d.sign()>0 && d.cmp(p.width)<0 && !sunPass(source.kind,p.value === "." ? "E" : p.value)) return false;
      }
      return true;
    }
    // A zero-width laser can reach this ring only through real openings of
    // earlier rings; it is allowed to touch the destination bit's boundary.
    for (let i=0;i<k;i++) {
      if (i===0 && !coneQuadOn() && !coneHalfOn()) {
        const a=lerp(state.gate,end.gate,t), width=coneRow1Slit() ? ZZExact.min(ONE,Q(Z.row1SlitDeg || Z.coneSlit || 2).div(360)) : ZERO;
        if (!angle.sub(a).mod().eq(ZERO) && !inArcs(angle,split(a.sub(width.div(2)),a.add(width.div(2)),null,null))) return false;
      } else for (const p of cells(i)) { const d=angle.sub(p.lo).mod(); if(d.sign()>0 && d.cmp(p.width)<0) return false; }
    }
    return true;
  }
  function observe(){
    if (!Z.coneFaceOrder || busy) return false;
    busy=true;
    try {
      const next=snapshot(), before=previous; previous=next;
      if(before) next.byId=new Map(next.pieces.map(p=>[p.id,p]));
      if (!before || before.sig !== next.sig) { pending.clear(); return false; }
      const events=[];
      const candidates=new Map([...before.sources,...next.sources]);
      for (const [id,source] of candidates) {
        const a=before.sources.get(id), b=next.sources.get(id);
        if((!a && source.owner === null) || (source.kind === "ball" && (!a || !b || a.target !== b.target))) continue;
        const start=a?.angle || source.angle.sub(source.owner === null ? ZERO : next.rings[source.owner].phase.sub(before.rings[source.owner].phase));
        let finish=b?.angle || start.add(source.owner === null ? ZERO : next.rings[source.owner].phase.sub(before.rings[source.owner].phase));
        if (source.kind === "laser") { const delta=finish.sub(start); if(delta.abs().cmp(HALF)>0) finish=finish.sub(Q(delta.add(HALF).floor())); }
        for (const p of before.pieces) {
          if(source.target !== null && source.target !== undefined && source.target !== p.k) continue;
          if(source.kind === "ray" && p.k < source.owner) continue;
          const target=next.byId.get(p.id); if(!target || !target.width.eq(p.width)) { pending.delete(id+"/"+p.id); continue; }
          const d0=start.sub(p.lo), d1=finish.sub(target.lo), delta=d1.sub(d0); if(!delta.sign()) continue;
          for (const [side,offset] of [["L",ZERO],["R",p.width]]) {
            const lo=ZZExact.min(d0,d1).sub(offset).ceil(), hi=ZZExact.max(d0,d1).sub(offset).floor();
            for(let m=lo;m<=hi;m++) {
              const position=Q(m).add(offset), t=position.sub(d0).div(delta);
              if(t.cmp(ZERO)<0 || t.cmp(ONE)>0) continue;
              const entering=delta.sign()>0 ? side==="L" : side==="R";
              events.push({id,p,source,side,m,t,entering,angle:lerp(start,finish,t),direction:delta.sign()});
            }
          }
        }
      }
      events.sort((a,b)=>a.t.cmp(b.t) || Number(a.entering)-Number(b.entering));
      let changed=false;
      for(let i=0;i<events.length;) {
        const same=[], values=new Map(); const t=events[i].t;
        while(i<events.length && events[i].t.eq(t)) same.push(events[i++]);
        for(const e of same) {
          const key=e.id+"/"+e.p.id;
          if(!visible(e.source,e.angle,e.p.k,before,e.t,next)) { pending.delete(key); continue; }
          if(e.source.kind === "ray" && e.t.sign()>0) { flashes.push({angle:e.angle,t:performance.now()}); }
          const old=pending.get(key);
          if(e.entering) {
            // Do not restart an already tracked entry at the next frame's t=0.
            if(!old || old.side!==e.side || old.m!==e.m) pending.set(key,{side:e.side,m:e.m});
          } else {
            if(old && old.side!==e.side && old.m===e.m) {
              const bit=e.p.writeK+":"+e.p.j, traversed=old.side==="L" ? "1" : "0", value=e.p.inverted ? cpInv(traversed) : traversed;
              const entry=values.get(bit) || {p:e.p,values:new Set()}; entry.values.add(value); values.set(bit,entry);
            }
            pending.delete(key);
          }
        }
        for(const {p,values:choices} of values.values()) if(choices.size===1) {
          const value=[...choices][0], row=p.writeK===Z.rows.length ? fillDraft() : Z.rows[p.writeK];
          if(row && p.j<row.length) {
            const mask=window.zzBallEmptyMask ? window.zzBallEmptyMask() : null;
            if(mask?.[p.writeK]) mask[p.writeK]=mask[p.writeK].slice(0,p.j)+"0"+mask[p.writeK].slice(p.j+1);
            const result=row.slice(0,p.j)+value+row.slice(p.j+1);
            if(p.writeK===Z.rows.length) Z.fillCells=result; else Z.rows[p.writeK]=result;
            writes++; last="К"+(p.k+1)+" · бит "+(p.j+1)+" · "+(value==="1" ? "Л→П: 1" : "П→Л: 0"); changed=true;
          }
        }
      }
      // Observation is motion, not repaint: synchronize the resulting values
      // without calling renderCone recursively from inside an active render.
      if(changed) { previous=snapshot(); save(); renderRows(); }
      ui(); return changed;
    } finally { busy=false; }
  }
  function draw(g,o){
    const now=performance.now(); flashes=flashes.filter(f=>now-f.t<600);
    if(!Z.coneFaceView && !flashes.length) return;
    const S=snapshot(false), {cx,cy,r0=0,dr,dpr,band=1}=o;
    g.save(); g.shadowBlur=0; g.globalAlpha=1; g.lineWidth=Math.max(1.5*dpr,1);
    for(const p of Z.coneFaceView ? S.pieces : []) {
      if(o.shown && !o.shown(p.k)) continue;
      const ri=r0+p.k*dr, ro=ri+(p.k===0 ? 1 : band)*dr;
      for(const [side,angle] of [["L",p.lo],["R",p.lo.add(p.width)]]) {
        const a=angle.mod().number()*2*Math.PI, c=Math.cos(a),s=Math.sin(a);
        // Opposite pixel offsets only separate coincident strokes in the VIEW.
        // The model continues to use the exact same angle for both faces.
        const offset=(side==="L" ? -1 : 1)*1.25*dpr;
        g.strokeStyle=side==="L" ? "#28d9e8" : "#ff9b36";
        g.setLineDash(side==="L" ? [] : [4*dpr,2*dpr]);
        const r1=ri*coneRho(p.k,a),r2=ro*coneRho(p.k,a);
        const from=o.project ? o.project(p.k,a,0) : [cx+r1*c,cy+r1*s], to=o.project ? o.project(p.k,a,1) : [cx+r2*c,cy+r2*s];
        const dx=to[0]-from[0],dy=to[1]-from[1],len=Math.hypot(dx,dy);
        if(!len) continue;
        const ox=-dy/len*offset,oy=dx/len*offset;
        g.beginPath(); g.moveTo(from[0]+ox,from[1]+oy); g.lineTo(to[0]+ox,to[1]+oy); g.stroke();
      }
    }
    g.setLineDash([]); g.strokeStyle="#fff3ad"; g.lineWidth=2*dpr;
    for(const f of o.project ? [] : flashes) {
      const a=f.angle.mod().number()*2*Math.PI, radius=r0+(S.rings.length-1+band)*dr;
      g.globalAlpha=1-(now-f.t)/600; g.beginPath(); g.moveTo(cx,cy); g.lineTo(cx+radius*Math.cos(a),cy+radius*Math.sin(a)); g.stroke();
    }
    g.restore();
    if(flashes.length && !coneSpinning && !flashTimer) flashTimer=setTimeout(()=>{ flashTimer=0; renderCone(); },120);
  }
  function ui(){
    for(const [id,key] of [["bConeFaceView","coneFaceView"],["bConeFaceOrder","coneFaceOrder"]]) {
      const b=$(id); if(b) { b.classList.toggle("on",!!Z[key]); b.setAttribute("aria-pressed",String(!!Z[key])); }
    }
    const output=$("coneFaceResult"); if(output) { output.hidden=!Z.coneFaceOrder; output.textContent=last || "Л→П: 1 · П→Л: 0"; output.title="Завершённых проходов: "+writes; }
  }
  function reset(){ previous=null; pending.clear(); writes=0; last=""; flashes=[]; }
  window.zzFaceState=()=>({pending:[...pending].map(([key,p])=>[key,{side:p.side,m:String(p.m)}]),writes,last});
  window.zzFaceRestore=state=>{
    if(state !== undefined) { pending=new Map((state?.pending || []).map(([key,p])=>[key,{side:p.side,m:BigInt(p.m)}])); writes=state?.writes || 0; last=state?.last || ""; }
    previous=Z.coneFaceOrder ? snapshot() : null; flashes=[]; ui();
  };
  window.zzFaceObserve=observe; window.zzFaceDraw=draw; window.zzFaceReset=reset; window.zzFaceUi=ui;
  for(const [id,key] of [["bConeFaceView","coneFaceView"],["bConeFaceOrder","coneFaceOrder"]]) {
    const b=$(id); if(!b) continue;
    b.onclick=()=>{ Z[key]=!Z[key]; if(key==="coneFaceOrder") { reset(); if(Z[key]) { Z.coneFaceView=true; previous=snapshot(); } }
      ui(); save(); renderCone(); say(key==="coneFaceView" ? "Грани битов: левая — бирюзовая сплошная, правая — оранжевая пунктирная." : Z[key] ? "Запись по двум граням: Л→П даёт 1, П→Л даёт 0. Работает при ручном вращении и автокручении; первый контакт только запоминает вход." : "Запись по двум граням выключена."); };
  }
  ui(); if(Z.coneFaceOrder) previous=snapshot(); renderCone();
})();
