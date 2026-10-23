/* Copyright (c) 2026 LFC Foundry. MIT License. The app's own Force arrangement of a 3,000-item map, done by the processor and then by the graphics card (the client's card path), in one Chromium page.
 * Checks the card path end to end: it is taken, the picture has the same kind of shape (link lengths), and it falls back by itself when the card is too slow for it. A software card is allowed here, so the speed means nothing; the speed is in the Force lab. */
'use strict';
const { chromium } = require(process.env.NFM_PLAYWRIGHT || 'playwright-core');
const GEN = require('./gen.js'), C = require('../src/columns.js');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.NFM_CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--enable-unsafe-webgpu'] });
  const p = await b.newPage(); p.on('pageerror', e => console.log('pageerror', e.message));
  await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForFunction(() => window.NFM && window.NFM.client && window.NFM.client(), null, { timeout: 60000 });
  const g0 = C.derive(JSON.parse(JSON.stringify(GEN.graph('moderate', 3000, 11))));
  const out = await p.evaluate(async (g) => {
    const c = window.NFM.client();
    NFMGpuStress.settings.allowSoftware = true; c.setGraph(g); c.store = null; c.forceMin = 2000;
    const len = L => { const pos = L.pos; let s = 0, n = 0; L.edges.forEach(e => { const a = pos[e.from], d = pos[e.to]; if (a && d) { s += Math.hypot(a.x - d.x, a.y - d.y); n++; } }); return s / n; };
    const run = async (cost) => { c.forceCost = cost; c.forceOff = false; const t = performance.now(), r = await c.build({ view: 'network', arrange: 'force' }); return { ms: Math.round(performance.now() - t), used: !!r.cardForce, why: c.forceWhy, meanLink: len(r.L), w: Math.round(r.L.width), h: Math.round(r.L.height) }; };
    c.forceMin = 1e9; const plain = await run(0.004); c.forceMin = 2000;
    const card = await run(1e6), gated = await run(1e-9);
    return { plain, card, gated, adapter: (await c.cardProbe()).info };
  }, g0);
  console.log(JSON.stringify(out, null, 1)); await b.close();
})();
