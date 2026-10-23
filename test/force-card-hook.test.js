/* Copyright (c) 2026 LFC Foundry. MIT License. The hook that lets the graphics card do the Force rounds of a big piece: the engine hands over the start, springs and masses, takes the card's positions, and goes on with its own clean-up; a hook that declines changes nothing. */
'use strict';
const E = require('../src/engine.js'), C = require('../src/columns.js'), GEN = require('../bench/gen.js');
let bad = 0;
const t = (name, fn) => { const t0 = Date.now(); try { const r = fn(); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)' + (r ? ' ' + r : '')); } catch (e) { bad++; console.log('FAIL ' + name + ': ' + e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m); };
const map = () => C.derive(JSON.parse(JSON.stringify(GEN.graph('moderate', 3000, 11))));
const xy = (L) => L.nodes.map((n) => n.x.toFixed(3) + ',' + n.y.toFixed(3)).join(';');
const plain = E.build(map(), { view: 'network', arrange: 'force' });
t('a hook that declines changes nothing', () => {
  let seen = null; E.forceExt.external = (X, k, pairs, mass, rounds) => { seen = { k, m: pairs.length / 2, rounds, massLen: mass.length, finite: X.every(Number.isFinite) }; return false; };
  let L; try { L = E.build(map(), { view: 'network', arrange: 'force' }); } finally { E.forceExt.external = null; }
  ok(seen && seen.k > 2000 && seen.m >= seen.k - 1 && seen.massLen === seen.k && seen.finite && seen.rounds === 240, 'hook saw ' + JSON.stringify(seen));
  ok(xy(L) === xy(plain), 'a declining hook changed the picture');
  return seen.k + ' items, ' + seen.m + ' links, ' + seen.rounds + ' rounds';
});
t('positions handed back by the hook are the ones the engine builds from', () => {
  E.forceExt.external = (X, k) => { for (let i = 0; i < 2 * k; i++) X[i] = X[i] * 3; return true; };
  let L; try { L = E.build(map(), { view: 'network', arrange: 'force' }); } finally { E.forceExt.external = null; }
  ok(xy(L) !== xy(plain), 'the hook had no effect');
  ok(L.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y)), 'a position is not a number');
});
t('a picture made with the hook is never saved under the processor\'s key', () => {
  E.forceExt.external = () => false; let k; try { k = E.layoutKey(map(), { view: 'network', arrange: 'force' }); } finally { E.forceExt.external = null; }
  ok(k === null, 'key was ' + k);
  ok(E.layoutKey(map(), { view: 'network', arrange: 'force', forcePicture: { k: 1 } }) === null, 'a forcePicture build has a key');
});
console.log(bad ? bad + ' failed' : 'all passed'); process.exit(bad ? 1 : 0);
