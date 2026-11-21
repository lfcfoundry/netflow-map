/* Copyright (c) 2026 LFC Foundry. MIT License.
 * Writes src/pack-shapes.js: for each row shape the layout worker sends back (the same fields in the same order, with the same kinds of columns),
 * one hand-written object-literal function that rebuilds the rows. The page allows no code built from text, so without these the rows are made
 * by a generic loop, 4 to 10 times slower (50,000 items with 42 fields: 108-159 ms against 22-35 ms in Chromium, 129-157 against 12-20 in Firefox).
 * A shape that is not listed here still works (the generic loop); test/pack-shapes.test.js fails when a shape the engine makes is missing,
 * and says to run this file again:  node tools/gen-pack-shapes.mjs */
import { createRequire } from 'module';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), req = createRequire(import.meta.url);
const E = req(join(root, 'src/engine.js')), P = req(join(root, 'src/pack.js'));
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
export function sampleGraph(n, m, extra) {
  const g = { start: 'n0', nodes: Array.from({ length: n }, (_, i) => ({ id: 'n' + i, label: i % 7 === 0 ? 'Café ' + i : 'n' + i, group: 'g' + (i % 5), valence: i % 11 === 0 ? 'good' : '', ghost: false, attrs: extra ? { w: i, t: 'x' + (i % 4) } : {} })), edges: [] };
  for (let i = 1; i < n; i++) g.edges.push({ from: 'n' + Math.floor(rnd() * i), to: 'n' + i, label: i % 13 ? '' : 'l' + i, kind: 'k' + (i % 3), attrs: extra ? { q: i } : {}, weight: 1 + i % 9 });
  while (g.edges.length < m) { const a = Math.floor(rnd() * n), b = Math.floor(rnd() * n); if (a !== b) g.edges.push({ from: 'n' + a, to: 'n' + b, label: '', kind: 'k0', attrs: {}, weight: 2 }); }
  return g;
}
/** Every packed row shape the engine makes for a spread of views and options: [{ sig, keys, kinds }]. */
export function collectShapes() {
  const out = new Map(), jobs = [];
  const views = [['network', 'stress'], ['network', 'force'], ['network', 'radial'], ['network', 'closeness'], ['flow', null], ['topdown', null], ['sankey', null]];   /* the views whose layout the engine builds itself; nested and circular views are built on the page and never packed */
  const opts = [{}, { colorBy: 'group', sizeBy: 'weight' }];
  for (const [view, arrange] of views) for (const o of opts) jobs.push([view, arrange, o]);
  const sk = { color: 'target', opacity: 0.45, labels: 'auto', nodeW: 14, pad: 12, justify: true };   /* the Sankey the app asks for carries the netflow-sankey columns on its nodes */
  for (const o of opts) for (const more of [{}, { amounts: true }, { skLite: false }]) jobs.push(['sankey', null, Object.assign({ sk }, o, more)]);
  for (const [view, arrange, o] of jobs) {
    for (const extra of [false, true]) {
      let L; try { const g = sampleGraph(2300, 3200, extra); L = E.build(g, Object.assign({ view, arrange: arrange || undefined }, o)); } catch (e) { continue; }
      if (!L || !Array.isArray(L.nodes)) continue;
      const tr = [], pk = P.packResult(L, tr); if (!pk || pk.__nfmpack !== 1) continue;
      for (const rows of [pk.nodes, pk.edges]) { if (!rows || !rows.cols) continue; const keys = rows.keys, kinds = rows.cols.map((c) => (c.k === 'b' ? 'b' : '.')), sig = P.shapeSig(keys, kinds); if (!out.has(sig)) out.set(sig, { sig, keys, kinds }); }
    }
  }
  return Array.from(out.values()).sort((a, b) => (a.sig < b.sig ? -1 : 1));
}
export function factorySource(s) {
  const lit = s.keys.map((k, i) => JSON.stringify(k) + ':' + (s.kinds[i] === 'b' ? 'c' + i + '[i]===1' : 'c' + i + '[i]'));
  return 'function(c,n,out){var ' + s.keys.map((k, i) => 'c' + i + '=c[' + i + ']').join(',') + ';for(var i=0;i<n;i++)out[i]={' + lit.join(',') + '};return out;}';
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const shapes = collectShapes();
  const body = shapes.map((s) => '  [' + JSON.stringify(s.keys.join('\n')) + ', ' + JSON.stringify(s.kinds.join('')) + ', ' + factorySource(s) + ']').join(',\n');
  const text = '/* Copyright (c) 2026 LFC Foundry. MIT License. Row factories for the layout results the engine sends (made by tools/gen-pack-shapes.mjs: do not edit by hand; run it again when a row gains, loses or reorders a field). */\n' +
    'if (typeof NFMPack !== \'undefined\') NFMPack.addShapes([\n' + body + '\n]);\n';
  writeFileSync(join(root, 'src/pack-shapes.js'), text);
  console.log('wrote src/pack-shapes.js: ' + shapes.length + ' shapes, ' + (text.length / 1024).toFixed(1) + ' KB');
}
