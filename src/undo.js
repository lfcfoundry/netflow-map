/*!
 * Netflow Map undo steps: what is kept to go back one change, and the text sharing that makes an imported map smaller.
 * Copyright (c) 2026 LFC Foundry. MIT License. No DOM; runs in the page or in Node.
 *
 * A change made through the app copies the two lists and replaces the objects it changes, so the graph before a change and the graph after it
 * hold almost all the same item and link objects. Keeping the whole old graph kept two full lists of references per step (25 steps of a
 * 100,000-item map: about 75 MB in Node). A step here keeps only what differs from the graph after it: the slots that changed, or the
 * stretch between a common start and a common end. Going back rebuilds the old lists from the current ones. A step whose difference is
 * not small (a new file, a fix that touches everything) keeps the old graph whole, as before.
 */
var NFMUndo = (function () {
  'use strict';
  /** How list a (before) differs from list b (after), by reference. */
  function listDiff(a, b) {
    if (a === b) return { same: true };
    var n = Math.min(a.length, b.length), p = 0, s = 0, i;
    while (p < n && a[p] === b[p]) p++;
    while (s < n - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
    if (a.length === b.length) {   // same length: a short list of changed slots when few changed (a group set on scattered items)
      var at = [], was = [], span = a.length - s - p;
      for (i = p; i < a.length - s; i++) if (a[i] !== b[i]) { at.push(i); was.push(a[i]); if (at.length * 4 > span) break; }
      if (at.length * 4 <= span) return { at: at, was: was };
    }
    return { p: p, s: s, mid: a.slice(p, a.length - s) };
  }
  function listBack(d, b) {
    if (d.same) return b;
    if (d.at) { var a = b.slice(); for (var k = 0; k < d.at.length; k++) a[d.at[k]] = d.was[k]; return a; }
    return b.slice(0, d.p).concat(d.mid, b.slice(b.length - d.s));
  }
  function held(d) { return d.same ? 0 : d.at ? d.at.length : d.mid.length; }
  /** The undo step for going from graph old to graph nu. */
  function step(old, nu) {
    var on = old && old.nodes, oe = old && old.edges;
    if (on && oe && nu && nu.nodes && nu.edges && on.length + oe.length > 64) {
      var dn = listDiff(on, nu.nodes), de = listDiff(oe, nu.edges);
      if ((held(dn) + held(de)) * 4 < on.length + oe.length) {   // under a quarter of the old graph differs: keep the difference
        var m = {}; Object.keys(old).forEach(function (k) { if (k !== 'nodes' && k !== 'edges') m[k] = old[k]; });   /* every other field of the graph, whatever it is */
        return { diff: true, meta: m, nodes: dn, edges: de };
      }
    }
    return { graph: old };
  }
  /** The graph before the change, given the step and the graph after it (the current one). */
  function back(st, cur) {
    if (!st.diff) return st.graph;
    var g = {}; Object.keys(st.meta).forEach(function (k) { g[k] = st.meta[k]; });
    g.nodes = listBack(st.nodes, cur.nodes); g.edges = listBack(st.edges, cur.edges);
    return g;
  }

  /**
   * Text sharing. An imported table makes a new string for every cell, so 300,000 links labeled "step 5" hold 300,000 copies of it. This walks
   * a graph and points each repeated text (labels, groups, kinds, outcomes, extra values) at its first copy; the copies are then garbage.
   * The values stay the same, so nothing that reads them changes. Returns step(n): does about n items, true when the whole graph is done, so
   * the page can run it in short slices while it waits.
   */
  function textSharer(g) {
    var D = Object.create(null), lists = [g.nodes || [], g.edges || []], li = 0, i = 0;
    function one(v) {
      if (typeof v !== 'string' || v.length === 0 || v.length > 200) return v;
      var h = D[v];
      if (h === undefined) { D[v] = v; return v; }
      return h;
    }
    /* always written back: two equal strings are === in JavaScript, so a test cannot tell the first copy from another one */
    function attrs(o) { var a = o.attrs, k, v; if (!a || typeof a !== 'object') return; for (k in a) { v = a[k]; if (typeof v === 'string') a[k] = one(v); } }
    function field(o, f) { var v = o[f]; if (typeof v === 'string') o[f] = one(v); }
    return function (n) {
      while (li < 2 && n > 0) {
        var L = lists[li];
        if (i >= L.length) { li++; i = 0; continue; }
        var o = L[i++]; n--;
        if (!o || typeof o !== 'object') continue;
        if (li === 0) { field(o, 'label'); field(o, 'group'); field(o, 'valence'); } else { field(o, 'label'); field(o, 'kind'); }
        attrs(o);
      }
      if (li >= 2) { D = null; return true; }
      return false;
    };
  }
  return { step: step, back: back, listDiff: listDiff, listBack: listBack, textSharer: textSharer };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NFMUndo;
