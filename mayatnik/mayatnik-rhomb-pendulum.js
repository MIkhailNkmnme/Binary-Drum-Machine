(() => {
  "use strict";

  const STORAGE_KEY = "zerk_mayatnik_rhomb_depth";
  const MARGIN = 4;
  const INTERVAL = 115;
  const COLORS = [[22, 78, 101, 255], [225, 242, 236, 255]];
  const canvas = document.getElementById("romb-field");
  const frameLabel = document.getElementById("romb-frame");
  const context = canvas.getContext("2d");
  if (!context) {
    document.getElementById("romb-controls").disabled = true;
    frameLabel.textContent = "Браузер не смог создать холст для битового поля.";
    return;
  }

  const size = document.getElementById("romb-depth");
  const play = document.getElementById("romb-play");
  const playIcon = document.getElementById("romb-play-icon");
  let depth, geometry, field, pixels, frame;
  let timer = null;

  function reset() {
    depth = Number(size.value);
    geometry = MAYATNIK.geometry("pend", depth, depth);
    field = MAYATNIK.field(geometry.W, depth * 2, "empty");
    canvas.width = field.W + 2 * MARGIN;
    canvas.height = field.H + 2 * MARGIN;
    pixels = context.createImageData(field.W, field.H);
    frame = 0;
    step();
  }

  function pass(center) {
    MAYATNIK.cone(field, center, depth);
    const { W, val } = field;

    // The lower half starts with a seam row at the same width and parity.
    for (let c = center - depth + 1; c < center + depth; c += 2) {
      const i = depth * W + c;
      val[i] = (val[i] === 1) ^ (val[i - W] === 1);
    }

    // If an expanding row is made of adjacent XORs, its left prefixes
    // recover the shorter row. Accumulate each recovered bit in place.
    for (let r = depth + 1; r < field.H; r++) {
      const radius = field.H - 1 - r;
      let prefix = 0;
      for (let c = center - radius; c <= center + radius; c += 2) {
        const i = r * W + c;
        prefix ^= val[i - W - 1] === 1;
        val[i] = (val[i] === 1) ^ prefix;
      }
    }
  }

  function draw(center, shift) {
    const { val } = field;
    const rgba = pixels.data;
    for (let i = 0; i < val.length; i++) {
      if (val[i] >= 0) rgba.set(COLORS[val[i]], 4 * i);
    }
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.putImageData(pixels, MARGIN, MARGIN);

    const x = MARGIN + center + 0.5;
    const radius = depth + 1;
    context.beginPath();
    context.moveTo(x, MARGIN - 2);
    context.lineTo(x + radius, MARGIN + depth);
    context.lineTo(x, MARGIN + field.H + 2);
    context.lineTo(x - radius, MARGIN + depth);
    context.closePath();
    context.lineJoin = "round";
    context.lineWidth = 1.25;
    context.strokeStyle = shift <= 0 ? "#e9bd74" : "#bfa7f3";
    context.stroke();

    const signed = shift > 0 ? `+${shift}` : String(shift).replace("-", "−");
    frameLabel.textContent = `Кадр ${frame} / ${depth} · сдвиг ${signed} · ${field.H} строк · до ${depth} бит в ряду`;
  }

  function step() {
    if (frame === depth) {
      field.val.fill(-1);
      pixels.data.fill(0);
      frame = 0;
    }
    const shift = MAYATNIK.offset("pend", frame);
    const center = geometry.anchor + shift;
    pass(center);
    frame++;
    draw(center, shift);
  }

  function setPlaying(playing) {
    clearInterval(timer);
    timer = playing ? setInterval(step, INTERVAL) : null;
    play.setAttribute("aria-pressed", String(playing));
    playIcon.textContent = playing ? "⏸" : "▶";
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (Array.from(size.options).some(option => option.value === saved)) size.value = saved;
  } catch { /* The default size works without storage. */ }

  play.addEventListener("click", () => setPlaying(timer === null));
  document.getElementById("romb-step").addEventListener("click", () => {
    setPlaying(false);
    step();
  });
  document.getElementById("romb-reset").addEventListener("click", () => {
    setPlaying(false);
    reset();
  });
  size.addEventListener("change", () => {
    try { localStorage.setItem(STORAGE_KEY, size.value); } catch { /* Optional persistence. */ }
    setPlaying(false);
    reset();
  });
  reset();
})();
