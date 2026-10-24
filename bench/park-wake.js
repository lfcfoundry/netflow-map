/* Copyright (c) 2026 LFC Foundry. MIT License. How long the page is held while a parked link list of a big flat map wakes: all at once (reading L.edges) and, when the page has it, in slices (L.wakeAsync), with the longest gap between two timer ticks as the hold.
 *   node bench/park-wake.js chromium|firefox|webkit|epiphany [items] [index.html] [rounds]
 * Prints the median of each way (ms, lower is better). The pack time of L.parkNow() is printed first. The list is parked with L.parkNow() before every round. */
'use strict';
(async () => {
  const which = process.argv[2] || 'chromium', items = +(process.argv[3] || 100000), page = require('path').resolve(process.argv[4] || require('path').join(__dirname, '..', 'index.html')), rounds = +(process.argv[5] || 5);
  const D = await require('./driver.js').open(which, { timeout: 3600000 });
  const wait = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await D.page.evaluate(fn)) return; await new Promise((r) => setTimeout(r, 200)); } throw new Error('timed out waiting'); };
  await D.goto('file://' + page); await wait(() => typeof NFM !== 'undefined', 60000);
  await D.page.evaluate((n) => { NFM.setGraph(NFMExamples.bigNetwork(n, 4, 7)); NFM.showTab('map'); NFM.setV({ view: 'network', arrange: 'circle' }); }, items);
  await wait(() => !NFM.pending() && !!NFM.state.scene && NFM.state.L && typeof NFM.state.L.parkNow === 'function', 600000);
  const r = await D.page.evaluate(async (rounds) => {
    const L = NFM.state.L, sync = [], sl = [], wall = [], pack = [], tick = () => new Promise((res) => setTimeout(res, 0));
    for (let i = 0; i < rounds; i++) {
      const tp = performance.now(); if (!L.parkNow()) return { err: 'not parked' }; pack.push(performance.now() - tp);
      await tick(); const t = performance.now(); void L.edges; sync.push(performance.now() - t);
      if (L.wakeAsync) {
        if (!L.parkNow()) return { err: 'not parked 2' };
        await tick(); let last = performance.now(), worst = 0, run = true; const t0 = last;
        (function beat() { const n = performance.now(); worst = Math.max(worst, n - last); last = n; if (run) setTimeout(beat, 0); })();
        const ok = await L.wakeAsync(); run = false; await tick();
        if (!ok) return { err: 'wakeAsync gave ' + ok }; sl.push(worst); wall.push(performance.now() - t0);
      }
    }
    return { sync, sl, wall, pack, links: L.edges.length };
  }, rounds);
  const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1], v = D.version; await D.close();
  if (r.err) { console.log(v + ': ' + r.err); process.exit(1); }
  console.log(v + ', ' + r.links.toLocaleString() + ' links, median of ' + rounds + ' (ms, lower is better): park (pack) ' + med(r.pack).toFixed(0) + '; wake all at once (page held) ' + med(r.sync).toFixed(0) + (r.sl.length ? '; wake in slices: longest hold ' + med(r.sl).toFixed(0) + ', wall ' + med(r.wall).toFixed(0) : '; no sliced wake in this page'));
})();
