// Copyright (c) 2026 LFC Foundry. MIT License. Writes a copy of src/gif.js with performance.now laps added (palette phases, and per picture the mapping and compressing time).
// node bench/gif-instrument.mjs <out.js>   Used by gif-profile.sh; the suite 'gifprof' in suites.js reads the laps from window.__laps.
import fs from 'fs';
let g = fs.readFileSync(new URL('../src/gif.js', import.meta.url), 'utf8');
const rep = (a, b) => { if (!g.includes(a)) throw new Error('gif.js changed; cannot instrument: ' + a.slice(0, 50)); g = g.replace(a, () => b); };
rep('  function makePalette(pictures, maxColors) {', "  function makePalette(pictures, maxColors) {\n    var __T = performance.now(), __lap = function (n) { var t = performance.now(); (window.__laps = window.__laps || []).push([n, t - __T]); __T = t; };");
rep('    keys = cnts = null;\n', "    __lap('histogram'); keys = cnts = null;\n");
rep('    var K = boxes.length, cr', "    __lap('mediancut'); var K = boxes.length, cr");
rep('    var out = [];\n    for (var k4', "    __lap('kmeans'); var out = [];\n    for (var k4");
rep('      add: function (rgba, delayMs) {\n', '      add: function (rgba, delayMs) {\n        var __a = performance.now();\n');
rep("        frames.push({ x: x0, y: y0, w: fw, h: fh, delay: delayMs, trans: frames.length > 0, code: lzw(data, 8) });", "        var __b = performance.now(), __code = lzw(data, 8), __c = performance.now(); (window.__laps = window.__laps || []).push(['add_map_diff', __b - __a], ['add_lzw', __c - __b]);\n        frames.push({ x: x0, y: y0, w: fw, h: fh, delay: delayMs, trans: frames.length > 0, code: __code });");
fs.writeFileSync(process.argv[2], g);
