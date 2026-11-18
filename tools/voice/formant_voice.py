# -*- coding: utf-8 -*-
"""Формантный голос из ничего: ни одного записанного звука.

Источник — импульсный возбудитель (голосовая щель как последовательность импульсов),
дальше три параллельных резонатора задают форманты гласных. Согласные — шумовые участки
и короткие импульсы. Никаких сэмплов, никаких голосов Windows.

Запуск: python formant_voice.py <каталог>
"""
import math
import os
import sys
import wave

import numpy as np

RATE = 44100

# Форманты русских гласных, Гц (F1, F2, F3) и относительная громкость.
VOWELS = {
    "а": (700, 1300, 2500, 1.00),
    "о": (500, 900, 2400, 0.95),
    "у": (320, 800, 2300, 0.90),
    "э": (600, 1800, 2500, 0.95),
    "и": (300, 2200, 3000, 0.85),
    "ы": (400, 1500, 2500, 0.90),
    "е": (450, 1900, 2600, 0.90),
}

# Согласные: тип, форманты для перехода, длительность (с), громкость.
CONSONANTS = {
    "д": ("plosive", (350, 1700, 2600), 0.055, 0.55),
    "т": ("plosive", (380, 1800, 2700), 0.055, 0.50),
    "к": ("plosive", (300, 1500, 2400), 0.050, 0.45),
    "п": ("plosive", (300, 900, 2200), 0.050, 0.45),
    "б": ("plosive", (300, 900, 2200), 0.055, 0.55),
    "г": ("plosive", (300, 1400, 2300), 0.055, 0.50),
    "в": ("approximant", (300, 1200, 2300), 0.070, 0.55),
    "з": ("fricative", (320, 1600, 2600), 0.080, 0.35),
    "с": ("fricative", (320, 1800, 2800), 0.090, 0.35),
    "ш": ("fricative", (300, 1500, 2400), 0.090, 0.35),
    "ф": ("fricative", (300, 1000, 2200), 0.080, 0.30),
    "х": ("fricative", (300, 1200, 2300), 0.080, 0.30),
    "ч": ("affricate", (320, 1900, 2700), 0.085, 0.40),
    "ц": ("affricate", (320, 1800, 2600), 0.085, 0.40),
    "н": ("nasal", (250, 1200, 2300), 0.070, 0.50),
    "м": ("nasal", (250, 1000, 2200), 0.070, 0.50),
    "л": ("approximant", (350, 1100, 2400), 0.065, 0.55),
    "р": ("trill", (400, 1300, 2400), 0.080, 0.55),
    "й": ("approximant", (280, 2200, 2900), 0.060, 0.45),
}

# Цифры как последовательности фонем; «ь» удаляется без моделирования мягкости.
DIGITS = {
    1: "адин",
    2: "два",
    3: "три",
    4: "читыри",
    5: "пять",
    6: "шесть",
    7: "семь",
    8: "восимь",
}


def resonator(signal, frequency, bandwidth):
    """Один резонатор (биквад): полоса пропускания вокруг frequency."""
    r = math.exp(-math.pi * bandwidth / RATE)
    theta = 2 * math.pi * frequency / RATE
    a1 = -2 * r * math.cos(theta)
    a2 = r * r
    gain = (1 - r) * math.sqrt(1 - 2 * r * math.cos(2 * theta) + r * r)
    out = np.zeros_like(signal)
    x1 = x2 = y1 = y2 = 0.0
    for index, sample in enumerate(signal):
        value = gain * sample - a1 * y1 - a2 * y2
        out[index] = value
        x2, x1 = x1, sample
        y2, y1 = y1, value
    return out


def glottal_source(duration, f0_start, f0_end, rate=RATE):
    """Импульсный возбудитель: короткие импульсы с падающей частотой."""
    count = max(1, int(duration * rate))
    out = np.zeros(count)
    phase = 0.0
    for index in range(count):
        progress = index / count
        f0 = f0_start + (f0_end - f0_start) * progress
        phase += f0 / rate
        if phase >= 1.0:
            phase -= 1.0
            # Импульс с экспоненциальным спадом: богатый гармониками спектр.
            for k in range(48):
                position = index + k
                if position >= count:
                    break
                out[position] += math.exp(-k / 6.0) * (1.0 if k == 0 else 1.0)
    return out


def noise_burst(duration, rate=RATE):
    count = max(1, int(duration * rate))
    return np.random.default_rng(7).normal(0, 1, count)


def shapen(signal, attack=0.01, release=0.03):
    """Плавные края, чтобы не было щелчков."""
    count = len(signal)
    env = np.ones(count)
    a = max(1, int(attack * RATE))
    r = max(1, int(release * RATE))
    env[:a] = np.linspace(0, 1, a)
    env[-r:] = np.linspace(1, 0, r)
    return signal * env


# Буквы, которые заменяются фонемой: я→а, ю→у, ё→о, мягкий и твёрдый знак не звучат.
LETTER_TO_PHONEME = {"я": "а", "ю": "у", "ё": "о", "ь": "", "ъ": ""}


def speak_word(text, f0_start=112, f0_end=96):
    """Собирает слово из фонем с формантной фильтрацией."""
    text = "".join(LETTER_TO_PHONEME.get(symbol, symbol) for symbol in text)
    parts = []
    for symbol in text:
        if symbol in VOWELS:
            f1, f2, f3, loud = VOWELS[symbol]
            duration = 0.13
            source = glottal_source(duration, f0_start, f0_end)
            shaped = resonator(source, f1, 90)
            shaped += 0.6 * resonator(source, f2, 110)
            shaped += 0.3 * resonator(source, f3, 160)
            shaped = shapen(shaped * loud, 0.02, 0.04)
        elif symbol in CONSONANTS:
            kind, formants, duration, loud = CONSONANTS[symbol]
            if kind == "fricative":
                source = noise_burst(duration)
                shaped = resonator(source, formants[1], 1800)
                shaped = shapen(shaped * loud, 0.01, 0.02)
            elif kind in ("plosive", "affricate"):
                source = noise_burst(duration) * np.linspace(1, 0.1, int(duration * RATE))
                shaped = resonator(source, formants[1], 900)
                shaped = shapen(shaped * loud, 0.002, 0.02)
            elif kind == "nasal":
                source = glottal_source(duration, f0_start, f0_end)
                shaped = resonator(source, formants[0], 120) * 0.8
                shaped += 0.2 * resonator(source, formants[1], 200)
                shaped = shapen(shaped * loud, 0.01, 0.03)
            elif kind == "trill":
                source = glottal_source(duration, f0_start, f0_end)
                tremolo = 1 + 0.75 * np.sin(2 * math.pi * 26 * np.arange(len(source)) / RATE)
                shaped = resonator(source * tremolo, formants[1], 200)
                shaped = shapen(shaped * loud, 0.01, 0.03)
            else:  # approximant
                source = glottal_source(duration, f0_start, f0_end)
                shaped = resonator(source, formants[0], 160) * 0.5
                shaped += resonator(source, formants[1], 200)
                shaped = shapen(shaped * loud, 0.01, 0.03)
        else:
            continue
        parts.append(shaped)
    if not parts:
        return np.zeros(int(0.1 * RATE))
    return np.concatenate(parts)


def write_wav(path, data, rate=RATE):
    peak = np.abs(data).max() or 1.0
    pcm = np.clip(data / peak * 0.9, -1, 1)
    with wave.open(path, "wb") as stream:
        stream.setnchannels(1)
        stream.setsampwidth(2)
        stream.setframerate(rate)
        stream.writeframes((pcm * 32767).astype(np.int16).tobytes())


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
    os.makedirs(out, exist_ok=True)
    np.random.seed(7)
    for number, word in DIGITS.items():
        data = speak_word(word)
        path = os.path.join(out, f"synth-digit-{number}.wav")
        write_wav(path, data)
        print(f"{number}: «{word}» — {len(data) / RATE:.2f} с")
    print("готово:", out)
