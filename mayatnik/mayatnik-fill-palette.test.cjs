const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Palette=require('./mayatnik-fill-palette.js');
const {JSDOM}=require(process.env.SETKA_JSDOM||'C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
const rect=(left,top,width,height)=>({left,top,right:left+width,bottom:top+height,width,height});
function fixture(value='#ff0000',customBounds=true){
 const dom=new JSDOM('<body><div id="wrap"><canvas></canvas><button>Menu</button></div><input id="colour" type="color"></body>',{runScripts:'outside-only'}),w=dom.window,doc=w.document,wrap=doc.querySelector('#wrap'),canvas=doc.querySelector('canvas'),input=doc.querySelector('input');let active=false;const events=[],paints=[];
 input.value=value;wrap.getBoundingClientRect=()=>rect(0,0,1000,800);canvas.getBoundingClientRect=()=>rect(200,100,600,400);
 for(const type of ['input','change'])input.addEventListener(type,()=>events.push(type+':'+input.value));
 w.eval(fs.readFileSync(__dirname+'/mayatnik-fill-palette.js','utf8'));
 const palette=w.MayatnikFillPalette.mount({wrap,canvas,colourInput:input,isActive:()=>active,paintAt:(x,y,options)=>{events.push('paint:'+input.value);paints.push({x,y,options});},...(customBounds?{bounds:()=>rect(140,60,760,660)}:{})});
 const context=(target=canvas,props={})=>{const e=new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2,clientX:300,clientY:200,...props});target.dispatchEvent(e);return e;};
 wrap.addEventListener('contextmenu',e=>palette.handleContextMenu(e),true);
 return {w,doc,wrap,canvas,input,palette,events,paints,context,active(value){active=value;palette.sync();},close(){palette.destroy();dom.window.close();}};
}

test('HEX/RGB/HSV conversion round-trips colours and hue wraps across red',()=>{
 for(const hex of [...Palette.RAINBOW,'#000000','#ffffff','#a1b2c3','#123456','#7f7f7f']){const hsv=Palette.hexToHsv(hex);assert.equal(Palette.hsvToHex(hsv.h,hsv.s,hsv.v),hex);}
 assert.equal(Palette.hsvToHex(360,100,100),'#ff0000');assert.equal(Palette.hsvToHex(-120,100,100),'#0000ff');assert.equal(Palette.hsvToHex(0,500,-5),'#000000');assert.equal(Palette.normalise(' aBc '),'#aabbcc');assert.equal(Palette.normalise('123456'),'#123456');assert.equal(Palette.normalise('#12nope'),null);assert.equal(Palette.hexToHsv('badcolour'),null);
});

test('rainbow advances in seven fixed steps, wraps, and starts grayscale at red',()=>{
 for(let i=0;i<7;i++)assert.equal(Palette.nextRainbow(Palette.RAINBOW[i]),Palette.RAINBOW[(i+1)%7]);
 assert.equal(Palette.nextRainbow('#ffffff'),'#ff0000');assert.equal(Palette.nextRainbow('#000000'),'#ff0000');assert.equal(Palette.nextRainbow('#ff7f27'),'#ffff00');assert.equal(Palette.nextRainbow('invalid'),'#ff0000');
});

test('palette and pencil exist only in fill mode; manual/external colour changes stay synchronized',()=>{
 const f=fixture();try{const {panel}=f.palette;assert.equal(panel.hidden,true);assert.equal(f.wrap.classList.contains('may-fill-pencil'),false);f.active(true);assert.equal(panel.hidden,false);assert.equal(f.canvas.classList.contains('may-fill-pencil'),true);assert.equal(panel.style.left,'652px');assert.equal(panel.style.top,'432px');assert.equal(panel.querySelectorAll('[data-fill-colour]').length,7);
  f.input.value='#123456';f.input.dispatchEvent(new f.w.Event('input',{bubbles:true}));assert.equal(panel.querySelector('.may-fill-hex').value,'#123456');assert.deepEqual([...panel.querySelectorAll('[data-fill-channel]')].map(n=>n.value),['18','52','86']);
  panel.querySelector('[data-fill-colour="#8b00ff"]').click();assert.equal(f.input.value,'#8b00ff');assert.equal(f.paints.length,0,'choosing colour alone never fills');assert.deepEqual(f.events.slice(-2),['input:#8b00ff','change:#8b00ff']);assert.equal(panel.querySelector('[data-fill-colour="#8b00ff"]').getAttribute('aria-pressed'),'true');
  f.active(false);assert.equal(panel.hidden,true);assert.equal(f.wrap.classList.contains('may-fill-pencil'),false);assert.equal(f.canvas.classList.contains('may-fill-pencil'),false);
 }finally{f.close();}
});

test('field right click advances only fill colour before one forced paint and consumes its event',()=>{
 const f=fixture();try{f.active(true);let downstream=0;f.wrap.addEventListener('contextmenu',()=>downstream++);const e=f.context(f.canvas,{shiftKey:true});assert.equal(e.defaultPrevented,true);assert.equal(downstream,0);assert.equal(f.input.value,'#ff7f00');assert.deepEqual(f.events,['input:#ff7f00','change:#ff7f00','paint:#ff7f00']);assert.equal(f.paints.length,1);assert.equal(f.paints[0].x,300);assert.equal(f.paints[0].y,200);assert.equal(f.paints[0].options.forcePaint,true);assert.equal(f.paints[0].options.shiftKey,true);
  for(let i=0;i<6;i++)f.context();assert.equal(f.input.value,'#ff0000');assert.equal(f.paints.length,7);
 }finally{f.close();}
});

test('right clicks on controls, outside the canvas, with keyboard invocation or fill mode OFF keep their existing actions',()=>{
 const f=fixture();try{f.active(true);for(const [target,props]of [[f.wrap.querySelector('button'),{}],[f.canvas,{clientX:900}],[f.canvas,{button:0}],[f.canvas,{clientY:90}]])assert.equal(f.context(target,props).defaultPrevented,false);f.active(false);assert.equal(f.context().defaultPrevented,false);assert.equal(f.paints.length,0);assert.equal(f.input.value,'#ff0000');assert.deepEqual(f.events,[]);
 }finally{f.close();}
});

test('HEX/RGB edits publish input/change without accepting partial or out of range data',()=>{
 const f=fixture();try{f.active(true);const hex=f.palette.panel.querySelector('.may-fill-hex');hex.focus();hex.value='#12';hex.dispatchEvent(new f.w.Event('input',{bubbles:true}));assert.equal(f.input.value,'#ff0000');assert.equal(hex.getAttribute('aria-invalid'),'true');hex.value='#123456';hex.dispatchEvent(new f.w.Event('input',{bubbles:true}));assert.equal(f.input.value,'#123456');assert.equal(f.events.at(-1),'input:#123456');hex.dispatchEvent(new f.w.Event('change',{bubbles:true}));assert.equal(f.events.at(-1),'change:#123456');
  const channels=[...f.palette.panel.querySelectorAll('[data-fill-channel]')];channels[0].value='256';channels[0].dispatchEvent(new f.w.Event('input'));assert.equal(f.input.value,'#123456');assert.equal(channels[0].getAttribute('aria-invalid'),'true');channels.forEach((n,i)=>n.value=String([3,2,1][i]));channels[0].dispatchEvent(new f.w.Event('change'));assert.equal(f.input.value,'#030201');assert.deepEqual(f.events.slice(-2),['input:#030201','change:#030201']);
 }finally{f.close();}
});

test('SV pointer and keyboard controls and hue work together, including hue selected while white',()=>{
 const f=fixture();try{f.active(true);const sv=f.palette.panel.querySelector('.may-fill-sv'),hue=f.palette.panel.querySelector('.may-fill-hue');sv.getBoundingClientRect=()=>rect(0,0,100,100);const pointer=(type,x,y)=>{const e=new f.w.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});Object.defineProperty(e,'pointerId',{value:7});sv.dispatchEvent(e);};
  pointer('pointerdown',100,50);pointer('pointerup',100,50);assert.equal(f.input.value,'#800000');assert.equal(f.events.at(-1),'change:#800000');pointer('pointerdown',300,-100);pointer('pointermove',100,0);pointer('pointercancel',100,0);assert.equal(f.input.value,'#ff0000');
  const e=new f.w.KeyboardEvent('keydown',{key:'ArrowLeft',shiftKey:true,bubbles:true,cancelable:true});sv.dispatchEvent(e);assert.equal(e.defaultPrevented,true);assert.equal(f.input.value,'#ff1919');
  f.input.value='#ffffff';f.input.dispatchEvent(new f.w.Event('change'));hue.value='240';hue.dispatchEvent(new f.w.Event('input'));assert.equal(f.input.value,'#ffffff');pointer('pointerdown',100,0);pointer('pointerup',100,0);assert.equal(f.input.value,'#0000ff');assert.equal(sv.getAttribute('aria-valuetext'),'Насыщенность 100%, яркость 100%');
 }finally{f.close();}
});

test('placement clamps to visible field, default layout reserves docked menus and header/footer',()=>{
 assert.deepEqual(Palette.placement(rect(10,20,180,200),240,280),{left:18,top:28,width:164,maxHeight:184,visible:true});assert.equal(Palette.placement(rect(0,0,90,300),240,280).visible,false);
 const f=fixture('#ff0000',false);try{for(const [cls,box]of [['may-dock-side',rect(0,50,120,700)],['may-dock-side',rect(880,50,120,700)],['header',rect(0,0,1000,50)],['footer',rect(0,760,1000,40)]]){const n=f.doc.createElement(cls==='header'?'header':'div');if(cls==='footer')n.id='mayBottomBar';else n.className=cls;n.getBoundingClientRect=()=>box;n.getClientRects=()=>[box];f.doc.body.append(n);}f.active(true);assert.equal(f.palette.panel.style.left,'628px');assert.equal(f.palette.panel.style.top,'468px');assert.equal(f.palette.panel.style.width,'240px');
 }finally{f.close();}
});

test('destroy removes palette, cursors and colour listeners and leaves the host field usable',()=>{
 const f=fixture();try{f.active(true);const panel=f.palette.panel;f.palette.destroy();assert.equal(panel.isConnected,false);assert.equal(f.wrap.classList.contains('may-fill-pencil'),false);assert.equal(f.palette.handleContextMenu({button:2}),false);f.input.value='#abcdef';f.input.dispatchEvent(new f.w.Event('input'));assert.equal(panel.querySelector('.may-fill-hex').value,'#ff0000');f.palette.destroy();
 }finally{f.close();}
});
