/* Copyright (c) 2026 LFC Foundry. MIT License. The drop after moving an item by hand on a big flat Network map whose links are packed (the state after the page has sat idle), an older page against a newer page, in a FRESH page each time with the two taking turns (old, new, new, old, ...).
 *   node bench/drop.js chromium|firefox|webkit|epiphany [pairs] [old.html] [new.html] [items]
 * One move = NFM.moveItems(...) plus the picture work of the next two animation frames; main-thread milliseconds only (building the scene, preparing the card's buffers, drawing calls), not the wait for the graphics card. "first" is the first move of the page, "second" the next one. Milliseconds, lower is better; ratio = old / new (higher is better). The pictures are checked elsewhere (test/browser.test.js moves items with the links packed and compares with a full rebuild). */
'use strict';
const fs = require('fs'), path = require('path');
(async () => {
  const which = process.argv[2] || 'chromium', pairs = +(process.argv[3] || 5), root = path.join(__dirname, '..');
  const oldP = path.resolve(process.argv[4] || '/tmp/pr36.html'), newP = path.resolve(process.argv[5] || path.join(root, 'index.html')), items = +(process.argv[6] || 10000);
  const D = await require('./driver.js').open(which, { timeout: 3600000 }), med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
  const wait = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await D.page.evaluate(fn)) return; await new Promise((r) => setTimeout(r, 200)); } throw new Error('timed out waiting'); };
  const once = async (file) => {
    await D.goto('about:blank'); await D.goto('file://' + file); await wait(() => typeof NFM !== 'undefined', 60000);
    await D.page.evaluate((n) => { NFM.setGraph(NFMExamples.bigNetwork(n, 4, 7)); NFM.showTab('map'); NFM.setV({ view: 'network', arrange: 'circle' }); }, items);
    await wait(() => !NFM.pending() && !!NFM.state.scene && typeof NFM.state.scene.moveNodes === 'function', 600000);
    return D.page.evaluate(async () => {
      const m = NFM.manager(); m.canary.webgl2 = { ok: true }; await m.use('webgl2'); if (m.r.name !== 'webgl2') return { err: 'n/a' };
      const frame = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))), L = NFM.state.L, n = L.nodes[Math.floor(L.nodes.length / 2)], id = n.nodeId || n.id, x0 = n.cx, y0 = n.cy;
      await frame(); const packed = NFM.state.scene.packNow(); await frame();
      let armed = false, acc = 0; const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (f) => raf((t) => { const t0 = performance.now(); try { return f(t); } finally { if (armed) acc += performance.now() - t0; } });
      NFM.moveItems([[id, x0 + 5, y0 + 2]]); await frame();
      const drop = async () => { acc = 0; armed = true; const t0 = performance.now(); if (NFM.dropItems) NFM.dropItems(); else NFM.scheduleScene(); const sync = performance.now() - t0; await frame(); await frame(); armed = false; return sync + acc; };
      const a = await drop(); NFM.moveItems([[id, x0 + 9, y0 + 4]]); await frame(); const b = await drop();
      return { first: a, second: b, fast: true, packed, packedAfter: NFM.state.scene.curvesPacked(), links: L.edges.length };
    });
  };
  await once(oldP); await once(newP);   // warm-up pair (disk cache)
  const o = [], w = []; let fastOk = true, links = 0;
  for (let r = 0; r < pairs; r++) { const order = r % 2 === 0 ? [oldP, newP] : [newP, oldP]; for (const f of order) { const x = await once(f); if (x.err) { console.log('n/a'); await D.close(); process.exit(0); } (f === oldP ? o : w).push(x); if (!x.fast) fastOk = false; links = x.links; } }
  const version = D.version; await D.close();
  const f = (k, arr) => med(arr.map((x) => x[k]));
  const row = { items, links, pairs, oldFirst: f('first', o), newFirst: f('first', w), oldSecond: f('second', o), newSecond: f('second', w), fastOk, packedAfterNew: w.every((x) => x.packedAfter) };
  console.log('\n' + version + ' (' + items + ' items, ' + links + ' links packed, median of ' + pairs + ' fresh pages per version, taking turns; main-thread milliseconds, lower is better; ratio = old / new, higher is better)\n\n| move | old page | new page | ratio |\n|---|---|---|---|');
  console.log('| first drop | ' + row.oldFirst.toFixed(1) + ' | ' + row.newFirst.toFixed(1) + ' | ' + (row.oldFirst / row.newFirst).toFixed(1) + ' |\n| second drop | ' + row.oldSecond.toFixed(1) + ' | ' + row.newSecond.toFixed(1) + ' | ' + (row.oldSecond / row.newSecond).toFixed(1) + ' |\nin place every time: ' + fastOk + '; links still packed after the moves (new page): ' + row.packedAfterNew);
  fs.writeFileSync(path.join(__dirname, 'results', 'drop-' + which + '.json'), JSON.stringify({ version, row, old: o, new: w }, null, 1));
  process.exit(0);
})();
