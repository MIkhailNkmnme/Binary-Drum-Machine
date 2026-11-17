# -*- coding: utf-8 -*-
"""Подмешивает синтетические цифры (formant_voice.py) в подложку Numbers 67 BPM.

Запуск: python mix_synth_numbers.py <каталог цифр> <подложка.wav> <выход.wav> [шаг в пульсах]
"""
import os
import sys
import wave

import numpy as np

RATE = 44100
TEMPO = 67.0
PULSE = 60.0 / TEMPO


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


def main():
    digits_dir = sys.argv[1]
    bed_path = sys.argv[2]
    out_path = sys.argv[3]
    step = int(sys.argv[4]) if len(sys.argv) > 4 else 2

    bed, rate = read_wav(bed_path)
    assert rate == RATE, bed_path
    length = len(bed)
    voice = np.zeros(length, dtype=np.float32)

    pulse_samples = int(PULSE * RATE) * step
    position = 0
    count = 0
    while position < length:
        index = count % 8 + 1
        path = os.path.join(digits_dir, f"synth-digit-{index}.wav")
        if os.path.exists(path):
            data, digit_rate = read_wav(path)
            assert digit_rate == RATE
            end = min(length, position + len(data))
            voice[position:end] += data[:end - position]
        count += 1
        position += pulse_samples

    voice = voice / (np.abs(voice).max() + 1e-9) * 0.34
    env = envelope(voice)
    mixed = bed * (1.0 - 0.38 * env) + voice
    top = np.abs(mixed).max()
    if top > 0.95:
        mixed *= 0.95 / top
    write_wav(out_path, mixed)
    print("цифр:", count, "| длина: %.1f с | пик %.3f | RMS %.3f" % (
        length / RATE, float(np.abs(mixed).max()), float(np.sqrt((mixed ** 2).mean()))))


if __name__ == "__main__":
    main()
