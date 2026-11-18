#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Produce two complete Russian sound alphabets and a Telegram ZIP.

No audio is read as a source. No tests or listening are performed.
Run: python voice/alphabet/build.py --node node
Requires Python + NumPy and Node.js. The original engine files are not modified.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import platform
import subprocess
import sys
import wave
import zipfile

sys.dont_write_bytecode = True
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
RATE = 44100
PEAK = .7
LEAD = .2
GAP = .45
RELEASE = '2026-11-18'


def source_hash(relative):
    text = (ROOT / relative).read_text(encoding='utf-8').replace('\r\n', '\n')
    return {'file': relative, 'encoding': 'UTF-8, LF', 'sha256': hashlib.sha256(text.encode('utf-8')).hexdigest()}


def load_deepseek():
    source = ROOT / 'tools/voice/formant_voice.py'
    spec = importlib.util.spec_from_file_location('alphabet_deepseek_source', source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def normalize(signal):
    signal = np.asarray(signal, dtype=np.float64)
    if not np.isfinite(signal).all():
        raise ValueError('Non-finite production samples')
    peak = float(np.max(np.abs(signal))) if len(signal) else 0.
    return signal * (PEAK / peak if peak else 1.)


def write_wav(directory, filename, signal):
    directory.mkdir(parents=True, exist_ok=True)
    pcm = np.rint(np.clip(signal, -1, 1) * 32767).astype('<i2')
    file = directory / filename
    with wave.open(str(file), 'wb') as stream:
        stream.setnchannels(1)
        stream.setsampwidth(2)
        stream.setframerate(RATE)
        stream.writeframes(pcm.tobytes())
    return {'file': file.relative_to(HERE).as_posix(), 'sampleRate': RATE, 'channels': 1,
            'bitsPerSample': 16, 'sampleCount': len(pcm), 'duration': len(pcm) / RATE,
            'sha256': hashlib.sha256(file.read_bytes()).hexdigest()}


def sequence(directory, filename, clips):
    cursor = round(LEAD * RATE)
    gap = round(GAP * RATE)
    signal = np.zeros(cursor + sum(len(samples) + gap for _, samples in clips))
    timeline = []
    for item, samples in clips:
        signal[cursor:cursor + len(samples)] = samples
        timeline.append({'symbol': item['symbol'], 'file': item['file'], 'onsetSample': cursor,
                         'onset': cursor / RATE, 'sampleCount': len(samples), 'duration': len(samples) / RATE})
        cursor += len(samples) + gap
    return {**write_wav(directory, filename, signal), 'leadSeconds': LEAD, 'gapSeconds': GAP, 'timeline': timeline}


# Same explicit segment durations as the Zerkalius alphabet. This is OUR adapter:
# it uses DeepSeek's source/filter primitives but does not alter that source file.
PHONE_SYMBOLS = {'a': 'а', 'e': 'э', 'i': 'и', 'o': 'о', 'u': 'у', 'y': 'ы',
                 'b': 'б', 'v': 'в', 'g': 'г', 'd': 'д', 'j': 'й', 'k': 'к', 'l': 'л',
                 'm': 'м', 'n': 'н', 'p': 'п', 'r': 'р', 's': 'с', 't': 'т',
                 'f': 'ф', 'h': 'х', 'ts': 'ц', 'ch': 'ч', 'sh': 'ш', 'z': 'з'}


def deepseek_segment(engine, token, duration, letter):
    if token in ('zh', 'shj'):
        # These two sounds do not exist in the historical DeepSeek table.
        # Newly authored extension, not an attribution of these recipes to DeepSeek.
        noise = engine.noise_burst(duration)
        if token == 'zh':
            voiced = engine.glottal_source(duration, 112, 96)
            signal = .30 * engine.resonator(voiced, 300, 160)
            signal += engine.resonator(noise, 2400, 900)
            signal += .30 * engine.resonator(noise, 3600, 1200)
            recipe = {'extension': 'our voiced fricative Ж', 'noiseSeed': 7,
                      'branches': [{'source': 'glottal', 'frequency': 300, 'bandwidth': 160, 'weight': .30},
                                   {'source': 'noise', 'frequency': 2400, 'bandwidth': 900, 'weight': 1.},
                                   {'source': 'noise', 'frequency': 3600, 'bandwidth': 1200, 'weight': .30}]}
        else:
            signal = engine.resonator(noise, 3200, 700)
            signal += .50 * engine.resonator(noise, 4800, 1000)
            signal += .25 * engine.resonator(noise, 6500, 1300)
            recipe = {'extension': 'our long soft fricative Щ', 'noiseSeed': 7,
                      'branches': [{'source': 'noise', 'frequency': 3200, 'bandwidth': 700, 'weight': 1.},
                                   {'source': 'noise', 'frequency': 4800, 'bandwidth': 1000, 'weight': .50},
                                   {'source': 'noise', 'frequency': 6500, 'bandwidth': 1300, 'weight': .25}]}
        return engine.shapen(signal, .01, .02), recipe

    symbol = 'е' if letter == 'Е' and token == 'e' else PHONE_SYMBOLS[token]
    if symbol in engine.VOWELS:
        f1, f2, f3, loud = engine.VOWELS[symbol]
        source = engine.glottal_source(duration, 112, 96)
        signal = engine.resonator(source, f1, 90)
        signal += .6 * engine.resonator(source, f2, 110)
        signal += .3 * engine.resonator(source, f3, 160)
        return engine.shapen(signal * loud, .02, .04), {'nativeSymbol': symbol, 'kind': 'vowel',
                    'formants': [f1, f2, f3], 'bandwidths': [90, 110, 160], 'weights': [1, .6, .3], 'loudness': loud}
    kind, formants, native_duration, loud = engine.CONSONANTS[symbol]
    if kind == 'fricative':
        signal = engine.resonator(engine.noise_burst(duration), formants[1], 1800)
        signal = engine.shapen(signal * loud, .01, .02)
    elif kind in ('plosive', 'affricate'):
        source = engine.noise_burst(duration)
        source *= np.linspace(1, .1, len(source))
        signal = engine.shapen(engine.resonator(source, formants[1], 900) * loud, .002, .02)
    elif kind == 'nasal':
        source = engine.glottal_source(duration, 112, 96)
        signal = .8 * engine.resonator(source, formants[0], 120)
        signal += .2 * engine.resonator(source, formants[1], 200)
        signal = engine.shapen(signal * loud, .01, .03)
    elif kind == 'trill':
        source = engine.glottal_source(duration, 112, 96)
        tremolo = 1 + .75 * np.sin(2 * np.pi * 26 * np.arange(len(source)) / RATE)
        signal = engine.shapen(engine.resonator(source * tremolo, formants[1], 200) * loud, .01, .03)
    else:
        source = engine.glottal_source(duration, 112, 96)
        signal = .5 * engine.resonator(source, formants[0], 160)
        signal += engine.resonator(source, formants[1], 200)
        signal = engine.shapen(signal * loud, .01, .03)
    return signal, {'nativeSymbol': symbol, 'kind': kind, 'formants': list(formants),
                    'nativeDuration': native_duration, 'durationOverride': duration, 'loudness': loud}


def produce_deepseek(alphabet):
    engine = load_deepseek()
    directory = HERE / 'deepseek-adapted'
    sounds = []
    for letter in alphabet:
        if letter['silent']:
            continue
        parts, recipes = [], []
        for token in letter['score']:
            samples, recipe = deepseek_segment(engine, token['id'], token['duration'], letter['symbol'])
            parts.append(samples)
            recipes.append({'token': token['id'], 'duration': token['duration'], **recipe})
        samples = normalize(np.concatenate(parts))
        item = {**write_wav(directory, Path(letter['file']).name, samples), 'symbol': letter['symbol'],
                'label': letter['label'], 'kind': 'sound', 'segments': recipes, 'targetPeak': PEAK}
        sounds.append((item, samples))
    words = ['ноль', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять']
    digits = []
    for number, word in enumerate(words):
        mapped = ''.join(engine.LETTER_TO_PHONEME.get(symbol, symbol) for symbol in word)
        if any(symbol not in engine.VOWELS and symbol not in engine.CONSONANTS for symbol in mapped):
            raise ValueError('Unmapped phoneme in digit production: ' + word)
        samples = normalize(engine.speak_word(word, f0_start=112, f0_end=96))
        item = {**write_wav(directory, f'digit-{number}.wav', samples), 'symbol': str(number), 'kind': 'digit',
                'label': word, 'text': word, 'mappedText': mapped, 'entry': 'speak_word', 'targetPeak': PEAK}
        digits.append((item, samples))
    metadata = {'id': 'deepseek-adapted', 'label': 'DeepSeek · исходный DSP + наш адаптер алфавита',
                'engineSource': 'tools/voice/formant_voice.py', 'adapterSource': 'voice/alphabet/build.py',
                'f0Start': 112, 'f0End': 96, 'noiseSeed': 7,
                'adaptation': 'Native synthesis branches, explicit letter durations; new Ж/Щ recipes; Е/Ё/Ю/Я = й + vowel; no source edits.',
                'limitations': 'Voiced/unvoiced stop pairs are weakly distinguished in the source. Digits retain native removal of ь and я→а; no contextual palatalization.',
                'items': [item for item, _ in sounds + digits],
                'sequences': [sequence(directory, 'alphabet.wav', sounds), sequence(directory, 'digits.wav', digits)]}
    (directory / 'production.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'DeepSeek + adapter: {len(sounds)} sound WAVs, {len(digits)} digit WAVs, two sequences.')
    return metadata


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--node', default='node', help='Node.js executable')
    args = parser.parse_args()
    subprocess.run([args.node, str(HERE / 'build-zerkalius.cjs')], cwd=ROOT, check=True)
    own = json.loads((HERE / 'zerkalius/production.json').read_text(encoding='utf-8'))
    deepseek = produce_deepseek(own['alphabet'])
    sources = ['voice/alphabet/build.py', 'voice/alphabet/build-zerkalius.cjs', 'voice/engine.js',
               'voice/catalog.js', 'tools/voice/formant_voice.py']
    manifest = {'version': 1, 'release': RELEASE, 'title': 'Русский алфавит звуков: 31 звук, два немых знака',
                'command': 'python voice/alphabet/build.py --node node',
                'environment': {'python': platform.python_version(), 'numpy': np.__version__, 'node': own['node']},
                'alphabet': own['alphabet'], 'silentSigns': ['Ъ', 'Ь'], 'engines': [own, deepseek],
                'policy': '../../ЗВУК.md', 'sourceFiles': [source_hash(source) for source in sources],
                'provenance': {'audioInputs': [], 'recordings': [], 'trainedModels': [], 'networkAudio': [],
                    'waveform': 'Fresh mathematical source/filter synthesis; no previous WAV is an input.',
                    'DeepSeekAttribution': 'User-confirmed original formant_voice.py author; new alphabet adapter and Ж/Щ additions are ours.'},
                'comparison': {'samePcmFormat': 'mono PCM16, 44100 Hz', 'targetClipPeak': PEAK,
                    'samePitch': False, 'samePerceivedLoudness': False, 'pitchShift': False, 'timeStretch': False,
                    'durations': 'Alphabet uses the same requested segment durations; engines round samples differently. Digits retain native timings.',
                    'pronunciation': 'Consonants have no added э/а. Й is 80 ms. Е/Ё/Ю/Я use isolated initial й + vowel, not all contextual variants.',
                    'excludedRobot': 'The old phone robot exposes only zero/one/zerkalius; it is not presented as a complete alphabet.'},
                'status': 'Artifact production only; no tests, syntax checks, browser, playback or listening. Intelligibility is unverified.'}
    (HERE / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    archive = HERE / 'zerkalius-russian-sounds.zip'
    include = [ROOT / source for source in sources] + [ROOT / 'ЗВУК.md', HERE / 'README.md', HERE / 'manifest.json']
    for directory in ['zerkalius', 'deepseek-adapted']:
        include += sorted((HERE / directory).glob('*.wav'))
        include.append(HERE / directory / 'production.json')
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as output:
        for file in include:
            info = zipfile.ZipInfo(file.relative_to(ROOT).as_posix(), (2026, 11, 18, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            output.writestr(info, file.read_bytes())
    receipt = {'file': archive.name, 'bytes': archive.stat().st_size,
               'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
               'content': 'Two complete sound alphabets, digits, sequences, source, recipes, provenance; no external audio.'}
    (HERE / 'archive.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'ZIP: {receipt["bytes"]} bytes; SHA256 {receipt["sha256"]}')
    for engine in [own, deepseek]:
        for item in engine['sequences']:
            print(f'{item["file"]}: {item["sampleCount"]} samples; {item["duration"]:.6f} seconds; SHA256 {item["sha256"]}')


if __name__ == '__main__':
    main()
