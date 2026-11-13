"""Extract candidate yellow centrelines on a fitted 8×12 cell lattice."""
import argparse
import importlib.util
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SPEC = importlib.util.spec_from_file_location('plate', ROOT/'drafts/analysis/plate.py')
PLATE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PLATE)
W, H = 8, 12
EDGES = [
    ((x, y), (x + 1, y)) for y in range(H + 1) for x in range(W)
] + [
    ((x, y), (x, y + 1)) for y in range(H) for x in range(W + 1)
]
START, END = np.array(EDGES).transpose((1, 0, 2))
NORMAL = (END - START)[:, ::-1]
along = np.array([.23, .38, .5, .62, .77])
MIDS = START[:, None, :] + (END - START)[:, None, :] * along[None, :, None]
SITES = MIDS[:, :, None, :] + NORMAL[:, None, None, :] * np.array([-.33, -.11, 0., .11, .33])[None, None, :, None]
EXT_EDGES = [
    ((x, y), (x+1, y)) for y in range(-1,H+2) for x in range(-1,W+1)
] + [
    ((x, y), (x, y+1)) for y in range(-1,H+1) for x in range(-1,W+2)
]
EXT_START, EXT_END = np.array(EXT_EDGES).transpose((1,0,2))
EXT_MIDS = EXT_START[:,None,:] + (EXT_END-EXT_START)[:,None,:] * along[None,:,None]
EXT_SITES = EXT_MIDS[:,:,None,:] + (EXT_END-EXT_START)[:,None,None,::-1] * np.array([-.33,-.11,0,.11,.33])[None,None,:,None]


def evidence(rgb):
    r, g, b = rgb.astype(np.float32).transpose((2, 0, 1))
    # Give most weight to green, which is bright in the yellow line and dim in the red halo.
    return np.ascontiguousarray(.73 * g + .22 * r + .05 * b)


def scores(im, params, sites=SITES):
    points = sites * params[2:] + params[:2]
    values = cv2.remap(im, points[..., 0].astype(np.float32).reshape(len(sites), -1),
                       points[..., 1].astype(np.float32).reshape(len(sites), -1), cv2.INTER_LINEAR)
    values = values.reshape(sites.shape[:-1])
    centre = values[:, :, 1:4].mean(axis=2)
    sides = (values[:, :, 0] + values[:, :, 4]) / 2
    return np.median(centre - sides, axis=1), np.median(centre, axis=1)


def fit(im, cx, y0, y1, d):
    pitch = d * .105
    # Many shapes leave a cell above the stem or at the foot. Prefer the known
    # shared horizontal crossbar and let the vertical phase move by one cell.
    y_pitch = (y1 - y0) / H
    initial = np.array([cx - 4 * pitch, y0 + .15 * y_pitch, pitch, y_pitch])
    def value(p):
        s, _ = scores(im, p)
        top = np.sort(s)[-41:]
        return float(top.mean()) - .22 * abs((p[2] / pitch) - 1) - .22 * abs(p[3]/y_pitch - 1)
    best = initial
    best_v = -1
    for dx in [-.75, -.35, 0, .35, .75]:
        for dy in [-.8, -.4, 0, .4, .8]:
            for ratio in [.92, 1, 1.08]:
                p = initial.copy()
                p[:2] += [dx*pitch,dy*y_pitch]
                p[2:] *= ratio
                v = value(p)
                if v > best_v:
                    best, best_v = p, v
    for step in [.21,.12,.065,.035]:
        for _ in range(2):
            for axis in range(4):
                step_size = step * (pitch if axis < 2 else pitch/6)
                for sign in [-1, 1]:
                    q = best.copy()
                    q[axis] += sign*step_size
                    v = value(q)
                    if v > best_v:
                        best, best_v = q, v
    return best, scores(im, best)


def edges_from_cells(cells):
    hp = np.pad(cells, ((1,1),(0,0)))
    vp = np.pad(cells, ((0,0),(1,1)))
    return np.concatenate(((hp[1:]!=hp[:-1]).ravel(),(vp[:,1:]!=vp[:,:-1]).ravel()))


PATTERNS = np.array([(n>>np.arange(W))&1 for n in range(1<<W)], dtype=bool)
PAIRS = np.logical_xor(PATTERNS[:,None,:],PATTERNS[None,:,:]).reshape(-1,W).astype(np.float32)
PADDED = np.pad(PATTERNS, ((0,0),(1,1)))
VERTICAL = (PADDED[:,1:] != PADDED[:,:-1]).astype(np.float32)


def snap(weights):
    # Exact rowwise maximization over all binary cell masks under the assumed
    # XOR-boundary model; every row has 256 possible masks.
    horizontal = weights[:W*(H+1)].reshape(H+1,W).astype(np.float32)
    vertical = weights[W*(H+1):].reshape(H,W+1).astype(np.float32)
    v = VERTICAL @ vertical.T
    pair_gains = (PAIRS @ horizontal[1:H].T).reshape(1<<W,1<<W,H-1)
    total = PATTERNS @ horizontal[0] + v[:,0]
    previous = []
    for y in range(1,H):
        gains = total[:,None] + pair_gains[:,:,y-1]
        previous.append(np.argmax(gains,axis=0))
        total = np.max(gains,axis=0) + v[:,y]
    state = [int(np.argmax(total + PATTERNS @ horizontal[-1]))]
    for prev in reversed(previous):
        state.append(int(prev[state[-1]]))
    return PATTERNS[state[::-1]]


def graph(params, signal, extended, cx, d):
    contrast, brightness = signal
    level = max(.25, float(np.sort(contrast)[-35:].mean()))
    bright = np.sort(brightness)[-35:].mean()
    background = np.quantile(brightness,.25)
    normal = .34 * contrast / level + .66 * (brightness-background) / max(5,bright-background)
    cells = snap(normal-.48)
    corrected = edges_from_cells(cells)
    ext_c, ext_b = extended
    ext = .34 * ext_c / level + .66 * (ext_b-background) / max(5,bright-background)
    ext_fit = EXT_MIDS.mean(axis=1)[:,0]*params[2]+params[0]
    allowed = abs(ext_fit-cx) < .49*d
    # The target is the yellow centreline. Adjacent square loops can share
    # a visible side; hence the raw graph does not enforce even degrees.
    model_edges = {edge for i,edge in enumerate(EDGES) if corrected[i]}
    ids = {edge:f"e{i}" for i,edge in enumerate(EXT_EDGES)}
    def graph_edges(active):
        return [
            {"id":ids[(a,b)],"from":f"{a[0]},{a[1]}","to":f"{b[0]},{b[1]}","score":round(float(ext[i]),3)}
            for i,(a,b) in enumerate(EXT_EDGES) if active[i]
        ]
    raw = (ext > .48) & allowed
    weak = (ext >= .36) & (ext <= .60) & allowed
    disagreement = [ids[edge] for i,edge in enumerate(EXT_EDGES) if raw[i] != (edge in model_edges)]
    nodes = [{"id":f"{x},{y}","x":x,"y":y} for y in range(-1,H+2) for x in range(-1,W+2)]
    confidence_reasons = []
    if min(params[2:]) < 5.5:
        confidence_reasons.append('source lattice pitch below 5.5 px')
    if level < 13:
        confidence_reasons.append('low local contrast')
    if np.count_nonzero(weak) >= 4:
        confidence_reasons.append('at least four near-threshold edges')
    confidence = 'low' if confidence_reasons else 'medium'
    return {"alignment":[round(float(x),4) for x in params], "contrast":round(level,3),
            "nodes":nodes, "edges":graph_edges(raw),"rawEdges":graph_edges(raw),
            "lowThresholdEdges":graph_edges((ext>.36)&allowed),
            "highThresholdEdges":graph_edges((ext>.60)&allowed),
            "confidence":confidence, "confidenceReasons":confidence_reasons,"uncertainEdges":graph_edges(weak),
            "xorModelEdges":graph_edges([edge in model_edges for edge in EXT_EDGES]),
            "inferredCellRows":["".join(str(int(x)) for x in line) for line in cells],
            "changedEdgeIds":disagreement,
            "edgeScores":[round(float(x),3) for x in ext]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--captures', type=Path, default=ROOT/'drafts/witnesses')
    parser.add_argument('--output', type=Path, default=HERE/'graphs.json')
    args = parser.parse_args()
    lookup = {int(Path(s['file']).stem):s for s in json.loads((args.captures/'samples.json').read_text(encoding='utf-8'))}
    frames = []
    # The distant view in witness 0196 has a stable, visible bar whose four
    # centres can be located more closely than the older crop centres.
    registration = {196:(617,41,391,446)}
    for state, view, _, transition in PLATE.evidence:
        key,cx,d,y0,y1 = view
        cx,d,y0,y1 = registration.get(key,(cx,d,y0,y1))
        meta = lookup[key]
        image = Image.open(args.captures/meta['file']).convert('RGB')
        im = evidence(np.asarray(image))
        glyphs = []
        for slot in range(4):
            params, signal = fit(im, cx+slot*d, y0, y1, d)
            g = graph(params,signal,scores(im,params,EXT_SITES),cx+slot*d,d)
            g.update(slot=slot+1)
            glyphs.append(g)
        if key == 457:
            transition = ['Переход 16–17', 'В этом кадре геометрия четырёх глифов совпала с рядом 17']
        frames.append({"state":state,"transition":transition,"witness":meta,"glyphs":glyphs})
    output = {"grid":[W,H],"marginCells":1,"frames":frames,
              "model":"Yellow centreline candidates on a lattice fitted to each witness. Main edges use 0.48; 0.36 and 0.60 are sensitivity alternatives. XOR cell candidate is a different hypothesis, not a repair of the observed graph."}
    args.output.write_text(json.dumps(output,ensure_ascii=False,separators=(',',':')),encoding='utf-8')


if __name__ == '__main__':
    main()
