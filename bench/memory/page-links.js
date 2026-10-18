// Copyright (c) 2026 LFC Foundry. MIT License.
// Netflow Map in ungoogled-chromium, the real app: page heap with a big network shown, with the idle link packing on (default) and off (NFM_NOPACK=1), and what the packing costs when something reads every link again.
// Run:  HOME=/home/claude NFM_PLAYWRIGHT=/tmp/pw/node_modules/playwright-core [NFM_NOPACK=1] node bench/memory/page-links.js 100000
// Line 1 prints the browser version. Exact heap is read after a forced collection (Chromium only; Firefox is measured by page-rss.js).
const path = require('path'), pw = require(process.env.NFM_PLAYWRIGHT || 'playwright-core');
const N = Number(process.argv[2]) || 30000, URL = 'file://' + path.resolve(process.env.NFM_PAGE || path.resolve(__dirname, '..', '..', 'index.html')) + '?tunesizes=1500';
const CH = process.env.NFM_CHROME || (process.env.HOME || '/root') + '/browsers/ungoogled-chromium-155.0.8059.39-1-x86_64_linux/chrome';
(async () => {
  const b = await pw.chromium.launch({ executablePath: CH, headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--js-flags=--expose-gc', '--enable-precise-memory-info'] });
  console.log('browser chromium', b.version(), ', items', N, ', link packing', process.env.NFM_NOPACK ? 'OFF' : 'on');
  const page = await (await b.newContext({ viewport: { width: 1100, height: 720 } })).newPage(), rows = [];
  const heap = async () => { for (let i = 0; i < 6; i++) { await page.evaluate(() => { gc(); }); await new Promise((r) => setTimeout(r, 150)); } return page.evaluate(() => performance.memory.usedJSHeapSize / 1048576); };
  await page.goto(URL); await page.waitForFunction(() => window.NFM && NFM.client() && NFM.client().mode !== 'starting', null, { timeout: 20000 });
  await page.evaluate(() => { NFM.client().parkAfter = 0; });
  if (process.env.NFM_NOPACK) await page.evaluate(() => { window.__np = setInterval(() => { const sc = NFM.state.scene; if (sc && sc.autoPack && !sc.__off) { sc.__off = 1; sc.autoPack({ delay: 4000, min: 1e12 }); } }, 20); });
  await page.evaluate((n) => { NFM.setGraph(NFMExamples.bigNetwork(n, 12, 7)); NFM.setV({ view: 'network', arrange: 'sphere' }); NFM.showTab('map'); }, N);
  await page.waitForFunction((n) => NFM.state.L && NFM.state.sceneOk && NFM.state.L.nodes.length > n * 0.98 && !NFM.state.mapBusy, N, { timeout: 240000 });
  const add = async (name, v) => rows.push([name, v]);
  await new Promise((r) => setTimeout(r, 1000)); await add('map shown, 1 s after (links still objects)', await heap());
  await page.waitForFunction(() => NFM.state.scene.curvesPacked() || window.__np, null, { timeout: 15000 }).catch(() => {}); await new Promise((r) => setTimeout(r, process.env.NFM_NOPACK ? 6000 : 500));
  const st = await page.evaluate(() => ({ packed: NFM.state.scene.curvesPacked(), n: NFM.state.scene.curveCount() }));
  await add('idle, ' + (st.packed ? 'links packed' : 'links as objects') + ' (' + st.n + ' links)', await heap());
  const pk = await page.evaluate(() => { const sc = NFM.state.scene, t0 = performance.now(); const m = NFM.manager(), r = NFMScene.pickEdge(sc, sc.x0 + sc.w / 2, sc.y0 + sc.h / 2, 8); const t1 = performance.now(), again = performance.now(); NFMScene.pickEdge(sc, sc.x0 + sc.w / 2 + 40, sc.y0 + sc.h / 2, 8); return { first: t1 - t0, next: performance.now() - again, stillPacked: sc.curvesPacked() }; });
  await add('after the first hover (edge index built), ' + (pk.stillPacked ? 'still packed' : 'objects'), await heap());
  const un = await page.evaluate(() => { const sc = NFM.state.scene, t0 = performance.now(); sc.curves.length; return { ms: performance.now() - t0, packed: sc.curvesPacked() }; });
  await add('after a read of all links (objects again)', await heap());
  console.log('first hover (builds the edge index) ' + pk.first.toFixed(0) + ' ms; next hover ' + pk.next.toFixed(1) + ' ms; links read all at once: ' + un.ms.toFixed(0) + ' ms (lower is better)');
  console.log('step'.padEnd(66) + ' page heap MB (lower is better)'); for (const [n, v] of rows) console.log(n.padEnd(66) + String(Math.round(v)).padStart(8));
  await b.close();
})();
