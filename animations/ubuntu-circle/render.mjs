// Frame-exact renderer for the Ubuntu Circle cards: steps render(t) in headless
// Chromium and pipes PNG frames into ffmpeg.
//
//   node render.mjs --days 2-30                 → out/ubuntu-circle-day-NN.mp4
//   node render.mjs --days 5,17 --stills 899    → out/stills/day-NN-frame-XXXX.png
//
// Env: FFMPEG (path to ffmpeg).
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { spawn, execSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(execSync('npm root -g').toString().trim() + '/playwright')); }

const ROOT = dirname(fileURLToPath(import.meta.url));
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const args = process.argv.slice(2);
const arg = k => args.includes(k) ? args[args.indexOf(k) + 1] : null;
const range = s => s.split(',').flatMap(p => { const [a, b] = p.split('-').map(Number); return b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a]; });
const days = range(arg('--days') || '2-30');
const stills = arg('--stills') ? range(arg('--stills')) : null;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.ttf': 'font/ttf' };
const server = createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(await readFile(p));
  } catch { res.writeHead(404); res.end(); }
}).listen(0);

const browser = await chromium.launch({ args: ['--disable-gpu', '--font-render-hinting=none'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
page.on('pageerror', e => { console.error('page error:', e); process.exitCode = 1; });
const grab = async f => {
  await page.evaluate(f => window.CARD.render(f), f);
  return page.locator('#c').screenshot({ type: 'png' });
};
const pad = (n, l = 2) => String(n).padStart(l, '0');

await mkdir(join(ROOT, stills ? 'out/stills' : 'out'), { recursive: true });
for (const day of days) {
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html?render&day=${day}`);
  const FRAMES = await page.evaluate(async () => { await window.CARD.ready; return window.CARD.FRAMES; });
  if (stills) {
    for (const f of stills) await writeFile(join(ROOT, `out/stills/day-${pad(day)}-frame-${pad(f, 4)}.png`), await grab(f));
    continue;
  }
  const outFile = join(ROOT, `out/ubuntu-circle-day-${pad(day)}.mp4`);
  const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '60', '-c:v', 'png', '-i', '-',
    // A silent stereo track (Rebone, 1 Oct) so social platforms accept the file.
    '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-map', '0:v', '-map', '1:a',
    '-c:a', 'aac', '-b:a', '128k', '-shortest',
    // Convert RGB→YUV with the BT.709 matrix the file is tagged with, or players shift the greens.
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-tune', 'stillimage',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', outFile],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = 0; f < FRAMES; f++) {
    if (!ff.stdin.write(await grab(f))) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('wrote', outFile);
}
await browser.close();
server.close();
