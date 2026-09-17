# Моменты ударов в треке — для музыки без ровной сетки (брейккор, рваные размеры).
#
#   FFMPEG=... python3 tools/onsets.py трек.mp3 > steps.json
#
# Пики спектрального потока с адаптивным порогом: удар засчитывается, если
# всплеск заметно выше локального среднего и с прошлого удара прошло
# достаточно времени. На выходе — секунды, по которым щёлкает движок.
import json, os, subprocess, sys
import numpy as np

SRC = sys.argv[1]
MIN_GAP = float(sys.argv[2]) if len(sys.argv) > 2 else 0.09   # сек между ударами
SENS = float(sys.argv[3]) if len(sys.argv) > 3 else 1.4       # во сколько раз выше фона
FF = os.environ.get("FFMPEG", "ffmpeg")
SR, N, HOP = 22050, 1024, 256

raw = subprocess.run([FF, "-v", "quiet", "-i", SRC, "-vn", "-ac", "1", "-ar", str(SR),
                      "-f", "f32le", "-"], capture_output=True).stdout
x = np.frombuffer(raw, dtype=np.float32)
frames = 1 + (len(x) - N) // HOP
win = np.hanning(N).astype(np.float32)
S = np.empty((frames, N // 2 + 1), dtype=np.float32)
for i in range(frames):
    S[i] = np.abs(np.fft.rfft(x[i*HOP:i*HOP+N] * win))
flux = np.maximum(S[1:] - S[:-1], 0).sum(axis=1)
env_fps = SR / HOP

# скользящее среднее как фон, пики ищем относительно него
w = int(env_fps * 0.35)
pad = np.pad(flux, (w, w), mode="edge")
bg = np.convolve(pad, np.ones(2*w+1)/(2*w+1), mode="valid")[:len(flux)]

times, last = [], -1e9
for i in range(1, len(flux) - 1):
    t = i / env_fps
    if flux[i] < bg[i] * SENS: continue
    if flux[i] < flux[i-1] or flux[i] < flux[i+1]: continue   # только локальный максимум
    if t - last < MIN_GAP: continue
    times.append(round(t, 4)); last = t

dur = len(x) / SR
sys.stderr.write(f"ударов: {len(times)} за {dur:.1f} сек — в среднем {len(times)/dur:.1f} в секунду\n")
if len(times) > 1:
    d = np.diff(times)
    sys.stderr.write(f"интервал между ударами: медиана {np.median(d):.3f} сек, разброс {d.std():.3f}\n")
    sys.stderr.write("ровная сетка\n" if d.std() < 0.05 else "сетка плавает — фиксированный темп тут не годится\n")
print(json.dumps({"source": os.path.basename(SRC), "duration": round(dur, 3), "times": times}))
