/* Solaris: a ball moves along the straight edges of ring bits and turns
   with its ring. At the ring joint and at the centre it moves onto a
   coincident edge; otherwise it reverses along its own edge.
   Each ball keeps one speed along straight paths and optional outer arcs.
   The rotation clock owns the experiment. */
(() => {
  "use strict";
  const TAU = 2 * Math.PI;
  const Q = ZZExact.from, ZERO = Q(0), ONE = Q(1), HALF = Q(1, 2), QUARTER = Q(1, 4);
  const radians = value => Q(value).number() * TAU;
  const rawFraction = (ring, raw) => {
    if (raw && typeof raw.eq === "function") return raw;
    for (const b of [...ring.blocks, ...(ring.cells || []), ...(ring.contactBlocks || [])]) {
      if (raw === b.lo) return b.loQ; if (raw === b.hi) return b.hiQ;
    }
    throw new TypeError("Угол движения должен быть точной долей оборота");
  };
  const angleQ = (S, k, raw) => rawFraction(S.rings[k], raw).add(S.rings[k].phaseQ).add(S.spinQ);
  const setRaw = (ball, raw) => { ball.rawQ = Q(raw); ball.raw = radians(ball.rawQ); };
  const projectMotion = ball => {
    for (const key of ["q", "speed", "elapsed", "travel", "length", "period", "mult"]) if (ball[key + "Q"]) ball[key] = ball[key + "Q"].number();
    ball.raw = radians(ball.rawQ); ball.ringTurns = ball.ringTurnsQ.map(q => q.number());
  };
  const $ = id => document.getElementById(id);
  let F = null, enabled = false, paused = true, cycles = 0, passes = 0;
  let slicing = null;
  const slicingOn = () => Z.coneBallArm === "slice";
  const sliceLineOn = () => Z.coneSliceMode === "line";
  let sliceDuos = [], sliceScope = null, sliceSingleCache = null;
  // Compare whole-ring rotations; bit-step modes belong to pre-cut rings.
  const sliceModes = [
    {mode:"all",label:"Всё",table:"sliceCutAllTable"},
    {mode:"opp",label:"Встр.стр",table:"sliceCutOppTable"}
  ];
  const sliceDualOn = () => slicingOn() && !!Z.coneSliceDual && !sliceScope;
  const sliceLocalKeys = ["rows","coneRot","coneSpinMode","coneSpinPh","coneSpin","motionExact","fillCells","fillFree","coneFree","coneViewPose","coneSliceBitMarks","coneSliceSectorBits","coneSliceTurns"];
  // Slicing owns angles in turns, independent of the old row/cut pitch.
  const sliceOpposite = () => ["opp","obit"].includes(Z.coneSpinMode);
  const sliceTurn = k => Q(Z.coneSliceTurns?.[k] || 0);
  const sliceSetTurn = (k,value) => { (Z.coneSliceTurns ||= [])[k] = Q(value).text(); };
  const sliceRate = (k,legacy = !!Z.coneSliceOldSpeed) => {
    const n = Math.max(1,(Z.rows[k] || "1").length);
    return (legacy ? Q(n,2*n-1) : ONE).mul(sliceOpposite() && k % 2 ? -1 : 1);
  };
  const sliceAutoPhase = (k,clock,legacy = !!Z.coneSliceOldSpeed) => sliceOpposite()
    ? clock.phase.div(360).mul(sliceRate(k,legacy))
    : clock.degrees.div(360).mul(sliceRate(k,legacy).sub(ONE));
  window.zzBallSliceOldSpeedChanged = on => {
    const old = !!Z.coneSliceOldSpeed;
    const update = () => {
      const clock = coneMotionClock();
      Z.rows.forEach((_,k) => sliceSetTurn(k,sliceTurn(k).add(sliceAutoPhase(k,clock,old)).sub(sliceAutoPhase(k,clock,on))));
      sliceCycleReset();
    };
    if (sliceDualOn()) {
      for (const scope of sliceDuos) sliceWithScope(scope,update);
      if (sliceSingleCache) sliceWithScope(sliceSingleCache,update);
      slicePublishPrimary();
    } else {
      update();
      for (const scope of sliceDuos) sliceWithScope(scope,update);
    }
    Z.coneSliceOldSpeed = on;
    sliceStatus(); save(); renderCone();
    if (window.zzConeTapeRecord) window.zzConeTapeRecord();
  };
  window.zzBallSliceSpinModeChanged = mode => {
    if (!slicingOn()) return false;
    const nextMode = ["opp","obit"].includes(mode) ? "opp" : "all";
    if (!sliceDualOn()) {
      const clock = coneMotionClock(), phases = Z.rows.map((_,k) => sliceTurn(k).add(sliceAutoPhase(k,clock)));
      Z.coneSpinMode = nextMode;
      phases.forEach((phase,k) => sliceSetTurn(k,phase.sub(sliceAutoPhase(k,clock))));
      sliceCycleReset();
    }
    Z.coneSpinMode = nextMode;
    return true;
  };
  const sliceCopy = value => value == null || typeof value !== "object" ? value : posCopy(value);
  function sliceCapture(){
    return {data:slicing,paused:true,rot:coneRot.slice(),props:Object.fromEntries(sliceLocalKeys.map(key => [key,sliceCopy(Z[key])]))};
  }
  function sliceWithScope(scope, fn){
    const previous = {scope:sliceScope,data:slicing,paused,rot:coneRot,props:Object.fromEntries(sliceLocalKeys.map(key => [key,Z[key]])),save,renderRows,renderCone,renderAll,syncLane,continueFrame:window.zzBallContinueFrame,faces:window.zzFaceState?.()};
    sliceScope = scope; slicing = scope.data; paused = scope.paused; coneRot = scope.rot;
    for (const key of sliceLocalKeys) Z[key] = scope.props[key];
    save = renderRows = renderCone = renderAll = syncLane = () => {};
    window.zzBallContinueFrame = sliceScopeAdvance;
    if (window.zzFaceRestore) window.zzFaceRestore(scope.faces);
    try { return fn(); }
    finally {
      scope.data = slicing; scope.paused = paused; scope.rot = coneRot;
      for (const key of sliceLocalKeys) scope.props[key] = Z[key];
      scope.faces = window.zzFaceState?.();
      sliceScope = previous.scope; slicing = previous.data; paused = previous.paused; coneRot = previous.rot;
      for (const key of sliceLocalKeys) Z[key] = previous.props[key];
      if (window.zzFaceRestore) window.zzFaceRestore(previous.faces);
      save = previous.save; renderRows = previous.renderRows; renderCone = previous.renderCone; renderAll = previous.renderAll; syncLane = previous.syncLane;
      window.zzBallContinueFrame = previous.continueFrame;
    }
  }
  function sliceEnsureDuos(){
    if (sliceDuos.length) return;
    sliceSingleCache ||= sliceCapture();
    sliceDuos = sliceModes.map(({mode,label}) => {
      const scope = sliceCapture(); scope.data = null; scope.mode = mode; scope.label = label; scope.props.coneSpinMode = mode;
      scope.faces = {pending:[],writes:0,last:""};
      const saved = Z.coneSliceCenters?.[mode];
      if (saved && Array.isArray(saved.rows) && saved.rows.length && saved.rows.length <= CONE_MAX && saved.rows.every(row => typeof row === "string" && /^[01]+$/.test(row))) {
        scope.props.rows = saved.rows.slice(); scope.props.coneSliceBitMarks = sliceCopy(saved.marks || {});
        scope.props.coneSliceSectorBits = sliceCopy(saved.sectorBits || {});
        scope.props.coneSliceTurns = sliceCopy(saved.turns || []);
        scope.rot = scope.props.rows.map((_,i) => scope.rot[i] || 0); scope.props.coneRot = scope.rot.slice();
      }
      return scope;
    });
  }
  function slicePublishPrimary(){
    const first = sliceDuos[0]; if (!first) return;
    for (const key of sliceLocalKeys) if (key !== "coneSpinMode" && key !== "coneViewPose") Z[key] = sliceCopy(first.props[key]);
    coneRot = first.rot.slice(); slicing = first.data;
    Z.coneSliceCenters = {...Z.coneSliceCenters,...Object.fromEntries(sliceDuos.map(scope => [scope.mode,{rows:scope.props.rows.slice(),marks:sliceCopy(scope.props.coneSliceBitMarks || {}),sectorBits:sliceCopy(scope.props.coneSliceSectorBits || {}),turns:sliceCopy(scope.props.coneSliceTurns || [])}]))};
  }
  function sliceScopeAdvance(dt){
    if (!slicing || slicing.done || paused) return;
    const before = snapshot(); coneMotionAdvance(dt);
    if (sliceLineOn()) sliceLineAdvance(before,snapshot(),dt); else sliceAdvance(before,snapshot(),dt);
    if (window.zzFaceObserve) window.zzFaceObserve();
  }
  function sliceDualLaunch(){
    sliceEnsureDuos(); enabled = true; Z.coneBallOn = true; coneViewRemember();
    for (const scope of sliceDuos) sliceWithScope(scope,() => { sliceLaunch(); });
    slicePublishPrimary(); paused = true; sliceStatus(); save(); renderRows(); renderCone(); return true;
  }
  window.zzBallSliceDualActive = sliceDualOn;
  window.zzBallSliceDualChanged = () => {
    if (slicingOn()) {
      pauseRotation(); paused = true;
      if (Z.coneSliceDual) { sliceSingleCache = sliceCapture(); sliceEnsureDuos(); slicePublishPrimary(); }
      else if (sliceSingleCache) {
        const single = sliceSingleCache; slicing = single.data; coneRot = single.rot.slice();
        for (const key of sliceLocalKeys) Z[key] = sliceCopy(single.props[key]);
        sliceSingleCache = null;
        if (slicing) {
          if (slicing.rowLimit !== sliceRowLimit()) window.zzBallSliceLimitChanged();
          if (slicing.kind === "line") {
            if (slicing.oneRing !== !!Z.coneSliceOneRing || slicing.immediate !== (!Z.coneSliceOneRing && !!Z.coneSliceImmediate)) window.zzBallSliceGrowthChanged();
            if (!slicing.sourceRateQ.eq(ZERO)) window.zzBallSliceSourceChanged();
          }
        }
      }
      sliceStatus(); renderRows();
    }
    save(); renderCone();
    if (!sliceScope && window.zzConeTapeRecord) window.zzConeTapeRecord();
  };
  // Heavy tape entries keep the cut history once per event. Frame entries
  // keep exact positions and clocks without duplicating that growing table.
  const sliceTapeSettings = ["coneBallArm","coneBallOn","coneBallRoute","coneSpinMode","coneAutoSp","coneSliceMode","coneSliceSelfReturn","coneSliceRayFlip","coneSliceOldSpeed","coneSliceDual","coneSliceSourceSpin","coneSliceOneRing","coneSliceImmediate","coneSliceStop5","coneSliceRingCount","coneSliceFirstThrough","coneSliceNext","coneSliceRebound","coneBallChain","coneSliceSpeed","coneSliceGap","coneSlits","cutAlign","cutMem","cutPrev","cutRow1Slit","row1Whole","sunHalf","laserQuad","row1Parts","ringPhOff","coneHold","coneHoldOff"];
  const sliceTapeRunKey = data => data ? [data.kind,data.selfReturn,data.firstThrough,data.initialThroughDone,data.returnSeeds,data.count,data.rowLimit,data.done,data.stoppedAt,data.stoppedReason,data.cycleWatch,data.cutHistoryRevision,data.paths.length,data.moving.map(ball => [ball.id,ball.k,ball.move,ball.launchK,ball.exitedK]),data.linePasses,data.lineCutRing,data.oneRing,data.activeRing,data.immediate,data.lineBaseAngleQ,data.lineBaseGateQ,data.sourceRateQ,data.outerBounces,data.innerBounces,data.centerBounces,data.returned] : null;
  window.zzBallSliceTapeKey = () => slicingOn() ? JSON.stringify([
    sliceTapeSettings.map(key => Z[key]),Z.coneSliceBitMarks,Z.coneSliceSectorBits,Z.coneSliceTurns,
    sliceDualOn() ? sliceDuos.map(scope => [scope.mode,scope.props.rows,scope.rot,scope.props.coneSliceBitMarks,scope.props.coneSliceSectorBits,scope.props.coneSliceTurns,scope.faces,sliceTapeRunKey(scope.data)]) : sliceTapeRunKey(slicing)
  ]) : null;
  function sliceTapePack(data){
    if (!data) return null;
    const packed = JSON.parse(JSON.stringify(data));
    packed.moving.forEach((ball,i) => { ball.pathIndex = data.paths.indexOf(data.moving[i].path); delete ball.path; });
    return packed;
  }
  function sliceTapeUnpack(packed){
    if (!packed) return null;
    const data = JSON.parse(JSON.stringify(packed), (key,value) => key.endsWith("Q") && typeof value === "string" ? Q(value) : value);
    for (const name of ["cuts","completedCuts"]) for (const key of Object.keys(data[name] || {})) data[name][key] = data[name][key].map(value => Q(value));
    for (const path of data.paths) for (const key of ["r0","r1","raw0","raw1","slope"]) path[key] = Q(path[key]);
    for (const ball of data.moving) { if (ball.pathIndex >= 0) ball.path = data.paths[ball.pathIndex]; delete ball.pathIndex; }
    if (data.startClock) { data.startClock.phase = Q(data.startClock.phase); data.startClock.degrees = Q(data.startClock.degrees); }
    return data;
  }
  const sliceTapePackScope = scope => scope ? {mode:scope.mode,label:scope.label,rot:scope.rot.slice(),props:sliceCopy(scope.props),faces:sliceCopy(scope.faces),data:sliceTapePack(scope.data)} : null;
  const sliceTapeUnpackScope = scope => scope ? {...sliceCopy(scope),paused:true,data:sliceTapeUnpack(scope.data)} : null;
  window.zzBallSliceTapeState = () => slicingOn() ? {
    settings:Object.fromEntries(sliceTapeSettings.map(key => [key,sliceCopy(Z[key])])),enabled,rot:coneRot.slice(),
    props:Object.fromEntries(sliceLocalKeys.map(key => [key,sliceCopy(Z[key])])),
    data:sliceDualOn() ? null : sliceTapePack(slicing),
    duos:sliceDuos.map(sliceTapePackScope),single:sliceTapePackScope(sliceSingleCache)
  } : null;
  function sliceTapePose(data){
    return data ? {elapsedQ:data.elapsedQ.text(),lineAngleQ:data.lineAngleQ?.text(),
      moving:data.moving.map(ball => ({id:ball.id,rQ:ball.rQ.text(),rawQ:ball.rawQ.text(),pathIndex:data.paths.indexOf(ball.path),pathEnd:ball.path?.r1.text()}))} : null;
  }
  const sliceTapeClock = (props,key,view) => {
    const exact = props.motionExact?.[key]; return Q(exact && exact.view === view ? exact.value : view).text();
  };
  window.zzBallSliceTapeFrame = () => slicingOn() ? sliceDualOn() ? {
    duos:sliceDuos.map(scope => ({pose:sliceTapePose(scope.data),phase:sliceTapeClock(scope.props,"clock.phase",scope.props.coneSpinPh || 0),degrees:sliceTapeClock(scope.props,"clock.degrees",scope.props.coneSpin || 0)}))
  } : {pose:sliceTapePose(slicing)} : null;
  function sliceTapePoseApply(data,pose){
    if (!data || !pose) return;
    data.elapsedQ = Q(pose.elapsedQ); if (pose.lineAngleQ !== undefined) data.lineAngleQ = Q(pose.lineAngleQ);
    for (const point of pose.moving) {
      const ball = data.moving.find(ball => ball.id === point.id); if (!ball) continue;
      ball.rQ = Q(point.rQ); ball.rawQ = Q(point.rawQ);
      if (point.pathIndex >= 0) { ball.path = data.paths[point.pathIndex]; if (point.pathEnd !== undefined) ball.path.r1 = Q(point.pathEnd); }
    }
  }
  window.zzBallSliceTapeRestore = (state,entry) => {
    if (state === undefined) return;
    if (!state) {
      if (!slicingOn()) return;
      slicing = null; sliceDuos = []; sliceSingleCache = null;
    } else {
      for (const key of sliceTapeSettings) { if (state.settings[key] === undefined) delete Z[key]; else Z[key] = sliceCopy(state.settings[key]); }
      for (const key of sliceLocalKeys) Z[key] = sliceCopy(state.props[key]);
      coneRot = state.rot.slice(); Z.coneRot = coneRot.slice(); enabled = state.enabled;
      slicing = sliceTapeUnpack(state.data); sliceDuos = state.duos.filter(scope => sliceModes.some(mode => mode.mode === scope.mode)).map(sliceTapeUnpackScope); sliceSingleCache = sliceTapeUnpackScope(state.single);
      if (entry?.duos) {
        sliceDuos.forEach((scope,i) => {
          const frame = entry.duos[state.duos.findIndex(saved => saved.mode === scope.mode)]; if (!frame) return;
          sliceTapePoseApply(scope.data,frame.pose);
          sliceWithScope(scope,() => { coneMotionSetClock(frame.phase,frame.degrees); });
        });
        slicePublishPrimary();
      } else {
        sliceTapePoseApply(slicing,entry?.pose);
        if (sliceDualOn()) slicePublishPrimary();
      }
    }
    paused = true; for (const scope of sliceDuos) scope.paused = true;
    for (const id of ["sliceCutSingle",...sliceModes.map(mode => mode.table)]) if ($(id)) delete $(id).dataset.sliceCutKey;
    if (window.zzBallSliceTapeUi) window.zzBallSliceTapeUi();
    if (slicingOn()) sliceStatus();
  };
  const sliceConfiguredCount = () => Math.max(1,Math.min(CONE_MAX,Math.trunc(Number(Z.coneSliceRingCount) || 5)));
  const sliceThroughOn = () => sliceLineOn() && !!Z.coneSliceSelfReturn && !!Z.coneSliceFirstThrough;
  const sliceRowLimit = () => sliceThroughOn() || Z.coneSliceStop5 !== false ? sliceConfiguredCount() : CONE_MAX;
  function slicePrepareThroughRings(){
    if (!sliceThroughOn()) return;
    const n = sliceConfiguredCount();
    Z.rows = Array.from({length:n},(_,k) => Z.rows[k] || "0".repeat(k+1));
    coneRot = Array.from({length:n},(_,k) => coneRot[k] || 0); Z.coneRot = coneRot.slice();
    Z.coneSliceTurns = Array.from({length:n},(_,k) => Z.coneSliceTurns?.[k] || "0");
    Z.cur = Math.min(Z.cur || 0,n-1); Z.fillCells = null;
  }
  function sliceFinishAtLimit(){
    slicing.done = true; slicing.stoppedAt = slicing.rowLimit; paused = true; pauseRotation();
  }
  function sliceCycleReset(){
    if (!slicing) return;
    delete slicing.cycleWatch;
    if (slicing.stoppedReason === "cycle") { slicing.done = false; delete slicing.stoppedReason; }
  }
  function sliceCycleResume(){
    if (sliceDualOn()) {
      for (const scope of sliceDuos) if (scope.data?.stoppedReason === "cycle") sliceWithScope(scope,sliceCycleReset);
      slicePublishPrimary();
    } else if (slicing?.stoppedReason === "cycle") sliceCycleReset();
  }
  window.zzBallSliceRayFlipChanged = () => {
    const update = () => {
      if (Z.coneSliceRayFlip === false) for (const seed of slicing?.returnSeeds || []) seed.rayOffsetQ = ZERO;
      sliceCycleReset();
    };
    if (sliceDualOn()) {
      for (const scope of sliceDuos) sliceWithScope(scope,update);
      if (sliceSingleCache) sliceWithScope(sliceSingleCache,update);
      slicePublishPrimary();
    } else {
      update();
      for (const scope of sliceDuos) sliceWithScope(scope,update);
    }
    sliceStatus(); save(); renderCone();
    if (window.zzConeTapeRecord) window.zzConeTapeRecord();
  };
  function sliceCycleObserve(S){
    if (!slicing || slicing.done || !S) return false;
    // Observe only exact event boundaries. A repeated mechanical state with
    // unchanged cuts/completions has the same future, however long its period.
    const progress = JSON.stringify([slicing.kind,slicing.selfReturn,slicing.firstThrough,slicing.initialThroughDone,slicing.count,slicing.rowLimit,
      slicing.cuts,slicing.completedCuts,slicing.returned,Z.rows,Z.coneSliceSectorBits,
      (slicing.returnSeeds || []).map(seed => [seed.k,seed.rawQ,seed.targetRawQ]),
      slicing.oneRing,slicing.immediate,slicing.activeRing,slicing.sourceRateQ,
      Z.coneSpinMode,Z.coneAutoSp,Z.coneSliceSourceSpin,Z.coneSliceRebound,Z.coneBallChain,Z.coneSliceNext,Z.coneSliceGap,Z.coneSliceRayFlip,Z.coneSliceOldSpeed,
      S.rings.map(r => r.coefficientQ)]);
    const state = JSON.stringify([
      S.rings.map(r => r.phaseQ.add(S.spinQ).mod()),
      slicing.kind === "line" && !slicing.selfReturn ? sliceLineAngleAt(S).mod() : null,
      (slicing.returnSeeds || []).map(seed => [seed.k,seed.rawQ,seed.rayOffsetQ || ZERO,
        seed.targetRawQ !== undefined ? S.rings[seed.k].phaseQ.add(S.spinQ).sub(seed.basePhaseQ).mod() : null,
        seed.targetRawQ !== undefined && S.rings[seed.k+1]
        ? S.rings[seed.k].phaseQ.add(seed.rawQ).add(seed.rayOffsetQ || ZERO).sub(S.rings[seed.k+1].phaseQ).sub(seed.targetRawQ).mod()
        : S.rings[seed.k].phaseQ.add(S.spinQ).sub(seed.basePhaseQ)]),
      slicing.moving.map(b => [b.k,b.rQ,b.rawQ.mod(),b.move,b.speedQ,b.launchK,b.exitedK])
    ]);
    const previous = slicing.cycleWatch;
    if (!previous || previous.progress !== progress) {
      slicing.cycleWatch = {progress,state,atQ:slicing.elapsedQ}; return false;
    }
    if (previous.state !== state || slicing.elapsedQ.cmp(previous.atQ) <= 0) return false;
    coneMotionSetClock(S.clockPhaseQ,S.spinQ.mul(360));
    slicing.done = true; slicing.stoppedReason = "cycle"; paused = true; pauseRotation();
    return true;
  }
  function sliceLimitComplete(){
    if (slicing.selfReturn && slicing.firstThrough) return false;
    return slicing.count >= slicing.rowLimit && (slicing.completedCuts[slicing.rowLimit - 1] || []).length >= (slicing.selfReturn ? 1 : slicing.rowLimit);
  }
  function sliceFirstPendingRing(){
    const limit = Math.min(slicing.count,slicing.rowLimit);
    for (let k = 0; k < limit; k++) if ((k ? (slicing.completedCuts[k] || []).length : slicing.linePasses ? 1 : 0) < k + 1) return k;
    return limit - 1;
  }
  window.zzBallSliceGrowthChanged = () => {
    if (sliceDualOn()) { sliceEnsureDuos(); for (const scope of sliceDuos) sliceWithScope(scope,window.zzBallSliceGrowthChanged); slicePublishPrimary(); sliceStatus(); save(); renderCone(); if (window.zzConeTapeRecord) window.zzConeTapeRecord(); return; }
    if (slicing?.kind === "line") {
      sliceCycleReset();
      slicing.oneRing = !!Z.coneSliceOneRing;
      slicing.immediate = !slicing.oneRing && !!Z.coneSliceImmediate;
      if (slicing.oneRing) slicing.activeRing = sliceFirstPendingRing();
      if (slicing.stoppedAt != null && !sliceLimitComplete()) { slicing.done = false; slicing.stoppedAt = null; }
      if (sliceLimitComplete()) sliceFinishAtLimit();
    }
    if (slicingOn()) sliceStatus(); save(); renderCone();
    if (!sliceScope && window.zzConeTapeRecord) window.zzConeTapeRecord();
  };
  window.zzBallSliceLimitChanged = () => {
    if (sliceDualOn()) { sliceEnsureDuos(); for (const scope of sliceDuos) sliceWithScope(scope,window.zzBallSliceLimitChanged); slicePublishPrimary(); sliceStatus(); save(); renderCone(); if (window.zzConeTapeRecord) window.zzConeTapeRecord(); return; }
    if (slicing) {
      sliceCycleReset();
      slicing.rowLimit = sliceRowLimit(); slicing.RQ = Q(Math.min(slicing.count,slicing.rowLimit));
      if (slicing.stoppedAt != null && slicing.rowLimit > slicing.stoppedAt) { slicing.done = false; slicing.stoppedAt = null; }
      if (!slicing.firstThrough && (sliceLimitComplete() || slicing.moving.some(ball => ball.k >= slicing.rowLimit || ball.rQ.cmp(slicing.RQ) > 0))) sliceFinishAtLimit();
    }
    if (slicingOn()) sliceStatus();
    save(); renderCone();
    if (!sliceScope && window.zzConeTapeRecord) window.zzConeTapeRecord();
  };
  window.zzBallSliceModeChanged = () => { if (slicingOn()) sliceStatus(); labControls(); if (!sliceScope && window.zzConeTapeRecord) window.zzConeTapeRecord(); };
  function sliceLineAngleAt(S){
    if (!slicing || slicing.kind !== "line") return ZZSliceLine.gate(S);
    return slicing.lineBaseAngleQ.add(ZZSliceLine.gate(S).sub(slicing.lineBaseGateQ).mul(slicing.sourceRateQ));
  }
  window.zzBallSliceSourceChanged = () => {
    if (sliceDualOn()) { sliceEnsureDuos(); for (const scope of sliceDuos) sliceWithScope(scope,window.zzBallSliceSourceChanged); slicePublishPrimary(); sliceStatus(); save(); renderCone(); if (window.zzConeTapeRecord) window.zzConeTapeRecord(); return; }
    if (slicing?.kind === "line") {
      sliceCycleReset();
      const S = snapshot();
      if (S) { slicing.lineAngleQ = sliceLineAngleAt(S); slicing.lineBaseAngleQ = slicing.lineAngleQ; slicing.lineBaseGateQ = ZZSliceLine.gate(S); slicing.sourceRateQ = ZERO; }
    }
    if (slicingOn()) sliceStatus(); save(); renderCone();
    if (!sliceScope && window.zzConeTapeRecord) window.zzConeTapeRecord();
  };
  function sliceCutNumber(k, raw){
    return k ? (slicing?.cuts[k] || []).findIndex(cut => cut.eq(Q(raw).mod())) + 1 : 1;
  }
  function sliceRayCutSources(k, S){
    return Array.from({length:k},(_,inner) => ({k:inner,number:sliceCutNumber(inner,slicing.lineAngleQ.sub(S.rings[inner].phaseQ).sub(S.spinQ))})).filter(source => source.number);
  }
  function sliceBallCutSources(k, raw){
    const number = sliceCutNumber(k,raw); if (!number) return [];
    const inherited = slicing.cutHistory?.[k]?.find(record => record.number === number)?.sources || [];
    return [...inherited,{k,number}];
  }
  function sliceRememberCut(k, raw, S, motion, sources, details = {}){
    if (!slicing || !S) return;
    const planned = Q(Z.coneAutoSp ?? 30).sign() ? ratesQ(S).map(rate => rate.sign()) : S.rings.map(() => 0);
    const directions = S.rings.map((_, i) => motion && motion[i] !== undefined ? motion[i].sign() : planned[i]);
    const history = slicing.cutHistory || (slicing.cutHistory = {}), list = history[k] || (history[k] = []);
    const number = sliceCutNumber(k,raw), hits = (slicing.cutHits ||= {}), ringHits = hits[k] ||= {}, hit = ringHits[number] = (ringHits[number] || 0) + 1;
    const newCut = hit === 1, cutCount = (slicing.cuts[k] || []).length;
    list.push({number,hit,event:(slicing.cutHistoryRevision || 0)+1,newCut,
      partsBefore:Math.max(1,cutCount-(newCut ? 1 : 0)),partsAfter:Math.max(1,cutCount),
      angle:raw.mod().text(),worldAngle:raw.add(S.rings[k].phaseQ).add(S.spinQ).mod().text(),
      at:slicing.elapsedQ.text(),directions,speeds:S.rings.map((_,i) => sliceRate(i).mul(Q(Z.coneAutoSp ?? 30)).text()),
      sources:(sources || []).map(source => ({...source})),...details});
    slicing.cutHistoryRevision = (slicing.cutHistoryRevision || 0) + 1;
  }
  window.zzBallSliceExportData = () => {
    if (sliceDualOn()) sliceEnsureDuos();
    const runs = sliceDualOn() ? sliceDuos.map(scope => ({name:scope.label,data:scope.data}))
      : [{name:sliceOpposite() ? "Встр.стр" : "Всё",data:slicing}];
    return runs.map(({name,data}) => ({name,count:data?.count || 0,
      records:Object.entries(data?.cutHistory || {}).flatMap(([k,rows]) => rows.map(record => ({...sliceCopy(record),ring:+k+1})))
        .sort((a,b) => Q(a.at).cmp(b.at) || (a.event || 0)-(b.event || 0) || a.ring-b.ring)
    }));
  };
  function sliceCutTableRender(){
    const box = $(sliceScope ? sliceModes.find(mode => mode.mode === sliceScope.mode)?.table : "sliceCutSingle"); if (!box) return;
    const key = slicing ? (slicing.kind || "ball") + ":" + slicing.count + ":" + (slicing.cutHistoryRevision || 0) : "empty";
    if (box.dataset.sliceCutKey === key) return;
    box.dataset.sliceCutKey = key;
    const entries = Object.entries(slicing?.cutHistory || {}).flatMap(([k,rows]) => rows.map(record => ({k:+k,record})));
    entries.sort((a,b) => Q(a.record.at).cmp(b.record.at) || (a.record.event || 0)-(b.record.event || 0) || a.k-b.k);
    if (!entries.length) { box.textContent = (sliceScope ? sliceScope.label + " · " : "") + "История вырезов появится при их создании."; return; }
    const table = document.createElement("table"), caption = document.createElement("caption"), head = document.createElement("thead"), body = document.createElement("tbody");
    caption.textContent = (sliceScope ? sliceScope.label + " · " : "") + "Событий: " + entries.length +
      " · По времени · Время — обороты К1 · Углы: 0° сверху, по часовой · Скорости: °/с в момент события · Значения — точные дроби · Таблица прокручивается вправо";
    table.append(caption,head,body);
    const header = document.createElement("tr"); head.append(header);
    const titles = ["№","К1, об.","Кольцо","Вырез","Раз","Результат","Части до → после","Причина","Источник","Путь вырезов",
      "Вырез в кольце, °","Встреча, °","Предыдущее направление, °","Поворот источника, °","Отражение, °","Луч после, °",
      ...Array.from({length:slicing.count},(_,i) => "К"+(i+1)+", °/с")];
    for (const title of titles) { const cell = document.createElement("th"); cell.scope = "col"; cell.textContent = title; header.append(cell); }
    const number = value => Q(value).text();
    const quantity = (value,angle = false,absolute = false) => {
      if (value === undefined || value === null) return {text:"—",title:"Не записано для этого события"};
      let q = Q(value); if (absolute) q = q.add(QUARTER).mod();
      const exact = angle ? q.mul(360) : q;
      return {text:number(exact),title:exact.text() + (angle ? "° = " + q.text() + " оборота" : " оборота К1")};
    };
    const add = (row,value,cls = "") => {
      const cell = document.createElement("td");
      cell.textContent = typeof value === "object" ? value.text : String(value);
      if (typeof value === "object") cell.title = value.title || "";
      if (cls) cell.className = cls;
      row.append(cell); return cell;
    };
    let lastRing = -1;
    for (const {k,record:r} of entries) {
      const row = document.createElement("tr"), fresh = r.newCut ?? (r.hit || 1) === 1;
      row.className = (k % 2 ? "slice-ring-odd" : "slice-ring-even") + (k !== lastRing ? " slice-ring-start" : "");
      lastRing = k; body.append(row);
      const origin = (r.sources || []).map(source => "К"+(source.k+1)+" №"+source.number).join(" → ") || (!k ? "Центр" : "—");
      add(row,r.event ?? "—"); add(row,quantity(r.at)); add(row,"К"+(k+1)); add(row,r.number); add(row,r.hit || 1);
      add(row,r.result || (!k && r.at === "0" ? "Старт" : fresh ? "Новый вырез" : "Повтор"),fresh ? "cut-new" : "cut-repeat");
      add(row,r.partsBefore === undefined ? "—" : r.partsBefore+" → "+r.partsAfter);
      add(row,r.cause || (!k && r.at === "0" ? "Исходный вырез" : "—"));
      add(row,r.sourceRing === undefined ? "—" : "К"+(r.sourceRing+1)+" №"+r.sourceCut);
      add(row,{text:origin,title:origin},"sources");
      add(row,quantity(r.angle,true,true)); add(row,quantity(r.meetingRay ?? r.worldAngle,true,true));
      add(row,quantity(r.previousRay,true,true)); add(row,quantity(r.sourceTravel,true));
      add(row,r.mirror === false ? {text:"Выкл.",title:"Зеркало встречи было выключено"} : quantity(r.reflection,true));
      add(row,quantity(r.outgoingRay,true,true));
      for (let i = 0; i < slicing.count; i++) {
        if (r.speeds?.[i] === undefined) { add(row,"—","na"); continue; }
        const speed = Q(r.speeds[i]), direction = speed.sign();
        add(row,{text:(direction > 0 ? "↻ " : direction < 0 ? "↺ " : "⏸ ")+number(speed.abs()),
          title:speed.text()+"°/с; + по часовой, − против часовой"},direction > 0 ? "cw" : direction < 0 ? "ccw" : "still");
      }
    }
    box.replaceChildren(table);
  }
  function sliceStatus(){
    if (sliceScope) return;
    if (sliceDualOn()) {
      sliceEnsureDuos(); for (const scope of sliceDuos) sliceWithScope(scope,sliceCutTableRender);
      if ($("ballLabTime")) labControls();
      status("Нарезка · центров: " + sliceDuos.length + " · " + sliceDuos.map(scope => scope.label + ": " + (scope.data?.stoppedReason === "cycle" ? "стоп: цикл без новых вырезов" : scope.data?.done ? "стоп" : paused ? "пауза" : "движение") + " · " + (scope.data?.elapsedQ.text() || "0") + " об. К1").join(" | "));
      return;
    }
    sliceCutTableRender();
    if ($("ballLabTime")) labControls();
    const speed = sliceLineOn() ? null : slicing?.speedQ || Q(Z.coneSliceSpeed || "2/3");
    const stopped = slicing?.stoppedReason === "cycle" ? "стоп: цикл без новых вырезов" : slicing?.stoppedAt != null ? "до К" + slicing.stoppedAt + " · стоп" : "предел колец · стоп";
    if (sliceLineOn()) status("Нарезка · " + (Z.coneSliceSelfReturn ? "свой вырез" : "линия без шариков") + " · " + (slicing ? slicing.done ? stopped : paused ? "пауза" : "движение" : "▶ пуск") +
      (Z.coneSliceSelfReturn ? (Z.coneSliceFirstThrough ? " · первый луч через все " + sliceConfiguredCount() + " колец после оборота К1, затем встречи со следами" : " · первый разрез после оборота, затем встречи со своим следом") : " · К0 стоит") + " · проходов " + (slicing?.linePasses || 0) + " · " + (slicing?.elapsedQ.text() || "0") + " оборота К1 · разрез К1: 0 · мгновенно");
    else status("Нарезка · " + (slicing ? slicing.done ? stopped : paused ? "пауза" : "движение" : "▶ пуск") +
      " · " + (slicing ? slicing.elapsedQ.text() : "0") + " оборота К1 · шариков " + (slicing ? slicing.moving.length : 1) + " · скорость " + speed.text() + " толщины/оборот К1 · внешний отскок " +
      (slicing?.outerBounces || 0) + " · внутренний отскок " + (slicing?.innerBounces || 0) + " · в центре " + (slicing?.centerBounces || 0) + (Z.coneBallChain ? " · цепочка: " + ({pass:"проход кольца",open:"открытие кольца",edge:"край кольца"}[Z.coneSliceNext] || "проход кольца") : ""));
    const box = $("ballLabTurns"); if (!box) return;
    const S = snapshot(), summary = S ? ratesQ(S).map((rate,k) => "К" + (k + 1) + ": " + rate.text() + " оборота за оборот К1") : [];
    for (let k = 0; slicing && k < slicing.count; k++) {
      const cuts = slicing.cuts[k] || [], completed = slicing.completedCuts[k] || [], opposite = cuts.length > 0 && cuts.every(a => cuts.some(b => b.sub(a).mod().eq(HALF)));
      summary.push("К" + (k + 1) + ": " + (sliceLineOn() ? "линия" : slicing.returned[k] ? "обратный проход завершён" : "обратный проход не завершён") +
        (k ? " · вырезы " + cuts.length + " · полностью пройдены " + completed.length + "/" + (slicing.selfReturn ? 1 : k + 1) + " · " + cuts.map(a => a.text()).join(", ") + " · симметрия на 1/2 оборота " + (opposite ? "да" : "нет") : " · исходный вырез"));
    }
    const key = summary.join("\n"); if (box.dataset.sliceSummary === key) return;
    box.dataset.sliceSummary = key; box.replaceChildren();
    for (const text of summary) { const row = document.createElement("div"); row.textContent = text; box.append(row); }
  }
  function sliceLaunch(){
    if (!sliceScope && window.zzConeTapeRecord) window.zzConeTapeRecord();
    if (sliceDualOn()) return sliceDualLaunch();
    slicePrepareThroughRings();
    const S = snapshot(); if (!S) { status(hint()); return false; }
    if (sliceLineOn()) return sliceLineLaunch(S);
    let speed; try { speed = Q(Z.coneSliceSpeed || "2/3"); } catch { status("Нарезка: укажи скорость положительной дробью"); return false; }
    if (speed.sign() <= 0) { status("Нарезка: скорость должна быть положительной"); return false; }
    enabled = true; Z.coneBallOn = true; F = null; balls = []; resting = []; run = null; clearCenter();
    coneViewRemember();
    slicing = {count:S.rings.length,rowLimit:sliceRowLimit(),RQ:Q(Math.min(S.rings.length,sliceRowLimit())),speedQ:speed,elapsedQ:ZERO,done:false,
      moving:[{id:1,rQ:ZERO,k:0,rawQ:QUARTER.neg(),move:1,speedQ:speed,launchK:0,exitedK:-1}],cuts:{},completedCuts:{},returned:{},paths:[],outerBounces:0,innerBounces:0,centerBounces:0,startClock:coneMotionClock(),startRows:Z.rows.slice(),startRot:coneRot.slice(),startView:{...Z.coneViewPose,pan:Z.coneViewPose.pan.slice()}};
    sliceStatus(); save(); renderCone(); return true;
  }
  function sliceTogglePlayback(){
    if (!slicingOn()) $("bConeBallSlice").click();
    sliceCycleResume();
    if (sliceDualOn()) { sliceEnsureDuos(); if (sliceDuos.every(scope => !scope.data)) launch(); else if (sliceDuos.some(scope => scope.data && !scope.data.done)) $("bConeAuto").click(); return; }
    if (!slicing) { launch(); return; }
    if (!slicing.done) $("bConeAuto").click();
  }
  window.zzBallSliceLaunch = sliceLaunch;
  window.zzBallFaceGeometry = () => { if(!slicingOn() || !slicing) return null; const S=snapshot(); return S ? {...S,cuts:slicing.cuts,sliceMode:slicing.kind || "ball"} : null; };
  window.zzBallFaceSources = () => {
    const S = snapshot(); if (!enabled || !S) return [];
    if (slicingOn()) return sliceLineOn() ? [] : (slicing?.moving || []).map(b => ({id:"ball:"+b.id,angle:S.rings[b.k].phaseQ.add(S.spinQ).add(b.rawQ),target:b.k}));
    return (balls.length ? balls : F ? [F] : []).filter(b => !b.ready && !["done","lost"].includes(b.stage) && S.rings[b.k]).map((b,i) => ({id:"ball:"+(b.number || i+1),angle:angleQ(S,b.k,b.rawQ),target:b.k}));
  };
  function sliceRecord(ball, r0, r1){
    const {k,move} = ball;
    if (k < 1 || r0.eq(r1)) return;
    const raw0 = ball.rawQ, raw1 = raw0, slope = ZERO, last = ball.path;
    if (last && last.id === ball.id && last.k === k && last.move === move && last.r1.eq(r0) && last.raw1.eq(raw0)) {
      last.r1 = r1;
    } else { ball.path = {id:ball.id,k,move,r0,r1,raw0,raw1,slope}; slicing.paths.push(ball.path); }
  }
  function sliceGrow(){
    if (!slicing || slicing.count !== Z.rows.length || slicing.count >= slicing.rowLimit) return false;
    if (!slicing.selfReturn && !slicing.immediate && slicing.count > 1 && (slicing.completedCuts[slicing.count - 1] || []).length < slicing.count) return false;
    const n = Z.rows.length + 1;
    Z.rows.push("0".repeat(n)); coneRot.push(0); Z.coneRot = coneRot.slice(); Z.fillCells = null;
    sliceSetTurn(n - 1,ZERO);
    slicing.count = n; slicing.RQ = Q(Math.min(n,slicing.rowLimit));
    renderRows(); save(); renderCone(); return true;
  }
  function sliceEnter(ball, k, S, angle, motion){
    const fromK = ball.k, fromRaw = ball.rawQ;
    ball.k = k; ball.rawQ = Q(angle).sub(S.rings[k].phaseQ).sub(S.spinQ);
    if (!k) return;
    const raw = ball.rawQ.mod(), cuts = slicing.cuts[k] || (slicing.cuts[k] = []);
    if (!cuts.some(a => a.eq(raw))) cuts.push(raw);
    sliceRememberCut(k,raw,S,motion,sliceBallCutSources(fromK,fromRaw));
  }
  function sliceReflectCenter(ball){
    ball.rQ = ZERO; ball.k = 0; ball.move = 1; slicing.centerBounces++;
  }
  function sliceLineLaunch(S){
    enabled = true; Z.coneBallOn = true; F = null; balls = []; resting = []; run = null; clearCenter();
    coneViewRemember();
    slicing = {kind:"line",oneRing:!!Z.coneSliceOneRing,activeRing:0,immediate:!Z.coneSliceOneRing && !!Z.coneSliceImmediate,count:S.rings.length,rowLimit:sliceRowLimit(),RQ:Q(Math.min(S.rings.length,sliceRowLimit())),elapsedQ:ZERO,done:false,moving:[],cuts:{},completedCuts:{},returned:{},paths:[],
      lineAngleQ:ZZSliceLine.gate(S),lineBaseAngleQ:ZZSliceLine.gate(S),lineBaseGateQ:ZZSliceLine.gate(S),sourceRateQ:ZERO,linePasses:0,startClock:coneMotionClock(),startRows:Z.rows.slice(),startRot:coneRot.slice(),startView:{...Z.coneViewPose,pan:Z.coneViewPose.pan.slice()}};
    slicing.selfReturn = !!Z.coneSliceSelfReturn;
    slicing.firstThrough = sliceThroughOn(); slicing.initialThroughDone = false;
    if (slicing.selfReturn) {
      slicing.oneRing = false; slicing.immediate = false; slicing.returnSeeds = [];
      sliceSelfReturnCut(0,QUARTER.neg().mod(),S,null,[]);
    } else sliceLineCut(S);
    sliceCycleObserve(snapshot()); sliceStatus(); renderRows(); save(); renderCone(); return true;
  }
  function sliceSelfReturnCut(k,raw,S,motion,sources,details){
    const cuts = slicing.cuts[k] ||= [];
    if (!cuts.some(cut => cut.eq(raw))) {
      cuts.push(raw); (slicing.completedCuts[k] ||= []).push(raw);
      slicing.returnSeeds.push({k,rawQ:raw,rayOffsetQ:ZERO,basePhaseQ:S.rings[k].phaseQ.add(S.spinQ)});
    }
    sliceRememberCut(k,raw,S,motion,sources,details);
  }
  function sliceSelfReturnAdvance(A,B,dt){
    const C = frame(A,B), event = ZZSliceLine.selfReturns(slicing.returnSeeds,A,B);
    if (!event) { slicing.elapsedQ = slicing.elapsedQ.add(C.durationQ); sliceStatus(); return; }
    const t = event.fraction;
    slicing.elapsedQ = slicing.elapsedQ.add(C.durationQ.mul(t));
    let S = C.at(t);
    coneMotionSetClock(S.clockPhaseQ,S.spinQ.mul(360));
    // Only cuts present before this event can pass the ray further outward.
    // Simultaneous sources cannot use a cut just created by another source.
    const existingCuts = Object.fromEntries(Object.entries(slicing.cuts).map(([k,cuts]) => [k,cuts.slice()]));
    for (const seed of event.seeds) {
      const k = seed.k;
      const phase = S.rings[k].phaseQ.add(S.spinQ);
      // Mirror the previous ray direction about the direction of this meeting:
      // outgoing = 2 * meeting - previous. Keep signed exact angular travel;
      // the first imprint has no previous meeting to reflect from yet.
      const firstPass = seed.targetRawQ === undefined, sourceTravel = phase.sub(seed.basePhaseQ);
      const meetingTurn = firstPass ? ZERO : sourceTravel;
      seed.basePhaseQ = phase;
      const sources = sliceBallCutSources(k,seed.rawQ);
      const angle = seed.basePhaseQ.add(seed.rawQ).add(seed.rayOffsetQ || ZERO);
      let passedOutward = false;
      const initialThrough = slicing.firstThrough && !slicing.initialThroughDone && k === 0;
      for (let next = k + 1; next < slicing.rowLimit; next++) {
        if (next === slicing.count) { sliceGrow(); S = snapshot(); }
        if (!S.rings[next]) break;
        const raw = angle.sub(S.rings[next].phaseQ).sub(S.spinQ).mod();
        const alreadyCut = (existingCuts[next] || []).some(cut => cut.eq(raw));
        const reflection = Z.coneSliceRayFlip !== false ? meetingTurn : ZERO;
        sliceSelfReturnCut(next,raw,S,C.deltaQ,sources,{
          sourceRing:k,sourceCut:sliceCutNumber(k,seed.rawQ),sourceTravel:sourceTravel.text(),
          previousRay:angle.sub(sourceTravel).mod().text(),meetingRay:angle.mod().text(),
          reflection:reflection.text(),outgoingRay:angle.add(reflection).mod().text(),
          cause:initialThrough ? "Первый сквозной луч после оборота К1" : firstPass ? "Первый оборот" : "Встреча со своим следом",
          mirror:Z.coneSliceRayFlip !== false,
          result:alreadyCut ? next+1 < slicing.rowLimit ? "Проход наружу" : "Повтор у предела" : "Новый вырез"
        });
        passedOutward = true;
        seed.rayReach = next + 1;
        // The moving reference stays on the immediate neighbor, even when
        // this pass reaches a more distant ring through existing cuts.
        if (next === k + 1) seed.targetRawQ = raw;
        slicing.linePasses++;
        if (!alreadyCut && !initialThrough) break;
        sources.push({k:next,number:sliceCutNumber(next,raw)});
      }
      if (initialThrough) {
        slicing.initialThroughDone = true;
        // Each new cut continues toward its own imprint on the next ring.
        // They all share the first ray, but subsequently rotate with their rings.
        for (const born of slicing.returnSeeds) {
          if (born.k + 1 >= slicing.count) continue;
          born.targetRawQ = angle.sub(S.rings[born.k+1].phaseQ).sub(S.spinQ).mod();
          born.rayReach = slicing.count;
        }
      }
      // Apply the reflection once after the complete outward pass. The source
      // cut, its imprint and both ring rotations stay at their actual angles.
      if (passedOutward && Z.coneSliceRayFlip !== false) seed.rayOffsetQ = Q(seed.rayOffsetQ || ZERO).add(meetingTurn).mod();
    }
    if (sliceLimitComplete()) { sliceFinishAtLimit(); sliceStatus(); save(); renderCone(); return; }
    if (sliceCycleObserve(S)) { sliceStatus(); save(); renderCone(); return; }
    const remaining = Q(dt).mul(ONE.sub(t));
    if (remaining.sign() && window.zzBallContinueFrame) window.zzBallContinueFrame(remaining);
    sliceStatus();
  }
  function sliceLineCutOneRing(S, motion){
    const k = slicing.activeRing, sources = [];
    for (let inner = 0; inner < k; inner++) {
      const raw = slicing.lineAngleQ.sub(S.rings[inner].phaseQ).sub(S.spinQ).mod(), number = sliceCutNumber(inner,raw);
      if (!number) return false;
      if (inner) sliceRememberCut(inner,raw,S,motion,sources);
      sources.push({k:inner,number});
    }
    const remember = (ring,raw) => sliceRememberCut(ring,raw,S,motion,sources);
    ZZSliceLine.cut(slicing,S,slicing.lineAngleQ,remember,k + 1,k,remember);
    slicing.linePasses++; slicing.lineCutRing = k;
    if ((slicing.completedCuts[k] || []).length < k + 1) return false;
    if (k + 1 >= slicing.rowLimit) { coneMotionSetClock(S.clockPhaseQ,S.spinQ.mul(360)); sliceFinishAtLimit(); return false; }
    let grew = false;
    if (k + 1 === slicing.count) { coneMotionSetClock(S.clockPhaseQ,S.spinQ.mul(360)); grew = sliceGrow(); }
    slicing.activeRing = k + 1;
    return grew;
  }
  function sliceLineCutImmediate(S, motion){
    let grew = false, start = 1; slicing.linePasses++;
    while (!slicing.done) {
      const remember = (k,raw) => sliceRememberCut(k,raw,S,motion,sliceRayCutSources(k,S));
      ZZSliceLine.cut(slicing,S,slicing.lineAngleQ,remember,slicing.rowLimit,start,remember);
      if (sliceLimitComplete()) { coneMotionSetClock(S.clockPhaseQ,S.spinQ.mul(360)); sliceFinishAtLimit(); break; }
      if (slicing.count >= slicing.rowLimit) break;
      const last = Math.min(slicing.count,slicing.rowLimit) - 1;
      const raw = slicing.lineAngleQ.sub(S.rings[last].phaseQ).sub(S.spinQ).mod();
      if (!sliceCutNumber(last,raw)) break;
      coneMotionSetClock(S.clockPhaseQ,S.spinQ.mul(360));
      if (!sliceGrow()) break;
      grew = true; start = slicing.count - 1; S = snapshot();
    }
    return grew;
  }
  function sliceLineCut(S, motion){
    slicing.lineAngleQ = sliceLineAngleAt(S);
    if (!ZZSliceLine.aligned(S,slicing.lineAngleQ)) return false;
    if (!slicing.oneRing || slicing.activeRing > 0) {
      const raw = QUARTER.neg().mod(); slicing.cuts[0] ||= [raw]; slicing.completedCuts[0] ||= [raw];
      sliceRememberCut(0,raw,S,motion,[]);
    }
    if (slicing.oneRing) return sliceLineCutOneRing(S,motion);
    if (slicing.immediate) return sliceLineCutImmediate(S,motion);
    let grew = false;
    if (slicing.count === 1) { grew = sliceGrow(); if (grew) S = snapshot(); }
    const remember = (k,raw) => sliceRememberCut(k,raw,S,motion,sliceRayCutSources(k,S));
    ZZSliceLine.cut(slicing,S,slicing.lineAngleQ,remember,slicing.rowLimit,1,remember); slicing.linePasses++;
    const target = Math.min(slicing.count,slicing.rowLimit), last = target - 1;
    if ((slicing.completedCuts[last] || []).length >= target) {
      if (target >= slicing.rowLimit) { coneMotionSetClock(S.clockPhaseQ,S.spinQ.mul(360)); sliceFinishAtLimit(); }
      else if (!grew && sliceGrow()) {
        grew = true; const next = snapshot(); ZZSliceLine.cut(slicing,next,slicing.lineAngleQ,(k,raw) => sliceRememberCut(k,raw,next,motion,sliceRayCutSources(k,next)),slicing.rowLimit,next.rings.length-1);
        if (slicing.immediate && sliceLimitComplete()) sliceFinishAtLimit();
      }
    }
    return grew;
  }
  function sliceLineAdvance(A,B,dt){
    if (!slicing || slicing.done || paused || !A || !B) return;
    if (A.rings.length !== slicing.count || B.rings.length !== slicing.count) { paused = true; status("Нарезка: кольца изменились · запусти заново"); return; }
    if (slicing.selfReturn) return sliceSelfReturnAdvance(A,B,dt);
    const C = frame(A,B), duration = C.durationQ; if (!duration.sign()) return;
    let elapsed = ZERO;
    const relativeA = ZZSliceLine.gate(A).sub(sliceLineAngleAt(A)), relativeB = ZZSliceLine.gate(B).sub(sliceLineAngleAt(B));
    for (const t of ZZSliceLine.crossings(relativeA,relativeB,ZERO)) {
      const at = duration.mul(t); slicing.elapsedQ = slicing.elapsedQ.add(at.sub(elapsed)); elapsed = at;
      const S = C.at(t); slicing.lineAngleQ = sliceLineAngleAt(S);
      const target = slicing.oneRing ? slicing.activeRing + 1 : Math.min(slicing.count,slicing.rowLimit), last = target - 1, raw = slicing.lineAngleQ.sub(S.rings[last].phaseQ).sub(S.spinQ).mod();
      const cuts = slicing.completedCuts[last] || [], complete = cuts.length + (cuts.some(a => a.eq(raw)) ? 0 : 1) >= target;
      const canGrow = slicing.oneRing ? target === slicing.count && complete && sliceRayCutSources(last,S).length === last : slicing.immediate ? slicing.count < slicing.rowLimit : last === 0 || complete;
      // New rings begin at the crossing clock, rather than the frame end.
      if (canGrow) coneMotionSetClock(S.clockPhaseQ,S.spinQ.mul(360));
      const grew = sliceLineCut(S,C.deltaQ);
      if (!slicing.done) sliceCycleObserve(grew ? snapshot() : S);
      if (slicing.done) { sliceStatus(); save(); renderCone(); return; }
      if (grew) {
        const remaining = Q(dt).mul(ONE.sub(t));
        if (remaining.sign() && window.zzBallContinueFrame) window.zzBallContinueFrame(remaining);
        sliceStatus(); return;
      }
    }
    slicing.lineAngleQ = sliceLineAngleAt(B);
    slicing.elapsedQ = slicing.elapsedQ.add(duration.sub(elapsed)); sliceStatus();
  }
  function sliceNext(S){
    if (!Z.coneBallChain || !slicing || slicing.moving.length >= CHAIN_MAX) return false;
    if (!S?.rings[0]) return false;
    const previous = slicing.moving[slicing.moving.length - 1];
    const ball = {id:previous.id + 1,rQ:ZERO,k:0,rawQ:QUARTER.neg(),move:1,speedQ:previous.speedQ,launchK:0,exitedK:-1};
    slicing.moving.push(ball);
    return true;
  }
  function sliceAdvance(A, B, dt){
    if (!slicing || slicing.done || paused || !A || !B) return;
    if (A.rings.length !== slicing.count || B.rings.length !== slicing.count) { paused = true; status("Нарезка: кольца изменились · запусти заново"); return; }
    const C = frame(A,B), duration = C.durationQ; if (!duration.sign()) return;
    for (const ball of slicing.moving) if (ball.rQ.eq(ZERO) && ball.move < 0) sliceReflectCenter(ball);
    let elapsed = ZERO;
    while (elapsed.cmp(duration) < 0 && !slicing.done) {
      let step = duration.sub(elapsed);
      for (const ball of slicing.moving) {
        const edge = Q(ball.move > 0 ? ball.k + 1 : ball.k);
        step = ZZExact.min(step,edge.sub(ball.rQ).abs().div(ball.speedQ));
      }
      for (const ball of slicing.moving) {
        const r0 = ball.rQ, r1 = r0.add(ball.speedQ.mul(step).mul(ball.move));
        sliceRecord(ball,r0,r1); ball.rQ = r1;
      }
      elapsed = elapsed.add(step); slicing.elapsedQ = slicing.elapsedQ.add(step);
      let to = C.at(elapsed.div(duration));
      const contacts = slicing.moving.filter(ball => ball.rQ.eq(Q(ball.move > 0 ? ball.k + 1 : ball.k)));
      if (!contacts.length) break;
      for (const ball of contacts) {
        if (ball.move < 0) slicing.returned[ball.k] = true;
        if (ball.k > 0) {
          const raw = ball.rawQ.mod(), completed = slicing.completedCuts[ball.k] || (slicing.completedCuts[ball.k] = []);
          if (!completed.some(a => a.eq(raw))) completed.push(raw);
        }
      }
      const last = Math.min(slicing.count,slicing.rowLimit) - 1;
      const ready = last === 0 ? contacts.some(ball => ball.k === 0 && ball.move > 0) : (slicing.completedCuts[last] || []).length >= last + 1;
      const latest = slicing.moving[slicing.moving.length - 1];
      const passed = contacts.some(ball => ball === latest && ball.move > 0 && ball.k === ball.launchK + 1);
      const edgeReached = contacts.some(ball => ball === latest && ball.rQ.sign() > 0);
      let grew = false, centre = false;
      if (ready) {
        coneMotionSetClock(to.clockPhaseQ,to.spinQ.mul(360));
        if (last + 1 >= slicing.rowLimit) {
          sliceFinishAtLimit(); sliceStatus(); save(); renderCone(); return;
        }
        grew = sliceGrow();
        if (grew) to = snapshot();
      }
      for (const ball of contacts) {
        const {k,move} = ball, angle = to.rings[k].phaseQ.add(to.spinQ).add(ball.rawQ);
        if (move > 0 && ball.rQ.eq(slicing.RQ)) { ball.move = -1; slicing.outerBounces++; }
        else if (move < 0 && ball.rQ.eq(ZERO)) { sliceReflectCenter(ball); centre = true; }
        else {
          const next = k + move;
          if (move > 0) ball.exitedK = Math.max(ball.exitedK,k);
          let hit = move < 0 && !!Z.coneSliceRebound && next <= ball.exitedK;
          if (!hit && !next && move < 0) {
            const d = angle.sub(to.rings[0].phaseQ).sub(to.spinQ).add(QUARTER).mod(), halfGap = Q(Z.coneSliceGap || "1/4").div(2);
            hit = d.cmp(halfGap) > 0 && d.cmp(ONE.sub(halfGap)) < 0;
          }
          if (hit) { ball.move = 1; slicing.innerBounces++; }
          else sliceEnter(ball,next,to,angle,C.deltaQ);
        }
      }
      const policy = Z.coneSliceNext || "pass";
      const spawned = ((policy === "open" && grew) || (policy === "edge" && edgeReached) || (policy === "pass" && passed)) && sliceNext(to);
      if (sliceCycleObserve(to)) { sliceStatus(); save(); renderCone(); return; }
      if (grew || centre || spawned) {
        coneMotionSetClock(to.clockPhaseQ,to.spinQ.mul(360));
        const remaining = Q(dt).mul(ONE.sub(elapsed.div(duration)));
        if (remaining.sign() && window.zzBallContinueFrame) window.zzBallContinueFrame(remaining);
        sliceStatus(); return;
      }
    }
    sliceStatus();
  }
  function sliceCutNumbersDraw(g, S, o){
    if (Z.coneSliceCutNumbers === false) return;
    const {cx,cy,dr,dpr} = o;
    const fontSize = Math.max(8 * dpr,Math.min(12 * dpr,dr * 0.45));
    const offset = Math.min(fontSize * 0.7,dr * 0.3);
    g.save(); g.globalAlpha = 1; g.shadowBlur = 0; g.setLineDash([]);
    g.font = "bold " + fontSize + "px Consolas, monospace";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.strokeStyle = "#f1f2f4"; g.fillStyle = "#624116"; g.lineWidth = 3 * dpr; g.lineJoin = "round";
    for (let k = 0; k < S.rings.length; k++) {
      const cuts = k ? slicing?.cuts[k] || [] : [QUARTER.neg().add(sliceLineOn() ? ZERO : Q(Z.coneSliceGap || "1/4").div(2))];
      const phase = S.rings[k].phaseQ.add(S.spinQ), radius = (k + 0.5) * dr;
      for (let i = 0; i < cuts.length; i++) {
        const a = radians(cuts[i].add(phase)), c = Math.cos(a), s = Math.sin(a);
        const x = cx + radius * c - offset * s, y = cy + radius * s + offset * c;
        const label = String(i + 1);
        g.strokeText(label,x,y); g.fillText(label,x,y);
      }
    }
    g.restore();
  }
  function sliceBitCells(S, k){
    const cell = (j,raw,width,initialIndex = j) => {
      // A sector belongs to its starting cut, never to a wrapped row index.
      // Its key survives sorting and the insertion of further cuts.
      const sectorKey = k + ":" + raw.mod().text(), stored = Z.coneSliceSectorBits?.[sectorKey];
      return {j,raw,width,sectorKey,value:stored ?? Z.rows[k]?.[initialIndex] ?? "0",
        marked:stored !== undefined || !!Z.coneSliceBitMarks?.[k+":"+initialIndex]};
    };
    if (!k) { const gap = sliceLineOn() ? ZERO : Q(Z.coneSliceGap || "1/4"); return [cell(0,QUARTER.neg().add(gap.div(2)),ONE.sub(gap))]; }
    const original = slicing?.cuts[k] || [], cuts = original.slice().sort((a,b) => a.cmp(b));
    return cuts.length ? cuts.map((raw,j) => cell(j,raw,cuts[(j+1)%cuts.length].add(j === cuts.length-1 ? ONE : ZERO).sub(raw),original.indexOf(raw))) : [cell(0,QUARTER.neg(),ONE)];
  }
  function sliceBitsDraw(g,S,o){
    const {cx,cy,dr,dpr} = o;
    g.save(); g.globalAlpha = 1; g.shadowBlur = 0; g.setLineDash([]);
    g.font = "bold " + Math.max(9*dpr,Math.min(14*dpr,dr*.45)) + "px Consolas, monospace"; g.textAlign = "center"; g.textBaseline = "middle";
    for (let k = 0; k < S.rings.length; k++) {
      const cells = sliceBitCells(S,k);
      const denominator = Z.coneSliceFractions ? cells.reduce((d,cell) => d / ZZExact.gcd(d,cell.width.d) * cell.width.d,1n) : 1n;
      for (const cell of cells) {
        const value = cell.value, phase = S.rings[k].phaseQ.add(S.spinQ), lo = radians(cell.raw.add(phase)), hi = lo + radians(cell.width);
        if (value === "1") {
          g.fillStyle = "#647d9d"; g.beginPath(); g.arc(cx,cy,(k+1)*dr,lo,hi); g.arc(cx,cy,k*dr,hi,lo,true); g.closePath(); g.fill();
        }
        if (Z.coneSliceFractions || value === "1" || cell.marked) {
          const a = (lo+hi)/2, r = (k+.5)*dr, x = cx+r*Math.cos(a), y = cy+r*Math.sin(a);
          const label = Z.coneSliceFractions ? denominator === 1n ? cell.width.text() : (cell.width.n * (denominator / cell.width.d)) + "/" + denominator : value;
          g.strokeStyle = value === "1" ? "#647d9d" : "#f1f2f4"; g.fillStyle = value === "1" ? "#fff" : "#303947"; g.lineWidth = 3*dpr; g.strokeText(label,x,y); g.fillText(label,x,y);
        }
      }
    }
    g.restore();
  }
  function sliceHitAt(e,o,scope){
    const cv = $("coneCv"), r = cv.getBoundingClientRect(); if (!r.width || !r.height) return null;
    const x = (e.clientX-r.left)*cv.width/r.width-o.cx, y = (e.clientY-r.top)*cv.height/r.height-o.cy;
    const S = snapshot(), k = Math.floor(Math.hypot(x,y)/o.dr); if (!S || k < 0 || k >= S.rings.length) return null;
    const angle = Q(Math.atan2(y,x)/TAU).sub(S.rings[k].phaseQ).sub(S.spinQ).mod();
    const cell = sliceBitCells(S,k).find(cell => angle.sub(cell.raw).mod().cmp(cell.width) < 0);
    return cell ? {i:k,j:cell.j,sectorKey:cell.sectorKey,scope,value:cell.value,label:scope?.label || "Нарезка"} : null;
  }
  window.zzBallSliceBitAt = e => {
    if (!slicingOn() || !enabled || Z.cone3d || !coneGeom) return null;
    if (!sliceDualOn()) return sliceHitAt(e,coneGeom,null);
    sliceEnsureDuos();
    for (const scope of sliceDuos) if (scope.layout) { const hit = sliceWithScope(scope,() => sliceHitAt(e,scope.layout,scope)); if (hit) return hit; }
    return null;
  };
  window.zzBallSliceBitFlip = target => {
    const bit = target?.i !== undefined ? target : window.zzBallSliceBitAt(target); if (!bit) return;
    if (window.zzConeTapeRecord) window.zzConeTapeRecord();
    const flip = () => {
      const S = snapshot(); if (!S?.rings[bit.i]) return;
      const cell = sliceBitCells(S,bit.i).find(cell => cell.sectorKey === bit.sectorKey);
      if (!cell) return;
      sliceCycleReset();
      (Z.coneSliceSectorBits ||= {})[cell.sectorKey] = cell.value === "1" ? "0" : "1";
    };
    if (bit.scope) {
      sliceWithScope(bit.scope,flip); slicePublishPrimary();
    } else flip();
    save(); renderCone();
    if (window.zzConeTapeRecord) window.zzConeTapeRecord();
  };
  let sliceHandVisual = null;
  function sliceHandFeatures(S,k){
    const phase = i => S.rings[i].phaseQ.add(S.spinQ);
    const cells = i => sliceBitCells(S,i);
    const edges = i => i && !slicing?.cuts[i]?.length ? [] : cells(i).map((c,j) => ({angle:c.raw.add(phase(i)),name:"грань " + (j+1)}));
    const mids = i => edges(i).length ? cells(i).map((c,j) => ({angle:c.raw.add(c.width.div(2)).add(phase(i)),name:"середина бита " + (j+1)})) : [];
    const direction = magSymOf(), parts = magPartsOnly(), ownEdges = edges(k);
    const own = ownEdges.concat(!parts || k === 0 ? mids(k) : []), targets = [];
    const neighbors = [];
    if ((direction === "both" || direction === "in") && k > 0) neighbors.push(k-1);
    if ((direction === "both" || direction === "out") && k+1 < S.rings.length) neighbors.push(k+1);
    const addEdges = i => edges(i).forEach(e => targets.push({...e,k:i,name:e.name + " кольца " + (i+1),edge:true}));
    if (parts) neighbors.forEach(addEdges);
    else {
      for (let i = 0; i < k; i++) addEdges(i);
      // Reflect the actual cut pattern and sector values, not the original row.
      for (const i of neighbors) {
        const cs = cells(i), es = edges(i); if (!es.length) continue;
        for (const e of es) {
          const axis = es[0].angle.add(e.angle).div(2);
          if (!es.every(a => es.some(b => axis.mul(2).sub(a.angle).sub(b.angle).mod().eq(0)))) continue;
          if (!cs.every(c => {
            const reflected = axis.mul(2).sub(c.raw.add(c.width.div(2)).add(phase(i))).sub(phase(i)).mod();
            return cs.find(other => reflected.sub(other.raw).mod().cmp(other.width) < 0)?.value === c.value;
          })) continue;
          for (const a of [axis,axis.add(HALF)]) targets.push({angle:a,k:i,name:"ось симметрии кольца " + (i+1)});
        }
      }
    }
    if (k === 0 && Z.coneAxes && (direction === "both" || direction === "in")) {
      for (let j = 0; j < 4; j++) targets.push({angle:Q(j,4),k:0,name:j%2 ? "вертикаль" : "горизонталь"});
    }
    return {own,ownEdges,targets,parts};
  }
  function sliceHandSnap(S,k,layout){
    if (Z.coneSliceHandRays === false) return null;
    const {own,ownEdges,targets,parts} = sliceHandFeatures(S,k);
    // This is pointer attraction only. The resulting angles coincide exactly;
    // no tolerance is introduced into cutting or ball collision calculations.
    const tolerance = 7 * layout.dpr / Math.max(20*layout.dpr,(k+.5)*layout.dr);
    let best = null;
    for (const target of targets) for (const source of parts && target.edge ? ownEdges : own) {
      const deltaQ = target.angle.sub(source.angle).add(HALF).mod().sub(HALF), distance = Math.abs(radians(deltaQ));
      if (distance < tolerance && (!best || distance < best.distance)) best = {deltaQ,distance,angleQ:target.angle,targetK:target.k,text:"🧲 Кольцо " + (k+1) + ": " + source.name + " → " + target.name};
    }
    return best;
  }
  function sliceHandGuidesDraw(g,S,o){
    if (Z.coneSliceHandRays === false || !sliceHandVisual || (sliceHandVisual.scope || null) !== sliceScope) return;
    const k = sliceHandVisual.k; if (!S.rings[k]) return;
    const {cx,cy,dr,dpr} = o, {own,ownEdges,targets,parts} = sliceHandFeatures(S,k);
    const axes = new Map(), segments = new Map();
    for (const source of own) {
      const angle = source.angle.mod(HALF);
      axes.set(angle.text(),{angle,matched:false});
    }
    // Collect all matches first; each half-axis and each ring is independent.
    for (const target of targets) for (const source of parts && target.edge ? ownEdges : own) {
      if (!target.angle.sub(source.angle).mod().eq(0)) continue;
      const angle = target.angle.mod();
      axes.get(angle.mod(HALF).text()).matched = true;
      for (const ring of [k,target.k]) segments.set(ring+":"+angle.text(),{ring,angle});
    }
    g.save(); g.globalAlpha = .8; g.lineWidth = dpr; g.setLineDash([3*dpr,4*dpr]);
    const radius = S.rings.length*dr;
    for (const {angle,matched} of axes.values()) {
      const a = radians(angle), c = Math.cos(a), s = Math.sin(a);
      g.strokeStyle = matched ? "#00aa91" : "#bd842b";
      g.beginPath(); g.moveTo(cx-radius*c,cy-radius*s); g.lineTo(cx+radius*c,cy+radius*s); g.stroke();
    }
    // Only the thickness of a matching ring is solid. Gaps and the unmatched
    // opposite side keep the dashed axis, even when several rings align.
    g.globalAlpha = 1; g.strokeStyle = "#00aa91"; g.fillStyle = "#00aa91"; g.lineWidth = 2*dpr; g.setLineDash([]);
    for (const {ring,angle} of segments.values()) {
      const a = radians(angle), c = Math.cos(a), s = Math.sin(a), inner = ring*dr, outer = (ring+1)*dr, r = (ring+.5)*dr;
      g.beginPath(); g.moveTo(cx+inner*c,cy+inner*s); g.lineTo(cx+outer*c,cy+outer*s); g.stroke();
      g.beginPath(); g.arc(cx+r*c,cy+r*s,4*dpr,0,TAU); g.fill();
    }
    g.restore();
  }
  window.zzBallSliceDragStart = e => {
    if (!slicingOn() || Z.cone3d || e.shiftKey || !(e.button === 2 || e.ctrlKey || e.metaKey)) return false;
    const bit = window.zzBallSliceBitAt(e); if (!bit) return false;
    const cv = $("coneCv"), layout = bit.scope?.layout || coneGeom;
    const scoped = fn => bit.scope ? sliceWithScope(bit.scope,fn) : fn();
    const angle = ev => {
      const r = cv.getBoundingClientRect();
      return Math.atan2((ev.clientY-r.top)*cv.height/r.height-layout.cy,(ev.clientX-r.left)*cv.width/r.width-layout.cx);
    };
    const rb = e.button === 2, x0 = e.clientX, y0 = e.clientY;
    let last = angle(e), moved = false, ended = false, handTurn = ZERO, startRotation = null;
    sliceHandVisual = null;
    e.preventDefault(); e.stopImmediatePropagation();
    cv._sliceContextHandled = rb;
    cv.setPointerCapture(e.pointerId);
    const move = ev => {
      if (ev.pointerId !== e.pointerId) return;
      if (!moved) {
        if (Math.abs(ev.clientX-x0)+Math.abs(ev.clientY-y0) <= 4) return;
        if (window.zzConeTapeRecord) window.zzConeTapeRecord();
        pauseRotation(); paused = true; for (const scope of sliceDuos) scope.paused = true;
        startRotation = scoped(() => sliceTurn(bit.i));
        scoped(sliceCycleReset);
        sliceHandVisual = {scope:bit.scope,k:bit.i};
        moved = true; cv.style.cursor = "grabbing";
      }
      const a = angle(ev); let delta = a-last;
      if (delta > Math.PI) delta -= TAU; if (delta < -Math.PI) delta += TAU;
      last = a;
      handTurn = handTurn.add(Q(delta / TAU));
      let snap = null;
      scoped(() => {
        const k = bit.i, before = snapshot().rings[k].phaseQ;
        let rotation = startRotation.add(handTurn);
        sliceSetTurn(k,rotation);
        snap = sliceHandSnap(snapshot(),k,layout);
        if (snap) {
          rotation = rotation.add(snap.deltaQ);
          sliceSetTurn(k,rotation);
        }
        const turn = snapshot().rings[k].phaseQ.sub(before);
        // Reposition the return reference too: hand motion does not cut rings
        // or consume the pending full turn when automatic motion resumes.
        for (const seed of slicing?.returnSeeds || []) if (seed.k === k) seed.basePhaseQ = seed.basePhaseQ.add(turn);
      });
      coneSnapShow(snap ? (bit.scope ? bit.scope.label + " · " : "") + snap.text : "");
      if (bit.scope) slicePublishPrimary();
      renderCone();
    };
    const end = ev => {
      if (ended || ev.pointerId !== undefined && ev.pointerId !== e.pointerId) return;
      ended = true;
      cv.removeEventListener("pointermove",move); cv.removeEventListener("pointerup",end);
      cv.removeEventListener("pointercancel",end); cv.removeEventListener("lostpointercapture",end);
      window.removeEventListener("blur",end);
      if (cv.hasPointerCapture(e.pointerId)) cv.releasePointerCapture(e.pointerId);
      cv.style.cursor = "grab";
      sliceHandVisual = null; coneSnapShow("");
      if (moved) {
        save(); renderCone(); labControls();
        if (window.zzConeTapeRecord) window.zzConeTapeRecord();
      } else if (rb && ev.type === "pointerup") window.zzBallSliceBitFlip(bit);
    };
    cv.addEventListener("pointermove",move); cv.addEventListener("pointerup",end);
    cv.addEventListener("pointercancel",end); cv.addEventListener("lostpointercapture",end);
    window.addEventListener("blur",end);
    return true;
  };
  function sliceDualDraw(g,o){
    sliceEnsureDuos();
    const W = g.canvas.width, H = g.canvas.height, total = sliceDuos.length, spacing = 24*o.dpr, titleH = 42*o.dpr;
    let cols = 1, baseRadius = 0;
    for (let c = 1; c <= total; c++) {
      const r = Math.ceil(total/c), size = Math.min((W/c-spacing)/2,(H/r-spacing-titleH)/2);
      if (size > baseRadius) { baseRadius = size; cols = c; }
    }
    const rows = Math.ceil(total/cols), radius = Math.max(1,baseRadius)*coneZoom;
    const gapX = (2*baseRadius+spacing)*coneZoom, gapY = (2*baseRadius+spacing+titleH)*coneZoom;
    const count = Math.max(...sliceDuos.map(scope => scope.props.rows.length)), dr = radius/Math.max(1,count);
    g.save(); g.globalAlpha = 1; g.shadowBlur = 0; g.setLineDash([]);
    g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#171c26"; g.fillRect(0,0,W,H);
    g.strokeStyle = "#9f76c5"; g.lineWidth = o.dpr; g.setLineDash([5*o.dpr,5*o.dpr]);
    g.beginPath(); g.moveTo(0,o.cy); g.lineTo(W,o.cy); g.stroke();
    sliceDuos.forEach((scope,i) => {
      const row = Math.floor(i/cols), rowCount = Math.min(cols,total-row*cols);
      const layout = {...o,cx:o.cx+(i%cols-(rowCount-1)/2)*gapX,cy:o.cy+(row-(rows-1)/2)*gapY+titleH/2,dr,sliceHeaderRadius:radius}; scope.layout = layout;
      sliceWithScope(scope,() => { sliceDraw(g,layout); if (window.zzFaceDraw) window.zzFaceDraw(g,{...layout,r0:0,band:1,shown:()=>true}); });
      g.setLineDash([]); g.font = "bold " + 13*o.dpr + "px Consolas, monospace"; g.textAlign = "center"; g.textBaseline = "bottom"; g.fillStyle = "#ffd166";
      g.fillText(scope.label,layout.cx,layout.cy-radius-25*o.dpr);
    });
    g.restore(); sliceStatus();
  }
  function sliceSpeedsDraw(g,S,o){
    const {cx,cy,dr,dpr} = o;
    g.save(); g.setLineDash([]); g.globalAlpha = 1; g.shadowBlur = 0;
    g.font = "bold " + Math.max(8*dpr,Math.min(11*dpr,dr*.3)) + "px Consolas, monospace";
    g.textAlign = "center"; g.textBaseline = "middle";
    const speed = Q(Z.coneAutoSp ?? 30).abs();
    if (!Z.coneSliceOldSpeed || S.rings.length === 1 || !speed.sign()) {
      g.font = "bold " + 11*dpr + "px Consolas, monospace";
      g.fillStyle = "#79e7e1";
      const text = "Скорость у всех: " + speed.text() + "°/с" + (sliceOpposite() ? " · ↻↺" : "");
      const radius = o.sliceHeaderRadius || S.rings.length*dr;
      g.fillText(text,cx,Math.max(12*dpr,cy-radius-10*dpr),Math.max(1,Math.min(g.canvas.width-12*dpr,Math.max(2*radius,210*dpr))));
      g.restore(); return;
    }
    for (let k = 0; k < S.rings.length; k++) {
      const rate = sliceRate(k), direction = rate.sign()*Q(Z.coneAutoSp ?? 30).sign();
      const text = (direction > 0 ? "↻" : direction < 0 ? "↺" : "•") + " ×" + (direction ? rate.abs().text() : "0");
      const width = Math.min(g.measureText(text).width,dr*1.6);
      g.save(); g.translate(cx-(k+.5)*dr,cy); g.rotate(-Math.PI/2);
      g.fillStyle = "#f1f2f4"; g.fillRect(-width/2-2*dpr,-7*dpr,width+4*dpr,14*dpr);
      g.fillStyle = "#006b70"; g.fillText(text,0,0,dr*1.6); g.restore();
    }
    g.restore();
  }
  function sliceDraw(g, o){
    const S = snapshot(); if (!S) return;
    const {cx,cy,dr,dpr} = o, count = S.rings.length, first = S.rings[0].phaseQ.add(S.spinQ);
    const gapAngle = radians(first.sub(QUARTER));
    const gap = sliceLineOn() ? ZERO : Q(Z.coneSliceGap || "1/4"), halfGap = radians(gap.div(2));
    g.save(); g.globalAlpha = 1; g.shadowBlur = 0; g.setLineDash([]);
    g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#171c26";
    g.beginPath(); g.arc(cx,cy,count * dr + 2 * dpr,0,TAU); g.fill();
    for (let k = count - 1; k >= 0; k--) {
      g.fillStyle = "#f1f2f4"; g.beginPath();
      if (!k && !sliceLineOn()) { g.moveTo(cx,cy); g.arc(cx,cy,dr,gapAngle + halfGap,gapAngle + TAU - halfGap); g.closePath(); }
      else if (!k) { g.arc(cx,cy,dr,0,TAU); }
      else { g.arc(cx,cy,(k + 1) * dr,0,TAU); g.arc(cx,cy,k * dr,TAU,0,true); }
      g.fill(); g.strokeStyle = "#8b929e"; g.lineWidth = dpr; g.beginPath(); g.arc(cx,cy,(k + 1) * dr,0,TAU); g.stroke();
    }
    sliceBitsDraw(g,S,o);
    if (slicing) for (const [key,cuts] of Object.entries(slicing.cuts)) {
      const k = +key, phase = S.rings[k].phaseQ.add(S.spinQ);
      for (const raw of cuts) {
        const angle = radians(raw.add(phase)), c = Math.cos(angle), s = Math.sin(angle);
        const path = slicing.paths.find(p => p.k === k && p.raw0.mod().eq(raw));
        g.strokeStyle = (path ? path.move : 1) > 0 ? "#e58b21" : "#007f89";
        g.lineWidth = 2 * dpr; g.beginPath(); g.moveTo(cx + k * dr * c,cy + k * dr * s);
        g.lineTo(cx + (k + 1) * dr * c,cy + (k + 1) * dr * s); g.stroke();
      }
    }
    sliceHandGuidesDraw(g,S,o);
    if (sliceLineOn()) {
      if (slicing?.selfReturn || !slicing && Z.coneSliceSelfReturn) {
        // Before the first imprint, the birth direction is a stationary
        // reference in the source ring. Afterwards, extend the moving source.
        const seeds = slicing?.returnSeeds || [{k:0,rawQ:QUARTER.neg(),basePhaseQ:S.rings[0].phaseQ.add(S.spinQ)}];
        // Draw the fixed birth references first, then the actual rays on top.
        // A ray is a directed segment from the centre, not just an annular dash.
        for (const seed of seeds.filter(seed => seed.targetRawQ === undefined)) {
          const ring = seed.k;
          if (!S.rings[ring]) continue;
          const a = radians(seed.basePhaseQ.add(seed.rawQ)), c = Math.cos(a), s = Math.sin(a);
          g.setLineDash([3*dpr,3*dpr]); g.strokeStyle = "#26bdb4"; g.lineWidth = dpr;
          g.beginPath(); g.moveTo(cx+ring*dr*c,cy+ring*dr*s); g.lineTo(cx+(ring+1)*dr*c,cy+(ring+1)*dr*s); g.stroke();
        }
        for (const seed of seeds.filter(seed => seed.targetRawQ !== undefined)) {
          if (!S.rings[seed.k]) continue;
          const angle = S.rings[seed.k].phaseQ.add(S.spinQ).add(seed.rawQ).add(seed.rayOffsetQ || ZERO);
          const a = radians(angle), c = Math.cos(a), s = Math.sin(a);
          const radius = Math.min(count,seed.rayReach || seed.k+2)*dr;
          const x = cx+radius*c, y = cy+radius*s, head = Math.min(9*dpr,dr*.3);
          g.strokeStyle = g.fillStyle = "#008f8b"; g.lineWidth = 2*dpr;
          g.setLineDash([]); g.beginPath(); g.moveTo(cx,cy);
          g.lineTo(cx+(seed.k+1)*dr*c,cy+(seed.k+1)*dr*s); g.stroke();
          g.setLineDash([4*dpr,3*dpr]); g.beginPath();
          g.moveTo(cx+(seed.k+1)*dr*c,cy+(seed.k+1)*dr*s); g.lineTo(x,y); g.stroke();
          g.setLineDash([]); g.beginPath(); g.moveTo(x,y);
          g.lineTo(x-head*c-head*.5*s,y-head*s+head*.5*c);
          g.lineTo(x-head*c+head*.5*s,y-head*s-head*.5*c); g.closePath(); g.fill();
        }
        g.setLineDash([]); sliceCutNumbersDraw(g,S,o); sliceSpeedsDraw(g,S,o); g.restore(); sliceStatus(); return;
      }
      const angle = sliceLineAngleAt(S), a = radians(angle), open = !!slicing && ZZSliceLine.aligned(S,angle);
      const oneRing = slicing ? slicing.oneRing : !!Z.coneSliceOneRing;
      const cutRing = oneRing ? slicing?.lineCutRing ?? 0 : 0;
      const radius = (oneRing ? cutRing + 1 : open ? Math.min(count,slicing?.rowLimit || sliceRowLimit()) : 1) * dr, inner = cutRing * dr;
      g.strokeStyle = open ? "#26bdb4" : "#e58b21"; g.lineWidth = dpr;
      if (!oneRing || open) { g.beginPath(); g.moveTo(cx + inner * Math.cos(a),cy + inner * Math.sin(a)); g.lineTo(cx + radius * Math.cos(a),cy + radius * Math.sin(a)); g.stroke(); }
      if (oneRing && slicing?.sourceRateQ?.sign()) { g.setLineDash([3*dpr,3*dpr]); g.strokeStyle = "#26bdb4"; g.beginPath(); g.moveTo(cx,cy); g.lineTo(cx + dr*.7*Math.cos(a),cy + dr*.7*Math.sin(a)); g.stroke(); g.setLineDash([]); }
      const seam = radians(ZZSliceLine.gate(S)); g.strokeStyle = "#e58b21";
      g.beginPath(); g.moveTo(cx,cy); g.lineTo(cx + dr * Math.cos(seam),cy + dr * Math.sin(seam)); g.stroke();
      sliceCutNumbersDraw(g,S,o); sliceSpeedsDraw(g,S,o);
      g.restore(); sliceStatus(); return;
    }
    const moving = slicing ? slicing.moving : [{id:1,k:0,rawQ:QUARTER.neg(),rQ:ZERO}];
    for (const ball of moving) {
      const a = radians(S.rings[ball.k].phaseQ.add(S.spinQ).add(ball.rawQ)), radius = ball.rQ.number() * dr;
      g.strokeStyle = "#26bdb4"; g.globalAlpha = 0.6; g.setLineDash([4 * dpr,4 * dpr]);
      g.beginPath(); g.moveTo(cx,cy); g.lineTo(cx + count * dr * Math.cos(a),cy + count * dr * Math.sin(a)); g.stroke();
      const x = cx + radius * Math.cos(a), y = cy + radius * Math.sin(a);
      g.globalAlpha = 1; g.setLineDash([]); g.fillStyle = "#21e777"; g.beginPath(); g.arc(x,y,4 * dpr,0,TAU); g.fill();
      if (moving.length > 1) { g.font = "bold " + 12 * dpr + "px Consolas, monospace"; g.textAlign = "center"; g.textBaseline = "bottom"; g.fillText(String(ball.id),x,y - 6 * dpr); }
    }
    sliceCutNumbersDraw(g,S,o); sliceSpeedsDraw(g,S,o);
    g.restore();
    sliceStatus();
  }
  window.zzBallClockOn = () => enabled;
  // v0.1051, «после вылета шарика из 1 кольца сразу же за ним начинает вылет 2 и так далее»: цепочка вылетов из центра (до CHAIN_MAX шариков)
  let chain = false; const CHAIN_MAX = 64;
  /* v0.1073, по снимку «баг: 2-й шарик должен был вылететь во 2-е кольцо» (цепочка, «✕ дуга»): следующий шарик цепочки стартовал в конце кадра,
     а прежний выходил из кольца 1 посреди кадра — опоздание до 1/60 с (К1 из одного бита при 3 бит/с — до 0,3 рад). Прежде его скрывал допуск
     щели, без допусков (v0.1067) шарик бился. Теперь момент выхода из К1 запоминается долей кадра (k1Frac, кадр spinFrame), и новый шарик
     стартует ровно тогда: остаток кадра он проезжает сразу */
  let spinFrame = 0, inwardNextPending = false;
  const markK1 = (t, next) => { if (F && F.k === 0 && next === 1 && F.k1Frame !== spinFrame) { F.k1FracQ = Q(t); F.k1Frac = F.k1FracQ.number(); F.k1Frame = spinFrame; } };
  /* v0.1052, «режим: шарик вылетает и упирается в дугу, а не в щель или вырез, — исчезает»; скорость — «сначала автоподстройка на первый вылет первого
     шарика, и она постоянная дальше всегда»; внутри кольца — «едет по щели». lossRun — вылет из «Граней» с «✕ дуга»; lossSpeedQ — найденная дробная скорость */
  let lossRun = false, lossSpeedQ = ZERO;
  /* v0.1055: «1 за чертой» записывает бит только при попадании в его дугу. Щель и открытый вырез пропускают без записи.
     При попадании шарик застревает в бите или отскакивает; все ячейки «1» — строка уходит в поле, вылеты продолжаются, счёт остаётся у строки. */
  let markRun = false, pendingMarks = [], pendingBits = [], markCfg = null;
  let balls = [], batchBusy = false;
  // Current launch only: totals outlive the 64 moving-ball slots and row promotion.
  let run = null, stuck = [], resting = [];
  /* v0.1063, «как мне начать с 5 строки при закрытых 3 кольцах?»: закрытие хранится в состоянии (Z.coneBallClosed = {key, n}) — переживает
     перезагрузку и попадает в пресет; «◉ закрыто» задаёт его руками (zzBallSetClosed). Ключ — дорожка и длины строк, как прежде */
  let centerInitKey = "", centerBatch = false, pendingClosed = 0, centerBatchSlits = null;
  const centerKey = () => (Z.lane | 0) + ":" + Z.rows.map(s => s.length).join("/");
  const centerCount = () => { const C = Z.coneBallClosed; return C && C.key === centerKey() ? Math.max(0, C.n | 0) : 0; };
  const centerSlits = () => { const C = Z.coneBallClosed; return C && C.key === centerKey() ? C.slits || {} : {}; };
  const setClosed = (n) => {
    const slits = Object.fromEntries(Object.entries(centerSlits()).filter(([k]) => +k >= n));
    Z.coneBallClosed = n > 0 || Object.keys(slits).length ? { key: centerKey(), n, slits } : null;
  };
  const clearCenter = () => { Z.coneBallClosed = null; pendingClosed = 0; centerInitKey = ""; };
  /* v0.1069, «если включён отскок, то „В центр“ при старте не ставить 0 в биты всех строк внутренних — пустыми делать, и К1 тоже»: при «удар: отскок»
     новый опыт делает все строки пустыми (Z.coneBallEmpty — пометка поверх строк, сами строки остаются из 0/1); биты ставят только удары —
     снаружи 1, изнутри 0 (если «0 изнутри»). Без отскока — как прежде: пустой (нулевой) только К1. Ключ инициализации — с отскоком: его смена = новый опыт */
  function initCenter() {
    const key = centerKey() + (bounceOn() ? "|b" : "");
    if (centerInitKey === key) return;
    if (window.zzBallCenterInit) window.zzBallCenterInit(bounceOn(), centerKey(), centerCount());   // v0.1063: заранее закрытые кольца хранят свои биты
    centerInitKey = key;
  }
  /* v0.1070, по снимку «0 поставил всё равно» (шарик ещё на старте): строки пустели только в миг запуска. Теперь стартовое состояние «В центр»
     показывается сразу — при смене отскока и по ↩ к старту */
  window.zzBallInwardPrime = () => { if (Z.coneBallRoute !== "in" || !snapshot()) return; centerInitKey = ""; initCenter(); };
  function slitEdges(ring) {
    if (!ring || ring.solid) return [];
    const edges = [];
    for (const b of ring.contactBlocks || ring.blocks) for (const raw of [b.loQ, b.hiQ]) {
      if (!edges.some(e => e.sub(raw).mod().eq(0))) edges.push(raw);
    }
    return edges;
  }
  function coverSlit(slits, k, ring, raw) {
    const value = rawFraction(ring, raw), edges = slitEdges(ring), slot = edges.findIndex(e => e.sub(value).mod().eq(0));
    if (slot < 0) return false;
    let progress = slits[k];
    if (!progress || progress.shape !== ring.shape || !Array.isArray(progress.closed)) progress = slits[k] = { shape: ring.shape, closed: [] };
    if (!progress.closed.includes(slot)) progress.closed.push(slot);
    return progress.closed.length === edges.length;
  }
  function closedSlit(slits, k, ring, raw) {
    const progress = slits[k];
    if (!progress || progress.shape !== ring.shape || !Array.isArray(progress.closed)) return false;
    const edges = slitEdges(ring);
    const value = rawFraction(ring, raw);
    return progress.closed.some(slot => edges[slot] && edges[slot].sub(value).mod().eq(0));
  }
  function closeCenterRing(k, S, raw) {
    if (k !== centerCount()) return;
    if (!S || !S.rings[k] || !raw || typeof raw.eq !== "function") return;
    const slits = centerSlits(), complete = coverSlit(slits, k, S.rings[k], raw);
    Z.coneBallClosed = { key: centerKey(), n: centerCount(), slits };
    if (!complete) return;
    if (centerBatch) pendingClosed = Math.max(pendingClosed, k + 1); else setClosed(k + 1);
  }
  window.zzBallCenterState = () => {
    const count = centerCount(), entry = centerSlits()[count], S = entry ? snapshot() : null;
    const progress = S && S.rings[count] && entry.shape === S.rings[count].shape ? { ring: count + 1, closed: entry.closed.length, total: slitEdges(S.rings[count]).length } : null;
    return { count, radius: count, progress };
  };
  // v0.1063: «◉ закрыто» — сколько колец от центра закрыто до запуска; внешнее видимое кольцо всегда открыто (из него стартуют)
  window.zzBallSetClosed = (n) => { const S = snapshot(), max = S ? S.rings.length - 1 : Z.rows.length - 1;
    n = Math.max(0, Math.min(max, n | 0)); centerInitKey = centerKey(); Z.coneBallClosed = null; setClosed(n); return n; };
  window.zzBallClosedMax = () => { const S = snapshot(); return S ? S.rings.length - 1 : Math.max(0, Z.rows.length - 1); };
  window.zzBallCloseRing = (k, a) => {
    // An explicit call without an angle remains the manual whole-ring override.
    if (a === undefined || a === null) return k === centerCount() ? window.zzBallSetClosed(k + 1) : centerCount();
    const S = snapshot(); if (S && S.rings[k]) closeCenterRing(k,S,Q(a).sub(S.rings[k].phaseQ).sub(S.spinQ));
    return centerCount();
  };
  const ringStats = k => run && (run.rings[k] ||= { entered: 0, passed: 0, hits: 0, lost: 0, bounces: 0, marks: 0, zeros: 0, reversals: 0, turns: 0, turnsQ:ZERO });
  function newRun() {
    run = { lane: Z.lane | 0, elapsed:0, elapsedQ:ZERO, launched: 0, exited: 0, reachedCenter: 0, removed: 0, mode: [2, 3].includes(+Z.coneBallSpeedMode) ? +Z.coneBallSpeedMode : 1, rings: [], results: [] }; stuck = []; resting = [];
    if (window.zzBallLostReset) window.zzBallLostReset();
  }
  window.zzBallClearRun = (options = {}) => {
    if (!sliceScope) { sliceDuos = []; sliceSingleCache = null; }
    slicing = null;
    sliceCutTableRender();
    if (!options.keepCenter) clearCenter();
    inwardAuto = inwardFc = null; run = null; stuck = []; resting = []; F = null; balls = []; pendingMarks = []; pendingBits = []; chain = lossRun = markRun = false; lossSpeedQ = ZERO; cycles = passes = 0;
    if (window.zzBallLostClear) window.zzBallLostClear();
  };
  window.zzBallRunStats = () => {
    if (!run || run.lane !== (Z.lane | 0)) return null;
    const list = (balls.length ? balls : F ? [F] : []).filter(b => !b.ready && b.stage !== "lost" && b.stage !== "done");
    return {...run,reference:"К1",elapsedTurns:run.elapsedQ.text(),closedCount:centerCount(),paused,
      speed:F ? F.speed : 0,speedExact:F ? F.speedQ.text() : "0",speedUnit:F?.stage === "arc" ? "оборотов/оборот К1" : "колец/оборот К1",
      period:F ? F.period : null,periodExact:F?.periodQ ? F.periodQ.text() : null,
      rings:run.rings.map((r,k) => ({...r,turnsExact:r.turnsQ.text(),moving:list.filter(b => b.k === k && b.stage !== "wait").length,waiting:list.filter(b => b.k === k && b.stage === "wait").length}))};
  };
  let markers = [], drawn = null, lab = null, lastPoints = "";
  const routes = { out: "на вылет", cross: "через центр", in: "в центр", slice: "нарезка" };
  // v0.954, «текст — убери из окна»: пояснения, T₀ и состояние — в подсказках (заголовок, ▶ запуск, скорость), не строками в окне.
  const LAB_HELP = "Один оборот К1 — единица времени. Скорости и углы заданы точными дробями: на прямом участке — колец за оборот К1, на дуге — долей полного круга за оборот К1. Темп К1 задаёт темп всего опыта. У каждого шарика одна постоянная скорость на всём пути, включая дуги; у разных шариков скорости могут различаться. Базовая — диаметр за T₀ (минимальный период повторения двух колец). Авто выбирает скорость один раз перед движением по первому отрезку. ↦ сквозной ищет постоянную скорость для всего прохода; если проход не найден, авто выбирает скорость для первого отрезка и сохраняет её дальше. На стыке проходит только точное совпадение щели с прямой шарика или открытый вырез. Иначе — удар: застрять или отскочить, без ожидания.\n1–4: внешние углы К2 · 5–8: внутренние · далее края К1 и центр. Шарик едет по прямым краям битов и поворачивается вместе со своим кольцом. Переходит на К3 и следующие видимые кольца, включая кольцо за чертой. В ∞ на самом внешнем краю огибает дугу с той же скоростью и снова идёт через центр; чистый цикл не гарантирован. Зелёный — выход без разворота, красный — был разворот. ↩ к старту и новый запуск возвращают кольца к последнему ручному повороту перед стартом, шарики — на старты. Нажми точку для одиночного старта.";
  const allStarts = () => Z.coneBallBatch !== false;
  // v0.1081: авто выбирает скорость только перед первым отрезком и сохраняет её на всём пути.
  const speedMode = () => [2, 3].includes(+Z.coneBallSpeedMode) ? +Z.coneBallSpeedMode : 1;
  const autoOn = () => speedMode() === 1 && Z.coneBallAuto === true;
  const bounceOn = () => Z.coneBallImpact === "bounce";
  const absorbOn = () => Z.coneBallAbsorb === true;
  // v0.1046: что делает шарик в центре у кольца 1 из одного бита: "through" — насквозь по прямой напротив, "back" — обратно по тому же разрезу (v0.1044),
  // "flip" — кольцо 1 поворачивается на 180°, его щель встаёт на продолжение пути, и шарик едет дальше в ту же сторону
  const centerMode = () => ["through", "back", "flip"].includes(Z.coneBallCenter) ? Z.coneBallCenter : Z.coneBallOne ? "back" : "through";
  const CENTER_LABEL = { through: "центр: насквозь", back: "⊙ назад", flip: "⟳ щель 180°" };
  const throughCount = () => [2, 3, 4].includes(+Z.coneBallThroughCount) ? +Z.coneBallThroughCount : 1;
  // Keep coincident endpoints separate: each belongs to its own bit edge.
  function boundaryPoints(S) {
    if (slicingOn()) return [{id:"center",k:0,raw:null,rawQ:null,r:0,kind:"center",label:"Центр"}];
    const out = [];
    for (const [tag, r] of [["outer", S.rings[1].ro], ["inner", S.rings[1].ri]]) {
      S.rings[1].blocks.forEach((b, j) => [b.lo, b.hi].forEach((raw, side) => out.push({
        id: "edge:1:" + j + ":" + side + ":" + tag, k: 1, raw, rawQ:side ? b.hiQ : b.loQ, r, kind: "edge",
        label: "К2 · " + (tag === "outer" ? "внешний" : "внутренний") + " угол " + (j * 2 + side + 1)
      })));
    }
    if (!S.rings[0].solid) S.rings[0].blocks.forEach((b, j) => [b.lo, b.hi].forEach((raw, side) => out.push({
      id: "edge:0:" + j + ":" + side, k: 0, raw, rawQ:side ? b.hiQ : b.loQ, r: S.rings[0].ro, kind: "edge", label: "К1 · край " + (j * 2 + side + 1)
    })));
    out.push({ id: "center", k: 0, raw: null, r: 0, kind: "center", label: "Центр" });
    return out;
  }
  /* v0.1059, «режим В центр: авто скорость должна найти для текущего внешнего такую скорость, при которой во внутреннее зайдёт наибольшее количество
     шариков; или это не зависит от скорости? тогда хотя бы одно». Вся группа едет одной скоростью и приходит к стыку одновременно — через ширину / скорость;
     проходят те, у кого в этот миг щель внутреннего кольца (с v0.1067 — ровно на прямой, без допусков) или открытый вырез (lossPass). Картина на стыке зависит только от
     относительного поворота двух колец. v0.1088: проверяются вычисленные моменты совпадений и интервалы между ними, без временной сетки.
     Наибольшее число; при равенстве — ближе к базовой. Кольца крутятся одинаково — от скорости не зависит, остаётся базовая. */
  let inwardAuto = null, inwardFc = null;
  window.zzBallInwardAuto = () => inwardAuto;
  /* v0.1060, «мы заранее знаем, сколько шариков из внешнего в смежное внутреннее войдёт при одновременном старте?» — «да», и прогноз до запуска (выбрано «1»):
     вся группа одной скоростью идёт кольцо за кольцом одновременно; на каждом стыке — то же правило, что у движка (lossPass: щель — с v0.1067 без допуска; было — с допуском или открытый
     вырез), закрытые кольца — центр, кольца закрываются после шага (как пакетом у одновременных событий). Удар — застрял (при отскоке — отмечен, дальше не
     прослеживается). Кольца крутятся равномерно, так что прогноз точный */
  window.zzBallInwardForecast = () => inwardFc;
  const ratesQ = S => {
    if (slicingOn()) return S.rings.map((_,i) => sliceRate(i).div(sliceRate(0).abs()).mul((Z.coneAutoSp ?? 30) < 0 ? -1 : 1));
    const all = (Z.coneSpinMode || "all") === "all", first = S.rings[0].coefficientQ.add(all ? ONE : ZERO).abs();
    return S.rings.map((r,i) => (i === 0 ? ONE : r.coefficientQ.add(all ? ONE : ZERO).div(first.sign() ? first : Q(coneBitMode(Z.coneSpinMode || "all") ? 1 : (Z.rows[0] || "1").length,coneMotionRing(0).P))).mul((Z.coneAutoSp ?? 30) < 0 ? -1 : 1));
  };
  const atTurns = (S, time) => ({...S,rings:S.rings.map((r, i) => { const phaseQ = r.phaseQ.add(ratesQ(S)[i].mul(time)); return {...r,phaseQ,phase:radians(phaseQ)}; })});
  function inwardForecast(S, speed) {
    const starts = outerStarts(S), v = Q(speed), K = S.rings.length - 1;
    if (!starts.length || v.sign() <= 0) return null;
    let c = centerCount(), k = K, time = ZERO, center = 0, alive = starts.map(p => p.rawQ);
    const entered = {}, hits = {}, slits = JSON.parse(JSON.stringify(centerSlits()));
    while (alive.length && k >= 0) {
      const ring = S.rings[k]; time = time.add(ring.roQ.sub(ring.riQ).div(v));
      const St = atTurns(S, time); let close = c; const next = [];
      for (const raw of alive) {
        if (k === 0) { center++; if (coverSlit(slits, k, St.rings[k], raw)) close = Math.max(close, 1); continue; }
        if (k - 1 < c) { center++; if (k === c && coverSlit(slits, k, St.rings[k], raw)) close = Math.max(close, k + 1); continue; }
        const edge = lossPass(St, k - 1, angleQ(St, k, raw), slits);
        if (edge === null) hits[k - 1] = (hits[k - 1] || 0) + 1;
        else { entered[k - 1] = (entered[k - 1] || 0) + 1; next.push(edge); }
      }
      c = close; alive = next; k--;
    }
    return {total:starts.length,outer:K,entered,hits,center,closedAfter:c,bounce:bounceOn(),duration:time.text()};
  }
  function inwardAutoSpeed(S, speed) {
    inwardAuto = null;
    const base = Q(speed), k = S.rings.length - 1, inner = k - 1, starts = outerStarts(S), ring = S.rings[k];
    if (inner < 0 || !starts.length || base.sign() <= 0) return base;
    const w = ratesQ(S), width = ring.roQ.sub(ring.riQ), t0 = width.div(base), tmin = t0.div(1000), dw = w[k].sub(w[inner]);
    const countAt = time => { const St = atTurns(S, time); return starts.filter(p => lossPass(St, inner, angleQ(St, k, p.rawQ)) !== null).length; };
    const result = (time, count, fixed = false) => {
      const multQ = t0.div(time); inwardAuto = {count,total:starts.length,ring:inner,fixed,mult:multQ.number(),multExact:multQ.text(),speedQ:width.div(time)};
      return width.div(time);
    };
    if (!dw.sign()) return result(t0, countAt(t0), true);
    const t1 = t0.add(ONE.div(dw.abs())), candidates = [tmin,t0,t1], edges = slitEdges(S.rings[inner]);
    for (const p of starts) for (const edge of edges) {
      const d = angleQ(S, inner, edge).sub(angleQ(S, k, p.rawQ));
      const lo = dw.mul(dw.sign() > 0 ? tmin : t1).sub(d).ceil() - 1n;
      const hi = dw.mul(dw.sign() > 0 ? t1 : tmin).sub(d).floor() + 1n;
      for (let m = lo; m <= hi; m++) {
        const time = d.add(m).div(dw); if (time.cmp(tmin) >= 0 && time.cmp(t1) <= 0) candidates.push(time);
      }
    }
    const boundaries = [...new Map(candidates.map(t => [t.text(),t])).values()].sort((a, b) => a.cmp(b));
    for (let i = 1; i < boundaries.length; i++) candidates.push(boundaries[i - 1].add(boundaries[i]).div(2));
    const points = [...new Map(candidates.map(t => [t.text(),{time:t,count:countAt(t)}])).values()], top = Math.max(...points.map(p => p.count));
    if (countAt(t0) === top) return result(t0, top);
    let best = null, closeness = null;
    for (const p of points) if (p.count === top) {
      const distance = ZZExact.max(p.time.div(t0), t0.div(p.time));
      if (!best || distance.cmp(closeness) < 0) { best = p; closeness = distance; }
    }
    return best ? result(best.time, top) : result(t0, 0);
  }
  function inwardBase(S) {
    const K = S.rings.length - 1, ring = S.rings[K], w = ratesQ(S)[K].abs(), cell = (ring.cells.length ? ring.cells : ring.blocks)[0];
    if (!cell || !w.sign()) return null;
    const bitTurnsQ = cell.hiQ.sub(cell.loQ).div(w), speedQ = ring.roQ.sub(ring.riQ).div(bitTurnsQ);
    return {speedQ,bitTurnsQ};
  }
  function outerStarts(S) {
    const k = S.rings.length - 1, ring = S.rings[k], points = [];
    if (k < centerCount()) return points;
    for (const b of ring.blocks) for (const rawQ of [b.loQ,b.hiQ]) {
      if (points.some(p => p.rawQ.sub(rawQ).mod().eq(0)) || closedSlit(centerSlits(), k, ring, rawQ)) continue;
      points.push({id:"outer-slit:" + points.length,k,rawQ,raw:radians(rawQ),r:ring.ro,kind:"edge",label:"К" + (k + 1) + " · внешняя щель " + (points.length + 1)});
    }
    return points;
  }
  function inputFraction(value) {
    try { const q = Q(value); return q.sign() > 0 && q.cmp(1000) <= 0 ? q : null; } catch { return null; }
  }
  function periodQ(S) {
    const w = ratesQ(S).slice(0,2), periods = [];
    for (let k = 0; k < w.length; k++) {
      if (!w[k].sign()) continue;
      const blocks = S.rings[k].blocks, pitch = Q(1,blocks.length);
      const repeated = blocks.length > 1 && blocks.every((b, j) => b.loQ.sub(blocks[0].loQ).sub(pitch.mul(j)).mod().eq(0) && b.hiQ.sub(b.loQ).eq(blocks[0].hiQ.sub(blocks[0].loQ)));
      periods.push((repeated ? pitch : ONE).div(w[k].abs()));
    }
    if (!periods.length) return null;
    let n = 1n, d = 0n;
    for (const p of periods) { n = n / ZZExact.gcd(n,p.n) * p.n; d = ZZExact.gcd(d,p.d); }
    return Q(n,d);
  }
  function solveThrough(S,requestedPoint) {
    const T = S && periodQ(S);
    if (!S || S.rings.length < 2 || !T) return {error:"Для расчёта нужны два кольца"};
    const w = ratesQ(S).slice(0,2), J = S.rings[1].riQ, R = S.rings[1].roQ, width = R.sub(J);
    if (!S.rings[0].roQ.eq(J)) return {error:"Для сквозного прохода включи кольца без промежутков"};
    const edges = S.rings.map(r => [...new Map(r.blocks.flatMap(b => [b.loQ,b.hiQ]).map(e => [e.mod().text(),e])).values()]);
    const starts = boundaryPoints(S).filter(p => p.k === 1 && Q(p.r).eq(R)).sort((a,b) => a.rawQ.mod().cmp(b.rawQ.mod()));
    const selected = !allStarts() && starts.find(p => p.id === Z.coneBallStart);
    const points = requestedPoint ? [requestedPoint] : selected ? [selected] : starts, dw = w[0].sub(w[1]);
    for (const point of points) {
      const candidates = [];
      for (const e of edges[0]) {
        const opposite = edges[0].find(f => f.sub(e).sub(HALF).mod().eq(0));
        if (opposite === undefined) continue;
        const phase = angleQ(S,1,point.rawQ).sub(angleQ(S,0,e)).mod(), times = [];
        if (!dw.sign()) { if (phase.mod().eq(0)) times.push(width.mul(T).div(R.mul(2))); }
        else for (let n = -64n; n <= 64n; n++) times.push(phase.add(n).div(dw));
        for (const t of times) {
          if (t.sign() <= 0) continue;
          const at = atTurns(S,t), entrance = lossPass(at,0,angleQ(at,1,point.rawQ));
          if (entrance === null || !entrance.sub(e).mod().eq(0)) continue;
          const speedQ = width.div(t), durationQ = R.mul(2).div(speedQ), multQ = T.div(durationQ);
          if (multQ.sign() <= 0 || multQ.cmp(1000) > 0) continue;
          const t2 = R.add(J).div(speedQ), a2 = angleQ(S,0,opposite).add(w[0].mul(t2));
          if (edges[1].some(f => angleQ(S,1,f).add(w[1].mul(t2)).sub(a2).mod().eq(0))) {
            candidates.push({point,speedQ,multQ,durationQ,speed:speedQ.number(),mult:multQ.number(),duration:durationQ.number(),timesQ:[t,R.div(speedQ),t2,durationQ]});
          }
        }
      }
      if (candidates.length) return candidates.sort((a,b) => a.durationQ.cmp(b.durationQ))[0];
    }
    return {error:"Проход не найден за 64 относительных оборота. Попробуй другой старт или поворот кольца"};
  }
  function solveGroup(S,count) {
    const first = solveThrough(S);
    if (first.error || count === 1) return first.error ? first : {runs:[first]};
    const starts = boundaryPoints(S).filter(p => p.k === 1 && Q(p.r).eq(S.rings[1].roQ));
    const unique = starts.filter((p,i) => !starts.slice(0,i).some(q => p.rawQ.sub(q.rawQ).mod().eq(0)));
    const opposite = unique.find(p => p.rawQ.sub(first.point.rawQ).sub(HALF).mod().eq(0));
    if (!opposite) return {error:"Для встречной пары нужны противоположные внешние грани"};
    const second = solveThrough(S,opposite);
    if (second.error || !second.speedQ.eq(first.speedQ)) return {error:"Встречная пара с общей скоростью для этого положения не найдена"};
    const runs = [first,second];
    for (const p of unique) {
      if (runs.length >= count) break;
      if (runs.some(r => r.point.id === p.id)) continue;
      const result = solveThrough(S,p); if (!result.error) runs.push(result);
    }
    return runs.length === count ? {runs} : {error:"Найдено сквозных стартов: " + runs.length + " из " + count};
  }
  function movingGroup(S,count) {
    const group = solveGroup(S,count), exactPeriod = periodQ(S);
    if (!group.error || !(Z.coneBallArc || autoOn()) || !exactPeriod) return group;
    const points = boundaryPoints(S).filter(p => p.k === 1 && Q(p.r).eq(S.rings[1].roQ));
    const unique = points.filter((p,i) => !points.slice(0,i).some(q => p.rawQ.sub(q.rawQ).mod().eq(0))), multQ = inputFraction(Z.coneBallMult || "1");
    if (!unique.length || unique.length < count && !autoOn() || !multQ) return group;
    const first = unique.find(p => p.id === Z.coneBallStart) || unique[0], opposite = unique.find(p => p.rawQ.sub(first.rawQ).sub(HALF).mod().eq(0));
    if (count > 1 && !opposite && !autoOn()) return group;
    const ordered = [first,...(opposite ? [opposite] : []),...unique.filter(p => p !== first && p !== opposite)];
    const speedQ = S.rings[1].roQ.mul(2).mul(multQ).div(exactPeriod), durationQ = exactPeriod.div(multQ);
    return {runs:ordered.slice(0,count).map(point => ({point,speedQ,multQ,durationQ,speed:speedQ.number(),mult:multQ.number(),duration:durationQ.number(),auto:autoOn()}))};
  }
  function speedText(value) { return Q(value).text(); }
  // Every start lies on a bit edge; bit and gap axes are not tracks.
  function startPoint(S) { const P = boundaryPoints(S); return P.find(p => p.id === Z.coneBallStart) || P[P.length - 1]; }
  function pauseRotation() { if (!sliceScope && coneSpinning) $("bConeAuto").click(); }
  function readyText(S) {
    const p = startPoint(S); return "Старт: " + p.label + " · " + (routes[Z.coneBallRoute] || routes.cross) + " · ▶ запуск";
  }
  function status(s) { if (batchBusy) return; const el = $("coneBallStatus"); if (el && el.textContent !== s) el.textContent = s; if (el) el.title = s; }
  // v0.1026: «1 щель» и «все» — кольца без вырезов: грани — щели и границы битов, как у магнита (coneRingFeat).
  const inwardOne = (R) => !!R && !R.cut && Z.coneBallRoute === "in" && typeof coneOneSlit === "function" && coneOneSlit();   // v0.1064: одна щель и за чертой
  window.zzBallFillOne = () => Z.coneBallOn !== false && inwardOne(coneRingFeat("f"));
  const plainRings = () => coneFlat() && Z.rows.length <= CONE_MAX && coneSlitMode() !== "cut";
  function sliceSnapshot(){
    if (!coneGeom || Z.cone3d || Z.conePoly || !Z.rows.length) return null;
    const clock = coneMotionClock(), spinQ = clock.degrees.div(360), opposite = sliceOpposite();
    const rings = Z.rows.slice(0,CONE_MAX).map((_,k) => {
      const coefficientQ = opposite ? sliceRate(k) : sliceRate(k).sub(ONE);
      const phaseQ = sliceTurn(k).add(sliceAutoPhase(k,clock));
      const blocks = sliceBitCells(null,k).map(cell => ({loQ:cell.raw,hiQ:cell.raw.add(cell.width),lo:radians(cell.raw),hi:radians(cell.raw.add(cell.width)),bit:cell.j}));
      const shape = blocks.map(b => b.loQ.text()+","+b.hiQ.text()).join(";");
      return {ri:k,ro:k+1,riQ:Q(k),roQ:Q(k+1),phaseQ,phase:radians(phaseQ),coefficientQ,
        blocks,cells:blocks,contactBlocks:blocks,solid:k > 0 && !slicing?.cuts[k]?.length,fill:false,oneWay:false,shape};
    });
    return {rings,rotationQ:rings.map(r => r.phaseQ),rotation:rings.map(r => r.phase),
      clockQ:opposite ? clock.phase.div(360) : spinQ,clockPhaseQ:clock.phase,clockPh:clock.phase.number(),
      spinQ,spin:radians(spinQ),shape:rings.map(r => r.shape).join("|")};
  }
  function snapshot() {
    if (slicingOn()) return sliceSnapshot();
    const cut = coneCutOn();
    if (!coneGeom || !(cut || plainRings()) || Z.cone3d || Z.conePoly || cutPrevMode() || coneFreeOn() || Z.coneBitStep) return null;
    const N = Math.min(Z.rows.length, CONE_MAX), count = N + (coneGeom.fill ? 1 : 0);
    if (count < 2 && !slicingOn()) return null;
    const rings = [], clock = coneMotionClock(), spinQ = clock.degrees.div(360);
    const block = (lo, hi, bit) => ({loQ:Q(lo),hiQ:Q(hi),lo:radians(lo),hi:radians(hi),bit});
    for (let i = 0; i < count; i++) {
      let R = coneMotionRing(i);
      const feat = coneRingFeat(i === N ? "f" : i), blocks = [], cells = [];
      if (!feat) return null;
      let contactBlocks, solid = false;
      if (i === 0) {
        if (!cut) {
          if (R.n === 1) {
            const lo = R.aim.sub(R.phase);
            blocks.push(block(lo, lo.add(centerMode() === "through" ? HALF : ONE), 0));
            contactBlocks = [block(lo, lo.add(ONE), 0)]; cells.push(...contactBlocks);
          } else for (let j = 0; j < R.n; j++) blocks.push(block(Q(j, R.P).sub(QUARTER), Q(j + 1, R.P).sub(QUARTER), j));
        } else if (coneQuadOn()) {
          for (let j = 1; j < conePartCount(); j += 2) blocks.push(block(Q(j, R.P).sub(QUARTER), Q(j + 1, R.P).sub(QUARTER), 0));
        } else if (coneHalfOn()) blocks.push(block(QUARTER, QUARTER.add(HALF), 0));
        else {
          const slit = typeof coneRow1Slit === "function" && coneRow1Slit(), lo = slit ? R.aim.sub(R.phase) : QUARTER.neg();
          blocks.push(block(lo, lo.add(ONE), 0)); contactBlocks = blocks.map(b => ({...b})); cells.push(...contactBlocks); solid = !slit;
        }
      } else if (feat.one || i === N && inwardOne(feat)) {
        blocks.push(block(QUARTER.neg(), Q(3, 4), 0));
        for (let j = 0; j < R.n; j++) cells.push(block(Q(j, R.n).sub(QUARTER), Q(j + 1, R.n).sub(QUARTER), j));
      } else {
        const bits = i === N ? fillDraft() : Z.rows[i];
        for (let j = 0; j < R.n; j++) if (bits[j] === "0" || bits[j] === "1" || i === N && bits[j] === ".") {
          const p = R.cut ? coneMotionBitPosition(j, R.n) : Q(j), lo = p.div(R.P).sub(QUARTER);
          blocks.push(block(lo, lo.add(Q(1, R.P)), j));
        }
        cells.push(...blocks.map(b => ({...b})));
        if (R.cut && Z.coneBallSlitOnly && blocks.length > 1) {
          blocks.sort((a, b) => a.loQ.cmp(b.loQ)); const merged = [{...blocks[0]}];
          for (const b of blocks.slice(1)) {
            const last = merged[merged.length - 1];
            if (b.loQ.eq(last.hiQ)) { last.hiQ = b.hiQ; last.hi = b.hi; last.bitHi = b.bitHi ?? b.bit; }
            else merged.push({...b});
          }
          if (merged.length > 1 && merged[merged.length - 1].hiQ.sub(merged[0].loQ).mod().eq(0)) {
            const last = merged.pop(); merged[0] = {...merged[0],loQ:last.loQ.sub(ONE),lo:radians(last.loQ.sub(ONE))};
          }
          blocks.splice(0, blocks.length, ...merged);
        }
      }
      const shape = [R.n,R.P,R.cut,solid,blocks.map(b => b.loQ.text() + "," + b.hiQ.text()).join(";")].join(":");
      rings.push({ri:i,ro:i + 1,riQ:Q(i),roQ:Q(i + 1),phaseQ:R.phase,phase:radians(R.phase),coefficientQ:R.coefficient,
        blocks,cells,contactBlocks,solid,fill:i === N,oneWay:!i && !solid && !coneQuadOn() && !coneHalfOn() && R.n === 1 && centerMode() !== "through",shape});
    }
    if (!slicingOn() && !rings[1].blocks.length) return null;
    const mode = Z.coneSpinMode || "all", clockQ = mode === "all" ? spinQ : coneBitMode(mode) ? clock.phase : clock.phase.div(360);
    return {rings,rotationQ:rings.map(r => r.phaseQ),rotation:rings.map(r => r.phase),clockQ,clockPhaseQ:clock.phase,clockPh:clock.phase.number(),spinQ,spin:radians(spinQ),shape:rings.map(r => r.shape).join("|")};
  }
  function hint() { return "Для шариков: плоский вид, плавное кручение и хотя бы два кольца (луч-часы и солнце не нужны). У строки 1 доступны все варианты частей и «щель 1»; щель для шарика — линия без ширины"; }
  function ui() {
    const b = $("bConeBall"); if (!b) return;
    b.classList.toggle("on", enabled); b.setAttribute("aria-pressed", String(enabled)); b.textContent = enabled ? "●" : "○";
    b.setAttribute("aria-label", enabled ? "Выключить шарики" : "Включить шарики");
    b.title = enabled ? "Шарики включены. Нажми, чтобы выключить движение и точки." : "Шарики выключены. Нажми, чтобы включить их снова.";
    // v0.1003: переключатель остаётся в заголовке единого меню; выключение прячет только его содержимое.
    if (lab) { lab.classList.toggle("ball-off", !enabled); lab._pzk = ""; window.zzBallLabSync(); }
    labControls();
  }
  function labControls() {
    if (window.zzBallSliceControls) window.zzBallSliceControls();
    if (!$("ballLabTime")) return;
    for (const id of ["ballLabStart","ballLabThrough","ballLabArc","ballLabOne"]) if ($(id)) $(id).disabled = slicingOn();
    lab.querySelectorAll("[data-ball-through]").forEach(b => { b.disabled = slicingOn(); });
    $("bConeBall").setAttribute("aria-pressed", String(enabled));
    $("ballLabPoints").setAttribute("aria-pressed", String(Z.coneBallPoints !== false));
    $("ballLabRoute").disabled = Z.coneBallRoute !== "in" && (allStarts() || throughCount() > 1);
    $("ballLabRoute").value = Z.coneBallRoute === "in" ? "in" : allStarts() ? "cross" : routes[Z.coneBallRoute] ? Z.coneBallRoute : "cross";
    $("ballLabRoute").dataset.active = "true";
    $("ballLabStart").dataset.active = String(!!$("ballLabStart").value);
    const started = enabled && (slicingOn() ? sliceDualOn() ? sliceDuos.some(scope => scope.data && !scope.data.done) : !!slicing && !slicing.done : (balls.length ? balls : F ? [F] : []).some(b => !b.ready && b.stage !== "done" && b.stage !== "lost"));
    $("ballLabRun").setAttribute("aria-pressed", String(started && !paused));
    $("ballLabPause").setAttribute("aria-pressed", String(started && paused));
    $("ballLabPause").textContent = paused ? "▶ продолжить" : "⏸ пауза";
    if ($("bConeSliceRun")) {
      const button = $("bConeSliceRun"), active = slicingOn() && started && !paused;
      button.classList.toggle("on",active); button.setAttribute("aria-pressed",String(active));
      button.disabled = slicingOn() && (sliceDualOn() ? !!sliceDuos.length && sliceDuos.every(scope => scope.data?.done && scope.data.stoppedReason !== "cycle") : !!slicing?.done && slicing.stoppedReason !== "cycle");
      const text = active ? "⏸ пауза" : "▶ пуск"; if (button.textContent !== text) button.textContent = text;
    }
    if ($("bConeSliceReset")) $("bConeSliceReset").disabled = false;
    $("ballLabDir").textContent = (Z.coneAutoSp ?? 30) < 0 ? "↺ против" : "↻ по часовой";
    $("ballLabDir").dataset.active = "true";
    if ($("ballLabArc")) $("ballLabArc").setAttribute("aria-pressed", String(!!Z.coneBallArc));
    if ($("ballLabOne")) { const m = centerMode(), b = $("ballLabOne"); b.setAttribute("aria-pressed", String(m !== "through")); if (b.textContent !== CENTER_LABEL[m]) b.textContent = CENTER_LABEL[m]; }
    const through = $("ballLabThrough");
    if (through) {
      const single = !balls.length && F && F.through;
      through.setAttribute("aria-pressed", String(!!single));
      through.textContent = single && F.stage === "done" ? (F.clean ? "✓ сквозной" : "✕ проход") : "↦ сквозной";
      lab.querySelectorAll("[data-ball-through]").forEach(b => {
        const active = balls.length === +b.dataset.ballThrough && balls.every(x => x.through);
        b.setAttribute("aria-pressed", String(active));
        b.textContent = (active && balls.every(x => x.stage === "done") ? (balls.every(x => x.clean) ? "✓ " : "✕ ") : +b.dataset.ballThrough === 2 ? "⇄ " : "↦ ") + b.dataset.ballThrough;
      });
      const group = balls.length > 1 && balls.every(x => x.through);
      const mixed = group && balls.some(x => !x.multQ.eq(balls[0].multQ));
      const speeds = $("ballLabGroupSpeeds");
      speeds.hidden = !group;
      if (group) {
        speeds.textContent = balls.map(x => x.number + ": " + speedText(x.multQ) + "×").join(" · ");
        $("ballLabRun").title = "Сквозная группа · базовые скорости: " + speeds.textContent + ". У каждого шарика одна постоянная скорость на прямых и дугах. Нет точной щели или открытого выреза на стыке — удар: застрять / отскочить. Шарики друг с другом не сталкиваются.";
      }
    }
  }
  function angle(S, k, raw) { return radians(angleQ(S, k, raw)); }
  function begin(S,clear = false,launch = false,options = {}) {
    if (clear) cycles = passes = 0;
    const dir = (Z.coneAutoSp ?? 30) < 0 ? -1 : 1, b = S.rings[0].blocks[0], aim = dir > 0 ? ZERO : HALF;
    const p = options.point || startPoint(S), k = p.k;
    const distance = e => { const d = angleQ(S,0,e).sub(aim).mod(); return ZZExact.min(d,ONE.sub(d)); };
    const rawQ = p.rawQ || (p.raw !== null ? rawFraction(S.rings[k],p.raw) : (options.slitStart ?? Z.coneBallSlitStart) ? b.loQ : distance(b.hiQ).cmp(distance(b.loQ)) < 0 ? b.hiQ : b.loQ);
    const RQ = S.rings[S.rings.length - 1].roQ, qQ = Q(p.r), requested = options.route || Z.coneBallRoute;
    const route = routes[requested] ? requested : "cross", multQ = inputFraction(Z.coneBallMult || "1") || ZERO, TQ = options.periodQ || periodQ(S), move = route === "out" ? 1 : -1;
    const lengthQ = route === "out" ? RQ.sub(qQ) : route === "in" ? qQ : RQ.add(qQ);
    const speedQ = speedMode() !== 1 ? ONE.mul(speedMode() === 3 ? 2 : 1) :
      options.speedQ || (TQ ? lengthQ.mul(multQ).div(TQ) : ZERO);
    F = {shape:S.shape,dir,RQ,route,start:{k,rawQ,qQ},lengthQ,move,stage:move > 0 ? "out" : "in",ready:!launch,
      qQ,k,rawQ,aQ:angleQ(S,k,rawQ),a:radians(angleQ(S,k,rawQ)),reversals:0,clean:true,elapsedQ:ZERO,travelQ:ZERO,periodQ:TQ,multQ,speedQ,
      loop:!!Z.coneBallArc,crossings:0,arcs:0,auto:speedMode() === 1 && route !== "in" && (options.auto ?? autoOn()),seg:null,tuned:0,loss:true,
      ringTurnsQ:S.rings.map(() => ZERO),ringShapes:S.rings.map(r => r.shape),fillIndex:S.rings.findIndex(r => r.fill)};
    F.R = RQ.number(); F.start.raw = radians(rawQ); F.start.q = qQ.number(); projectMotion(F);
    if (launch && speedQ.sign() <= 0) { F.ready = true; status(lengthQ.sign() <= 0 ? "Шарик уже на внешнем краю · выбери точку внутри или маршрут через центр" : "Для запуска нужна положительная дробная скорость"); metrics(S); return; }
    if (launch && run) { F.number = F.runNumber = ++run.launched; ringStats(k).entered++; rememberResult(); }
    status(!enabled ? "Шарик выключен · серая точка — старт · ● вкл. — включить" : launch ? routes[route] + " · старт: " + p.label + " · скорость " + speedQ.text() + " за оборот К1" : readyText(S));
    metrics(S);
  }
  function appendInwardGroup(S, launch) {
    const TQ = periodQ(S), B = inwardBase(S), base = B ? B.speedQ : TQ ? S.rings[S.rings.length - 1].roQ.div(TQ) : ZERO;
    const speed = speedMode() === 1 && launch ? inwardAutoSpeed(S, base) : base;
    if (inwardAuto) Object.assign(inwardAuto, { baseExact:base.text(),bitTurnsExact:B ? B.bitTurnsQ.text() : null, outer:S.rings.length - 1 });
    const group = [], busy = batchBusy;
    batchBusy = true;
    try { outerStarts(S).forEach((point, i) => {
      begin(S, false, launch, {point,route:"in",periodQ:TQ,speedQ:speed});
      group.push(Object.assign(F,{id:point.id,number:launch ? F.runNumber || i + 1 : i + 1,label:point.label}));
    }); }
    finally { batchBusy = busy; balls.push(...group); F = balls[0] || null; }
    const started = launch && group.some(b => !b.ready);
    if (started && run) run.inwardOuter = S.rings.length;
    inwardFc = started ? inwardForecast(S, group[0].speedQ) : null;
    return started;
  }
  // One inward group per new outer ring; previous balls keep their own state and speed.
  function ensureInwardGroup(S) {
    if (!enabled || !run || Z.coneBallRoute !== "in" || !S?.rings[S.rings.length - 1]?.fill) return false;
    if (run.inwardOuter === S.rings.length) return true;
    return appendInwardGroup(S, true);
  }
  window.zzBallInwardSpawn = () => ensureInwardGroup(snapshot());
  function prepare(S, clear = false, launch = false) {
    balls = [];
    if (Z.coneBallRoute === "in") {
      if (clear) cycles = passes = 0;
      appendInwardGroup(S, launch);
      batchStatus(); metrics(S); return;
    }
    if (!allStarts() && throughCount() > 1) {
      const TQ = periodQ(S), group = movingGroup(S,throughCount());
      if (group.error) { F = null; status(group.error); metrics(S); return; }
      if (clear) cycles = passes = 0;
      batchBusy = true;
      try {
        group.runs.forEach((r, i) => {
          begin(S, false, launch, { point:r.point,route:"cross",periodQ:TQ,speedQ:r.speedQ,auto:!!r.auto });
          balls.push(Object.assign(F, { id:r.point.id,number:i + 1,label:r.point.label,mult:r.mult,multQ:r.multQ,through:true }));
        });
      } finally { batchBusy = false; F = balls[0] || null; }
      batchStatus(); metrics(S); return;
    }
    if (!allStarts()) { begin(S, clear, launch); return; }
    if (clear) cycles = passes = 0;
    const TQ = periodQ(S), speedQ = TQ ? S.rings[S.rings.length - 1].roQ.mul(2).mul(inputFraction(Z.coneBallMult || "1") || ZERO).div(TQ) : ZERO;
    batchBusy = true;
    try {
      boundaryPoints(S).forEach((point, i) => {
        begin(S, false, launch, { point,route:point.r === 0 ? "out" : "cross",periodQ:TQ,speedQ });
        balls.push(Object.assign(F, { id: point.id, label: point.label, number: i + 1 }));
      });
    } finally { batchBusy = false; F = balls[0] || null; }
    batchStatus(); metrics(S);
  }
  function batchStatus() {
    if (!balls.length) return;
    const count = balls.length, edges = count - 9;
    if (!enabled) { status("Шарики выключены · " + count + " серых точек — старты · нажми ● вкл. или ▶ запуск"); return; }
    if (balls.every(b => b.ready) && balls[0].speedQ.sign() <= 0) { status(count + " шариков на местах · для запуска нужны вращение и положительная дробная скорость"); return; }
    if (balls.every(b => b.ready)) { status(balls.every(b => b.route === "in") ? (count === 1 ? "1 шарик во внешней щели · ● в центр — запуск" : count + " " + (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? "шарика" : "шариков") + " во внешних щелях · ● в центр — запуск всей группы") : balls.every(b => b.through) ? count + " сквозных шарика на внешних гранях · ▶ запуск" : count + " шариков на местах: 4 внешних + 4 внутренних угла К2 + " + edges + " края К1 + центр · ▶ запуск вместе с вращением"); return; }
    const done = balls.filter(b => b.stage === "done"), clean = done.filter(b => b.clean).length, turned = balls.filter(b => !b.clean).length;
    const waiting = balls.filter(b => b.stage === "wait").length, stopped = balls.filter(b => b.stage === "lost").length;
    const lost = balls.filter(b => b.stage === "lost" && !b.absorbed).length, absorbed = run?.absorbed ? " · поглощено " + run.absorbed : "";
    if (balls.every(b => b.route === "in")) {
      status((paused ? "Пауза · " : "") + "В центр: " + count + " · движутся " + (count - done.length - waiting - stopped) + " · дошли " + done.filter(b => b.atCenter).length + " · вышли назад " + done.filter(b => !b.atCenter).length + " · застряли " + lost + absorbed + " · отскоки " + balls.reduce((n, b) => n + (b.bounces || 0), 0)); return;
    }
    if (balls.some(b => b.loop)) {
      status((paused ? "Пауза · " : "") + "∞ Шарики: " + count + " · по дуге " + balls.filter(b => b.stage === "arc").length + " · застряли " + lost + absorbed + " · проходов " + balls.reduce((n, b) => n + b.crossings, 0) + " · разворотов " + balls.reduce((n, b) => n + b.reversals, 0) + (done.length ? " · остановились " + done.length : "")); return;
    }
    const totalLost = window.zzBallLostTotal ? window.zzBallLostTotal() : lost;
    status((paused ? "Пауза · " : "") + "Шарики: " + count + " · движутся " + (count - done.length - waiting - stopped) + " · вышли " + done.length + " · без разворота " + clean + (totalLost ? " · застряли в дуге " + totalLost : "") + absorbed + (turned ? " · красные: был разворот, НЕ проход" : ""));
  }
  function frame(A, B, dt) {
    const ds = B.spinQ.sub(A.spinQ);
    const deltaQ = A.rings.map((r, k) => B.rings[k].phaseQ.sub(r.phaseQ).add(ds));
    const durationQ = deltaQ[0].abs();
    const at = fraction => {
      const t = Q(fraction), spinQ = A.spinQ.add(ds.mul(t)), clockPhaseQ = A.clockPhaseQ.add(B.clockPhaseQ.sub(A.clockPhaseQ).mul(t));
      const rotationQ = A.rotationQ.map((r, k) => r.add(B.rotationQ[k].sub(r).mul(t)));
      return {...A,spinQ,spin:radians(spinQ),clockPhaseQ,clockPh:clockPhaseQ.number(),clockQ:A.clockQ.add(B.clockQ.sub(A.clockQ).mul(t)),rotationQ,rotation:rotationQ.map(radians),
        rings:A.rings.map((r, k) => { const phaseQ = r.phaseQ.add(B.rings[k].phaseQ.sub(r.phaseQ).mul(t)); return {...r,phaseQ,phase:radians(phaseQ)}; })};
    };
    return {at,durationQ,deltaQ,delta:deltaQ.map(radians),turnDeltaQ:deltaQ,turnDelta:deltaQ.map(q => q.number()),distance:F ? F.speedQ.mul(durationQ).number() : 0};
  }
  function edgeAt(S, k, a) {
    if (S.rings[k].solid) return null;
    for (const b of S.rings[k].blocks) for (const raw of [b.loQ,b.hiQ]) if (angleQ(S, k, raw).sub(a).mod().eq(0)) return raw;
    return null;
  }
  function turn(why) {
    F.move = -F.move; F.stage = F.move > 0 ? "out" : "in"; F.reversals++; F.clean = false; F.seg = null;
    if (run) ringStats(F.k).reversals++;
    F.lengthQ = F.travelQ.add(F.move > 0 ? F.RQ.sub(F.qQ) : F.qQ.add(F.RQ)); projectMotion(F);
    status(why + " · разворот по своей грани · НЕ проход · разворотов " + F.reversals);
  }
  function planSegment(S, C, dt) {
    const ring = S.rings[F.k]; let length, next, raw = F.rawQ, outward = F.move > 0;
    if (!F.k && F.move < 0) {
      const own = ring.blocks.flatMap(b => [b.loQ,b.hiQ]).find(e => e.sub(F.rawQ).sub(HALF).mod().eq(0));
      if (own === undefined && (!ring.oneWay || centerMode() === "flip")) return null;
      length = F.qQ.add(ring.roQ); next = 1; raw = own === undefined ? F.rawQ : own; outward = true;
    } else { length = outward ? ring.roQ.sub(F.qQ) : F.qQ.sub(ring.riQ); next = F.k + F.move; }
    if (length.sign() <= 0 || next < 0 || next >= S.rings.length) return null;
    const target = S.rings[next]; if (!(outward ? ring.roQ.eq(target.riQ) : ring.riQ.eq(target.roQ))) return null;
    const w = ratesQ(S), dw = w[F.k].sub(w[next]), nominal = length.div(F.speedQ), a = angleQ(S,F.k,raw);
    let best = null;
    for (const b of target.blocks) for (const edge of [b.loQ,b.hiQ]) {
      const phase = a.sub(angleQ(S,next,edge));
      if (!dw.sign()) { if (phase.mod().eq(0)) best = nominal; continue; }
      const m0 = dw.mul(nominal).add(phase).add(HALF).floor();
      for (let m = m0 - 3n; m <= m0 + 3n; m++) {
        const time = Q(m).sub(phase).div(dw);
        if (time.sign() > 0 && time.cmp(nominal.div(4)) >= 0 && (!best || time.sub(nominal).abs().cmp(best.sub(nominal).abs()) < 0)) best = time;
      }
    }
    return best ? {speedQ:length.div(best),speed:length.div(best).number()} : null;
  }
  function outerArc(S) {
    const block = S.rings[F.k].blocks.find(b => [b.loQ,b.hiQ].some(e => e.sub(F.rawQ).mod().eq(0)));
    if (!block) { F.move = -1; F.stage = "in"; F.seg = null; return; }
    const fromLo = block.loQ.sub(F.rawQ).mod().eq(0), fromQ = fromLo ? block.loQ : block.hiQ, toQ = fromLo ? block.hiQ : block.loQ;
    // Arc speed is a fraction of the whole turn per reference-clock unit; radius is not a factor.
    const durationQ = toQ.sub(fromQ).abs().div(F.speedQ);
    F.arc = {fromQ,toQ,durationQ,elapsedQ:ZERO,speedQ:F.speedQ,from:radians(fromQ),to:radians(toQ),duration:durationQ.number(),elapsed:0,speed:F.speedQ.number()};
    setRaw(F,fromQ); F.stage = "arc"; F.seg = null;
  }
  function fillCellAt(ring, e) {
    const cells = ring.cells && ring.cells.length ? ring.cells : ring.blocks;
    const value = rawFraction(ring, e);
    for (const b of cells) { const d = value.sub(b.loQ).mod(); if (d.cmp(b.hiQ.sub(b.loQ)) < 0) return b.bit; }
    return null;
  }
  function stuckPosition(S,group,sample) {
    const ring = S.rings[group.k]; if (!ring) return null;
    const cell = (ring.cells.length ? ring.cells : ring.blocks).find(b => b.bit === group.bit); if (!cell) return null;
    const raw = cell.loQ.add(cell.hiQ.sub(cell.loQ).mul(sample.uQ ?? sample.u));
    return {a:angle(S,group.k,raw),q:ring.riQ.add(ring.roQ.sub(ring.riQ).mul(sample.vQ ?? sample.v)).number(),width:radians(cell.hiQ.sub(cell.loQ))};
  }
  function absorbAt(k) {
    F.stage = "lost"; F.absorbed = true; F.absorbedAt = k; F.seg = null; F.clean = false; cycles++;
    if (run) { run.absorbed = (run.absorbed || 0) + 1; ringStats(k).absorbed = (ringStats(k).absorbed || 0) + 1; if (F.atCenter) run.reachedCenter++; }
    status("ПоглотБит · шарик " + (F.number || 1) + " записал бит в К" + (k + 1) + " и поглощён");
  }
  function bounceAt(k) {
    if (run) ringStats(k).bounces++;
    F.bounces = (F.bounces || 0) + 1;
    turn("Отскок от дуги кольца " + (k + 1));
  }
  function impactAt(k, S, a, marked = false) {
    if (run) ringStats(k).hits++;
    const written = writeInwardImpact(k, S, a) || marked;
    if (absorbOn() && written) { absorbAt(k); return; }
    if (bounceOn()) { bounceAt(k); return; }
    F.stage = "lost"; F.lostAt = k; F.seg = null; cycles++;
    if (run) ringStats(k).lost++;
    if (S) {
      const ring = S.rings[k], rawQ = Q(a).sub(ring.phaseQ).sub(S.spinQ), bit = fillCellAt(ring, rawQ);
      const cell = (ring.cells && ring.cells.length ? ring.cells : ring.blocks).find(b => b.bit === bit);
      if (cell) {
        let group = stuck.find(p => p.k === k && p.bit === bit);
        if (!group) { group = { k, bit, count: 0, samples: [] }; stuck.push(group); }
        group.count++;
        // Remain at the exact point of contact, attached to the struck ring.
        if (group.samples.length < 64) group.samples.push({uQ:rawQ.sub(cell.loQ).mod().div(cell.hiQ.sub(cell.loQ)),vQ:F.qQ.sub(ring.riQ).div(ring.roQ.sub(ring.riQ))});
      }
    }
    if (window.zzBallLostRecord) window.zzBallLostRecord(k);
    status("✕ Шарик " + (F.number || 1) + " застрял в бите кольца " + (k + 1));
  }
  function writeInwardImpact(k, S, a) {
    if (F.route !== "in") return false;
    const value = F.move < 0 ? "1" : Z.coneBallZeroBounce && F.bounces > 0 ? "0" : null;
    if (value === null) return false;
    const ring = S.rings[k], bit = fillCellAt(ring, Q(a).sub(ring.phaseQ).sub(S.spinQ));
    if (bit === null) return false;
    const text = k === Z.rows.length ? fillDraft() : Z.rows[k], M = window.zzBallEmptyMask ? window.zzBallEmptyMask() : null;
    if (!text || bit < 0 || bit >= text.length) return false;
    let current = M && M[k]?.[bit] === "1" ? "." : text[bit];
    for (const h of pendingBits) if (h.k === k && h.bit === bit) current = h.value;
    if (k === Z.rows.length && pendingMarks.includes(bit)) current = "1";
    // An outside hit fills an empty cell only. A recorded 0 or 1 is already a wall, not another write.
    if (F.move < 0 && (current === "0" || current === "1")) return false;
    if (current === value) return false;
    pendingBits.push({k, bit, value}); return true;
  }
  function markDraft(bit) {
    if (bit === null) return false;
    const text = fillDraft(); if (!text || bit < 0 || bit >= text.length || text[bit] === "1" || pendingMarks.includes(bit)) return false;
    pendingMarks.push(bit); return true;
  }
  function enteredRing(k) { if (run) { ringStats(F.k).passed++; ringStats(k).entered++; } }
  // v0.1067: where the ball may enter ring k on world line a: an exactly aligned edge, or an open
  // cut-out (no bit block covers a; the ball keeps its place and turns with that ring); null — it hits a bit's arc.
  /* v0.1067, «шарик и щель — идеальные линия и точка без ширины, поэтому никаких допусков… везде так»: щель (разрез) — линия без ширины, шарик — точка.
     Проходит только грань, лежащая ровно на его прямой (точное равенство дробей, без допуска); вырез — открытая дуга. Прежде — допуск полуширины
     щели (coneSlitHalf, как у лазера) */
  function lossPass(S, k, a, slits = centerBatchSlits || centerSlits()) {
    if (S.rings[k].solid) return null;
    const R = S.rings[k], walls = R.contactBlocks || R.blocks, raw = Q(a).sub(R.phaseQ).sub(S.spinQ);
    if (Z.coneBallRoute === "in" && closedSlit(slits, k, R, raw)) return null;
    for (const b of walls) for (const edge of [b.loQ,b.hiQ]) if (edge.sub(raw).mod().eq(0)) return edge;
    return walls.some(b => { const x = raw.sub(b.loQ).mod(); return x.sign() > 0 && x.cmp(b.hiQ.sub(b.loQ)) < 0; }) ? null : raw;
  }
  // The ball sits on edge F.raw of ring F.k at distance F.q from the centre,
  // so it turns with that ring. Stops: the outer rim (exit), the joint between
  // the rings and the centre. Across the joint and through the centre it goes
  // on only along an edge lying on the same line at that moment.
  function advance(dt, A, B, boundaryOnly = false) {
    if (!enabled || !F || F.ready || F.stage === "done" || F.stage === "lost") return;
    if (!A || !B || A.shape !== F.shape || B.shape !== F.shape) { F = null; status(hint()); return; }
    const dir = (Z.coneAutoSp ?? 30) < 0 ? -1 : 1;
    if (dir !== F.dir) { begin(A,true); status("Направление изменено · ▶ запуск — новый опыт"); return; }
    const C = frame(A,B,dt), duration = C.durationQ; if (!duration.sign() && !boundaryOnly || F.speedQ.sign() <= 0) return;
    let elapsed = ZERO, guard = 0;
    while ((elapsed.cmp(duration) < 0 || boundaryOnly) && guard++ < 256) {
      if (F.stage === "arc") {
        const arc = F.arc, amount = ZZExact.min(duration.sub(elapsed),arc.durationQ.sub(arc.elapsedQ));
        arc.elapsedQ = arc.elapsedQ.add(amount); F.elapsedQ = F.elapsedQ.add(amount); F.travelQ = F.travelQ.add(arc.speedQ.mul(amount)); elapsed = elapsed.add(amount);
        setRaw(F,arc.fromQ.add(arc.toQ.sub(arc.fromQ).mul(arc.elapsedQ.div(arc.durationQ)))); arc.elapsed = arc.elapsedQ.number();
        if (arc.elapsedQ.cmp(arc.durationQ) < 0) break;
        setRaw(F,arc.toQ); F.arc = null; F.arcs++; F.move = -1; F.stage = "in"; F.seg = null; continue;
      }
      const ring = A.rings[F.k], stop = F.move > 0 ? ring.roQ : ring.riQ;
      if (F.auto) {
        const plan = planSegment(C.at(duration.sign() ? elapsed.div(duration) : ZERO),C,dt), speed = plan ? plan.speedQ : F.speedQ;
        if (!speed.eq(F.speedQ)) F.tuned++;
        F.speedQ = speed; F.auto = false; F.seg = null; lossSpeedQ = speed;
      }
      const available = F.speedQ.mul(duration.sub(elapsed)), distance = ZZExact.max(ZERO,stop.sub(F.qQ).mul(F.move)), amount = ZZExact.min(available,distance), step = amount.div(F.speedQ);
      F.qQ = F.qQ.add(amount.mul(F.move)); F.travelQ = F.travelQ.add(amount); F.elapsedQ = F.elapsedQ.add(step); elapsed = elapsed.add(step);
      if (!F.qQ.eq(stop)) break;
      const fraction = duration.sign() ? elapsed.div(duration) : ZERO, S = C.at(fraction), a = angleQ(S,F.k,F.rawQ);
      if (F.k === A.rings.length - 1 && F.move > 0) {
        F.crossings++; if (F.loop) { outerArc(S); continue; }
        F.growReq = F.route === "in" && !!ring.fill && Z.rows.length < CONE_MAX - 1 && !!window.zzBallGrowOuter;
        finish(); break;
      }
      if (!F.k && F.move < 0) {
        if (F.route === "in") { F.atCenter = true; closeCenterRing(0,S,F.rawQ); finish(); break; }
        const edge = edgeAt(S,0,a.add(HALF));
        if (edge === null && S.rings[0].oneWay && centerMode() === "flip") {
          F.move = 1; F.stage = "out"; F.seg = null; F.flipReq = true; F.flips = (F.flips || 0) + 1; break;
        }
        if (edge === null && S.rings[0].oneWay) { F.move = 1; F.stage = "out"; }
        else if (edge === null) turn("В центре нет грани напротив");
        else { setRaw(F,edge); F.move = 1; F.stage = "out"; }
        continue;
      }
      const next = F.k + F.move, target = S.rings[next], touching = stop.eq(F.move > 0 ? target.riQ : target.roQ);
      if (F.route === "in" && F.move < 0 && next < centerCount() && touching) {
        if (run) ringStats(next).hits++;
        const written = writeInwardImpact(next,S,a); F.atCenter = true; closeCenterRing(F.k,S,F.rawQ);
        if (!written && bounceOn()) { F.atCenter = false; bounceAt(next); continue; }
        if (absorbOn() && written) absorbAt(next); else finish(); break;
      }
      let edge = touching ? edgeAt(S,next,a) : null;
      if (markRun && target.fill && F.move > 0 && touching) {
        edge = lossPass(S,next,a);
        if (edge === null) {
          const bit = fillCellAt(target,a.sub(target.phaseQ).sub(S.spinQ)), marked = markDraft(bit); if (bit !== null) F.marked = bit;
          markK1(fraction,next); impactAt(next,S,a,marked); if (F.stage === "lost") break; else continue;
        }
      }
      if (F.loss && touching) {
        edge = lossPass(S,next,a);
        if (edge === null) { markK1(fraction,next); impactAt(next,S,a); if (F.stage === "lost") break; else continue; }
      }
      if (edge === null) turn("Грань кольца " + (next + 1) + " не совпала");
      else { markK1(fraction,next); enteredRing(next); F.k = next; setRaw(F,edge); F.seg = null; }
    }
    const fraction = duration.sign() ? elapsed.div(duration) : ZERO;
    F.ringTurnsQ = F.ringTurnsQ.map((value,k) => value.add((C.turnDeltaQ[k] || ZERO).mul(fraction)));
    F.aQ = angleQ(C.at(fraction),F.k,F.rawQ); F.a = radians(F.aQ); F.frameFractionQ = fraction;
    projectMotion(F); rememberResult(); metrics(B);
  }
  function rememberResult(ball = F) {
    if (!run || !ball || !ball.runNumber) return;
    const result = { number: ball.runNumber, ringTurns: ball.ringTurnsQ.map(q => q.text()), stage: ball.stage, clean: ball.clean };
    const i = run.results.findIndex(b => b.number === result.number);
    if (i >= 0) run.results[i] = result; else { run.results.push(result); if (run.results.length > 64) run.results.shift(); }
  }
  function finish() {
    F.stage = "done"; F.seg = null; cycles++; if (F.clean) passes++;
    // v0.1085: выход за последнее кольцо — видимая остановка на краю, а не удаление из опыта.
    if (!resting.includes(F)) resting.push(F);
    if (run) { if (F.atCenter) run.reachedCenter++; else run.exited++; ringStats(F.k).passed++; }
    status(routes[F.route] + " · " + (F.clean ? "ПРОХОД без разворота" : "НЕ проход: был разворот") + " · " + F.elapsedQ.text() + " оборота К1 · чистых " + passes + "/" + cycles);
    if (F.loopError) status(F.loopError);
  }
  // Every inward ball sees closure at the same event time, independent of array order and frame size.
  function advanceInwardGroup(dt,A,B,stopAtSame = false) {
    const C = frame(A,B,dt), duration = C.durationQ;
    if (!duration.sign()) return null;
    let elapsed = ZERO;
    while (elapsed.cmp(duration) < 0) {
      const list = balls.length ? balls : F ? [F] : [], live = list.filter(b => !b.ready && b.stage !== "done" && b.stage !== "lost");
      if (!live.length) break;
      const before = C.at(elapsed.div(duration));
      for (const b of live) if (b.auto) {
        F = b; const plan = planSegment(before,C,dt);
        if (plan && !plan.speedQ.eq(b.speedQ)) { b.speedQ = plan.speedQ; b.tuned++; }
        b.auto = false; lossSpeedQ = b.speedQ; projectMotion(b);
      }
      const stops = live.map(b => {
        const r = before.rings[b.k], time = b.stage === "arc" ? b.arc.durationQ.sub(b.arc.elapsedQ) :
          b.speedQ.sign() > 0 ? (b.move > 0 ? r.roQ.sub(b.qQ) : b.qQ.sub(r.riQ)).div(b.speedQ) : duration.sub(elapsed);
        return {ball:b,time:ZZExact.max(ZERO,time)};
      });
      const step = stops.reduce((t,p) => ZZExact.min(t,p.time),duration.sub(elapsed));
      const same = stops.filter(p => p.time.eq(step)).map(({ball:b}) => ({number:b.number || 1,
        ring:b.stage === "arc" ? "конец дуги" : !b.k && b.move < 0 ? "центр" : b.k + b.move >= A.rings.length ? "выход" : "К" + (b.k + b.move + 1)}));
      const after = C.at(elapsed.add(step).div(duration));
      const identities = live.map(b => [b.k,b.move,b.stage,b.qQ.text(),b.rawQ.text()].join(":")).join("|");
      centerBatch = true; pendingClosed = centerCount(); centerBatchSlits = JSON.parse(JSON.stringify(centerSlits()));
      try { for (const b of live) { F = b; advance(step,before,after,!step.sign()); } }
      finally { centerBatch = false; centerBatchSlits = null; setClosed(pendingClosed); }
      elapsed = elapsed.add(step);
      for (const b of live) if (b.route === "in" && b.stage !== "done" && b.stage !== "lost" && b.k < centerCount() && !(b.move > 0 && b.bounces > 0)) {
        F = b; b.atCenter = true; finish(); rememberResult();
        if (!same.some(e => e.number === b.number)) same.push({number:b.number || 1,ring:"центр К" + centerCount()});
      }
      const pause = stopAtSame && same.length > 1, fractionQ = elapsed.div(duration);
      const last = list[list.length - 1], chainEvent = chain && last && !last.ready && (last.k >= 1 || last.stage === "done" || last.stage === "lost");
      const grow = live.some(b => b.growReq), flip = live.some(b => b.flipReq);
      const complete = Z.coneBallRoute === "in" && centerCount() >= A.rings.length - 1 && A.rings[A.rings.length - 1].fill &&
        list.every(b => b.ready || b.stage === "done" || b.stage === "lost");
      if (grow || flip || pause || complete || chainEvent) return {fractionQ,fraction:fractionQ.number(),events:same,grow,flip,pause,complete,chain:chainEvent};
      if (!step.sign() && identities === live.map(b => [b.k,b.move,b.stage,b.qQ.text(),b.rawQ.text()].join(":")).join("|")) {
        status("Движение остановлено: событие на стыке не изменило состояние"); pauseRotation(); break;
      }
    }
    return null;
  }
  window.zzBallActive = () => enabled && !!snapshot();
  window.zzBallLive = () => slicingOn() ? sliceDualOn() ? sliceDuos.reduce((n,scope) => n + (scope.data && (!scope.data.done || scope.data.stoppedReason === "cycle") ? sliceLineOn() ? 1 : scope.data.moving.length : 0),0) : slicing && (!slicing.done || slicing.stoppedReason === "cycle") ? sliceLineOn() ? 1 : slicing.moving.length : 0 : (balls.length ? balls : F ? [F] : []).filter(b => !b.ready && b.stage !== "done" && b.stage !== "lost").length;   // активный опыт линии тоже должен продолжаться после паузы
  // v0.1085: добавление внешнего кольца сохраняет все прежние шарики, включая бывшее кольцо за чертой.
  window.zzBallBeforeGrow = () => enabled && F ? snapshot() : null;
  window.zzBallAfterGrow = previous => { if (previous) growRun(snapshot(), previous); };
  function growRun(S, previous = null) {
    const current = balls.length ? balls : F ? [F] : [];
    if (!S || !current.length || !current.every(b => b.ringShapes && S.rings.length > b.ringShapes.length && S.rings[b.k])) return false;
    const resumed = [];
    for (const b of new Set([...current, ...resting])) {
      if (!S.rings[b.k]) continue;
      const oldCount = b.ringShapes.length;
      // Use geometry at the promotion instant, never an angle cached by the last draw.
      if (previous && previous.rings[b.k]) {
        const raw = angleQ(previous,b.k,b.rawQ).sub(S.rings[b.k].phaseQ).sub(S.spinQ), shift = raw.sub(b.rawQ);
        setRaw(b,raw);
        if (b.arc) { b.arc.fromQ = b.arc.fromQ.add(shift); b.arc.toQ = b.arc.toQ.add(shift); b.arc.from = radians(b.arc.fromQ); b.arc.to = radians(b.arc.toQ); }
        if (b.ready) { b.start.raw = b.raw; b.start.rawQ = b.rawQ; }
      }
      b.shape = S.shape; b.RQ = S.rings[S.rings.length - 1].roQ; b.R = b.RQ.number(); b.seg = null;
      b.ringShapes = S.rings.map(r => r.shape); b.fillIndex = S.rings.findIndex(r => r.fill);
      while (b.ringTurnsQ.length < S.rings.length) b.ringTurnsQ.push(ZERO); projectMotion(b);
      // An outward ball parked at the old rim can now meet the new ring at that same joint.
      if (S.rings.length > oldCount && b.stage === "done" && !b.atCenter && b.move > 0 && b.k === oldCount - 1 && b.qQ.eq(S.rings[b.k].roQ)) {
        b.stage = "out"; b.growReq = false; b.crossings = Math.max(0, b.crossings - 1);
        cycles = Math.max(0, cycles - 1); if (b.clean) passes = Math.max(0, passes - 1);
        resting = resting.filter(x => x !== b);
        if (!current.includes(b)) resumed.push(b);
        if (run) { run.exited = Math.max(0, run.exited - 1); ringStats(b.k).passed = Math.max(0, ringStats(b.k).passed - 1); }
        rememberResult(b);
      }
    }
    if (resumed.length) balls = [...new Set([...current, ...resumed])];
    if (Z.coneBallRoute === "in") {
      const key = centerKey(), closed = Z.coneBallClosed, empty = Z.coneBallEmpty;
      if (closed) Z.coneBallClosed = { ...closed, key };
      if (empty && Array.isArray(empty.m)) Z.coneBallEmpty = { ...empty, key,
        m: empty.m.concat(Z.rows.slice(empty.m.length).map(row => "0".repeat(row.length))) };
      centerInitKey = key + (bounceOn() ? "|b" : "");
      balls = [...new Set([...current, ...resumed])];
      ensureInwardGroup(S);
    }
    return true;
  }
  // v0.1053: строка за чертой ушла в поле — вылеты продолжаются с найденной скоростью.
  function restartRun(S) {
    if (growRun(S)) return;
    const live = (balls.length ? balls : F ? [F] : []).filter(b => !b.ready && b.stage !== "done" && b.stage !== "lost");
    if (run) run.removed += live.length;
    const c = boundaryPoints(S).find(p => p.id === "center"); balls = []; F = null; if (!c) return;
    batchBusy = true;
    try { begin(S, false, true, { point: c, route: "out", periodQ:periodQ(S), speedQ: lossRun && lossSpeedQ.sign() > 0 ? lossSpeedQ : undefined, auto: lossRun && lossSpeedQ.sign() > 0 ? false : undefined });
      if (chain) { const no = F.runNumber || 1; Object.assign(F, { number: no, label: "Вылет " + no }); balls = [F]; } }
    finally { batchBusy = false; }
    status("Строка ушла в поле · вылеты дальше: строк " + Z.rows.length);
  }
  window.zzBallBeforeSpin = () => {
    if (!enabled) return null;
    if (sliceDualOn()) return {sliceDual:true};
    if (slicingOn()) {
      if (coneSpinning && slicing && !slicing.done) {
        paused = false;
      }
      return snapshot();
    }
    const S = snapshot(); if (!S) { status(hint()); return null; }
    growRun(S);
    if (!F || F.shape !== S.shape) { if (markRun && !paused) restartRun(S); else prepare(S); } return S;
  };
  // v0.1046: «⟳ щель 180°» — шарик дошёл до центра: кольцо 1 (один бит) поворачивается на полоборота довода строки 1. Все шарики на нём едут с ним;
  // в счёт оборотов кольца 1 — по ½ на переворот
  function applyFlips(list) {
    const n = list.filter(b => b.flipReq).length; if (!n) return;
    const delta = HALF.mul(n).mul((Z.coneAutoSp ?? 30) < 0 ? -1 : 1);
    list.forEach(b => { b.flipReq = false; if (!b.ready && b.stage !== "done" && b.stage !== "lost") { b.ringTurnsQ[0] = b.ringTurnsQ[0].add(delta); projectMotion(b); } });
    if (run) { const r = ringStats(0); r.turnsQ = r.turnsQ.add(delta); r.turns = r.turnsQ.number(); list.forEach(rememberResult); }
    const aim = coneMotionRead("aim.rotation",Z.coneAimRot || 0).add(Q(180).mul(n)).add(360).mod(720).sub(360);
    Z.coneAimRot = coneMotionWrite("aim.rotation",aim);
    save(); if (typeof renderCone === "function") renderCone();
  }
  function flushMarks() {
    if (pendingBits.length) {
      const list = pendingBits; pendingBits = [];
      const changes = window.zzBallBitWrite ? window.zzBallBitWrite(list) : [];
      for (const h of changes || []) if (run) ringStats(h.k)[h.value === "0" ? "zeros" : "marks"]++;
    }
    if (!pendingMarks.length) return;
    const list = pendingMarks; pendingMarks = [];
    const k = Z.rows.length;
    if (window.zzBallFillMark) { const written = window.zzBallFillMark(list); if (run) ringStats(k).marks += written || 0; }
  }
  window.zzBallAfterSpin = (dt,before) => {
    if (!enabled) return;
    if (sliceDualOn()) {
      sliceEnsureDuos();
      // Both centers use the same angular speed and elapsed time.
      for (const scope of sliceDuos) {
        sliceWithScope(scope,() => sliceScopeAdvance(dt));
      }
      slicePublishPrimary();
      if (sliceDuos.every(scope => scope.data?.done)) { paused = true; pauseRotation(); }
      sliceStatus(); renderRows(); save(); return;
    }
    if (slicingOn()) { if (sliceLineOn()) sliceLineAdvance(before,snapshot(),dt); else sliceAdvance(before,snapshot(),dt); return; }
    spinFrame++;
    const S = snapshot(); growRun(S);
    if (before && S && S.rings.length > before.rings.length && F && F.shape === S.shape) {
      before = {...before,shape:S.shape,rings:S.rings.map((r,k) => ({...r,phaseQ:before.rings[k]?.phaseQ ?? r.phaseQ,phase:before.rings[k]?.phase ?? r.phase})),
        rotationQ:S.rotationQ.map((v,k) => before.rotationQ[k] ?? v),rotation:S.rotation.map((v,k) => before.rotation[k] ?? v)};
    }
    if (run && run.lane !== (Z.lane | 0)) window.zzBallClearRun();
    const list = balls.length ? balls : F ? [F] : [];
    if (paused || !list.length || !before || !S) return;
    if (list.some(b => b.shape !== S.shape || b.shape !== before.shape)) {
      if (markRun) restartRun(S); else { balls = []; F = null; status(hint()); } return;
    }
    if (list.some(b => b.dir !== ((Z.coneAutoSp ?? 30) < 0 ? -1 : 1))) { prepare(S,true); status("Направление изменено · ▶ — общий запуск"); return; }
    const C = frame(before,S,dt); if (!C.durationQ.sign()) return;
    let event;
    batchBusy = true;
    try { event = advanceInwardGroup(dt,before,S,!!Z.coneBallSimPause); }
    finally { batchBusy = false; F = list[0]; }
    const fractionQ = event ? event.fractionQ : ONE, moved = C.durationQ.mul(fractionQ);
    if (run) {
      run.elapsedQ = run.elapsedQ.add(moved); run.elapsed = run.elapsedQ.number();
      C.turnDeltaQ.forEach((delta,k) => { const r = ringStats(k); r.turnsQ = r.turnsQ.add(delta.mul(fractionQ)); r.turns = r.turnsQ.number(); });
    }
    if (event) {
      const pose = C.at(fractionQ); coneMotionSetClock(pose.clockPhaseQ,pose.spinQ.mul(360));
      if (event.pause && run) run.simultaneous = {turns:run.elapsedQ.text(),events:event.events};
      if (event.pause || event.complete) pauseRotation();
    }
    applyFlips(list); flushMarks();
    const remaining = Q(dt).mul(ONE.sub(fractionQ));
    if (event && event.grow) {
      const grew = window.zzBallGrowOuter(); list.forEach(b => { b.growReq = false; });
      if (grew && !event.pause && remaining.sign() > 0 && window.zzBallContinueFrame) window.zzBallContinueFrame(remaining);
      batchStatus(); metrics(snapshot() || S); return;
    }
    const afterMarks = markRun ? snapshot() : null;
    if (afterMarks && afterMarks.shape !== S.shape && (!F || F.shape !== afterMarks.shape)) {
      restartRun(afterMarks);
      if (!paused && remaining.sign() > 0 && window.zzBallContinueFrame) window.zzBallContinueFrame(remaining);
      batchStatus(); metrics(afterMarks); return;
    }
    if (event && event.chain) {
      if (balls.length >= CHAIN_MAX) balls = balls.filter(b => b.stage !== "done" && b.stage !== "lost");
      const last = list[list.length - 1], pose = snapshot(), point = boundaryPoints(pose).find(p => p.id === "center");
      if (point && balls.length < CHAIN_MAX) {
        batchBusy = true;
        try {
          begin(pose,false,true,{point,route:"out",periodQ:last.periodQ,speedQ:lossRun && lossSpeedQ.sign() > 0 ? lossSpeedQ : last.speedQ,auto:false});
          Object.assign(F,{number:F.runNumber || (last.number || 0) + 1,label:"Вылет " + (F.runNumber || (last.number || 0) + 1)}); balls.push(F);
        } finally { batchBusy = false; F = balls[0]; }
      }
    }
    if (event && (event.flip || event.chain) && !event.pause && remaining.sign() > 0 && window.zzBallContinueFrame) window.zzBallContinueFrame(remaining);
    batchStatus(); metrics(event ? snapshot() : S);
    if (Z.coneBallRoute === "in" && run && !inwardNextPending && window.zzBallInwardNext) {
      const S2 = snapshot(), c = centerCount();
      if (S2 && S2.rings[S2.rings.length - 1].fill && c > 0 && c >= S2.rings.length - 1 && window.zzBallLive() === 0) {
        inwardNextPending = true;
        setTimeout(() => {
          let started;
          try { started = window.zzBallInwardNext(!event?.pause); } finally { inwardNextPending = false; }
          if (started && !event?.pause && remaining.sign() > 0 && window.zzBallContinueFrame) window.zzBallContinueFrame(remaining);
        },0);
      }
    }
  };
  window.zzBallSpinState = on => {
    if (on && slicingOn()) sliceCycleResume();
    if (sliceDualOn()) {
      sliceEnsureDuos(); paused = !on; for (const scope of sliceDuos) scope.paused = !on || !!scope.data?.done;
      if (on && sliceDuos.every(scope => scope.data?.done)) pauseRotation();
      sliceStatus(); renderCone(); return;
    }
    if (slicingOn()) { if (on && slicing?.done) { pauseRotation(); return; } paused = !on; sliceStatus(); renderCone(); return; }
    paused = !on; if (!enabled) return;
    if (on && run) run.simultaneous = null;
    if (on && snapshot() && typeof coneReleaseRings === "function") coneReleaseRings();
    const S = snapshot(); if (on && S && (!F || F.ready)) { rememberStart(); newRun(); prepare(S, true, true); }
    if (balls.length) { batchStatus(); if (S) metrics(S); renderCone(); return; }
    if (on && F && F.stage !== "done") status(F.stage === "wait" ? "Ждёт прямую впереди · кольцо " + (F.k + 1) : F.clean ? routes[F.route] + " · по граням битов" : "Продолжает · НЕ проход (был разворот)");
    else if (!on && F && !F.ready && F.stage !== "done") status("Пауза вместе с вращением · ▶ — продолжить");
    labControls();
    renderCone();
  };
  window.zzBallRemember = () => {}; // Balls ride their bit edges; nothing to remember.
  // v0.1069: пустая ячейка строки — как пустая за чертой: фон, без цифры, пунктирный контур
  function drawEmpty(g, S, cx, cy, dr, dpr) {
    const M = window.zzBallEmptyMask ? window.zzBallEmptyMask() : null; if (!M) return;
    g.save(); g.fillStyle = typeof coneCss === "function" ? coneCss("--bg", "#0b0d12") : "#0b0d12"; g.strokeStyle = "#79e7e1"; g.lineWidth = dpr; g.setLineDash([3 * dpr, 3 * dpr]);
    for (let k = 0; k < M.length && k < S.rings.length; k++) {
      const m = M[k], ring = S.rings[k]; if (!m || !m.includes("1") || ring.fill) continue;
      const cells = ring.cells && ring.cells.length ? ring.cells : ring.blocks, ri = ring.ri * dr, ro = ring.ro * dr;
      for (const c of cells) {
        if (m[c.bit] !== "1") continue;
        const lo = angle(S,k,c.loQ), hi = angle(S,k,c.hiQ);
        g.beginPath();
        const full = c.hiQ.sub(c.loQ).cmp(ONE) >= 0;
        if (full) { g.arc(cx, cy, ro, 0, TAU); g.moveTo(cx + ri, cy); g.arc(cx, cy, ri, 0, TAU, true); }
        else { g.arc(cx, cy, ro, lo, hi); g.arc(cx, cy, ri, hi, lo, true); g.closePath(); }
        g.globalAlpha = 1; g.fill("evenodd"); g.globalAlpha = 0.6; g.stroke();
        // v0.1072, «у первого кольца не видно грани из центра»: ячейка во весь круг (кольцо из одного бита) — её грань (разрез) отдельной прямой
        if (full) { g.beginPath(); g.moveTo(cx + ri * Math.cos(lo), cy + ri * Math.sin(lo)); g.lineTo(cx + ro * Math.cos(lo), cy + ro * Math.sin(lo)); g.stroke(); }
      }
    }
    // v0.1070: щель «N щель» — геометрия кольца, а не бит: поверх пустых ячеек снова видна (тонкая линия)
    if (typeof coneOneSlit === "function" && coneOneSlit()) {
      g.setLineDash([]); g.globalAlpha = 0.95; g.strokeStyle = typeof CONE_SLIT1_COL !== "undefined" ? CONE_SLIT1_COL : "#7ee787"; g.lineWidth = 1.5 * dpr; g.shadowColor = g.strokeStyle; g.shadowBlur = 8 * dpr;
      for (let k = Math.max(0, centerCount()); k < M.length && k < S.rings.length; k++) {
        const ring = S.rings[k]; if (!M[k] || !M[k].includes("1") || ring.fill || ring.blocks.length !== 1) continue;
        const a = angle(S,k,ring.blocks[0].loQ); g.beginPath(); g.moveTo(cx + ring.ri * dr * Math.cos(a), cy + ring.ri * dr * Math.sin(a)); g.lineTo(cx + ring.ro * dr * Math.cos(a), cy + ring.ro * dr * Math.sin(a)); g.stroke();
      }
    }
    g.restore();
  }
  window.zzBallDraw = (g, o) => {
    if (slicingOn() && enabled) { if (sliceDualOn()) sliceDualDraw(g,o); else sliceDraw(g,o); return; }
    if (!enabled) { markers = []; drawn = null; return; }   // v0.960: выключены — на конусе ничего
    const { cx, cy, dr, dpr } = o, S = snapshot();
    if (S) {
      growRun(S);
      if (!F || F.shape !== S.shape) { if (markRun && !paused) restartRun(S); else prepare(S, true); }   // v0.1053: строка ушла в поле — вылеты продолжаются
      if (Z.coneBallRoute === "in") {
        g.save(); g.strokeStyle = "#ffd166"; g.lineWidth = 2 * dpr; g.globalAlpha = 0.95; g.setLineDash([]);
        for (const [key, progress] of Object.entries(centerSlits())) {
          const k = +key, ring = S.rings[k]; if (!ring || progress.shape !== ring.shape) continue;
          const edges = slitEdges(ring);
          for (const slot of progress.closed) {
            if (!edges[slot]) continue;
            const a = angle(S, k, edges[slot]), c = Math.cos(a), s = Math.sin(a);
            g.beginPath(); g.moveTo(cx + ring.ri * dr * c, cy + ring.ri * dr * s); g.lineTo(cx + ring.ro * dr * c, cy + ring.ro * dr * s); g.stroke();
          }
        }
        g.restore();
      }
      const R = S.rings[1].ro * dr;
      g.save(); g.lineWidth = dpr; g.strokeStyle = "#79e7e1"; g.globalAlpha = 0.26; g.setLineDash([3 * dpr, 4 * dpr]);
      if (!centerCount()) for (const b of S.rings[1].blocks) { const lo = angle(S,1,b.loQ), hi = angle(S,1,b.hiQ); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + R * Math.cos(lo), cy + R * Math.sin(lo)); g.arc(cx, cy, R, lo, hi); g.lineTo(cx, cy); g.stroke(); }
      g.restore();
      if ($("ballLabPoints") && Z.coneBallPoints !== false && lab && !lab.classList.contains("pmin")) {
        markers = (Z.coneBallRoute === "in" ? outerStarts(S) : boundaryPoints(S)).map(p => { const a = p.raw === null ? 0 : angle(S,p.k,p.rawQ); return { ...p, x: cx + p.r * dr * Math.cos(a), y: cy + p.r * dr * Math.sin(a) }; });
        drawn = { dpr }; const unique = [];
        g.save(); g.lineWidth = 1.5 * dpr;
        for (const p of markers) {
          if (unique.some(v => Math.hypot(v.x - p.x, v.y - p.y) < 2 * dpr)) continue; unique.push(p);
          const selected = allStarts() || markers.some(v => v.id === (Z.coneBallStart || "center") && Math.hypot(v.x - p.x, v.y - p.y) < 2 * dpr);
          const joint = p.r === 1 && markers.some(v => v.r === 1 && v.k !== p.k && Math.hypot(v.x - p.x, v.y - p.y) < Math.max(dr * 1e-6, 1e-8));
          g.strokeStyle = selected ? "#ffd166" : joint ? "#7ee787" : p.kind === "edge" ? "#79e7e1" : "#cd94ff";
          g.fillStyle = "#10141c"; g.beginPath(); g.arc(p.x, p.y, (selected ? 6 : 4) * dpr, 0, TAU); g.fill(); g.stroke();
        }
        g.restore();
      } else { markers = []; drawn = null; }
      drawEmpty(g, S, cx, cy, dr, dpr);   // v0.1069: пустые ячейки строк (отскок «В центр»)
      for (const ball of balls.length ? balls : F ? [F] : []) if (ball.ready) { ball.qQ = ball.start.qQ; ball.k = ball.start.k; setRaw(ball,ball.start.rawQ); projectMotion(ball); }
      metrics(S);
      g.save();
      for (const group of stuck) {
        for (const sample of group.samples) {
          const p = stuckPosition(S, group, sample); if (!p) continue;
          const x = cx + p.q * dr * Math.cos(p.a), y = cy + p.q * dr * Math.sin(p.a), radius = Math.max(dpr, Math.min(4 * dpr, dr * .1, p.q * dr * p.width * .18));
          g.fillStyle = "#ff6b6b"; g.strokeStyle = "#25141a"; g.lineWidth = dpr;
          g.beginPath(); g.arc(x, y, radius, 0, TAU); g.fill(); g.stroke();
        }
        if (group.count > 64) {
          const p = stuckPosition(S, group, {u:.5,v:.5}); if (!p) continue;
          g.font = "bold " + 12 * dpr + "px monospace"; g.textAlign = "center"; g.textBaseline = "middle"; g.strokeStyle = "#0b0d12"; g.lineWidth = 3 * dpr; g.fillStyle = "#ffb4b4";
          const text = "×" + group.count, x = cx + p.q * dr * Math.cos(p.a), y = cy + p.q * dr * Math.sin(p.a); g.strokeText(text, x, y); g.fillText(text, x, y);
        }
      }
      g.restore();
    }
    if (!S) { markers = []; drawn = null; F = null; balls = []; metrics(null); status(enabled ? hint() : "Шарики выключены · нажми ● вкл. · " + hint()); }
    const positions = [];
    const visible = new Set([...(balls.length ? balls : F ? [F] : []), ...resting]);
    for (const ball of visible) {
      if (ball.stage === "lost") continue;   // v0.1052: упёрся в дугу — исчез
      // A ball turns with the ring whose edge it rides.
      if (S && S.rings[ball.k]) ball.a = angle(S, ball.k, ball.rawQ);
      const q = ball.q * dr, a = ball.a;
      const x = cx + q * Math.cos(a), y = cy + q * Math.sin(a);
      const color = !enabled ? "#a8b3c5" : ball.stage === "wait" ? "#ffd166" : !ball.clean ? "#ff5f6d" : ball.stage === "done" ? "#7ee787" : ball.loop && ball.number > 2 ? "#c89aff" : "#79e7e1";
      g.save(); g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 9 * dpr; g.beginPath(); g.arc(x, y, 4 * dpr, 0, TAU); g.fill(); g.shadowBlur = 0;
      if (ball.number) {
        // Offset only the labels when starts coincide; retain exact positions.
        const overlap = positions.filter(p => Math.hypot(p.x - x, p.y - y) < 12 * dpr).length;
        g.font = "bold " + 16 * dpr + "px monospace"; g.textAlign = "left"; g.textBaseline = "bottom";
        const tx = x + 7 * dpr, ty = y - (8 + 18 * overlap) * dpr;
        g.lineWidth = 4 * dpr; g.strokeStyle = "#0b0d12"; g.strokeText(String(ball.number), tx, ty); g.fillText(String(ball.number), tx, ty);
      }
      positions.push({ x, y }); g.restore();
    }
  };
  function reset(toStart = false, keepCenter = false) {
    if (slicingOn()) { pauseRotation(); paused = true; if (toStart) window.zzBallToStart(); else window.zzBallClearRun({keepCenter}); sliceStatus(); labControls(); renderCone(); return; }
    window.zzBallClearRun({keepCenter});   // v0.1063: при загрузке страницы закрытие (из памяти или пресета) остаётся
    if (toStart && !keepCenter && Z.coneBallRoute === "in") window.zzBallInwardPrime();   // v0.1070: ↩ к старту — сразу стартовое состояние нового опыта
    F = null; balls = []; cycles = passes = 0; chain = false; lossRun = false; lossSpeedQ = ZERO; markRun = false; pendingMarks = []; pendingBits = [];
    if (toStart) restoreStart();
    const S = snapshot(); if (S) prepare(S, true); else { metrics(null); status(enabled ? hint() : "Шарики выключены · нажми ● вкл. · " + hint()); } renderCone();
  }
  // The start pose is the user's last manual ring turn before a launch: a
  // launch from the starts remembers it, ↩ and a new launch return to it.
  const fresh = () => !(balls.length ? balls : F ? [F] : []).some(b => !b.ready);
  // v0.1064: старт шариков — общий стартовый снимок всех режимов (Z.coneStartPose, zz-ui.js coneStartMark / coneStartApply)
  function rememberStart() { coneStartMark(true); save(); }
  function restoreStart() {
    pauseRotation();
    if (!coneStartApply()) return;
    save(); if (typeof renderRows === "function") renderRows();
  }
  window.zzBallToStart = () => {
    if (slicingOn()) {
      pauseRotation(); paused = true;
      Z.rows = ["0"]; Z.cur = 0; coneRot = [0]; Z.coneRot = [0];
      Z.coneSliceTurns = [];
      Z.cutAlign = "p";   // Чистый старт Нарезки; сохранённую cutMem не удаляем.
      Z.coneAimRot = 0; Z.coneFillTurn = 0;
      delete Z.ringPhOff; delete Z.coneHold; delete Z.coneHoldOff; delete Z.voidHits;
      Z.fillCells = null; Z.fillFree = null; Z.motionExact = {}; delete Z.coneFree;
      delete Z.coneSliceBitMarks; delete Z.coneSliceSectorBits; delete Z.coneSliceRightRows; delete Z.coneSliceRightMarks; delete Z.coneSliceCenters;
      coneMotionSetClock(ZERO,ZERO);
      slicePrepareThroughRings();
      window.zzBallClearRun(); markers = []; drawn = null; lastPoints = "";
      Z.coneTurns = []; Z.coneFillTurns = 0; Z.coneRunStop = null;
      if (window.zzFaceReset) window.zzFaceReset();
      if (window.zzFaceUi) window.zzFaceUi();
      if (window.zzConeTapeClear) window.zzConeTapeClear();
      renderRows(); save(); sliceStatus(); renderCone(); return;
    }
    if (F || balls.length) reset(false, true);
  };   // «↩ старт» в «Кручении»: шарики — на свои старты, закрытие колец остаётся
  function metrics(S) {
    if (batchBusy || !$("ballLabTime")) return;
    const P = S ? Z.coneBallRoute === "in" ? outerStarts(S) : boundaryPoints(S) : [{ id: "center", label: "Центр" }], key = P.map(p => p.id).join("|");
    if (key !== lastPoints) {
      const select = $("ballLabStart"); select.replaceChildren();
      const all = document.createElement("option"); all.value = "all"; all.textContent = Z.coneBallRoute === "in" ? "Все внешние щели: " + P.length : "Все " + (S ? P.length : 11) + ": углы К2, края К1 и центр"; select.appendChild(all);
      const group = document.createElement("option"); group.value = "group"; group.textContent = "Сквозная группа"; group.hidden = true; select.appendChild(group);
      for (const p of P) { const opt = document.createElement("option"); opt.value = p.id; opt.textContent = p.label; select.appendChild(opt); }
      lastPoints = key;
    }
    const grouped = !allStarts() && throughCount() > 1;
    const option = $("ballLabStart").querySelector('[value="group"]');
    if (option) { option.hidden = !grouped; option.textContent = "Сквозные: " + throughCount() + (throughCount() === 2 ? " навстречу" : " шарика"); }
    $("ballLabStart").value = Z.coneBallRoute === "in" ? "all" : grouped ? "group" : allStarts() ? "all" : S ? startPoint(S).id : "center";
    $("ballLabStart").disabled = Z.coneBallRoute === "in";
    const T = F && !F.ready ? F.periodQ : S ? periodQ(S) : null, mult = F && !F.ready ? F.multQ : inputFraction(Z.coneBallMult || "1");
    const elapsed = (balls.length ? balls : F ? [F] : []).reduce((q,b) => ZZExact.max(q,b.elapsedQ),ZERO);
    const text = T && mult && mult.sign() > 0 ? "К1 = единица времени · T₀ " + T.text() + " оборота К1 · " + (allStarts() ? "диаметр" : "путь") + " за " + T.div(mult).text() + " оборота К1" + (F && !F.ready ? " · прошло " + elapsed.text() : "") : "Нужны два кольца и положительная дробь";
    if ($("ballLabTime").textContent !== text) { $("ballLabTime").textContent = text; $("ballLabRun").title = text; }
    $("ballLabRun").textContent = F && !F.ready ? "↻ новый запуск" : "▶ запуск";
    renderTurns();
    labControls();
  }
  function turnsFraction(value) {
    const q = Q(value); if (!q.sign()) return "0";
    const a = q.abs(), whole = a.floor(), rest = a.sub(whole);
    const text = rest.sign() ? (whole ? whole + " " : "") + rest.text() : a.text();
    return (q.sign() < 0 ? "↺ −" : "↻ ") + text;
  }
  window.zzBallTurnsFraction = turnsFraction;
  function renderTurns() {
    const el = $("ballLabTurns"); if (!el) return;
    const list = run ? run.results : []; el.hidden = !list.length;
    if (!list.length) { el.textContent = ""; return; }
    const count = Math.max(...list.map(b => b.ringTurns.length));
    const rows = list.map(b => '<tr><th scope="row">' + b.number + (b.stage === "lost" ? " ✕" : b.stage === "done" ? (b.clean ? " ✓" : " ×") : "") + '</th>' + Array.from({length:count}, (_, k) => { const v = b.ringTurns[k]; return '<td' + (v !== undefined && Q(v).sign() < 0 ? ' class="ccw"' : '') + '>' + (v === undefined ? "—" : turnsFraction(v)) + '</td>'; }).join('') + '</tr>').join('');
    const html = '<table><caption>Обороты колец за путь шарика' + (run.launched > 64 ? ' · последние 64 из ' + run.launched : '') + '</caption><thead><tr><th scope="col">Шарик</th>' + Array.from({length:count}, (_, k) => '<th scope="col">К' + (k + 1) + '</th>').join('') + '</tr></thead><tbody>' + rows + '</tbody></table>';
    if (el.innerHTML !== html) el.innerHTML = html;
  }
  function choose(id) { if (id === "group") return; pauseRotation(); Z.coneBallThroughCount = 1; Z.coneBallBatch = id === "all"; if (id !== "all") Z.coneBallStart = id; save(); reset(); }
  function launch(config = {}) {
    if (slicingOn() && (config.route === undefined || config.route === "slice")) {
      pauseRotation(); const ok = sliceLaunch(); if (ok && !slicing?.done && $("bConeAuto")) $("bConeAuto").click(); renderCone(); return ok;
    }
    if (config.through !== undefined) Z.coneBallThroughCount = config.through;
    else if (config.start !== undefined || config.batch !== undefined || config.mult !== undefined) Z.coneBallThroughCount = 1;
    if (config.start !== undefined) { Z.coneBallBatch = config.start === "all"; if (config.start !== "all") Z.coneBallStart = config.start; }
    if (config.batch !== undefined) Z.coneBallBatch = !!config.batch;
    if (config.route !== undefined && routes[config.route]) Z.coneBallRoute = config.route;
    // v0.1028: ручной скорости нет — базовая всегда 1× (диаметр за T₀), остальное делает подстройка; сквозной передаёт свою.
    Z.coneBallMult = config.mult !== undefined ? String(config.mult) : "1";
    Z.coneBallSlitOnly = !!config.slit; Z.coneBallSlitStart = !!config.slitStart;   // v0.1050: запуск из «Граней»
    const keepRun = !!config.keepRun && !!run && Z.coneBallRoute === "in";
    const previous = keepRun ? (balls.length ? balls : F ? [F] : []).filter(b => !b.ready && b.stage !== "done" && b.stage !== "lost") : [];
    pauseRotation(); if (!keepRun) { if (fresh()) rememberStart(); else restoreStart(); F = null; balls = []; }
    enabled = true; Z.coneBallOn = true; ui();
    if (typeof coneReleaseRings === "function") coneReleaseRings();
    if (Z.coneBallRoute === "in") { if (keepRun) centerInitKey = centerKey() + (bounceOn() ? "|b" : ""); else initCenter(); }
    const S = snapshot(); if (!S) { status(hint()); return false; }
    if (Z.coneBallRoute !== "in") clearCenter();
    if (Z.coneBallRoute === "in" && centerCount() >= S.rings.length) { status("Все кольца закрыты · сброс снова откроет щели"); renderCone(); return false; }
    if (!keepRun) newRun();
    chain = !!config.chain; lossRun = !!config.loss; lossSpeedQ = ZERO; markRun = !!config.mark; pendingMarks = []; pendingBits = [];
    prepare(S, !keepRun, true);
    if (keepRun) { balls.forEach(b => { b.number = b.runNumber; }); balls = previous.concat(balls); F = balls[0] || F; }
    save(); if (!F || F.ready) return false;
    if (chain && !balls.length) { Object.assign(F, { number: 1, label: "Вылет 1" }); balls = [F]; batchStatus(); }   // v0.1051: первый шарик цепочки
    if (!coneSpinning) $("bConeAuto").click();
    paused = !coneSpinning;
    renderCone(); return true;
  }
  function launchThrough(count = 1) {
    pauseRotation();
    if (!fresh()) { restoreStart(); F = null; balls = []; }
    // v0.1029: солнце гасится, а с ним и луч-часы, которые оно включало само; иначе выключенное солнце оставляло луч лазера.
    if (Z.coneSun && $("bConeSun")) {
      $("bConeSun").click();
      const clock = $("coneClock"); if (Z.coneClock && clock && clock.onchange) { clock.checked = false; clock.onchange({ target: clock }); }
    }
    if (typeof coneReleaseRings === "function") coneReleaseRings();
    Z.coneBallMult = "1";
    const S = snapshot(), group = S ? movingGroup(S,count) : { error: hint() };
    const result = group.error ? group : group.runs[0];
    if (result.error) { status(result.error); say(result.error); renderCone(); return false; }
    if (!launch({ start: result.point.id, batch: false, route: "cross", mult: speedText(result.multQ), through: count })) return false;
    F.through = true;
    if (count === 1) { F.speedQ = result.speedQ; F.multQ = result.multQ; F.auto = !!result.auto; projectMotion(F); }
    if (count > 1) batchStatus();
    else status(result.auto ? "Сквозной · " + result.point.label + " · база " + speedText(result.multQ) + "× · авто выберет одну постоянную скорость перед первым отрезком" : "Сквозной проход · " + result.point.label + " · " + speedText(result.multQ) + "× · " + result.durationQ.text() + " оборота К1");
    labControls(); renderCone(); return true;
  }
  window.zzBallLaunch = launch;
  window.zzBallThrough = launchThrough;
  window.zzBallPoints = () => { const S = snapshot(); return S ? boundaryPoints(S) : []; };
  function ballInfo(b) {
    return {marked:b.marked,lostAt:b.lostAt,absorbed:!!b.absorbed,absorbedAt:b.absorbedAt,flips:b.flips || 0,flipReq:!!b.flipReq,auto:b.auto,tuned:b.tuned,
      id:b.id,number:b.number,label:b.label,route:b.route,stage:b.stage,ready:b.ready,reference:"К1",
      speed:b.speedQ.text(),period:b.periodQ?.text(),multiplier:b.multQ.text(),length:b.lengthQ.text(),distance:b.travelQ.text(),elapsed:b.elapsedQ.text(),
      ringTurns:b.ringTurnsQ.map(q => q.text()),clean:b.clean,reversals:b.reversals,ring:b.k,edge:b.rawQ.text(),q:b.qQ.text(),
      angle:b.aQ?.text(),loop:b.loop,crossings:b.crossings,arcs:b.arcs,arcSpeed:b.arc?.speedQ.text(),waitingForRing:null,loopError:b.loopError};
  }
  window.zzBallInfo = () => F && { ...ballInfo(F), batch: allStarts(), balls: balls.map(ballInfo), resting: resting.map(ballInfo) };
  window.zzBallLabSync = () => {
    if (!lab) return;
    Z.coneBallLabOpen = !lab.classList.contains("cmin");
  };
  // v0.1021: оформление группы тоже меняет class; оно не должно запускать новую отрисовку.
  function observeLabFold(el) {
    let open = !el.classList.contains("cmin"), raf = 0;
    new MutationObserver(() => {
      const next = !el.classList.contains("cmin");
      if (next === open) return;
      open = next; Z.coneBallLabOpen = next;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; renderCone(); });
    }).observe(el, { attributes: true, attributeFilter: ["class"] });
  }
  function initLab() {
    if (typeof ZZ_BG !== "undefined" && ZZ_BG) return;
    lab = $("solBallLab"); const host = lab && lab.querySelector(":scope > .cgb"); if (!host) return;
    if (!host.querySelector(".ball-lab-body")) host.insertAdjacentHTML("beforeend", `<div class="ball-lab-body cgrp-fill">
      <div class="ball-lab-row"><label>Путь <select id="ballLabRoute"><option value="cross">через центр</option><option value="out">на вылет</option><option value="in">в центр</option><option value="slice">нарезка</option></select></label><button id="ballLabPoints" type="button" aria-pressed="true">◎ точки</button></div>
      <label>Старт <select id="ballLabStart"><option value="all">Все 11: углы К2, края К1 и центр</option></select></label>
      <div class="ball-lab-row"><button id="ballLabThrough" type="button" aria-pressed="false" title="Рассчитать скорость и запустить один сквозной проход в текущем режиме вращения. Старт — выбранный внешний угол; при выборе всех точек начинаем поиск с крайнего левого. Кольца без промежутков. Поиск до 64 относительных оборотов; в конце зелёный шарик и ✓ — проход без разворота.">↦ сквозной</button><button type="button" data-ball-through="2" aria-pressed="false" title="Два шарика одновременно с противоположных внешних краёв, с одной постоянной скоростью. В центре проходят друг сквозь друга.">⇄ 2</button><button type="button" data-ball-through="3" aria-pressed="false" title="Три шарика одновременно с разных внешних граней. Каждому подбирается своя постоянная скорость; столкновений нет.">↦ 3</button><button type="button" data-ball-through="4" aria-pressed="false" title="Четыре шарика одновременно с четырёх внешних граней. Каждому подбирается своя постоянная скорость; столкновений нет.">↦ 4</button></div>
      <div class="ball-lab-row"><button id="ballLabOne" type="button" aria-pressed="false" title="Что делает шарик в центре у кольца 1 из одного бита — по кругу:
центр: насквозь — едет дальше по прямой напротив разреза;
⊙ назад — у кольца 1 только разрез: пришёл по нему в центр — выходит по нему же обратно (не разворот, шарик зелёный);
⟳ щель 180° — дойдя до центра, шарик поворачивает кольцо 1 на полоборота: его щель встаёт на продолжение пути, и шарик едет дальше в ту же сторону. Все шарики на кольце 1 поворачиваются с ним; в оборотах кольца 1 — по ½ на переворот.
При ◐ и ✚ у кольца 1 свои грани с обеих сторон — там всегда насквозь.">центр: насквозь</button><button id="ballLabArc" type="button" aria-pressed="false" title="∞ По дугам: четыре шарика переходят на К3 и следующие видимые кольца. На самом внешнем краю огибают дугу и идут обратно с той же постоянной скоростью. На стыке нет точной щели или открытого выреза — удар: застрять / отскочить, без ожидания. Чистый бесконечный цикл не гарантирован. Ещё раз — выключить и вернуть к старту.">∞ по дугам</button></div>
      <small id="ballLabGroupSpeeds" hidden title="Номер шарика: его базовая скорость ×. Авто выбирает скорость перед первым отрезком; дальше она постоянна, включая дуги."></small>
      <div id="ballLabTime" hidden></div><div class="ball-lab-row"><button id="ballLabRun" type="button">▶ запуск</button><button id="ballLabPause" type="button">⏸ пауза</button><button id="ballLabReset" type="button">↩ к старту</button><button id="ballLabDir" type="button">↻ / ↺</button></div>
      <div id="ballLabTurns" title="Фактический поворот каждого кольца с момента запуска шарика, в оборотах по 360°. Дроби сокращены; ≈ — округление до 1/1000 оборота. ↻ по часовой, ↺ − против. На паузе счёт стоит; ✓ — чистый выход, × — выход с разворотами; результат зафиксирован. Новый запуск и ↩ обнуляют счёт. В режиме ∞ считается весь путь, включая дуги."></div>
      <div class="ball-lab-status-placeholder"></div></div>`);
    const statusLine = $("coneBallStatus");
    if (statusLine) { statusLine.className = "ball-lab-status"; lab.querySelector(".ball-lab-status-placeholder").replaceWith(statusLine); }
    $("ballLabRoute").value = routes[Z.coneBallRoute] ? Z.coneBallRoute : "cross";
    $("ballLabRun").onclick = () => launch();
    $("ballLabThrough").onclick = () => launchThrough(1);
    lab.querySelectorAll("[data-ball-through]").forEach(b => b.onclick = () => launchThrough(+b.dataset.ballThrough));
    $("ballLabOne").onclick = () => { const m = centerMode(); Z.coneBallCenter = m === "through" ? "back" : m === "back" ? "flip" : "through"; delete Z.coneBallOne; save(); reset(true); labControls(); };   // v0.1046: по кругу
    $("ballLabArc").onclick = () => { Z.coneBallArc = !Z.coneBallArc; if (Z.coneBallArc) launchThrough(4); else reset(true); save(); labControls(); };
    $("ballLabPause").onclick = () => {
      if (slicingOn()) { sliceTogglePlayback(); return; }
      if (paused && (!enabled || !F || F.ready)) launch(); else $("bConeAuto").click();
    };
    $("ballSliceSpeed").value = Z.coneSliceSpeed || "2/3";
    $("ballSliceSpeed").onchange = () => {
      const value = inputFraction($("ballSliceSpeed").value);
      if (!value) { $("ballSliceSpeed").value = Z.coneSliceSpeed || "2/3"; status("Нарезка: нужна положительная дробь до 1000"); return; }
      pauseRotation(); Z.coneSliceSpeed = value.text(); slicing = null; save(); renderCone();
    };
    $("ballLabReset").onclick = () => reset(true);
    if ($("bConeSliceRun")) $("bConeSliceRun").onclick = sliceTogglePlayback;
    if ($("bConeSliceReset")) $("bConeSliceReset").onclick = () => { if (!slicingOn()) $("bConeBallSlice").click(); reset(true); };
    $("ballLabDir").onclick = () => { pauseRotation(); $("bConeDir").click(); reset(); };
    $("ballLabStart").onchange = () => choose($("ballLabStart").value);
    $("ballLabRoute").onchange = () => {
      pauseRotation(); Z.coneBallThroughCount = 1; Z.coneBallRoute = $("ballLabRoute").value;
      Z.coneBallArm = Z.coneBallRoute === "slice" ? "slice" : Z.coneBallRoute === "in" ? "in" : "out";
      for (const [id,route] of [["bConeBallSlice","slice"],["bConeBallIn","in"],["bConeNotchBall","out"]]) {
        const b = $(id); if (b) { b.classList.toggle("on",route === Z.coneBallArm); b.setAttribute("aria-pressed",String(route === Z.coneBallArm)); }
      }
      slicing = null; save(); reset();
    };
    $("ballLabPoints").onclick = () => { Z.coneBallPoints = Z.coneBallPoints === false; $("ballLabPoints").setAttribute("aria-pressed", String(Z.coneBallPoints)); save(); renderCone(); };
    $("ballLabPoints").setAttribute("aria-pressed", String(Z.coneBallPoints !== false));
    observeLabFold(lab);
    const source = $("coneBallStatus"), syncStatus = () => { source.title = source.textContent; const name = lab.querySelector(":scope > .glab"); if (name) name.title = source.textContent + "\n\n" + LAB_HELP; };
    new MutationObserver(syncStatus).observe(source, { childList: true, characterData: true, subtree: true }); syncStatus();
    $("coneCv").addEventListener("pointerdown", e => {
      if (!enabled || !drawn || e.button && e.button !== 0) return;
      const cv = $("coneCv"), r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * cv.width / r.width, y = (e.clientY - r.top) * cv.height / r.height;
      const point = markers.reduce((best, p) => !best || Math.hypot(p.x - x, p.y - y) < Math.hypot(best.x - x, best.y - y) ? p : best, null);
      if (!point || Math.hypot(point.x - x, point.y - y) > 14 * drawn.dpr) return;
      e.preventDefault(); e.stopImmediatePropagation(); choose(point.id);
    }, true);
    ui(); window.zzBallLabSync();
  }
  function init() {
    if (!$("bConeBall")) return;
    Z.coneBallAuto = true; Z.coneBallMult = "1";   // v0.1028: только автоподстройка, ручной скорости нет
    enabled = Z.coneBallOn !== false; paused = !coneSpinning; ui(); reset(false, true);
    $("bConeBall").onclick = () => {
      enabled = !enabled; Z.coneBallOn = enabled; ui(); save(); reset();
      if (enabled && coneSpinning) { window.zzBallSpinState(true); renderCone(); }
    };
    $("bConeBallReset").onclick = () => reset(true);
    initLab(); reset(false, true);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
