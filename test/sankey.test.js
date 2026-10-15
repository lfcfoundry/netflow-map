/* Copyright (c) 2026 LFC Foundry. MIT License. The improved river layout: every link is drawn, band thickness is the flow everywhere, loops are bands, weighted order beats plain order. */
'use strict';
global.NFMColumns = require('../src/columns.js'); global.NFMImport = require('../src/importers.js');
const E = require('../src/engine.js'), SK = require('../src/sankey.js'), X = require('../src/examples.js');
let bad = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
const t = (name, fn) => { try { fn(); console.log('ok   ' + name); } catch (e) { bad++; console.log('FAIL ' + name + ': ' + e.message); } };
const rng = (seed) => { let s = seed | 0; return () => { s = (s + 0x6d2b79f5) | 0; let q = Math.imul(s ^ (s >>> 15), 1 | s); q = (q + Math.imul(q ^ (q >>> 7), 61 | q)) ^ q; return ((q ^ (q >>> 14)) >>> 0) / 4294967296; }; };
function synth(nl, per, seed, loops) {
  const r = rng(seed), rows = ['from,to,weight'];
  for (let k = 0; k + 1 < nl; k++) for (let j = 0; j < per; j++) { const m = 1 + Math.floor(r() * 3); for (let q = 0; q < m; q++) rows.push(`S${k} i${j},S${k + 1} i${Math.floor(r() * per)},${Math.max(1, Math.round(Math.exp(r() * 4)))}`); }
  for (let q = 0; q < loops; q++) { const a = 2 + Math.floor(r() * (nl - 2)); rows.push(`S${a} i${Math.floor(r() * per)},S${Math.floor(r() * a)} i${Math.floor(r() * per)},3`); }
  return rows.join('\n');
}
const river = (g) => E.build(g, { view: 'river', amounts: true, widthBy: 'weight', colorBy: 'group' });
const net = () => river(NFMImport.importDelimited(synth(7, 10, 5, 3), ',').graph);

t('layering: a simple chain gets one layer per step, a cycle gets exactly one backward link', () => {
  const r = SK.layering(4, [{ from: 0, to: 1, flow: 5 }, { from: 1, to: 2, flow: 5 }, { from: 2, to: 3, flow: 5 }, { from: 2, to: 0, flow: 1 }], true);
  ok(Array.from(r.layer).join() === '0,1,2,3', 'layers ' + Array.from(r.layer).join()); ok(r.feedback.size === 1 && r.feedback.has(3), 'the light link back is the one turned around');
});
t('layering: extra sources sit next to their first consumer, not at the far end', () => {
  const r = SK.layering(4, [{ from: 0, to: 1, flow: 1 }, { from: 1, to: 2, flow: 1 }, { from: 3, to: 2, flow: 1 }], true);
  ok(r.layer[3] === 1 && r.layer[2] === 2 && r.feedback.size === 0, 'layers ' + Array.from(r.layer).join());
});
t('every link with flow is drawn (as a band or a loop), and band thickness is flow times one scale', () => {
  const L = net(), R = SK.layout(L), usable = L.edges.filter((e) => e.kind !== 'self' && e.flow > 1e-9).length;
  const drawn = new Set(R.bands.map((b) => b.edge).concat(R.loops.map((l) => l.edge)));
  ok(drawn.size === usable, 'drawn ' + drawn.size + ' of ' + usable);
  let worst = 0; R.bands.forEach((b) => { const th = ((b.y0b - b.y0a) + (b.y1b - b.y1a)) / 2, want = L.edges[b.edge].flow * R.ky; if (want * 1 > 0.8) worst = Math.max(worst, Math.abs(th - want) / want); });
  ok(worst < 1e-9, 'thickness off by ' + worst);
});
t('a band is as thick at both ends, and the ends stay inside their item bars', () => {
  const L = net(), R = SK.layout(L), byId = {}; R.nodes.forEach((n) => { byId[n.id] = n; });
  R.bands.forEach((b) => {
    ok(Math.abs((b.y0b - b.y0a) - (b.y1b - b.y1a)) < 1e-9, 'unequal ends');
    const a = byId[b.from], c = byId[b.to];
    if (Math.abs(b.x0 - (a.x + a.w)) < 1e-9) ok(b.y0a >= a.y - 1e-6 && b.y0b <= a.y + a.h + 1e-6, 'start outside its bar');
    if (Math.abs(b.x1 - c.x) < 1e-9) ok(b.y1a >= c.y - 1e-6 && b.y1b <= c.y + c.h + 1e-6, 'end outside its bar');
  });
});
t('no item bars overlap each other', () => {
  const R = SK.layout(net()); const by = {}; R.nodes.forEach((n) => { (by[n.layer] = by[n.layer] || []).push(n); });
  Object.values(by).forEach((list) => { list.sort((a, b) => a.y - b.y); for (let i = 1; i < list.length; i++) ok(list[i].y >= list[i - 1].y + list[i - 1].h - 1e-6, 'overlap'); });
});
t('weighted order has fewer weighted crossings than plain order on the same layout', () => {
  const L = net(), flow = (ei) => L.edges[ei].flow, pw = SK.layout(L), pp = SK.layout(L, { unweighted: true });
  const cw = SK.measure({ bands: pw.bands, loops: pw.loops, nodes: pw.nodes, height: pw.height, width: pw.width }, flow).crossingWeight;
  const cp = SK.measure({ bands: pp.bands, loops: pp.loops, nodes: pp.nodes, height: pp.height, width: pp.width }, flow).crossingWeight;
  ok(cw < cp, 'weighted ' + cw.toFixed(3) + ' against plain ' + cp.toFixed(3));
});
t('same input, same picture', () => { const L = net(); ok(JSON.stringify(SK.layout(L).bands) === JSON.stringify(SK.layout(L).bands), 'differs'); });
t('the examples lay out without trouble and draw all their flow', () => {
  ['itself', 'pipeline', 'story', 'states'].forEach((id) => {
    const ex = X.LIST.find((x) => x.id === id).load(), L = E.build(ex.graph, id === 'story' ? { view: 'river', colorBy: 'odds', wantFlow: true } : { view: 'river', amounts: true, widthBy: 'weight', colorBy: 'group' });
    const R = SK.layout(L), m = SK.measure({ bands: R.bands, loops: R.loops, nodes: R.nodes, height: R.height, width: R.width }, (ei) => L.edges[ei].flow);
    ok(m.drawnShare > 0.999 && m.widthSpread < 1.01, id + ': drawn ' + m.drawnShare + ' spread ' + m.widthSpread);
  });
});
t('a big network stays quick', () => { const L = river(NFMImport.importDelimited(synth(10, 25, 5, 5), ',').graph), t0 = Date.now(); SK.layout(L); ok(Date.now() - t0 < 1500, 'took ' + (Date.now() - t0) + ' ms'); });
console.log(bad ? 'sankey: ' + bad + ' FAILED' : 'sankey: all passed'); process.exit(bad ? 1 : 0);
