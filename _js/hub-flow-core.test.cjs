const test=require('node:test');
const assert=require('node:assert/strict');
const {Field}=require('./hub-flow-core.js');
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
