/* Copyright (c) 2026 LFC Foundry. MIT License. Saved layouts end to end in one browser, the way the app does it: a real engine worker, the browser's real storage, a page opened from a file.
 * For each size: a plain build (no storage), a first open with storage (lays out, then saves) and a second open (put back from storage). Each of the three starts a fresh worker, like a new visit.
 *   node bench/saved-alt.js chromium|firefox|webkit|epiphany [reps] [sizes, comma separated] [arrange]
 * Milliseconds, lower is better; medians of `reps` rounds, the plain and first-open runs swapped every other round so neither always goes first. "same picture" must be true. */
'use strict';
const fs = require('fs'), path = require('path');
const R = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const texts = { engine: ['src/columns.js', 'src/pack.js', 'vendor/netflow-sankey.js', 'vendor/netflow-layers.js', 'src/engine.js', 'src/sim.js', 'src/check.js'].map(R).join('\n'), store: R('src/layoutstore.js'), client: R('src/engine-client.js'), gen: R('bench/gen.js') };
async function inPage(arg) {
  const { texts, reps, sizes, arrange } = arg, ev = (c) => (0, eval)(c), med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1], rows = [];
  ev(texts.engine); ev(texts.store); ev(texts.client); ev(texts.gen + '\n;globalThis.NFMGen = NFMGen;');
  const GEN = globalThis.NFMGen, C = globalThis.NFMColumns, mk = async (store, g) => { const c = new NFMEngineClient.Client(texts.engine, () => globalThis.NFMEngine); await c.start(); if (c.mode !== 'worker') throw new Error('no worker: ' + c.why); c.store = store; c.storeMin = 1500; await c.setGraph(g); return c; };
  const run = async (store, g, o) => { const c = await mk(store, g), t0 = performance.now(), r = await c.build(o); const ms = performance.now() - t0; if (c.w) c.w.terminate(); return { ms, L: r.L, saved: !!r.fromSaved }; };
  for (const n of sizes) {
    const g = C.derive(JSON.parse(JSON.stringify(GEN.graph('moderate', n, 11)))), o = { view: 'network', arrange, colorBy: 'group' }, tp = [], tm = [], th = [], tk = []; let same = true, used = true;
    await run(null, g, o);   // warm-up: the first worker and the first layout of a page are slower
    for (let r = 0; r < reps; r++) {
      const db = 'nfm-saved-bench-' + n + '-' + r; await new Promise((res) => { const q = indexedDB.deleteDatabase(db); q.onsuccess = q.onerror = q.onblocked = () => res(); });
      const store = new NFMLayoutStore.Store(NFMLayoutStore.idbBackend(db));
      let plain, miss;
      if (r % 2 === 0) { plain = await run(null, g, o); miss = await run(store, g, o); } else { miss = await run(store, g, o); plain = await run(null, g, o); }
      await new Promise((res) => setTimeout(res, 150));   // the save finishes in the background
      const hit = await run(store, g, o); used = used && hit.saved && !miss.saved;
      same = same && plain.L.nodes.every((a, i) => a.x === hit.L.nodes[i].x && a.y === hit.L.nodes[i].y) && plain.L.width === hit.L.width;
      tp.push(plain.ms); tm.push(miss.ms); th.push(hit.ms); tk.push(plain.ms / hit.ms);
      await store.clear(); indexedDB.deleteDatabase(db);
    }
    rows.push({ n, plain: Math.round(med(tp)), first: Math.round(med(tm)), second: Math.round(med(th)), ratio: +med(tk).toFixed(1), same, used });
  }
  return rows;
}
(async () => {
  const which = process.argv[2] || 'chromium', reps = +(process.argv[3] || 5), sizes = (process.argv[4] || '3000,10000,30000').split(',').map(Number), arrange = process.argv[5] || 'stress';
  const page = path.join(require('os').tmpdir(), 'nfm-saved-bench.html'); fs.writeFileSync(page, '<!doctype html><meta charset="utf-8"><title>saved</title>');
  const D = await require('./driver.js').open(which, { timeout: 3600000 }); await D.goto('file://' + page);
  const rows = await D.page.evaluate(inPage, { texts, reps, sizes, arrange }); const version = D.version; await D.close();
  console.log('\n' + version + ' (' + arrange + ' arrangement, median of ' + reps + ' rounds; milliseconds, lower is better; ratio = plain build time / second-open time, higher is better)\n\n| items | plain build | first open (lays out + saves) | second open (from storage) | ratio (higher is better) | same picture | came from storage |\n|---|---|---|---|---|---|---|');
  rows.forEach((r) => console.log(`| ${r.n.toLocaleString('en-US')} moderate | ${r.plain} | ${r.first} | ${r.second} | ${r.ratio} | ${r.same} | ${r.used} |`));
  fs.writeFileSync(path.join(__dirname, 'results', 'saved-alt-' + which + '.json'), JSON.stringify({ version, reps, arrange, rows }, null, 1));
  process.exit(0);
})();
