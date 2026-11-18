# -*- coding: utf-8 -*-
"""Буквы на формантном синтезе: слово проговаривается по буквам, у каждой своя высота.

Ни одного сэмпла: голос собирается formant_voice.py, затем буквы раскладываются
по петле 46,08 с с приседанием музыки.

Запуск: python build_letters.py <слово> <петля.wav> <выход.wav>
"""
import os
import sys
import wave

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import formant_voice as fv  # noqa: E402

RATE = 44100
BAR = 1.92          # такт 125 BPM
STEP = 0.48         # четверть

# Названия букв по-русски: так их и произносит синтезатор.
LETTER_NAMES = {
    "A": "а", "B": "бэ", "C": "цэ", "D": "дэ", "E": "е", "F": "эф", "G": "гэ",
    "H": "аш", "I": "и", "J": "йот", "K": "ка", "L": "эль", "M": "эм", "N": "эн",
    "O": "о", "P": "пэ", "Q": "ку", "R": "эр", "S": "эс", "T": "тэ", "U": "у",
    "V": "вэ", "W": "дубльвэ", "X": "икс", "Y": "игрек", "Z": "зэт",
}

# Высота буквы: ступень до-минора относительно середины.
SEMITONES = {"A": -3, "E": -1, "I": 0, "K": 2, "L": 4, "R": 5, "S": 7, "U": -3, "Z": -1}


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
    word = (sys.argv[1] if len(sys.argv) > 1 else "ZERKALIUS").upper()
    loop_path = sys.argv[2] if len(sys.argv) > 2 else r"E:\NineToZero\music\zerkalius-loop.wav"
    out_path = sys.argv[3] if len(sys.argv) > 3 else "loop-letters-synth.wav"

    letters = []
    for symbol in word:
        name = LETTER_NAMES.get(symbol)
        if not name:
            continue
        semitone = SEMITONES.get(symbol, 0)
        factor = 2 ** (semitone / 12)
        data = fv.speak_word(name, f0_start=112 * factor, f0_end=96 * factor)
        letters.append((symbol, data))

    loop, rate = read_wav(loop_path)
    assert rate == RATE, loop_path
    length = len(loop)

    word_span = int(len(letters) * STEP * RATE) + int(BAR * RATE)
    voice = np.zeros(length, dtype=np.float32)
    position = 0
    count = 0
    while position < length:
        symbol, data = letters[count % len(letters)]
        end = min(length, position + len(data))
        voice[position:end] += data[:end - position]
        count += 1
        position += int(STEP * RATE)
        if count % len(letters) == 0:
            position += int(BAR * RATE)

    voice = voice / (np.abs(voice).max() + 1e-9) * 0.34
    mixed = loop * (1.0 - 0.38 * envelope(voice)) + voice
    top = np.abs(mixed).max()
    if top > 0.95:
        mixed *= 0.95 / top
    write_wav(out_path, mixed)
    print("слово:", word, "| букв:", len(letters), "| проговариваний:",
          round(count / len(letters), 1), "| пик %.3f | RMS %.3f" % (
              float(np.abs(mixed).max()), float(np.sqrt((mixed ** 2).mean()))))


if __name__ == "__main__":
    main()
