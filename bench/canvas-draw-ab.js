/* Copyright (c) 2026 LFC Foundry. MIT License. Canvas 2D draw of a big flat map, packed links read through the view (newer) against the same links woken first (what the older page did), taking turns inside ONE page; each draw ends with a pixel read so the painting is finished before the clock stops.
 *   node bench/canvas-draw-ab.js chromium|firefox|webkit|epiphany [rounds] [items]
 * Prints the median milliseconds of each way (lower is better) and the newer-over-older ratio. */
'use strict';
(async () => {
  const which = process.argv[2] || 'chromium', rounds = +(process.argv[3] || 9), items = +(process.argv[4] || 30000);
  const D = await require('./driver.js').open(which, { timeout: 3600000 });
  const wait = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await D.page.evaluate(fn)) return; await new Promise((r) => setTimeout(r, 200)); } throw new Error('timed out waiting'); };
  await D.goto('file://' + require('path').join(__dirname, '..', 'index.html')); await wait(() => typeof NFM !== 'undefined', 60000);
  await D.page.evaluate((n) => { NFM.setGraph(NFMExamples.bigNetwork(n, 4, 7)); NFM.showTab('map'); NFM.setV({ view: 'network', arrange: 'circle' }); }, items);
  await wait(() => !NFM.pending() && !!NFM.state.scene && typeof NFM.state.scene.packNow === 'function', 600000);
  const r = await D.page.evaluate(async (rounds) => {
    const frame = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))), m = NFM.manager();
    if (m.r.name !== 'canvas2d') { m.canary.canvas2d = { ok: true }; await m.use('canvas2d'); }
    await frame(); const sc = NFM.state.scene, view = NFM.state.view, cv = document.querySelector('canvas'), cx = cv && cv.getContext && cv.getContext('2d');
    const sync = () => { try { if (cx) cx.getImageData(0, 0, 1, 1); } catch (e) {} };
    const run = (wake) => { if (!sc.packNow()) throw new Error('not packed'); const t = performance.now(); if (wake) void sc.curves.length; m.r.draw(view); sync(); return performance.now() - t; };
    run(false); run(true); const nw = [], ol = [];
    for (let i = 0; i < rounds; i++) { if (i % 2) { ol.push(run(true)); nw.push(run(false)); } else { nw.push(run(false)); ol.push(run(true)); } }
    return { nw, ol, links: NFM.state.L.edges.length, synced: !!cx };
  }, rounds);
  const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1], v = D.version; await D.close();
  console.log(v + ', ' + r.links.toLocaleString() + ' links, ' + rounds + ' turns, median ms (lower is better): older way ' + med(r.ol).toFixed(0) + ', newer way ' + med(r.nw).toFixed(0) + ', newer/older ' + (med(r.nw) / med(r.ol)).toFixed(2) + (r.synced ? '' : ' (no pixel read)'));
})();
