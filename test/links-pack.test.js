/* Copyright (c) 2026 LFC Foundry. MIT License. Scene links kept as typed arrays while idle (curveStore in src/scene.js): the objects that come back equal the originals, one link can be read without waking the rest,
 * odd links stop the pack, the idle timer packs in slices, and picking works on a packed scene. Pass/fail only. */
'use strict';
const E = require('../src/engine.js'), SC = require('../src/scene.js'), EX = require('../src/examples.js');
let bad = 0;
const t = (name, fn) => { try { const r = fn instanceof Function && fn.constructor.name === 'AsyncFunction' ? null : fn(); if (r && r.then) return r.then((v) => console.log('ok   ' + name + (v ? ' ' + v : '')), (e) => { bad++; console.log('FAIL ' + name + ': ' + (e && e.message)); }); console.log('ok   ' + name + (r ? ' ' + r : '')); } catch (e) { bad++; console.log('FAIL ' + name + ': ' + e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const scene = (n, arrange) => { const g = EX.bigNetwork(n, 6, 7), L = E.build(g, { view: 'network', arrange: arrange || 'sphere', colorBy: 'group' }); return SC.make(L, { colorBy: 'group', theme: 'light' }); };
const snap = (cs) => cs.map((c) => JSON.stringify(c, (k, v) => typeof v === 'number' ? Math.fround(v) : v));
(async () => {
  await t('packNow keeps every link: same fields, same order, values equal to 32-bit precision', () => {
    const S = scene(900), before = snap(S.curves), n = S.curves.length; ok(n > 500, 'a real map: ' + n + ' links');
    S.curves.forEach((c) => { c.base = { w: c.w, color: c.color }; c.a = 1; });   /* the shape the app gives them after style() */
    const want = snap(S.curves); ok(!S.curvesPacked(), 'objects at first');
    ok(S.packNow(), 'packed'); ok(S.curvesPacked() && S.curveCount() === n, 'count kept while packed');
    const got = snap(S.curves); ok(!S.curvesPacked(), 'reading S.curves makes the objects again');
    for (let i = 0; i < n; i++) ok(got[i] === want[i], 'link ' + i + ' differs:\n' + got[i] + '\n' + want[i]);
    ok(S.curves[0].base.color === S.curves[0].color, 'the base color is still the same array');
    ok(Object.keys(S.curves[3]).join() === 'P,w,color,arrow,line,tip,edge,from,to,dash,base,a', 'field order ' + Object.keys(S.curves[3]).join());
    return n + ' links';
  });
  await t('curveAt and eachCurve read a packed scene without unpacking it', () => {
    const S = scene(900); S.curves.forEach((c) => { c.base = { w: c.w, color: c.color }; c.a = 1; }); const ref = S.curves.map((c) => JSON.stringify(c)); ok(S.packNow(), 'packed');
    const c7 = S.curveAt(7); ok(c7 && c7.edge === S.curveAt(7).edge && S.curvesPacked(), 'one link, still packed'); ok(S.curveAt(-1) === undefined && S.curveAt(1e9) === undefined, 'out of range gives undefined');
    let k = 0; S.eachCurve((c, i) => { ok(c.edge === JSON.parse(ref[i]).edge, 'edge ' + i); k++; }); ok(k === S.curveCount() && S.curvesPacked(), 'streamed ' + k + ', still packed');
  });
  await t('an odd link stops the pack and leaves the objects alone', () => {
    const S = scene(400); S.curves.forEach((c) => { c.base = { w: c.w, color: c.color }; c.a = 1; });
    S.curves[5].color = [1, 0, 0, 1];   /* painted in another color than its base: a selected link */
    ok(!S.packNow() && !S.curvesPacked(), 'refused'); ok(S.curves[5].color[0] === 1, 'objects intact');
    S.curves[5].color = S.curves[5].base.color; S.curves[9].extra = 1; ok(!S.packNow(), 'refused for an unknown field');
  });
  await t('picking an edge works on a packed scene and does not wake the objects', () => {
    const S = scene(900); S.curves.forEach((c) => { c.base = { w: c.w, color: c.color }; c.a = 1; });
    const c = S.curves.find((q) => q.edge >= 0), mx = (c.P[0] + c.P[6]) / 2, my = (c.P[1] + c.P[7]) / 2, a = SC.pickEdge(S, mx, my, 6);
    ok(a && a.edge >= 0, 'found before'); ok(S.packNow(), 'packed'); const b = SC.pickEdge(S, mx, my, 6);
    ok(b && b.edge === a.edge && b.from === a.from && b.to === a.to && b.curve === a.curve, 'same link when packed'); ok(S.curvesPacked(), 'picking left it packed');
  });
  await t('autoPack: packs after the idle time in slices, wakes on a read, packs again, honors hold and alive', async () => {
    const S = scene(900); S.curves.forEach((c) => { c.base = { w: c.w, color: c.color }; c.a = 1; });
    const n0 = S.curves.length; while (S.curves.length < 45000) S.curves.push(Object.assign({}, S.curves[S.curves.length % n0], { P: S.curves[S.curves.length % n0].P.slice() })); /* 45,000 links: three slices */
    S.curves.forEach((c) => { c.base = { w: c.w, color: c.color }; });
    let packed = 0, holdOn = true; S.autoPack({ delay: 30, min: 1000, hold: () => holdOn, packed: () => packed++ });
    await sleep(150); ok(!S.curvesPacked(), 'hold stops the pack'); holdOn = false; await sleep(250); ok(S.curvesPacked() && packed === 1, 'packed after the idle time (' + packed + ')');
    S.curves.length; ok(!S.curvesPacked(), 'a read wakes the objects'); await sleep(250); ok(S.curvesPacked() && packed === 2, 'and they are packed again (' + packed + ')');
    let alive = false; S.autoPack({ delay: 30, min: 1000, alive: () => alive }); S.curves.length; await sleep(200); ok(!S.curvesPacked(), 'a scene that is no longer the shown one is left alone');
    S.autoPack({ delay: 30, min: 100000 }); S.curves.length; await sleep(150); ok(!S.curvesPacked(), 'too few links to bother: ' + S.curveCount());
    return '45,000 links';
  });
  await t('a read during the slices stops that pack (nothing half packed)', async () => {
    const S = scene(900); S.curves.forEach((c) => { c.base = { w: c.w, color: c.color }; c.a = 1; }); const n0 = S.curves.length;
    while (S.curves.length < 60000) S.curves.push(Object.assign({}, S.curves[S.curves.length % n0], { P: S.curves[S.curves.length % n0].P.slice() })); S.curves.forEach((c) => { c.base = { w: c.w, color: c.color }; });
    S.autoPack({ delay: 20, min: 1000 }); await sleep(60); S.curves[0].w = 9; await sleep(20); S.curves[0].w = 9;   /* the write lands while slices run or before them */
    await sleep(300); ok(S.curves[0].w === 9, 'the write survived (' + S.curves[0].w + ')');
  });
  console.log(bad ? bad + ' FAILED' : 'all link-pack checks passed'); process.exit(bad ? 1 : 0);
})();
