# -*- coding: utf-8 -*-
"""Цифры нечеловеческим голосом: SAPI → жёсткая обработка ffmpeg → вокодерный робот.

Шаг 1: синтез каждой цифры отдельным файлом (ru-RU и en-US).
Шаг 2: обработка — понижение с формантами, кольцевая модуляция, биткрашер, полоса.
Шаг 3: разложить по сетке 125 BPM и подмешать в петлю.
"""
import os, subprocess, sys, wave
import numpy as np

OUT = r"E:\NineToZero\voice"
RAW = os.path.join(OUT, "raw")
PROC = os.path.join(OUT, "robot")
os.makedirs(RAW, exist_ok=True)
os.makedirs(PROC, exist_ok=True)

FFMPEG = r"C:\Users\Mhl\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.1-full_build\bin\ffmpeg.exe"

DIGITS_RU = ["один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь"]
DIGITS_EN = ["one", "two", "three", "four", "five", "six", "seven", "eight"]


def say(words, voice, prefix):
    """Синтез реплик через System.Speech: по одному WAV на слово."""
    from System.Speech.Synthesis import SpeechSynthesizer  # noqa: F401  (загружается через Add-Type)
    return None


def synth_with_powershell(words, voice, prefix):
    lines = ["Add-Type -AssemblyName System.Speech",
             "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer",
             f"$s.SelectVoice('{voice}')",
             "$s.Rate = -2",
             "$s.Volume = 100"]
    for index, word in enumerate(words, 1):
        path = os.path.join(RAW, f"{prefix}-{index}.wav").replace("'", "''")
        lines.append(f"$s.SetOutputToWaveFile('{path}')")
        lines.append(f"$s.Speak('{word}')")
        lines.append("$s.SetOutputToNull()")
    lines.append("$s.Dispose()")
    script = os.path.join(OUT, f"say-{prefix}.ps1")
    with open(script, "w", encoding="utf-8-sig") as stream:
        stream.write("\n".join(lines))
    subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script], check=True)


def process(src, dst, pitch=0.72, ring=58, mix=0.42, bits=6):
    """Цепочка: питч вниз, кольцевая модуляция, биткрашер, полоса как у вокодера."""
    chain = (
        f"asetrate=44100*{pitch},aresample=44100,atempo={1/pitch:.5f},"
        f"aeval=val(0)*(1-{mix})+val(0)*sin(2*PI*{ring}*t)*{mix},"
        f"acrusher=bits={bits}:mode=log:mix=1,"
        "highpass=f=220,lowpass=f=4200,"
        "alimiter=limit=0.9"
    )
    subprocess.run([FFMPEG, "-v", "error", "-i", src, "-af", chain, "-ar", "44100", "-ac", "1",
                    "-y", dst], check=True)


def read_wav(path):
    with wave.open(path, "rb") as stream:
        frames = stream.readframes(stream.getnframes())
        rate = stream.getframerate()
        channels = stream.getnchannels()
    data = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768
    if channels > 1:
        data = data.reshape(-1, channels).mean(axis=1)
    return data, rate


def write_wav(path, data, rate=44100):
    pcm = np.clip(data, -1, 1)
    with wave.open(path, "wb") as stream:
        stream.setnchannels(1)
        stream.setsampwidth(2)
        stream.setframerate(rate)
        stream.writeframes((pcm * 32767).astype(np.int16).tobytes())


def build(prefix, count, rate=44100):
    """Собрать дорожку из цифр: одна цифра на такт 125 BPM (1,92 с)."""
    bar = 1.92
    total = int(bar * len(count) * rate) + rate
    track = np.zeros(total, dtype=np.float32)
    for index, number in enumerate(count):
        path = os.path.join(PROC, f"{prefix}-{number}.wav")
        if not os.path.exists(path):
            continue
        data, source_rate = read_wav(path)
        if source_rate != rate:
            continue
        # Обрезаем тишину по краям, чтобы цифра села в начало такта.
        loud = np.where(np.abs(data) > 0.02)[0]
        if len(loud):
            data = data[max(0, loud[0] - 200):loud[-1] + 200]
        start = int(index * bar * rate)
        end = min(total, start + len(data))
        track[start:end] += data[:end - start]
    return track, rate


if __name__ == "__main__":
    synth_with_powershell(DIGITS_RU, "Microsoft Irina Desktop", "ru")
    synth_with_powershell(DIGITS_EN, "Microsoft Zira Desktop", "en")
    print("синтез готов")

    for prefix, words in (("ru", DIGITS_RU), ("en", DIGITS_EN)):
        for index in range(1, 9):
            src = os.path.join(RAW, f"{prefix}-{index}.wav")
            dst = os.path.join(PROC, f"{prefix}-{index}.wav")
            process(src, dst)
    print("обработка готова")

    for prefix in ("ru", "en"):
        numbers = list(range(1, 9)) * 3
        track, rate = build(prefix, numbers)
        path = os.path.join(OUT, f"count-{prefix}.wav")
        write_wav(path, track * 0.9, rate)
        print("дорожка:", path, len(track) / rate, "с")
