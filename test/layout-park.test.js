// Copyright (c) 2026 LFC Foundry. MIT License.
// Node check (pass or fail only, no speed): the layout link park packs a list, reads one link without waking it, brings every link back equal, and refuses lists it cannot copy exactly.
const assert = require('assert'), path = require('path');
global.MemoryCompression = require(path.join(__dirname, '..', 'vendor', 'memory-compression.js'));
const Park = require(path.join(__dirname, '..', 'src', 'layout-park.js'));
function mkEdges(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ from: 'n' + (i % 977), to: 'n' + ((i * 7) % 1013), count: i % 5 === 0 ? 2.5 : 1, flow: Math.sin(i) * 100, widthV: i % 11 === 0 ? NaN : i / 3, orig: [i, i + 1], kind: i % 3 ? 'a' : undefined, neg: i % 13 === 0 ? -0 : 0, pts: i % 17 === 0 ? [1.5, 2.5, 3.5] : undefined });
  return out;
}
function same(a, b) { assert.deepStrictEqual(b, a); }
(function () {
  const L = { nodes: [{ id: 'x' }], edges: mkEdges(60000), n: 1, m: 60000 }, copy = structuredClone(L.edges);
  Park.attach(L, { delay: 1, min: 1 });
  assert.strictEqual(L.parked(), false);
  assert.strictEqual(L.parkNow(), true, 'packed');
  assert.strictEqual(L.parked(), true);
  same(copy[12345], L.edgeAt(12345)); same(copy[59999], L.edgeAt(59999)); same(copy[0], L.edgeAt(0));
  assert.strictEqual(L.parked(), true, 'reading one link leaves the list packed');
  const e = L.edges;
  assert.strictEqual(L.parked(), false, 'reading the list wakes it');
  assert.strictEqual(e.length, copy.length);
  same(copy, e);
  assert.ok(Object.is(e[0].neg, -0) === Object.is(copy[0].neg, -0), 'minus zero kept');
  assert.strictEqual(L.edges, e, 'the same array is handed back while awake');
  e[5].count = 99;
  assert.strictEqual(L.parkNow(), true);
  assert.strictEqual(L.edgeAt(5).count, 99, 'a change made while awake is in the next packed copy');
  L.edges = [{ from: 'a', to: 'b' }];
  assert.strictEqual(L.parked(), false); assert.strictEqual(L.edges.length, 1, 'assigning a new list wakes and replaces');
  const S = { edges: mkEdges(20005), n: 1, m: 20005 }, sc = structuredClone(S.edges);
  Park.attach(S, { delay: 1, min: 1 });
  assert.strictEqual(S.parkNow(), true);
  same(sc[20004], S.edgeAt(20004)); same(sc[19999], S.edgeAt(19999)); same(sc, S.edges);
  const T = { edges: [{ from: 'a', to: 'b' }] };
  Park.attach(T, { delay: 1, min: 1 });
  assert.strictEqual(T.parkNow(), true); same({ from: 'a', to: 'b' }, T.edgeAt(0)); same([{ from: 'a', to: 'b' }], T.edges);
  console.log('layout park: all checks passed');
})();
(async function () {
  const L = { edges: mkEdges(60000), n: 1, m: 60000 }, copy = structuredClone(L.edges);
  Park.attach(L, { delay: 1, min: 1 });
  assert.strictEqual(await L.wakeAsync(), false, 'nothing parked: nothing to wake');
  assert.strictEqual(L.parkNow(), true);
  assert.strictEqual(await L.wakeAsync(), true, 'woken in slices');
  assert.strictEqual(L.parked(), false);
  same(copy, L.edges);
  assert.strictEqual(L.parkNow(), true);
  const p = L.wakeAsync(), p2 = L.wakeAsync();
  assert.strictEqual(p, p2, 'a second call while waking shares the first');
  const e = L.edges;   /* a read in the middle wakes everything at once, as before */
  assert.strictEqual(await p, false, 'the sliced wake gives way to the read');
  same(copy, e); assert.strictEqual(L.edges, e, 'one array, no second copy swapped in');
  console.log('layout park: sliced wake checks passed');
})();
(async function () {   /* parkNow() while the idle pack is part way through (what the 100,000-item bench did): the packed list must stay readable */
  const L = { nodes: [{ id: 'x' }], edges: mkEdges(80000), n: 1, m: 80000 }, copy = structuredClone(L.edges);
  Park.attach(L, { delay: 1, min: 1 });
  await new Promise((r) => setTimeout(r, 1000 + 15));   /* the idle timer starts the background pack at 1 s; it packs one 25,000-link piece per tick */
  assert.strictEqual(L.parkNow(), true, 'parked by hand while the background pack runs');
  await new Promise((r) => setTimeout(r, 300));          /* the background pack reaches its next step */
  assert.strictEqual(L.parked(), true, 'still parked');
  same(copy[0], L.edgeAt(0)); same(copy[79999], L.edgeAt(79999)); assert.strictEqual(L.parkBytes() > 0, true);
  same(copy, L.edges);
  console.log('layout park: hand park during the idle pack checks passed');
})();
