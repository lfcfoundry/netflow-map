/* Copyright (c) 2026 LFC Foundry. MIT License. Canvas 2D drawing of a big flat map whose links are packed (the state after the page has sat idle), an older page against a newer page, each in a FRESH page, taking turns.
 *   node bench/canvas-packed-draw.js chromium|firefox|webkit|epiphany [pairs] [old.html] [new.html] [items]
 * Per page: the main-thread milliseconds of three draw() calls of the packed picture (their sum is the steady number), and whether the list stayed packed. Lower is better for the times. */
'use strict';
const fs = require('fs'), path = require('path');
(async () => {
  const which = process.argv[2] || 'chromium', pairs = +(process.argv[3] || 5), root = path.join(__dirname, '..');
  const oldP = path.resolve(process.argv[4] || '/tmp/old-main.html'), newP = path.resolve(process.argv[5] || path.join(root, 'index.html')), items = +(process.argv[6] || 30000);
  const D = await require('./driver.js').open(which, { timeout: 3600000 }), med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
  const wait = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await D.page.evaluate(fn)) return; await new Promise((r) => setTimeout(r, 200)); } throw new Error('timed out waiting'); };
  const once = async (file) => {
    await D.goto('about:blank'); await D.goto('file://' + file); await wait(() => typeof NFM !== 'undefined', 60000);
    await D.page.evaluate((n) => { NFM.setGraph(NFMExamples.bigNetwork(n, 4, 7)); NFM.showTab('map'); NFM.setV({ view: 'network', arrange: 'circle' }); }, items);
    await wait(() => !NFM.pending() && !!NFM.state.scene && typeof NFM.state.scene.packNow === 'function', 600000);
    return D.page.evaluate(async () => {
      const frame = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))), m = NFM.manager();
      if (m.r.name !== 'canvas2d') { m.canary.canvas2d = { ok: true }; await m.use('canvas2d'); }
      await frame(); const sc = NFM.state.scene; if (!sc.packNow()) return { err: 'not packed' };
      const view = NFM.state.view, time = () => { const t = performance.now(); m.r.draw(view); return performance.now() - t; };
      const a = time(), still = sc.curvesPacked(), b = time(), c = time();
      return { first: a, second: b, third: c, total: a + b + c, packedAfter: sc.curvesPacked(), packedBetween: still, links: NFM.state.L.edges.length, heap: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null };
    });
  };
  await once(oldP); await once(newP);
  const o = [], w = [];
  for (let r = 0; r < pairs; r++) { const order = r % 2 === 0 ? [oldP, newP] : [newP, oldP]; for (const f of order) { const x = await once(f); if (x.err) { console.log(x.err); await D.close(); process.exit(1); } (f === oldP ? o : w).push(x); } }
  const f = (k, arr) => med(arr.map((x) => x[k])), version = D.version; await D.close();
  console.log('Canvas 2D, ' + items.toLocaleString() + ' items (' + o[0].links.toLocaleString() + ' links), ' + version + ', median of ' + pairs + ' pairs taking turns (lower is better)\n| | older page | newer page |\n|---|---:|---:|');
  console.log('| first draw of the packed picture (ms) | ' + f('first', o).toFixed(0) + ' | ' + f('first', w).toFixed(0) + ' |\n| second draw (ms) | ' + f('second', o).toFixed(0) + ' | ' + f('second', w).toFixed(0) + ' |\n| third draw (ms) | ' + f('third', o).toFixed(0) + ' | ' + f('third', w).toFixed(0) + ' |\n| all three (ms; the browser may finish one draw'+"'"+'s painting during the next, so only the sum is steady) | ' + f('total', o).toFixed(0) + ' | ' + f('total', w).toFixed(0) + ' |\n| list still packed after the draws | ' + o[0].packedAfter + ' | ' + w[0].packedAfter + ' |' + '');
})();
