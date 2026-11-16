# -*- coding: utf-8 -*-
"""Канальный вокодер: голос управляет гармоникой трека — звук как у Kraftwerk «Numbers».

Метод: короткие спектры несущей (петля) и модулятора (счёт), 24 полосы по логарифму
частот; в каждой полосе огибающая голоса задаёт усиление несущей. Обратное преобразование
даёт синтезированную «речь» с тембром трека.
"""
import os, wave
import numpy as np

OUT = r"E:\NineToZero\voice"
LOOP = r"E:\NineToZero\music\zerkalius-loop.wav"
RATE = 44100
N_FFT = 2048
HOP = 512
BANDS = 24
LOW, HIGH = 120.0, 7000.0


def read_wav(path, mono=True):
    with wave.open(path, "rb") as stream:
        frames = stream.readframes(stream.getnframes())
        rate = stream.getframerate()
        channels = stream.getnchannels()
    data = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768
    data = data.reshape(-1, channels)
    return (data.mean(axis=1) if mono else data), rate


def write_wav(path, data, rate=RATE):
    pcm = np.clip(data, -1, 1)
    with wave.open(path, "wb") as stream:
        stream.setnchannels(1)
        stream.setsampwidth(2)
        stream.setframerate(rate)
        stream.writeframes((pcm * 32767).astype(np.int16).tobytes())


def stft(signal):
    window = np.hanning(N_FFT).astype(np.float32)
    count = 1 + (len(signal) - N_FFT) // HOP
    frames = np.lib.stride_tricks.as_strided(
        signal, shape=(count, N_FFT), strides=(signal.strides[0] * HOP, signal.strides[0]))
    return np.fft.rfft(frames * window, axis=1)


def istft(spec, length):
    window = np.hanning(N_FFT).astype(np.float32)
    frames = np.fft.irfft(spec, n=N_FFT, axis=1) * window
    out = np.zeros(length + N_FFT + HOP, dtype=np.float32)
    norm = np.zeros_like(out)
    for index in range(frames.shape[0]):
        start = index * HOP
        out[start:start + N_FFT] += frames[index]
        norm[start:start + N_FFT] += window ** 2
    out = out[:length] / np.maximum(norm[:length], 1e-6)
    return out


def band_matrix():
    freqs = np.fft.rfftfreq(N_FFT, 1 / RATE)
    edges = np.geomspace(LOW, HIGH, BANDS + 1)
    matrix = np.zeros((BANDS, len(freqs)), dtype=np.float32)
    for band in range(BANDS):
        low, high = edges[band], edges[band + 1]
        mask = (freqs >= low) & (freqs < high)
        matrix[band, mask] = 1.0
    return matrix, edges


def vocode(carrier, modulator):
    length = len(carrier)
    mod = np.zeros(length, dtype=np.float32)
    mod[:min(length, len(modulator))] = modulator[:min(length, len(modulator))]

    carrier_spec = stft(carrier)
    mod_spec = stft(mod)
    matrix, edges = band_matrix()

    carrier_band = matrix @ np.abs(carrier_spec).T          # (BANDS, frames)
    mod_band = matrix @ np.abs(mod_spec).T
    gain = (mod_band + 1e-6) / (carrier_band + 1e-6)
    # Сглаживание огибающих по времени: без него слышны спектральные щелчки.
    kernel = np.ones(5, dtype=np.float32) / 5
    for band in range(BANDS):
        gain[band] = np.convolve(gain[band], kernel, mode="same")
    gain = np.clip(gain, 0.0, 60.0)

    shaped = carrier_spec.T * (matrix.T @ gain)                # (freq, frames)
    result = istft(shaped.T, length)

    # Петля должна остаться петлёй: хвост заворачиваем в начало.
    tail = result[-8000:].copy()
    result[:len(tail)] += tail
    # Уровень по RMS, а не по пику: иначе одиночный выброс делает остальное неслышным.
    rms = float(np.sqrt((result ** 2).mean())) + 1e-9
    result = result * (0.05 / rms)
    result = np.tanh(result * 1.4) * 0.4
    return result, edges


loop, rate = read_wav(LOOP)
for prefix in ("ru", "en"):
    voice, voice_rate = read_wav(os.path.join(OUT, f"count-{prefix}.wav"))
    assert rate == voice_rate == RATE
    sung, edges = vocode(loop, voice)
    path = os.path.join(OUT, f"vocoder-{prefix}.wav")
    write_wav(path, sung)
    print(prefix, "| вокодер:", round(len(sung) / RATE, 3), "с | пик:", round(float(np.abs(sung).max()), 3),
          "| RMS:", round(float(np.sqrt((sung ** 2).mean())), 3))

    mixed = np.stack([loop, loop], axis=1).astype(np.float32)
    mixed[:, 0] += sung
    mixed[:, 1] += sung * 0.85
    peak = np.abs(mixed).max()
    if peak > 0.95:
        mixed *= 0.95 / peak
    write_wav(os.path.join(OUT, f"loop-{prefix}-vocoder.wav"), mixed.mean(axis=1))
    print("   петля с вокодером | пик:", round(float(np.abs(mixed).max()), 3),
          "| RMS:", round(float(np.sqrt((mixed ** 2).mean())), 3))
