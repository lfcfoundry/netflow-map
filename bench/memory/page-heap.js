// Copyright (c) 2026 LFC Foundry. MIT License.
// Netflow Map in ungoogled-chromium: the page's real JavaScript heap (after a forced collection) at each step, with the card (WebGL 2) on.
// Run:  HOME=/home/claude NFM_PLAYWRIGHT=/tmp/pw/node_modules/playwright-core node bench/memory/page-heap.js 100000
// Line 1 prints the browser version. Chromium gives exact heap numbers and a forced collection; Firefox gives neither, so Firefox is measured by bench/memory/page-rss.js.
const path = require('path'), pw = require(process.env.NFM_PLAYWRIGHT || 'playwright-core');
const N = Number(process.argv[2]) || 30000, URL = 'file://' + path.resolve(process.env.NFM_PAGE || path.resolve(__dirname, '..', '..', 'index.html')) + '?tunesizes=1500';
const CH = process.env.NFM_CHROME || (process.env.HOME || '/root') + '/browsers/ungoogled-chromium-155.0.8059.39-1-x86_64_linux/chrome';
(async () => {
  const b = await pw.chromium.launch({ executablePath: CH, headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--js-flags=--expose-gc', '--enable-precise-memory-info'] });
  console.log('browser chromium', b.version(), ', items', N);
  const page = await (await b.newContext({ viewport: { width: 1100, height: 720 } })).newPage(), rows = [];
  const heap = async (name, ms) => { for (let i = 0; i < 6; i++) { await page.evaluate(() => { gc(); }); await new Promise((r) => setTimeout(r, 150)); }   /* several passes: Chromium needs more than two to free everything a picture left behind */ const h = await page.evaluate(() => performance.memory.usedJSHeapSize / 1048576); rows.push(name.padEnd(48) + String(Math.round(h)).padStart(6) + ' MB' + (ms === undefined ? '' : '   ' + (ms / 1000).toFixed(1) + ' s')); return h; };
  await page.goto(URL); await page.waitForFunction(() => window.NFM && NFM.client() && NFM.client().mode !== 'starting', null, { timeout: 20000 }); await heap('page loaded');
  const be = await page.evaluate(async () => { NFM.setGraph(NFMExamples.bigNetwork(50, 3, 7)); NFM.showTab('map'); for (let i = 0; i < 100 && !NFM.manager(); i++) await new Promise((r) => setTimeout(r, 50)); const m = NFM.manager(); if (!m.canary) m.canary = {}; m.canary.webgl2 = { ok: true }; try { await m.use('webgl2'); } catch (e) { /* default */ } return m.r.name; });
  console.log('drawing with', be);
  const t0 = Date.now();
  await page.evaluate((n) => { NFM.setGraph(NFMExamples.bigNetwork(n, 12, 7)); NFM.setV({ view: 'network', arrange: 'sphere' }); }, N);
  await page.waitForFunction((n) => NFM.state.L && NFM.state.sceneOk && NFM.state.L.nodes.length > n * 0.98, N, { timeout: 240000 }); const tDone = Date.now() - t0;
  await new Promise((r) => setTimeout(r, 1500)); let shown = await heap('3D network shown (page heap only; the worker has its own)', tDone);
  await page.evaluate(() => { NFM.setV({ colorBy: 'group' }); }); await page.waitForFunction(() => NFM.state.sceneOk && !NFM.state.mapBusy, null, { timeout: 240000 }); await new Promise((r) => setTimeout(r, 1500)); shown = await heap('set-up: switched to plain groups (a full rebuild)');   /* the network starts on found groups, which the engine uses; the measured change below is then a look-only one */
  await page.evaluate(() => { window.__calls = { make: 0 }; const mk = NFMScene.make; NFMScene.make = function () { __calls.make++; return mk.apply(this, arguments); }; });
  // peak: sample the heap every 20 ms while the second picture is made (the page is busy, so samples land between its tasks; the top one is a floor for the true peak)
  await page.evaluate(() => { window.__peak = 0; window.__t = setInterval(() => { const h = performance.memory.usedJSHeapSize; if (h > __peak) __peak = h; }, 5); const o = NFMScene.make; NFMScene.make = function () { const r = o.apply(this, arguments); const h = performance.memory.usedJSHeapSize; if (h > __peak) __peak = h; return r; }; });
  const tc = Date.now(); await page.evaluate(() => { NFM.setV({ colorBy: 'size' }); }); await page.waitForFunction(() => __calls.make >= 1 && NFM.state.sceneOk && !NFM.state.mapBusy, null, { timeout: 120000 }).catch(() => {}); const tChange = Date.now() - tc; await new Promise((r) => setTimeout(r, 2000));   /* wait until the second picture has really been made */
  const peak = await page.evaluate(() => { clearInterval(__t); return __peak / 1048576; }); console.log('pictures made by the color change', JSON.stringify(await page.evaluate(() => __calls)));
  const after = await heap('after a second picture (color change), collected');
  rows.push('the color change took (until the new picture is up)'.padEnd(48) + '       ' + (tChange / 1000).toFixed(1) + ' s');
  rows.push('highest heap seen right after the second picture'.padEnd(48) + String(Math.round(peak)).padStart(6) + ' MB   (before: ' + Math.round(shown) + ' MB)');
  console.log('step'.padEnd(48) + ' page heap\n' + rows.join('\n')); await b.close();
})();
