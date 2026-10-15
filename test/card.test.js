/* Copyright (c) 2026 LFC Foundry. MIT License. The graphics-card path of "Distances, best quality": hand-off to the card, fall-backs, and being superseded. A pretend card stands in (Node has no WebGPU). */
'use strict';
global.NFMColumns = require('../src/columns.js'); global.NFMSim = require('../src/sim.js'); global.NFMCheck = require('../src/check.js');
const E = require('../src/engine.js'), { Client } = require('../src/engine-client.js'); let bad = 0;
const mk = (n, edges) => ({ start: 'n0', nodes: Array.from({ length: n }, (_, i) => ({ id: 'n' + i, label: 'n' + i, group: '', valence: '', ghost: false, attrs: {} })), edges: edges.map((e, i) => ({ id: 'e' + i, from: 'n' + e[0], to: 'n' + e[1], label: '', kind: '', weight: 1, attrs: {} })) });
const random = (n, m, seed) => { let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647, e = []; for (let i = 1; i < n; i++) e.push([Math.floor(r() * i), i]); while (e.length < m) { const a = Math.floor(r() * n), b = Math.floor(r() * n); if (a !== b) e.push([a, b]); } return e; };
const ok = (c, m) => { if (!c) throw new Error(m); };
const t = async (name, fn) => { const t0 = Date.now(); try { const r = await fn(); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)' + (r ? ' ' + r : '')); } catch (e) { bad++; console.log('FAIL ' + name + ': ' + e.message); } };
const g = mk(4100, random(4100, 12300, 5)), small = mk(300, random(300, 900, 2));
const opts = { view: 'network', arrange: 'stressBest' };
const pos = (r) => r.L.nodes.map((n) => n.cx + ',' + n.cy).join(';');
const client = (graph, card) => { const c = new Client('', () => E); c.mode = 'page'; c.setGraph(graph); if (card) { c.card = card; c.cardP = Promise.resolve(card); } return c; };
const spiral = (cap) => { const X = new Float32Array(2 * cap.k); for (let i = 0; i < cap.k; i++) { const a = i * 2.4, r = 20 * Math.sqrt(i + 1); X[2 * i] = r * Math.cos(a); X[2 * i + 1] = r * Math.sin(a); } return X; };
(async () => {
  let plain, calls = 0, seen = null;
  await t('without a card, the build is the processor\'s', async () => { plain = await client(g, null).build(opts); ok(plain.L.nodes.length === 4100, 'wrong size'); ok(!plain.card, 'card flag set'); });
  const card = { state: 'ready', max: 40000, info: 'pretend card', layout: async (cap) => { calls++; seen = { k: cap.k, off: cap.off.length, nbr: cap.nbr.length, edge: cap.edge }; return { X: spiral(cap), method: 'sgd' }; } };
  await t('with a card: the card is asked once, for the big piece, and its picture is used', async () => {
    const r = await client(g, card).build(opts);
    ok(calls === 1, 'asked ' + calls + ' times'); ok(seen.k === 4100 && seen.off === 4101 && seen.edge === 130, 'wrong piece ' + JSON.stringify(seen)); ok(seen.nbr > 2 * 4099 && seen.nbr <= 2 * 12300, 'wrong links ' + seen.nbr);
    ok(r.card && r.card.k === 4100, 'result not marked as made by the card'); ok(pos(r) !== pos(plain), 'the picture is the processor\'s'); ok(E.stressTuning.external === null, 'hook left behind');
    ok(r.L.nodes.length === 4100, 'wrong size');
  });
  await t('card reports an error: the processor\'s picture comes back, nothing else changes', async () => {
    const c = client(g, { state: 'ready', max: 40000, layout: async () => ({ error: 'out of memory', oom: true }) }); const r = await c.build(opts);
    ok(pos(r) === pos(plain), 'not the processor\'s picture'); ok(!r.card, 'marked as card'); ok(/out of memory/.test(c.cardWhy), 'reason lost'); ok(c.cardOff, 'not switched off after an out-of-memory');
  });
  await t('card throws: the processor\'s picture comes back and the card is switched off', async () => {
    const c = client(g, { state: 'ready', max: 40000, layout: async () => { throw new Error('device lost'); } }); const r = await c.build(opts);
    ok(pos(r) === pos(plain), 'not the processor\'s picture'); ok(c.cardOff, 'still on');
  });
  await t('card larger than it can take (more items than its limit): processor', async () => {
    const c = client(g, { state: 'ready', max: 4000, layout: async () => { throw new Error('should not be asked'); } }); const r = await c.build(opts); ok(pos(r) === pos(plain), 'not the processor\'s picture');
  });
  await t('no usable card (start-up test failed): processor, card never asked', async () => {
    const c = client(g, { state: 'none', why: 'no adapter', layout: async () => { throw new Error('should not be asked'); } }); const r = await c.build(opts); ok(pos(r) === pos(plain), 'not the processor\'s picture');
  });
  await t('small network (4,000 items or fewer): card never asked', async () => {
    let asked = 0; const c = client(small, { state: 'ready', max: 40000, layout: async () => { asked++; return { X: new Float32Array(600) }; } }); const r = await c.build(opts); ok(!asked && r.L.nodes.length === 300, 'card was asked');
  });
  await t('other arrangements never use the card', async () => {
    let asked = 0; const c = client(g, { state: 'ready', max: 40000, layout: async () => { asked++; return { X: new Float32Array(1) }; } }); await c.build({ view: 'network', arrange: 'force' }); ok(!asked, 'card was asked');
  });
  await t('a newer request while the card works: the older one is dropped, the newer one finishes', async () => {
    let n = 0; const slow = { state: 'ready', max: 40000, layout: async (cap) => { n++; await new Promise((r) => setTimeout(r, 300)); return { X: spiral(cap), method: 'sgd' }; } };
    const c = client(g, slow), a = c.build(opts).then(() => 'done', (e) => e.message), b = c.build(opts).then((r) => r, (e) => 'err ' + e.message);
    const [ra, rb] = await Promise.all([a, b]); ok(ra === 'superseded', 'older request: ' + ra); ok(rb && rb.L, 'newer request: ' + (rb && rb.message || rb));
  });
  await t('arrangeAdvice: says what the card will do, and offers best quality above the processor\'s limit', async () => {
    const A = E.arrangeAdvice, none = A('stress', 30000), withCard = A('stress', 30000, { max: 40000 }), best = A('stressBest', 12000, { max: 40000 });
    ok(none.offer === '' && !/graphics card/.test(none.text), 'no card: ' + none.text); ok(withCard.offer === 'stressBest' && /graphics card/.test(withCard.text), 'card: ' + withCard.text); ok(/graphics card/.test(best.text) && best.secs >= 1, 'best: ' + best.text);
    ok(!/graphics card/.test(A('stressBest', 12000, null).text), 'card named without a card'); ok(!/graphics card/.test(A('stress', 100, { max: 40000 }).text), 'small network');
  });
  if (bad) { console.log(bad + ' failed'); process.exit(1); } console.log('card: all passed');
})();
