# -*- coding: utf-8 -*-
"""Буквы голосом: каждая буква синтезируется отдельно, расчеловечивается и получает ступень лада.

Порядок: SAPI (en) → питч по ступени до-минора + кольцевая модуляция + биткрашер →
раскладка по сетке 125 BPM → заворот хвоста → подмешивание в петлю.
"""
import os, subprocess, wave
import numpy as np

OUT = r"E:\NineToZero\voice"
RAW = os.path.join(OUT, "letters-raw")
PROC = os.path.join(OUT, "letters-robot")
os.makedirs(RAW, exist_ok=True)
os.makedirs(PROC, exist_ok=True)

FFMPEG = r"C:\Users\Mhl\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.1-full_build\bin\ffmpeg.exe"
RATE = 44100
BAR = 1.92                 # такт 125 BPM
STEP = 0.48                # восьмая
MINOR = [0, 2, 3, 5, 7, 8, 10]


def synth(letters, voice="Microsoft Zira Desktop"):
    lines = ["Add-Type -AssemblyName System.Speech",
             "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer",
             f"$s.SelectVoice('{voice}')",
             "$s.Rate = -3", "$s.Volume = 100"]
    for letter in letters:
        path = os.path.join(RAW, f"{letter}.wav").replace("'", "''")
        lines.append(f"$s.SetOutputToWaveFile('{path}')")
        lines.append(f"$s.Speak('{letter}')")
        lines.append("$s.SetOutputToNull()")
    lines.append("$s.Dispose()")
    script = os.path.join(OUT, "say-letters.ps1")
    open(script, "w", encoding="utf-8-sig").write("\n".join(lines))
    subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script], check=True)


def process(src, dst, factor):
    chain = (
        f"asetrate=44100*{factor:.5f},aresample=44100,atempo={1/factor:.5f},"
        "aeval=val(0)*0.58+val(0)*sin(2*PI*58*t)*0.42,"
        "acrusher=bits=6:mode=log:mix=1,"
        "highpass=f=220,lowpass=f=4200,"
        "alimiter=limit=0.9"
    )
    subprocess.run([FFMPEG, "-v", "error", "-i", src, "-af", chain, "-ar", str(RATE), "-ac", "1", "-y", dst], check=True)


def read_wav(path):
    with wave.open(path, "rb") as stream:
        frames = stream.readframes(stream.getnframes())
        rate = stream.getframerate()
        channels = stream.getnchannels()
    data = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768
    if channels > 1:
        data = data.reshape(-1, channels).mean(axis=1)
    return data, rate


def write_wav(path, data, rate=RATE, stereo=False):
    pcm = np.clip(data, -1, 1)
    with wave.open(path, "wb") as stream:
        stream.setnchannels(2 if stereo else 1)
        stream.setsampwidth(2)
        stream.setframerate(rate)
        stream.writeframes((pcm * 32767).astype(np.int16).tobytes())


def trim(data, threshold=0.02):
    loud = np.where(np.abs(data) > threshold)[0]
    if not len(loud):
        return data
    return data[max(0, loud[0] - 150):loud[-1] + 250]


def spell(word):
    """Дорожка: по букве на восьмую, слово повторяется каждые четыре такта."""
    letters = [letter for letter in word]
    total = 0
    while total < 24 * BAR:
        total += len(letters) * STEP + BAR          # слово + пауза в такт
    length = int(total * RATE)
    track = np.zeros(length, dtype=np.float32)
    position = 0.0
    index = 0
    while position * RATE < length:
        letter = letters[index % len(letters)]
        path = os.path.join(PROC, f"{letter}.wav")
        if os.path.exists(path):
            data, rate = read_wav(path)
            data = trim(data)
            start = int(position * RATE)
            end = min(length, start + len(data))
            track[start:end] += data[:end - start]
        position += STEP
        index += 1
        if index % len(letters) == 0:
            position += BAR                          # пауза после слова
    return track, RATE


if __name__ == "__main__":
    words = ["ZERKALIUS", "NINETOZERO"]
    letters = sorted({letter for word in words for letter in word})
    synth(letters)
    print("синтез букв:", "".join(letters))
    for index, letter in enumerate(letters):
        step = MINOR[index % len(MINOR)]
        factor = 0.72 * 2 ** ((step - 3) / 12)
        process(os.path.join(RAW, f"{letter}.wav"), os.path.join(PROC, f"{letter}.wav"), factor)

    loop, _ = read_wav(r"E:\NineToZero\music\zerkalius-loop.wav")
    length = len(loop)
    for word in words:
        track, rate = spell(word)
        write_wav(os.path.join(OUT, f"letters-{word.lower()}.wav"), track * 0.9)

        mixed = np.stack([loop, loop], axis=1).astype(np.float32)
        wrapped = np.zeros(length, dtype=np.float32)
        for index in range(len(track)):
            wrapped[index % length] += track[index]
        peak = np.abs(track).max() + 1e-9
        wrapped = wrapped / peak * 0.2               # голос по пику, музыку не давим
        mixed[:, 0] += wrapped * 0.95
        mixed[:, 1] += wrapped * 0.75
        top = np.abs(mixed).max()
        if top > 0.95:
            mixed *= 0.95 / top
        write_wav(os.path.join(OUT, f"loop-letters-{word.lower()}.wav"),
                  mixed.reshape(-1), stereo=True)
        print(word, "| букв:", len(word),
              "| повторов в петле:", round(length / rate / (len(word) * STEP + BAR), 1),
              "| пик:", round(float(np.abs(mixed).max()), 3),
              "| RMS:", round(float(np.sqrt((mixed ** 2).mean())), 3))
