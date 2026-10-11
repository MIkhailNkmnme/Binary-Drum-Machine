/* Codex — независимый исследователь Хоррориуса · 12.10.2026.
   Original Maýatnik colours reconstructed from vertex coverage, without storing a colour matrix. */
'use strict';
function horrorRGB(r,c,bit,vertices,coloured=true){
  const mono=bit?[232,237,245]:[91,100,117];
  if(!coloured||r===0)return mono;
  const lo=-(vertices>>1),hi=(vertices-1)>>1,a=Math.max(lo,c-r),b=Math.min(hi,c+r);
  const first=a+((c+r-a)&1),count=first<=b?((b-first)>>1)+1:0;
  return count%2?mono:(bit?[79,155,255]:[255,90,79]);
}
if(typeof module!=='undefined'&&module.exports)module.exports={horrorRGB};
