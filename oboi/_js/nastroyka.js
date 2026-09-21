// Настройки обоев для фона хаба (index.html). Обои те же, что «Zerkalius Серпинский» из _lively,
// здесь только выбраны значения: радуга, «застывший» разноцветный дождь, без часов и музыки.
(function(){
  var set={
    title:'Zerkalius', blockY:24, titleSize:105,          // 24% и чуть мельче — верх букв не обрезается и в низком окне
    clock:false, music:false, glitch:true,
    rainbow:true, rainbowSpeed:10,
    rain:60, rainSize:20, rainTrail:100, rainSpeed:70,
    sSpeed:28, sBright:110, sBig:11
  };
  for(var k in set) livelyPropertyListener(k,set[k]);
})();
