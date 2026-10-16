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
