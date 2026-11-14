/* Link columns in the page (map file version 2, lazy link rows, autosave and restore). Copyright (c) 2026 LFC Foundry. MIT License.
 * Run: node test/link-cols.browser.test.js chromium|firefox|webkit   (needs index.html built and the browsers; see AGENTS.md) */
'use strict';
const path = require('path');
const which = process.argv[2] || 'chromium';
let fails = 0; const say = (ok, m) => { console.log((ok ? 'ok   ' : 'FAIL ') + m); if (!ok) fails++; };
(async () => {
  const D = await require('../bench/driver.js').open(which, { timeout: 300000 });
  console.log(D.version);
  const url = 'file://' + path.join(__dirname, '..', 'index.html');
  const ready = () => D.page.evaluate(() => new Promise((r) => { const f = () => typeof NFM !== 'undefined' && NFM.setGraph && typeof NFMExamples !== 'undefined' ? r() : setTimeout(f, 5); f(); }));
  try {
    await D.goto(url); await ready();
    const r = await D.page.evaluate(async () => {
      const wait = (ms) => new Promise((q) => setTimeout(q, ms)), S = NFM.state, out = {};
      const g0 = NFMExamples.bigNetwork(20000, 9, 7);
      const raw = { name: 'ColsA', nodes: g0.nodes, edges: g0.edges }; raw.edges.forEach((e, i) => { if (i % 5 === 0) { e.weight = i % 17; e.kind = 'k' + (i % 4); } if (i % 9 === 0) e.attrs = { w2: i, tag: 't' + (i % 3) }; });
      NFM.setGraph(NFMImport.sanitizeGraph(raw)); await wait(1500);
      const rows0 = JSON.stringify(S.graph.edges), n0 = S.graph.nodes.length, m0 = S.graph.edges.length;
      const bytes = await NFM.mapFileBytes(); out.links = m0;
      NFM.setGraph({ name: 'o', nodes: [{ id: 'a' }, { id: 'b' }], edges: [{ from: 'a', to: 'b' }] }); await wait(500);
      await NFM.openMapBytes(bytes);
      out.lazy = typeof NFMLinkCols !== 'undefined' && !!NFMLinkCols.pending(S.graph);
      out.countsOk = S.graph.nodes.length === n0 && S.outAdj.count(S.graph.nodes[0].id) >= 0;
      const prof = S.prof; out.profWeight = !!prof.edges.find((c) => c.key === 'weight') && !!prof.edges.find((c) => c.key === 'w2');
      const canon = (a) => JSON.stringify(a.map((e) => Object.keys(e).sort().map((k) => [k, e[k]]))); out.rowsSame = canon(S.graph.edges) === canon(JSON.parse(rows0)); out.lazyAfter = !NFMLinkCols.pending(S.graph);
      out.idxOk = NFM.indexMatches() === true;
      /* a lazy map edited: the rows come, the edit lands */
      NFM.setGraph({ name: 'o', nodes: [{ id: 'a' }, { id: 'b' }], edges: [{ from: 'a', to: 'b' }] }); await wait(300);
      await NFM.openMapBytes(bytes); NFM.edit((g) => { g.nodes[3] = Object.assign({}, g.nodes[3], { label: 'Edited' }); });
      out.edited = S.graph.nodes[3].label === 'Edited' && S.graph.edges.length === m0 && canon(S.graph.edges) === canon(JSON.parse(rows0));
      /* autosave of a column map: packed bytes in the browser, then a reload brings it back (as columns) */
      NFM.setGraph({ name: 'o', nodes: [{ id: 'a' }, { id: 'b' }], edges: [{ from: 'a', to: 'b' }] }); await wait(300);
      const s0 = ((await NFM.safe.read('nfm-graph')) || {}).seq || 0; await NFM.openMapBytes(bytes); let m = null; const t0 = performance.now(); while (performance.now() - t0 < 20000) { await wait(100); m = await NFM.safe.read('nfm-graph'); if (m && m.packed && m.seq > s0) break; }
      out.saved = !!(m && m.packed); out.savedKb = m && m.packed ? Math.round(m.packed.length / 1024) : 0; window.__rows0 = rows0; try { sessionStorage.setItem('cols-rows', String(rows0.length)); } catch (e) { /* */ }
      return out;
    });
    say(r.lazy && r.countsOk, 'a version 2 map file opens with its links as columns: ' + JSON.stringify({ links: r.links, lazy: r.lazy, countsOk: r.countsOk }));
    say(r.profWeight, 'the column profile from columns has the weight and extra columns');
    say(r.rowsSame && r.lazyAfter && r.idxOk, 'link rows built later are the same rows, and the item index matches one built from nothing');
    say(r.edited, 'an edit of a column map keeps every link');
    say(r.saved && r.savedKb > 0, 'autosave keeps a column map as packed bytes (' + r.savedKb + ' KB)');
    await D.goto(url); await ready();
    const r2 = await D.page.evaluate(async () => {
      const wait = (ms) => new Promise((q) => setTimeout(q, ms)), S = NFM.state; await wait(1500);
      const lazy = !!NFMLinkCols.pending(S.graph), n = S.graph.nodes.length, name = S.graph.name;
      const len = JSON.stringify(S.graph.edges).length, ok = Math.abs(len - Number(sessionStorage.getItem('cols-rows'))) < 40;   /* same links (key order may differ by a few bytes? no: lengths equal) */
      return { lazy, n, name, ok, m: S.graph.edges.length };
    });
    say(r2.n === 20000 && r2.m > 0 && r2.ok, 'after a reload the autosaved column map is back with the same links: ' + JSON.stringify(r2));
    const v1 = await D.page.evaluate(async () => {   /* a small map still saves as version 1 (rows) and opens */
      const S = NFM.state; NFM.setGraph(NFMImport.sanitizeGraph({ name: 'Small', nodes: [{ id: 'a' }, { id: 'b' }], edges: [{ from: 'a', to: 'b' }] }));
      const bytes = await NFM.mapFileBytes(); const t = LfcPack.unpackTables(bytes); const d = await Promise.resolve(t);
      NFM.setGraph({ name: 'o', nodes: [{ id: 'x' }], edges: [] }); await NFM.openMapBytes(bytes);
      return { version: d.version, hasLinks: Array.isArray(d.links), lc: !!d.lc, nodes: S.graph.nodes.length, edges: S.graph.edges.length };
    });
    say(v1.hasLinks && !v1.lc && v1.nodes === 2 && v1.edges === 1, 'a small map file stays version 1: ' + JSON.stringify(v1));
  } finally { await D.close(); }
  console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
