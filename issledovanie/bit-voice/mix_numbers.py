# -*- coding: utf-8 -*-
"""Счёт цифрами поверх «Numbers»-подложки.

Шаг счёта задаётся не тактом, а пульсом (четвертью): в разборе референса
Barтоса счёт идёт ровно на пульс 0,894 с при 67 BPM.

Запуск: python mix_numbers.py <каталог с numbers-bed.wav> <темп> [имя выхода]
"""
import os, sys, wave
import numpy as np

VOICE = r"E:\NineToZero\voice"
BED_DIR = sys.argv[1] if len(sys.argv) > 1 else VOICE
TEMPO = float(sys.argv[2]) if len(sys.argv) > 2 else 90.0
NAME = sys.argv[3] if len(sys.argv) > 3 else "numbers-sketch"
EVERY = max(1, int(sys.argv[4])) if len(sys.argv) > 4 else 1
RATE = 44100
PULSE = 60 / TEMPO            # пульс = четверть


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


bed, rate = read_wav(os.path.join(BED_DIR, "numbers-bed.wav"))
assert rate == RATE
length = len(bed)
voice = np.zeros(length, dtype=np.float32)

digits = [os.path.join(VOICE, "robot", f"ru-{n}.wav") for n in range(1, 9)]
pulse_samples = int(PULSE * RATE)
position = 0
count = 0
while position < length:
    path = digits[count % len(digits)]
    if os.path.exists(path):
        data, _ = read_wav(path)
        loud = np.where(np.abs(data) > 0.02)[0]
        if len(loud):
            data = data[max(0, loud[0] - 120):loud[-1] + 240]
        end = min(length, position + len(data))
        voice[position:end] += data[:end - position]
    count += 1
    position += pulse_samples * EVERY

voice = voice / (np.abs(voice).max() + 1e-9) * 0.34
env = envelope(voice)
duck = 1.0 - 0.38 * env
mixed = bed * duck + voice
top = np.abs(mixed).max()
if top > 0.95:
    mixed *= 0.95 / top
out_path = os.path.join(BED_DIR, NAME + ".wav")
write_wav(out_path, mixed)
print("темп %.0f BPM | пульс %.3f с | шаг %d | цифр %d | длина %.1f с | пик %.3f | RMS %.3f" % (
    TEMPO, PULSE, EVERY, count, length / RATE,
    float(np.abs(mixed).max()), float(np.sqrt((mixed ** 2).mean()))))
