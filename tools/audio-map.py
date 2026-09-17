# Карта трека под монтаж: темп, фаза первой доли и границы секций по тактам.
#
#   python3 tools/audio-map.py трек.mp3
#
# Темп ищется гребёнкой: для каждого кандидата BPM берётся лучшая фаза и
# считается сумма onset-функции на долях. Автокорреляция тут врёт — она цепляется
# за такт и выдаёт половинный темп.
import os, subprocess, sys
import numpy as np

SRC = sys.argv[1]
FF = os.environ.get("FFMPEG", "ffmpeg")
SR, N, HOP = 22050, 1024, 256

def decode(path):
    raw = subprocess.run([FF, "-v", "quiet", "-i", path, "-vn", "-ac", "1", "-ar", str(SR),
                          "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)

def onset(x):
    frames = 1 + (len(x) - N) // HOP
    win = np.hanning(N).astype(np.float32)
    S = np.empty((frames, N // 2 + 1), dtype=np.float32)
    for i in range(frames):
        S[i] = np.abs(np.fft.rfft(x[i*HOP:i*HOP+N] * win))
    f = np.maximum(S[1:] - S[:-1], 0).sum(axis=1)
    return (f - f.mean()) / (f.std() + 1e-9)

x = decode(SRC)
flux = onset(x)
env_fps = SR / HOP
dur = len(x) / SR

def score(bpm):
    per = 60.0 * env_fps / bpm
    n = int(len(flux) / per)
    idx = np.arange(n) * per
    best, bph = -1e9, 0.0
    for ph in np.linspace(0, per, 24, endpoint=False):
        s = flux[np.clip((idx + ph).astype(int), 0, len(flux) - 1)].sum() / n
        if s > best: best, bph = s, ph
    return best, bph / env_fps

res = sorted(((score(b)[0], b) for b in np.arange(60, 200.25, 0.25)), reverse=True)
seen = []
print("кандидаты темпа:")
for s, b in res:
    if any(abs(b - p) < 3 for p in seen): continue
    seen.append(b); print(f"  {b:7.2f} BPM   оценка {s:.3f}")
    if len(seen) >= 6: break

BPM = seen[0]
_, phase = score(BPM)
BAR = 4 * 60 / BPM
nbars = int(dur / BAR)
print(f"\nтемп {BPM:.2f} BPM · первая доля {phase:.3f} сек · такт {BAR:.3f} сек · {nbars} тактов · {dur:.1f} сек")

# энергия и доля низа по тактам
e, low = [], []
for b in range(nbars):
    seg = x[int(b*BAR*SR):int((b+1)*BAR*SR)]
    e.append(float(np.sqrt(np.mean(seg ** 2))))
    sp = np.abs(np.fft.rfft(seg * np.hanning(len(seg))))
    fr = np.fft.rfftfreq(len(seg), 1 / SR)
    low.append(float(sp[fr < 150].sum() / (sp.sum() + 1e-9)))
e = np.array(e); e /= e.max(); low = np.array(low)

d = np.abs(np.diff(e, prepend=e[0]))
cut = sorted(set([0] + [b for b in range(2, nbars - 1) if d[b] > 0.18] + [nbars]))
merged = [cut[0]]
for c in cut[1:]:
    if c - merged[-1] >= 4: merged.append(c)      # секции не короче 4 тактов
if merged[-1] != nbars: merged.append(nbars)

print("\nтакты        время          энергия  низ   характер")
for i in range(len(merged) - 1):
    a, b = merged[i], merged[i + 1]
    en, lo = e[a:b].mean(), low[a:b].mean()
    t0, t1 = a * BAR, b * BAR
    kind = ("тишина/спад" if en < .35 else "провал" if en < .6 else
            "ход" if en < .82 else "полный ход")
    print(f"{a:>3}-{b:<4}  {int(t0//60)}:{t0%60:04.1f}-{int(t1//60)}:{t1%60:04.1f}   {en:.2f}     {lo:.2f}  {kind}")
