/* Copyright (c) 2026 LFC Foundry. MIT License. Which blocks of test/browser.test.js a changed file needs (for node test/all.js --changed).
 * Hand-written: a file not listed here, or one that every block uses, gives null = run everything. A release runs everything anyway.
 * test/browser-blocks.test.js checks that every block named here exists in browser.test.js. */
'use strict';
const ALL = null, CHEAP = ['gone', 'linklists'];   /* a few seconds in all; always added */
const MAP = {
  'src/app/10-data.js': ['data', '1', '2', '3'], 'src/app/20-nodes.js': ['data', '1', '2', '3'],
  'src/app/30-map.js': ['views', 'moves', 'big', 'turn3d', '6', 'pan'], 'src/app/32-interact.js': ['views', '7'],
  'src/app/33-sankey.js': ['views', '5'], 'src/app/34-minimap.js': ['views'], 'src/app/35-rail.js': ['views', 'states', '7'],
  'src/app/36-look.js': ['colors', '1'], 'src/app/40-states.js': ['states'],
  'src/app/50-check.js': ['itself', 'states', '8'], 'src/app/60-advanced.js': ['itself', 'states', '8'], 'src/app/61-sim.js': ['states', '8'], 'src/app/62-tune.js': ['itself', '8'],
  'src/app/70-export.js': ['views', 'states', '4'], 'src/app/72-gif.js': ['states', '4'], 'src/app/76-svg.js': ['views', '4'],
  'src/app/75-mapfile.js': ['views', '4', 'undopack', 'keeper', 'safe'],
  'src/render.js': ['views', 'colors', 'moves', 'turn3d', '9', 'pan'], 'src/draw-worker.js': ['views', 'turn3d', '9'],
  'src/engine.js': ['engines', 'views', 'big', '9', 'graphdiff', 'pieces'], 'src/engine-client.js': ['engines', 'big', '9', 'graphdiff', 'keeper', 'pieces'],
  'src/layout-park.js': ['big', 'keeper', 'linklists'], 'src/layoutstore.js': ['itself', 'views'],
  'src/gif.js': ['states', '4'], 'src/gifx.js': ['states', '4'], 'src/gifgl.js': ['states', '4'], 'src/gifkey.js': ['states', '4'], 'src/gif-worker.js': ['states', '4'], 'src/video.js': ['4'],
  'src/undo.js': ['index', 'undopack', '3', '5'], 'src/columns.js': ['data', 'index', '8'], 'src/importers.js': ['data', '1', '3'],
  'src/look.js': ['colors', '1'], 'src/sim.js': ['states', '8'], 'src/check.js': ['itself', 'states'], 'src/tune.js': ['itself', '8'],
  'src/pack.js': ['views', 'undopack'], 'src/unpack.js': ['views', 'undopack'], 'src/field-report-start.js': ['report'], 'src/probe.js': ['itself'], 'src/gpustress.js': ['itself']
};
/* The function map (test/fnmap.json, built by node tools/fnmap.js): which blocks run each function. It narrows a changed file to the blocks of the functions
 * the change sits in, but only when the file is the very version the map was built from (same git blob id) and every changed spot lies wholly inside one
 * function that some block runs and the page start does not; anything else keeps the hand map above. */
let FNMAP = null;
try { FNMAP = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'fnmap.json'), 'utf8')); } catch (e) { FNMAP = null; }
/** The blocks for a changed spot list [[firstLine, lastLine], ...] of the file as it was (old side of the diff), or null for no narrowing. */
function narrow(file, sha, spots) {
  const m = FNMAP && FNMAP.files[file]; if (!m || m.sha !== sha || !spots || !spots.length) return null;
  const out = new Set();
  for (const [a, b] of spots) {
    if (b < a) return null;   /* a pure insertion: no old line to place it in */
    let best = null; for (const f of m.fns) { if (f[0] <= a && f[1] >= b && (!best || f[1] - f[0] < best[1] - best[0])) best = f; }
    if (!best || best[2] === -1 || !best[2].length) return null;
    best[2].forEach((i) => out.add(FNMAP.blocks[i]));
  }
  return Array.from(out);
}
/** Blocks for a list of changed paths: an array (in no special order), or null for everything. Files the browser test does not cover are ignored.
 *  spots (optional): { file: { sha, spots } } from the diff, to narrow a mapped file by function (see narrow). */
function blocksFor(changed, spots) {
  const out = new Set(CHEAP); let any = false;
  for (const c of changed) {
    if (/^(CHANGELOG|README|AGENTS)\.md$|^docs\/|^bench\/|^tools\/fnmap\.js$|^wasm\/.*\.(md|txt)$|^test\/(?!browser\.test\.js$|baseline\.js(on)?$)/.test(c)) continue;
    if (c === 'index.html') continue;   /* built from the sources; their changes say what to run */
    if (!MAP[c]) return ALL;
    any = true; const n = spots && spots[c] ? narrow(c, spots[c].sha, spots[c].spots) : null;
    (n || MAP[c]).forEach((b) => out.add(b));
  }
  return any ? Array.from(out) : [];
}
module.exports = { blocksFor, narrow, MAP, CHEAP };
