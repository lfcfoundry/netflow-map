// Copyright (c) 2026 LFC Foundry. MIT License. How much memory memory-compression holds in Chromium, stage by stage: page without it, module loaded, first small pack, a 100,000-item pack (layout links), after freeBuffers().
// Run:  node bench/compression-methods/make.mjs && node bench/compression-methods/footprint.js   (Chromium 155 from the browsers branch; JS heap is exact, the renderer's resident memory is read from /proc and shown as change from the first stage)
const fs = require('fs'), path = require('path'), HOME = process.env.HOME || '/root';
/* a copy of the module with three read-only windows added: the size of each WebAssembly memory and the bytes the buffer pool holds */
const MODULE = fs.readFileSync(path.resolve(__dirname, '../../vendor/memory-compression.js'), 'utf8')
  .replace('W.IN = base; W.OUT = base + b;', 'self.__lz4mem = function () { return W ? W.mem.length : 0; }; self.__dropLz4 = function () { W = null; wasmState = "idle"; wasmReadyPromise = null; }; W.IN = base; W.OUT = base + b;')
  .replace("KW = { x: inst.exports,", "self.__kwmem = function () { return KW ? KW.mem.buffer.byteLength : 0; }; self.__dropKw = function () { KW = null; KW_STATE = 0; }; KW = { x: inst.exports,")
  .replace('var POOL = [], POOL_BYTES = 0,', 'self.__pool = function () { return POOL_BYTES; }; var POOL = [], POOL_BYTES = 0,');
if ((MODULE.match(/__lz4mem|__kwmem|__pool/g) || []).length !== 3 || !/__dropLz4/.test(MODULE) || !/__dropKw/.test(MODULE)) throw new Error('module windows not added');
(async () => {
  const pw = require(process.env.NFM_PLAYWRIGHT || 'playwright-core');
  const b = await pw.chromium.launch({ executablePath: process.env.NFM_CHROME || HOME + '/browsers/ungoogled-chromium-155.0.8059.39-1-x86_64_linux/chrome', headless: true, args: ['--no-sandbox', '--js-flags=--expose-gc', '--enable-precise-memory-info', '--renderer-process-limit=1', '--disable-features=SpareRendererForSitePerProcess,SpareRenderer'] });
  console.log('browser chromium', b.version());
  const page = await (await b.newContext()).newPage(), cdp = await page.context().newCDPSession(page);
  await page.goto('about:blank'); await page.setContent('<!doctype html><title>t</title><pre id=o></pre>');
  const info = await cdp.send('SystemInfo.getProcessInfo').catch(() => null);
  /* the page's renderer is the one process that grows when the page does: read every renderer's resident memory and keep the pid that moves most between the first and the last stage */
  const procs = () => { const m = {}; require('child_process').execSync('ps -eo pid,rss,args | grep "type=renderer" | grep -v grep').toString().split('\n').filter(Boolean).forEach((l) => { const x = l.trim().split(/\s+/); m[x[0]] = +x[1] * 1024; }); return m; };
  const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage'); const h = await cdp.send('Runtime.getHeapUsage'); return h.usedSize; };
  const rows = [], mb = (n) => (n / 1048576).toFixed(2);
  const stage = async (name) => { await new Promise((r) => setTimeout(r, 400)); const h = await heap(), w = await page.evaluate(() => ({ lz4: self.__lz4mem ? self.__lz4mem() : 0, kw: self.__kwmem ? self.__kwmem() : 0, pool: self.__pool ? self.__pool() : 0 })); rows.push({ name, heap: h, procs: procs(), w }); };
  await stage('page without the module');
  await page.addScriptTag({ content: 'self.__nothing = 1;' }); await stage('after adding a script that does nothing');
  await page.addScriptTag({ content: 'self.MEMORY_COMPRESSION_NO_EVAL = true;\n' + MODULE }); await stage('module loaded, never used');
  await page.evaluate(() => { const MC = self.MemoryCompression; MC.pack([{ a: 1, b: 'x' }, { a: 2, b: 'y' }]); return MC.accelerated; }); await stage('after one tiny pack');
  await page.evaluate(() => { const MC = self.MemoryCompression, a = []; let s = 7; const r = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; for (let i = 0; i < 250000; i++) a.push({ from: 'p' + Math.floor(r() * 100000), to: 'p' + Math.floor(r() * 100000), w: Math.round(r() * 1000) / 10, c: [133, 144, 168, 96], i }); self.__src = a; self.__p = []; for (let o = 0; o < a.length; o += 25000) self.__p.push(MC.pack(a.slice(o, o + 25000), { mode: 'fast' })); self.__src = null;  }, +process.env.CHUNK || 0); await stage('after packing 250,000 links in slices of 25,000 (packed copy kept)');
  await page.evaluate(() => { self.MemoryCompression.freeBuffers(); }); await stage('after freeBuffers()');
  await page.evaluate(() => { self.__p = null; }); await stage('after dropping the packed copy');
  await page.evaluate(() => { self.__dropLz4(); self.__dropKw(); }); await stage('after letting go of both wasm instances (experiment)');
  const first = rows[0].procs, last = rows[rows.length - 2].procs, pid = Object.keys(last).sort((a, c) => ((last[c] - (first[c] || 0)) - (last[a] - (first[a] || 0))))[0];
  rows.forEach((x) => { x.rss = x.procs[pid] || 0; });
  console.log('| stage | JS heap MB | wasm memory, LZ4 MB | wasm memory, helper MB | buffer pool MB | renderer resident change MB |\n|---|---|---|---|---|---|');
  rows.forEach((x, i) => console.log('| ' + x.name + ' | ' + mb(x.heap) + ' | ' + mb(x.w.lz4) + ' | ' + mb(x.w.kw) + ' | ' + mb(x.w.pool) + ' | ' + (i ? (x.rss - rows[0].rss > 0 ? '+' : '') + mb(x.rss - rows[0].rss) : '-') + ' |'));
  console.log('Lower is better in every column. Resident memory counts wasm memory and buffers outside the JS heap; changes are against the first row.');
  await b.close();
})();
