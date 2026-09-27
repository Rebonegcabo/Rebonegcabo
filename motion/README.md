# Motion Study Nº 01

A 15-second, 1080p60 motion graphics piece written entirely in code: no timeline and no keyframes, just functions of time.

**▶ [`out/motion-study-01.mp4`](out/motion-study-01.mp4)**

| Bar | Scene | What's happening |
|---|---|---|
| 1 | DROP | Squash-and-stretch ball lands on the downbeat, floor ripples, two moons, circle wipe |
| 2 | TYPE | Three entrance styles for extruded kinetic type, then an exponential dive through the "O" |
| 3 | SHAPE | Polar shape morphs (circle → triangle → square → star) with time echoes over a beat-rippling dot field |
| 4 | PARTICLE | 5,000 closed-form particles explode, form a word, and get blown into streaks |
| 5 | DEPTH | 1,500-point cloud: sphere → torus → trefoil knot → ring, perspective-projected and depth-sorted |
| 6 | RHYTHM | Radial equaliser driven by the same envelopes the soundtrack is built from |
| 7 | RUSH | Speed-ramping twisted tunnel with a word cut on every half beat |
| 8 | RESOLVE | Impact, a lockup with chromatic registration, then everything folds back into the opening dot |

## How it works

- **`reel.js`**: every frame is a pure function `render(t)`. Because there is no simulation state, the renderer gets real **temporal motion blur** by averaging 5 sub-frame samples per frame over a 216° shutter. It also gets frame-exact scrubbing.
- Everything is locked to a **128 BPM** grid: 8 bars × 4 beats = 15.0 s, one bar per scene. Camera shake, chromatic aberration and scale pumps are driven by the same kick and snare envelopes as the music.
- **Post:** radial RGB-split aberration on hits, vignette, animated film grain, and a HUD drawn with the `difference` blend so it reads on any background.
- **`audio/synth.py`**: the soundtrack is synthesized from scratch with numpy (kick, clap, hats, sidechained bass and pads in A minor, risers, FFT reverb) on the same grid.
- **`render.mjs`**: drives headless Chromium frame by frame and pipes the PNGs into ffmpeg.

## Run it

```bash
# live preview (click to play, space = pause, ←/→ = seek by bar)
npx serve motion        # then open http://localhost:3000

# re-render
python3 motion/audio/synth.py                              # → motion/soundtrack.wav
FFMPEG=/path/to/ffmpeg node motion/render.mjs              # → motion/out/motion-study-01.mp4
node motion/render.mjs --stills 120,480,840                # individual PNG frames
```

Fonts: Unbounded, JetBrains Mono and Instrument Serif (SIL Open Font License).
