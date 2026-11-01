/* Isolated handbook examples; these never change the working Mayatnik. */
(() => {
  'use strict';
  const bits={left:1,current:0,right:1};
  const colours=['#000000','#0000ff','#00ff00','#00ffff','#ff0000','#ff00ff','#ffff00','#ffffff'];
  const names=['чёрный','синий','зелёный','голубой','красный','пурпурный','жёлтый','белый'];
  const labels={left:'Слева · G',current:'Ячейка · R',right:'Справа · B'};
  function rgb(){
    const code=(bits.current<<2)|(bits.left<<1)|bits.right;
    for(const button of document.querySelectorAll('[data-rgb-bit]')){const key=button.dataset.rgbBit;button.setAttribute('aria-pressed',String(!!bits[key]));button.textContent=labels[key]+' = '+bits[key];}
    document.getElementById('rgbDemoColour').style.backgroundColor=colours[code];
    document.getElementById('rgbDemoValue').textContent=''+bits.left+bits.current+bits.right+' → RGB '+code.toString(2).padStart(3,'0')+' → '+names[code];
  }
  for(const button of document.querySelectorAll('[data-rgb-bit]'))button.addEventListener('click',()=>{const key=button.dataset.rgbBit;bits[key]^=1;rgb();});
  const rows=document.getElementById('edgeRowsDemo');
  function widths(){const n=Number(rows.value),out=document.getElementById('edgeWidthsDemo');if(!Number.isInteger(n)||n<8||n>4096){out.textContent='Введите целое число строк от 8 до 4096.';return;}out.textContent=[2,4,6,8].map(m=>m+'N−1 = '+(m*n-1)).join(' · ');}
  rows?.addEventListener('input',widths);
  if(document.getElementById('rgbDemo'))rgb();if(rows)widths();
  document.getElementById('printGuide')?.addEventListener('click',()=>window.print());
})();
