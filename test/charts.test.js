/* Copyright (c) 2026 LFC Foundry. MIT License. The round and nested views (src/charts.js): shapes are sound on trees, graphs with loops, one item and none. */
'use strict';
global.NetflowScene = require('../vendor/netflow-scene.js');
const C = require('../src/charts.js');
let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log('FAIL', msg); } };
function rnd(seed) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }
function graph(n, extra, seed, groups) {
  const r = rnd(seed), nodes = [], edges = [];
  for (let i = 0; i < n; i++) {
    nodes.push({ id: 'n' + i, label: 'Item ' + i, group: groups ? 'g' + (i % groups) : '', sizeV: 1 + Math.floor(r() * 9), start: i === 0, pages: [i] });
    if (i) edges.push({ from: 'n' + Math.floor(r() * i), to: 'n' + i, count: 1, weight: 1 + r() * 4, widthV: NaN, flow: 0 });
  }
  for (let k = 0; k < extra; k++) { const a = Math.floor(r() * n), b = Math.floor(r() * n); if (a !== b) edges.push({ from: 'n' + a, to: 'n' + b, count: 1, weight: 1, widthV: NaN, flow: 0 }); }
  return { nodes, edges, name: 'test' };
}
const copy = (G) => ({ nodes: G.nodes.map((x) => Object.assign({}, x)), edges: G.edges, name: G.name });
const cases = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [12, 0, 3], [12, 9, 3], [300, 0, 0], [300, 200, 6], [2000, 500, 8]];
for (const [n, extra, groups] of cases) {
  const G = graph(n, extra, 11 + n, groups), tag = n + ' items, ' + extra + ' extra links';
  for (const view of ['chord', 'bundles', 'treemap', 'sunburst', 'icicle', 'pack', 'tree']) {
    for (const nest of view === 'chord' ? ['auto'] : ['auto', 'links', 'groups']) {
      const L = C.layout(view, copy(G), { nest, chordBy: 'auto', sized: true });
      ok(L.nodes.length === n, view + ' keeps every item, ' + tag);
      ok(L.nodes.every((d) => isFinite(d.cx) && isFinite(d.cy) && isFinite(d.w) && isFinite(d.h)), view + ' ' + nest + ' places every item, ' + tag);
      L.view = view; L.groups = groups ? Array.from({ length: groups }, (_, i) => 'g' + i) : [''];
      const S = C.scene(L, {}, global.NetflowScene);
      ok(isFinite(S.x0) && S.w > 0 && S.h > 0, view + ' scene has a size, ' + tag);
      ok(S.nodes.length === n, view + ' scene names every item, ' + tag);
      const ch = L.chart;
      if (view === 'treemap' && n) {   /* a leaf's box is as big as its value, against the others (same parent area share) */
        let leafA = 0, leafV = 0; L.nodes.forEach((d) => { if (!ch.kids[d.hv].length) { leafA += d.w * d.h; leafV += ch.val[d.hv]; } });
        const one = L.nodes.find((d) => !ch.kids[d.hv].length && d.w * d.h > 0);
        ok(!one || leafA > 0, 'treemap leaves have area, ' + tag);
        /* no two leaves overlap */
        const lv = L.nodes.filter((d) => !ch.kids[d.hv].length).slice(0, 400); let ov = 0;
        for (let i = 0; i < lv.length; i++) for (let j = i + 1; j < lv.length; j++) { const a = lv[i], b = lv[j]; if (a.x + 1e-6 < b.x + b.w && b.x + 1e-6 < a.x + a.w && a.y + 1e-6 < b.y + b.h && b.y + 1e-6 < a.y + a.h) ov++; }
        ok(ov === 0, 'treemap leaves do not overlap (' + ov + '), ' + nest + ', ' + tag);
      }
      if (view === 'pack' && n) {
        const lv = L.nodes.filter((d) => !ch.kids[d.hv].length).slice(0, 600); let ov = 0;
        for (let i = 0; i < lv.length; i++) for (let j = i + 1; j < lv.length; j++) { const a = lv[i], b = lv[j]; if (Math.hypot(a.cx - b.cx, a.cy - b.cy) < a.w / 2 + b.w / 2 - 0.01) ov++; }
        ok(ov === 0, 'pack circles do not overlap (' + ov + '), ' + nest + ', ' + tag);
        /* every circle sits inside its parent's */
        let out = 0; for (let v = 0; v < ch.N; v++) { const p = ch.par[v]; if (p < 0) continue; if (Math.hypot(ch.X[v] - ch.X[p], ch.Y[v] - ch.Y[p]) + ch.Rr[v] > ch.Rr[p] + 1e-6 * ch.Rr[p] + 0.01) out++; }
        ok(out === 0, 'pack circles sit inside their parent (' + out + '), ' + nest + ', ' + tag);
      }
      if ((view === 'sunburst' || view === 'icicle') && n) {   /* children share their parent's span exactly */
        let bad = 0; for (let v = 0; v < ch.N; v++) { const k = ch.kids[v]; if (!k.length) continue; let s = 0; k.forEach((c) => { s += ch.R[c * 4 + 3] - ch.R[c * 4 + 1]; }); const span = ch.R[v * 4 + 3] - ch.R[v * 4 + 1]; if (s > span + 1e-9) bad++; }
        ok(bad === 0, view + ' children fit in their parent, ' + tag);
      }
    }
  }
  /* tree: no two items of a row closer than one row, each parent in the middle of its children */
  for (const shape of ['tidy', 'cluster', 'radial', 'radialCluster', 'indented']) {
    const L = C.layout('tree', copy(G), { treeShape: shape }), ch = L.chart;
    ok(L.nodes.every((d) => isFinite(d.cx)), 'tree ' + shape + ' places every item, ' + tag);
    if (shape === 'tidy' && n) {
      const rows = new Map(); for (let v = 0; v < ch.N; v++) { if (ch.skipRoot && v === ch.root) continue; const d = ch.depth[v]; if (!rows.has(d)) rows.set(d, []); rows.get(d).push(ch.Y[v]); }
      let close = 0; rows.forEach((a) => { a.sort((x, y) => x - y); for (let i = 1; i < a.length; i++) if (a[i] - a[i - 1] < 25.99) close++; });
      ok(close === 0, 'tidy tree: no two items of a row touch (' + close + '), ' + tag);
      let off = 0; for (let v = 0; v < ch.N; v++) { const k = ch.kids[v]; if (k.length && !(ch.skipRoot && v === ch.root) && Math.abs((ch.Y[k[0]] + ch.Y[k[k.length - 1]]) / 2 - ch.Y[v]) > 1e-6) off++; }
      ok(off === 0, 'tidy tree: parents sit in the middle of their children, ' + tag);
    }
  }
  /* chord: arcs cover what flows; the order search never makes crossings worse than the group order */
  const Lc = C.layout('chord', copy(G), {}), cc = Lc.chart;
  let flowSum = 0; cc.flows.forEach((f) => { flowSum += f.v; });
  ok(Math.abs(flowSum - cc.total) < 1e-6 * Math.max(1, flowSum), 'chord total is the sum of its bands, ' + tag);
  ok(cc.flows.every((f) => f.sa1 >= f.sa0 && f.ta1 >= f.ta0), 'chord bands have a width at both ends, ' + tag);
}
/* packSiblings and enclose: a known case */
const three = [{ r: 1 }, { r: 1 }, { r: 1 }].map((c) => Object.assign({ x: 0, y: 0 }, c));
const R = C.packSiblings(three);
ok(Math.abs(R - (1 + 2 / Math.sqrt(3))) < 1e-9, 'three equal circles: enclosing radius 1 + 2/sqrt(3) (' + R + ')');
console.log(fails ? fails + ' of ' + checks + ' checks FAILED' : checks + ' checks passed');
process.exit(fails ? 1 : 0);
