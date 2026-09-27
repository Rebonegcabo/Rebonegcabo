/*
 * Ubuntu Circle — Day 17, animated.
 *
 * Look B from MOTION.md. Every colour, font, size and position below is from
 * MOTION.md and the Day 17 card (examples/ubuntu-circle-day-17.png); the final
 * frame reproduces that card. Motion choices (answered by Rebone, 27 Sep 2026):
 *   15 s at 60 fps, hold to end · word by word · soft fade and small rise ·
 *   frame builds first, rings breathe (slowly expand) throughout.
 *
 * render(t) is a pure function of time, so any frame can be rendered exactly.
 */
(() => {
'use strict';

const S = 1080, FPS = 60, DUR = 15, FRAMES = FPS * DUR;

// ─── MOTION.md colours ─────────────────────────────────────────────────────
const C = {
  footer: '#0A1F1A', cream: '#F4F0E8', gold: '#D4A843', darkGold: '#8A6D1D',
  teal: '#4CAF96', deepTeal: '#2E7D6B',
  flag: ['#007A4D', '#FFB612', '#DE3831', '#002395', '#FFFFFF'],
};
const FLAG_X = [0, 356, 540, 723, 864, 1080];

// Look B background: soft vertical gradient, lightest behind the quote.
const BG_STOPS = [[7, '#123129'], [71, '#12332A'], [135, '#13342B'], [199, '#14352C'], [271, '#15362D'],
  [351, '#16372E'], [439, '#17392F'], [551, '#17392F'], [639, '#16372E'], [719, '#15362D'],
  [791, '#14352C'], [855, '#13342B'], [919, '#12332A'], [991, '#123129'], [1016, '#113129']];

// Rings: centred behind the quote; radius and teal opacity measured per ring.
const RING_C = [540, 507];
const RING_R = [9, 72, 135, 205, 280, 360, 445];          // index 0 and 6 are off-card extrapolations
const RING_A = [0, .077, .058, .046, .037, .021, 0];

// ─── Type (MOTION.md §2) ───────────────────────────────────────────────────
const F = {
  quote: 'italic 700 58px "DejaVu Serif"',
  label: '700 17px "Liberation Sans"',
  footReg: '400 17px "Liberation Sans"',
  footBold: '700 17px "Liberation Sans"',
};
// Word positions: ink-left x of each word and the line baselines, from the card.
const QUOTE = [
  { base: 480, color: C.cream, words: [['Say', 120], ['her', 255], ['name', 387], ['when', 583], ['she', 772], ['is', 906]] },
  { base: 562, color: C.gold, words: [['not', 279], ['in', 405], ['the', 490], ['room.', 617]] },
];

// ─── Timeline (seconds) ────────────────────────────────────────────────────
const T = {
  rings: [0, 1.6],
  stripe: [0.2, 1.1],
  border: [0.5, 1.4],
  footerBar: [0.9, 1.6],
  label: [1.2, 1.9],
  labelRule: [1.4, 2.1],
  footerRule: [1.3, 2.0],
  footerText: [1.7, 2.4],
  words: 2.6,          // first word starts
  wordGap: 0.32,       // between word starts
  goldBeat: 0.4,       // extra pause before the gold phrase
  wordDur: 0.9,        // each word's fade + rise
  rise: 14,            // px a word rises as it fades in
  divider: [7.0, 7.7],
  ringSpeed: 0.12,     // ring spacings per second; rings land on the card's positions at t = DUR
};

// ─── Helpers ───────────────────────────────────────────────────────────────
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const prog = (t, [a, b]) => clamp((t - a) / (b - a));
const outCubic = p => 1 - Math.pow(1 - p, 3);
const inOutCubic = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
const lerp = (a, b, p) => a + (b - a) * p;
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgba = (h, a) => `rgba(${hex(h).join(',')},${a})`;
const interp = (xs, ys, x) => {
  if (x <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) if (x <= xs[i]) return lerp(ys[i - 1], ys[i], (x - xs[i - 1]) / (xs[i] - xs[i - 1]));
  return ys[ys.length - 1];
};

const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
let BG = null;

// Soft fade and small rise, the one text entrance used throughout.
function fadeRise(t, span, draw, rise = 10) {
  const p = outCubic(prog(t, span));
  if (p <= 0) return;
  ctx.save();
  ctx.globalAlpha = p;
  ctx.translate(0, (1 - p) * rise);
  draw();
  ctx.restore();
}
// Draw text so its ink starts exactly at x (matches the card's measured ink edges).
function inkText(str, x, y) {
  const m = ctx.measureText(str);
  ctx.fillText(str, x + m.actualBoundingBoxLeft, y);
}
function inkTextRight(str, x, y) {
  const m = ctx.measureText(str);
  ctx.fillText(str, x - m.actualBoundingBoxRight, y);
}

function render(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

  // Background (present from frame 1).
  ctx.fillStyle = BG; ctx.fillRect(0, 0, S, S);

  // Rings breathe: they drift outward continuously, fading in at the centre
  // and out at the edge, and land exactly on the card's rings at the last frame.
  const ringsIn = inOutCubic(prog(t, T.rings));
  if (ringsIn > 0) {
    const phase = ((T.ringSpeed * (t - (FRAMES - 1) / FPS)) % 1 + 1) % 1;
    const idx = RING_R.map((_, i) => i);
    ctx.lineWidth = 1;
    for (let k = 0; k < RING_R.length; k++) {
      const u = k + phase;
      if (u > RING_R.length - 1) continue;
      const r = interp(idx, RING_R, u), a = interp(idx, RING_A, u) * ringsIn;
      if (a <= 0.001) continue;
      ctx.strokeStyle = rgba(C.teal, a);
      ctx.beginPath(); ctx.arc(RING_C[0], RING_C[1], r, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // Footer bar rises into place, then its hairline grows from the centre.
  const fb = outCubic(prog(t, T.footerBar));
  if (fb > 0) {
    ctx.fillStyle = C.footer;
    ctx.fillRect(0, 1017 + (1 - fb) * 63, S, 63);
  }
  const fr = outCubic(prog(t, T.footerRule));
  if (fr > 0) {
    const half = (S - 6) / 2 * fr, mid = 6 + (S - 6) / 2;
    ctx.fillStyle = C.deepTeal; ctx.fillRect(mid - half, 1016, half * 2, 1);
  }
  fadeRise(t, T.footerText, () => {
    ctx.font = F.footReg; ctx.fillStyle = C.teal; inkText('Your Voice is Your Design', 22, 1054);
    ctx.font = F.footBold; ctx.fillStyle = C.gold; inkTextRight('Dr Rebone Gcabo', 1050, 1054);
  }, 8);

  // Flag stripe wipes in left to right.
  const sw = S * inOutCubic(prog(t, T.stripe));
  for (let i = 0; i < 5; i++) {
    const x0 = FLAG_X[i], x1 = Math.min(FLAG_X[i + 1], sw);
    if (x1 > x0) { ctx.fillStyle = C.flag[i]; ctx.fillRect(x0, 0, x1 - x0, 7); }
  }
  // Gold left border draws top to bottom.
  const bh = (S - 7) * inOutCubic(prog(t, T.border));
  if (bh > 0) { ctx.fillStyle = C.gold; ctx.fillRect(0, 7, 6, bh); }

  // Header label and its gold rule.
  fadeRise(t, T.label, () => {
    ctx.font = F.label; ctx.fillStyle = C.teal;
    inkText('UBUNTU CIRCLE', 425, 50);
    inkText('·', 579, 50);
    inkText('DAY 17', 599, 50);
  }, 8);
  const lr = outCubic(prog(t, T.labelRule));
  if (lr > 0) { ctx.fillStyle = C.gold; ctx.fillRect(540 - 200.5 * lr, 64, 401 * lr, 1); }

  // The quote, word by word: cream line, a beat, then the gold closing phrase.
  ctx.font = F.quote;
  let start = T.words;
  QUOTE.forEach((line, li) => {
    if (li === 1) start += T.goldBeat;
    for (const [w, x] of line.words) {
      const s = start;
      fadeRise(t, [s, s + T.wordDur], () => { ctx.fillStyle = line.color; inkText(w, x, line.base); }, T.rise);
      start += T.wordGap;
    }
  });

  // Dark-gold divider grows from the centre.
  const dv = outCubic(prog(t, T.divider));
  if (dv > 0) { ctx.fillStyle = C.darkGold; ctx.fillRect(540.5 - 90.5 * dv, 623, 181 * dv, 2); }
}

async function init() {
  await Promise.all([F.quote, F.label, F.footReg, F.footBold].map(f => document.fonts.load(f)));
  BG = ctx.createLinearGradient(0, 0, 0, S);
  for (const [y, c] of BG_STOPS) BG.addColorStop(y / S, c);
}

window.CARD = { FPS, DUR, FRAMES, S, render: f => render(f / FPS), renderAt: render, ready: init() };

if (!new URLSearchParams(location.search).has('render')) {
  window.CARD.ready.then(() => {
    const t0 = performance.now();
    // Play, hold the last frame for 1.5 s, then replay.
    const loop = () => {
      const t = ((performance.now() - t0) / 1000) % (DUR + 1.5);
      render(Math.min(t, DUR));
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}
})();
