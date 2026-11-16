# -*- coding: utf-8 -*-
"""Разбор роликов Abstract Machines: кадры + спектр/темп (быстрые вычисления)."""
import os, subprocess, json
import numpy as np

SRC = r"E:\NineToZero\amd"
OUT = r"E:\NineToZero\amd\analysis"
os.makedirs(OUT, exist_ok=True)
BIN = r"C:\Users\Mhl\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.1-full_build\bin"
FF = os.path.join(BIN, "ffmpeg.exe")
FP = os.path.join(BIN, "ffprobe.exe")


def dur(path):
    r = subprocess.run([FP, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                       capture_output=True, text=True)
    return float(r.stdout.strip())


def frames(path, name, d):
    files = []
    for i, t in enumerate([d * 0.15, d * 0.5, d * 0.85]):
        f = os.path.join(OUT, f"{name}-f{i}.png")
        subprocess.run([FF, "-v", "error", "-ss", f"{t:.2f}", "-i", path, "-frames:v", "1",
                        "-vf", "scale=304:-1", "-y", f], check=False)
        if os.path.exists(f):
            files.append(f)
    if len(files) == 3:
        mont = os.path.join(OUT, f"{name}-strip.png")
        subprocess.run([FF, "-v", "error", "-i", files[0], "-i", files[1], "-i", files[2],
                        "-filter_complex", "hstack=inputs=3", "-y", mont], check=False)
        return mont
    return None


def moving_avg(a, w):
    c = np.cumsum(np.insert(a, 0, 0.0))
    out = (c[w:] - c[:-w]) / w
    return np.concatenate([out, np.full(w - 1, out[-1])])


def audio(path, name):
    wav = os.path.join(OUT, f"{name}.wav")
    subprocess.run([FF, "-v", "error", "-i", path, "-ac", "1", "-ar", "22050", "-y", wav], check=False)
    x = np.fromfile(wav, dtype=np.int16, offset=44).astype(np.float32) / 32768.0
    SR = 22050
    win = min(int(0.5 * SR), len(x))
    env = moving_avg(np.abs(x), win)
    start = int(np.argmax(env))
    seg = x[start:start + win]
    n = 1 << int(np.ceil(np.log2(len(seg))))
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)), n=n))
    freqs = np.fft.rfftfreq(n, 1 / SR)
    peak = spec.max()
    th = peak * 0.02
    idx = [i for i in range(1, len(spec) - 1)
           if spec[i] > th and spec[i] >= spec[i - 1] and spec[i] >= spec[i + 1] and freqs[i] < 8000]
    idx = sorted(idx, key=lambda i: -spec[i])[:60]
    peaks = sorted([(round(float(freqs[i]), 1), round(float(spec[i] / peak), 3)) for i in idx])

    hop = 441
    frames_n = len(x) // hop
    env2 = np.abs(x[:frames_n * hop]).reshape(frames_n, hop).mean(axis=1)
    env2 = env2 - env2.mean()
    ac = np.correlate(env2, env2, mode="full")[frames_n - 1:]
    lo = max(2, int(60 / 200 / (hop / SR)))
    hi = min(len(ac) - 1, int(60 / 60 / (hop / SR)))
    bpm = 0.0
    if hi > lo + 2:
        lag = lo + int(np.argmax(ac[lo:hi]))
        if lag:
            bpm = 60 / (lag * hop / SR)
    return {"peaks": peaks, "count": len(idx), "bpm": round(bpm, 1)}


report = {}
for f in sorted(os.listdir(SRC)):
    if not f.endswith(".mp4"):
        continue
    p = os.path.join(SRC, f)
    name = f[:-4]
    d = dur(p)
    mont = frames(p, name, d)
    rep = audio(p, name)
    report[name] = {"duration": d, "montage": mont, "audio": rep}
    print(f"=== {name} ({d:.1f}s)  темп ~{rep['bpm']} BPM  сильных пиков: {rep['count']}")
    print("    пики до 1.5 кГц:", [p for p in rep["peaks"] if p[0] < 1500][:16])

json.dump(report, open(os.path.join(OUT, "report.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("\nготово:", OUT)
