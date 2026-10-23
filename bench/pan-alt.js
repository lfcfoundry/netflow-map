/* Copyright (c) 2026 LFC Foundry. MIT License. Panning and zooming a big map with Canvas 2D drawing, an older page against a newer one, each in a FRESH page, taking turns. A scripted camera (one step per animation frame for 2 s) pans or zooms; FPS = frames / seconds (higher is better), "p95" = the 95th-percentile gap between frames in ms (lower is better). Canvas 2D is forced (the fallback path); the engine, scene and labels are the app's own.
 *   node bench/pan-alt.js chromium|firefox|webkit|epiphany [pairs] [old.html] [new.html] [cases: view:items,...]
 * Cases look like sankey:1500,flow:1500,network:5000 (bigNetwork(N, 6, 7)). */
'use strict';
const fs = require('fs'), path = require('path');
(async () => {
  const which = process.argv[2] || 'chromium', pairs = +(process.argv[3] || 3), root = path.join(__dirname, '..');
  const oldP = path.resolve(process.argv[4] || '/tmp/index-main.html'), newP = path.resolve(process.argv[5] || path.join(root, 'index.html'));
  const cases = (process.argv[6] || 'sankey:1500,flow:1500,network:5000').split(',').map((c) => { const [v, n] = c.split(':'); return { v, n: +n }; });
  const D = await require('./driver.js').open(which, { timeout: 3600000 }), med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
  const wait = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await D.page.evaluate(fn)) return; await new Promise((r) => setTimeout(r, 200)); } throw new Error('timed out'); };
  const once = async (file, c) => {
    await D.goto('about:blank'); await D.goto('file://' + file); await wait(() => typeof NFM !== 'undefined', 60000);
    await D.page.evaluate((c) => { NFM.setGraph(NFMExamples.bigNetwork(c.n, 6, 7)); NFM.showTab('map'); NFM.setV(c.v === 'network' ? { view: c.v, arrange: 'stress' } : { view: c.v }); }, c);
    await wait(() => !NFM.pending() && !!NFM.state.scene, 600000);
    return D.page.evaluate(async () => {
      const sl = (ms) => new Promise((r) => setTimeout(r, ms)), m = NFM.manager(); await m.use('canvas2d'); NFM.fitView && NFM.fitView(); await sl(800);
      const S = NFM.state, W = S.stageW, H = S.stageH, SECS = 2;
      const run = (mode) => new Promise((res) => { const gaps = []; let last = 0, tEnd = 0, n = 0; const step = (t) => { if (!tEnd) tEnd = t + SECS * 1000; if (last) gaps.push(t - last); last = t; n++;
        if (mode === 'zoom') NFM.zoomAt(W / 2, H / 2, n % 40 < 20 ? 1.03 : 1 / 1.03, true); else { const vw = S.view; NFM.state.view = { k: vw.k, tx: vw.tx + (n % 60 < 30 ? 7 : -7), ty: vw.ty + (n % 60 < 30 ? 3 : -3) }; NFM.zoomAt(W / 2, H / 2, 1, true); }
        if (t < tEnd) requestAnimationFrame(step); else { gaps.sort((a, b) => a - b); res({ fps: 1000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length), p95: gaps[Math.floor(gaps.length * .95)] }); } }; requestAnimationFrame(step); });
      const z = await run('zoom'); await sl(500); const p = await run('pan');
      return { z, p, renderer: m.r && m.r.name, nodes: S.L && S.L.nodes ? S.L.nodes.length : 0 };
    });
  };
  const out = [];
  for (const c of cases) {
    await once(oldP, c); await once(newP, c);
    const o = [], w = [];
    for (let r = 0; r < pairs; r++) { const order = r % 2 === 0 ? [oldP, newP] : [newP, oldP]; for (const f of order) { const x = await once(f, c); (f === oldP ? o : w).push(x); } }
    const g = (arr, a, b) => med(arr.map((x) => x[a][b]));
    out.push({ c, nodes: w[0].nodes, renderer: w[0].renderer, zoomFps: [g(o, 'z', 'fps'), g(w, 'z', 'fps')], panFps: [g(o, 'p', 'fps'), g(w, 'p', 'fps')], zoomP95: [g(o, 'z', 'p95'), g(w, 'z', 'p95')], panP95: [g(o, 'p', 'p95'), g(w, 'p', 'p95')] });
  }
  const version = D.version; await D.close();
  const f = (a, d) => a[0].toFixed(d) + ' to ' + a[1].toFixed(d);
  console.log('\n' + version + ' (median of ' + pairs + ' fresh pages per version, taking turns, Canvas 2D; FPS higher is better, p95 gap in ms lower is better)\n\n| map | zoom FPS old to new | pan FPS old to new | zoom p95 gap | pan p95 gap |\n|---|---|---|---|---|');
  out.forEach((r) => console.log(`| ${r.c.v} ${r.c.n} (${r.nodes} boxes, ${r.renderer}) | ${f(r.zoomFps, 1)} | ${f(r.panFps, 1)} | ${f(r.zoomP95, 0)} | ${f(r.panP95, 0)} |`));
  fs.writeFileSync(path.join(__dirname, 'results', 'pan-alt-' + which + '.json'), JSON.stringify({ version, pairs, out }, null, 1));
  process.exit(0);
})();
