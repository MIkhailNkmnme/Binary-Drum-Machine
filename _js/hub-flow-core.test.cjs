const test=require('node:test');
const assert=require('node:assert/strict');
const {Field,WaterField}=require('./hub-flow-core.js');
const sum=a=>a.reduce((a,b)=>a+b,0);
test('light reflects upward from a horizontal surface without tunnelling',()=>{
  const f=new Field(40,40);for(let x=0;x<40;x++)f.solid[20*40+x]=1;
  const ray={x:20.5,y:5,vx:0,vy:1};const path=f.advanceRay(ray,25);
  assert.equal(ray.bounces,1);assert.ok(ray.vy<-.99);assert.ok(ray.y<20);
  assert.ok(path.every(([x,y])=>!f.blocked(x,y)));
});
test('a diagonal wall turns vertical light sideways',()=>{
  const f=new Field(50,50);for(let y=0;y<50;y++)for(let x=0;x<50;x++)if(y>=x)f.solid[y*50+x]=1;
  const ray={x:25.5,y:10,vx:0,vy:1};f.advanceRay(ray,24);
  assert.ok(ray.bounces>=1);assert.ok(ray.vx>.85);assert.ok(!f.blocked(ray.x,ray.y));
});
test('water is conserved in a cup and accumulates from its bottom',()=>{
  const f=new Field(24,26);
  for(let y=4;y<=22;y++)f.solid[y*24+4]=f.solid[y*24+19]=1;
  for(let x=4;x<=19;x++)f.solid[22*24+x]=1;
  let added=0;for(let t=0;t<250;t++){if(t<80)added+=f.addWater(12,5);f.stepWater();}
  assert.ok(Math.abs(sum(f.water)-added)<1e-3);assert.equal(f.drained,0);
  assert.ok(f.water[21*24+12]>.99);assert.ok(sum(f.water.slice(5*24,10*24))<.001);
  assert.ok(f.water.every((m,i)=>m>=0&&m<=1.00001&&(!f.solid[i]||m===0)));
});
test('water flows around a barrier and drains; open cups overflow',()=>{
  const f=new Field(24,26);
  for(let x=7;x<=16;x++)f.solid[12*24+x]=1;
  let added=0;for(let t=0;t<350;t++){if(t<100)added+=f.addWater(12,5);f.stepWater();}
  assert.ok(f.drained>50);assert.ok(Math.abs(sum(f.water)+f.drained-added)<.001);
  const cup=new Field(24,26);
  for(let y=14;y<=18;y++)cup.solid[y*24+9]=cup.solid[y*24+14]=1;
  for(let x=9;x<=14;x++)cup.solid[18*24+x]=1;
  for(let t=0;t<250;t++){cup.addWater(12,5);cup.stepWater();}
  assert.ok(cup.drained>50);assert.ok(cup.water[17*24+12]>.99);
});
test('water cannot cross sealed diagonal corners; moving masks displace it',()=>{
  const f=new Field(12,12);const i=6*12+6;f.solid[i+1]=f.solid[i-1]=f.solid[i+12]=1;
  f.addWater(6,6);f.stepWater();assert.equal(f.water[i],1);
  const mask=f.solid.slice();mask[i]=1;f.setMask(mask);
  assert.equal(f.water[i],0);assert.equal(f.water[i-12],1);assert.equal(sum(f.water),1);
});

test('liquid levels across a wide trough instead of building a local mound',()=>{
  const f=new WaterField(100,40);
  for(let y=3;y<=35;y++)f.solid[y*100+5]=f.solid[y*100+94]=1;
  for(let x=5;x<=94;x++)f.solid[35*100+x]=1;
  let added=0;for(let t=0;t<130;t++){added+=f.addWater(12,10);f.stepWater();}
  for(let t=0;t<50;t++)f.stepWater();
  const surface=Array.from(f.water.slice(33*100+6,33*100+94));
  assert.ok(surface[0]>0);assert.ok(Math.max(...surface)-Math.min(...surface)<1e-6);
  assert.ok(Math.abs(sum(f.water)-added)<.001);assert.equal(f.drained,0);
});

test('level liquid drains through a new floor opening and conserves its mass',()=>{
  const f=new WaterField(40,40);
  for(let y=5;y<=25;y++)f.solid[y*40+5]=f.solid[y*40+34]=1;
  for(let x=5;x<=34;x++)f.solid[25*40+x]=1;
  for(let x=6;x<34;x++)f.addWater(x,24);
  f.stepWater();const mask=f.solid.slice();mask[25*40+20]=0;f.setMask(mask);
  for(let t=0;t<200;t++)f.stepWater();
  assert.ok(f.drained>27.9);assert.ok(Math.abs(f.drained+sum(f.water)-28)<.001);
  assert.ok(f.water.every((m,i)=>m>=0&&m<=1.00001&&(!f.solid[i]||m===0)));
});

test('liquid spills over the rim but cannot equalize across a solid divider',()=>{
  const f=new WaterField(40,40);
  for(let y=16;y<=22;y++)for(const x of [5,19,34])f.solid[y*40+x]=1;
  for(let x=5;x<=34;x++)f.solid[22*40+x]=1;
  for(let x=6;x<19;x++)f.addWater(x,21);
  for(let t=0;t<20;t++)f.stepWater();
  assert.equal(sum(f.water.slice(21*40+20,21*40+34)),0);
  let added=13;for(let t=0;t<350;t++){added+=f.addWater(10,5);f.stepWater();}
  assert.ok(f.drained>40);assert.ok(Math.abs(f.drained+sum(f.water)-added)<.002);
});

test('liquid descends diagonally beside a ledge but never crosses sealed corners',()=>{
  const f=new WaterField(12,12),i=5*12+6;f.solid[i+12]=1;f.addWater(6,5);f.stepWater();
  assert.equal(f.water[i],0);assert.equal(sum(f.water.slice(6*12,7*12)),1);assert.equal(sum(f.water.slice(0,5*12)),0);
  const sealed=new WaterField(12,12);sealed.solid[i+12]=sealed.solid[i-1]=sealed.solid[i+1]=1;sealed.addWater(6,5);sealed.stepWater();
  assert.equal(sealed.water[i],1);assert.equal(sum(sealed.water.slice(6*12)),0);
});

test('moving obstacles displace liquid only sideways or down; a closed pocket does not lift it',()=>{
  for(const closed of [false,true]){
    const f=new WaterField(12,12),i=5*12+6;f.addWater(6,5);const mask=f.solid.slice();mask[i]=1;
    if(closed)for(const offset of [-1,1,11,12,13])mask[i+offset]=1;
    f.setMask(mask);
    assert.equal(sum(f.water.slice(0,5*12)),0);assert.equal(f.water[i],0);
    assert.ok(Math.abs(sum(f.water)+f.drained-1)<1e-6);
    if(closed)assert.equal(f.drained,1);else assert.equal(f.water[i+12],1);
  }
});

test('each reflection halves light only after the contact, including multiple bounces in one step',()=>{
  const f=new Field(40,40);for(let x=0;x<40;x++){f.solid[10*40+x]=1;f.solid[30*40+x]=1;}
  const ray={x:20.5,y:20,vx:0,vy:1};const path=f.advanceRay(ray,42);
  assert.equal(ray.bounces,2);
  assert.deepEqual([...new Set(path.map(p=>p[2]))],[1,.5,.25]);
  for(let i=1;i<path.length;i++)if(path[i][2]!==path[i-1][2])assert.deepEqual(path[i].slice(0,2),path[i-1].slice(0,2));
  assert.equal(f.advanceRay(ray,1)[0][2],.25);
});

test('zero transmits downward and reflects upward; one does the reverse, with no transmission loss',()=>{
  for(const [type,pass] of [[1,1],[2,-1]])for(const vy of [-1,1]){
    const f=new Field(40,40);f.lightTypes=new Uint8Array(1600);
    for(let x=0;x<40;x++){f.solid[20*40+x]=1;f.lightTypes[20*40+x]=type;}
    const ray={x:20.5,y:vy>0?10:30,vx:0,vy};const path=f.advanceRay(ray,18);
    if(vy===pass){assert.equal(ray.bounces,undefined);assert.equal(ray.vy,vy);assert.ok(vy>0?ray.y>20:ray.y<20);assert.ok(path.every(p=>p[2]===1));}
    else{assert.equal(ray.bounces,1);assert.equal(Math.sign(ray.vy),-vy);assert.equal(path.at(-1)[2],.5);}
    assert.equal(f.addWater(20,20),0,'water still sees the solid bit');
  }
});
test('a transmissive bit does not kill light starting inside; mixed overlaps reflect in both directions',()=>{
  const f=new Field(40,40);f.lightTypes=new Uint8Array(1600);
  for(let y=18;y<=22;y++)for(let x=0;x<40;x++){f.solid[y*40+x]=1;f.lightTypes[y*40+x]=1;}
  const ray={x:20.5,y:20,vx:0,vy:1};f.advanceRay(ray,5);assert.ok(!ray.dead);assert.ok(ray.y>22);
  for(const vy of [-1,1]){f.lightTypes.fill(3);const r={x:20.5,y:vy>0?10:30,vx:0,vy};f.advanceRay(r,15);assert.equal(r.bounces,1);assert.equal(Math.sign(r.vy),-vy);}
});

test('dense water source fills every top pixel and descends as a continuous sheet',()=>{
  const f=new WaterField(24,20);let added=f.fillTop();
  for(let t=0;t<8;t++){f.stepWater();added+=f.fillTop();}
  for(let y=0;y<=8;y++)for(let x=0;x<24;x++)assert.equal(f.water[y*24+x],1);
  assert.equal(sum(f.water.slice(9*24)),0,'no instantaneous fill ahead of the front');
  assert.equal(sum(f.water)+f.drained,added);
  for(let t=0;t<30;t++)f.stepWater();assert.equal(sum(f.water),0);assert.equal(f.drained,added);
});
test('dense source never injects through a blocked inlet and never overfills',()=>{
  const f=new WaterField(12,12);f.solid[4]=1;
  assert.equal(f.fillTop(),11);assert.equal(f.fillTop(),0);assert.equal(f.water[4],0);
  f.stepWater();f.fillTop();assert.equal(f.water[4],0);assert.ok(f.water.every(m=>m<=1));
});
test('continuous light covers every inlet and preserves directional reflection and half brightness',()=>{
  const f=new Field(24,30);let beams=f.topBeams();
  assert.equal(beams.length,24);assert.ok(beams.every(b=>b.start===0&&b.a[1]===0&&b.b[1]>29&&b.alpha===1));
  f.lightTypes=new Uint8Array(720);
  for(let x=0;x<24;x++){f.solid[15*24+x]=1;f.lightTypes[15*24+x]=x<12?1:2;}
  beams=f.topBeams();
  for(let x=0;x<12;x++)assert.ok(beams.some(b=>b.a[0]===x+.5&&b.b[1]>29&&b.alpha===1));
  const reflected=beams.filter(b=>b.alpha===.5);assert.ok(reflected.length>=10);
  assert.ok(reflected.every(b=>b.start>0&&b.b[1]<b.a[1]));
});

test('water corner mode follows checkerboard gaps downward without entering solid pixels',()=>{
 const f=new WaterField(14,14);
 for(let y=0;y<14;y++)for(let x=0;x<14;x++)f.solid[y*14+x]=(x+y)%2;
 f.addWater(6,2);f.stepWater();assert.equal(f.water[2*14+6],1,'closed corner holds the drop');
 f.cornerPass=true;f.stepWater();
 assert.equal(sum(f.water.slice(0,3*14)),0);assert.equal(sum(f.water.slice(3*14,4*14)),1);
 for(let t=0;t<20;t++)f.stepWater();
 assert.equal(sum(f.water),0);assert.equal(f.drained,1);
 assert.ok(f.water.every((m,i)=>!f.solid[i]||m===0));
});
test('corner mode can displace a moving-wall drop diagonally but never upwards',()=>{
 const f=new WaterField(12,12),i=5*12+6;f.cornerPass=true;f.addWater(6,5);
 const mask=f.solid.slice();for(const off of [0,-1,1,12])mask[i+off]=1;
 f.setMask(mask);assert.equal(sum(f.water.slice(0,6*12)),0);assert.equal(sum(f.water.slice(6*12,7*12)),1);assert.equal(f.drained,0);
});


test('each optical side can transmit, reflect or absorb independently for either bit',()=>{
 for(const bit of [0,1])for(const vy of [-1,1])for(const pass of [0,1,2,3])for(const reflect of [0,1,2,3]){
  const f=new Field(20,30);f.lightTypes=new Uint8Array(600);for(let x=0;x<20;x++){f.solid[15*20+x]=1;f.lightTypes[15*20+x]=1<<bit;}
  f.lightRules=[{pass:0,reflect:0},{pass:0,reflect:0}];f.lightRules[bit]={pass,reflect};f.reflectionLoss=false;
  const ray={x:10.5,y:vy>0?10:20,vx:0,vy},forks=[];f.advanceRay(ray,8,forks);
  const side=vy>0?1:2,p=!!(pass&side),r=!!(reflect&side);
  assert.equal(forks.length,p&&r?1:0);assert.equal(ray.bounces||0,r?1:0);
  if(!p&&!r)assert.equal(ray.dead,true);
  if(p&&!r){assert.equal(ray.dead,undefined);assert.equal(ray.vy,vy);}
  if(r)assert.equal(ray.vy,-vy);
 }
});
test('split light halves both branches, applies optional loss only to reflection and passes a thick bit once',()=>{
 for(const loss of [true,false]){
  const f=new Field(30,40);f.lightTypes=new Uint8Array(1200);f.lightRules=[{pass:3,reflect:3},{pass:3,reflect:3}];f.reflectionLoss=loss;
  for(let y=15;y<20;y++)for(let x=0;x<30;x++){f.solid[y*30+x]=1;f.lightTypes[y*30+x]=1;}
  const ray={x:15.5,y:10,vx:0,vy:1},forks=[];f.advanceRay(ray,14,forks);
  assert.equal(forks.length,1);assert.equal(ray.intensity,loss?.25:.5);
  const child=forks[0].ray,more=[];f.advanceRay(child,forks[0].remaining,more);
  assert.equal(more.length,0);assert.ok(child.y>20);assert.equal(child.intensity,.5);
  const beams=f.topBeams();assert.ok(beams.some(s=>s.alpha===.5&&s.b[1]>20));assert.ok(beams.some(s=>s.alpha===(loss?.25:.5)&&s.b[1]<s.a[1]));
 }
});

test('v0.405: a narrow shaft and the side channels joined to it fill to one level (communicating vessels)',()=>{
  const w=41,h=60,c=20,f=new WaterField(w,h);
  for(let y=10;y<55;y++)for(let x=0;x<w;x++)f.solid[y*w+x]=1;
  for(let y=10;y<=40;y++)f.solid[y*w+c]=0;
  for(let k=0;k<=15;k++){const y=40-k;for(const x of [c-k,c-k-1,c+k,c+k+1])f.solid[y*w+x]=0;}
  let added=0;for(let t=0;t<1500;t++){if(t%5===0)added+=f.addWater(c,0,1);f.stepWater();}
  const level=x=>{for(let y=0;y<h;y++)if(f.water[y*w+x]>.5)return y;return h;};
  assert.ok(level(c-10)<=31,'left channel filled');assert.ok(level(c+10)<=31,'right channel filled');
  assert.ok(Math.abs(f.drained+sum(f.water)-added)<.002);
});

test('v0.407: the level climbs through a checkerboard corner only when corners-up is on',()=>{
  const run=up=>{const w=20,h=20,f=new WaterField(w,h);f.cornerUp=up;
    for(let y=5;y<15;y++)for(let x=0;x<w;x++)f.solid[y*w+x]=1;
    for(let y=10;y<14;y++)for(const x of [9,10])f.solid[y*w+x]=0;   // pool
    for(let y=5;y<10;y++)f.solid[y*w+9]=0;   // inlet straight above the pool
    for(let y=6;y<10;y++)f.solid[y*w+11]=0;   // side shaft, joined to the pool only by the corner (10,10)-(11,9)
    let added=0;for(let t=0;t<200;t++){if(t<12)added+=f.addWater(9,0,1);f.stepWater();}
    let side=0;for(let y=6;y<10;y++)side+=f.water[y*w+11];
    assert.ok(Math.abs(f.drained+f.water.reduce((a,b)=>a+b,0)-added)<.002);return side;};
  assert.equal(run(false),0);assert.ok(run(true)>0);
});
