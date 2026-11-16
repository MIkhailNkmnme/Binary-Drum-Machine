# -*- coding: utf-8 -*-
"""Подмешивает роботизированный счёт в петлю, сохраняя бесшовность (хвост заворачивается)."""
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
    if channels > 1:
        data = data.reshape(-1, channels)
    else:
        data = data.reshape(-1, 1)
    return data, rate


def write_wav(path, data, rate=RATE):
    pcm = np.clip(data, -1, 1)
    channels = pcm.shape[1]
    with wave.open(path, "wb") as stream:
        stream.setnchannels(channels)
        stream.setsampwidth(2)
        stream.setframerate(rate)
        stream.writeframes((pcm * 32767).astype(np.int16).tobytes())


loop, loop_rate = read_wav(LOOP)
assert loop_rate == RATE
length = loop.shape[0]

for prefix in ("ru", "en"):
    voice, voice_rate = read_wav(os.path.join(OUT, f"count-{prefix}.wav"))
    assert voice_rate == RATE
    # Нормируем по пику, а не по RMS: иначе транзиенты голоса выдавливают музыку.
    target_peak = 0.2
    voice = voice / (np.abs(voice).max() + 1e-9) * target_peak

    # Заворот: всё, что выходит за длину петли, возвращается в начало.
    mixed = loop.copy()
    wrapped = np.zeros((length, 1), dtype=np.float32)
    for index in range(voice.shape[0]):
        wrapped[index % length, 0] += voice[index, 0]
    # Лёгкая панорама: голос чуть левее центра, музыка остаётся как была.
    mixed[:, 0] += wrapped[:, 0] * 0.95
    mixed[:, 1] += wrapped[:, 0] * 0.75

    peak = np.abs(mixed).max()
    print('   пик до лимитера:', round(float(peak), 3))
    if peak > 0.95:
        mixed *= 0.95 / peak
        print('   подрезал общий уровень до 0.95')
    path = os.path.join(OUT, f"loop-{prefix}.wav")
    write_wav(path, mixed)
    print(prefix, "| петля с голосом:", path, "| сек:", round(length / RATE, 3),
          "| пик:", round(float(np.abs(mixed).max()), 3),
          "| RMS:", round(float(np.sqrt((mixed ** 2).mean())), 3))

    # Проверка стыка: окно ±50 мс
    mono = mixed.mean(axis=1)
    joined = np.concatenate([mono[-2205:], mono[:2205]])
    window = int(RATE * 0.01)
    levels = [float(np.sqrt((joined[i:i + window] ** 2).mean())) for i in range(0, len(joined) - window, window)]
    print("   RMS вокруг стыка:", " ".join(f"{v:.2f}" for v in levels), "| минимум:", round(min(levels), 3))
