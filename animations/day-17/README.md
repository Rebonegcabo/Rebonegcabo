# Ubuntu Circle — Day 17, animated

**▶ [`out/ubuntu-circle-day-17.mp4`](out/ubuntu-circle-day-17.mp4)**: 1080 × 1080, 60 fps, 15 s, no sound.

Built from [`MOTION.md`](../../MOTION.md), Look B. The last frame reproduces the Day 17 card ([`examples/ubuntu-circle-day-17.png`](../../examples/ubuntu-circle-day-17.png)) to within 0.2% per pixel before video compression.

## Motion choices (answered 27 Sep 2026, not yet in MOTION.md)

- 15 s at 60 fps, holding on the finished card to the end
- Quote arrives word by word: cream line, a beat, then the gold phrase
- Each word: soft fade and a 14 px rise, ease-out
- The card's frame builds first (stripe, border, footer, header), then the quote
- The rings breathe: they drift slowly outward all the way through, and land on the card's positions on the last frame

| Time | What happens |
|---|---|
| 0.0–2.4 s | Rings fade up. Flag stripe wipes in, gold border draws down, footer rises, header and footer text arrive |
| 2.6–5.2 s | `Say her name when she is`, one word every 0.32 s |
| 5.5–6.8 s | Gold: `not in the room.` |
| 7.0–7.7 s | Dark-gold divider grows from the centre |
| 7.7–15.0 s | Hold, rings still breathing |

## Re-render

```bash
node animations/day-17/render.mjs                       # → out/ubuntu-circle-day-17.mp4
node animations/day-17/render.mjs --stills 0,450,899    # individual PNG frames
```

Needs Playwright's Chromium and an ffmpeg (set `FFMPEG=/path/to/ffmpeg` if it is not on your PATH). Open `index.html` through any local web server for a live preview.

Fonts: DejaVu Serif Bold Italic (DejaVu licence) and Liberation Sans (SIL Open Font License), included in `fonts/`.
