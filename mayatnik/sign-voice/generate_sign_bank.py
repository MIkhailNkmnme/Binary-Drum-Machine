#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build and verify the reusable Russian/English sign speech bank with Windows SAPI.

Requires Microsoft Irina Desktop (ru-RU), Microsoft Zira Desktop (en-US),
Windows PowerShell, and Python with NumPy. Run from any directory:
    python mayatnik/sign-voice/generate_sign_bank.py
All generated and temporary files stay in this folder.
"""
from __future__ import annotations

import json
import math
import os
from pathlib import Path
import subprocess
import tempfile
import wave

import numpy as np


HERE = Path(__file__).resolve().parent
RATE = 22_050
GUARD_MS = 50
GUARD = round(RATE * GUARD_MS / 1000)
THRESHOLD = 0.0025
TARGET_PEAK = 0.88

LATIN = {
    'A': 'ay', 'B': 'bee', 'C': 'cee', 'D': 'dee', 'E': 'ee', 'F': 'ef',
    'G': 'gee', 'H': 'aitch', 'I': 'eye', 'J': 'jay', 'K': 'kay', 'L': 'el',
    'M': 'em', 'N': 'en', 'O': 'oh', 'P': 'pee', 'Q': 'cue', 'R': 'ar',
    'S': 'ess', 'T': 'tee', 'U': 'you', 'V': 'vee', 'W': 'double u',
    'X': 'ex', 'Y': 'why', 'Z': 'zee',
}
CYRILLIC = {
    'А': 'а', 'Б': 'бэ', 'В': 'вэ', 'Г': 'гэ', 'Д': 'дэ', 'Е': 'е', 'Ё': 'ё',
    'Ж': 'жэ', 'З': 'зэ', 'И': 'и', 'Й': 'и краткое', 'К': 'ка', 'Л': 'эль',
    'М': 'эм', 'Н': 'эн', 'О': 'о', 'П': 'пэ', 'Р': 'эр', 'С': 'эс', 'Т': 'тэ',
    'У': 'у', 'Ф': 'эф', 'Х': 'ха', 'Ц': 'цэ', 'Ч': 'че', 'Ш': 'ша', 'Щ': 'ща',
    'Ъ': 'твёрдый знак', 'Ы': 'ы', 'Ь': 'мягкий знак', 'Э': 'э', 'Ю': 'ю', 'Я': 'я',
}
DIGITS = {
    '0': 'ноль', '1': 'один', '2': 'два', '3': 'три', '4': 'четыре',
    '5': 'пять', '6': 'шесть', '7': 'семь', '8': 'восемь', '9': 'девять',
}


def powershell_quote(value: str) -> str:
    return value.replace("'", "''")


def synthesize_raw(records: list[tuple[str, str, str]], raw_dir: Path) -> None:
    lines = [
        'Add-Type -AssemblyName System.Speech',
        '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
        '$s.Rate = -1', '$s.Volume = 100',
    ]
    active_voice = None
    for index, (key, phrase, voice) in enumerate(records):
        if voice != active_voice:
            lines.append(f"$s.SelectVoice('{powershell_quote(voice)}')")
            active_voice = voice
        destination = raw_dir / f'{index:03d}.wav'
        lines.extend([
            f"$s.SetOutputToWaveFile('{powershell_quote(str(destination))}')",
            f"$s.Speak('{powershell_quote(phrase)}')",
            '$s.SetOutputToNull()',
        ])
    lines.extend(['$s.Dispose()', ''])
    script_path = raw_dir / 'synthesize.ps1'
    script_path.write_text('\n'.join(lines), encoding='utf-8-sig')
    subprocess.run(
        ['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', str(script_path)],
        check=True,
    )


def read_mono_float(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path), 'rb') as stream:
        channels = stream.getnchannels()
        width = stream.getsampwidth()
        rate = stream.getframerate()
        frames = stream.getnframes()
        payload = stream.readframes(frames)
    if width != 2:
        raise ValueError(f'Expected 16-bit SAPI PCM at {path}, got {width * 8}-bit')
    samples = np.frombuffer(payload, dtype='<i2').astype(np.float32) / 32768.0
    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1)
    return samples, rate


def resample_linear(samples: np.ndarray, source_rate: int, target_rate: int = RATE) -> np.ndarray:
    if source_rate == target_rate:
        return samples.astype(np.float32, copy=False)
    output_length = round(len(samples) * target_rate / source_rate)
    old_positions = np.arange(len(samples), dtype=np.float64)
    new_positions = np.arange(output_length, dtype=np.float64) * source_rate / target_rate
    return np.interp(new_positions, old_positions, samples).astype(np.float32)


def trim_and_normalize(samples: np.ndarray) -> np.ndarray:
    audible = np.flatnonzero(np.abs(samples) >= THRESHOLD)
    if audible.size == 0:
        raise ValueError('SAPI returned a silent clip')
    margin = round(RATE * 0.002)  # keep two milliseconds at each speech boundary
    clip = samples[max(0, int(audible[0]) - margin):min(len(samples), int(audible[-1]) + margin + 1)].copy()
    peak = float(np.max(np.abs(clip)))
    if peak < 1e-5:
        raise ValueError('Clip has negligible level')
    clip *= TARGET_PEAK / peak
    return np.clip(clip, -0.98, 0.98)


def write_bank(path: Path, records: list[tuple[str, str, str]], raw_dir: Path) -> dict:
    segments: list[np.ndarray] = []
    clips: dict[str, list[float]] = {}
    sample_cursor = 0
    for index, (key, _phrase, _voice) in enumerate(records):
        raw, source_rate = read_mono_float(raw_dir / f'{index:03d}.wav')
        clip = trim_and_normalize(resample_linear(raw, source_rate))
        sample_cursor += GUARD
        start_sample = sample_cursor
        segments.extend([np.zeros(GUARD, dtype=np.float32), clip])
        sample_cursor += len(clip)
        clips[key] = [round(start_sample / RATE, 8), round(len(clip) / RATE, 8)]
    segments.append(np.zeros(GUARD, dtype=np.float32))
    bank = np.concatenate(segments)
    pcm = np.round(np.clip(bank, -1, 1) * 32767).astype('<i2')
    with wave.open(str(path), 'wb') as stream:
        stream.setnchannels(1)
        stream.setsampwidth(2)
        stream.setframerate(RATE)
        stream.writeframes(pcm.tobytes())
    return {'version': 1, 'clips': clips}


def verify_bank(wav_path: Path, manifest_path: Path, expected_keys: set[str]) -> None:
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    clips = manifest.get('clips', {})
    if manifest.get('version') != 1 or set(clips) != expected_keys:
        raise AssertionError(f'Clip coverage mismatch: found {len(clips)}, expected {len(expected_keys)}')
    with wave.open(str(wav_path), 'rb') as stream:
        if (stream.getnchannels(), stream.getsampwidth(), stream.getframerate()) != (1, 2, RATE):
            raise AssertionError('Bank WAV must be mono, 16-bit PCM at 22050 Hz')
        bank = np.frombuffer(stream.readframes(stream.getnframes()), dtype='<i2').astype(np.float32) / 32768.0
    previous_end = 0
    checked = []
    for key, (start_seconds, duration_seconds) in clips.items():
        start = start_seconds * RATE
        duration = duration_seconds * RATE
        start_sample, duration_samples = round(start), round(duration)
        if abs(start - start_sample) > 0.001 or abs(duration - duration_samples) > 0.001:
            raise AssertionError(f'Sample offset drift in {key}')
        end_sample = start_sample + duration_samples
        if start_sample < previous_end or duration_samples <= 0 or end_sample > len(bank):
            raise AssertionError(f'Invalid clip range for {key}')
        guard = bank[previous_end:start_sample]
        if len(guard) < GUARD - 1 or (len(guard) and float(np.max(np.abs(guard))) > 1 / 32768):
            raise AssertionError(f'Missing or noisy guard padding before {key}')
        segment = bank[start_sample:end_sample]
        if not len(segment) or float(np.max(np.abs(segment))) < 0.1:
            raise AssertionError(f'Silent clip: {key}')
        active = np.flatnonzero(np.abs(segment) >= THRESHOLD)
        if not active.size or active[0] > round(RATE * 0.006) or len(segment) - 1 - active[-1] > round(RATE * 0.006):
            raise AssertionError(f'Unexpected silence left inside clip: {key}')
        checked.append(float(np.sqrt(np.mean(segment ** 2))))
        previous_end = end_sample
    trailing_guard = bank[previous_end:]
    if len(trailing_guard) < GUARD - 1 or float(np.max(np.abs(trailing_guard))) > 1 / 32768:
        raise AssertionError('Missing or noisy trailing guard padding')
    duration_seconds = len(bank) / RATE
    expected_min = max(clips[key][0] + clips[key][1] for key in clips) + GUARD / RATE - 1 / RATE
    if duration_seconds + 1 / RATE < expected_min:
        raise AssertionError('Bank ends before the last clip and trailing guard')
    print(f'Verified {len(clips)} clips; {duration_seconds:.2f}s, {RATE}Hz mono PCM;')
    print(f'RMS range {min(checked):.3f} to {max(checked):.3f}; offsets align to sample boundaries.')


def main() -> None:
    records = (
        [(key, phrase, 'Microsoft Zira Desktop') for key, phrase in LATIN.items()]
        + [(key, phrase, 'Microsoft Irina Desktop') for key, phrase in CYRILLIC.items()]
        + [(key, phrase, 'Microsoft Irina Desktop') for key, phrase in DIGITS.items()]
    )
    if len({key for key, _phrase, _voice in records}) != len(records):
        raise AssertionError('Duplicate sign key')
    wav_path = HERE / 'sign-bank.wav'
    manifest_path = HERE / 'sign-bank.json'
    with tempfile.TemporaryDirectory(prefix='sapi-', dir=HERE) as temporary:
        raw_dir = Path(temporary)
        synthesize_raw(records, raw_dir)
        manifest = write_bank(wav_path, records, raw_dir)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    verify_bank(wav_path, manifest_path, {key for key, _phrase, _voice in records})
    print(f'Wrote {wav_path.name} ({wav_path.stat().st_size:,} bytes) and {manifest_path.name}.')


if __name__ == '__main__':
    main()
