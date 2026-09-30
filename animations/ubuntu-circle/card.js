/*
 * Ubuntu Circle — any day, animated.  index.html?day=N
 *
 * Every colour, font, size and position comes from MOTION.md and the original
 * cards; the last frame of each day reproduces that day's card. Motion choices
 * are Rebone's answers (they are not in MOTION.md yet):
 *
 *   Both looks  15 s at 60 fps, holding on the finished card to the end.
 *   Look B      (27 Sep) The card's frame builds first. The quote arrives word
 *               by word with a soft fade and small rise, the gold closing phrase
 *               after a beat, then the divider. The rings breathe outward
 *               throughout and land on the card's positions on the last frame.
 *   Look A      (30 Sep) Everything is still from frame 1, including the
 *               helpline. Only the quote moves: it fades in whole. The
 *               helpline sits bottom left and "Dr Rebone Gcabo" bottom right,
 *               in teal, mirroring the Look B footer.
 *
 * render(t) is a pure function of time, so any frame can be rendered exactly.
 */
(() => {
'use strict';

const S = 1080, FPS = 60, DUR = 15, FRAMES = FPS * DUR;
const DAY = +(new URLSearchParams(location.search).get('day') || 17);
const CARD = window.DAYS[DAY];
const B = CARD.look === 'B';

// ─── MOTION.md colours ─────────────────────────────────────────────────────
const C = {
  deepGreen: '#0D2B24', footer: '#0A1F1A', cream: '#F4F0E8', gold: '#D4A843', darkGold: '#8A6D1D',
  teal: '#4CAF96', deepTeal: '#2E7D6B',
  flag: ['#007A4D', '#FFB612', '#DE3831', '#002395', '#FFFFFF'],
};
const FLAG_X = [0, 356, 540, 723, 864, 1080];
const ACCENT = B ? C.gold : C.teal;            // left border
const RULE = B ? C.gold : C.deepTeal;          // header rule
const DIVIDER = B ? C.darkGold : C.deepTeal;

// Look B background: soft vertical gradient, lightest behind the quote.
const BG_STOPS = [[7, '#123129'], [71, '#12332A'], [135, '#13342B'], [199, '#14352C'], [271, '#15362D'],
  [351, '#16372E'], [439, '#17392F'], [551, '#17392F'], [639, '#16372E'], [719, '#15362D'],
  [791, '#14352C'], [855, '#13342B'], [919, '#12332A'], [991, '#123129'], [1016, '#113129']];

// Look B rings: centred behind the quote; radius and teal opacity measured per ring.
const RING_C = [540, 507];
const RING_R = [9, 72, 135, 205, 280, 360, 445];          // index 0 and 6 are off-card extrapolations
const RING_A = [0, .077, .058, .046, .037, .021, 0];

// ─── Type (MOTION.md §2) and layout measured from the cards ────────────────
const F = {
  quote: B ? 'italic 700 58px "DejaVu Serif"' : '700 58px "DejaVu Serif"',
  label: '700 17px "Liberation Sans"',
  footReg: '400 17px "Liberation Sans"',
  footBold: '700 17px "Liberation Sans"',
  helpline: '700 20px "Liberation Sans"',
};
const LINE = 82, QUOTE_MID = 521, DIVIDER_GAP = 61;
const baseline = (i, n) => Math.round(QUOTE_MID + (i - (n - 1) / 2) * LINE);
// Header and helpline pieces at the ink-left x measured on the cards (Liberation
// Sans digits are all one width, so every day lays out the same).
const DD = `DAY ${String(DAY).padStart(2, '0')}`;
const HEADER = B ? [['UBUNTU CIRCLE', 425], ['·', 579], [DD, 599]]
                 : [['UBUNTU CIRCLE', 348], ['·', 502], [DD, 522], ['·', 593], ['#StopFemicide', 612]];
// Look A footer (Rebone, 30 Sep): helpline bottom left, her name bottom right in teal.
const HELPLINE = [['GBV Command Centre', 22], ['0800 428 428', 249], ['·', 384], ['24 hours', 400]];

// ─── Timeline (seconds) ────────────────────────────────────────────────────
const T = {
  // Look B frame build
  rings: [0, 1.6], stripe: [0.2, 1.1], border: [0.5, 1.4], footerBar: [0.9, 1.6],
  label: [1.2, 1.9], labelRule: [1.4, 2.1], footerRule: [1.3, 2.0], footerText: [1.7, 2.4],
  // Look B quote
  words: 2.6,          // first word starts
  wordGap: 0.32,       // between word starts (tightened for long quotes, see below)
  wordsSpan: 4.8,      // longest time the word sequence may take
  goldBeat: 0.4,       // extra pause before the gold phrase
  wordDur: 0.9,        // each word's fade + rise
  dividerDelay: 0.22,  // after the last word lands
  dividerDur: 0.7,
  ringSpeed: 0.12,     // ring spacings per second
  // Look A quote
  quoteA: [1.0, 2.8],
  rise: 14,            // px text rises as it fades in
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
let BG = null, WORDS = null, DIV_Y = 0, DIV_AT = 0;

function fadeRise(t, span, draw, rise = 10) {
  const p = outCubic(prog(t, span));
  if (p <= 0) return;
  ctx.save();
  ctx.globalAlpha = p;
  ctx.translate(0, (1 - p) * rise);
  draw();
  ctx.restore();
}
const ink = str => { const m = ctx.measureText(str); return { l: m.actualBoundingBoxLeft, r: m.actualBoundingBoxRight }; };

// Lay out the quote: each line centred on its advance width, words placed by
// the width of the text before them; colour from where the card's gold starts.
function layout() {
  ctx.font = F.quote;
  const n = CARD.lines.length, sp = ctx.measureText(' ').width;
  WORDS = [];
  CARD.lines.forEach((line, li) => {
    const y = baseline(li, n);
    let x = Math.round((S - ctx.measureText(line).width) / 2);
    line.split(' ').forEach((w, wi) => {
      const i = ink(w), inkRight = x + i.r;
      const gold = CARD.gold && (li > CARD.gold[0] || (li === CARD.gold[0] && inkRight > CARD.gold[1]));
      const dx = (CARD.nudge && CARD.nudge[li] && CARD.nudge[li][wi]) || 0;
      WORDS.push({ w, x: x + dx, y, gold });
      x += ctx.measureText(w).width + sp;
    });
  });
  DIV_Y = baseline(n - 1, n) + DIVIDER_GAP;

  // Word timing (Look B): cream words, a beat, gold words.
  const gap = Math.min(T.wordGap, T.wordsSpan / Math.max(1, WORDS.length - 1));
  let s = T.words;
  WORDS.forEach((W, i) => {
    if (W.gold && (i === 0 || !WORDS[i - 1].gold)) s += T.goldBeat;
    W.start = s; s += gap;
  });
  DIV_AT = WORDS[WORDS.length - 1].start + T.wordDur + T.dividerDelay;
}
const inkAt = ([str, x], y, dx = 0) => ctx.fillText(str, x + dx + ink(str).l, y);

function drawFrame(t) {
  // Stripe, border, header, footer. Look B builds them in; Look A has them from frame 1.
  const k = span => B ? span : [-2, -1];
  const fb = outCubic(prog(t, k(T.footerBar)));
  if (fb > 0) { ctx.fillStyle = C.footer; ctx.fillRect(0, 1017 + (1 - fb) * 63, S, 63); }
  const fr = outCubic(prog(t, k(T.footerRule)));
  if (fr > 0) { const half = (S - 6) / 2 * fr, mid = 6 + (S - 6) / 2; ctx.fillStyle = C.deepTeal; ctx.fillRect(mid - half, 1016, half * 2, 1); }
  fadeRise(t, k(T.footerText), () => {
    if (B) {
      ctx.font = F.footReg; ctx.fillStyle = C.teal; ctx.fillText('Your Voice is Your Design', 22 + ink('Your Voice is Your Design').l, 1054);
      ctx.font = F.footBold; ctx.fillStyle = C.gold; ctx.fillText('Dr Rebone Gcabo', 1050 - ink('Dr Rebone Gcabo').r, 1054);
    } else {
      // The helpline: on screen and readable the whole time (MOTION.md §6).
      ctx.font = F.helpline; ctx.fillStyle = C.cream;
      for (const piece of HELPLINE) inkAt(piece, 1055);
      ctx.font = F.footBold; ctx.fillStyle = C.teal; ctx.fillText('Dr Rebone Gcabo', 1050 - ink('Dr Rebone Gcabo').r, 1054);
    }
  }, 8);

  const sw = S * inOutCubic(prog(t, k(T.stripe)));
  for (let i = 0; i < 5; i++) {
    const x0 = FLAG_X[i], x1 = Math.min(FLAG_X[i + 1], sw);
    if (x1 > x0) { ctx.fillStyle = C.flag[i]; ctx.fillRect(x0, 0, x1 - x0, 7); }
  }
  const bh = (S - 7) * inOutCubic(prog(t, k(T.border)));
  if (bh > 0) { ctx.fillStyle = ACCENT; ctx.fillRect(0, 7, 6, bh); }

  fadeRise(t, k(T.label), () => {
    ctx.font = F.label; ctx.fillStyle = C.teal;
    for (const piece of HEADER) inkAt(piece, 50, CARD.headerDx || 0);
  }, 8);
  const lr = outCubic(prog(t, k(T.labelRule)));
  if (lr > 0) { ctx.fillStyle = RULE; ctx.fillRect(540 - 200.5 * lr, 64, 401 * lr, 1); }
}

function render(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = B ? BG : C.deepGreen; ctx.fillRect(0, 0, S, S);

  if (B) {
    // Rings breathe: they drift outward, fading in at the centre and out at the
    // edge, and land exactly on the card's rings on the last frame.
    const ringsIn = inOutCubic(prog(t, T.rings));
    const phase = ((T.ringSpeed * (t - (FRAMES - 1) / FPS)) % 1 + 1) % 1;
    const idx = RING_R.map((_, i) => i);
    ctx.lineWidth = 1;
    for (let k = 0; k < RING_R.length && ringsIn > 0; k++) {
      const u = k + phase;
      if (u > RING_R.length - 1) continue;
      const r = interp(idx, RING_R, u), a = interp(idx, RING_A, u) * ringsIn;
      if (a <= 0.001) continue;
      ctx.strokeStyle = rgba(C.teal, a);
      ctx.beginPath(); ctx.arc(RING_C[0], RING_C[1], r, 0, Math.PI * 2); ctx.stroke();
    }
  }

  drawFrame(t);

  ctx.font = F.quote;
  const word = W => { ctx.fillStyle = W.gold ? C.gold : C.cream; ctx.fillText(W.w, W.x, W.y); };
  const divider = () => { ctx.fillStyle = DIVIDER; ctx.fillRect(450, DIV_Y, 181, 2); };
  if (B) {
    for (const W of WORDS) fadeRise(t, [W.start, W.start + T.wordDur], () => word(W), T.rise);
    const dv = outCubic(prog(t, [DIV_AT, DIV_AT + T.dividerDur]));
    if (dv > 0) { ctx.fillStyle = DIVIDER; ctx.fillRect(540.5 - 90.5 * dv, DIV_Y, 181 * dv, 2); }
  } else {
    // Look A: the quote (and its divider) fades in whole.
    fadeRise(t, T.quoteA, () => { WORDS.forEach(word); divider(); }, T.rise);
  }
}

async function init() {
  await Promise.all(Object.values(F).map(f => document.fonts.load(f)));
  BG = ctx.createLinearGradient(0, 0, 0, S);
  for (const [y, c] of BG_STOPS) BG.addColorStop(y / S, c);
  layout();
}

window.CARD = { DAY, FPS, DUR, FRAMES, S, render: f => render(f / FPS), renderAt: render, ready: init(), words: () => WORDS.map(W => { ctx.font = F.quote; const i = ink(W.w); return { w: W.w, x0: Math.floor(W.x - i.l), x1: Math.ceil(W.x + i.r), y: W.y }; }) };

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
