// Copyright (c) 2026 LFC Foundry. MIT License.
// First release vs current, whole app, in one test browser: for each size the two builds take turns (old, new, old, new ...), each in a fresh page. Per run: time to a finished map, drawing speed (FPS, panning), and in Chromium the exact heap (after a forced collection) just after the build and after 6 s idle.
// Run:  node bench/then-and-now/app-probe.js chromium|firefox|webkit|epiphany 10000[,30000] [turns]   NFM_OLD=/path/first-release/index.html (git show 48df84a:index.html)   NFM_NEW=index.html
// Firefox: xvfb-run -a with NFM_HEADFUL=1. Line 1 prints the browser version.
const path = require('path'), which = process.argv[2] || 'chromium', HOME = process.env.HOME || '/root';
const OLD = path.resolve(process.env.NFM_OLD || '/tmp/first-index.html'), NEW = path.resolve(process.env.NFM_NEW || path.resolve(__dirname, '..', '..', 'index.html'));
const SIZES = (process.argv[3] || '10000').split(',').map(Number), TURNS = Number(process.argv[4]) || 2;
const URL = (f) => 'file://' + f + '?tunesizes=1500';
async function open() {
  if (which === 'webkit' || which === 'epiphany') { const b = await require('../webkit-driver.js').launch({ browser: which === 'epiphany' ? 'epiphany' : 'webkitgtk', width: 1100, height: 720 }); return { page: b.page, close: () => b.close(), version: b.version, wait: (fn, arg, ms) => b.page.waitForFunction(fn, arg, { timeout: ms }) }; }
  if (which === 'firefox') { const pp = require(process.env.NFM_PUPPETEER || '/tmp/pptr/node_modules/puppeteer-core'); const b = await pp.launch({ browser: 'firefox', executablePath: process.env.NFM_FIREFOX || HOME + '/browsers/firefox/firefox', headless: !process.env.NFM_HEADFUL, protocol: 'webDriverBiDi', env: Object.assign({}, process.env, { LIBGL_ALWAYS_SOFTWARE: '1' }), extraPrefsFirefox: { 'webgl.force-enabled': true } }); const page = await b.newPage(); await page.setViewport({ width: 1100, height: 720 }); return { page, close: () => b.close(), version: 'firefox ' + await b.version(), wait: (fn, arg, ms) => page.waitForFunction(fn, { timeout: ms }, arg) }; }
  const pw = require(process.env.NFM_PLAYWRIGHT || 'playwright-core'); const b = await pw.chromium.launch({ executablePath: process.env.NFM_CHROME || HOME + '/browsers/ungoogled-chromium-155.0.8059.39-1-x86_64_linux/chrome', headless: true, args: ['--js-flags=--expose-gc', '--enable-precise-memory-info', '--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await b.newContext({ viewport: { width: 1100, height: 720 } })).newPage(); return { page, close: () => b.close(), version: 'chromium ' + b.version(), wait: (fn, arg, ms) => page.waitForFunction(fn, arg, { timeout: ms }) };
}
async function run(which_, file, N, bro) {
  const B = bro, page = B.page; await page.goto(URL(file)); await B.wait(() => window.NFM && NFM.client() && NFM.client().mode !== 'starting', null, 30000);
  const t0 = Date.now();
  await page.evaluate((n) => { if (NFM.setV) NFM.setV({ view: 'network' }); else NFM.state.opts.view = 'network'; NFM.setGraph(NFMExamples.bigNetwork(n, 12, 7)); NFM.showTab('map'); }, N);
  await B.wait((n) => NFM.state.L && NFM.state.scene && NFM.state.scene.nodes.length > n * 0.9 && NFM.state.L.nodes.length > n * 0.98, N, 300000); const buildMs = Date.now() - t0;
  const heap = async () => { if (which !== 'chromium') return null; for (let i = 0; i < 6; i++) { await page.evaluate(() => { gc(); }); await new Promise((r) => setTimeout(r, 150)); } return await page.evaluate(() => performance.memory.usedJSHeapSize / 1048576); };
  await new Promise((r) => setTimeout(r, 1500)); const h1 = await heap();
  const fps = await page.evaluate(async () => {   /* pan the map across the screen for 3 s, drawing with the app's own drawing code each frame */
    const m = NFM.manager(), S = NFM.state, sc = S.scene, v0 = S.view; if (!m || !m.r || !sc) return null; if (!m.canary) m.canary = {}; m.canary.webgl2 = { ok: true }; try { await m.use('webgl2'); } catch (e) { /* stay on the default */ } await new Promise((r) => setTimeout(r, 300)); let n = 0; const t0 = performance.now(); const be = m.r.name || '';
    await new Promise((res) => { function f(t) { if (t - t0 > 3000) return res(); n++; const a = (t - t0) / 3000; try { m.r.draw({ k: v0.k, tx: v0.tx + Math.sin(a * 6.28) * 120, ty: v0.ty + Math.cos(a * 6.28) * 80, invalidate: function () {} }); } catch (e) {} requestAnimationFrame(f); } requestAnimationFrame(f); });
    return { fps: n / ((performance.now() - t0) / 1000), be: String(be) };
  });
  await new Promise((r) => setTimeout(r, 6000)); const h2 = await heap();
  return { buildMs, h1, h2, fps: fps && fps.fps, be: fps && fps.be };
}
(async () => {
  const out = {}; let ver = '';
  for (const N of SIZES) for (let t = 0; t < TURNS; t++) for (const [name, file] of [['first', OLD], ['current', NEW]]) {
    const B = await open(); if (!ver) { ver = B.version; console.log('browser', which, ver); }
    try { const r = await run(which, file, N, B); console.log(N, name, JSON.stringify(r)); ((out[N] = out[N] || {})[name] = out[N][name] || []).push(r); } catch (e) { console.log(N, name, 'FAILED', e.message.slice(0, 160)); }
    await B.close(); await new Promise((r) => setTimeout(r, which === 'epiphany' || which === 'webkit' ? 4000 : 500));
  }
  const med = (a) => a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : null, f = (x, d) => x === null || x === undefined ? 'n/a' : x.toFixed(d);
  for (const N of SIZES) for (const name of ['first', 'current']) { const R = (out[N] || {})[name] || []; console.log('SUMMARY', which, N, name, 'build s', f(med(R.map((r) => r.buildMs / 1000)), 2), 'FPS', f(med(R.map((r) => r.fps)), 1), 'heap MB built', f(med(R.map((r) => r.h1).filter((x) => x != null)), 0), 'idle 6s', f(med(R.map((r) => r.h2).filter((x) => x != null)), 0), 'draw', R[0] && R[0].be); }
})();
