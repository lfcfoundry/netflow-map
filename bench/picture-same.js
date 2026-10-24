/* Copyright (c) 2026 LFC Foundry. MIT License. Does a newer page draw the same picture as an older one? The same map is opened in a FRESH page of each, drawn, and the two pictures are compared pixel by pixel (a pixel counts as the same when every color channel is within 5/255).
 *   node bench/picture-same.js chromium|firefox|webkit <old.html> <new.html> [items=3000] */
'use strict';
const path = require('path'), which = process.argv[2] || 'chromium', A = path.resolve(process.argv[3]), B = path.resolve(process.argv[4]), N = +(process.argv[5] || 3000);
(async () => {
  const shot = async (file) => {
    const D = await require('./driver.js').open(which, { timeout: 300000 });
    try {
      await D.goto('file://' + file);
      const t0 = Date.now(); while (Date.now() - t0 < 60000 && !(await D.page.evaluate(() => typeof NFM !== 'undefined' && !!NFM.setGraph && typeof NFMExamples !== 'undefined'))) await new Promise((r) => setTimeout(r, 10));
      return await D.page.evaluate(async (n) => {
        const S = NFM.state, tick = () => new Promise((res) => setTimeout(res, 20));
        NFM.setV({ view: 'network' }); S.scene = null; NFM.setGraph(NFMExamples.bigNetwork(n, 4, 7)); NFM.showTab('map');
        const t0 = performance.now(); while (performance.now() - t0 < 120000) { await tick(); if (S.scene && !NFM.pending()) break; }
        await tick(); await tick(); const m = NFM.manager().r; m.draw(NFM.state.view); const s = m.snapshot();
        return { w: s.width, h: s.height, data: Array.from(s.data), links: S.scene.curveCount ? S.scene.curveCount() : S.scene.curves.length, packed: S.scene.curvesPacked ? S.scene.curvesPacked() : false };
      }, N);
    } finally { await D.close(); }
  };
  const a = await shot(A), b = await shot(B); let same = 0, tot = a.data.length / 4;
  if (a.w !== b.w || a.h !== b.h) { console.log('sizes differ', a.w, a.h, b.w, b.h); process.exit(1); }
  for (let i = 0; i < a.data.length; i += 4) if (Math.abs(a.data[i] - b.data[i]) <= 5 && Math.abs(a.data[i + 1] - b.data[i + 1]) <= 5 && Math.abs(a.data[i + 2] - b.data[i + 2]) <= 5) same++;
  console.log('| ' + which + ', ' + N + ' items, ' + a.links + ' links | same pixels | new page packed at start |\n|---|---|---|\n| picture | ' + (100 * same / tot).toFixed(3) + '% | ' + b.packed + ' |');
})();
