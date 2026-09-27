// Offline, frame-exact renderer: steps the reel through every frame in headless
// Chromium and pipes PNGs into ffmpeg, then muxes the soundtrack.
//
//   node render.mjs                      → out/motion-study-01.mp4
//   node render.mjs --stills 30,120,400  → out/stills/frame-XXXX.png only
//
// Env: FFMPEG (path to ffmpeg), WORKERS (parallel pages, default 4).
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
const WORKERS = +(process.env.WORKERS || 4);
const args = process.argv.slice(2);
const stillsArg = args.includes('--stills') ? args[args.indexOf('--stills') + 1] : null;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.ttf': 'font/ttf', '.wav': 'audio/wav' };
const server = createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(await readFile(p));
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const url = `http://127.0.0.1:${server.address().port}/index.html?render`;

const browser = await chromium.launch({ args: ['--disable-gpu', '--disable-gpu-compositing'] });
async function newPage() {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('page error:', e));
  await page.goto(url);
  await page.evaluate(() => window.REEL.ready);
  return page;
}
const grab = async (page, f) => {
  await page.evaluate(f => window.REEL.renderFrame(f), f);
  return page.locator('#c').screenshot({ type: 'png' });
};

const FRAMES = 900;
if (stillsArg) {
  const page = await newPage();
  await mkdir(join(ROOT, 'out/stills'), { recursive: true });
  for (const f of stillsArg.split(',').map(Number)) {
    await writeFile(join(ROOT, `out/stills/frame-${String(f).padStart(4, '0')}.png`), await grab(page, f));
    console.log('still', f);
  }
} else {
  await mkdir(join(ROOT, 'out'), { recursive: true });
  const outFile = join(ROOT, 'out/motion-study-01.mp4');
  const ff = spawn(FFMPEG, [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', '60', '-c:v', 'png', '-i', '-',
    '-i', join(ROOT, 'soundtrack.wav'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart',
    outFile,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });

  const pages = await Promise.all(Array.from({ length: WORKERS }, newPage));
  const done = new Map();
  let next = 0, written = 0;
  const started = Date.now();
  const flush = async () => {
    while (done.has(written)) {
      const buf = done.get(written); done.delete(written);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      written++;
      if (written % 60 === 0) console.log(`${written}/${FRAMES}  ${((Date.now() - started) / 1000).toFixed(0)}s`);
    }
  };
  let flushing = Promise.resolve();
  await Promise.all(pages.map(async page => {
    while (next < FRAMES) {
      const f = next++;
      done.set(f, await grab(page, f));
      flushing = flushing.then(flush);
      // Back-pressure: don't let workers run too far ahead of the writer.
      while (next - written > WORKERS * 6) await new Promise(r => setTimeout(r, 5));
    }
  }));
  await flushing;
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('wrote', outFile);
}
await browser.close();
server.close();
