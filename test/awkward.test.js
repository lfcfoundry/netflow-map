/* Copyright (c) 2026 LFC Foundry. MIT License. Awkward-input list: odd numbers and blanks in a table must never crash an importer, the layout or the SVG export, and never put NaN/Infinity into a place, size or picture.
 * Run: node test/awkward.test.js   (about 1 s). "No value" is deliberately NaN in sizeV / colorV / widthV (checked with v === v), so those three are allowed. */
'use strict';
const assert = require('assert'), I = require('../src/importers.js'), C = require('../src/columns.js'), E = require('../src/engine.js'), SC = require('../src/scene.js');
const weights = ['1', '', 'NaN', 'Infinity', '-Infinity', '-5', '0', '1,234.50', '1e308', '1e-320', '  7  ', '١٢', 'abc', '9007199254740993', '0x10'];
const rows = ['source,target,weight,cost'];
weights.forEach((w, i) => rows.push('A' + i + ',B' + i + ',"' + w + '",' + (i % 3 ? '"' + w + '"' : '2')));
rows.push('A0,A0,3,3', ',X,1,1', 'Y,,1,1', 'A1,B0,1,1');   /* a self-loop, a blank source, a blank target, a repeated pair */
const SENTINEL = /^(sizeV|colorV|widthV)$/;
const nonFinite = (L) => { const out = []; [L.nodes || [], L.edges || []].forEach((list, w) => list.forEach((x, i) => { for (const k in x) if (typeof x[k] === 'number' && !Number.isFinite(x[k]) && !SENTINEL.test(k)) out.push((w ? 'edge' : 'node') + i + '.' + k + '=' + x[k]); })); return out; };
(async () => {
  const g0 = await I.importAny([{ name: 'e.csv', text: rows.join('\n') }]), g = g0.graph || g0;
  assert(g.nodes.length > 20 && g.edges.length > 10, 'the awkward table still gives items and links');
  const dg = C.derive(JSON.parse(JSON.stringify(g))); let n = 0;
  for (const view of ['network', 'flow', 'sankey', 'matrix', 'arc']) for (const arrange of (view === 'network' ? ['stress', 'force3d', 'sphere'] : [undefined])) {
    const L = E.build(dg, { view, arrange, colorBy: 'col:cost', sizeBy: 'weight', widthBy: 'weight', edgeColorBy: 'col:cost' }), bad = nonFinite(L);
    assert.strictEqual(bad.length, 0, view + '/' + (arrange || '') + ': non-finite numbers in the layout: ' + bad.slice(0, 3).join(', '));
    const svg = SC.toSvg(SC.make(L, { colorBy: 'col:cost', theme: 'light', plan: true }), 't');
    assert(!/NaN|undefined|Infinity/.test(svg), view + '/' + (arrange || '') + ': NaN / undefined / Infinity written into the SVG'); n++;
  }
  /* control: the checker can fail */
  assert(nonFinite({ nodes: [{ x: NaN }], edges: [] }).length === 1, 'control: a NaN place is caught');
  console.log('ok   awkward numbers: ' + n + ' view/layout combinations, no NaN or Infinity in places, sizes or the SVG');
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
