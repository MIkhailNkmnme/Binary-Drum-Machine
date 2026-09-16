// Рецепты узоров для Genezis v0.420.
// set: значения контролов по id · click: кнопки по id · gl: рендер через ⚡ WebGL
// run: сколько мс крутить симуляцию (playBtn) перед съёмкой кадра
module.exports = [
 { id:'r01', name:'Кирпичная кладка', note:'Серпинский «Сдвиг», сид 1',
   set:{ sierpRule:'shift', sierpSeed:'1', sierpRows:128, fontSlider:11 }, click:['sierpBtn'], run:0 },

 { id:'r02', name:'Симметричная пирамида', note:'«Центр», сид 1011011',
   set:{ sierpRule:'center', sierpSeed:'1011011', sierpRows:80, fontSlider:11 }, click:['sierpBtn'], run:0 },

 { id:'r03', name:'XorRora Маятник', note:'третья форма генератора, сид 110101',
   set:{ sierpRule:'xorora', sierpSeed:'110101', sierpRows:96, fontSlider:11 }, click:['sierpBtn'], run:0 },

 { id:'r04', name:'Воронка', note:'«Центр» + 🕸️ Режим Воронка',
   set:{ sierpRule:'center', sierpSeed:'1011011', sierpRows:80, fontSlider:12, funnelCheck:true }, click:['sierpBtn'], run:1200 },

 { id:'r05', name:'Барабан', note:'🥁 сетка-барабан, радиус 22',
   set:{ sierpRule:'center', sierpSeed:'10110', sierpRows:72, fontSlider:12, drumModeCheck:true, drumRadius:22 }, click:['sierpBtn'], run:1200 },

 { id:'r06', name:'Радар', note:'кладка, свёрнутая в полярные координаты',
   set:{ sierpRule:'shift', sierpSeed:'1', sierpRows:120, fontSlider:11, radarCheck:true }, click:['sierpBtn'], run:1200 },

 { id:'r07', name:'Радар + воронка', note:'шаг поворота 7',
   set:{ sierpRule:'center', sierpSeed:'1101', sierpRows:100, fontSlider:11, radarCheck:true, funnelCheck:true, radarRotateSnapInput:7 }, click:['sierpBtn'], run:1500 },

 { id:'r08', name:'Шестерёнки', note:'⚙️ Разрядка + трассер 1-го символа',
   set:{ sierpRule:'center', sierpSeed:'1011011', sierpRows:64, fontSlider:12, spacedCheck:true, redFirstOneCheck:true }, click:['sierpBtn'], run:1500 },

 { id:'r09', name:'Встречное движение', note:'↔️ + 🔁 маятник внутри строки',
   set:{ sierpRule:'shift', sierpSeed:'1011', sierpRows:80, fontSlider:12, meetCenterCheck:true, rowPendulumCheck:true }, click:['sierpBtn'], run:2000 },

 { id:'r10', name:'Раскол по центру', note:'🪞 N=1, зеркальная развёртка',
   set:{ sierpRule:'center', sierpSeed:'110101', sierpRows:80, fontSlider:12, splitCenterCheck:true }, click:['sierpBtn'], run:2000 },

 { id:'r11', name:'Шлейф', note:'👣 след + фазовый сдвиг',
   set:{ sierpRule:'shift', sierpSeed:'10011', sierpRows:80, fontSlider:12, trailCheck:true, phaseShiftCheck:true }, click:['sierpBtn'], run:2500 },

 { id:'r12', name:'Рамка-ромб', note:'кадрирование ромбом поверх узора',
   set:{ sierpRule:'center', sierpSeed:'1011011', sierpRows:80, fontSlider:12, frameCheck:true, frameTypeSelect:'rhomb' }, click:['sierpBtn'], run:0 },

 { id:'r13', name:'Synthwave + неон', note:'пресет synthwave, ✨ свечение',
   set:{ sierpRule:'center', sierpSeed:'1011011', sierpRows:80, fontSlider:13, presetSelect:'synthwave', neonCheck:true }, click:['sierpBtn'], run:800 },

 { id:'r14', name:'Призрак движения', note:'кислотный пресет, скрыты НЕменяющиеся символы',
   set:{ sierpRule:'shift', sierpSeed:'1011', sierpRows:90, fontSlider:12, presetSelect:'acid', hideUnchangedCheck:true }, click:['sierpBtn'], run:2500 },

 { id:'r15', name:'Рентген', note:"заполнение пустот 'x' + 🧩 конгломераты",
   set:{ sierpRule:'center', sierpSeed:'110110', sierpRows:72, fontSlider:12, fillXCheck:true, conglomerateCheck:true }, click:['sierpBtn'], run:1200 },

 { id:'r16', name:'CRT-терминал', note:'шрифт VT323, крупный кегль, кровавый пресет',
   set:{ sierpRule:'xorora', sierpSeed:'11011', sierpRows:56, fontSlider:18, fontSelect:"'VT323', monospace", presetSelect:'blood' }, click:['sierpBtn'], run:1500 },

 // --- те же идеи, но на GPU (⚡ WebGL: только движение, без рамки/подсветок) ---
 { id:'g01', name:'GPU · пирамида', note:'«Центр» на WebGL', gl:true,
   set:{ sierpRule:'center', sierpSeed:'1011011', sierpRows:80, fontSlider:11 }, click:['sierpBtn'], run:1500 },

 { id:'g02', name:'GPU · радар', note:'полярная развёртка на WebGL', gl:true,
   set:{ sierpRule:'shift', sierpSeed:'1', sierpRows:120, fontSlider:11, radarCheck:true }, click:['sierpBtn'], run:1500 },

 { id:'g03', name:'GPU · радар-воронка', note:'воронка + шаг поворота 5, WebGL', gl:true,
   set:{ sierpRule:'center', sierpSeed:'1101', sierpRows:100, fontSlider:11, radarCheck:true, funnelCheck:true, radarRotateSnapInput:5 }, click:['sierpBtn'], run:2000 },

 { id:'g04', name:'GPU · synthwave', note:'пресет synthwave на WebGL', gl:true,
   set:{ sierpRule:'center', sierpSeed:'10110', sierpRows:80, fontSlider:13, presetSelect:'synthwave' }, click:['sierpBtn'], run:2000 },
];
