/*!
 * Netflow Map result packing. Copyright (c) 2026 LFC Foundry. MIT License.
 * A big layout is a list of one object per item and one per link. Sending that from the worker to the page as objects makes the
 * browser walk every field of every object twice (once to write, once to rebuild). Here the numbers of each field travel as one typed
 * array, text as one long string plus lengths, and the page rebuilds the objects from the columns. The objects that come out are the
 * same plain objects as before (same fields, same order, same values), so nothing that reads a layout has to change.
 * Only columns that are all numbers, all true/false, all text, or all lists of numbers are packed; anything else (nulls, nested
 * objects, mixed types) travels as it is, so the result is always exactly what the engine made. Small results are not packed.
 */
var NFMPack = (function () {
  'use strict';
  var MIN_ROWS = 2000;

  /** One column of `rows` under `key`, as { k: kind, ... } plus buffers pushed to `tr`; kinds: n (numbers), b (booleans), s (text), l (lists of numbers), a (anything, sent as is). */
  function packColumn(rows, key, tr) {
    var n = rows.length, i, v, t = typeof rows[0][key];
    if (t === 'number') {
      var f = new Float64Array(n);
      for (i = 0; i < n; i++) { v = rows[i][key]; if (typeof v !== 'number') return anyColumn(rows, key); f[i] = v; }
      tr.push(f.buffer); return { k: 'n', d: f };
    }
    if (t === 'boolean') {
      var b = new Uint8Array(n);
      for (i = 0; i < n; i++) { v = rows[i][key]; if (typeof v !== 'boolean') return anyColumn(rows, key); b[i] = v ? 1 : 0; }
      tr.push(b.buffer); return { k: 'b', d: b };
    }
    if (t === 'string') {
      var len = new Int32Array(n), parts = new Array(n), total = 0;
      for (i = 0; i < n; i++) { v = rows[i][key]; if (typeof v !== 'string') return anyColumn(rows, key); len[i] = v.length; parts[i] = v; total += v.length; }
      if (total > 400000000) return anyColumn(rows, key);   // stay well under the longest string a browser allows
      tr.push(len.buffer); return { k: 's', len: len, text: parts.join('') };
    }
    if (Array.isArray(rows[0][key])) {
      var off = new Int32Array(n + 1), cnt = 0, j, a;
      for (i = 0; i < n; i++) {
        a = rows[i][key]; if (!Array.isArray(a)) return anyColumn(rows, key);
        for (j = 0; j < a.length; j++) if (typeof a[j] !== 'number') return anyColumn(rows, key);
        cnt += a.length; off[i + 1] = cnt;
      }
      var flat = new Float64Array(cnt), p = 0;
      for (i = 0; i < n; i++) { a = rows[i][key]; for (j = 0; j < a.length; j++) flat[p++] = a[j]; }
      tr.push(off.buffer, flat.buffer); return { k: 'l', off: off, d: flat };
    }
    return anyColumn(rows, key);
  }
  function anyColumn(rows, key) {
    var n = rows.length, a = new Array(n);
    for (var i = 0; i < n; i++) a[i] = rows[i][key];
    return { k: 'a', d: a };
  }

  /** A list of objects that all have the same fields, as columns; null when the list is small or its objects differ in shape. */
  function packRows(rows, tr) {
    var n = rows.length, i, c;
    if (n < MIN_ROWS || !rows[0] || typeof rows[0] !== 'object' || Array.isArray(rows[0])) return null;
    var keys = Object.keys(rows[0]), K = keys.length;
    if (!K || keys.indexOf('__proto__') >= 0) return null;
    for (i = 0; i < n; i++) { var r = rows[i]; if (!r || typeof r !== 'object' || Object.keys(r).length !== K) return null; }
    var fast = packFast(rows, keys, tr);
    if (fast) return { n: n, keys: keys, cols: fast };
    var cols = [];
    for (c = 0; c < K; c++) cols.push(packColumn(rows, keys[c], tr));
    return { n: n, keys: keys, cols: cols };
  }

  /**
   * The same columns as packColumn makes, filled in one pass over the rows instead of one pass per field: each row is read from memory
   * once, not once per field (37 times for a map item). No code is built from text, so it also runs in a worker under the page's policy.
   * Any row whose field has another type than the first row's gives null, and the column-by-column path decides (the same as before).
   */
  function packFast(rows, keys, tr) {
    var n = rows.length, K = keys.length, kinds = [], c, i;
    for (c = 0; c < K; c++) {
      var v0 = rows[0][keys[c]], t = typeof v0;
      kinds.push(t === 'number' ? 'n' : t === 'boolean' ? 'b' : t === 'string' ? 's' : Array.isArray(v0) ? 'l' : 'a');
      if (kinds[c] === 'a') return null;
    }
    var D = [], L = [], S = [], T = [], O = [], key, v, a, j;
    for (c = 0; c < K; c++) {
      T.push(0);
      D.push(kinds[c] === 'n' ? new Float64Array(n) : kinds[c] === 'b' ? new Uint8Array(n) : null);
      L.push(kinds[c] === 's' ? new Int32Array(n) : null); S.push(kinds[c] === 's' ? new Array(n) : null);
      O.push(kinds[c] === 'l' ? new Int32Array(n + 1) : null);
    }
    var kc = new Int8Array(K);
    for (c = 0; c < K; c++) kc[c] = kinds[c] === 'n' ? 0 : kinds[c] === 'b' ? 1 : kinds[c] === 's' ? 2 : 3;
    for (i = 0; i < n; i++) {
      var r = rows[i], ks = Object.keys(r), vals;
      for (c = 0; c < K; c++) if (ks[c] !== keys[c]) return null;   /* the same fields in the same order: then the values line up with the columns */
      vals = Object.values(r);
      for (c = 0; c < K; c++) {
        v = vals[c];
        switch (kc[c]) {
          case 0: if (typeof v !== 'number') return null; D[c][i] = v; break;
          case 1: if (typeof v !== 'boolean') return null; D[c][i] = v ? 1 : 0; break;
          case 2: if (typeof v !== 'string') return null; L[c][i] = v.length; S[c][i] = v; T[c] += v.length; break;
          default: if (!Array.isArray(v)) return null; for (j = 0; j < v.length; j++) if (typeof v[j] !== 'number') return null; T[c] += v.length; O[c][i + 1] = T[c];
        }
      }
    }
    var cols = [];
    for (c = 0; c < K; c++) {
      if (kinds[c] === 's' && T[c] > 400000000) return null;
    }
    for (c = 0; c < K; c++) {
      var kc = kinds[c];
      if (kc === 'n' || kc === 'b') { tr.push(D[c].buffer); cols.push({ k: kc, d: D[c] }); }
      else if (kc === 's') { tr.push(L[c].buffer); cols.push({ k: 's', len: L[c], text: S[c].join('') }); }
      else {
        var off = O[c], flat = new Float64Array(T[c]), p = 0, key = keys[c];
        for (i = 0; i < n; i++) { var a = rows[i][key]; for (var j = 0; j < a.length; j++) flat[p++] = a[j]; }
        tr.push(off.buffer, flat.buffer); cols.push({ k: 'l', off: off, d: flat });
      }
    }
    return cols;
  }

  /** False on a page whose own security policy leaves out 'unsafe-eval' (the Netflow Map pages): building code from text would only be refused and logged. Node and workers have no page, so they say yes. */
  function evalAllowed() {
    try {
      var m = typeof document === 'object' && document.querySelector && document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      if (m && !/'unsafe-eval'/.test(m.getAttribute('content') || '')) return false;
    } catch (e) { /* no page */ }
    return true;
  }

  /** The text column back as an array of strings. */
  function textOf(col, n) {
    var out = new Array(n), p = 0, len = col.len, s = col.text;
    for (var i = 0; i < n; i++) { out[i] = s.substr(p, len[i]); p += len[i]; }
    return out;
  }
  function listsOf(col, n) {
    var out = new Array(n), off = col.off, d = col.d;
    for (var i = 0; i < n; i++) { var a = new Array(off[i + 1] - off[i]), p = off[i]; for (var j = 0; j < a.length; j++) a[j] = d[p + j]; out[i] = a; }
    return out;
  }

  function unpackRows(P) {
    var n = P.n, keys = P.keys, K = keys.length, cols = new Array(K), c, i, out = new Array(n);
    for (c = 0; c < K; c++) {
      var col = P.cols[c];
      cols[c] = col.k === 's' ? textOf(col, n) : col.k === 'l' ? listsOf(col, n) : col.d;
    }
    var kinds = P.cols.map(function (x) { return x.k; });
    var make = null;
    try {   // one object literal with the fields in the engine's order: the fastest way to build a million alike objects (skipped on a page whose policy has no 'unsafe-eval': the loop below builds the same objects, about 6 times slower in Firefox, 0.5 s for a million)
      if (!evalAllowed()) throw new Error('no eval');
      var names = [], lit = [];
      for (c = 0; c < K; c++) { names.push('c' + c); lit.push(JSON.stringify(keys[c]) + ':' + (kinds[c] === 'b' ? 'c' + c + '[i]===1' : 'c' + c + '[i]')); }
      make = new Function(names.join(','), 'n', 'out', 'for(var i=0;i<n;i++)out[i]={' + lit.join(',') + '};return out;');
    } catch (e) { make = null; }
    if (make) return make.apply(null, cols.concat([n, out]));
    for (i = 0; i < n; i++) {
      var o = {};
      for (c = 0; c < K; c++) o[keys[c]] = kinds[c] === 'b' ? cols[c][i] === 1 : cols[c][i];
      out[i] = o;
    }
    return out;
  }

  /**
   * A layout result as { __nfmpack, nodes, edges, pos, rest }. `pos` (item key -> item object) is sent as keys and item numbers.
   * Buffers to hand over are pushed to `tr`. Results too small to be worth it, or of another shape, come back untouched.
   */
  function packResult(r, tr) {
    if (!r || !Array.isArray(r.nodes) || !Array.isArray(r.edges)) return r;
    var t0 = [], nodes = packRows(r.nodes, t0);
    if (!nodes) return r;
    var edges = packRows(r.edges, t0), pos = null, rest = {}, k;
    if (r.pos && typeof r.pos === 'object') {
      var index = null, i;
      var pk = Object.keys(r.pos), pi = new Int32Array(pk.length), ok = pk.indexOf('__proto__') < 0;
      for (i = 0; ok && i < pk.length; i++) {
        var it = r.pos[pk[i]], at = i < r.nodes.length && r.nodes[i] === it ? i : -1;   /* the usual case: the keys follow the item list, so no lookup table is made */
        if (at < 0) { if (!index) { index = new Map(); for (var q2 = 0; q2 < r.nodes.length; q2++) if (!index.has(r.nodes[q2])) index.set(r.nodes[q2], q2); } at = index.has(it) ? index.get(it) : -1; }
        if (at < 0) { ok = false; break; }
        pi[i] = at;
      }
      if (ok) { pos = { keys: pk, idx: pi }; t0.push(pi.buffer); }
    }
    for (k in r) if (Object.prototype.hasOwnProperty.call(r, k) && k !== 'nodes' && k !== 'edges' && !(pos && k === 'pos')) rest[k] = r[k];
    for (var q = 0; q < t0.length; q++) tr.push(t0[q]);
    return { __nfmpack: 1, nodes: nodes, edges: edges || r.edges, pos: pos, rest: rest };
  }
  function unpackResult(p) {
    if (!p || p.__nfmpack !== 1) return p;
    var out = p.rest, nodes = unpackRows(p.nodes);
    out.nodes = nodes;
    out.edges = p.edges && p.edges.cols ? unpackRows(p.edges) : p.edges;
    if (p.pos) { var pos = {}; for (var i = 0; i < p.pos.keys.length; i++) pos[p.pos.keys[i]] = nodes[p.pos.idx[i]]; out.pos = pos; }
    return out;
  }
  return { packResult: packResult, unpackResult: unpackResult, packRows: packRows, unpackRows: unpackRows };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NFMPack;
