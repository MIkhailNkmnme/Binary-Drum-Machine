const root3 = Math.sqrt(3);
const side = Math.sqrt(root3);
const a = [0, 0, 0], b = [1, root3, 0], c = [2, 0, 0];
const d = [0.5, root3 / 2, 0], e = [1.5, root3 / 2, 0];

const add = (p, q) => p.map((value, index) => value + q[index]);
const subtract = (p, q) => p.map((value, index) => value - q[index]);
const dot = (p, q) => p.reduce((sum, value, index) => sum + value * q[index], 0);
const scale = (p, factor) => p.map(value => value * factor);

// EJ is one side of the square. K is a unit farther along the triangle's base.
const offset = Math.sqrt(side ** 2 - e[1] ** 2);
const j = [e[0] - offset, 0, 0], k = [j[0] + 1, 0, 0];
const cut = subtract(e, j);
const foot = point => add(j, scale(cut, dot(subtract(point, j), cut) / dot(cut, cut)));
const l = foot(d), m = foot(k);
const pieces = [[a, d, l, j], [b, d, l, e], [j, m, k], [c, e, m, k]];

function turn(axis, angle, pivot) {
  const cosine = Math.cos(angle), sine = Math.sin(angle);
  return point => {
    const [x, y, z] = subtract(point, pivot);
    const rotated = axis === "x" ? [x, y * cosine - z * sine, y * sine + z * cosine]
      : axis === "y" ? [x * cosine + z * sine, y, -x * sine + z * cosine]
      : [x * cosine - y * sine, x * sine + y * cosine, z];
    return add(pivot, rotated);
  };
}

function flat(angle) {
  const turnRight = turn("z", angle, e);
  const turnLower = turn("z", 2 * angle, k);
  const followK = subtract(turnRight(k), k);
  return [turn("z", -angle, d), point => point, point => add(turnLower(point), followK), turnRight];
}

function spatial(angle) {
  const turnLeft = turn("y", angle, d);
  const turnLower = turn("x", angle, j);
  // J and K lie on a line parallel to x. Their displacements under the two
  // neighboring turns about y are identical, so one translation joins both.
  const followJ = subtract(turnLeft(j), j);
  const alignment = turn("x", angle, d);
  const local = [turnLeft, turn("x", -angle, d), point => add(turnLower(point), followJ), turn("y", angle, e)];
  return local.map(move => point => alignment(move(point)));
}

// Each entry references the same hinge from its two neighboring pieces.
const hinges = [
  [[0, 1], [1, 1]], [[1, 3], [3, 1]], [[3, 3], [2, 2]], [[2, 0], [0, 3]],
];

export function pose(cycle) {
  const folded = cycle <= 1 ? flat(Math.PI * cycle) : spatial(Math.PI * (2 - cycle));
  const polygons = pieces.map((piece, index) => piece.map(folded[index]));
  return {
    polygons,
    joints: hinges.map(pair => pair.map(([piece, vertex]) => polygons[piece][vertex])),
  };
}
