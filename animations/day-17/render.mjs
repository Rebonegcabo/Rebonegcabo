// Frame-exact renderer for the Day 17 card: steps render(t) in headless
// Chromium and pipes PNG frames into ffmpeg.
//
//   node render.mjs                        → out/ubuntu-circle-day-17.mp4
//   node render.mjs --stills 0,300,899     → out/stills/frame-XXXX.png
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
const stills = args.includes('--stills') ? args[args.indexOf('--stills') + 1].split(',').map(Number) : null;

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
page.on('pageerror', e => console.error('page error:', e));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?render`);
const FRAMES = await page.evaluate(async () => { await window.CARD.ready; return window.CARD.FRAMES; });
const grab = async f => {
  await page.evaluate(f => window.CARD.render(f), f);
  return page.locator('#c').screenshot({ type: 'png' });
};

if (stills) {
  await mkdir(join(ROOT, 'out/stills'), { recursive: true });
  for (const f of stills) await writeFile(join(ROOT, `out/stills/frame-${String(f).padStart(4, '0')}.png`), await grab(f));
} else {
  await mkdir(join(ROOT, 'out'), { recursive: true });
  const outFile = join(ROOT, 'out/ubuntu-circle-day-17.mp4');
  const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '60', '-c:v', 'png', '-i', '-',
    // Convert RGB→YUV with the BT.709 matrix the file is tagged with, or players shift the greens.
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-tune', 'stillimage',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', outFile],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = 0; f < FRAMES; f++) {
    if (!ff.stdin.write(await grab(f))) await new Promise(r => ff.stdin.once('drain', r));
    if ((f + 1) % 180 === 0) console.log(`${f + 1}/${FRAMES}`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('wrote', outFile);
}
await browser.close();
server.close();
