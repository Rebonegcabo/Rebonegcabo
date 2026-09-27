/*
 * Motion Study Nº 01 — a 15-second motion graphics piece, written entirely in code.
 *
 * Every frame is a pure function of time: render(t) draws the same image for the
 * same t, which is what makes true sub-frame motion blur, scrubbing and
 * frame-exact offline rendering possible. Everything is locked to a 128 BPM grid:
 * 8 bars x 4 beats = 32 beats = 15.0 s, one bar per scene.
 */
(() => {
'use strict';

// ─── Timing ────────────────────────────────────────────────────────────────
const W = 1920, H = 1080, CX = W / 2, CY = H / 2;
const FPS = 60, DUR = 15, FRAMES = FPS * DUR;
const BPM = 128, BEAT = 60 / BPM, BAR = BEAT * 4;
const SUB = 5, SHUTTER = 0.6;            // motion blur: sub-samples per frame, shutter in frames

// ─── Palette ───────────────────────────────────────────────────────────────
const C = {
  ink: '#0B0A12', paper: '#F2EEE4', coral: '#FF4A3A', coralDk: '#B8281B',
  cyan: '#1FE0CB', sun: '#FFC53A', violet: '#6B4DFF', white: '#FFFFFF',
};
const PAL = [C.coral, C.cyan, C.sun, C.violet];

// ─── Math ──────────────────────────────────────────────────────────────────
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  inQuad: t => t * t,
  outQuad: t => 1 - (1 - t) * (1 - t),
  inCubic: t => t * t * t,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  inQuart: t => t * t * t * t,
  inExpo: t => t <= 0 ? 0 : Math.pow(2, 10 * t - 10),
  outExpo: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  inOutExpo: t => t <= 0 ? 0 : t >= 1 ? 1 : t < .5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  inBack: (t, s = 1.70158) => (s + 1) * t * t * t - s * t * t,
  inOutBack: t => {
    const c = 1.70158 * 1.525;
    return t < .5 ? (Math.pow(2 * t, 2) * ((c + 1) * 2 * t - c)) / 2
                  : (Math.pow(2 * t - 2, 2) * ((c + 1) * (t * 2 - 2) + c) + 2) / 2;
  },
  outElastic: t => t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * TAU / 3) + 1,
};
// Damped spring step response (seconds in, 0→1 with overshoot out).
const spring = (t, freq = 2, damp = 6) => t <= 0 ? 0 : 1 - Math.exp(-damp * t) * Math.cos(freq * TAU * t);

function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hash3(x, y, z) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1440662683)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
// Smooth 3D value noise, range 0..1.
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v), w);
}

// ─── Color ─────────────────────────────────────────────────────────────────
const hexCache = new Map();
function hex(h) {
  let v = hexCache.get(h);
  if (!v) { const n = parseInt(h.slice(1), 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; hexCache.set(h, v); }
  return v;
}
const rgba = (h, a) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; };
const mix = (h1, h2, t) => {
  const a = hex(h1), b = hex(h2);
  return `rgb(${lerp(a[0], b[0], t) | 0},${lerp(a[1], b[1], t) | 0},${lerp(a[2], b[2], t) | 0})`;
};

// ─── Rhythm (mirrors audio/synth.py) ───────────────────────────────────────
// Kicks on every beat 1..27, a big impact on 28, silence after.
function kickEnv(t) {
  let k = Math.floor(t / BEAT);
  if (k < 1) return 0;
  k = Math.min(k, 28);
  return Math.exp(-(t - k * BEAT) * 9);
}
function snareEnv(t) {
  const k = Math.floor(t / BEAT);
  if (k < 5 || k > 23 || k % 2 === 0) return 0;
  return Math.exp(-(t - k * BEAT) * 12);
}
function hitEnv(t, beats, decay) {
  let best = -1;
  for (const b of beats) { const s = b * BEAT; if (s <= t && s > best) best = s; }
  return best < 0 ? 0 : Math.exp(-(t - best) * decay);
}
const shakeAmt = t =>
  2.5 * kickEnv(t) +
  7 * hitEnv(t, [1, 2, 3], 10) +
  11 * hitEnv(t, [4, 5, 6], 12) +
  34 * hitEnv(t, [28], 4.5);
const aberration = t =>
  0.9 * kickEnv(t) +
  9 * hitEnv(t, [4, 8, 12, 16, 20, 24], 9) +
  6 * hitEnv(t, [24.5, 25, 25.5, 26, 26.5, 27, 27.5], 11) +
  22 * hitEnv(t, [28], 4);

// ─── Canvases ──────────────────────────────────────────────────────────────
const out = document.getElementById('c');
const octx = out.getContext('2d');
function mk(w = W, h = H) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
const sceneC = mk(), sctx = sceneC.getContext('2d');
const accC = mk(), actx = accC.getContext('2d');
const chan = [mk(), mk(), mk()], chx = chan.map(c => c.getContext('2d'));
const mctx = mk(8, 8).getContext('2d');

const F = {
  disp: s => `800 ${s}px Unbounded`,
  light: s => `400 ${s}px Unbounded`,
  mono: s => `500 ${s}px JBMono`,
  serif: s => `italic ${s}px Instrument`,
};

function bg(ctx, color) { ctx.fillStyle = color; ctx.fillRect(-300, -300, W + 600, H + 600); }

// Lay a word out letter by letter so every glyph can be animated on its own.
function layout(word, font, tracking = 0) {
  mctx.font = font;
  mctx.letterSpacing = '0px';
  const letters = [];
  let x = 0;
  for (const ch of word) {
    const w = mctx.measureText(ch).width;
    letters.push({ ch, x: x + w / 2, w });
    x += w + tracking;
  }
  const width = x - tracking;
  for (const l of letters) l.x -= width / 2;
  const m = mctx.measureText('H');
  return { letters, width, cap: m.actualBoundingBoxAscent };
}

// Caption block in a fixed position — a serif line and a mono formula line.
function caption(ctx, lb, serif, mono, color) {
  const pin = E.outExpo(prog(lb, 0.3, 1.2)), pout = E.inOutCubic(prog(lb, 3.1, 3.55));
  if (pin <= 0 || pout >= 1) return;
  const x = 80, w = 1200;
  ctx.save();
  ctx.beginPath(); ctx.rect(x - 4 + w * pout, H - 215, w * (pin - pout), 120); ctx.clip();
  ctx.fillStyle = C.coral;
  ctx.fillRect(x, H - 206, 36, 4);
  ctx.fillStyle = color;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = F.serif(46);
  ctx.fillText(serif, x, H - 150);
  ctx.globalAlpha = .62;
  ctx.font = F.mono(19);
  ctx.letterSpacing = '1px';
  ctx.fillText(mono, x, H - 114);
  ctx.restore();
}

function dotGrid(ctx, alpha, color = C.paper) {
  ctx.fillStyle = rgba(color, alpha);
  for (let y = CY % 60; y < H; y += 60) for (let x = CX % 60; x < W; x += 60) ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
}

// ═══ 01 · DROP ═════════════════════════════════════════════════════════════
// A ball falls, lands on the downbeat, bounces twice, spawns two moons, then
// swallows the frame.
function sDrop(ctx, lt, t) {
  const lb = lt / BEAT;
  bg(ctx, C.ink);
  dotGrid(ctx, 0.05 + 0.05 * kickEnv(t));
  const R = 62, floorY = CY + R;

  // Horizon line with ruler ticks, drawn outward on first landing.
  const hp = E.outExpo(prog(lb, 1, 2.3));
  if (hp > 0) {
    const half = 820 * hp;
    ctx.strokeStyle = rgba(C.paper, .32); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(CX - half, floorY); ctx.lineTo(CX + half, floorY); ctx.stroke();
    ctx.beginPath();
    for (let k = -13; k <= 13; k++) {
      const x = CX + k * 60;
      if (Math.abs(k * 60) > half) continue;
      const len = k % 4 === 0 ? 16 : 8;
      ctx.moveTo(x, floorY + 6); ctx.lineTo(x, floorY + 6 + len);
    }
    ctx.stroke();
  }

  // Ball kinematics: gravity fall, then two parabolic bounces, all on the grid.
  let y, sx = 1, sy = 1;
  if (lb < 1) {
    const p = lb;
    y = lerp(-R * 2 - 60, floorY - R, p * p);
    sy = 1 + 0.38 * p; sx = 1 - 0.2 * p;
  } else {
    if (lb < 3) {
      const [a, h] = lb < 2 ? [1, 320] : [2, 150];
      const p = lb - a;
      y = floorY - R - h * 4 * p * (1 - p);
      const v = Math.abs(1 - 2 * p);
      sy = 1 + 0.2 * v * v; sx = 1 - 0.1 * v * v;
    } else y = floorY - R;
    const land = Math.min(3, Math.floor(lb));
    const dt = (lb - land) * BEAT;
    const q = Math.exp(-dt * 10) * Math.cos(dt * 30);
    sx *= 1 + 0.55 * q; sy *= 1 - 0.5 * q;
  }

  // Floor ripples at each landing — flattened ellipses read as perspective.
  for (const L of [1, 2, 3]) {
    const dt = lt - L * BEAT;
    if (dt < 0 || dt > 0.9) continue;
    const p = dt / 0.9;
    const rad = R + 620 * E.outExpo(p);
    ctx.strokeStyle = rgba(L === 3 ? C.cyan : C.coral, (1 - p) * .9);
    ctx.lineWidth = 6 * (1 - p) + 1;
    ctx.beginPath(); ctx.ellipse(CX, floorY, rad, rad * 0.14, 0, 0, TAU); ctx.stroke();
  }

  // Contact shadow.
  const height = clamp((floorY - R - y) / 400);
  ctx.fillStyle = rgba('#000000', .55 * (1 - height));
  ctx.beginPath(); ctx.ellipse(CX, floorY + 4, R * (1.1 - .5 * height) * sx, 10 * (1 - .5 * height), 0, 0, TAU); ctx.fill();

  // Moons in a tilted orbit — depth-sorted around the ball.
  const orb = lb >= 3 ? 170 * E.outBack(prog(lb, 3, 3.45), 2.4) : 0;
  const moons = [];
  if (orb > 0) {
    for (let m = 0; m < 2; m++) {
      const a = (lb - 3) * TAU * 1.1 + m * Math.PI + 0.4;
      moons.push({ x: CX + Math.cos(a) * orb, y: CY + Math.sin(a) * orb * .32 - 10, z: Math.sin(a), c: m ? C.sun : C.cyan });
    }
  }
  const moon = m => {
    ctx.fillStyle = m.c;
    ctx.beginPath(); ctx.arc(m.x, m.y, 22 * (1 + .12 * m.z), 0, TAU); ctx.fill();
  };
  moons.filter(m => m.z < 0).forEach(moon);

  ctx.fillStyle = C.coral;
  ctx.beginPath(); ctx.ellipse(CX, y + R - R * sy, R * sx, R * sy, 0, 0, TAU); ctx.fill();
  moons.filter(m => m.z >= 0).forEach(moon);

  // Caption under the horizon.
  const ci = E.outCubic(prog(lb, 1.3, 2.0)), co = prog(lb, 3.1, 3.4);
  if (ci > 0 && co < 1) {
    ctx.save();
    ctx.globalAlpha = ci * (1 - co);
    ctx.fillStyle = C.paper; ctx.font = F.serif(50); ctx.textAlign = 'center';
    ctx.fillText('a fifteen-second study in motion', CX, floorY + 130 + 20 * (1 - ci));
    ctx.restore();
  }

  // The ball swallows the frame.
  const wp = prog(lb, 3.45, 4);
  if (wp > 0) {
    ctx.fillStyle = C.coral;
    ctx.beginPath(); ctx.arc(CX, CY, R + 1250 * E.inExpo(wp), 0, TAU); ctx.fill();
  }
}

// ═══ 02 · TYPE ═════════════════════════════════════════════════════════════
// Three words, three entrance styles, extruded type; then we dive through the O.
let TYPE = null;
function initType() {
  const fs = 206, font = F.disp(fs);
  const words = ['EVERY', 'FRAME', 'COUNTS.'];
  const lines = words.map(w => layout(w, font, -4));
  const cap = lines[0].cap, gap = fs * .3;
  const total = 3 * cap + 2 * gap;
  lines.forEach((l, i) => { l.base = CY - total / 2 + cap + i * (cap + gap); });
  mctx.font = font;
  const mo = mctx.measureText('O');
  const o = lines[2].letters[1];
  TYPE = { fs, font, lines, cap, ox: CX + o.x, oy: lines[2].base - (mo.actualBoundingBoxAscent - mo.actualBoundingBoxDescent) / 2 };
}

function sType(ctx, lt, t) {
  const lb = lt / BEAT;
  const { fs, font, lines, cap, ox, oy } = TYPE;
  bg(ctx, C.coral);

  // Dive camera: exponential zoom into the filled O.
  const zp = prog(lb, 3.0, 4.0);
  const z = Math.exp(Math.log(110) * E.inQuart(zp));
  const cp = E.inOutCubic(prog(lb, 2.9, 3.6));
  let punch = 1;
  for (let k = 0; k < 3; k++) { const dt = lt - k * BEAT; if (dt >= 0) punch += 0.035 * Math.exp(-dt * 14); }

  // Pivot drifts from screen center to the O, and the O is pulled to center.
  const px = lerp(CX, ox, cp), py = lerp(CY, oy, cp);
  ctx.save();
  ctx.translate(CX, CY);
  ctx.scale(punch * z, punch * z);
  ctx.rotate(-0.25 * E.inCubic(zp));
  ctx.translate(-px, -py);

  // Moving diagonal stripes in the background.
  ctx.save();
  ctx.translate(CX, CY); ctx.rotate(-0.42);
  ctx.fillStyle = 'rgba(120,10,0,0.07)';
  const off = (lt * 160) % 180;
  for (let x = -1500 + off; x < 1500; x += 180) ctx.fillRect(x, -1400, 70, 2800);
  ctx.restore();

  ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const DEPTH = 14;

  lines.forEach((line, i) => {
    const t0 = i * BEAT;
    line.letters.forEach((L, j) => {
      const d = t0 + j * (i === 2 ? 0.026 : 0.034);
      const raw = prog(lt, d, d + 0.55);
      if (raw <= 0) return;
      let x = CX + L.x, y = line.base, rot = 0, sc = 1, skew = 0;
      if (i === 0) {           // rise from a mask
        const p = E.outExpo(raw);
        y += (1 - p) * (cap + 40); rot = (1 - p) * -0.25;
      } else if (i === 1) {    // pop with overshoot
        const p = E.outBack(raw, 2.6);
        sc = p; rot = (1 - p) * 0.7;
      } else {                 // slide in from the right, skewed
        const p = E.outExpo(raw);
        x += (1 - p) * (1100 + j * 70); skew = (1 - p) * -0.6;
      }
      const depth = DEPTH * E.outCubic(prog(lt, d + 0.12, d + 0.6));

      ctx.save();
      if (i === 0) { ctx.beginPath(); ctx.rect(CX - 1200, line.base - cap - 30, 2400, cap + 50); ctx.clip(); }
      ctx.translate(x, y - cap / 2);
      ctx.rotate(rot); ctx.transform(1, 0, skew, 1, 0, 0); ctx.scale(sc, sc);
      ctx.translate(0, cap / 2);
      // Extrusion.
      ctx.fillStyle = C.coralDk;
      for (let s = Math.ceil(depth); s >= 1; s--) ctx.fillText(L.ch, s * 1.4, s * 1.4);
      // Ink disc that fills the O's counter before the dive.
      if (i === 2 && j === 1) {
        const dp = E.outBack(prog(lb, 2.5, 2.9), 2.2);
        if (dp > 0) {
          ctx.fillStyle = C.ink;
          ctx.beginPath(); ctx.arc(0, oy - line.base, fs * .27 * dp, 0, TAU);
          ctx.fill();
        }
      }
      ctx.fillStyle = C.ink;
      ctx.fillText(L.ch, 0, 0);
      ctx.restore();
    });
  });
  ctx.restore();

  const inkIn = prog(lb, 3.82, 4.0);
  if (inkIn > 0) { ctx.fillStyle = rgba(C.ink, inkIn); ctx.fillRect(-300, -300, W + 600, H + 600); }
}

// ═══ 03 · SHAPE ════════════════════════════════════════════════════════════
// Polar shape morphs (circle → triangle → square → star) with time echoes,
// over a dot field rippling out on every beat.
const NS = 256;
let SHAPES = null;
function polyR(verts, th) {
  const dx = Math.cos(th), dy = Math.sin(th);
  let best = Infinity;
  for (let k = 0; k < verts.length; k++) {
    const P = verts[k], Q = verts[(k + 1) % verts.length];
    const ex = Q[0] - P[0], ey = Q[1] - P[1];
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const r = (P[0] * ey - P[1] * ex) / den;
    const s = (P[0] * dy - P[1] * dx) / den;
    if (r > 0 && s >= -1e-6 && s <= 1 + 1e-6 && r < best) best = r;
  }
  return best;
}
function initShapes() {
  const poly = (n, rad, a0, inner) => {
    const v = [];
    const m = inner ? n * 2 : n;
    for (let k = 0; k < m; k++) {
      const a = a0 + k * TAU / m, r = inner && k % 2 ? inner : rad;
      v.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return v;
  };
  const defs = [null, poly(3, 1.22, -Math.PI / 2), poly(4, 1.2, Math.PI / 4), poly(5, 1.28, -Math.PI / 2, 0.56)];
  SHAPES = defs.map(v => {
    const a = new Float32Array(NS);
    for (let j = 0; j < NS; j++) a[j] = v ? polyR(v, j / NS * TAU) : 1;
    return a;
  });
}
function shapeState(lt) {
  const lb = lt / BEAT;
  let A = 0, B = 0, p = 0;
  if (lb >= 1) { const k = Math.min(3, Math.floor(lb)); A = k - 1; B = k; p = E.inOutBack(prog(lb, k, k + 0.6)); }
  let scale = 200 * E.outBack(prog(lb, 0, 0.55), 2) * (1 - E.inBack(prog(lb, 3.35, 3.9), 2.5));
  let rot = lb * 0.4;
  for (let k = 1; k <= 3; k++) rot += (Math.PI / 3) * E.outExpo(prog(lb, k, k + 0.7));
  return { A, B, p, scale, rot };
}
function shapePath(ctx, st, mult = 1) {
  const a = SHAPES[st.A], b = SHAPES[st.B];
  ctx.beginPath();
  for (let j = 0; j <= NS; j++) {
    const jj = j % NS;
    const r = lerp(a[jj], b[jj], st.p) * st.scale * mult;
    const th = jj / NS * TAU + st.rot;
    const x = CX + Math.cos(th) * r, y = CY + Math.sin(th) * r;
    j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

function sShape(ctx, lt, t) {
  const lb = lt / BEAT;
  bg(ctx, C.ink);

  // Dot field — ripples leave the center on each beat, then everything is inhaled.
  const cols = 31, rows = 17, sp = 60;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const gx = CX + (c - 15) * sp, gy = CY + (r - 8) * sp;
    const dx = gx - CX, dy = gy - CY, d = Math.hypot(dx, dy);
    let amp = 0;
    for (let k = 0; k < 4; k++) {
      const s = lt - k * BEAT;
      if (s < 0) continue;
      const w = (d - s * 1500) / 75;
      amp += Math.exp(-w * w) * Math.exp(-s * 1.1);
    }
    amp = Math.min(amp, 1.2);
    const born = E.outExpo(prog(lt, d / 2600, d / 2600 + 0.35));
    if (born <= 0) continue;
    const pull = E.inExpo(prog(lb, 3.05 + d / 1100 * 0.4, 3.9));
    const push = 1 + amp * 14 / Math.max(d, 1);
    const x = lerp(CX + dx * push, CX, pull), y = lerp(CY + dy * push, CY, pull);
    const rad = (2.2 * born + amp * 9) * (1 - pull * 0.6);
    ctx.fillStyle = amp > 0.08 ? mix(C.paper, C.cyan, clamp(amp)) : rgba(C.paper, .28);
    ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
  }

  // Time echoes: the same shape function sampled in the past.
  for (let e = 7; e >= 1; e--) {
    const st = shapeState(lt - e * 0.04);
    if (st.scale <= 0) continue;
    shapePath(ctx, st, 1 + e * 0.035);
    ctx.strokeStyle = rgba(PAL[(e + 1) % 4], 0.75 * (1 - e / 8));
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  const st = shapeState(lt);
  if (st.scale > 0) {
    const pump = 1 + 0.06 * kickEnv(t);
    shapePath(ctx, st, pump);
    ctx.fillStyle = C.coral; ctx.fill();
    // Counter-rotating dashed halo.
    ctx.save();
    ctx.setLineDash([4, 12]); ctx.lineDashOffset = -lt * 80;
    shapePath(ctx, { ...st, rot: -st.rot * 0.7 }, 1.32 * pump);
    ctx.strokeStyle = rgba(C.paper, .45); ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    // Inner ink cut.
    shapePath(ctx, { ...st, rot: st.rot + 0.5 }, 0.36);
    ctx.fillStyle = C.ink; ctx.fill();
  }

  const n = ['∞', '3', '4', '5★'][Math.min(3, Math.max(0, Math.floor(lb)))];
  caption(ctx, lb, `shape, by formula — n = ${n}`, 'r(θ) = cos(π/n) / cos(θ mod 2π/n − π/n)', C.paper);
}

// ═══ 04 · PARTICLE ═════════════════════════════════════════════════════════
// 5,000 particles: closed-form explosion, converge into a word, blown away by
// a noise-bent wind. Positions are analytic, so streaks come for free.
const NP = 5000;
let PARTS = null;
function initParticles() {
  const c = mk(), x = c.getContext('2d');
  const word = 'MATH';
  let fs = 420;
  x.font = F.disp(fs);
  const w0 = x.measureText(word).width;
  fs = Math.min(fs, fs * 1500 / w0);
  x.font = F.disp(fs); x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = '#fff';
  x.fillText(word, CX, CY + fs * 0.04);
  const data = x.getImageData(0, 0, W, H).data;
  const pts = [];
  for (let y = 0; y < H; y += 4) for (let xx = 0; xx < W; xx += 4) if (data[(y * W + xx) * 4 + 3] > 128) pts.push([xx, y]);
  const r = rng(7);
  for (let i = pts.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [pts[i], pts[j]] = [pts[j], pts[i]]; }
  const colors = [C.paper, C.paper, C.paper, C.coral, C.cyan, C.sun];
  PARTS = [];
  for (let i = 0; i < NP; i++) {
    const a = r() * TAU, tgt = pts[i % pts.length];
    PARTS.push({
      dx: Math.cos(a), dy: Math.sin(a), v: 500 + 3000 * Math.pow(r(), 0.7),
      tx: tgt[0] + (r() - .5) * 2, ty: tgt[1] + (r() - .5) * 2,
      d: r() * 0.3, sp: 1 + r() * 0.7, n: noise3(tgt[0] * .004, tgt[1] * .004, 3.1),
      col: (r() * colors.length) | 0, size: r() < .25 ? 1 : 0,
    });
  }
  PARTS.colors = colors;
}
function pPos(P, lt) {
  const k = 3.2;
  const e = (1 - Math.exp(-k * Math.max(lt, 0))) / k;
  let x = CX + P.dx * P.v * e, y = CY + P.dy * P.v * e;
  const pb = E.inOutExpo(prog(lt, BEAT * (0.8 + P.d), BEAT * (1.75 + P.d)));
  x = lerp(x, P.tx, pb); y = lerp(y, P.ty, pb);
  if (pb > 0.9) {
    x += (noise3(P.tx * .03, P.ty * .03, lt * 2.5) - .5) * 3;
    y += (noise3(P.tx * .03 + 40, P.ty * .03, lt * 2.5) - .5) * 3;
  }
  const s0 = BEAT * (2.65 + P.tx / W * 0.55 + P.d * 0.25);
  const q = prog(lt, s0, s0 + BEAT * 1.1);
  if (q > 0) {
    const qq = q * q * q;
    x += qq * W * 1.45 * P.sp;
    y += (P.n - .5) * 700 * qq + Math.sin(P.tx * 0.01) * 60 * q * q;
  }
  return [x, y];
}
function sParticles(ctx, lt, t) {
  const lb = lt / BEAT;
  bg(ctx, C.ink);

  // Detonation flash + ring.
  const fp = prog(lt, 0, 0.35);
  if (fp < 1) {
    const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, 900 * E.outExpo(fp) + 1);
    g.addColorStop(0, rgba(C.white, .9 * (1 - fp)));
    g.addColorStop(1, rgba(C.coral, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = rgba(C.sun, 1 - fp); ctx.lineWidth = 30 * (1 - fp);
    ctx.beginPath(); ctx.arc(CX, CY, 1100 * E.outExpo(fp), 0, TAU); ctx.stroke();
  }

  const cols = PARTS.colors;
  const paths = [];
  for (let c = 0; c < cols.length; c++) paths.push([new Path2D(), new Path2D()]);
  for (const P of PARTS) {
    const [x1, y1] = pPos(P, lt);
    if (x1 < -50 || x1 > W + 50 || y1 < -50 || y1 > H + 50) continue;
    const [x0, y0] = pPos(P, lt - 0.014);
    const p = paths[P.col][P.size];
    p.moveTo(x0, y0); p.lineTo(x1 + 0.01, y1);
  }
  ctx.lineCap = 'round';
  for (let c = 0; c < cols.length; c++) {
    ctx.strokeStyle = cols[c];
    ctx.lineWidth = 3; ctx.stroke(paths[c][0]);
    ctx.lineWidth = 5.5; ctx.stroke(paths[c][1]);
  }
  ctx.lineCap = 'butt';

  const count = Math.round(NP * E.outCubic(prog(lb, 0.1, 1.6)));
  caption(ctx, lb, `${count.toLocaleString('en-US')} particles, zero simulation`, 'p(t) = c + v · (1 − e^(−kt)) / k', C.paper);
}

// ═══ 05 · DEPTH ════════════════════════════════════════════════════════════
// A 1,500-point cloud morphing sphere → torus → trefoil knot → flat ring,
// projected in perspective, depth-sorted, fogged. The ring hands off to 06.
const NPT = 1500;
let CLOUD = null;
function initCloud() {
  const sphere = new Float32Array(NPT * 3), torus = new Float32Array(NPT * 3),
        knot = new Float32Array(NPT * 3), ring = new Float32Array(NPT * 3);
  const ga = Math.PI * (3 - Math.sqrt(5));
  const r = rng(11);
  for (let i = 0; i < NPT; i++) {
    const y = 1 - 2 * (i + .5) / NPT, rr = Math.sqrt(1 - y * y), ph = i * ga;
    sphere.set([Math.cos(ph) * rr * .95, y * .95, Math.sin(ph) * rr * .95], i * 3);
    const u = (i % 75) / 75 * TAU, v = Math.floor(i / 75) / 20 * TAU;
    torus.set([(0.78 + .3 * Math.cos(v)) * Math.cos(u), .3 * Math.sin(v), (0.78 + .3 * Math.cos(v)) * Math.sin(u)], i * 3);
    const s = (i % 150) / 150 * TAU, w = Math.floor(i / 150) / 10 * TAU;
    const kc = [(2 + Math.cos(3 * s)) * Math.cos(2 * s) * .33, (2 + Math.cos(3 * s)) * Math.sin(2 * s) * .33, Math.sin(3 * s) * .33];
    const rl = Math.hypot(kc[0], kc[1]);
    const nx = kc[0] / rl, ny = kc[1] / rl;
    knot.set([kc[0] + .13 * Math.cos(w) * nx, kc[1] + .13 * Math.cos(w) * ny, kc[2] + .13 * Math.sin(w)], i * 3);
    const a = i / NPT * TAU;
    ring.set([Math.cos(a) * .758, Math.sin(a) * .758, (r() - .5) * .02], i * 3);
  }
  const col = [];
  for (let i = 0; i < NPT; i++) {
    const f = (i / NPT) * 3;
    const k = Math.min(2, Math.floor(f));
    col.push(mix([C.cyan, C.violet, C.coral, C.sun][k], [C.cyan, C.violet, C.coral, C.sun][k + 1], f - k));
  }
  CLOUD = { shapes: [sphere, torus, knot, ring], col, px: new Float32Array(NPT), py: new Float32Array(NPT), pz: new Float32Array(NPT), ps: new Float32Array(NPT), idx: new Uint16Array(NPT) };
}
function sDepth(ctx, lt, t) {
  const lb = lt / BEAT;
  const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, 1100);
  g.addColorStop(0, '#221656'); g.addColorStop(1, C.ink);
  ctx.fillStyle = g; ctx.fillRect(-300, -300, W + 600, H + 600);

  const flat = E.inOutCubic(prog(lb, 3.0, 3.75));
  let ry = lt * 1.3, rx = 0.45 + 0.25 * Math.sin(lt * 1.7);
  for (let k = 1; k <= 3; k++) ry += 0.9 * E.outExpo(prog(lb, k, k + 0.7));
  ry *= 1 - flat; rx *= 1 - flat;
  const cy_ = Math.cos(ry), sy_ = Math.sin(ry), cx_ = Math.cos(rx), sx_ = Math.sin(rx);
  const DIST = 3.2, FOC = 330 * DIST;
  const project = (x, y, z) => {
    let X = x * cy_ + z * sy_, Z = -x * sy_ + z * cy_;
    let Y = y * cx_ - Z * sx_; Z = y * sx_ + Z * cx_;
    const s = FOC / (Z + DIST);
    return [CX + X * s, CY + Y * s, Z, s / 330];
  };

  // Orbit rings.
  const oa = 1 - prog(lb, 2.8, 3.3);
  if (oa > 0) {
    for (let o = 0; o < 2; o++) {
      ctx.beginPath();
      for (let k = 0; k <= 120; k++) {
        const a = k / 120 * TAU;
        const tl = o ? 1.1 : -0.5;
        const p = project(Math.cos(a) * 1.35, Math.sin(a) * 1.35 * Math.sin(tl), Math.sin(a) * 1.35 * Math.cos(tl));
        k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
      }
      ctx.strokeStyle = rgba(C.paper, .18 * oa); ctx.lineWidth = 1.5; ctx.stroke();
      const a = lt * (o ? 2.2 : -1.6) + o;
      const tl = o ? 1.1 : -0.5;
      const p = project(Math.cos(a) * 1.35, Math.sin(a) * 1.35 * Math.sin(tl), Math.sin(a) * 1.35 * Math.cos(tl));
      ctx.fillStyle = rgba(o ? C.sun : C.cyan, oa);
      ctx.beginPath(); ctx.arc(p[0], p[1], 7 * p[3], 0, TAU); ctx.fill();
    }
  }

  // Morph between point sets with a per-point sweep delay.
  const { shapes, px, py, pz, ps, idx, col } = CLOUD;
  const pump = 1 + 0.05 * kickEnv(t);
  for (let i = 0; i < NPT; i++) {
    let A = 0, B = 0, p = 0;
    if (lb >= 1) {
      const k = Math.min(3, Math.floor(lb));
      const dl = (i / NPT) * 0.3;
      A = k - 1; B = k;
      p = E.inOutCubic(prog(lb, k + dl, k + dl + 0.6));
      if (k >= 2 && p === 0) { A = k - 2; B = k - 1; p = 1; }
    }
    const a = shapes[A], b = shapes[B];
    const x = lerp(a[i * 3], b[i * 3], p) * pump, y = lerp(a[i * 3 + 1], b[i * 3 + 1], p) * pump, z = lerp(a[i * 3 + 2], b[i * 3 + 2], p) * pump;
    const q = project(x, y, z);
    px[i] = q[0]; py[i] = q[1]; pz[i] = q[2]; ps[i] = q[3]; idx[i] = i;
  }
  idx.sort((a, b) => pz[b] - pz[a]);

  // Paper iris opens beneath the ring — points turn to ink as it passes.
  const ip = prog(lb, 3.5, 4);
  const iris = 1250 * E.inExpo(ip);
  if (ip > 0) { ctx.fillStyle = C.paper; ctx.beginPath(); ctx.arc(CX, CY, iris, 0, TAU); ctx.fill(); }

  const intro = E.outBack(prog(lb, 0, 0.6), 1.5);
  for (let n = 0; n < NPT; n++) {
    const i = idx[n];
    const fog = clamp(0.3 + (1 - (pz[i] + 1.1) / 2.2) * 0.8);
    const inIris = Math.hypot(px[i] - CX, py[i] - CY) < iris;
    ctx.fillStyle = inIris ? C.ink : col[i];
    ctx.globalAlpha = inIris ? 1 : fog;
    const s = 3.2 * ps[i] * intro;
    ctx.fillRect(lerp(CX, px[i], intro) - s, lerp(CY, py[i], intro) - s, s * 2, s * 2);
  }
  ctx.globalAlpha = 1;

  // Stripe wipe — the particle wind from 04 turns into bands of colour.
  const bands = [C.coral, C.sun, C.cyan, C.violet, C.paper];
  for (let k = 0; k < 5; k++) {
    const d = k * 0.035;
    const head = W * E.inOutCubic(prog(lt, d - 0.05, d + 0.28));
    const tail = W * E.inOutCubic(prog(lt, d + 0.1, d + 0.45));
    if (head - tail > 0.5) { ctx.fillStyle = bands[k]; ctx.fillRect(tail, k * H / 5, head - tail, H / 5 + 1); }
  }

  const q0 = CLOUD.shapes[0];
  caption(ctx, lb, 'in three dimensions',
    `x′ = f·x / (z + d)   →   [${(q0[0] * cy_).toFixed(3)}, ${(q0[1] * cx_).toFixed(3)}, ${(q0[2] * cy_).toFixed(3)}]`, C.paper);
}

// ═══ 06 · RHYTHM ═══════════════════════════════════════════════════════════
// Radial equaliser driven by the same envelopes the soundtrack is built from.
function sRhythm(ctx, lt, t) {
  const lb = lt / BEAT;
  bg(ctx, C.paper);

  // Outline marquee rows.
  ctx.save();
  ctx.font = F.disp(330); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.strokeStyle = rgba(C.ink, .13); ctx.lineWidth = 2;
  const word = 'RHYTHM · RHYTHM · RHYTHM · ';
  mctx.font = F.disp(330);
  const ww = mctx.measureText('RHYTHM · ').width;
  for (const [yy, dir] of [[CY - 310, -1], [CY + 310, 1]]) {
    const x0 = ((dir * lt * 420) % ww) - ww;
    ctx.strokeText(word, x0, yy);
  }
  ctx.restore();

  const k = kickEnv(t), sn = snareEnv(t);
  const R0 = 250, NB = 120;
  const rot = lt * 0.25;

  // Rotating rings.
  ctx.save();
  ctx.translate(CX, CY);
  ctx.rotate(rot * 1.6);
  ctx.setLineDash([2, 14]);
  ctx.strokeStyle = rgba(C.ink, .55); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 500, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  ctx.rotate(-rot * 3);
  ctx.beginPath();
  for (let i = 0; i < 72; i++) {
    const a = i / 72 * TAU, l = i % 6 === 0 ? 18 : 8;
    ctx.moveTo(Math.cos(a) * 545, Math.sin(a) * 545); ctx.lineTo(Math.cos(a) * (545 + l), Math.sin(a) * (545 + l));
  }
  ctx.strokeStyle = rgba(C.ink, .5); ctx.stroke();
  ctx.restore();
  // Orbiters.
  const oa = lt / BAR * TAU;
  ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(CX + Math.cos(oa) * 500, CY + Math.sin(oa) * 500, 8, 0, TAU); ctx.fill();
  ctx.fillStyle = C.coral; ctx.beginPath(); ctx.arc(CX + Math.cos(-oa * 2) * 545, CY + Math.sin(-oa * 2) * 545, 6, 0, TAU); ctx.fill();

  // Bars.
  ctx.lineCap = 'round';
  ctx.lineWidth = 7;
  const tips = [];
  ctx.strokeStyle = C.ink;
  ctx.beginPath();
  for (let i = 0; i < NB; i++) {
    const a = i / NB * TAU + rot - Math.PI / 2;
    const grow = E.outBack(prog(lt, (i / NB) * 0.25, (i / NB) * 0.25 + 0.3), 2);
    const nz = noise3(i * 0.16, lt * 2.4, 0);
    let amp = 0.12 + 0.62 * k * (0.55 + 0.45 * Math.sin(i * 0.52 + lt * 5)) + 0.5 * nz * nz + (i % 2 ? sn * 0.35 : 0);
    const out_ = E.inExpo(prog(lb, 3.45, 4));
    const len = (10 + amp * 230) * grow + out_ * 1400;
    const c = Math.cos(a), s = Math.sin(a);
    ctx.moveTo(CX + c * R0, CY + s * R0);
    ctx.lineTo(CX + c * (R0 + len), CY + s * (R0 + len));
    if (amp > 0.55 && grow > 0.9) tips.push([CX + c * (R0 + len + 14), CY + s * (R0 + len + 14)]);
  }
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = C.coral;
  for (const [x, y] of tips) { ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill(); }

  // Core.
  const cs = E.outBack(prog(lt, 0.05, 0.45), 2.2) * (1 + 0.08 * k);
  ctx.fillStyle = C.coral;
  ctx.beginPath(); ctx.arc(CX, CY, 180 * cs, 0, TAU); ctx.fill();
  if (cs > 0.2) {
    ctx.save();
    ctx.translate(CX, CY); ctx.scale(cs, cs);
    ctx.fillStyle = C.paper; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = F.disp(104);
    ctx.fillText('128', 0, 30);
    ctx.font = F.mono(20); ctx.letterSpacing = '8px';
    ctx.fillText('BPM', 4, 78);
    ctx.restore();
  }

  caption(ctx, lb, 'on the beat, every beat', '128 bpm · 4/4 · A minor · kick → scale, snare → odd bars', C.ink);

  // Aperture wipe to ink.
  const ap = E.inOutCubic(prog(lb, 3.45, 4));
  if (ap > 0) {
    ctx.fillStyle = C.ink;
    const n = 12;
    for (let s = 0; s < n; s++) {
      const a0 = s * TAU / n + rot * 2;
      ctx.beginPath(); ctx.moveTo(CX, CY); ctx.arc(CX, CY, 1400, a0, a0 + TAU / n * ap + 0.002); ctx.closePath(); ctx.fill();
    }
  }
}

// ═══ 07 · RUSH ═════════════════════════════════════════════════════════════
// Speed-ramping twisted tunnel with warp lines; words cut on every half beat.
const RUSH_WORDS = [
  { w: 'NO', bg: C.ink, fg: C.paper, tun: null },
  { w: 'TIMELINE', bg: C.coral, fg: C.ink, tun: C.ink },
  { w: 'NO', bg: C.ink, fg: C.sun, tun: null },
  { w: 'KEYFRAMES', bg: C.paper, fg: C.ink, tun: C.ink },
  { w: 'JUST', bg: C.ink, fg: C.paper, tun: null },
  { w: 'CODE', bg: C.cyan, fg: C.ink, tun: C.ink },
  { w: '&', bg: C.ink, fg: C.coral, tun: null },
  { w: 'MATH.', bg: C.sun, fg: C.ink, tun: C.ink },
];
function sRush(ctx, lt, t) {
  const lb = lt / BEAT;
  const h = Math.min(7, Math.floor(lb * 2)), u = lb * 2 - h;
  const style = RUSH_WORDS[h];
  bg(ctx, style.bg);

  const travel = 3 * lt + 30 * lt * lt * lt / (3 * BAR * BAR);
  const vx = CX + Math.sin(lt * 2.2) * 70, vy = CY + Math.cos(lt * 1.7) * 40;
  const N = 30, DZ = 0.6, SPAN = N * DZ;

  // Warp lines.
  const r = rng(5);
  ctx.strokeStyle = rgba(style.tun || C.paper, .5); ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 160; i++) {
    const a = r() * TAU, off = r() * SPAN, rad = 1.3 + r() * 2;
    let z = ((off - travel * 1.2) % SPAN + SPAN) % SPAN;
    if (z < 0.2) continue;
    const z2 = z + 0.25 + travel * 0.02;
    const r1 = 520 * rad / z, r2 = 520 * rad / z2;
    ctx.moveTo(vx + Math.cos(a) * r2, vy + Math.sin(a) * r2);
    ctx.lineTo(vx + Math.cos(a) * r1, vy + Math.sin(a) * r1);
  }
  ctx.stroke();

  // Tunnel rings, far to near.
  const rings = [];
  for (let k = 0; k < N; k++) {
    const z = ((k * DZ - travel) % SPAN + SPAN) % SPAN;
    if (z > 0.12) rings.push([z, k]);
  }
  rings.sort((a, b) => b[0] - a[0]);
  ctx.lineJoin = 'round';
  for (const [z, k] of rings) {
    const rad = 520 / z;
    if (rad > 3000) continue;
    const alpha = clamp((SPAN - z) / 7) * clamp((z - 0.12) / 0.3);
    const rot = k * 0.22 + lt * 0.9 + z * 0.12;
    ctx.strokeStyle = style.tun ? rgba(style.tun, alpha) : rgba(PAL[k % 4], alpha);
    ctx.lineWidth = Math.min(80, 16 / z);
    ctx.beginPath();
    for (let s = 0; s <= 4; s++) {
      const a = rot + s * TAU / 4;
      const x = vx + Math.cos(a) * rad, y = vy + Math.sin(a) * rad;
      s ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath(); ctx.stroke();
  }

  // Word.
  const wl = style.w;
  mctx.font = F.disp(100);
  const fs = Math.min(300, 100 * 1500 / mctx.measureText(wl).width);
  const sc = 1.22 - 0.22 * E.outExpo(clamp(u * 1.6));
  ctx.save();
  ctx.translate(CX, CY);
  ctx.scale(sc, sc * (1 + 0.08 * (1 - E.outExpo(clamp(u * 2)))));
  ctx.font = F.disp(fs); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (style.bg === C.ink) {
    ctx.fillStyle = rgba(style.fg, .25);
    ctx.fillText(wl, 8, 10);
  }
  ctx.fillStyle = style.fg;
  ctx.fillText(wl, 0, 0);
  ctx.restore();
}

// ═══ 08 · RESOLVE ══════════════════════════════════════════════════════════
// Impact, lockup with chromatic registration, then everything folds back into
// the single coral dot we started with.
let LOCK = null;
function initLock() {
  LOCK = layout('MOTION', F.disp(210), -2);
  const r = rng(21);
  LOCK.letters.forEach(L => {
    const a = r() * TAU;
    L.sx = Math.cos(a) * (700 + r() * 400); L.sy = Math.sin(a) * (420 + r() * 200);
    L.sr = (r() - .5) * 3;
  });
}
function sResolve(ctx, lt, t) {
  const lb = lt / BEAT;
  bg(ctx, C.ink);

  // Echo of the 03 dot field — one ripple from the impact.
  for (let y = CY % 60; y < H; y += 60) for (let x = CX % 60; x < W; x += 60) {
    const d = Math.hypot(x - CX, y - CY);
    const w = (d - lt * 1700) / 90, amp = Math.exp(-w * w) * Math.exp(-lt * 1.2);
    ctx.fillStyle = amp > 0.05 ? mix(C.ink, C.coral, clamp(amp * 1.5)) : rgba(C.paper, .07);
    const rr = 1.5 + amp * 8;
    ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }

  const sw = prog(lt, 0, 0.9);
  if (sw < 1) {
    ctx.strokeStyle = rgba(C.coral, 1 - sw); ctx.lineWidth = 60 * (1 - sw);
    ctx.beginPath(); ctx.arc(CX, CY, 1500 * E.outExpo(sw), 0, TAU); ctx.stroke();
  }

  const G = E.inBack(prog(lb, 2.85, 3.3), 2);
  const fade = 1 - prog(lb, 3.1, 3.3);
  ctx.save();
  ctx.translate(CX, CY); ctx.scale(1 - G, 1 - G); ctx.translate(-CX, -CY);
  ctx.globalAlpha = fade;

  // Lockup word with chromatic registration.
  const base = CY + LOCK.cap / 2 - 10;
  ctx.font = F.disp(210); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const offs = [[C.coral, -1, -0.6], [C.cyan, 1, 0.2], [C.sun, 0.2, 1]];
  LOCK.letters.forEach((L, j) => {
    const p = spring(lt - 0.05 - j * 0.04, 1.6, 5.5);
    const reg = 1 - E.inOutCubic(prog(lb, 1.2 + j * 0.06, 2.4 + j * 0.06));
    ctx.save();
    ctx.translate(CX + lerp(L.sx, L.x, p), base + lerp(L.sy, 0, p));
    ctx.rotate(lerp(L.sr, 0, p));
    const s = lerp(0.2, 1, clamp(p, 0, 1.2));
    ctx.scale(s, s);
    ctx.globalCompositeOperation = 'lighter';
    for (const [c, ox, oy] of offs) { ctx.fillStyle = c; ctx.fillText(L.ch, ox * 26 * reg, oy * 26 * reg); }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = C.paper; ctx.globalAlpha = fade * (1 - reg * 0.9);
    ctx.fillText(L.ch, 0, 0);
    ctx.restore();
  });

  // Subtitle wipe + typewriter spec line.
  const sp = E.outExpo(prog(lb, 1.3, 2.3));
  if (sp > 0) {
    ctx.save();
    ctx.beginPath(); ctx.rect(CX - 700, CY + 100, 1400 * sp, 90); ctx.clip();
    ctx.fillStyle = C.paper; ctx.font = F.serif(60);
    ctx.fillText('made entirely in code, by Claude', CX, CY + 165);
    ctx.restore();
  }
  const spec = '15 s  ·  900 frames  ·  60 fps  ·  0 keyframes';
  const n = Math.floor(spec.length * prog(lb, 1.7, 2.7));
  if (n > 0) {
    ctx.font = F.mono(21); ctx.letterSpacing = '3px'; ctx.textAlign = 'left';
    mctx.font = F.mono(21); mctx.letterSpacing = '3px';
    const fw = mctx.measureText(spec).width;
    ctx.fillStyle = rgba(C.paper, .6);
    const shown = spec.slice(0, n);
    ctx.fillText(shown, CX - fw / 2, CY + 232);
    if (n < spec.length || Math.floor(lt * 4) % 2 === 0) {
      const cw = mctx.measureText(shown).width;
      ctx.fillStyle = C.coral; ctx.fillRect(CX - fw / 2 + cw + 4, CY + 214, 12, 22);
    }
    ctx.letterSpacing = '0px'; mctx.letterSpacing = '0px';
  }
  ctx.restore();

  // The three dots (echo of 01's ball and moons) — bounce in on the arpeggio.
  const dotY = CY - LOCK.cap / 2 - 110;
  const dots = [[-64, C.cyan], [0, C.coral], [64, C.sun]];
  dots.forEach(([dx, c], j) => {
    const t0 = BEAT * (0.9 + j * 0.5);
    const p = prog(lt, t0, t0 + 0.55);
    if (p <= 0) return;
    let y = dotY - 220 * (1 - E.outElastic(p)) * (1 - p);
    let x = CX + dx, r = 16;
    const m = E.inOutCubic(prog(lb, 2.8, 3.3));
    if (j === 1) {
      x = lerp(x, CX, m); y = lerp(y, CY, m);
      r = lerp(r, 46, E.outBack(prog(lb, 3.2, 3.45), 2.5)) * (1 - E.inBack(prog(lb, 3.5, 3.75), 3));
      r *= 1 + 0.1 * hitEnv(t, [31.2], 14);
    } else {
      x = lerp(x, CX, m); y = lerp(y, CY, m);
      r *= 1 - m;
    }
    if (r <= 0.2) return;
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  });

  // Impact flash.
  const fl = lt < 0 ? 0 : Math.exp(-lt * 16);
  if (fl > 0) { ctx.fillStyle = rgba(C.white, fl); ctx.fillRect(-300, -300, W + 600, H + 600); }
}

// ─── HUD ───────────────────────────────────────────────────────────────────
const SCENES = [
  ['DROP', sDrop], ['TYPE', sType], ['SHAPE', sShape], ['PARTICLE', sParticles],
  ['DEPTH', sDepth], ['RHYTHM', sRhythm], ['RUSH', sRush], ['RESOLVE', sResolve],
];
const pad = (n, l = 2) => String(n).padStart(l, '0');
function hud(ctx, t, f) {
  const a = prog(t, 0.15, 0.6) * (1 - prog(t, 14.05, 14.35));
  if (a <= 0) return;
  const si = Math.min(7, Math.floor(t / BAR));
  ctx.save();
  ctx.globalCompositeOperation = 'difference';
  ctx.globalAlpha = a;
  ctx.fillStyle = ctx.strokeStyle = '#E6E2D8';
  ctx.lineWidth = 2;
  const m = 36, L = 20;
  ctx.beginPath();
  for (const [x, y, dx, dy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) {
    ctx.moveTo(x, y + dy * L); ctx.lineTo(x, y); ctx.lineTo(x + dx * L, y);
  }
  ctx.stroke();
  ctx.font = F.mono(16); ctx.letterSpacing = '3px'; ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('MOTION STUDY Nº 01', 76, 60);
  ctx.fillText(`${pad(si + 1)} / 08 — ${SCENES[si][0]}`, 76, H - 60);
  ctx.textAlign = 'right';
  const fr = Math.min(f, FRAMES - 1);
  ctx.fillText(`00:00:${pad(Math.floor(fr / FPS))}:${pad(fr % FPS)}`, W - 76, 60);
  const b = Math.floor(t / BEAT) % 4;
  for (let k = 0; k < 4; k++) {
    const x = W - 76 - (3 - k) * 22 - 12;
    k === b ? ctx.fillRect(x, H - 66, 12, 12) : ctx.strokeRect(x + 1, H - 65, 10, 10);
  }
  ctx.fillText('128 BPM', W - 76 - 4 * 22 - 14, H - 60);
  // Progress hairline.
  ctx.fillRect(76, 84, (W - 152) * (t / DUR), 1);
  ctx.restore();
}

// ─── Post ──────────────────────────────────────────────────────────────────
const GRAIN = [];
function initGrain() {
  const r = rng(99);
  for (let g = 0; g < 8; g++) {
    const c = mk(640, 360), x = c.getContext('2d');
    const img = x.createImageData(640, 360);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (r() - .5) * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    GRAIN.push(c);
  }
}
let VIGNETTE = null;
function initVignette() {
  VIGNETTE = mk();
  const x = VIGNETTE.getContext('2d');
  const g = x.createRadialGradient(CX, CY, H * .45, CX, CY, H * 1.15);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.34)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
}

function drawScene(ctx, t) {
  const si = Math.min(7, Math.max(0, Math.floor(t / BAR)));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.letterSpacing = '0px';
  const sh = shakeAmt(t);
  if (sh > 0.05) {
    ctx.translate((noise3(t * 30, 0, 1) - .5) * 2 * sh, (noise3(0, t * 30, 2) - .5) * 2 * sh);
  }
  SCENES[si][1](ctx, t - si * BAR, t);
}

function post(ctx, src, t, f) {
  const ca = aberration(t);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  if (ca > 0.4) {
    // Split RGB, then recombine with radial offsets.
    const cols = ['#ff0000', '#00ff00', '#0000ff'];
    for (let c = 0; c < 3; c++) {
      const x = chx[c];
      x.globalCompositeOperation = 'source-over';
      x.drawImage(src, 0, 0);
      x.globalCompositeOperation = 'multiply';
      x.fillStyle = cols[c]; x.fillRect(0, 0, W, H);
    }
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    [1 + ca / 450, 1 + ca / 900, 1].forEach((s, c) => {
      ctx.setTransform(s, 0, 0, s, CX * (1 - s), CY * (1 - s));
      ctx.drawImage(chan[c], 0, 0);
    });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  } else ctx.drawImage(src, 0, 0);

  ctx.drawImage(VIGNETTE, 0, 0);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.075;
  const g = GRAIN[f % GRAIN.length];
  ctx.drawImage(g, 0, 0, W, H);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  hud(ctx, t, f);
}

// Render frame f with SUB sub-samples averaged (true temporal motion blur).
function renderFrame(f, sub = SUB) {
  const t = f / FPS;
  if (sub <= 1) {
    drawScene(sctx, clamp(t, 0, DUR - 1e-4));
    post(octx, sceneC, t, f);
    return;
  }
  for (let s = 0; s < sub; s++) {
    const ts = clamp((f + ((s + .5) / sub - .5) * SHUTTER) / FPS, 0, DUR - 1e-4);
    drawScene(sctx, ts);
    actx.setTransform(1, 0, 0, 1, 0, 0);
    actx.globalCompositeOperation = 'source-over';
    actx.globalAlpha = 1 / (s + 1);
    actx.drawImage(sceneC, 0, 0);
  }
  actx.globalAlpha = 1;
  post(octx, accC, t, f);
}

// ─── Boot ──────────────────────────────────────────────────────────────────
async function init() {
  await Promise.all([
    document.fonts.load(F.disp(100)), document.fonts.load(F.light(100)),
    document.fonts.load(F.mono(20)), document.fonts.load(F.serif(40)),
  ]);
  initType(); initShapes(); initParticles(); initCloud(); initLock(); initGrain(); initVignette();
}

window.REEL = { FPS, DUR, FRAMES, renderFrame, ready: init() };

if (new URLSearchParams(location.search).has('render')) {
  document.body.classList.add('render');
} else {
  window.REEL.ready.then(() => {
    renderFrame(0, 1);
    const audio = new Audio('soundtrack.wav');
    let playing = false, t0 = 0, offset = 0;
    const now = () => playing ? (audio.readyState > 1 && !audio.paused ? audio.currentTime : offset + (performance.now() - t0) / 1000) : offset;
    const loop = () => {
      let t = now();
      if (t >= DUR) { offset = 0; audio.currentTime = 0; t0 = performance.now(); t = 0; }
      renderFrame(Math.floor(t * FPS), 2);
      requestAnimationFrame(loop);
    };
    const toggle = () => {
      if (playing) { offset = now(); audio.pause(); playing = false; }
      else { audio.currentTime = offset; audio.play().catch(() => {}); t0 = performance.now(); playing = true; document.body.classList.add('playing'); }
    };
    document.getElementById('play').onclick = toggle;
    out.onclick = toggle;
    addEventListener('keydown', e => {
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        offset = clamp(now() + (e.code === 'ArrowLeft' ? -BAR : BAR), 0, DUR - 0.01);
        audio.currentTime = offset; t0 = performance.now();
      }
    });
    requestAnimationFrame(loop);
  });
}
})();
