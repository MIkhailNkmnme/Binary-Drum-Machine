# -*- coding: utf-8 -*-
"""Версия с приседанием музыки под голосом: буквы слышны, петля остаётся петлёй."""
import os, wave
import numpy as np

OUT = r"E:\NineToZero\voice"
LOOP = r"E:\NineToZero\music\zerkalius-loop.wav"
RATE = 44100


def read_wav(path):
    with wave.open(path, "rb") as stream:
        frames = stream.readframes(stream.getnframes())
        rate = stream.getframerate()
        channels = stream.getnchannels()
    data = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768
    return (data.reshape(-1, channels).mean(axis=1) if channels > 1 else data), rate


def write_wav(path, data, rate=RATE, stereo=False):
    pcm = np.clip(data, -1, 1)
    with wave.open(path, "wb") as stream:
        stream.setnchannels(2 if stereo else 1)
        stream.setsampwidth(2)
        stream.setframerate(rate)
        stream.writeframes((pcm * 32767).astype(np.int16).tobytes())


def envelope(signal, window=2205):
    """Огибающая с окном 50 мс и спадом 120 мс — чтобы приседание не щёлкало."""
    rectified = np.abs(signal)
    cumsum = np.cumsum(np.insert(rectified, 0, 0.0))
    smooth = (cumsum[window:] - cumsum[:-window]) / window
    smooth = np.concatenate([smooth, np.full(window - 1, smooth[-1])])
    # плавное отпускание
    out = np.empty_like(smooth)
    decay = 0.9993
    acc = 0.0
    for index in range(len(smooth)):
        acc = max(smooth[index], acc * decay)
        out[index] = acc
    top = out.max() + 1e-9
    return out / top


loop, rate = read_wav(LOOP)
length = len(loop)

for word in ("zerkalius", "ninetozero"):
    stem, _ = read_wav(os.path.join(OUT, f"letters-{word}.wav"))
    voice = np.zeros(length, dtype=np.float32)
    for index in range(len(stem)):
        voice[index % length] += stem[index]
    voice = voice / (np.abs(voice).max() + 1e-9) * 0.34

    env = envelope(voice)
    duck = 1.0 - 0.42 * env                       # музыка приседает до −4,7 дБ
    music = loop * duck
    mixed = music + voice
    top = np.abs(mixed).max()
    if top > 0.95:
        mixed *= 0.95 / top
    stereo = np.stack([mixed, mixed], axis=1).reshape(-1)
    write_wav(os.path.join(OUT, f"loop-letters-{word}-ducked.wav"), stereo, stereo=True)

    joined = np.concatenate([mixed[-2205:], mixed[:2205]])
    window = int(rate * 0.01)
    levels = [float(np.sqrt((joined[i:i + window] ** 2).mean())) for i in range(0, len(joined) - window, window)]
    print(word, "| пик:", round(float(np.abs(mixed).max()), 3),
          "| RMS:", round(float(np.sqrt((mixed ** 2).mean())), 3),
          "| стык: мин", round(min(levels), 3),
          "| приседание макс:", round(float((1 - duck).max()), 2))
