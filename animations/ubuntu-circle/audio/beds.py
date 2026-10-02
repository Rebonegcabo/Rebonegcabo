"""Two 15-second instrumental beds for the Ubuntu Circle videos, synthesized
with numpy. Answered by Rebone (1-2 Oct): sound wanted, no voice; days 2-7
(#StopFemicide) more sombre than days 8-30.

    python3 animations/ubuntu-circle/audio/beds.py  ->  audio/bed-a.wav, audio/bed-b.wav

Bed A (Look A, days 1-7): D minor. A low drone and sparse, quiet piano notes.
  The first note lands at 1.0 s, as the quote starts to fade in.
Bed B (Look B, days 8-30): D major. A warm pad over Dmaj7 / Bm7 / Gmaj7 / Asus,
  with gentle piano and one soft bell near 7 s, when the divider draws.
"""
import wave
from pathlib import Path

import numpy as np

SR = 48000
DUR = 15.0
N = int(SR * DUR)
T = np.arange(N) / SR
rng = np.random.default_rng(17)


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def piano(freq, dur=4.0, vel=1.0):
    """Soft felt-piano tone: a few slightly stretched partials, each decaying."""
    t = np.arange(int(dur * SR)) / SR
    s = np.zeros_like(t)
    for k, amp in enumerate([1.0, 0.45, 0.22, 0.12, 0.06], start=1):
        f = freq * k * (1 + 0.0004 * k * k)
        s += amp * np.sin(2 * np.pi * f * t) * np.exp(-t * (1.1 + 0.9 * k))
    attack = np.minimum(1, t / 0.006)
    return s * attack * vel * 0.35


def bell(freq, dur=5.0, vel=1.0):
    t = np.arange(int(dur * SR)) / SR
    s = (np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-t * 2.5)
         + 0.15 * np.sin(2 * np.pi * freq * 5.4 * t) * np.exp(-t * 5))
    return s * np.exp(-t * 0.9) * np.minimum(1, t / 0.003) * vel * 0.18


def pad(midis, t0, t1, vel=1.0):
    """Warm pad: detuned soft saws (few partials) with slow attack and release."""
    out = np.zeros(N)
    i0, i1 = int(t0 * SR), min(N, int((t1 + 1.5) * SR))
    t = (np.arange(i1 - i0)) / SR
    for m in midis:
        for det in (-0.07, 0.0, 0.08):
            f = hz(m + det)
            ph = rng.random() * 2 * np.pi
            s = sum(np.sin(2 * np.pi * f * k * t + ph * k) / (k ** 1.6) for k in range(1, 6))
            out[i0:i1] += s
    env = np.minimum(1, t / 1.2) * np.clip(1 - (t - (t1 - t0)) / 1.5, 0, 1)
    out[i0:i1] *= env * vel / (len(midis) * 3)
    return out


def place(buf, sig, t0):
    i = int(t0 * SR)
    sig = sig[: max(0, N - i)]
    buf[i:i + len(sig)] += sig


def reverb(x, seconds=2.4, decay=2.2):
    t = np.arange(int(seconds * SR)) / SR
    irs = []
    for _ in range(2):
        ir = rng.standard_normal(len(t)) * np.exp(-t * decay)
        ir = np.convolve(ir, np.hanning(9) / np.hanning(9).sum(), mode='same')  # soften the tail
        irs.append(ir / np.abs(ir).sum() * 40)
    n = len(x) + len(t)
    X = np.fft.rfft(x, n)
    return [np.fft.irfft(X * np.fft.rfft(ir, n), n)[: len(x)] for ir in irs]


def finish(dry, wet_mix, name, peak_db):
    wl, wr = reverb(dry)
    left, right = dry + wl * wet_mix, dry + wr * wet_mix
    fade = np.minimum(1, T / 1.2) * np.clip((DUR - T) / 2.0, 0, 1)
    left, right = left * fade, right * fade
    peak = max(np.abs(left).max(), np.abs(right).max())
    g = 10 ** (peak_db / 20) / peak
    pcm = (np.stack([left * g, right * g], 1) * 32767).astype('<i2')
    out = Path(__file__).resolve().parent / name
    with wave.open(str(out), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    print('wrote', out)


# ─── Bed A: sombre, D minor ─────────────────────────────────────────────────
a = np.zeros(N)
drone = sum(np.sin(2 * np.pi * hz(m) * k * T) / k ** 2 for m in (38, 45) for k in (1, 2, 3))  # D2 + A2
a += drone * 0.10 * (0.85 + 0.15 * np.sin(2 * np.pi * 0.18 * T)) * np.minimum(1, T / 2.5)
for t0, m, v in [(1.0, 62, 0.9), (3.6, 65, 0.6), (6.2, 57, 0.7), (8.8, 64, 0.5),
                 (11.0, 62, 0.6), (13.0, 50, 0.5)]:                                       # D4 F4 A3 E4 D4 D3
    place(a, piano(hz(m), 4.5, v), t0)
finish(a, 0.55, 'bed-a.wav', -3.5)

# ─── Bed B: warm, D major ───────────────────────────────────────────────────
b = np.zeros(N)
for (t0, t1), chord in zip([(0, 3.75), (3.75, 7.5), (7.5, 11.25), (11.25, 15)],
                           [[50, 57, 61, 66], [47, 54, 57, 62], [43, 50, 54, 59], [45, 50, 52, 57]]):
    b += pad(chord, t0, t1, 0.55)                                    # Dmaj7  Bm7  Gmaj7  Asus2
melody = [(2.6, 74), (3.5, 73), (4.4, 69), (5.6, 71), (6.5, 66), (8.0, 74), (9.4, 71),
          (10.6, 67), (12.0, 69), (13.2, 64)]
for t0, m in melody:
    place(b, piano(hz(m), 4.0, 0.55), t0)
place(b, bell(hz(81), 5.5, 0.9), 7.1)                               # A5 bell near the divider
finish(b, 0.5, 'bed-b.wav', -4.0)
