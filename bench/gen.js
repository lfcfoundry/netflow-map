/* Copyright (c) 2026 LFC Foundry. MIT License. Seeded test-data makers for the benchmarks, shared by Node and the page.
 * Three kinds of structure, by how hard they are for the engine:
 *   simple   a plain tree, one link per item, two columns, no quoting.
 *   moderate communities, about 3 links per item, a weight, a group and a label (a few quoted), a few cross-group links.
 *   complex  hubs (a few items get most links), cycles, self-links, repeated links, 12 columns, quoted text with commas, doubled
 *            quotes and line breaks, four state columns. About 4 links per item. */
var NFMGen = (function () {
  'use strict';
  function rng(seed) { var s = seed | 0; return function () { s = (s + 0x6d2b79f5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  var WORDS = ['alpha', 'beta', 'gamma', 'delta', 'omega', 'north', 'south', 'east', 'west', 'river', 'stone', 'cedar', 'amber', 'quartz', 'harbor', 'summit'];
  /** Calls emit(from, to, weight, srcGroup, tgtGroup, i, r) for every link, in order. */
  function links(kind, n, seed, emit) {
    var r = rng(seed), i, per = Math.max(10, Math.ceil(n / 12));
    if (kind === 'simple') { for (i = 1; i < n; i++) emit(Math.floor((i - 1) / 3), i, 1, 0, 0, i - 1, r); return n - 1; }
    var m = 0;
    if (kind === 'moderate') {
      for (i = 0; i < n; i++) { var c = Math.floor(i / per), d = 2 + Math.floor(r() * 3); for (var q = 0; q < d; q++) { var t = r() < 0.08 ? Math.floor(r() * n) : Math.min(n - 1, c * per + Math.floor(r() * per)); if (t !== i) emit(i, t, Math.round((0.5 + r() * 9.5) * 100) / 100, c, Math.floor(t / per), m++, r); } }
      return m;
    }
    for (i = 0; i < n; i++) {
      var dd = 1 + Math.floor(r() * 7);
      for (var k = 0; k < dd; k++) {
        var u = r(), t2 = u < 0.15 ? Math.floor(r() * r() * r() * Math.min(n, 200)) : u < 0.25 ? Math.max(0, i - 1 - Math.floor(r() * 50)) : Math.min(n - 1, Math.floor(i / per) * per + Math.floor(r() * per * 2));
        if (r() < 0.005) t2 = i;
        var w = Math.round((0.5 + r() * r() * 99.5) * 100) / 100; emit(i, t2, w, Math.floor(i / per), Math.floor(t2 / per), m++, r);
        if (r() < 0.05) emit(i, t2, w, Math.floor(i / per), Math.floor(t2 / per), m++, r);
      }
    }
    return m;
  }
  /** The CSV text. Returns { text, rows, bytes } or { error } when the engine cannot build a string that long. */
  function csv(kind, n, seed) {
    var head = kind === 'simple' ? 'from,to' : kind === 'moderate' ? 'from,to,weight,source_group,label' : 'from,to,weight,kind,source_group,target_group,label,note,s1,s2,s3,s4';
    var chunks = [head], buf = [], rows = 0;
    var flush = function () { chunks.push(buf.join('\n')); buf = []; };
    try {
      links(kind, n, seed, function (a, b, w, gs, gt, i, r) {
        var line;
        if (kind === 'simple') line = 'n' + a + ',n' + b;
        else if (kind === 'moderate') line = 'n' + a + ',n' + b + ',' + w + ',g' + gs + ',' + (r() < 0.06 ? '"hand off, step ' + (i % 9) + '"' : 'step ' + (i % 9));
        else {
          var u = r(), lab = u < 0.3 ? '"ships ""fast"", then slows, #' + (i % 50) + '"' : u < 0.31 ? '"line one\nline two ' + (i % 7) + '"' : WORDS[i % 16] + ' ' + WORDS[(i >> 4) % 16];
          line = 'n' + a + ',n' + b + ',' + w + ',' + (i % 5 ? 'flow' : 'return') + ',g' + gs + ',g' + gt + ',' + lab + ',' + WORDS[i % 16] + ' ' + WORDS[(i * 7) % 16] + ' ' + WORDS[(i * 13) % 16] + ' ' + WORDS[(i * 3) % 16] + ' notes about this link, number ' + i + ',' + Math.round(w * 100) / 100 + ',' + Math.round(w * 1.1 * 100) / 100 + ',' + Math.round(w * 1.25 * 100) / 100 + ',' + Math.round(w * 1.4 * 100) / 100;
        }
        buf.push(line); rows++; if (buf.length >= 50000) flush();
      });
      if (buf.length) flush();
      var text = chunks.join('\n');
      return { text: text, rows: rows, bytes: text.length };
    } catch (e) { return { error: String(e && e.message || e).slice(0, 120), rows: rows }; }
  }
  /** The graph object the engine takes (same shape the importers make), without going through text. */
  function graph(kind, n, seed) {
    var nodes = new Array(n), edges = [], i, per = Math.max(10, Math.ceil(n / 12));
    for (i = 0; i < n; i++) nodes[i] = { id: 'n' + i, label: 'n' + i, group: 'g' + Math.floor(i / per), valence: '', ghost: false, attrs: {} };
    links(kind, n, seed, function (a, b, w) { edges.push({ from: 'n' + a, to: 'n' + b, label: '', kind: '', weight: w, attrs: {} }); });
    return { name: kind + ' ' + n, start: 'n0', nodes: nodes, edges: edges };
  }
  return { rng: rng, links: links, csv: csv, graph: graph, KINDS: ['simple', 'moderate', 'complex'] };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NFMGen;
