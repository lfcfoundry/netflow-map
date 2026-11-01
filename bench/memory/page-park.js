// Copyright (c) 2026 LFC Foundry. MIT License.
// Idle memory with and without the idle layout park, in ungoogled-chromium (exact page heap after a forced collection), two builds taking turns.
// Run:  NFM_PLAYWRIGHT=<path to playwright-core> NFM_BEFORE=<older index.html> node bench/memory/page-park.js 30000 [turns]
const path = require('path'), pw = require(process.env.NFM_PLAYWRIGHT || 'playwright-core');
const N = Number(process.argv[2]) || 30000, TURNS = Number(process.argv[3]) || 1, HOME = process.env.HOME || '/root';
const BEFORE = path.resolve(process.env.NFM_BEFORE), AFTER = path.resolve(process.env.NFM_AFTER || path.resolve(__dirname, '..', '..', 'index.html'));
const CH = process.env.NFM_CHROME || HOME + '/browsers/ungoogled-chromium-155.0.8059.39-1-x86_64_linux/chrome';
(async () => {
  const out = { before: [], after: [] };
  for (let t = 0; t < TURNS; t++) for (const [name, file] of [['before', BEFORE], ['after', AFTER]]) {
    const b = await pw.chromium.launch({ executablePath: CH, headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--js-flags=--expose-gc', '--enable-precise-memory-info'] });
    if (!t && name === 'before') console.log('browser chromium', b.version(), ', items', N);
    const page = await (await b.newContext({ viewport: { width: 1100, height: 720 } })).newPage();
    const heap = async () => { for (let i = 0; i < 6; i++) { await page.evaluate(() => { gc(); }); await new Promise((r) => setTimeout(r, 150)); } return await page.evaluate(() => performance.memory.usedJSHeapSize / 1048576); };
    await page.goto('file://' + file + '?tunesizes=1500'); await page.waitForFunction(() => window.NFM && NFM.client() && NFM.client().mode !== 'starting', null, { timeout: 30000 });
    await page.evaluate((n) => { NFM.setV({ view: 'network', arrange: 'force' }); NFM.setGraph(NFMExamples.bigNetwork(n, 12, 7)); NFM.showTab('map'); }, N);
    await page.waitForFunction((n) => NFM.state.L && NFM.state.sceneOk && NFM.state.L.nodes.length > n * 0.98, N, { timeout: 280000 });
    const built = await heap(); await new Promise((r) => setTimeout(r, 9000));
    const parked = await page.evaluate(() => { const L = NFM.state.L; return L.parked ? L.parked() : null; });
    const idle = await heap();
    const wake = await page.evaluate(() => { const L = NFM.state.L, t = performance.now(); const n = L.edges.length; return { ms: performance.now() - t, n, parked: L.parked ? L.parked() : null }; });
    out[name].push({ built, idle, parked, wakeMs: wake.ms });
    console.log(name, JSON.stringify({ built: +built.toFixed(1), idle: +idle.toFixed(1), parked, wakeMs: +wake.ms.toFixed(0), edges: wake.n }));
    await b.close();
  }
  const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
  console.log('median idle heap MB (lower is better): before', med(out.before.map((r) => r.idle)).toFixed(1), 'after', med(out.after.map((r) => r.idle)).toFixed(1));
})();
