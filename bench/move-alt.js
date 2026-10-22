/* Copyright (c) 2026 LFC Foundry. MIT License. Moving an item by hand on a big flat Network map: the in-place way against building the whole picture again, taking turns (in place, rebuild, rebuild, in place, ...) in one page per browser, 30 moves each.
 *   node bench/move-alt.js chromium|firefox|webkit|epiphany [items] [moves]
 * One move = NFM.moveItems(...) then the next two animation frames; the numbers are main-thread milliseconds (the page's own work: building the scene, preparing the card's buffers, drawing calls), not the wait for the graphics card. Milliseconds, lower is better; ratio = rebuild / in place (higher is better). The two pictures must be identical (checked by test/browser.test.js). */
'use strict';
const path = require('path');
(async () => {
  const which = process.argv[2] || 'chromium', items = +(process.argv[3] || 10000), moves = +(process.argv[4] || 30);
  const D = await require('./driver.js').open(which, { timeout: 3600000 });
  const wait = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await D.page.evaluate(fn)) return; await new Promise((r) => setTimeout(r, 250)); } throw new Error('timed out waiting'); };
  await D.goto('file://' + path.resolve(__dirname, '..', 'index.html')); await wait(() => typeof NFM !== 'undefined', 60000);
  await D.page.evaluate((n) => { NFM.setGraph(NFMExamples.bigNetwork(n, 4, 7)); NFM.showTab('map'); NFM.setV({ view: 'network', arrange: 'circle' }); }, items);
  await wait(() => !NFM.pending() && !!NFM.state.scene && typeof NFM.state.scene.moveNodes === 'function', 600000);
  const run = (be) => D.page.evaluate(async ([moves, be]) => {
    const m = NFM.manager(); if (be !== 'canvas2d') m.canary[be] = { ok: true }; await m.use(be); if (m.r.name !== be) return { err: 'n/a' };
    const frame = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))), L = NFM.state.L, n = L.nodes[Math.floor(L.nodes.length / 2)], id = n.nodeId || n.id, x0 = n.cx, y0 = n.cy, med = (a) => a.slice().sort((p, q) => p - q)[a.length >> 1];
    await frame();
    /* main-thread time only: what moveItems does at once, plus whatever the picture work does in the frame callback (building the scene, tidying the card's buffers, drawing); waiting for the graphics card or the screen is not counted */
    let inSync = false, acc = 0; const wrap = (o, k) => { const f = o[k]; if (typeof f !== 'function') return; o[k] = function () { const t = performance.now(); try { return f.apply(this, arguments); } finally { if (!inSync) acc += performance.now() - t; } }; };
    wrap(NFMScene, 'make'); ['setScene', 'restyle', 'patch', 'draw'].forEach((k) => wrap(m.r, k));
    const one = async (rebuild, k) => { acc = 0; inSync = true; const t0 = performance.now(); const res = NFM.moveItems([[id, x0 + k * 7, y0 + k * 3]], rebuild); const sync = performance.now() - t0; inSync = false; await frame(); return [sync + acc, res.fast]; };
    await one(true, 0); await one(false, 1);   // warm-up pair
    const a = [], b = []; let fastOk = true;
    for (let k = 2; k < moves + 2; k++) { const order = k % 2 === 0 ? [false, true] : [true, false]; for (const rb of order) { const [ms, fast] = await one(rb, k); if (rb) b.push(ms); else { a.push(ms); if (!fast) fastOk = false; } } }
    return { inPlace: med(a), rebuild: med(b), worst: [Math.max.apply(null, a), Math.max.apply(null, b)], fastOk, links: L.edges.length };
  }, [moves, be]);
  const res = {}; for (const be of ['webgl2', 'canvas2d']) res[be] = await run(be);
  const version = D.version; await D.close();
  console.log('\n' + version + ' (' + items + ' items, ' + (res.webgl2.links || res.canvas2d.links) + ' links, median of ' + moves + ' moves each way, taking turns; main-thread milliseconds per move, lower is better; ratio = rebuild / in place, higher is better)\n\n| drawing with | in place | rebuild everything | ratio | slowest single move (in place / rebuild) |\n|---|---|---|---|---|');
  for (const be of ['webgl2', 'canvas2d']) { const r = res[be]; console.log(r.err ? '| ' + be + ' | n/a | n/a | n/a | n/a |' : '| ' + be + ' | ' + r.inPlace.toFixed(1) + ' | ' + r.rebuild.toFixed(1) + ' | ' + (r.rebuild / r.inPlace).toFixed(1) + ' | ' + r.worst[0].toFixed(0) + ' / ' + r.worst[1].toFixed(0) + (r.fastOk ? '' : ' (some moves not in place!)') + ' |'); }
  require('fs').writeFileSync(path.join(__dirname, 'results', 'move-alt-' + which + '.json'), JSON.stringify({ version, items, moves, res }, null, 1));
  process.exit(0);
})();
