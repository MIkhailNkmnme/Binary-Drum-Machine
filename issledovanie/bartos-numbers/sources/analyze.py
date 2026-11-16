# -*- coding: utf-8 -*-
"""Разбор референса Karl Bartos «Numbers»: темп, пульс счёта, полосы, структура + графики."""
import json, os, wave
import numpy as np
from PIL import Image, ImageDraw

SRC = r"E:\NineToZero\ref\bartos-numbers.wav"
OUT = r"E:\NineToZero\ref\analysis"
os.makedirs(OUT, exist_ok=True)
RATE = 22050
INK = (240, 236, 224)
ACCENT = (61, 220, 151)
WARN = (214, 80, 18)
DIM = (110, 120, 130)


def read(path):
    with wave.open(path, "rb") as stream:
        rate = stream.getframerate()
        channels = stream.getnchannels()
        frames = stream.readframes(stream.getnframes())
    data = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768
    if channels > 1:
        data = data.reshape(-1, channels).mean(axis=1)
    if rate != RATE:
        index = np.arange(0, len(data), rate / RATE).astype(int)
        data = data[index]
    return data


x = read(SRC)
duration = len(x) / RATE

hop = 256
n = len(x) // hop
frames = x[:n * hop].reshape(n, hop)
energy = np.sqrt((frames ** 2).mean(axis=1))
onset = np.maximum(0, np.diff(energy, prepend=energy[0]))
onset_env = np.convolve(onset, np.hanning(5) / 5, mode="same")
frame_rate = RATE / hop

# Темп: комб-фильтр по сетке долей
best = None
for bpm in np.arange(60, 160, 0.25):
    period = 60 / bpm * frame_rate
    top = 0.0
    for phase in np.arange(0, period, 1.5):
        idx = np.round(np.arange(phase, len(onset_env) - 1, period)).astype(int)
        top = max(top, float(onset_env[idx].mean()))
    if best is None or top > best[1]:
        best = (float(bpm), top)
bpm = best[0]
beat = 60 / bpm

# onsets
threshold = np.percentile(onset_env, 92)
peaks = []
for index in range(1, len(onset_env) - 1):
    if onset_env[index] < threshold:
        continue
    if onset_env[index] < onset_env[index - 1] or onset_env[index] < onset_env[index + 1]:
        continue
    time = index / frame_rate
    if peaks and time - peaks[-1][0] < 0.16:
        if onset_env[index] > peaks[-1][1]:
            peaks[-1] = (time, float(onset_env[index]))
        continue
    peaks.append((time, float(onset_env[index])))


def band_ratio(signal, low, high):
    spec = np.abs(np.fft.rfft(signal * np.hanning(len(signal))))
    freqs = np.fft.rfftfreq(len(signal), 1 / RATE)
    return float(spec[(freqs >= low) & (freqs < high)].sum() / (spec.sum() + 1e-9))


counted = []
for time, strength in peaks:
    start = max(0, int((time - 0.04) * RATE))
    chunk = x[start:start + int(0.25 * RATE)]
    if len(chunk) < 2000:
        continue
    counted.append({
        "t": round(time, 3),
        "voice": round(band_ratio(chunk, 300, 3000), 3),
        "low": round(band_ratio(chunk, 30, 200), 3)
    })

voice_like = [item for item in counted if item["voice"] > 0.35 and item["voice"] > item["low"]]

# Пульс счёта: медианный интервал между «голосовыми» onsets
times = [item["t"] for item in voice_like]
iois = np.diff(times)
iois = iois[(iois > 0.3) & (iois < 2.0)]
pulse = float(np.median(iois)) if len(iois) else beat
pulse_bpm = 60 / pulse

# Раскладка счёта по пульсу от первого «голосового» звука
origin = times[0] if times else 0.0
score = []
for item in voice_like:
    step = (item["t"] - origin) / pulse
    score.append({"t": item["t"], "step": round(step, 2), "digit": int(round(step)) % 8 + 1,
                  "voice": item["voice"]})

# Полосы по 4 с и RMS
window = int(4 * RATE)
bands = []
for start in range(0, len(x) - window, window):
    chunk = x[start:start + window]
    bands.append({
        "t": round(start / RATE, 1),
        "low": round(band_ratio(chunk, 30, 200), 3),
        "voice": round(band_ratio(chunk, 300, 3000), 3),
        "high": round(band_ratio(chunk, 3000, 10000), 3),
        "rms": round(float(np.sqrt((chunk ** 2).mean())), 3)
    })

report = {
    "source": "Karl Bartos — Numbers / Computer World (Cover), YouTube yaC2zD8C6EU",
    "duration": round(duration, 1),
    "tempo_grid": round(bpm, 2),
    "beat": round(beat, 4),
    "pulse_count": round(pulse, 4),
    "pulse_bpm": round(pulse_bpm, 1),
    "onset_total": len(counted),
    "voice_onsets": len(voice_like),
    "peak": round(float(np.abs(x).max()), 3),
    "rms": round(float(np.sqrt((x ** 2).mean())), 3),
    "bands": bands,
    "score": score[:64]
}
json.dump(report, open(os.path.join(OUT, "reference.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

# --- график: RMS и полосы
W, H = 1100, 320
image = Image.new("RGB", (W, H), (12, 14, 18))
draw = ImageDraw.Draw(image)
left, right, top, bottom = 52, W - 14, 18, H - 28
max_rms = max(item["rms"] for item in bands) or 1
for index, item in enumerate(bands):
    x0 = left + (right - left) * index / len(bands)
    x1 = left + (right - left) * (index + 1) / len(bands) - 1
    height = (bottom - top) * item["rms"] / max_rms
    draw.rectangle([x0, bottom - height, x1, bottom], fill=(30, 60, 50))
    vh = (bottom - top) * item["voice"]
    draw.rectangle([x0, bottom - vh, x1, bottom], fill=(24, 90, 70))
draw.line([left, bottom, right, bottom], fill=DIM)
draw.text((6, top), "RMS", fill=DIM)
draw.text((6, top + 14), "голос", fill=DIM)
draw.text((left, H - 18), "0 с", fill=DIM)
draw.text((right - 46, H - 18), "%d с" % round(duration), fill=DIM)
image.save(os.path.join(OUT, "energy.png"))

# --- карта находок: все onsets и «голосовые»
image = Image.new("RGB", (W, 150), (12, 14, 18))
draw = ImageDraw.Draw(image)
for item in counted:
    px = left + (right - left) * item["t"] / duration
    draw.line([px, top, px, bottom], fill=(58, 66, 74))
for item in voice_like:
    px = left + (right - left) * item["t"] / duration
    draw.ellipse([px - 2.2, top + 6, px + 2.2, bottom - 6], fill=ACCENT)
draw.line([left, bottom, right, bottom], fill=DIM)
draw.text((left, H - 18), "0 с", fill=DIM)
draw.text((right - 46, H - 18), "%d с" % round(duration), fill=DIM)
draw.text((left, 2), "зелёное — звуки, похожие на голос", fill=DIM)
image.save(os.path.join(OUT, "onsets.png"))

print("темп по сетке: %.2f BPM | пульс счёта: %.3f с (%.1f BPM)" % (bpm, pulse, pulse_bpm))
print("onsets:", len(counted), "| голосовых:", len(voice_like))
print("первые 12 шагов счёта:", [(round(item["step"], 2), item["digit"]) for item in score[:12]])
print("интервалы, медиана: %.3f с | разброс: %.3f" % (pulse, float(np.std(iois))))
