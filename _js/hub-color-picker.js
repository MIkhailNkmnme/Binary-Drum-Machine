/* Shared Hub color and opacity editor. */
(()=>{
 'use strict';let box,active,h=0,s=1,v=1;
 const clamp=x=>Math.max(0,Math.min(1,x));
 // Inverse of the square's 45 degree rotation, using its diamond bounding box.
 const diamondPoint=(x,y)=>({s:clamp(x+y-.5),v:clamp(.5+x-y)});
 if(typeof module!=='undefined'&&module.exports){module.exports={diamondPoint};return;}
 function rgb(){const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;return (h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x]).map(n=>Math.round((n+m)*255));}
 const hex=()=> '#'+rgb().map(n=>n.toString(16).padStart(2,'0')).join('');
 function fromHex(color){const [r,g,b]=color.slice(1).match(/../g).map(n=>parseInt(n,16)/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;v=max;s=max?d/max:0;if(d)h=((max===r?(g-b)/d:max===g?(b-r)/d+2:(r-g)/d+4)*60+360)%360;}
 function init(){
  box=document.createElement('section');box.className='hubColorEditor';box.hidden=true;box.setAttribute('role','dialog');box.setAttribute('aria-label','Цвет и прозрачность');
  box.innerHTML='<header><b></b><button type="button" aria-label="Закрыть цвет и прозрачность">×</button></header><div class="hubColorDiamond"><div class="hubColorSV" tabindex="0" role="slider" aria-label="Насыщенность и яркость"><i></i></div><input class="hue" type="range" min="0" max="360" step="1" aria-label="Цветовой тон" title="Тон — по горизонтали"><input class="alpha" type="range" min="0" max="100" step="1" aria-label="Непрозрачность цвета" aria-orientation="vertical" title="Непрозрачность — по вертикали"></div><div class="hubColorRow"><span class="preview"><i></i></span><input class="hex" aria-label="Цвет HEX" maxlength="7" spellcheck="false"></div><small>Непрозрачность <output></output></small>';
  document.body.append(box);const sv=box.querySelector('.hubColorSV'),hue=box.querySelector('.hue'),alpha=box.querySelector('.alpha'),text=box.querySelector('.hex');
  const apply=()=>{active.color=hex();active.opacity=Number(alpha.value)/100;sync();active.onChange(active.color,active.opacity);};
  function point(e){const r=sv.getBoundingClientRect();({s,v}=diamondPoint((e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height));apply();}
  sv.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();sv.setPointerCapture(e.pointerId);point(e);};
  sv.onpointermove=e=>{if(sv.hasPointerCapture(e.pointerId))point(e);};
  sv.onpointerup=sv.onpointercancel=e=>{if(sv.hasPointerCapture(e.pointerId))sv.releasePointerCapture(e.pointerId);};
  sv.onkeydown=e=>{const step=e.shiftKey?.1:.01;if(e.key==='ArrowLeft')s=clamp(s-step);else if(e.key==='ArrowRight')s=clamp(s+step);else if(e.key==='ArrowUp')v=clamp(v+step);else if(e.key==='ArrowDown')v=clamp(v-step);else return;e.preventDefault();apply();};
  hue.oninput=()=>{h=Number(hue.value);apply();};alpha.oninput=apply;
  text.oninput=()=>{if(/^#[0-9a-f]{6}$/i.test(text.value)){fromHex(text.value);apply();}};text.onchange=()=>{text.value=active.color;};
  box.querySelector('button').onclick=close;
  document.addEventListener('pointerdown',e=>{if(!box.hidden&&!box.contains(e.target)&&e.target!==active.trigger)close();},true);
  document.addEventListener('keydown',e=>{if(!box.hidden&&e.key==='Escape')close();});
 }
 // Hub v0.249: подпись вдоль края ромба — коротко, полное имя — в подсказке
 const SHORT={'Цвет битов оригинала':'Биты','Цвет нулей оригинала':'Нули','Цвет отражённых битов':'Отражение','Цвет заворота':'Заворот','Цвет подсветки симметрии по оси':'Симметрия'};
 function sync(){const hb=box.querySelector('header b');hb.textContent=SHORT[active.title]||String(active.title||'').replace(/^Цвет /,'');hb.title=active.title||'';box.querySelector('small').title=(active.title||'')+' — непрозрачность';box.querySelector('.hubColorSV').style.background=`linear-gradient(0deg,#000,transparent),linear-gradient(90deg,#fff,transparent),hsl(${h} 100% 50%)`;Object.assign(box.querySelector('.hubColorSV i').style,{left:(s*100)+'%',top:((1-v)*100)+'%'});box.querySelector('.hubColorSV').setAttribute('aria-valuetext',`Насыщенность ${Math.round(s*100)}%, яркость ${Math.round(v*100)}%`);box.querySelector('.hue').value=h;box.querySelector('.alpha').max=active.maxOpacity*100;box.querySelector('.alpha').value=Math.round(active.opacity*100);box.querySelector('output').textContent=Math.round(active.opacity*100)+'%';box.querySelector('small').title='Непрозрачность — ползунок по вертикали в ромбе';box.querySelector('.hex').value=active.color;Object.assign(box.querySelector('.preview i').style,{background:active.color,opacity:Math.min(1,active.opacity)});}
 function close(){box.hidden=true;active?.trigger?.focus();}
 window.HubColorPicker={open(options){if(!box)init();active={...options};fromHex(active.color);sync();box.hidden=false;box.querySelector('.hex').focus();}};
})();
