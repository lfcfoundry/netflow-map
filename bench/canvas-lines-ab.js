/* Copyright (c) 2026 LFC Foundry. MIT License. Basic (Canvas 2D) drawing of a big flat map, an older page against a newer page, each in a FRESH page taking turns; every draw ends with a pixel read so the painting is finished before the clock stops. Prints the median draw time of each (ms, lower is better), the ratio, and how much of the newer picture matches the older one (exactly, within 2 and within 5 levels of 255, and the largest difference).
 *   node bench/canvas-lines-ab.js chromium|firefox|webkit [rounds] [older.html] [newer.html] [items] */
'use strict';
(async () => {
  const which = process.argv[2] || 'chromium', rounds = +(process.argv[3] || 3), OLD = require('path').resolve(process.argv[4] || 'old.html'), NEW = require('path').resolve(process.argv[5] || require('path').join(__dirname, '..', 'index.html')), items = +(process.argv[6] || 30000);
  const D = await require('/home/claude/netflow-map/bench/driver.js').open(which, { timeout: 3600000 });
  const wait = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await D.page.evaluate(fn)) return; await new Promise((r) => setTimeout(r, 200)); } throw new Error('timeout'); };
  const once = async (f) => {
    await D.goto('about:blank'); await D.goto('file://' + f); await wait(() => typeof NFM !== 'undefined', 60000);
    await D.page.evaluate((n) => { NFM.setGraph(NFMExamples.bigNetwork(n, 4, 7)); NFM.showTab('map'); NFM.setV({ view: 'network', arrange: 'circle' }); }, items);
    await wait(() => !NFM.pending() && !!NFM.state.scene, 600000);
    return D.page.evaluate(async () => {
      const frame = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))), m = NFM.manager();
      if (m.r.name !== 'canvas2d') { m.canary.canvas2d = { ok: true }; await m.use('canvas2d'); }
      await frame(); const view = NFM.state.view, cv = document.querySelector('canvas'), cx = cv.getContext('2d'), ts = [];
      for (let i = 0; i < 7; i++) { const t = performance.now(); m.r.draw(view); cx.getImageData(0, 0, 1, 1); ts.push(performance.now() - t); }
      const d = cx.getImageData(0, 0, cv.width, cv.height).data; let h = 2166136261; for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i], 16777619);
      ts.sort((a, b) => a - b); let bin = ''; for (let i = 0; i < d.length; i += 8192) bin += String.fromCharCode.apply(null, d.subarray(i, i + 8192)); return { med: ts[3], hash: h >>> 0, w: cv.width, h: cv.height, b64: btoa(bin) };
    });
  };
  const o = [], n = [];
  await once(OLD);
  for (let r = 0; r < rounds; r++) { const order = r % 2 ? [NEW, OLD] : [OLD, NEW]; for (const f of order) { const x = await once(f); (f === OLD ? o : n).push(x); } }
  const dec = (x) => Buffer.from(x.b64, 'base64'); const A = dec(o[0]), B = dec(n[0]); let eq = 0, w2 = 0, w5 = 0, mx = 0, tot = 0; for (let i = 0; i < A.length; i++) { if ((i & 3) === 3) continue; const d = Math.abs(A[i] - B[i]); tot++; if (d === 0) eq++; if (d <= 2) w2++; if (d <= 5) w5++; if (d > mx) mx = d; } const pic = ' | picture: exact ' + (100 * eq / tot).toFixed(3) + '%, within 2 ' + (100 * w2 / tot).toFixed(3) + '%, within 5 ' + (100 * w5 / tot).toFixed(3) + '%, largest difference ' + mx + ' of 255';
  const med = (a) => a.map((x) => x.med).sort((x, y) => x - y)[a.length >> 1];
  console.log(D.version + ' older ' + med(o).toFixed(0) + ' ms, newer ' + med(n).toFixed(0) + ' ms, ratio ' + (med(n) / med(o)).toFixed(2) + '; (' + o[0].w + 'x' + o[0].h + ')' + pic); await D.close();
})();
