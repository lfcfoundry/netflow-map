/*!
 * Netflow Map link columns: the links of a big map held as number columns (the places of the two ends, a dictionary for the repeated texts,
 * the weights, the extra values) instead of one object per link. Rows are built back on demand (lazyEdges makes S.graph.edges build them the
 * first time anything reads the list). No DOM; runs in the page, the worker or Node.
 * Copyright (c) 2026 LFC Foundry. MIT License.
 *
 *   var L = NFMLinkCols.fromEdges(edges, pos)   // pos: Map id -> item number. Resolves to null when a link is not a plain clean one (the file then keeps links as rows).
 *   var b = NFMLinkCols.toBundle(L)             // JSON-safe: numbers as base64 text, texts as short lists
 *   var L = NFMLinkCols.fromBundle(b)           // back to typed arrays
 *   NFMLinkCols.rows(L, nodes)                  // the row objects, as sanitizeGraph would keep them
 *   NFMLinkCols.lazyEdges(g, L)                 // g.edges now builds its rows on first read; NFMLinkCols.pending(g) is L until then, else null
 */
var NFMLinkCols = (function () {
  'use strict';
  var KEYS = { from: 1, to: 1, label: 1, kind: 1, attrs: 1, weight: 1 };
  var trap = null;   /* debug only: called with the stack when the rows are built */
  function dict() { return { map: new Map(), list: [] }; }
  function idx(d, s) { var i = d.map.get(s); if (i === undefined) { i = d.list.length; d.map.set(s, i); d.list.push(s); } return i; }
  /** Column form of a list of clean links, or null when any link is not one (extra fields, an end that names no item, odd extras). */
  function fromEdges(edges, pos) {
    var n = edges.length, fi = new Int32Array(n), ti = new Int32Array(n), kd = dict(), ld = dict(), kx = new Int32Array(n), lx = new Int32Array(n), w = null, ak = [], akSet = Object.create(null), ac = [], i, e, k, c, a, p, q, hasW = false;
    var akPos = Object.create(null);
    for (i = 0; i < n; i++) {
      e = edges[i];
      if (!e || typeof e.from !== 'string' || typeof e.to !== 'string' || typeof e.label !== 'string' || typeof e.kind !== 'string') return null;
      c = 0; for (k in e) { if (!KEYS[k]) return null; c++; }
      if (c < 5 || c > 6) return null;
      p = pos.get(e.from); q = pos.get(e.to); if (p === undefined || q === undefined) return null;
      fi[i] = p; ti[i] = q; kx[i] = idx(kd, e.kind); lx[i] = idx(ld, e.label);
      if (e.weight !== undefined) {
        if (typeof e.weight !== 'number' || e.weight !== e.weight || e.weight === Infinity || e.weight === -Infinity) return null;
        if (!w) { w = new Float64Array(n); w.fill(NaN); hasW = true; }
        w[i] = e.weight;
      }
      a = e.attrs; if (!a || typeof a !== 'object' || Array.isArray(a)) return null;
      var last = -1;
      for (k in a) {
        var v = a[k], t = typeof v;
        if (t !== 'string' && t !== 'number' && t !== 'boolean') return null;
        if (akPos[k] === undefined) { akPos[k] = ak.length; ak.push(k); ac.push(new Array(n)); }
        if (akPos[k] < last) return null;   /* keys in another order than the first seen: rows could not be built back the same */
        last = akPos[k]; ac[akPos[k]][i] = v;
      }
    }
    return { n: n, fi: fi, ti: ti, kinds: kd.list, kx: kd.list.length > 1 ? kx : null, labels: ld.list, lx: ld.list.length > 1 ? lx : null, w: hasW ? w : null, ak: ak, ac: ac };
  }
  function b64(u8) {
    if (u8.toBase64) return u8.toBase64();
    var s = '', i, Z = 0x8000; for (i = 0; i < u8.length; i += Z) s += String.fromCharCode.apply(null, u8.subarray(i, i + Z));
    return btoa(s);
  }
  function fromB64(s) {
    if (Uint8Array.fromBase64) return Uint8Array.fromBase64(s);
    var bin = atob(s), o = new Uint8Array(bin.length), i; for (i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i); return o;
  }
  function bytesOf(t) { return new Uint8Array(t.buffer, t.byteOffset, t.byteLength); }
  function toBundle(L) {
    var b = { n: L.n, fi: b64(bytesOf(L.fi)), ti: b64(bytesOf(L.ti)), kinds: L.kinds, labels: L.labels, ak: L.ak, ac: L.ac };
    if (L.kx) b.kx = b64(bytesOf(L.kx)); if (L.lx) b.lx = b64(bytesOf(L.lx)); if (L.w) b.w = b64(bytesOf(L.w));
    return b;
  }
  function i32(s, n) { var u = fromB64(s); if (u.length !== n * 4) throw new Error('link columns: wrong length'); return new Int32Array(u.buffer, u.byteOffset, n); }
  function fromBundle(b) {
    if (!b || typeof b.n !== 'number' || b.n < 0 || b.n > 4e7 || !Array.isArray(b.kinds) || !Array.isArray(b.labels) || !Array.isArray(b.ak) || !Array.isArray(b.ac) || b.ak.length !== b.ac.length) throw new Error('link columns: bad file');
    var n = b.n, L = { n: n, fi: i32(b.fi, n), ti: i32(b.ti, n), kinds: b.kinds, labels: b.labels, kx: b.kx ? i32(b.kx, n) : null, lx: b.lx ? i32(b.lx, n) : null, w: null, ak: b.ak, ac: b.ac };
    if (b.w) { var u = fromB64(b.w); if (u.length !== n * 8) throw new Error('link columns: wrong length'); L.w = new Float64Array(u.buffer, u.byteOffset, n); }
    return L;
  }
  /** true when every end is a real item number below nNodes and every dictionary number is inside its list */
  function valid(L, nNodes) {
    var n = L.n, fi = L.fi, ti = L.ti, i, kx = L.kx, lx = L.lx, nk = L.kinds.length, nl = L.labels.length;
    if (nk < 1 || nl < 1) return n === 0;
    for (i = 0; i < n; i++) if (fi[i] < 0 || fi[i] >= nNodes || ti[i] < 0 || ti[i] >= nNodes) return false;
    if (kx) for (i = 0; i < n; i++) if (kx[i] < 0 || kx[i] >= nk) return false;
    if (lx) for (i = 0; i < n; i++) if (lx[i] < 0 || lx[i] >= nl) return false;
    for (i = 0; i < L.ac.length; i++) if (!Array.isArray(L.ac[i]) || L.ac[i].length !== n) return false;
    return true;
  }
  /** The row of link j, as sanitizeGraph would keep it (weight only when there is one). */
  function rowAt(L, nodes, j) {
    var e, w = L.w ? L.w[j] : NaN, ak = L.ak, a = {}, q;
    for (q = 0; q < ak.length; q++) { var v = L.ac[q][j]; if (v !== undefined && v !== null) a[ak[q]] = v; }   /* a hole in a column reads back from the file as null */
    var lab = L.labels[L.lx ? L.lx[j] : 0], kind = L.kinds[L.kx ? L.kx[j] : 0];
    if (w === w) e = { from: nodes[L.fi[j]].id, to: nodes[L.ti[j]].id, label: lab, weight: w, kind: kind, attrs: a };
    else e = { from: nodes[L.fi[j]].id, to: nodes[L.ti[j]].id, label: lab, kind: kind, attrs: a };
    return e;
  }
  function rows(L, nodes) {
    var n = L.n, out = new Array(n), j;
    for (j = 0; j < n; j++) out[j] = rowAt(L, nodes, j);
    return out;
  }
  function plain(g, v) { Object.defineProperty(g, 'edges', { value: v, writable: true, enumerable: true, configurable: true }); }
  /** Makes g.edges build its rows (from the columns L and g.nodes as they are now) the first time it is read; g.nodes must not change until then (a new graph made from g holds its own list). */
  function lazyEdges(g, L) {
    var nodes = g.nodes;
    Object.defineProperty(g, 'lc', { value: L, enumerable: false, writable: true, configurable: true });
    Object.defineProperty(g, 'edges', {
      enumerable: true, configurable: true,
      get: function () { if (trap) trap(new Error('rows').stack); var v = rows(L, nodes); plain(g, v); g.lc = null; return v; },
      set: function (v) { plain(g, v); g.lc = null; }
    });
    return g;
  }
  /** The link columns of g while its rows are not built yet, else null. */
  function pending(g) { return g && g.lc ? g.lc : null; }
  return { fromEdges: fromEdges, toBundle: toBundle, fromBundle: fromBundle, valid: valid, rows: rows, rowAt: rowAt, lazyEdges: lazyEdges, pending: pending, setTrap: function (f) { trap = f; } };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NFMLinkCols;
