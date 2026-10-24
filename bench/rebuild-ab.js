/* Copyright (c) 2026 LFC Foundry. MIT License. Picture rebuild, an older page against a newer one, each in a FRESH page, taking turns (old, new, new, old, ...). The map is opened, then the picture is rebuilt `rebuilds` times without changing anything that changes its look (NFM.scheduleScene(false, true), the call a drop or a label-size change makes, as moving to another arrangement would), with the drawing switched off so only the build is timed.
 *   node bench/rebuild-ab.js chromium|firefox|webkit <old.html> <new.html> [items=30000] [pairs=3] [rebuilds=5]
 * Prints, per page (median over pairs of the median rebuild, milliseconds, lower is better) the rebuild time, the longest main-thread hold while rebuilding, and the ratio old / new (higher is better, above 1 means the new one is faster). */
'use strict';
const path = require('path'), which = process.argv[2] || 'chromium', A = path.resolve(process.argv[3]), B = path.resolve(process.argv[4]), N = +(process.argv[5] || 30000), pairs = +(process.argv[6] || 3), R = +(process.argv[7] || 5);
(async () => {
  const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
  const once = async (file) => {
    const D = await require('./driver.js').open(which, { timeout: 300000 });
    try {
      await D.goto('file://' + file);
      const t0 = Date.now(); while (Date.now() - t0 < 60000 && !(await D.page.evaluate(() => typeof NFM !== 'undefined' && !!NFM.setGraph && typeof NFMExamples !== 'undefined'))) await new Promise((r) => setTimeout(r, 10));
      return Object.assign({ version: D.version }, await D.page.evaluate(async ([n, R]) => {
        const S = NFM.state, tick = () => new Promise((res) => setTimeout(res, 4));
        const settle = async (limit) => { const t = performance.now(); while (performance.now() - t < limit) { await tick(); if (S.scene && !NFM.pending()) return; } };
        NFM.setV({ view: 'network' }); S.scene = null; NFM.setGraph(NFMExamples.bigNetwork(n, 4, 7)); NFM.showTab('map'); await settle(120000);
        await new Promise((res) => setTimeout(res, 1500));
        const m = NFM.manager(); if (m.r) m.r.draw = function () {};
        let last = performance.now(), hold = 0, run = true; (function mon() { if (!run) return; const t = performance.now(); hold = Math.max(hold, t - last - 4); last = t; setTimeout(mon, 4); })();
        const rb = [];
        for (let i = 0; i < R; i++) { const t = performance.now(); NFM.scheduleScene(false, true); await tick(); await settle(60000); rb.push(performance.now() - t); }
        run = false; rb.sort((a, b) => a - b);
        return { rebuild: rb[rb.length >> 1], hold };
      }, [N, R]));
    } finally { await D.close(); }
  };
  const a = [], b = []; let ver = '';
  for (let r = 0; r < pairs; r++) for (const f of (r % 2 ? [B, A] : [A, B])) { const x = await once(f); ver = x.version; (f === A ? a : b).push(x); }
  const f = (xs, k) => med(xs.map((x) => x[k]));
  console.log('| ' + N + ' items | rebuild (ms) | longest hold (ms) |\n|---|---|---|');
  console.log('| old | ' + f(a, 'rebuild').toFixed(0) + ' | ' + f(a, 'hold').toFixed(0) + ' |\n| new | ' + f(b, 'rebuild').toFixed(0) + ' | ' + f(b, 'hold').toFixed(0) + ' |');
  console.log('\nratio old / new: rebuild ' + (f(a, 'rebuild') / f(b, 'rebuild')).toFixed(2) + ', hold ' + (f(a, 'hold') / f(b, 'hold')).toFixed(2) + '. ' + ver + ', median of ' + pairs + ' fresh pages per version, lower is better.');
})();
