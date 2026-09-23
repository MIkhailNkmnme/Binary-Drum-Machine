// Zerkalius — двое обоев в одних: холм из пыли или треугольник Серпинского.
// Сцена, надпись, символы, цвет, музыка и прочее — в Lively (правый клик → Customize).
var P = {
  scene:0,                          // 0 — холм из пыли, 1 — треугольник Серпинского
  title:'Zerkalius', title2:'', title3:'',
  t1Size:100, t1Font:0, t1Space:0, t2Size:100, t2Font:0, t2Space:0, t3Size:100, t3Font:0, t3Space:0,
  clockFont:0, clockSpace:0, chars:'01',
  color:'#00ff6e', rainbow:false, rainbowSpeed:20,
  contrast:100, sat:100,
  autoAmp:10, auto:{}, preset:0,
  clock:true, blockY:22, gapTC:100, titleSize:100, clockSize:100,
  glitch:true, music:true, musicPower:100,
  rain:45, rainSpeed:100, rainSize:20, rainTrail:50, rainGapX:100, rainGapY:100,
  // холм
  hBright:100, hBig:1, hSpeed:100, hCover:true, hGapX:100, hGapY:100,
  // радар
  rSpeed:60, rCY:50, rSpan:100,
  vSpeed:35, vCY:50, vHole:3, vSize:14, vStep:112, vGap:105, vTwist:14, vBright:100, vRot:true, vOut:true, rLev:8, rBig:1, rBright:100, rRing:5, rDense:141, rTrail:60,
  // Серпинский
  sBright:100, sBig:1, sSpeed:45, sToUs:true, sWidth:81, sDepth:120
};
var ZERK_VERSION='1.8';   // версия обоев
var NL=String.fromCharCode(10);
var BASE={};      // значения, выставленные вручную
var AUTOPH={};    // фаза и скорость гуляния для каждого ползунка
var AUTO_OK=['rCY','rSpan','vSpeed','vCY','vHole','vSize','vStep','vGap','vTwist','vBright','rainbowSpeed','contrast','sat','musicPower','rain','rainSpeed','rainTrail','titleSize','clockSize',
             'blockY','gapTC','hBright','hSpeed','sBright','sBig','sSpeed','rSpeed','rTrail','rLev','rRing','rBig','rBright'];
var NOISE = [
 '// свой рельеф: шум по сетке (value noise) и несколько его слоёв (fbm)',
 'float zh(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }',
 'float zn(vec2 p){',
 '  vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);',
 '  float a=zh(i), b=zh(i+vec2(1.0,0.0)), c=zh(i+vec2(0.0,1.0)), d=zh(i+vec2(1.0,1.0));',
 '  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y)*2.0-1.0;',
 '}',
 'float zfbm(vec2 p){ float s=0.0, a=0.55; for(int o=0;o<4;o++){ s+=a*zn(p); p=p*2.07+vec2(17.3,9.1); a*=0.5; } return s; }',
 'float zsoft(vec2 p){ return zn(p)*0.7+zn(p*1.9+vec2(5.2,1.3))*0.3; }'   // плавный рельеф для горизонталей
].join(String.fromCharCode(10));

// ---------- шрифты надписи и часов ----------
var FONTS=['Consolas','Cascadia Mono','Courier New','Lucida Console','OCR-A BT','Bahnschrift',
           'Segoe UI','Arial Black','Impact','Georgia','Times New Roman'];
function fontCss(i){ return '"'+(FONTS[i|0]||'Consolas')+'", Consolas, monospace'; }

// ---------- цвет ----------
function hexToRgb(h){ var m=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h); return m?[parseInt(m[1],16),parseInt(m[2],16),parseInt(m[3],16)]:[0,255,110]; }
function hsl2rgb(h,s,l){ h/=360; var f=function(n){var k=(n+h*12)%12,a=s*Math.min(l,1-l);return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1))));}; return [f(0),f(8),f(4)]; }
var hue=140;
function curRgb(){ return P.rainbow ? hsl2rgb(hue,1,0.5) : hexToRgb(P.color); }
function mix(c,k){ return [Math.round(c[0]+(255-c[0])*k),Math.round(c[1]+(255-c[1])*k),Math.round(c[2]+(255-c[2])*k)]; }
function dim(c,k){ return [Math.round(c[0]*k),Math.round(c[1]*k),Math.round(c[2]*k)]; }
function css(c,a){ return 'rgba('+c[0]+','+c[1]+','+c[2]+','+(a===undefined?1:a)+')'; }
function applyFilter(){ document.body.style.filter='contrast('+P.contrast+'%) saturate('+P.sat+'%)'; }

// ---------- звук системы (Lively отдаёт 32 полосы спектра) ----------
var AUD={bass:0,mid:0,high:0,level:0,beat:0};
function livelyAudioListener(a){
  if(!a || !a.length) return;
  var n=a.length, avg=function(i0,i1){var s=0;for(var i=i0;i<i1;i++)s+=a[i];return s/(i1-i0);};
  var bass=avg(0,Math.max(1,Math.round(n*0.12))), mid=avg(Math.round(n*0.12),Math.round(n*0.5)), high=avg(Math.round(n*0.5),n);
  var k=0.35;
  AUD.bass+=(bass-AUD.bass)*k; AUD.mid+=(mid-AUD.mid)*k; AUD.high+=(high-AUD.high)*k;
  AUD.level+=((bass+mid+high)/3-AUD.level)*k;
  if(bass>AUD.beat) AUD.beat=bass;
}
function audK(){ return P.music ? (P.musicPower/100) : 0; }

// ---------- набор символов ----------
var CH=['0','1'];
function setChars(v){
  var a=Array.from(String(v||'')).filter(function(x){return x.trim().length>0;});
  var u=[]; a.forEach(function(x){ if(u.indexOf(x)<0 && u.length<16) u.push(x); });
  CH=u.length?u:['0','1'];
}
function rch(){ return CH[(Math.random()*CH.length)|0]; }

// ---------- общая сцена three.js ----------
var glc=document.getElementById('hill');
var renderer=new THREE.WebGLRenderer({canvas:glc,antialias:false,alpha:true});
renderer.setClearColor(0x000000,0);
var scene=new THREE.Scene();
var camera=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,1,6000);

var atlas=document.createElement('canvas'), tex=new THREE.Texture(atlas);
tex.minFilter=THREE.LinearFilter;
function buildAtlas(){
  atlas.width=64*CH.length; atlas.height=64;
  var c=atlas.getContext('2d'); c.clearRect(0,0,atlas.width,64);
  c.fillStyle='#fff'; c.textAlign='center'; c.textBaseline='middle';
  for(var i=0;i<CH.length;i++){
    var f=56; c.font='bold '+f+'px Consolas, monospace';
    var w=c.measureText(CH[i]).width; if(w>56) c.font='bold '+Math.floor(f*56/w)+'px Consolas, monospace';
    c.fillText(CH[i],i*64+32,34);
  }
  tex.needsUpdate=true; uniH.uN.value=CH.length; uniS.uN.value=CH.length; uniR.uN.value=CH.length; uniV.uN.value=CH.length;
}

// ================= сцена 1: холм из пыли =================
var uniH={ time:{type:'f',value:0}, ucolor:{type:'v3',value:new THREE.Vector3(0,1,0.43)}, uopacity:{type:'f',value:1},
           tex:{type:'t',value:tex}, px:{type:'f',value:1}, big:{type:'f',value:1}, uN:{type:'f',value:2},
           uCover:{type:'f',value:1}, uAud:{type:'f',value:0}, uBeat:{type:'f',value:0} };
var vsH=[
 'attribute float aRand; uniform float time; uniform float px; uniform float big; uniform float uN; uniform float uAud; uniform float uBeat;',
 'varying float vOp; varying float vIdx; varying float vHead;',
 'mat4 rotateMatrixX(float r){return mat4(1.0,0.0,0.0,0.0, 0.0,cos(r),-sin(r),0.0, 0.0,sin(r),cos(r),0.0, 0.0,0.0,0.0,1.0);}',
 NOISE,
 'void main(){',
 '  vec3 up=(rotateMatrixX(radians(90.0))*vec4(position,1.0)).xyz;',
 '  float sin1=sin(radians(up.x/128.0*90.0));',
 '  vec2 q=vec2(up.x, up.z-time*30.0);',
 '  float hills=zfbm(q*0.022);',                              // крупные холмы
 '  float mid=zfbm(q*0.07+vec2(40.0,0.0));',                // средние волны
 '  float rip=zn(q*0.35);',                                  // мелкая рябь
 '  float side=abs(sin1);',
 '  float amp=1.0+uAud*1.6;',
 '  float hgt=(hills*18.0*side + mid*6.0*side + rip*(side*2.0+0.4))*amp + sin1*sin1*40.0;',
 '  vec3 lp=up+vec3(0.0, hgt, 0.0);',
 '  vec4 mv=modelViewMatrix*vec4(lp,1.0);',
 '  vOp=clamp((110.0-length(lp))/256.0*2.6,0.0,1.0);',
 '  vIdx=mod(floor(aRand*97.0+time*(0.4+aRand*2.0)),uN);',
 '  vHead=step(0.985,fract(aRand*13.0+time*0.15));',
 '  gl_PointSize=clamp(px*big*(1.0+uBeat*0.5)*2300.0/-mv.z,3.0,44.0*big);',
 '  gl_Position=projectionMatrix*mv;',
 '}'].join(NL);
var fsH=[
 'uniform vec3 ucolor; uniform float uopacity; uniform float uN; uniform sampler2D tex;',
 'varying float vOp; varying float vIdx; varying float vHead;',
 'void main(){',
 '  vec2 uv=vec2((gl_PointCoord.x+vIdx)/uN, 1.0-gl_PointCoord.y);',
 '  float a=texture2D(tex,uv).a;',
 '  vec3 c=mix(ucolor, vec3(1.0), vHead*0.7);',
 '  gl_FragColor=vec4(c, a*vOp*uopacity);',
 '}'].join(NL);
var fsHBlack=[
 'uniform float uopacity; uniform float uN; uniform float uCover; uniform sampler2D tex;',
 'varying float vOp; varying float vIdx; varying float vHead;',
 'void main(){',
 '  vec2 uv=vec2((gl_PointCoord.x+vIdx)/uN, 1.0-gl_PointCoord.y);',
 '  float a=texture2D(tex,uv).a;',
 '  gl_FragColor=vec4(0.0,0.0,0.0, clamp(a*1.6,0.0,1.0)*clamp(vOp*2.0,0.0,1.0)*uCover);',
 '}'].join(NL);
var matH=new THREE.ShaderMaterial({uniforms:uniH,vertexShader:vsH,fragmentShader:fsH,transparent:true,depthWrite:false,blending:THREE.NormalBlending});
var matHBlack=new THREE.ShaderMaterial({uniforms:uniH,vertexShader:vsH,fragmentShader:fsHBlack,transparent:true,depthWrite:false,blending:THREE.NormalBlending});
// сплошная чёрная поверхность той же формы, что и пыль: всё, что за холмом, скрыто
var matHSolid=new THREE.ShaderMaterial({uniforms:uniH,vertexShader:vsH,
  fragmentShader:'uniform float uCover; void main(){ gl_FragColor=vec4(0.0,0.0,0.0,uCover); }',
  transparent:true,depthWrite:false,depthTest:false,side:THREE.DoubleSide,blending:THREE.NormalBlending});

// ================= сцена 2: треугольник Серпинского =================
var uniS={ time:{type:'f',value:0}, uOff:{type:'f',value:0}, px:{type:'f',value:1}, big:{type:'f',value:1},
           uN:{type:'f',value:2}, ucolor:{type:'v3',value:new THREE.Vector3(0,1,0.43)}, uopacity:{type:'f',value:1},
           uFar:{type:'f',value:900}, uAud:{type:'f',value:0}, uBeat:{type:'f',value:0}, tex:{type:'t',value:tex} };
var vsS=[
 'attribute float aVis; attribute float aRand;',
 'uniform float time, uOff, px, big, uN, uFar, uAud, uBeat;',
 'varying float vOp; varying float vIdx;',
 'void main(){',
 '  vec3 p=position;',
 '  p.z+=uOff;',
 '  p.y+=sin(p.z*0.02+time*2.0)*3.0*uAud;',
 '  vec4 mv=modelViewMatrix*vec4(p,1.0);',
 '  float d=-mv.z;',
 '  vIdx=mod(floor(aRand*97.0+time*(0.6+aRand*2.0)),uN);',
 '  vOp=aVis*clamp(1.0-d/uFar,0.0,1.0);',
 '  gl_PointSize=aVis*clamp(px*big*(1.0+uBeat*0.5)*4200.0/d,2.0,90.0*big);',
 '  gl_Position=projectionMatrix*mv;',
 '}'].join(NL);
var fsS=[
 'uniform vec3 ucolor; uniform float uopacity, uN; uniform sampler2D tex;',
 'varying float vOp; varying float vIdx;',
 'void main(){',
 '  vec2 uv=vec2((gl_PointCoord.x+vIdx)/uN, 1.0-gl_PointCoord.y);',
 '  float a=texture2D(tex,uv).a;',
 '  gl_FragColor=vec4(ucolor, a*vOp*uopacity);',
 '}'].join(NL);
var matS=new THREE.ShaderMaterial({uniforms:uniS,vertexShader:vsS,fragmentShader:fsS,transparent:true,depthWrite:false,blending:THREE.NormalBlending});


// ================= сцена 3: топологический радар =================
var uniR={ time:{type:'f',value:0}, px:{type:'f',value:1}, big:{type:'f',value:1}, uN:{type:'f',value:2},
           ucolor:{type:'v3',value:new THREE.Vector3(0,1,0.43)}, uopacity:{type:'f',value:1}, tex:{type:'t',value:tex},
           uSweep:{type:'f',value:0}, uLev:{type:'f',value:8}, uRing:{type:'f',value:5}, uR:{type:'f',value:300},
           uTrail:{type:'f',value:1.6}, uAud:{type:'f',value:0}, uBeat:{type:'f',value:0} };
var vsR=[
 'attribute float aRand; uniform float time, px, big, uN, uSweep, uLev, uRing, uR, uTrail, uAud, uBeat;',
 'varying float vOp; varying float vIdx; varying float vHot;',
 NOISE,
 'void main(){',
 '  vec3 p=position;',
 '  float r=length(p.xz);',
 '  float h=zsoft(vec2(p.x*0.011+time*0.02, p.z*0.011-time*0.015))*1.3;',   // свой плавный рельеф
 '  float lv=fract(h*uLev);',
 '  float line=smoothstep(0.16,0.0,abs(lv-0.5));',             // горизонтали
 '  float ring=smoothstep(0.04,0.0,abs(fract(r/(uR/uRing))-0.5));',
 '  float a=atan(p.z,p.x);',
 '  float d=mod(uSweep-a, 6.2831853);',
 '  float sw=exp(-d*uTrail);',                                  // развёртка со шлейфом
 '  float blip=step(0.9965,aRand);',
 '  float base=line*0.8+ring*0.45+blip*0.9;',
 '  vOp=clamp(base*(0.28+1.5*sw),0.0,1.0)*step(r,uR)*(1.0+uAud*0.6);',
 '  vHot=sw;',
 '  vec4 mv=modelViewMatrix*vec4(p,1.0);',
 '  vIdx=mod(floor(aRand*97.0+time*(0.6+aRand*2.0)),uN);',
 '  gl_PointSize=clamp(px*big*(1.0+blip*0.8+uBeat*0.5)*9000.0/-mv.z,2.0,70.0*big);',
 '  gl_Position=projectionMatrix*mv;',
 '}'].join(NL);
var fsR=[
 'uniform vec3 ucolor; uniform float uopacity, uN; uniform sampler2D tex;',
 'varying float vOp; varying float vIdx; varying float vHot;',
 'void main(){',
 '  vec2 uv=vec2((gl_PointCoord.x+vIdx)/uN, 1.0-gl_PointCoord.y);',
 '  float a=texture2D(tex,uv).a;',
 '  vec3 c=mix(ucolor, vec3(1.0), vHot*0.55);',
 '  gl_FragColor=vec4(c, a*vOp*uopacity);',
 '}'].join(NL);
var matR=new THREE.ShaderMaterial({uniforms:uniR,vertexShader:vsR,fragmentShader:fsR,transparent:true,depthWrite:false,blending:THREE.NormalBlending});

function buildRadar(){
  clearScene();
  var N=Math.max(41,Math.min(241,P.rDense|0)), R=RADR, st=2*R/(N-1);
  var n=N*N, pos=new Float32Array(n*3), rnd=new Float32Array(n), k=0;
  for(var j=0;j<N;j++) for(var i=0;i<N;i++){
    pos[k*3]=-R+i*st; pos[k*3+1]=0; pos[k*3+2]=-R+j*st; rnd[k]=Math.random(); k++;
  }
  var geo=new THREE.BufferGeometry();
  geo.addAttribute('position',new THREE.BufferAttribute(pos,3));
  geo.addAttribute('aRand',new THREE.BufferAttribute(rnd,1));
  uniR.big.value=P.rBig; uniR.uLev.value=P.rLev; uniR.uRing.value=P.rRing; uniR.uR.value=R;
  uniR.uTrail.value=0.3+ (100-P.rTrail)/100*4.0;
  var o=new THREE.Points(geo,matR); scene.add(o); objs.push(o);
  fitRadar();
}


// ================= сцена 4: воронка из колец символов (на видеокарте) =================
// Кольца символов вокруг центра растут наружу (или внутрь). Каждое кольцо само уходит за край
// и рождается заново в центре, поэтому стыков нет. Число символов в кольце подстраивается
// под его радиус, так что шаг между символами везде одинаковый.
var vPhase=0, vTurn=0, vGeo=null;
var uniV={ uPhase:{type:'f',value:0}, uTurn:{type:'f',value:0}, uNR:{type:'f',value:40}, uK:{type:'f',value:1.12},
           uR0:{type:'f',value:5}, uHole:{type:'f',value:0}, uMaxR:{type:'f',value:1200}, uGap:{type:'f',value:14},
           uFs:{type:'f',value:14}, uTwist:{type:'f',value:0.14}, uRotG:{type:'f',value:1}, uCX:{type:'f',value:0},
           uCY:{type:'f',value:0}, uW:{type:'f',value:1920}, uH:{type:'f',value:1080}, uSeed:{type:'f',value:0},
           uN:{type:'f',value:2}, ucolor:{type:'v3',value:new THREE.Vector3(0,1,0.43)}, uopacity:{type:'f',value:1},
           uBeat:{type:'f',value:0}, tex:{type:'t',value:tex} };
var vsV=[
 'uniform float uPhase,uTurn,uNR,uK,uR0,uHole,uMaxR,uGap,uFs,uTwist,uRotG,uCX,uCY,uW,uH,uSeed,uN,uBeat;',
 'varying float vOp; varying float vIdx; varying float vAng; varying float vB;',
 'float h1(float n){ return fract(sin(n)*43758.5453); }',
 'void main(){',
 '  float ring=position.x, slot=position.y, rnd=position.z;',
 '  float e=mod(ring+uPhase, uNR);',                         // место кольца в потоке
 '  float r=uR0*pow(uK,e);',
 '  float cnt=max(8.0, floor(6.2831853*r/uGap));',
 '  float show=step(slot,cnt-1.0)*step(uHole,r)*step(r,uMaxR);',
 '  float a=slot/cnt*6.2831853 + e*uTwist + uTurn;',
 '  vec2 pp=vec2(uCX+cos(a)*r, uCY+sin(a)*r);',
 '  gl_Position=vec4(pp.x/uW*2.0-1.0, 1.0-pp.y/uH*2.0, 0.0, 1.0);',
 '  float fade=min(1.0,(r-uHole)/(uFs*4.0)+0.15)*(1.0-min(1.0,r/uMaxR)*0.55);',
 '  float cyc=floor(ring+uPhase - e);',                      // номер витка — новые символы при перерождении
 '  vIdx=mod(floor(h1(ring*12.9+slot*78.2+cyc*3.7+uSeed)*uN*7.0),uN);',
 '  vB=h1(ring*3.1+slot*1.7+cyc);',
 '  vAng=(a+1.5707963)*uRotG;',
 '  vOp=fade*show;',
 '  gl_PointSize=show*uFs*1.35*(1.0+uBeat*0.5);',
 '}'].join(NL);
var fsV=[
 'uniform vec3 ucolor; uniform float uopacity, uN; uniform sampler2D tex;',
 'varying float vOp; varying float vIdx; varying float vAng; varying float vB;',
 'void main(){',
 '  vec2 p=gl_PointCoord-0.5;',
 '  float c=cos(vAng), s=sin(vAng);',
 '  vec2 q=vec2(c*p.x+s*p.y, -s*p.x+c*p.y)+0.5;',               // поворот символа по кольцу
 '  if(q.x<0.0||q.x>1.0||q.y<0.0||q.y>1.0) discard;',
 '  float a=texture2D(tex, vec2((q.x+vIdx)/uN, 1.0-q.y)).a;',
 '  vec3 col = vB<0.10 ? mix(ucolor,vec3(1.0),0.8) : (vB<0.7 ? ucolor : ucolor*0.6);',
 '  gl_FragColor=vec4(col, a*vOp*uopacity);',
 '}'].join(NL);
var matV=new THREE.ShaderMaterial({uniforms:uniV,vertexShader:vsV,fragmentShader:fsV,transparent:true,depthWrite:false,blending:THREE.NormalBlending});

function vParams(){
  var W=innerWidth,H=innerHeight, cx=W/2, cy=H*(P.vCY/100);
  var fs=Math.max(3,P.vSize*(H/1080)), k=1+Math.max(1,P.vStep-100)/100;
  var maxR=Math.hypot(Math.max(cx,W-cx),Math.max(cy,H-cy))+40;
  var r0=fs*0.35, gap=fs*P.vGap/100;
  var nr=Math.ceil(Math.log(maxR/r0)/Math.log(k))+2;
  var slots=Math.ceil(6.2831853*maxR*k/gap)+2;
  return {W:W,H:H,cx:cx,cy:cy,fs:fs,k:k,maxR:maxR,r0:r0,gap:gap,nr:nr,slots:slots};
}
function buildFunnel(){
  clearScene();
  var v=vParams();
  if(v.nr*v.slots>120000) v.slots=Math.floor(120000/v.nr);    // предел на всякий случай
  var n=v.nr*v.slots, pos=new Float32Array(n*3), k=0;
  for(var i=0;i<v.nr;i++) for(var j=0;j<v.slots;j++){ pos[k*3]=i; pos[k*3+1]=j; pos[k*3+2]=Math.random(); k++; }
  var geo=new THREE.BufferGeometry(); geo.addAttribute('position',new THREE.BufferAttribute(pos,3));
  var o=new THREE.Points(geo,matV); o.frustumCulled=false; scene.add(o); objs.push(o); vGeo=v;
  vUniforms();
}
function vUniforms(){
  var v=vParams();
  if(vGeo && (Math.abs(v.nr-vGeo.nr)>0 || v.slots>vGeo.slots+2)){ buildFunnel(); return; }
  uniV.uNR.value=vGeo?vGeo.nr:v.nr; uniV.uK.value=v.k; uniV.uR0.value=v.r0; uniV.uMaxR.value=v.maxR;
  uniV.uGap.value=v.gap; uniV.uFs.value=v.fs; uniV.uCX.value=v.cx; uniV.uCY.value=v.cy; uniV.uW.value=v.W; uniV.uH.value=v.H;
  uniV.uHole.value=Math.min(v.W,v.H)*P.vHole/100; uniV.uTwist.value=P.vTwist/100; uniV.uRotG.value=P.vRot?1:0;
}
function updFunnel(dt){
  var dir=P.vOut?1:-1;
  var step=dt*(P.vSpeed/100)*dir*(1+AUD.level*audK());
  vPhase+=step; vTurn+=step*2*Math.PI*0.15;
  var nr=uniV.uNR.value; vPhase=((vPhase%nr)+nr)%nr;
  uniV.uPhase.value=vPhase; uniV.uTurn.value=vTurn; uniV.uSeed.value=Math.floor(uniH.time.value*2)%97;
  uniV.uopacity.value=P.vBright/100; uniV.uBeat.value=AUD.beat*audK();
}

// ---------- построение сцен ----------
var RADR=300;
function fitRadar(){
  // 100% — круг достаёт до углов экрана, меньше — круг мельче
  var tan=Math.tan(25*Math.PI/180);
  var h=RADR/(tan*Math.sqrt(1+camera.aspect*camera.aspect))*(100/Math.max(20,P.rSpan));
  var visH=2*h*tan;                                // сколько мира влезает по вертикали
  var dz=(0.5-P.rCY/100)*visH;                                          // центр круга по вертикали экрана
  camera.up.set(0,0,-1);
  camera.position.set(0,h,dz);
  camera.lookAt(new THREE.Vector3(0,0,dz));
}
var objs=[];                       // что сейчас в сцене
function clearScene(){ objs.forEach(function(o){ scene.remove(o); }); objs=[]; }

function buildHill(){
  clearScene();
  var base=96/P.hBig;
  var segX=Math.min(500,Math.max(12,Math.round(base*100/Math.max(2,P.hGapX))));
  var segZ=Math.min(500,Math.max(12,Math.round(base*100/Math.max(2,P.hGapY))));
  var geo=new THREE.PlaneBufferGeometry(256,256,segX,segZ);
  var n=geo.attributes.position.count, rnd=new Float32Array(n);
  for(var i=0;i<n;i++) rnd[i]=Math.random();
  geo.addAttribute('aRand',new THREE.BufferAttribute(rnd,1));
  uniH.big.value=P.hBig;
  var b=new THREE.Mesh(geo,matHSolid); b.renderOrder=0; b.frustumCulled=false; scene.add(b); objs.push(b);
  var c=new THREE.Points(geo,matH); c.renderOrder=1; scene.add(c); objs.push(c);
  camera.up.set(0,1,0); camera.position.set(0,16,128); camera.lookAt(new THREE.Vector3(0,28,0));
}

// правило 90: новый ряд = сосед слева XOR сосед справа, из одной единицы растёт треугольник
var NX=81, NZ=120, SX=7, SZ=7, sPts=null, vis=null, rowsCur=null, off=0, gen=0;
function newRow(prev){
  gen++;
  if(gen>(NX>>1)){ gen=0; var seed=new Uint8Array(NX); seed[NX>>1]=1; return seed; }
  var r=new Uint8Array(NX);
  for(var i=0;i<NX;i++){ var l=i>0?prev[i-1]:0, rt=i<NX-1?prev[i+1]:0; r[i]=l^rt; }
  return r;
}
function buildSierp(){
  clearScene();
  NX=Math.max(21,P.sWidth|0); NZ=Math.max(40,P.sDepth|0);
  SX=Math.max(3,Math.round(560/NX)); SZ=SX;
  uniS.uFar.value=NZ*SZ*1.6; uniS.big.value=P.sBig;
  var n=NX*NZ, pos=new Float32Array(n*3), rnd=new Float32Array(n);
  vis=new Float32Array(n);
  var seed=new Uint8Array(NX); seed[NX>>1]=1; rowsCur=seed; gen=0;
  var rows=[seed];
  for(var j=1;j<NZ;j++) rows.push(newRow(rows[j-1]));
  rowsCur=rows[NZ-1];
  for(var j2=0;j2<NZ;j2++) for(var i=0;i<NX;i++){
    var k=j2*NX+i;
    pos[k*3]=(i-(NX-1)/2)*SX; pos[k*3+1]=0; pos[k*3+2]=-j2*SZ;
    rnd[k]=Math.random(); vis[k]=(P.sToUs?rows[NZ-1-j2]:rows[j2])[i];   // вершина у горизонта
  }
  var geo=new THREE.BufferGeometry();
  geo.addAttribute('position',new THREE.BufferAttribute(pos,3));
  geo.addAttribute('aRand',new THREE.BufferAttribute(rnd,1));
  geo.addAttribute('aVis',new THREE.BufferAttribute(vis,1));
  sPts=new THREE.Points(geo,matS); scene.add(sPts); objs.push(sPts);
  off=0; uniS.uOff.value=0;
  camera.up.set(0,1,0); camera.position.set(0,190,210); camera.lookAt(new THREE.Vector3(0,0,-300));
}
function stepRows(){
  var nrow=newRow(rowsCur), k;
  if(P.sToUs){ vis.copyWithin(0,NX); rowsCur=nrow; for(k=0;k<NX;k++) vis[(NZ-1)*NX+k]=nrow[k]; }
  else       { vis.copyWithin(NX,0,(NZ-1)*NX); rowsCur=nrow; for(k=0;k<NX;k++) vis[k]=nrow[k]; }
  sPts.geometry.attributes.aVis.needsUpdate=true;
}
function buildScene(){
  if(P.scene===3){ camera.up.set(0,1,0); buildFunnel(); return; }
  if(P.scene===2) buildRadar(); else if(P.scene===1) buildSierp(); else buildHill(); }

// ---------- холсты: дождь, надпись, часы ----------
var rc=document.getElementById('rain'), rx=rc.getContext('2d'), drops=[], CS=20, CWr=20, CHr=20;
var tc=document.getElementById('title'), tx=tc.getContext('2d');
var halo=document.getElementById('halo'), hx=halo.getContext('2d');
var mask=document.createElement('canvas'), mx=mask.getContext('2d',{willReadFrequently:true});
var lay=document.createElement('canvas'), lx=lay.getContext('2d');
var T={lines:[],cells:[]};

function layout(){
  var W=innerWidth,H=innerHeight;
  [rc,tc,halo,mask,lay].forEach(function(c){c.width=W;c.height=H;});
  if(P.scene===3 && vGeo) vUniforms();
  renderer.setSize(W,H); camera.aspect=W/H; camera.updateProjectionMatrix();
  if(P.scene===2) fitRadar();
  uniH.px.value=H/1080; uniS.px.value=H/1080; uniR.px.value=H/1080;
  rx.fillStyle='#000'; rx.fillRect(0,0,W,H);
  CS=Math.max(3,Math.round(P.rainSize*H/1080));
  CWr=Math.max(1,Math.round(CS*P.rainGapX/100)); CHr=Math.max(1,Math.round(CS*P.rainGapY/100)); drops=[];
  for(var x=0;x<W;x+=CWr) drops.push({x:x,y:(Math.random()*2-1)*H/CHr,sp:0.5+Math.random()*0.8,ch:rch()});
  buildTitle(W,H);
}

// обои v0.007: надпись строится отдельно от остальной раскладки — чтобы хаб мог менять её текст
// (Zerkalius ⇄ Зеркалиус) без полной перестройки, которая сбрасывала бы дождь. См. window.zerkSetTitle ниже.
function buildTitle(W,H){
  var src=[[P.title,P.t1Size,P.t1Font,P.t1Space],[P.title2,P.t2Size,P.t2Font,P.t2Space],[P.title3,P.t3Size,P.t3Font,P.t3Space]];
  var L=src.filter(function(r){return r[0] && r[0].length;}).map(function(r){ return {text:r[0],k:Math.max(0.1,r[1]/100),fc:fontCss(r[2]),sp:r[3]/100}; });
  if(!L.length) L=[{text:'Zerkalius',k:1,fc:fontCss(0),sp:0}];
  var nl=L.length, probe=200, wmax=1;
  // ширина каждой строки при пробном размере — с её шрифтом, интервалом и размером
  L.forEach(function(l){ mx.font='bold '+probe+'px '+l.fc; mx.letterSpacing=(probe*l.sp)+'px'; wmax=Math.max(wmax,mx.measureText(l.text).width*l.k); });
  var fsBase=Math.min(probe*0.62*W/wmax, H*(nl===1?0.17:nl===2?0.13:0.10)/0.63)*(P.titleSize/100);
  var total=0; L.forEach(function(l){ l.fs=fsBase*l.k; l.ls=l.fs*l.sp; total+=l.fs*1.15; });
  var cy=H*(P.blockY/100), top=cy-total/2, cum=0, tw=0, fsMax=0, fsMin=1e9;
  mx.clearRect(0,0,W,H); mx.fillStyle='#fff'; mx.textAlign='center'; mx.textBaseline='alphabetic';
  L.forEach(function(l){
    l.base=top+cum+l.fs*0.82; cum+=l.fs*1.15;
    l.font='bold '+l.fs+'px '+l.fc;
    mx.font=l.font; mx.letterSpacing=l.ls+'px';
    mx.fillText(l.text,W/2+l.ls/2,l.base);                    // +ls/2: у последней буквы хвост интервала
    tw=Math.max(tw,mx.measureText(l.text).width); fsMax=Math.max(fsMax,l.fs); fsMin=Math.min(fsMin,l.fs);
  });
  mx.letterSpacing='0px';
  var fs=fsMax;
  T={lines:L,fs:fs,W:W,H:H,cy:cy,top:top,bot:top+total,w:tw,ds:Math.max(9,Math.round(fsMin/19)),cells:[]};
  var cw=Math.round(T.ds*0.56)+1, ch=Math.round(T.ds*0.9);
  var x0=W/2-tw/2-10, x1=W/2+tw/2+10, md=mx.getImageData(0,0,W,H).data;
  for(var y=T.top;y<T.bot+fs*0.25;y+=ch) for(var x=x0;x<x1;x+=cw){
    var qx=Math.round(x+cw/2), qy=Math.round(y-T.ds*0.35);
    if(qx>=0&&qx<W&&qy>=0&&qy<H&&md[(qy*W+qx)*4+3]>60) T.cells.push([x,y,rch(),Math.random()]);
  }
  hx.clearRect(0,0,W,H); hx.filter='blur('+Math.round(fs*0.18)+'px)';
  hx.fillStyle='rgba(0,0,0,0.9)'; hx.strokeStyle='rgba(0,0,0,0.9)'; hx.textAlign='center';
  L.forEach(function(l){ hx.font=l.font; hx.letterSpacing=l.ls+'px'; hx.lineWidth=l.fs*0.35;
    hx.strokeText(l.text,W/2+l.ls/2,l.base); hx.fillText(l.text,W/2+l.ls/2,l.base); });
  hx.letterSpacing='0px'; hx.filter='none';
  var ck=document.getElementById('clock');
  ck.style.fontSize=Math.max(8,Math.round(fs*0.28*P.clockSize/100))+'px';
  ck.style.top=(T.bot+fs*0.30*(P.gapTC/100))+'px';
  ck.style.fontFamily=fontCss(P.clockFont); ck.style.letterSpacing=(0.08+P.clockSpace/100)+'em';
}

function drawRain(c){
  var W=rc.width,H=rc.height;
  var fade=0.6*Math.pow((100-P.rainTrail)/100,3);
  if(fade>0.0005){ rx.fillStyle='rgba(0,0,0,'+fade.toFixed(4)+')'; rx.fillRect(0,0,W,H); }
  rx.font=CS+'px Consolas, monospace'; rx.textAlign='left'; rx.textBaseline='top';
  var head=css(mix(c,0.75)), body=css(c,0.9);
  for(var i=0;i<drops.length;i++){
    var d=drops[i], r0=Math.floor(d.y); d.y+=d.sp*(P.rainSpeed/100)*(1+AUD.level*2.5*audK()); var r1=Math.floor(d.y);
    if(r1!==r0){
      rx.fillStyle='#000'; rx.fillRect(d.x,r0*CHr,CWr,CHr); rx.fillStyle=body; rx.fillText(d.ch,d.x,r0*CHr);
      d.ch=rch(); rx.fillStyle=head; rx.fillText(d.ch,d.x,r1*CHr);
    }
    if(r1*CHr>H && Math.random()>0.975) d.y=Math.random()*-20;
  }
}

var glitchT=0;
function drawTitle(c,t){
  var W=T.W,H=T.H; tx.clearRect(0,0,W,H);
  var bt=AUD.beat*audK(), kz=1+bt*0.07;          // надпись чуть дышит на ударе
  var pulse=0.72+0.28*(0.5+0.5*Math.sin(t*2.2))+bt*0.9;
  tx.save(); tx.translate(W/2,T.cy); tx.scale(kz,kz); tx.translate(-W/2,-T.cy);
  lx.globalCompositeOperation='source-over'; lx.clearRect(0,0,W,H);
  lx.drawImage(mask,0,0); lx.globalCompositeOperation='source-in'; lx.fillStyle=css(dim(c,0.16)); lx.fillRect(0,0,W,H);
  lx.globalCompositeOperation='source-over'; lx.font='bold '+T.ds+'px Consolas, monospace';
  lx.textBaseline='alphabetic'; lx.textAlign='left';
  var cols=[css(mix(c,0.85)),css(c),css(dim(c,0.65))];
  for(var i=0;i<T.cells.length;i++){ var e=T.cells[i]; if(Math.random()<0.05) e[2]=rch();
    lx.fillStyle=cols[e[3]<0.12?0:e[3]<0.7?1:2]; lx.fillText(e[2],e[0],e[1]); }
  lx.globalCompositeOperation='destination-in'; lx.drawImage(mask,0,0); lx.globalCompositeOperation='source-over';
  tx.save(); tx.shadowColor=css(c,0.8); tx.shadowBlur=4; tx.drawImage(lay,0,0); tx.restore();
  tx.save(); tx.textAlign='center';
  for(var k=0;k<T.lines.length;k++){
    var l=T.lines[k], lxp=W/2+l.ls/2;
    tx.font=l.font; tx.letterSpacing=l.ls+'px';
    tx.shadowColor=css(c,0.9); tx.shadowBlur=l.fs*0.22*pulse; tx.strokeStyle=css(c,0.8*pulse); tx.lineWidth=Math.max(2,l.fs*0.03);
    tx.strokeText(l.text,lxp,l.base);
    tx.shadowBlur=l.fs*0.05; tx.strokeStyle=css(mix(c,0.8)); tx.lineWidth=Math.max(1.5,l.fs*0.012);
    tx.strokeText(l.text,lxp,l.base);
  }
  tx.letterSpacing='0px';
  tx.restore();
  tx.restore();
  // сбойные полосы: под музыку срываются на ударе, без музыки — изредка сами
  if(P.glitch){
    if(glitchT<=0 && (bt>0.45 ? Math.random()<0.6 : Math.random()<0.012)) glitchT=bt>0.45?4:3;
    if(glitchT>0){ glitchT--;
      for(var g=0;g<3;g++){ var sy=T.top+Math.random()*(T.bot-T.top), sh=3+Math.random()*T.fs*0.06,
        dx=(Math.random()<0.5?-1:1)*(8+Math.random()*T.fs*0.15)*(1+bt*1.5);
        tx.drawImage(tc,0,sy,W,sh,dx,sy,W,sh); } }
  }
}

function updClock(){
  var el=document.getElementById('clock'); el.style.display=P.clock?'block':'none';
  var d=new Date(), p=function(v){return (v<10?'0':'')+v;};
  el.innerHTML=p(d.getHours())+'<span style="visibility:'+(d.getMilliseconds()<500?'visible':'hidden')+'">:</span>'+p(d.getMinutes())+
    '&nbsp;&nbsp;&nbsp;'+d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'});
}
setInterval(updClock,100);

// обои v0.007: хаб меняет надпись сквозь сбой — новый текст и сразу сбойные полосы по надписи.
window.zerkSetTitle=function(t){ if(!t || t===P.title) return; P.title=t; buildTitle(innerWidth,innerHeight); glitchT=4; };
// обои v0.008: хаб зовёт не функцию напрямую, а сообщением. Открытые с диска (file://) хаб и обои для браузера —
// разные сайты, прямой вызов запрещён, и надпись не менялась. Сообщение ходит всегда. «Готово» — только по load:
// до него nastroyka.js ещё не выставил свою надпись и перебил бы ту, что прислал хаб.
window.addEventListener('message',function(e){ var d=e.data; if(d && typeof d.zerkTitle==='string') window.zerkSetTitle(d.zerkTitle); });
if(window.parent!==window) window.addEventListener('load',function(){ try{ window.parent.postMessage({zerkReady:1},'*'); }catch(e){} });

var clk=new THREE.Clock(), acc=0, tt=0;
// обои v0.006: фоном хаба (в iframe) — не чаще 30 кадров в секунду. Хаб и обои с одного сайта и живут в одном
// потоке браузера: рисуя 60 кадров, обои съедали почти весь кадр, и хаб отзывался на мышь с опозданием.
// Открытые сами по себе обои рисуют, как раньше, на каждом кадре.
var EMBED=(window.top!==window), lastDraw=0;
function loop(now){
  if(EMBED && now && now-lastDraw<31){ requestAnimationFrame(loop); return; }
  lastDraw=now||0;
  var dt=Math.min(clk.getDelta(),0.1); tt+=dt; acc+=dt;
  if(P.rainbow) hue=(hue+dt*P.rainbowSpeed)%360;
  var c=curRgb(), col=new THREE.Vector3(c[0]/255,c[1]/255,c[2]/255);
  AUD.beat=Math.max(0,AUD.beat-dt*2.2);
  var ua=AUD.bass*audK(), ub=AUD.beat*audK();
  uniH.uAud.value=ua; uniH.uBeat.value=ub; uniS.uAud.value=ua; uniS.uBeat.value=ub; uniR.uAud.value=ua; uniR.uBeat.value=ub;
  uniH.ucolor.value.copy(col); uniS.ucolor.value.copy(col); uniR.ucolor.value.copy(col);
  if(P.scene===3){
    updFunnel(dt); uniV.ucolor.value.copy(col);
  }else if(P.scene===2){
    uniR.time.value+=dt;
    uniR.uSweep.value=(uniR.uSweep.value+dt*(P.rSpeed/100)*(1+AUD.level*audK()))%6.2831853;
    uniR.uopacity.value=P.rBright/100;
  }else if(P.scene===1){
    uniS.time.value+=dt; uniS.uopacity.value=P.sBright/100;
    var v=P.sSpeed*(1+AUD.level*1.5*audK())*dt;
    off += P.sToUs ? v : -v;
    while(off>=SZ){ off-=SZ; stepRows(); }
    while(off<=-SZ){ off+=SZ; stepRows(); }
    uniS.uOff.value=off;
  }else{
    uniH.time.value+=dt*(P.hSpeed/100);
    uniH.uopacity.value=P.hBright/100; uniH.uCover.value=P.hCover?1:0;
  }
  autoTick(tt);
  renderer.render(scene,camera);
  if(acc>=1/20){ acc=0; drawRain(c); drawTitle(c,tt);
    var el=document.getElementById('clock'); el.style.color=css(mix(c,0.3)); el.style.textShadow='0 0 12px '+css(c,0.9); }
  rc.style.opacity=P.rain/100;
  requestAnimationFrame(loop);
}
window.addEventListener('resize',layout);
if(window.ZERK_FIXED_SCENE!==undefined) P.scene=window.ZERK_FIXED_SCENE;   // отдельные обои — сцена закреплена
applyFilter(); setChars(P.chars); buildAtlas(); buildScene(); layout(); updClock(); loop();


// ---------- готовые наборы (все с радугой) ----------
var PRESETS=[
 {name:'Холм: туман',        vals:{scene:0,rainbow:true,rainbowSpeed:6, hBig:4, hSpeed:40, hBright:80, hCover:true, rain:40,rainSize:14,rainTrail:70,contrast:110,sat:110}},
 {name:'Холм: крупные знаки',vals:{scene:0,rainbow:true,rainbowSpeed:10,hBig:22,hSpeed:60, hBright:110,hCover:true, rain:25,rainSize:26,rainTrail:45,contrast:100,sat:100}},
 {name:'Холм: пыль',         vals:{scene:0,rainbow:true,rainbowSpeed:14,hBig:2, hSpeed:80, hBright:45, hGapX:60,hGapY:60, rain:55,rainSize:10,rainTrail:60,contrast:120,sat:120}},
 {name:'Холм: почти стоит',  vals:{scene:0,rainbow:true,rainbowSpeed:4, hBig:8, hSpeed:15, hBright:90, rain:20,rainSize:18,rainTrail:85,contrast:100,sat:90}},
 {name:'Серпинский: к нам',  vals:{scene:1,rainbow:true,rainbowSpeed:6, sToUs:true, sSpeed:25,sBig:12,sBright:110,sWidth:81, sDepth:120,rain:30,rainSize:16,rainTrail:60}},
 {name:'Серпинский: от нас', vals:{scene:1,rainbow:true,rainbowSpeed:9, sToUs:false,sSpeed:35,sBig:9, sBright:100,sWidth:101,sDepth:150,rain:25,rainSize:14,rainTrail:55}},
 {name:'Серпинский: крупный',vals:{scene:1,rainbow:true,rainbowSpeed:8, sToUs:true, sSpeed:30,sBig:26,sBright:120,sWidth:45, sDepth:90, rain:20,rainSize:22,rainTrail:50}},
 {name:'Радар: спокойный',   vals:{scene:2,rainbow:true,rainbowSpeed:5, rSpeed:35,rTrail:75,rLev:6, rRing:4,rBig:12,rBright:110,rDense:141,rain:20,rainSize:14,rainTrail:70}},
 {name:'Радар: частая сетка',vals:{scene:2,rainbow:true,rainbowSpeed:12,rSpeed:60,rTrail:55,rLev:16,rRing:6,rBig:6, rBright:90, rDense:181,rain:15,rainSize:10,rainTrail:60}},
 {name:'Радар: редкий пульс',vals:{scene:2,rainbow:true,rainbowSpeed:4, rSpeed:20,rTrail:90,rLev:4, rRing:7,rBig:18,rBright:120,rDense:101,rain:12,rainSize:20,rainTrail:80}}
];
window.ZERK_PRESETS=PRESETS;
function applyPreset(i){
  var v=PRESETS[i] && PRESETS[i].vals; if(!v) return;
  for(var k in v){ if(k==='scene' && window.ZERK_FIXED_SCENE!==undefined) continue; BASE[k]=v[k]; applyValue(k,v[k]); }
}

// ---------- настройки из Lively ----------
function applyValue(name,val){
  switch(name){
    case 'scene':  if(window.ZERK_FIXED_SCENE!==undefined) break; P.scene=val; buildScene(); break;
    case 'title':  P.title=val; layout(); break;
    case 'title2': P.title2=val; layout(); break;
    case 'title3': P.title3=val; layout(); break;
    case 't1Size': case 't2Size': case 't3Size': case 't1Font': case 't2Font': case 't3Font':
    case 't1Space': case 't2Space': case 't3Space': P[name]=val; layout(); break;
    case 'clockFont': case 'clockSpace': P[name]=val; layout(); break;
    case 'chars':  P.chars=val; setChars(val); buildAtlas(); layout(); break;
    case 'color':  P.color=val; break;
    case 'rainbow':P.rainbow=val; break;
    case 'rainbowSpeed': P.rainbowSpeed=val; break;
    case 'contrast': P.contrast=val; applyFilter(); break;
    case 'sat':      P.sat=val; applyFilter(); break;
    case 'clock':  P.clock=val; updClock(); break;
    case 'blockY': P.blockY=val; layout(); break;
    case 'gapTC': P.gapTC=val; layout(); break;
    case 'titleSize': P.titleSize=Math.max(10,val); layout(); break;
    case 'clockSize': P.clockSize=Math.max(10,val); layout(); break;
    case 'glitch': P.glitch=val; break;
    case 'music':  P.music=val; break;
    case 'musicPower': P.musicPower=val; break;
    case 'rain':   P.rain=val; break;
    case 'rainSpeed': P.rainSpeed=val; break;
    case 'rainSize': P.rainSize=Math.max(3,val); layout(); break;
    case 'rainTrail': P.rainTrail=val; break;
    case 'rainGapX': P.rainGapX=Math.max(1,val); layout(); break;
    case 'rainGapY': P.rainGapY=Math.max(1,val); layout(); break;
    // холм
    case 'hBright': P.hBright=val; break;
    case 'hBig':    P.hBig=Math.max(0.2,val/10); if(P.scene===0) buildHill(); break;
    case 'hSpeed':  P.hSpeed=val; break;
    case 'hCover':  P.hCover=val; break;
    case 'hGapX':   P.hGapX=Math.max(2,val); if(P.scene===0) buildHill(); break;
    case 'hGapY':   P.hGapY=Math.max(2,val); if(P.scene===0) buildHill(); break;
    // радар
    case 'rSpeed':  P.rSpeed=val; break;
    case 'rCY':     P.rCY=val; if(P.scene===2) fitRadar(); break;
    case 'rSpan':   P.rSpan=val; if(P.scene===2) fitRadar(); break;
    case 'rLev':    P.rLev=val; uniR.uLev.value=val; break;
    case 'rRing':   P.rRing=val; uniR.uRing.value=val; break;
    case 'rBig':    P.rBig=Math.max(0.2,val/10); uniR.big.value=P.rBig; break;
    case 'rBright': P.rBright=val; break;
    case 'rTrail':  P.rTrail=val; uniR.uTrail.value=0.3+(100-val)/100*4.0; break;
    case 'rDense':  P.rDense=val; if(P.scene===2) buildRadar(); break;
    // воронка
    case 'vSpeed':  P.vSpeed=val; break;
    case 'vCY':     P.vCY=val; if(P.scene===3) vUniforms(); break;
    case 'vHole':   P.vHole=val; if(P.scene===3) vUniforms(); break;
    case 'vSize':   P.vSize=val; if(P.scene===3) vUniforms(); break;
    case 'vStep':   P.vStep=val; if(P.scene===3) vUniforms(); break;
    case 'vGap':    P.vGap=val; if(P.scene===3) vUniforms(); break;
    case 'vTwist':  P.vTwist=val; if(P.scene===3) vUniforms(); break;
    case 'vBright': P.vBright=val; break;
    case 'vRot':    P.vRot=val; if(P.scene===3) vUniforms(); break;
    case 'vOut':    P.vOut=val; break;
    // Серпинский
    case 'sBright': P.sBright=val; break;
    case 'sBig':    P.sBig=Math.max(0.2,val/10); uniS.big.value=P.sBig; break;
    case 'sSpeed':  P.sSpeed=val; break;
    case 'sToUs':   P.sToUs=val; break;
    case 'sWidth':  P.sWidth=val; if(P.scene===1) buildSierp(); break;
    case 'sDepth':  P.sDepth=val; if(P.scene===1) buildSierp(); break;
  }
}

function livelyPropertyListener(name,val){
  if(name==='preset'){ P.preset=val; if(val>0){ var ids=window.ZERK_PRESET_IDS; applyPreset(ids?ids[val-1]:val-1); } return; }
  if(name==='autoAmp'){ P.autoAmp=val; return; }
  if(name.indexOf('auto_')===0){                      // галочка «авто» у ползунка
    var n=name.slice(5); P.auto[n]=!!val;
    if(val && !(n in BASE)) BASE[n]=baseOf(n);
    if(!val && (n in BASE)) applyValue(n,BASE[n]);    // вернуть на место
    return;
  }
  if(typeof val==='number') BASE[name]=val;
  applyValue(name,val);
}
function baseOf(n){
  var p=(window.LIVELY_PROPS||{})[n];
  return (n in BASE) ? BASE[n] : (p? p.value : 0);
}
// плавное гуляние включённых ползунков
function autoTick(t){
  var amp=P.autoAmp/100; if(amp<=0) return;
  for(var i=0;i<AUTO_OK.length;i++){
    var n=AUTO_OK[i]; if(!P.auto[n]) continue;
    var p=(window.LIVELY_PROPS||{})[n]; if(!p||p.type!=='slider') continue;
    var b=baseOf(n);
    if(!AUTOPH[n]) AUTOPH[n]={ph:Math.random()*6.28, w:0.15+Math.random()*0.35};
    var a=Math.max(1,Math.abs(b)*amp);
    var v=Math.round(b + Math.sin(t*AUTOPH[n].w+AUTOPH[n].ph)*a);
    v=Math.max(p.min,Math.min(p.max,v));
    applyValue(n,v);
  }
}
