"""Soundtrack for Motion Study Nº 01 — synthesized from scratch with numpy.

Same grid as reel.js: 128 BPM, 32 beats, 15.0 s. Every hit here has a visual
counterpart (see kickEnv / snareEnv / hitEnv in reel.js).

    python3 audio/synth.py  →  soundtrack.wav
"""
import wave
from pathlib import Path

import numpy as np

SR = 48000
DUR = 15.0
BPM = 128
BEAT = 60 / BPM
N = int(SR * DUR)
rng = np.random.default_rng(3)

L = np.zeros(N)
R = np.zeros(N)
SEND = np.zeros(N)          # reverb bus (mono in, stereo out)
DL = np.zeros(N)            # sidechained bus (pads, bass)
DR = np.zeros(N)


def B(beat):
    return beat * BEAT


def place(sig, t0, gain=1.0, pan=0.0, send=0.0, duck=False):
    i = int(round(t0 * SR))
    if i >= N:
        return
    sig = sig[: N - i] * gain
    lg, rg = np.sqrt(0.5 * (1 - pan)), np.sqrt(0.5 * (1 + pan))
    dl, dr = (DL, DR) if duck else (L, R)
    dl[i:i + len(sig)] += sig * lg * 1.414
    dr[i:i + len(sig)] += sig * rg * 1.414
    SEND[i:i + len(sig)] += sig * send


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def lowpass(x, width):
    """Cheap FIR lowpass (Hann window)."""
    k = np.hanning(max(3, int(width)))
    return np.convolve(x, k / k.sum(), mode='same')


def bandpass_fft(x, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X[(f < lo) | (f > hi)] = 0
    return np.fft.irfft(X, len(x))


def note(n):
    """MIDI note → Hz."""
    return 440 * 2 ** ((n - 69) / 12)


def phase(freq):
    return 2 * np.pi * np.cumsum(freq) / SR


# ─── Instruments ────────────────────────────────────────────────────────────
def kick(big=False):
    t = tt(1.6 if big else 0.45)
    f = 44 + (170 if big else 130) * np.exp(-t * (22 if big else 32))
    body = np.sin(phase(f)) * np.exp(-t * (2.2 if big else 7.5))
    click = rng.standard_normal(len(t)) * np.exp(-t * 400) * 0.35
    s = np.tanh((body + click) * (2.2 if big else 1.6))
    return s


def clap():
    t = tt(0.35)
    n = bandpass_fft(rng.standard_normal(len(t)), 900, 7000)
    env = np.zeros(len(t))
    for d in (0, 0.009, 0.019, 0.03):
        env += np.where(t >= d, np.exp(-(t - d) * 60), 0) * 0.6
    env += np.where(t >= 0.03, np.exp(-(t - 0.03) * 14), 0)
    tone = np.sin(2 * np.pi * 185 * t) * np.exp(-t * 30) * 0.4
    return n / np.abs(n).max() * env * 0.8 + tone


def hat(open_=False):
    t = tt(0.25 if open_ else 0.07)
    n = bandpass_fft(rng.standard_normal(len(t)), 7000, 16000)
    return n / np.abs(n).max() * np.exp(-t * (18 if open_ else 70))


def saw(freq, t, harmonics=10):
    ph = 2 * np.pi * freq * t
    return sum(np.sin(k * ph) / k for k in range(1, harmonics + 1)) * 0.6


def bass(n, dur):
    t = tt(dur)
    f = note(n)
    s = saw(f, t, 6) + np.sin(2 * np.pi * f / 2 * t) * 0.8
    env = np.minimum(1, t / 0.005) * np.exp(-t * 5)
    return np.tanh(s * env * 1.4)


def pad(notes, dur, bright=6):
    t = tt(dur)
    s = np.zeros(len(t))
    for n in notes:
        for det in (-0.12, 0.0, 0.11):
            s += saw(note(n + det), t + rng.random(), bright)
    env = np.minimum(1, t / 0.08) * np.minimum(1, (dur - t) / 0.15)
    return s / len(notes) / 3 * env


def pluck(n, dur=0.6):
    t = tt(dur)
    f = note(n)
    s = (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(4 * np.pi * f * t) + 0.2 * np.sin(6 * np.pi * f * t))
    return s * np.exp(-t * 9) * np.minimum(1, t / 0.002)


def blip(f0, f1, dur):
    t = tt(dur)
    f = f0 * (f1 / f0) ** (t / dur)
    return np.sin(phase(f)) * np.exp(-t * 6 / dur) * np.minimum(1, t / 0.003)


def whoosh(dur, lo=300, hi=5000, rise=True):
    t = tt(dur)
    n = rng.standard_normal(len(t))
    out = np.zeros(len(t))
    bands = 8
    for b in range(bands):  # sweep by crossfading fixed bands
        a, z = lo * (hi / lo) ** (b / bands), lo * (hi / lo) ** ((b + 1) / bands)
        centre = (b + 0.5) / bands
        pos = t / dur if rise else 1 - t / dur
        out += bandpass_fft(n, a, z) * np.exp(-((pos - centre) / 0.18) ** 2)
    env = (t / dur) ** 2 if rise else np.exp(-t * 4 / dur)
    return out / np.abs(out).max() * env


def crash(dur=2.5):
    t = tt(dur)
    n = bandpass_fft(rng.standard_normal(len(t)), 3000, 18000)
    return n / np.abs(n).max() * np.exp(-t * 2.2)


# ─── Score ──────────────────────────────────────────────────────────────────
# A minor: i – VI – III – VII, one chord per bar.
CHORDS = {
    1: ([57, 60, 64, 67], 33),   # Am7
    2: ([53, 57, 60, 64], 29),   # Fmaj7
    3: ([48, 55, 60, 64], 36),   # C
    4: ([55, 59, 62, 67], 31),   # G
    5: ([57, 60, 64, 71], 33),   # Am(add9)
    6: ([52, 56, 59, 64], 28),   # E (dominant, the build)
}

# 01 DROP — falling whistle into the first landing, floor hits, then the swell.
place(blip(1800, 160, BEAT), 0, 0.18, send=0.3)
for b in (1, 2, 3):
    place(kick(), B(b), 0.9)
    place(pluck(81 - (b - 1) * 5, 0.5), B(b), 0.18, pan=(b - 2) * 0.4, send=0.5)
place(blip(500, 900, 0.3), B(3), 0.12, pan=-0.5, send=0.4)
place(blip(700, 1300, 0.3), B(3.08), 0.12, pan=0.5, send=0.4)
place(whoosh(BEAT * 0.9, 200, 6000), B(3.1), 0.5)

# Groove: bars 1–6 (beats 4–27).
for b in range(4, 28):
    place(kick(), B(b), 0.95)
    if b % 2 == 1 and 5 <= b <= 23:
        place(clap(), B(b), 0.55, send=0.35)
    if b >= 8:
        place(hat(open_=(b % 4 == 3)), B(b + 0.5), 0.22, pan=0.3)
        place(hat(), B(b + 0.25), 0.08, pan=-0.3)
        place(hat(), B(b + 0.75), 0.1, pan=-0.2)
for bar in range(1, 7):
    notes, root = CHORDS[bar]
    place(pad(notes, 4 * BEAT + 0.05), B(bar * 4), 0.16 if bar < 6 else 0.2, send=0.6, duck=True)
    for e in range(8):  # offbeat 8ths — classic sidechained pump
        if e % 2 == 1:
            place(bass(root + (12 if e == 7 else 0), BEAT * 0.45), B(bar * 4 + e * 0.5), 0.34, duck=True)

# 02 TYPE — a thwack for each word.
for b in (4, 5, 6):
    place(whoosh(0.18, 800, 9000, rise=False), B(b), 0.35, pan=(b - 5) * 0.5)
place(blip(1400, 90, BEAT), B(7), 0.2, send=0.3)   # the dive

# 03 SHAPE — pitched glides on each morph.
for i, b in enumerate((8, 9, 10, 11)):
    place(blip(note(69 + i * 3), note(76 + i * 3), 0.22), B(b), 0.14, pan=(-0.6, 0.6, -0.3, 0.3)[i], send=0.5)

# 04 PARTICLE — detonation, then sparkle while the word forms, wind to finish.
place(kick(big=True), B(12), 0.6)
place(crash(2.2), B(12), 0.35, send=0.3)
for i, n in enumerate([81, 84, 88, 91, 93, 96]):
    place(pluck(n, 0.35), B(13.5 + i * 0.25), 0.07, pan=(-1) ** i * 0.6, send=0.7)
place(whoosh(BEAT * 1.3, 300, 8000, rise=True), B(14.7), 0.45)

# 05 DEPTH — morph glides, iris swell.
for b in (17, 18, 19):
    place(blip(note(52 + (b - 17) * 5), note(64 + (b - 17) * 5), 0.4), B(b), 0.1, send=0.6)
place(whoosh(BEAT * 0.6, 200, 5000), B(19.4), 0.3)

# 06 RHYTHM — nothing extra: the groove *is* the scene.

# 07 RUSH — snare roll accelerating, riser, then a breath before the drop.
for i in range(8):
    place(clap(), B(24 + i * 0.5), 0.35 + i * 0.03, send=0.2)
for i in range(8):
    place(clap(), B(26 + i * 0.25), 0.4 + i * 0.03, send=0.2)
t = tt(BAR := 4 * BEAT)
riser = np.sin(phase(200 * 8 ** (t / BAR))) * (t / BAR) ** 2 * 0.25 + whoosh(BAR, 400, 12000) * 0.5
place(riser, B(24), 0.6)
gap0, gap1 = int(B(27.75) * SR), int(B(28) * SR)
for bus in (L, R, DL, DR):
    bus[gap0:gap1] *= np.linspace(1, 0, gap1 - gap0) ** 3
SEND[gap0:gap1] *= 0

# 08 RESOLVE — impact, sustained chord, arpeggio for the three dots, final blip.
place(kick(big=True), B(28), 1.1)
place(crash(3.0), B(28), 0.45, send=0.4)
place(whoosh(0.6, 200, 3000, rise=False), B(28), 0.4)
place(pad([45, 57, 60, 64, 71], 15 - B(28)), B(28), 0.22, send=0.8)
place(bass(33, 1.5), B(28), 0.45)
for j, n in enumerate([76, 72, 79]):
    place(pluck(n, 0.8), B(28.9 + j * 0.5), 0.22, pan=(-0.5, 0, 0.5)[j], send=0.7)
for j, n in enumerate([81, 84, 88, 86, 84, 81]):
    place(pluck(n, 0.5), B(30.4 + j * 0.25), 0.06, pan=(-1) ** j * 0.4, send=0.8)
place(blip(1760, 1760, 0.25), B(31.2), 0.16, send=0.9)

# ─── Mix ────────────────────────────────────────────────────────────────────
# Sidechain everything but the kick-ish transients to the four-on-the-floor.
tA = np.arange(N) / SR
duck = np.ones(N)
for b in list(range(1, 28)) + [28]:
    s = int(B(b) * SR)
    d = np.exp(-(tA[s:] - B(b)) * 7)
    duck[s:] = np.minimum(duck[s:], 1 - 0.55 * d)

# Reverb: decaying stereo noise impulse, FFT convolution.
ir_t = tt(1.6)
irL = rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 4)
irR = rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 4)
irL, irR = lowpass(irL, 6), lowpass(irR, 6)


def conv(x, ir):
    n = len(x) + len(ir)
    return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(ir, n), n)[: len(x)]


revL, revR = conv(SEND, irL), conv(SEND, irR)
revL /= np.abs(revL).max() + 1e-9
revR /= np.abs(revR).max() + 1e-9
mixL = L + (DL + revL * 0.22) * duck
mixR = R + (DR + revR * 0.22) * duck

# Gentle master: soft clip, normalise, fade the last 40 ms.
peak = max(np.abs(mixL).max(), np.abs(mixR).max())
mixL, mixR = np.tanh(mixL / peak * 1.35), np.tanh(mixR / peak * 1.35)
peak = max(np.abs(mixL).max(), np.abs(mixR).max())
mixL, mixR = mixL / peak * 0.89, mixR / peak * 0.89
fade = int(0.04 * SR)
mixL[-fade:] *= np.linspace(1, 0, fade)
mixR[-fade:] *= np.linspace(1, 0, fade)

out = Path(__file__).resolve().parent.parent / 'soundtrack.wav'
pcm = (np.stack([mixL, mixR], 1) * 32767).astype('<i2')
with wave.open(str(out), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote', out)
