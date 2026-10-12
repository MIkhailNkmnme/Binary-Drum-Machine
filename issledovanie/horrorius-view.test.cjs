/* Codex — независимый исследователь Хоррориуса · 12.10.2026. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const {horrorRGB}=require('./horrorius-view.js'),M=require('../mayatnik/mayatnik-core.js');
test('colour of every tested covered cell equals original page palette and tint',()=>{
 const palette=[[[91,100,117],[79,155,255],[255,90,79]],[[232,237,245],[79,155,255],[255,90,79]]];
 for(let n=1;n<=67;n++)for(let r=0;r<128;r++)for(let c=-r-35;c<=r+35;c++)for(let bit=0;bit<2;bit++){
  const lo=-(n>>1),hi=(n-1)>>1;
  assert.deepEqual(horrorRGB(r,c,bit,n),palette[bit][M.tint(r,c,bit,lo,hi,false)]);
 }
});
