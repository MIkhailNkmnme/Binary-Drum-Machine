# -*- coding: utf-8 -*-
"""Счёт цифрами поверх «Numbers»-подложки: по цифре на такт, музыка приседает под голосом."""
import os, wave
import numpy as np

VOICE = r"E:\NineToZero\voice"
OUT = VOICE
BED = os.path.join(VOICE, "numbers-bed.wav")
RATE = 44100
TEMPO = 90
BAR = 60 / TEMPO * 4          # 2,667 с


def read_wav(path):
    with wave.open(path, "rb") as stream:
        frames = stream.readframes(stream.getnframes())
        rate = stream.getframerate()
        channels = stream.getnchannels()
    data = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768
    return (data.reshape(-1, channels).mean(axis=1) if channels > 1 else data), rate


def write_wav(path, data, rate=RATE):
    pcm = np.clip(data, -1, 1)
    stereo = np.stack([pcm, pcm], axis=1).reshape(-1)
    with wave.open(path, "wb") as stream:
        stream.setnchannels(2)
        stream.setsampwidth(2)
        stream.setframerate(rate)
        stream.writeframes((stereo * 32767).astype(np.int16).tobytes())


def envelope(signal, window=2205, decay=0.9993):
    rectified = np.abs(signal)
    cumsum = np.cumsum(np.insert(rectified, 0, 0.0))
    smooth = (cumsum[window:] - cumsum[:-window]) / window
    smooth = np.concatenate([smooth, np.full(window - 1, smooth[-1])])
    out = np.empty_like(smooth)
    acc = 0.0
    for index in range(len(smooth)):
        acc = max(smooth[index], acc * decay)
        out[index] = acc
    return out / (out.max() + 1e-9)


bed, rate = read_wav(BED)
length = len(bed)
voice = np.zeros(length, dtype=np.float32)

digits = [os.path.join(VOICE, "robot", f"ru-{n}.wav") for n in range(1, 9)]
bar_samples = int(BAR * RATE)
bar_index = 0
position = 0
while position < length:
    path = digits[bar_index % len(digits)]
    if os.path.exists(path):
        data, _ = read_wav(path)
        loud = np.where(np.abs(data) > 0.02)[0]
        if len(loud):
            data = data[max(0, loud[0] - 150):loud[-1] + 300]
        end = min(length, position + len(data))
        voice[position:end] += data[:end - position]
    bar_index += 1
    position += bar_samples

voice = voice / (np.abs(voice).max() + 1e-9) * 0.34
env = envelope(voice)
duck = 1.0 - 0.42 * env
mixed = bed * duck + voice
top = np.abs(mixed).max()
if top > 0.95:
    mixed *= 0.95 / top
write_wav(os.path.join(OUT, "numbers-sketch.wav"), mixed)
print("цифр:", bar_index, "| длина: %.1f с | пик %.3f | RMS %.3f" % (
    length / RATE, float(np.abs(mixed).max()), float(np.sqrt((mixed ** 2).mean()))))
