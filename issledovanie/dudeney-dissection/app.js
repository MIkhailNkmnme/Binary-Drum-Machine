import { pose } from "./geometry.js?v=001";

const stage = document.querySelector("#stage");
const pieces = document.querySelector("#pieces");
const joints = document.querySelector("#joints");
const slider = document.querySelector("#cycle");
const phase = document.querySelector("#phase");
const connections = document.querySelector("#connections");
const play = document.querySelector("#play");
const playIcon = play.querySelector(".gz-ic");
const playText = play.querySelector(".gz-nm");

const svgNS = "http://www.w3.org/2000/svg";
const faces = ["#f09687", "#7ecde0", "#eec77b", "#bdace9"].map(color => {
  const polygon = document.createElementNS(svgNS, "polygon");
  polygon.setAttribute("fill", color);
  return polygon;
});

const markers = Array.from({ length: 8 }, () => {
  const circle = document.createElementNS(svgNS, "circle");
  joints.append(circle);
  return circle;
});

const cycleMs = 12000;
const centerY = Math.sqrt(3) / 3;
let position = Number(slider.value);
let camera;
let drag;
let animation;
let lastFrame;

function activeCamera() {
  const tilt = position > 1 ? Math.sin(Math.PI * (position - 1)) : 0;
  return camera ?? { yaw: -0.48 * tilt, pitch: 0.92 * tilt };
}

function projection({ yaw, pitch }) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  return ([x, y, z]) => {
    const u = x - 1, v = y - centerY;
    const vertical = u * sy + v * cy;
    return [u * cy - v * sy, z * sp - vertical * cp, vertical * sp + z * cp];
  };
}

function updateStatus(closed) {
  let name;
  if (position === 0 || position === 2) name = "Треугольник";
  else if (position === 1) name = "Квадрат";
  else name = position < 1 ? "Плоская сборка · 2D" : "Пространственный возврат · 3D";
  if (phase.textContent !== name) {
    phase.textContent = name;
    slider.setAttribute("aria-valuetext", name);
  }
  const status = `Шарниры замкнуты · ${closed} из 4`;
  if (connections.textContent !== status) connections.textContent = status;
}

function render() {
  const { polygons, joints: pairs } = pose(position);
  const project = projection(activeCamera());
  const projected = polygons.map(points => points.map(project));
  const extent = Math.max(1, ...projected.flat().map(([x, y]) =>
    Math.max(Math.abs(x) / 1.52, Math.abs(y) / 1.16)));
  stage.setAttribute("viewBox", `${-1.65 * extent} ${-1.3 * extent} ${3.3 * extent} ${2.6 * extent}`);

  const layered = projected.map((points, index) => {
    const face = faces[index];
    face.setAttribute("points", points.map(([x, y]) => `${x},${y}`).join(" "));
    const depth = points.reduce((sum, point) => sum + point[2], 0) / points.length;
    return { face, depth };
  });
  layered.sort((a, b) => a.depth - b.depth);
  layered.forEach(({ face }) => pieces.append(face));

  let markerCount = 0;
  let closed = 0;
  for (const [a, b] of pairs) {
    const joined = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-7;
    closed += Number(joined);
    for (const point of joined ? [a] : [a, b]) {
      const marker = markers[markerCount++];
      const [x, y] = project(point);
      marker.setAttribute("cx", x);
      marker.setAttribute("cy", y);
      marker.setAttribute("r", 0.025 * extent);
      marker.setAttribute("class", joined ? "joint" : "joint open");
      marker.removeAttribute("visibility");
    }
  }
  for (const marker of markers.slice(markerCount)) marker.setAttribute("visibility", "hidden");
  updateStatus(closed);
}

function tick(now) {
  if (lastFrame !== undefined) {
    position = (position + (now - lastFrame) * 2 / cycleMs) % 2;
    slider.value = position;
    render();
  }
  lastFrame = now;
  animation = requestAnimationFrame(tick);
}

function setPlaying(playing) {
  if (animation !== undefined) cancelAnimationFrame(animation);
  lastFrame = undefined;
  animation = playing ? requestAnimationFrame(tick) : undefined;
  play.setAttribute("aria-pressed", playing);
  play.classList.toggle("gz-on", playing);
  playIcon.textContent = playing ? "Ⅱ" : "▶";
  playText.textContent = playing ? "Пауза" : "Плейъ";
  play.title = playing ? "Приостановить цикл" : "Воспроизвести цикл";
}

function jump(value) {
  setPlaying(false);
  position = value;
  slider.value = position;
  render();
}

function resetCamera() {
  camera = undefined;
  render();
}

function orbit(yaw, pitch) {
  camera = { yaw, pitch: Math.max(-1.4, Math.min(1.4, pitch)) };
  render();
}

play.addEventListener("click", () => setPlaying(animation === undefined));
slider.addEventListener("input", () => jump(Number(slider.value)));
document.querySelector("#triangle").addEventListener("click", () => jump(0));
document.querySelector("#square").addEventListener("click", () => jump(1));
document.querySelector("#camera").addEventListener("click", resetCamera);
document.addEventListener("visibilitychange", () => { lastFrame = undefined; });

stage.addEventListener("pointerdown", event => {
  if (event.button !== 0 || drag) return;
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, ...activeCamera() };
  stage.setPointerCapture(event.pointerId);
});

stage.addEventListener("pointermove", event => {
  if (drag?.id !== event.pointerId) return;
  orbit(drag.yaw + (event.clientX - drag.x) * 0.008, drag.pitch + (event.clientY - drag.y) * 0.008);
});

for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
  stage.addEventListener(type, event => {
    if (drag?.id === event.pointerId) drag = undefined;
  });
}

const arrows = new Map([
  ["ArrowLeft", [-0.1, 0]], ["ArrowRight", [0.1, 0]],
  ["ArrowUp", [0, -0.1]], ["ArrowDown", [0, 0.1]],
]);
stage.addEventListener("keydown", event => {
  if (event.key === "Home") {
    event.preventDefault();
    resetCamera();
    return;
  }
  const step = arrows.get(event.key);
  if (step) {
    event.preventDefault();
    const { yaw, pitch } = activeCamera();
    orbit(yaw + step[0], pitch + step[1]);
  }
});

render();
