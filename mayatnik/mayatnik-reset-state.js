/* Explicit defaults for the user's clean 512-row scene. Saved libraries and
 * menu placement are intentionally outside this state. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikResetState=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const off=('sequenceInverseAbove sequenceOwnGrid sequenceSourceOn joined180 joined180Whole outline third sym symBits symV symH symD symPlainV symPlainH symPlainD symTriangles autoAxes triangleMapAxes triangleMapMask triangleMapMirror crossMirror crossLabels pair compareMirror ochki ochkiThrough ochkiRowReverseMask gifScaleStack ochkiSnake manualSnake paintSame paintSymmetric paintIsolated0 paintIsolated1 ochkiInv ochkiRev ochkiHalf ochkiOverlay frozen zLimit anchorAxis fixLines fixCross lineMeasures linesOn saw sawFull midOneOn midZeroOn midWide paintMid fixWide fixLowOut fixRot fixHor fixDown fixDragK geomCenter sectors areas heat vtxFlash contour both viewUpsideDown templateLock templateMask testStats').split(' ');
  const zero=('sequenceSourceLimit blackMirror animHl paintAxis paintMeet triTop thirds fixMirror fixFold fixLow fixDx fixDy rowLab midCol bothDx ztMir ztPaint ztopRow ztlBx frameT vrows').split(' ');
  function defaults(){return {...Object.fromEntries(off.map(k=>[k,false])),...Object.fromEntries(zero.map(k=>[k,0])),
    xorrom:null,sequenceSource:null,edgeContinuous:true,edgeWrap:false,edgeBounce:false,edgeRhombOn:false,romboRow:null,romboAngle:0,romboAssembly:16,romboSeam:"between",romboMode:"fixed",romboLayout:null,edgeFlowMax:0,edgeFlowKey:'',animatrixOn:false,animatrixSource:null,animatrixAlgorithm:'two',animatrixTiming:'rows',animatrixDirection:'down',animatrixCycles:1,animatrixCycleMode:'finite',animatrixFrameMax:0,animatrixColours:'inherit',animatrixEvolution:1,rowStepOutline:true,templateFindAll:null,rows:512,steps:512,mode:'pend',bg:'empty',view:'bits',speed:4,vmode:'',compareSource:'',
    zOverview:true,zoom:'fit',zMid:true,ztop:true,zBot:false,zLock:false,zsnap:true,zbase:2,ztopPin:false,ztlMain:false,ztlZen:false,zlSelected:null,ztMirOp:'',
    invertKind:'bits',inverted:false,invertAuto:false,invertFrame:null,heatHoldZero:false,heatMode:"all",heatPeriod:1,fixAxis:1,fixLockX:null,axisPalette:'purple-black',triangleMapSource:'static',crossMirrorMode:'lr',crossMirrorSector:'A1',
    fillArea:'sides',fillWholeColour:false,paintFrameMode:'off',fillGrow:false,symRowsMin:2,symRowsMax:0,symBitsMin:2,symBitsMax:0,symTriangleRows:16,
    bitOneColour:'#e8edf5',bitZeroColour:'#5b6475',overOneColour:'#4f9bff',overZeroColour:'#ff5a4f',digitOneColour:'#e8edf5',digitZeroColour:'#7cbcff',
    bitContourColour1:'#ffe969',bitContourColour2:'#ffffff',bitContourMode:'single',bitContourColours:'auto',digitFont:'mono',digitSize:80,
    midOneColour:'#ff7f27',midZeroColour:'#4f9bff',verticalFillColour:'#ff7f27',stolbFillColour:'#ff7f27',axesFillColour:'#ff7f27',autoFillColour:'#ff7f27',growFillColour:'#ff7f27',meetFillColour:'#ff7f27',axisFillColour:'#ff7f27',isolatedOneColour:'#ff7f27',isolatedZeroColour:'#ff7f27',autoFillPalette:true,growOwnColour:false,
    frameDrift:false,frameDriftStep:1,noband:2,gifScaleStackStep:8,gifScaleStackMode:'rows',gifScaleStackBase:2,ochkiMode:'diag',ochkiPattern:'initial',ochkiLength:5,templateMaxArea:4096,templateFocusMargins:null,
    ztAuto:{speed:1,direction:0},ztPaintColour1:'#ff7f27',ztPaintColour0:'#ff7f27',userLines:[],zl:[],lineFamilies:{h:false,v:false,d:false},nAxisSets:[],nAxesN:3,areaFreeze:null,mirAxis:{on:false,ax:.5,ang:0},ovl:{n:0,pos:'R',alpha:50},
    cellSelection:null,cellInk:{},parity:{cellsEven:true,cellsOdd:true,rowsEven:true,rowsOdd:true,colsEven:true,colsOdd:true,rowLevels:[],cellLevels:[],colLevels:[],rowFill:'none'}};}
  const groups={
    scale:'zoom zMid ztop zBot zLock zOverview zsnap zbase ztopPin ztopRow templateFocusMargins',
    view:'view joined180 joined180Whole viewUpsideDown invertKind inverted invertAuto invertFrame outline noband both bothDx blackMirror animHl frozen ochki ochkiThrough ochkiRowReverseMask gifScaleStack gifScaleStackStep ochkiSnake manualSnake heat heatHoldZero heatMode heatPeriod vtxFlash rowLab contour geomCenter bitOneColour bitZeroColour digitOneColour digitZeroColour digitFont digitSize bitContourColour1 bitContourColour2 bitContourMode bitContourColours overOneColour overZeroColour parity',
    measure:'areas sectors sawFull lineMeasures areaFreeze rowLab',
    point:'fixLines fixCross fixMirror fixFold fixLow fixWide fixLowOut fixRot fixHor fixDown fixDragK fixDx fixDy fixLockX fixAxis saw',
    cells:'cellSelection cellInk',
  };
  function scope(name){if(!groups[name])throw Error('Неизвестная группа сброса');const base=defaults();return Object.fromEntries(groups[name].split(' ').map(k=>[k,base[k]]));}
  return {defaults,scope,off,zero,groups};
});
