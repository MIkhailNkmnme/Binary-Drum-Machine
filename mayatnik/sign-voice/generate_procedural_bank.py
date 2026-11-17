#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ГОЛ-001: source-free, deterministic formant speech; Python standard library only.

This program generates audio. It does not run tests, invoke speech services, read
speech recordings, or evaluate intelligibility. All speech recipes are below.
"""
from __future__ import annotations

from array import array
import hashlib
import json
import math
from pathlib import Path
import sys
import wave


HERE = Path(__file__).resolve().parent
RATE = 22050
GUARD = round(0.050 * RATE)
DEMO_GAP = round(0.450 * RATE)
SEED = 0x5A45524B
TABLE_SIZE = 4096
TAU = 2.0 * math.pi

# These are hand-chosen engineering parameters, not measurements of a person.
# Formants (Hz), bandwidths (Hz), relative parallel-resonator amplitudes.
VOWELS = {
    'a': ((760, 1200, 2600, 3500), (95, 120, 180, 240), (1, .85, .45, .18)),
    'e': ((530, 1900, 2600, 3500), (85, 130, 170, 240), (1, 1.15, .45, .16)),
    'i': ((290, 2300, 3000, 3700), (65, 130, 190, 250), (1, 1.6, .65, .16)),
    'o': ((480, 850, 2450, 3500), (75, 100, 180, 240), (1, .9, .3, .12)),
    'u': ((320, 700, 2300, 3400), (65, 90, 170, 240), (1, .75, .25, .10)),
    'y': ((390, 1450, 2450, 3500), (75, 120, 180, 240), (1, 1.05, .4, .14)),
    'ax': ((500, 1300, 2500, 3500), (100, 130, 180, 240), (1, .75, .3, .12)),
    'ae': ((680, 1750, 2600, 3500), (95, 130, 180, 240), (1, 1.05, .45, .15)),
}

# character, spoken name, explicit phoneme:milliseconds score.
# j is /j/; suffix j on a consonant means palatalization. ts/ch are affricates.
# This is a finite lexicon of names, deliberately not an arbitrary-text TTS.
LATIN = [
    ('A', 'ay', 'e:220 i:110'), ('B', 'bee', 'b:75 i:290'),
    ('C', 'cee', 's:150 i:290'), ('D', 'dee', 'd:75 i:290'),
    ('E', 'ee', 'i:350'), ('F', 'ef', 'e:240 f:170'),
    ('G', 'gee', 'dzh:130 i:290'), ('H', 'aitch', 'e:180 i:90 ch:170'),
    ('I', 'eye', 'a:210 i:150'), ('J', 'jay', 'dzh:130 e:210 i:90'),
    ('K', 'kay', 'k:90 e:220 i:90'), ('L', 'el', 'e:250 l:140'),
    ('M', 'em', 'e:250 m:150'), ('N', 'en', 'e:250 n:150'),
    ('O', 'oh', 'o:240 u:100'), ('P', 'pee', 'p:85 i:290'),
    ('Q', 'cue', 'k:90 j:85 u:250'), ('R', 'ar', 'a:270 rr:150'),
    ('S', 'ess', 'e:240 s:180'), ('T', 'tee', 't:80 i:290'),
    ('U', 'you', 'j:100 u:280'), ('V', 'vee', 'v:120 i:290'),
    ('W', 'double u', 'd:65 a:160 b:65 ax:95 l:90 _:55 j:80 u:230'),
    ('X', 'ex', 'e:220 k:65 s:150'), ('Y', 'why', 'w:110 a:200 i:130'),
    ('Z', 'zee', 'z:140 i:290'),
]
CYRILLIC = [
    ('А', 'а', 'a:350'), ('Б', 'бэ', 'b:75 e:290'),
    ('В', 'вэ', 'v:130 e:290'), ('Г', 'гэ', 'g:85 e:290'),
    ('Д', 'дэ', 'd:75 e:290'), ('Е', 'е', 'j:100 e:280'),
    ('Ё', 'ё', 'j:100 o:280'), ('Ж', 'жэ', 'zh:150 e:290'),
    ('З', 'зэ', 'z:150 e:290'), ('И', 'и', 'i:350'),
    ('Й', 'и краткое', 'i:190 _:55 k:70 r:70 a:190 t:55 k:65 ax:80 j:60 e:100'),
    ('К', 'ка', 'k:85 a:290'), ('Л', 'эль', 'e:260 lj:150'),
    ('М', 'эм', 'e:260 m:150'), ('Н', 'эн', 'e:260 n:150'),
    ('О', 'о', 'o:350'), ('П', 'пэ', 'p:85 e:290'),
    ('Р', 'эр', 'e:260 r:150'), ('С', 'эс', 'e:260 s:180'),
    ('Т', 'тэ', 't:80 e:290'), ('У', 'у', 'u:350'),
    ('Ф', 'эф', 'e:260 f:180'), ('Х', 'ха', 'h:140 a:290'),
    ('Ц', 'цэ', 'ts:155 e:290'), ('Ч', 'че', 'ch:155 e:290'),
    ('Ш', 'ша', 'sh:170 a:290'), ('Щ', 'ща', 'shj:190 a:290'),
    ('Ъ', 'твёрдый знак', 't:55 vj:85 o:180 r:70 d:55 y:90 j:45 _:55 z:90 n:65 a:160 k:85'),
    ('Ы', 'ы', 'y:350'),
    ('Ь', 'мягкий знак', 'mj:85 j:50 a:160 h:55 kj:65 i:90 j:45 _:55 z:90 n:65 a:160 k:85'),
    ('Э', 'э', 'e:350'), ('Ю', 'ю', 'j:100 u:280'), ('Я', 'я', 'j:100 a:280'),
]
DIGITS = [
    ('0', 'ноль', 'n:100 o:260 lj:130'),
    ('1', 'один', 'ax:130 dj:75 i:250 n:120'),
    ('2', 'два', 'd:65 v:100 a:300'),
    ('3', 'три', 't:70 rj:90 i:290'),
    ('4', 'четыре', 'ch:110 i:90 t:65 y:220 rj:75 e:110'),
    ('5', 'пять', 'pj:80 j:60 a:270 tj:90'),
    ('6', 'шесть', 'sh:150 e:270 s:95 tj:80'),
    ('7', 'семь', 'sj:135 e:270 mj:130'),
    ('8', 'восемь', 'v:95 o:220 sj:100 i:95 mj:110'),
    ('9', 'девять', 'dj:75 e:200 vj:85 i:100 tj:85'),
]


def phone_shape(name: str, next_vowel: str = 'e') -> dict:
    """Return explicit source/filter controls for one phoneme."""
    if name in VOWELS:
        f, b, a = VOWELS[name]
        return dict(f=f, b=b, a=a, voice=1., noise=.012, kind='vowel')
    f, b, a = VOWELS[next_vowel]
    shape = dict(f=f, b=b, a=a, voice=.8, noise=.015, kind='sonorant')
    soft = name.endswith('j') and name != 'j'
    base = name[:-1] if soft else name
    if name == '_':
        shape.update(voice=0., noise=0., kind='silence')
    elif base in ('p', 'b', 't', 'd', 'k', 'g'):
        locus = {'p': 700, 'b': 700, 't': 1800, 'd': 1800, 'k': 2300, 'g': 2300}[base]
        shape.update(f=(260, 2200 if soft else locus, 3000, 4100),
                     b=(160, 450, 600, 800), a=(.5, .8, .7, .45),
                     voice=.36 if base in ('b', 'd', 'g') else 0., noise=1.7, kind='stop')
    elif base in ('s', 'z', 'sh', 'zh', 'f', 'v', 'h') or name in ('ts', 'ch', 'dzh'):
        if base in ('f', 'v'):
            frequencies, bandwidths, gains = (900, 2300, 4300, 6800), (800, 1200, 1600, 1900), (.15, .3, .55, .35)
        elif base == 'h':
            frequencies, bandwidths, gains = f, (300, 400, 550, 700), (.8, .8, .4, .1)
        elif base in ('sh', 'zh') or name in ('ch', 'dzh'):
            frequencies = (2000, 3100, 4400, 6200) if not soft and name != 'ch' else (2700, 4100, 5600, 7200)
            bandwidths, gains = (500, 800, 1000, 1400), (1., .65, .35, .2)
        else:
            frequencies = (4200, 5700, 7200, 8600) if not soft else (3600, 5100, 6700, 8200)
            bandwidths, gains = (650, 800, 1100, 1400), (.75, 1., .55, .2)
        shape.update(f=frequencies, b=bandwidths, a=gains,
                     voice=.45 if base in ('z', 'zh', 'v') or name == 'dzh' else 0.,
                     noise=.8 if base in ('f', 'v', 'h') else 1.05,
                     kind='affricate' if name in ('ts', 'ch', 'dzh') else 'fricative')
    elif base in ('m', 'n'):
        shape.update(f=(250, 1950 if soft else (1050 if base == 'm' else 1450), 2400, 3400),
                     b=(80, 180, 260, 350), a=(1., .22, .13, .06), voice=.8)
    elif base == 'l':
        shape.update(f=(360, 2050 if soft else 1050, 2800, 3500),
                     b=(85, 140, 190, 250), a=(1., .75, .35, .12), voice=.85)
    elif base == 'r' or name == 'rr':
        shape.update(f=(380, 1850 if soft else 1450, 1900 if name == 'rr' else 2600, 3500),
                     b=(100, 160, 200, 260), a=(1., .8, .5, .12),
                     voice=.8, kind='rhotic' if name == 'rr' else 'trill')
    elif name == 'j':
        shape.update(f=(270, 2350, 3050, 3800), b=(75, 150, 200, 260),
                     a=(1., 1.5, .6, .15), voice=.85)
    elif name == 'w':
        shape.update(f=(300, 650, 2300, 3400), voice=.85)
    else:
        raise ValueError('Unknown recipe phoneme: ' + name)
    return shape


def make_source_table() -> list[float]:
    """A periodic mathematical source, never a recorded vocal waveform."""
    return [sum(math.sin(TAU * h * n / TABLE_SIZE) * math.exp(-h / 40.) / h
                for h in range(1, 61)) for n in range(TABLE_SIZE)]


def resonator(frequency: float, bandwidth: float) -> tuple[float, float, float]:
    # H(z) = gain / (1 - 2r cos(w) z^-1 + r^2 z^-2).
    # gain makes |H(exp(iw))| = 1 at the designated frequency.
    radius = math.exp(-math.pi * bandwidth / RATE)
    angle = TAU * frequency / RATE
    gain = (1. - radius) * math.sqrt(1. - 2. * radius * math.cos(2. * angle) + radius * radius)
    return gain, 2. * radius * math.cos(angle), -radius * radius


def synthesize(character: str, score: str, source: list[float]) -> array:
    tokens = [(part.split(':')[0], round(float(part.split(':')[1]) * RATE / 1000.)) for part in score.split()]
    total = sum(count for _, count in tokens)
    rng = (int.from_bytes(hashlib.sha256(character.encode('utf-8')).digest()[:4], 'little') ^ SEED) or 1
    states = [[0., 0.] for _ in range(4)]
    phase, sample_cursor, previous_dc, previous_out = 0., 0, 0., 0.
    samples = array('d')
    previous_shape = None
    for token_index, (name, count) in enumerate(tokens):
        next_vowel = next((p for p, _ in tokens[token_index + 1:] if p in VOWELS), 'e')
        shape = phone_shape(name, next_vowel)
        if previous_shape is None:
            previous_shape = shape
        coefficients = []
        for index in range(count):
            progress = index / max(1, count - 1)
            # Formant transitions preserve consonant-place cues into the vowel.
            if index % 32 == 0:
                transition = min(1., index / (RATE * .030))
                transition = transition * transition * (3. - 2. * transition)
                coefficients = [resonator(previous_shape['f'][k] * (1. - transition) + shape['f'][k] * transition,
                                          previous_shape['b'][k] * (1. - transition) + shape['b'][k] * transition)
                                for k in range(4)]
            f0 = 124. - 17. * sample_cursor / max(1, total) + 1.8 * math.sin(TAU * 2.1 * sample_cursor / RATE)
            phase = (phase + f0 / RATE) % 1.
            position = phase * TABLE_SIZE
            source_index = int(position)
            fraction = position - source_index
            periodic = source[source_index] * (1. - fraction) + source[(source_index + 1) % TABLE_SIZE] * fraction
            # Fully specified xorshift32: repeatable noise without random libraries.
            rng ^= (rng << 13) & 0xffffffff
            rng ^= rng >> 17
            rng ^= (rng << 5) & 0xffffffff
            rng &= 0xffffffff
            noise = rng / 2147483648. - 1.
            voiced, noisy = shape['voice'], shape['noise']
            if shape['kind'] == 'stop':
                if progress < .62:
                    voiced *= .22
                    noisy = 0.
                else:
                    noisy *= math.exp(-(progress - .62) * 13.)
                    voiced *= .35
            elif shape['kind'] == 'affricate':
                if progress < .23:
                    voiced *= .15
                    noisy = 0.
                else:
                    noisy *= min(1., (progress - .23) / .06)
            elif shape['kind'] == 'trill':
                voiced *= .35 + .65 * (.5 + .5 * math.cos(TAU * 29. * index / RATE)) ** 2
            excitation = periodic * voiced + noise * noisy
            value = 0.
            for k, (gain, feedback1, feedback2) in enumerate(coefficients):
                last, older = states[k]
                filtered = gain * excitation + feedback1 * last + feedback2 * older
                states[k][0], states[k][1] = filtered, last
                value += filtered * shape['a'][k]
            # Voiced fricatives retain a low periodic component under the noise.
            if shape['kind'] in ('fricative', 'affricate') and voiced:
                value += .13 * voiced * math.sin(TAU * phase)
            # Short boundary ramps; silence segments always emit exact zero.
            ramp = min(1., index / (RATE * .004), (count - 1 - index) / (RATE * .005))
            value *= max(0., ramp)
            if name == '_':
                value = 0.
                states = [[0., 0.] for _ in range(4)]
            dc_removed = value - previous_dc + .995 * previous_out
            previous_dc, previous_out = value, dc_removed
            samples.append(0. if name == '_' else dc_removed)
            sample_cursor += 1
        previous_shape = shape
    peak = max((abs(value) for value in samples), default=1.)
    # Phrase normalization is production, not a measurement/acceptance test.
    scale = .88 / max(peak, 1e-9)
    fade = round(.008 * RATE)
    pcm = array('h', (round(max(-1., min(1., value * scale)) * 32767 *
                            min(1., index / fade, (len(samples) - 1 - index) / fade))
                      for index, value in enumerate(samples)))
    return pcm


def write_wav(path: Path, pcm: array) -> dict:
    payload = array('h', pcm)
    if sys.byteorder != 'little':
        payload.byteswap()
    with wave.open(str(path), 'wb') as stream:
        stream.setnchannels(1)
        stream.setsampwidth(2)
        stream.setframerate(RATE)
        stream.writeframes(payload.tobytes())
    return {'file': path.name, 'samples': len(pcm), 'seconds': len(pcm) / RATE,
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}


def main() -> None:
    source = make_source_table()
    records = LATIN + CYRILLIC + DIGITS
    bank, clips, recipes, audio = array('h'), {}, {}, {}
    guard = array('h', [0]) * GUARD
    for character, spoken, score in records:
        pcm = synthesize(character, score, source)
        audio[character] = pcm
        bank.extend(guard)
        clips[character] = [round(len(bank) / RATE, 9), round(len(pcm) / RATE, 9)]
        recipes[character] = {'spoken': spoken, 'score': score, 'sampleOffset': len(bank), 'sampleCount': len(pcm)}
        bank.extend(pcm)
    bank.extend(guard)
    outputs = [write_wav(HERE / 'procedural-v1-bank.wav', bank)]
    for filename, group in [('procedural-v1-digits.wav', DIGITS), ('procedural-v1-letters-ru.wav', CYRILLIC)]:
        demo = array('h', [0]) * round(.25 * RATE)
        for character, _, _ in group:
            demo.extend(audio[character])
            demo.extend(array('h', [0]) * DEMO_GAP)
        outputs.append(write_wav(HERE / filename, demo))
    manifest = {
        'version': 1, 'synthesis': 'procedural-formant-v1', 'sampleRate': RATE,
        'channels': 1, 'bitsPerSample': 16, 'guardSamples': GUARD,
        'clips': clips, 'recipes': recipes,
        'provenance': {
            'generator': Path(__file__).name,
            'generatorSha256': hashlib.sha256(Path(__file__).read_text(encoding='utf-8').replace('\r\n', '\n').encode('utf-8')).hexdigest(),
            'generatorHashEncoding': 'UTF-8, LF',
            'dependencies': 'Python standard library only',
            'source': 'Mathematical periodic oscillator + deterministic xorshift32 noise + four parallel resonators',
            'parameters': 'Hand-authored phoneme targets and scores in generator; no learned or fitted parameters',
            'recordings': [], 'speechEngines': [], 'trainedModels': [], 'networkInputs': [],
            'legacyBankUsed': False, 'noiseSeed': SEED,
            'status': 'experimental; listening and intelligibility checks by user; no automated acceptance tests run',
        },
        'outputs': outputs,
    }
    (HERE / 'procedural-v1-bank.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Generated {len(clips)} mathematical speech clips; no tests or listening performed.')
    for output in outputs:
        print(f"{output['file']}: {output['samples']} samples; {output['seconds']:.3f}s; SHA256 {output['sha256']}")


if __name__ == '__main__':
    main()
