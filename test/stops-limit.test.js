/* Copyright (c) 2026 LFC Foundry. MIT License. How big a layered drawing (Flow, Down, Spine, Lanes) the engine will build: pages plus the stand-in stops on long links, up to MAX_STOPS (250,000). A 5,000-page map of about 3 links per page (about 158,000 stops) used to be refused with "too big" and must now be built; one of 8,000 pages (about 367,000 stops) is still refused, with the same plain message the Map tab shows. Pass/fail only (no timing). */
'use strict';
const E = require('../src/engine.js'), C = require('../src/columns.js'), GEN = require('../bench/gen.js');
let bad = 0;
const t = (name, fn) => { const t0 = Date.now(); try { const r = fn(); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)' + (r ? ' ' + r : '')); } catch (e) { bad++; console.log('FAIL ' + name + ': ' + e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m); };
const map = (n) => C.derive(JSON.parse(JSON.stringify(GEN.graph('moderate', n, 11))));
t('a 5,000-page Flow map (about 158,000 stops) is built, not refused', () => {
  const L = E.build(map(5000), { view: 'flow' }); ok(L.nodes.length >= 4900, 'only ' + L.nodes.length + ' boxes'); ok(L.width > 0 && L.height > 0, 'no size');
  return L.nodes.length + ' boxes';
});
t('Spine and Down take the same map', () => {
  for (const view of ['spine', 'down']) { const L = E.build(map(4000), { view }); ok(L.nodes.length >= 3900, view + ': only ' + L.nodes.length + ' boxes'); }
});
t('an 8,000-page map (about 367,000 stops) is still refused, in plain words', () => {
  let err = null; try { E.build(map(8000), { view: 'flow' }); } catch (e) { err = e; }
  ok(err && /too big for a layered drawing/.test(err.message) && /Network view/.test(err.message), 'expected the plain too-big message, got ' + (err && err.message));
});
console.log(bad ? bad + ' failed' : 'all passed'); process.exit(bad ? 1 : 0);
