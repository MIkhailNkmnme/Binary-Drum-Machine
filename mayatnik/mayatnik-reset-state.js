/* Explicit defaults for the user's clean 512-row scene. Saved libraries and
 * menu placement are intentionally outside this state. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikResetState=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const off=('outline third sym symBits symV symH symD symPlainV symPlainH symPlainD symTriangles autoAxes triangleMapAxes triangleMapMask triangleMapMirror crossMirror crossLabels pair compareMirror noband ochki ochkiSnake ochkiInv ochkiRev ochkiOverlay frozen zLimit anchorAxis fixLines fixCross lineMeasures linesOn saw sawFull midOneOn midZeroOn midWide paintMid fixWide fixLowOut fixRot fixHor fixDown fixDragK geomCenter sectors areas heat vtxFlash contour both viewUpsideDown templateLock templateMask testStats').split(' ');
  const zero=('blackMirror animHl paintAxis paintMeet triTop thirds fixMirror fixFold fixLow fixDx fixDy rowLab midCol bothDx ztMir ztopRow ztlBx frameT vrows').split(' ');
  function defaults(){return {...Object.fromEntries(off.map(k=>[k,false])),...Object.fromEntries(zero.map(k=>[k,0])),
    rows:512,steps:512,mode:'pend',bg:'empty',view:'bits',speed:4,vmode:'',compareSource:'',
    zoom:'fit',zMid:true,ztop:true,zBot:false,zLock:false,zsnap:true,zbase:2,ztopPin:false,ztlMain:false,ztlZen:false,
    fixAxis:1,fixLockX:null,axisPalette:'purple-black',triangleMapSource:'static',crossMirrorMode:'lr',crossMirrorSector:'A1',
    fillArea:'sides',fillGrow:false,symRowsMin:2,symRowsMax:0,symBitsMin:2,symBitsMax:0,symTriangleRows:16,
    bitOneColour:'#e8edf5',bitZeroColour:'#5b6475',overOneColour:'#4f9bff',overZeroColour:'#ff5a4f',digitOneColour:'#e8edf5',digitZeroColour:'#7cbcff',
    bitContourColour1:'#ffe969',bitContourColour2:'#ffffff',bitContourMode:'single',bitContourColours:'auto',digitFont:'mono',digitSize:80,
    midOneColour:'#ff7f27',midZeroColour:'#4f9bff',verticalFillColour:'#ff7f27',stolbFillColour:'#ff7f27',axesFillColour:'#ff7f27',autoFillColour:'#ff7f27',growFillColour:'#ff7f27',meetFillColour:'#ff7f27',axisFillColour:'#ff7f27',autoFillPalette:true,growOwnColour:false,
    ochkiMode:'diag',ochkiPattern:'initial',ochkiLength:5,templateMaxArea:4096,templateFocusMargins:null,
    userLines:[],zl:[],nAxisSets:[],nAxesN:3,areaFreeze:null,mirAxis:{on:false,ax:.5,ang:0},ovl:{n:0,pos:'R',alpha:50},
    cellSelection:null,cellInk:{},parity:{cellsEven:true,cellsOdd:true,rowsEven:true,rowsOdd:true}};}
  const groups={
    scale:'zoom zMid ztop zBot zLock zsnap zbase ztopPin ztopRow templateFocusMargins',
    view:'view viewUpsideDown outline noband both bothDx blackMirror animHl frozen ochki ochkiSnake heat vtxFlash rowLab contour geomCenter bitOneColour bitZeroColour digitOneColour digitZeroColour digitFont digitSize bitContourColour1 bitContourColour2 bitContourMode bitContourColours overOneColour overZeroColour parity',
    measure:'areas sectors sawFull lineMeasures areaFreeze rowLab',
    point:'fixLines fixCross fixMirror fixFold fixLow fixWide fixLowOut fixRot fixHor fixDown fixDragK fixDx fixDy fixLockX fixAxis saw',
    cells:'cellSelection cellInk',
  };
  function scope(name){if(!groups[name])throw Error('Неизвестная группа сброса');const base=defaults();return Object.fromEntries(groups[name].split(' ').map(k=>[k,base[k]]));}
  return {defaults,scope,off,zero,groups};
});
