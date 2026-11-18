#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Produce three dry 'ноль, один' comparisons; no tests or listening.

Run from repository root: python music/voices/build.py
Dependencies: Python, NumPy, Node.js. Existing engine files are never edited.
"""
from __future__ import annotations

from array import array
import hashlib
import importlib.util
import json
from pathlib import Path
import platform
import subprocess
import sys
import wave

sys.dont_write_bytecode = True
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
RATE = 44100
TOTAL = round(2.4 * RATE)
ONSETS = [round(.20 * RATE), round(1.20 * RATE)]
WORDS = ['ноль', 'один']
PEAK = .7


def load_module(name: str, file: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def resample_twice_linear(samples: list[float]) -> list[float]:
    # Exact x2 format conversion: original at even indices, midpoint at odd.
    # Extend the final sample for the final midpoint; no pitch/time shift.
    out = []
    for index, value in enumerate(samples):
        following = samples[min(index + 1, len(samples) - 1)]
        out.extend([value, .5 * (value + following)])
    return out


def write_phrase(identifier: str, label: str, words: list[list[float]], details: dict) -> dict:
    signal = [0.] * TOTAL
    timings = []
    for text, start, samples in zip(WORDS, ONSETS, words):
        # Layout errors are production errors, not a separate acceptance suite.
        if start + len(samples) > TOTAL:
            raise ValueError('Word exceeds the common production duration: ' + text)
        for offset, sample in enumerate(samples):
            signal[start + offset] += float(sample)
        timings.append({'text': text, 'onsetFrame': start, 'onsetSeconds': start / RATE,
                        'frames': len(samples), 'durationSeconds': len(samples) / RATE,
                        'endSeconds': (start + len(samples)) / RATE})
    source_peak = max(abs(sample) for sample in signal)
    gain = PEAK / source_peak if source_peak else 1.
    pcm = array('h', (round(max(-1., min(1., sample * gain)) * 32767) for sample in signal))
    if sys.byteorder != 'little':
        pcm.byteswap()
    output = HERE / (identifier + '.wav')
    with wave.open(str(output), 'wb') as stream:
        stream.setnchannels(1)
        stream.setsampwidth(2)
        stream.setframerate(RATE)
        stream.writeframes(pcm.tobytes())
    record = {'id': identifier, 'label': label, 'file': output.name,
              'sampleRate': RATE, 'channels': 1, 'bitsPerSample': 16,
              'frames': TOTAL, 'durationSeconds': TOTAL / RATE,
              'words': timings, 'phraseGain': gain, 'targetPhrasePeak': PEAK,
              'normalization': 'One linear gain for the entire two-word phrase; no extra word/phoneme normalization',
              'engine': details, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest()}
    print(f'{output.name}: {TOTAL} frames; {TOTAL / RATE:.3f}s; SHA256 {record["sha256"]}')
    return record


def main() -> None:
    bank_file = 'mayatnik/sign-voice/generate_procedural_bank.py'
    formant_file = 'tools/voice/formant_voice.py'
    bank = load_module('comparison_procedural_bank', bank_file)
    formant = load_module('comparison_formant_voice', formant_file)
    source_table = bank.make_source_table()
    recipes = {character: (spoken, score) for character, spoken, score in bank.DIGITS}
    bank_words, bank_scores = [], []
    for character in ['0', '1']:
        spoken, score = recipes[character]
        pcm = bank.synthesize(character, score, source_table)
        samples = [value / 32767. for value in pcm]
        bank_words.append(resample_twice_linear(samples))
        bank_scores.append({'character': character, 'spoken': spoken, 'score': score})
    items = [write_phrase('bank', 'Банк знаков · четыре форманты', bank_words, {
        'source': bank_file, 'entry': 'make_source_table(); synthesize(character, score, table)',
        'sourceSampleRate': 22050, 'resampling': 'Linear interpolation x2 from 22050 to 44100 Hz; fixed duration/pitch',
        'scores': bank_scores, 'pitch': 'Native contour: 124 − 17*n/N + 1.8*sin(2*pi*2.1*n/22050) Hz',
        'inheritedProcessing': 'synthesize() already normalizes each complete word to peak 0.88, applies edge fades and quantizes PCM16; preserved unchanged',
        'noise': 'Native xorshift32 seeded per character as specified in the source'})]
    formant_words = [formant.speak_word(text, f0_start=112, f0_end=96).tolist() for text in WORDS]
    items.append(write_phrase('formant', 'Импульсный голос · три форманты', formant_words, {
        'source': formant_file, 'entry': 'speak_word(text, f0_start=112, f0_end=96)',
        'texts': WORDS, 'sourceSampleRate': 44100, 'resampling': None,
        'f0Start': 112, 'f0End': 96,
        'pitch': 'Native linear contour resets inside each voiced phoneme',
        'inheritedProcessing': 'Raw speak_word output; write_wav() and its per-word normalization are not called',
        'pronunciationLimit': 'Soft sign in ноль is removed by the native engine; no palatalization',
        'noise': 'Native numpy.random.default_rng(7) for each noise segment'}))
    helper = subprocess.run(['node', str(HERE / 'phone-helper.cjs')], cwd=ROOT,
                            capture_output=True, text=True, encoding='utf-8', check=True)
    phone = json.loads(helper.stdout)
    phone_words = [entry['samples'] for entry in phone['words']]
    items.append(write_phrase('phone', 'Телефонный робот · битовые гармоники', phone_words, {
        'source': 'mayatnik/mayatnik-phone-robot.js', 'entry': 'renderVoice(settings)',
        'settings': [entry['settings'] for entry in phone['words']],
        'sourceSampleRate': 44100, 'resampling': None,
        'bitsChoice': 'Eight ones: all partials excited, fixed explicit mask for both words; no changing field input',
        'pitch': 'Native default MIDI48, explicit f0=440*2^((48-69)/12), constant during each word',
        'inheritedProcessing': 'Native per-word headroom normalization and tanh preserved unchanged',
        'noise': 'Native word+bits hash followed by xorshift32'}))
    source_paths = ['music/voices/build.py', 'music/voices/phone-helper.cjs', bank_file,
                    formant_file, 'mayatnik/mayatnik-phone-robot.js', 'mayatnik/mayatnik-synthesis-music.js']
    source_hashes = [{'file': relative, 'hashEncoding': 'UTF-8, LF',
                     'sha256': hashlib.sha256((ROOT / relative).read_text(encoding='utf-8').replace('\r\n', '\n').encode('utf-8')).hexdigest()}
                    for relative in source_paths]
    manifest = {'version': 1, 'task': 'МУЗ-001', 'release': '2026-11-18',
                'title': 'Три собственных голоса: ноль, один',
                'command': 'python music/voices/build.py',
                'environment': {'python': platform.python_version(), 'numpy': np.__version__,
                                'node': phone['node'], 'platform': sys.platform},
                'comparison': {'text': 'ноль, один', 'onsetsSeconds': [.20, 1.20],
                               'durationSeconds': TOTAL / RATE, 'phrasePeak': PEAK,
                               'samePitch': False, 'timeStretch': False, 'pitchShift': False,
                               'effectsAdded': [], 'musicAdded': False,
                               'limitation': 'Native articulation, pitch, word durations and internal word-level processing differ; peak matching is not perceived-loudness matching'},
                'provenance': {'audioInputs': [], 'recordings': [], 'trainedModels': [],
                               'networkInputs': [], 'speechEngines': 'Only the three readable repository procedural engines',
                               'note': 'Samples freshly computed from source; no previous audio files are loaded'},
                'status': 'Production completed; no tests, syntax checks, browser or listening performed',
                'sourceFiles': source_hashes, 'items': items}
    (HERE / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
