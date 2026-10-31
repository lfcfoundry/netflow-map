/*!
 * Netflow Map check: looks hard at the data and says what is broken, what looks wrong, what looks odd, and what is interesting.
 * Builds on the Story Editor's checker (dead ends, unreachable items, traps) and adds data checks: spellings, categories, numbers,
 * outliers, flow that does not add up, odds that do not add to 100%, jumps between states.
 * Every finding says how sure it is, shows the rows behind it, and may offer a fix. No DOM; runs in the page, a worker or Node.
 * Copyright (c) 2026 LFC Foundry. MIT License.
 */
var NFMCheck = (function () {
  'use strict';
  var C = typeof NFMColumns !== 'undefined' ? NFMColumns : require('./columns.js');
  var E = typeof NFMEngine !== 'undefined' ? NFMEngine : require('./engine.js');
  var MAX_ROWS = 12;

  /* ---------------------------------------------------------------- small tools */
  function now() { return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now(); }
  function norm(s) {
    s = String(s === undefined || s === null ? '' : s);
    try { s = s.normalize('NFKD').replace(/[̀-ͯ]/g, ''); } catch (e) { /* old engines */ }
    return s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9Ѐ-ӿ一-鿿]+/g, '');
  }
  function plural(n, one, many) { return n === 1 ? one : (many || one + 's'); }
  var NF = typeof Intl !== 'undefined' && Intl.NumberFormat ? new Intl.NumberFormat('en-US') : null;   /* kept: toLocaleString with a locale builds its rules on every call */
  function nf(n) { return NF ? NF.format(Number(n)) : Number(n).toLocaleString('en-US'); }
  function median(sorted) { var n = sorted.length; return n ? (n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2) : NaN; }
  function pickRows(rows, n) { return rows.length > n ? rows.slice(0, n) : rows; }
  function trimmedEq(a, b) { return String(a) === String(b); }
  /** Do these two strings differ by at most one edit (insert, delete, swap two neighbors, change)? */
  function within1(a, b) {
    if (a === b) return true;
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    var i = 0;
    while (i < la && i < lb && a.charAt(i) === b.charAt(i)) i++;
    if (la === lb) {
      if (a.slice(i + 1) === b.slice(i + 1)) return true;
      return a.charAt(i) === b.charAt(i + 1) && a.charAt(i + 1) === b.charAt(i) && a.slice(i + 2) === b.slice(i + 2);
    }
    return la > lb ? a.slice(i + 1) === b.slice(i) : b.slice(i + 1) === a.slice(i);
  }
  /** Groups of near-identical strings: same after cleaning (spelling variants), or one typo apart. */
  function nearGroups(values) {
    var byNorm = new Map(), out = [];
    values.forEach(function (v) { var k = norm(v.value); if (!k) return; if (!byNorm.has(k)) byNorm.set(k, []); byNorm.get(k).push(v); });
    var keys = Array.from(byNorm.keys());
    byNorm.forEach(function (list) { if (list.length > 1) out.push({ kind: 'spelling', members: list }); });
    if (keys.length > 20000) return out;
    var del = new Map();
    keys.forEach(function (k, ki) {
      if (k.length < 5) return;
      var mine = new Set(); mine.add(k);
      for (var i = 0; i < k.length; i++) mine.add(k.slice(0, i) + k.slice(i + 1));
      mine.forEach(function (d) { if (!del.has(d)) del.set(d, []); del.get(d).push(ki); });
    });
    var seen = new Set();
    del.forEach(function (idxs) {
      if (idxs.length < 2 || idxs.length > 8) return;
      for (var a = 0; a < idxs.length; a++) for (var b = a + 1; b < idxs.length; b++) {
        var ka = keys[idxs[a]], kb = keys[idxs[b]], id = idxs[a] < idxs[b] ? idxs[a] + ',' + idxs[b] : idxs[b] + ',' + idxs[a];
        if (ka === kb || seen.has(id) || !within1(ka, kb) || /^\d+$/.test(ka) || /^\d+$/.test(kb) || ka.replace(/\d+/g, '') === kb.replace(/\d+/g, '')) continue;
        seen.add(id);
        out.push({ kind: 'typo', members: byNorm.get(ka).concat(byNorm.get(kb)) });
      }
    });
    return out;
  }

  /* ---------------------------------------------------------------- the graph as arrays */
  function arrays(g) {
    var n = g.nodes.length, idx = new Map(), i;
    for (i = 0; i < n; i++) if (!idx.has(g.nodes[i].id)) idx.set(g.nodes[i].id, i);
    var m = g.edges.length, from = new Int32Array(m).fill(-1), to = new Int32Array(m).fill(-1), w = new Float64Array(m).fill(NaN), outs = new Array(n), ins = new Array(n);
    for (i = 0; i < n; i++) { outs[i] = []; ins[i] = []; }
    for (i = 0; i < m; i++) {
      var e = g.edges[i], a = idx.get(e.from), b = idx.get(e.to);
      w[i] = C.num(e.weight);
      if (a === undefined || b === undefined) continue;
      from[i] = a; to[i] = b; outs[a].push(i); ins[b].push(i);
    }
    return { n: n, m: m, idx: idx, from: from, to: to, w: w, outs: outs, ins: ins };
  }
  function sccs(A) {
    var n = A.n, index = new Int32Array(n).fill(-1), low = new Int32Array(n), on = new Uint8Array(n), comp = new Int32Array(n).fill(-1), stack = [], counter = 0, nc = 0, it = new Int32Array(n), call = [];
    for (var s = 0; s < n; s++) {
      if (index[s] >= 0) continue;
      call.push(s); index[s] = low[s] = counter++; stack.push(s); on[s] = 1;
      while (call.length) {
        var v = call[call.length - 1];
        if (it[v] < A.outs[v].length) {
          var e = A.outs[v][it[v]++], w = A.to[e];
          if (w < 0) continue;
          if (index[w] < 0) { index[w] = low[w] = counter++; stack.push(w); on[w] = 1; call.push(w); }
          else if (on[w] && index[w] < low[v]) low[v] = index[w];
        } else {
          if (low[v] === index[v]) { var x; do { x = stack.pop(); on[x] = 0; comp[x] = nc; } while (x !== v); nc++; }
          call.pop();
          if (call.length) { var p = call[call.length - 1]; if (low[v] < low[p]) low[p] = low[v]; }
        }
      }
    }
    return { comp: comp, count: nc };
  }
  function weakComponents(A) {
    var par = new Int32Array(A.n), i;
    for (i = 0; i < A.n; i++) par[i] = i;
    var find = function (x) { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    for (i = 0; i < A.m; i++) if (A.from[i] >= 0) { var a = find(A.from[i]), b = find(A.to[i]); if (a !== b) par[a] = b; }
    var map = new Map(), comp = new Int32Array(A.n), list = [];
    for (i = 0; i < A.n; i++) { var r = find(i); if (!map.has(r)) { map.set(r, list.length); list.push([]); } comp[i] = map.get(r); list[comp[i]].push(i); }
    return { comp: comp, list: list };
  }

  /* ---------------------------------------------------------------- the findings */
  function F(list, f) { f.rows = f.rows || []; f.items = f.items || []; f.links = f.links || []; f.count = f.count === undefined ? (f.items.length + f.links.length || f.rows.length) : f.count; list.push(f); return f; }
  function idLabel(g, i) { var n = g.nodes[i]; return n ? (n.label && n.label !== n.id ? n.label + ' (' + n.id + ')' : n.id) : '?'; }

  /**
   * Runs every check. Returns { findings, stats, verdict, ms, skipped }.
   * finding: { id, sev: 'error'|'warn'|'note'|'insight', sure: 'certain'|'likely'|'possible', title, text, why, rows, items, links, fix, count }
   */
  function run(g, opts) {
    opts = opts || {};
    var t0 = now(), budget = opts.budgetMs || 4000, skipped = [], list = [], A = arrays(g), prof = C.profile(g), story = C.isStory(g);
    var late = function (what) { if (now() - t0 > budget) { skipped.push(what); return true; } return false; };
    var n = A.n, m = A.m, i, k;

    if (!n) { F(list, { id: 'empty', sev: 'error', sure: 'certain', title: 'There is no data', text: 'Nothing has been brought in yet.', why: 'Bring in a table, JSON, an outline or notes on the Data tab.' }); return finish(g, list, prof, A, t0, skipped); }
    if (!m) F(list, { id: 'nolinks', sev: 'error', sure: 'certain', title: 'There are no links', text: nf(n) + ' ' + plural(n, 'item has', 'items have') + ' no links between them, so there is nothing to draw but dots.', why: 'Maps show how items connect. Check that the From and To columns were read correctly (Data tab, step 2).' });

    /* ---------- links that do not connect ---------- */
    var broken = [];
    for (i = 0; i < m; i++) if (A.from[i] < 0) broken.push(i);
    if (broken.length) F(list, { id: 'brokenlinks', sev: 'error', sure: 'certain', title: nf(broken.length) + ' ' + plural(broken.length, 'link points', 'links point') + ' at an item that does not exist', text: 'These links name an item that is not in the item list.', why: 'They cannot be drawn. A spelling difference between the links and the items is the usual cause.', links: broken, rows: pickRows(broken, MAX_ROWS).map(function (e) { return { 'From': g.edges[e].from, 'To': g.edges[e].to }; }) });

    /* ---------- duplicates and self-links ---------- */
    var selfL = [], dupL = [], seenL = new Map();
    for (i = 0; i < m; i++) {
      if (A.from[i] < 0) continue;
      if (A.from[i] === A.to[i]) selfL.push(i);
      var key = A.from[i] + '>' + A.to[i] + '>' + (g.edges[i].kind || '');
      if (seenL.has(key)) dupL.push(i); else seenL.set(key, i);
    }
    if (selfL.length) F(list, { id: 'selflinks', sev: 'warn', sure: 'certain', title: nf(selfL.length) + ' ' + plural(selfL.length, 'item links', 'items link') + ' to itself', text: 'A link that starts and ends at the same item.', why: 'Often a data-entry slip (the same name in both columns). Real self-loops exist (an item that repeats), so this is only a warning.', links: selfL, rows: pickRows(selfL, MAX_ROWS).map(function (e) { return { 'Item': g.edges[e].from, 'Weight': g.edges[e].weight === undefined ? '' : g.edges[e].weight }; }), fix: { id: 'dropSelf', label: 'Remove these links' } });
    if (dupL.length) {
      var same = 0, conflict = [];
      dupL.forEach(function (e) { var f = seenL.get(A.from[e] + '>' + A.to[e] + '>' + (g.edges[e].kind || '')); if (C.num(g.edges[e].weight) === C.num(g.edges[f].weight)) same++; else conflict.push(e); });
      F(list, { id: 'duplinks', sev: same ? 'warn' : 'note', sure: 'certain', title: nf(dupL.length) + ' repeated ' + plural(dupL.length, 'link'), text: 'The same from-and-to pair appears more than once' + (conflict.length ? ' (' + nf(conflict.length) + ' with a different weight)' : ' with the same weight') + '.', why: same ? 'Exact repeats usually mean the row was pasted twice and will double-count any totals.' : 'Repeats with different weights may be separate periods or transactions (fine) or a conflict (not fine).', links: dupL, rows: pickRows(dupL, MAX_ROWS).map(function (e) { var f = seenL.get(A.from[e] + '>' + A.to[e] + '>' + (g.edges[e].kind || '')); return { 'From': g.edges[e].from, 'To': g.edges[e].to, 'Weight': g.edges[e].weight === undefined ? '' : g.edges[e].weight, 'First seen with': g.edges[f].weight === undefined ? '' : g.edges[f].weight }; }), fix: same ? { id: 'dropDupLinks', label: 'Remove exact repeats' } : null });
    }

    /* ---------- names ---------- */
    var dirty = [], hidden = [], moji = [], formula = [];
    for (i = 0; i < n; i++) {
      var nd = g.nodes[i], fields = [nd.id, nd.label, nd.group];
      for (k = 0; k < fields.length; k++) {
        var s = fields[k];
        if (typeof s !== 'string' || !s) continue;
        if (s !== s.trim() || /\s{2,}/.test(s)) { dirty.push(i); break; }
      }
      if (/[​-‍⁠﻿­]/.test(nd.id + (nd.label || ''))) hidden.push(i);
      if (/�|Ã.|â€/.test(nd.id + (nd.label || '') + (nd.group || ''))) moji.push(i);
      if (/^[=+\-@]/.test(nd.label || '') && isNaN(C.num(nd.label))) formula.push(i);
    }
    if (dirty.length) F(list, { id: 'spaces', sev: 'warn', sure: 'certain', title: nf(dirty.length) + ' ' + plural(dirty.length, 'name has', 'names have') + ' extra spaces', text: 'Spaces at the start or end of a name, or doubled inside it.', why: 'Two names that look identical are treated as different items, which splits one thing into two.', items: dirty.map(function (x) { return g.nodes[x].id; }), rows: pickRows(dirty, MAX_ROWS).map(function (x) { return { 'Name': '"' + g.nodes[x].id + '"', 'Label': '"' + (g.nodes[x].label || '') + '"' }; }), fix: { id: 'trim', label: 'Trim the spaces' } });
    if (hidden.length) F(list, { id: 'hiddenchars', sev: 'warn', sure: 'certain', title: nf(hidden.length) + ' ' + plural(hidden.length, 'name contains', 'names contain') + ' invisible characters', text: 'Zero-width or soft-hyphen characters hide inside these names.', why: 'They make identical-looking names differ, so links may miss their items.', items: hidden.map(function (x) { return g.nodes[x].id; }), fix: { id: 'trim', label: 'Remove them' } });
    if (moji.length) F(list, { id: 'mojibake', sev: 'warn', sure: 'likely', title: nf(moji.length) + ' ' + plural(moji.length, 'name looks', 'names look') + ' garbled', text: 'Characters like Ã© or ï¿½ usually mean the file was saved in one text encoding and read in another.', why: 'The labels will show gibberish. Re-save the source as UTF-8.', items: moji.map(function (x) { return g.nodes[x].id; }), rows: pickRows(moji, MAX_ROWS).map(function (x) { return { 'Name': g.nodes[x].id }; }) });
    if (formula.length) F(list, { id: 'formulacells', sev: 'note', sure: 'certain', title: nf(formula.length) + ' ' + plural(formula.length, 'label starts', 'labels start') + ' with = + - or @', text: 'Spreadsheet programs may treat these cells as formulas when you open an exported CSV.', why: 'The app neutralizes them on export, but check the source.', items: formula.map(function (x) { return g.nodes[x].id; }) });

    var byLabel = new Map();
    for (i = 0; i < n; i++) { var lb = (g.nodes[i].label || g.nodes[i].id); if (!byLabel.has(lb)) byLabel.set(lb, []); byLabel.get(lb).push(i); }
    var sameLabel = [];
    byLabel.forEach(function (l, lb) { if (l.length > 1) sameLabel.push([lb, l]); });
    if (sameLabel.length) F(list, { id: 'duplabels', sev: 'warn', sure: 'likely', title: nf(sameLabel.length) + ' ' + plural(sameLabel.length, 'name is', 'names are') + ' used by more than one item', text: 'Different items share the same label, so the map cannot tell them apart by eye.', why: 'Either they are really the same thing (merge them) or they need more specific labels.', items: [].concat.apply([], sameLabel.map(function (x) { return x[1].map(function (j) { return g.nodes[j].id; }); })), rows: pickRows(sameLabel, MAX_ROWS).map(function (x) { return { 'Label': x[0], 'Ids': x[1].slice(0, 4).map(function (j) { return g.nodes[j].id; }).join(', '), 'Items': x[1].length }; }), fix: { id: 'mergeSameLabel', label: 'Merge items with the same label' } });

    if (!late('similar names')) {
      var vals = [], seenV = new Set();
      g.nodes.forEach(function (nd2) { var lb2 = nd2.label || nd2.id; if (!seenV.has(lb2)) { seenV.add(lb2); vals.push({ value: lb2, id: nd2.id, n: 1 }); } });
      if (vals.length <= 40000) {
        var ng = nearGroups(vals).filter(function (x) { return x.members.length >= 2; });
        if (ng.length) F(list, { id: 'similarnames', sev: 'warn', sure: ng.some(function (x) { return x.kind === 'spelling'; }) ? 'likely' : 'possible', title: nf(ng.length) + ' ' + plural(ng.length, 'pair') + ' of names look like the same thing spelled differently', text: 'Names that match after ignoring case, accents and punctuation, or differ by one letter.', why: 'A typo splits one item into two, each with half its links. Check each pair; some are genuinely different.', items: [].concat.apply([], ng.slice(0, 200).map(function (x) { return x.members.map(function (y) { return y.id; }); })), rows: pickRows(ng, MAX_ROWS).map(function (x) { return { 'Names': x.members.slice(0, 3).map(function (y) { return y.value; }).join('  /  '), 'Why': x.kind === 'spelling' ? 'same after cleaning' : 'one letter apart' }; }) });
      }
    }

    /* ---------- reaching, trapping, structure ---------- */
    var P = null, imp = null;
    try { P = E.prepare(g, {}); imp = E.importance(P); } catch (err) { skipped.push('structure (' + err.message + ')'); }
    var wc = weakComponents(A);
    if (wc.list.length > 1 && m) {
      var sorted = wc.list.slice().sort(function (a, b) { return b.length - a.length; }), small = sorted.slice(1).filter(function (x) { return x.length < Math.max(2, n * 0.02) || true; });
      var singles = small.filter(function (x) { return x.length === 1; }).length;
      F(list, { id: 'pieces', sev: singles / n > 0.2 ? 'warn' : 'note', sure: 'certain', title: 'The data falls into ' + nf(wc.list.length) + ' separate pieces', text: 'The biggest has ' + nf(sorted[0].length) + ' items' + (singles ? '; ' + nf(singles) + ' items are on their own with no links at all' : '') + '.', why: 'Pieces that never connect are drawn side by side. If they should be connected, a link or a name is missing or misspelled.', items: [].concat.apply([], sorted.slice(1, 20).map(function (x) { return x.slice(0, 10).map(function (j) { return g.nodes[j].id; }); })), rows: pickRows(sorted, MAX_ROWS).map(function (x, r) { return { 'Piece': r + 1, 'Items': x.length, 'Example': idLabel(g, x[0]) }; }) });
    }
    var isolated = [];
    for (i = 0; i < n; i++) if (!A.outs[i].length && !A.ins[i].length) isolated.push(i);
    if (isolated.length && m) F(list, { id: 'isolated', sev: 'warn', sure: 'certain', title: nf(isolated.length) + ' ' + plural(isolated.length, 'item has', 'items have') + ' no links at all', text: 'They appear in the item list but nothing links to or from them.', why: 'Either they are not part of this map, or their links are misspelled somewhere.', items: isolated.map(function (x) { return g.nodes[x].id; }), rows: pickRows(isolated, MAX_ROWS).map(function (x) { return { 'Item': idLabel(g, x) }; }), fix: { id: 'dropIsolated', label: 'Remove them' } });
    var ghosts = g.nodes.filter(function (x) { return x.ghost; });
    if (ghosts.length) F(list, { id: 'ghosts', sev: 'warn', sure: 'certain', title: nf(ghosts.length) + ' ' + plural(ghosts.length, 'item is', 'items are') + ' named in links but never described', text: 'They were created as placeholders because a link mentions them.', why: 'In a notes folder this means a [[link]] to a note that does not exist. In a table it can mean a typo in a From or To cell.', items: ghosts.map(function (x) { return x.id; }), rows: pickRows(ghosts, MAX_ROWS).map(function (x) { return { 'Name': x.id }; }) });

    if (P && imp && P.start >= 0 && m) {
      var unreached = [];
      for (i = 0; i < P.n; i++) if (imp.depth[i] < 0) unreached.push(i);
      if (unreached.length && unreached.length < P.n) F(list, { id: 'unreached', sev: story ? 'error' : 'note', sure: 'certain', title: nf(unreached.length) + ' ' + plural(unreached.length, 'item') + ' cannot be reached from the start' + (P.autoStart ? ' (picked automatically: ' + P.nodes[P.start].label + ')' : ''), text: 'Following the links forward from "' + P.nodes[P.start].label + '" never gets there.', why: story ? 'Players can never see these pages.' : 'They may have their own source (a second starting point) or the links may point the wrong way. Set the start item in the Data tab if the automatic pick is wrong.', items: unreached.map(function (x) { return P.nodes[x].id; }), rows: pickRows(unreached, MAX_ROWS).map(function (x) { return { 'Item': idLabel(g, P.nodes[x] ? g.nodes.indexOf(P.nodes[x]) : 0) }; }) });
    }
    var sc = sccs(A), compSize = new Int32Array(sc.count), compExit = new Uint8Array(sc.count);
    for (i = 0; i < n; i++) compSize[sc.comp[i]]++;
    for (i = 0; i < m; i++) if (A.from[i] >= 0 && sc.comp[A.from[i]] !== sc.comp[A.to[i]]) compExit[sc.comp[A.from[i]]] = 1;
    var trapped = [], loopsBig = [];
    for (i = 0; i < sc.count; i++) if (compSize[i] > 1 && !compExit[i] && (story || compSize[i] <= n * 0.5)) trapped.push(i);
    if (trapped.length && P && imp && P.start >= 0) {
      var tr = trapped.filter(function (c) { for (var q = 0; q < n; q++) if (sc.comp[q] === c) { var pi = P.index.get(g.nodes[q].id); if (pi !== undefined && imp.depth[pi] >= 0) return true; } return false; });
      if (tr.length) {
        var tItems = []; for (i = 0; i < n; i++) if (tr.indexOf(sc.comp[i]) >= 0) tItems.push(i);
        F(list, { id: 'traps', sev: story ? 'error' : 'warn', sure: 'certain', title: nf(tr.length) + ' ' + plural(tr.length, 'loop has', 'loops have') + ' no way out', text: 'Once flow enters ' + (tr.length === 1 ? 'this loop' : 'one of these loops') + ' it can only go round and round (' + nf(tItems.length) + ' items).', why: story ? 'A player who gets in can never finish.' : 'Walkers and flow enter and never reach an end. If the data should drain somewhere, a link out is missing.', items: tItems.map(function (x) { return g.nodes[x].id; }), rows: pickRows(tItems, MAX_ROWS).map(function (x) { return { 'Item': idLabel(g, x) }; }) });
      }
    }
    var back = [];
    if (P && P.start >= 0 && imp) {
      /* links that go "backward" in a graph that is otherwise a one-way flow */
      var st = new Uint8Array(P.n), it2 = new Int32Array(P.n), stack = [P.start]; st[P.start] = 1;
      while (stack.length) {
        var v = stack[stack.length - 1];
        if (it2[v] < P.outStart[v + 1] - P.outStart[v]) {
          var e2 = P.outEdge[P.outStart[v] + it2[v]++], w2 = P.to[e2];
          if (st[w2] === 1) back.push(P.eorig[e2]); else if (!st[w2]) { st[w2] = 1; stack.push(w2); }
        } else { st[v] = 2; stack.pop(); }
      }
      if (back.length && back.length <= Math.max(3, m * 0.03)) F(list, { id: 'backlinks', sev: story ? 'note' : 'warn', sure: 'possible', title: nf(back.length) + ' ' + plural(back.length, 'link goes', 'links go') + ' backward in an otherwise one-way flow', text: 'Everything else moves forward from the start; these links close a loop.', why: 'In data meant to flow one way (stages, time, supply chains), a link that returns is often a reversed From/To or a wrong name. Real feedback loops exist, so this is only a possibility.', links: back, rows: pickRows(back, MAX_ROWS).map(function (e) { return { 'From': g.edges[e].from, 'To': g.edges[e].to, 'Weight': g.edges[e].weight === undefined ? '' : g.edges[e].weight }; }) });
    }

    /* ---------- the number columns ---------- */
    var numCols = [];
    prof.nodes.forEach(function (c) { if (c.kind === 'number' && !c.builtin) numCols.push({ scope: 'nodes', c: c }); });
    prof.edges.forEach(function (c) { if (c.kind === 'number') numCols.push({ scope: 'edges', c: c }); });
    var objsOf = function (scope) { return scope === 'nodes' ? g.nodes : g.edges; };
    var valOf = function (o, c) { return c.key === 'weight' ? C.num(o.weight) : C.numOf(o, { t: 'col', key: c.key }); };
    var rawOf = function (o, c) { if (c.key === 'weight') return o.weight; var at = o.attrs; return at && c.key in at ? at[c.key] : o[c.key]; };
    var nameOf = function (scope, o, idx) { return scope === 'nodes' ? idLabel(g, idx) : (o.from + ' → ' + o.to); };
    numCols.forEach(function (nc) {
      if (late('numbers in ' + nc.c.name)) return;
      var c = nc.c, objs = objsOf(nc.scope), vals = [], at = [], texty = [], missing = 0, where = nc.scope === 'nodes' ? 'items' : 'links', col = '"' + c.name + '" (' + where + ')';
      for (var q = 0; q < objs.length; q++) {
        var raw = rawOf(objs[q], c);
        if (raw === undefined || raw === null || raw === '') { missing++; continue; }
        var v2 = C.num(raw);
        if (v2 !== v2) { texty.push(q); continue; }
        vals.push(v2); at.push(q);
        if (typeof raw === 'string' && /[$€£¥%,()]/.test(raw)) { /* written with symbols; counted below */ }
      }
      var total = objs.length;
      if (texty.length) F(list, { id: 'mixed:' + nc.scope + ':' + c.key, sev: 'error', sure: 'certain', title: nf(texty.length) + ' ' + plural(texty.length, 'value') + ' in ' + col + ' are not numbers', text: 'The column is mostly numbers, but these cells hold words or symbols.', why: 'They are skipped in every total and size. Typical causes: "N/A", "TBD", a unit written in the cell ("12 kg"), or a number split across cells.', items: nc.scope === 'nodes' ? texty.map(function (x) { return g.nodes[x].id; }) : [], links: nc.scope === 'edges' ? texty : [], rows: pickRows(texty, MAX_ROWS).map(function (x) { return { 'Row': nameOf(nc.scope, objs[x], x), 'Value': '"' + rawOf(objs[x], c) + '"' }; }) });
      if (total > 20 && missing / total > 0.2 && c.key !== 'weight') F(list, { id: 'missing:' + nc.scope + ':' + c.key, sev: missing / total > 0.5 ? 'warn' : 'note', sure: 'certain', title: col + ' is empty in ' + Math.round(missing / total * 100) + '% of rows', text: nf(missing) + ' of ' + nf(total) + ' rows have no value.', why: 'Sizes, widths and totals based on this column leave those rows out.' });
      if (vals.length < 8) return;
      var sorted = vals.slice().sort(function (a, b) { return a - b; }), med = median(sorted), q1 = sorted[Math.floor(sorted.length * 0.25)], q3 = sorted[Math.floor(sorted.length * 0.75)], iqr = q3 - q1;
      var neg = at.filter(function (q2, j) { return vals[j] < 0; }), pos = vals.filter(function (x) { return x > 0; }).length;
      if (neg.length && neg.length <= Math.max(2, vals.length * 0.05) && pos > vals.length * 0.9) F(list, { id: 'negative:' + nc.scope + ':' + c.key, sev: 'warn', sure: 'likely', title: nf(neg.length) + ' negative ' + plural(neg.length, 'value') + ' in ' + col + ', where nearly everything else is positive', text: 'A sign flip is a common slip when typing or exporting.', why: 'A negative width or size cannot be drawn; the value is treated as zero.', items: nc.scope === 'nodes' ? neg.map(function (x) { return g.nodes[x].id; }) : [], links: nc.scope === 'edges' ? neg : [], rows: pickRows(neg, MAX_ROWS).map(function (x) { return { 'Row': nameOf(nc.scope, objs[x], x), 'Value': valOf(objs[x], c) }; }) });
      if (sorted[0] === sorted[sorted.length - 1] && vals.length > 20) F(list, { id: 'constant:' + nc.scope + ':' + c.key, sev: 'note', sure: 'certain', title: col + ' has the same value in every row', text: 'Every value is ' + sorted[0] + '.', why: 'It cannot tell items apart on the map. A default that was never filled in is the usual reason.' });
      /* outliers */
      var heavy = sorted[0] > 0 && med > 0 && sorted[sorted.length - 1] / med > 20, ys = heavy ? vals.map(Math.log10) : vals, sy = heavy ? sorted.map(Math.log10) : sorted, my = median(sy);
      var dev = ys.map(function (y) { return Math.abs(y - my); }).sort(function (a, b) { return a - b; }), mad = median(dev), outs = [];
      if (mad > 0) ys.forEach(function (y, j) { var z = 0.6745 * (y - my) / mad; if (Math.abs(z) > (heavy ? 4.5 : 3.8)) outs.push({ j: j, z: z }); });
      else if (iqr > 0) vals.forEach(function (x, j) { if (x > q3 + 3 * iqr || x < q1 - 3 * iqr) outs.push({ j: j, z: (x - med) / iqr }); });
      if (outs.length && outs.length <= Math.max(3, vals.length * 0.04)) {
        outs.sort(function (a, b) { return Math.abs(b.z) - Math.abs(a.z); });
        var slip = outs.filter(function (o2) { var r2 = vals[o2.j] / (med || 1); return med > 0 && vals[o2.j] > 0 && [10, 100, 1000, 0.1, 0.01, 0.001].some(function (p10) { return Math.abs(r2 / p10 - 1) < 0.06; }); }).length;
        F(list, { id: 'outliers:' + nc.scope + ':' + c.key, sev: 'warn', sure: slip ? 'likely' : 'possible', title: nf(outs.length) + ' unusual ' + plural(outs.length, 'value') + ' in ' + col, text: 'Far from the typical value (the middle is about ' + C.fmt(med) + (heavy ? ', and the column spans many orders of size, so the test was done on a log scale' : '') + ').' + (slip ? ' ' + slip + ' of them are almost exactly 10, 100 or 1,000 times the middle, which points to a misplaced decimal point or a unit mix-up.' : ''), why: 'Real data has genuine extremes, so each one needs a look. If one is a typo it will dominate every width, size and total.', items: nc.scope === 'nodes' ? outs.map(function (o2) { return g.nodes[at[o2.j]].id; }) : [], links: nc.scope === 'edges' ? outs.map(function (o2) { return at[o2.j]; }) : [], rows: pickRows(outs, MAX_ROWS).map(function (o2) { return { 'Row': nameOf(nc.scope, objs[at[o2.j]], at[o2.j]), 'Value': vals[o2.j], 'Times the middle': med ? Math.round(vals[o2.j] / med * 100) / 100 : '' }; }) });
      }
      /* sentinel values */
      var counts = new Map(); vals.forEach(function (x) { counts.set(x, (counts.get(x) || 0) + 1); });
      var sent = [0, -1, 99, 999, 9999, 99999, -999, -9999].filter(function (s2) { return (counts.get(s2) || 0) >= Math.max(3, vals.length * 0.03) && (counts.get(s2) || 0) < vals.length * 0.95; });
      if (sent.length && vals.length > 30) {
        var sv = sent.filter(function (s2) { return s2 !== 0; });
        if (sv.length) F(list, { id: 'sentinel:' + nc.scope + ':' + c.key, sev: 'warn', sure: 'possible', title: col + ' has many rows equal to ' + sv.join(', '), text: nf(sv.reduce(function (a, s3) { return a + counts.get(s3); }, 0)) + ' rows hold ' + sv.map(function (s3) { return s3 + ' (' + counts.get(s3) + ')'; }).join(', ') + '.', why: 'Values like -1, 99, 999 or 9999 are often "unknown" stand-ins, not real amounts. They distort averages and widths.' });
      }
      /* percentages and chances */
      if (/pct|percent|%|prob|chance|rate|share|ratio/i.test(c.name)) {
        var over1 = sorted[sorted.length - 1] > 1.0001, over100 = sorted[sorted.length - 1] > 100.0001, below0 = sorted[0] < 0;
        if (below0 || over100 || (over1 && sorted[sorted.length - 1] <= 100 && sorted.filter(function (x) { return x <= 1; }).length > vals.length * 0.6)) F(list, { id: 'range:' + nc.scope + ':' + c.key, sev: 'warn', sure: 'likely', title: col + ' looks like a percentage or chance but has values outside the usual range', text: 'Smallest ' + sorted[0] + ', largest ' + sorted[sorted.length - 1] + '.', why: 'A mix of 0.3 and 30 in one column means two different scales were combined.' });
      }
      /* round numbers */
      if (vals.length >= 40 && sorted[sorted.length - 1] / Math.max(1e-9, Math.abs(sorted[0]) || 1) > 100) {
        var round = vals.filter(function (x) { return x !== 0 && x % 100 === 0; }).length;
        if (round / vals.length > 0.6) F(list, { id: 'round:' + nc.scope + ':' + c.key, sev: 'note', sure: 'possible', title: Math.round(round / vals.length * 100) + '% of ' + col + ' are round hundreds', text: 'Round numbers over a wide range often mean estimates or rounding.', why: 'Fine if that is expected. If these should be exact figures, the source may have been rounded.' });
      }
      /* first-digit pattern (Benford) for wide-ranging positive amounts */
      if (vals.length >= 300 && sorted[0] > 0 && sorted[sorted.length - 1] / sorted[0] >= 1000 && (c.key === 'weight' || /amount|value|revenue|sales|cost|spend|price|total|payment|invoice/i.test(c.name))) {
        var dig = new Array(10).fill(0), nn = 0;
        vals.forEach(function (x) { if (x > 0) { var d = Number(String(Math.abs(x).toExponential()).charAt(0)); dig[d]++; nn++; } });
        var chi = 0; for (var dd = 1; dd <= 9; dd++) { var ex = nn * Math.log10(1 + 1 / dd); chi += (dig[dd] - ex) * (dig[dd] - ex) / ex; }
        if (chi > 26.1) F(list, { id: 'benford:' + nc.scope + ':' + c.key, sev: 'note', sure: 'possible', title: col + ' does not follow the usual first-digit pattern', text: 'In naturally occurring amounts spread over many sizes, about 30% start with 1 and 5% with 9. Here the first digits differ clearly from that (chi-square ' + chi.toFixed(0) + ').', why: 'This is a hint, not proof of anything. Prices, caps, thresholds and rounding all break the pattern legitimately. Worth a glance if the figures should be raw transactions.' });
      }
    });

    /* ---------- categories ---------- */
    var catCols = [];
    prof.nodes.forEach(function (c) { if (c.kind === 'category' || (c.key === 'group' && c.kind === 'text')) catCols.push({ scope: 'nodes', c: c }); });
    prof.edges.forEach(function (c) { if (c.kind === 'category') catCols.push({ scope: 'edges', c: c }); });
    catCols.forEach(function (cc) {
      if (late('categories in ' + cc.c.name)) return;
      var c = cc.c, objs = objsOf(cc.scope), counts = new Map(), where = cc.scope === 'nodes' ? 'items' : 'links', col = '"' + c.name + '" (' + where + ')';
      objs.forEach(function (o) { var raw = rawOf(o, c); if (raw !== undefined && raw !== null && raw !== '') counts.set(String(raw), (counts.get(String(raw)) || 0) + 1); });
      var vals = Array.from(counts.entries()).map(function (e) { return { value: e[0], n: e[1] }; });
      if (vals.length < 2) return;
      var ng = nearGroups(vals).filter(function (x) { return x.members.length >= 2; });
      if (ng.length) {
        var map = Object.create(null);   /* no built-in members: a category called "constructor" or "toString" is an ordinary name */
        ng.forEach(function (x) { var top = x.members.slice().sort(function (a, b) { return b.n - a.n; })[0]; x.members.forEach(function (mem) { if (mem !== top && !(mem.value in map)) map[mem.value] = top.value; }); });
        F(list, { id: 'catvariants:' + cc.scope + ':' + c.key, sev: 'warn', sure: ng.some(function (x) { return x.kind === 'spelling'; }) ? 'likely' : 'possible', title: col + ' spells the same category more than one way', text: nf(ng.length) + ' ' + plural(ng.length, 'category appears', 'categories appear') + ' in variants, so groups and colors split.', why: 'Each spelling gets its own color and its own group, and counts per group come out too small.', rows: pickRows(ng, MAX_ROWS).map(function (x) { return { 'Variants (count)': x.members.map(function (y) { return y.value + ' (' + y.n + ')'; }).join('  /  '), 'Probably': x.members.slice().sort(function (a, b) { return b.n - a.n; })[0].value }; }), fix: { id: 'catMap', label: 'Use the most common spelling', params: { scope: cc.scope, key: c.key, map: map } } });
      }
      var singles = vals.filter(function (x) { return x.n === 1; });
      if (vals.length >= 6 && singles.length >= 1 && singles.length <= vals.length * 0.35 && objs.length >= 30) F(list, { id: 'catsingles:' + cc.scope + ':' + c.key, sev: 'note', sure: 'possible', title: nf(singles.length) + ' ' + plural(singles.length, 'category') + ' in ' + col + ' ' + plural(singles.length, 'has', 'have') + ' only one row', text: singles.slice(0, 6).map(function (x) { return '"' + x.value + '"'; }).join(', ') + (singles.length > 6 ? ' and more' : '') + '.', why: 'A category used once is sometimes a typo of a bigger one, or a leftover. Ignore it if it is real.' });
    });

    /* ---------- groups against links ---------- */
    if (P && !late('groups against links')) {
      var grp = prof.nodes.filter(function (c) { return c.key === 'group' && c.kind === 'category'; })[0];
      if (grp && grp.distinct >= 2 && grp.distinct <= 40 && m >= 20) {
        var mism = [], within = 0, between = 0;
        for (i = 0; i < m; i++) { if (A.from[i] < 0) continue; var ga = g.nodes[A.from[i]].group, gb = g.nodes[A.to[i]].group; if (!ga || !gb) continue; if (ga === gb) within++; else between++; }
        for (i = 0; i < n; i++) {
          var nbr = new Map(), tot = 0, gi = g.nodes[i].group;
          if (!gi) continue;
          A.outs[i].concat(A.ins[i]).forEach(function (e3) { var o = A.from[e3] === i ? A.to[e3] : A.from[e3]; if (o < 0) return; var go = g.nodes[o].group; if (!go) return; nbr.set(go, (nbr.get(go) || 0) + 1); tot++; });
          if (tot < 4) continue;
          var bestG = null, bestC = 0; nbr.forEach(function (cn, go) { if (cn > bestC) { bestC = cn; bestG = go; } });
          if (bestG !== gi && bestC / tot >= 0.75) mism.push({ i: i, to: bestG, share: bestC / tot, tot: tot });
        }
        if (mism.length && mism.length <= Math.max(5, n * 0.1)) F(list, { id: 'wronggroup', sev: 'note', sure: 'possible', title: nf(mism.length) + ' ' + plural(mism.length, 'item') + ' may be in the wrong group', text: 'Most of their links go to a different group than the one they are filed under.', why: 'A hint, not a verdict: a bridge between groups legitimately links outward. If the groups were typed by hand, a slip is plausible.', items: mism.map(function (x) { return g.nodes[x.i].id; }), rows: pickRows(mism.sort(function (a, b) { return b.share - a.share; }), MAX_ROWS).map(function (x) { return { 'Item': idLabel(g, x.i), 'Filed under': g.nodes[x.i].group, 'Links mostly go to': x.to, 'Share': Math.round(x.share * 100) + '% of ' + x.tot }; }) });
        if (within + between >= 20) {
          var agree = within / (within + between);
          F(list, { id: 'groupfit', sev: 'insight', sure: 'certain', title: Math.round(agree * 100) + '% of links stay inside a group', text: agree > 0.7 ? 'The groups fit the links well: groups mostly connect to themselves.' : agree < 0.3 ? 'The links mostly cross between groups. Either the groups are by role (like customers and suppliers) or they do not follow how things connect.' : 'A mix of links inside and between groups.', why: 'Compare this with "Found groups" on the Map, which groups items by their links alone.' });
        }
      }
    }

    /* ---------- weights: odds that do not add up, flow that leaks ---------- */
    var wcol = C.findCol(prof.edges, 'weight');
    if (wcol && wcol.kind === 'number' && m >= 6) {
      var sums = [], sIn = new Float64Array(n), sOut = new Float64Array(n), hasW = 0;
      for (i = 0; i < m; i++) if (A.from[i] >= 0 && A.w[i] === A.w[i]) { sOut[A.from[i]] += A.w[i]; sIn[A.to[i]] += A.w[i]; hasW++; }
      for (i = 0; i < n; i++) if (A.outs[i].length >= 2) sums.push(i);
      var near1 = sums.filter(function (x) { return Math.abs(sOut[x] - 1) < 0.011; }), near100 = sums.filter(function (x) { return Math.abs(sOut[x] - 100) < 1.1; });
      var chance = near1.length >= near100.length ? near1 : near100, scale = near1.length >= near100.length ? 1 : 100;
      if (sums.length >= 5 && chance.length >= sums.length * 0.6 && chance.length < sums.length) {
        var offs = sums.filter(function (x) { return chance.indexOf(x) < 0; });
        F(list, { id: 'oddsum', sev: 'error', sure: 'likely', title: nf(offs.length) + ' ' + plural(offs.length, 'item has', 'items have') + ' outgoing weights that do not add to ' + (scale === 1 ? '1' : '100%'), text: 'Most items (' + nf(chance.length) + ' of ' + nf(sums.length) + ') split their outgoing weights to exactly ' + (scale === 1 ? '1' : '100') + ', so the weights look like chances. These do not.', why: 'If the weights are chances, a total off by even a little means a missing link or a typo, and exact odds are computed on the rescaled values.', items: offs.map(function (x) { return g.nodes[x].id; }), rows: pickRows(offs, MAX_ROWS).map(function (x) { return { 'Item': idLabel(g, x), 'Outgoing total': Math.round(sOut[x] * 10000) / 10000, 'Should be': scale }; }) });
      }
      var inter = []; for (i = 0; i < n; i++) if (A.ins[i].length && A.outs[i].length) inter.push(i);
      if (inter.length >= 8 && hasW >= m * 0.8 && !(chance.length >= sums.length * 0.6 && sums.length >= 5)) {
        var ok = inter.filter(function (x) { var d = Math.abs(sIn[x] - sOut[x]) / Math.max(sIn[x], sOut[x], 1e-9); return d <= 0.05; });
        if (ok.length >= inter.length * 0.6 && ok.length < inter.length) {
          var leaks = inter.filter(function (x) { return ok.indexOf(x) < 0; }).map(function (x) { return { i: x, d: sOut[x] - sIn[x], r: Math.abs(sIn[x] - sOut[x]) / Math.max(sIn[x], sOut[x]) }; }).sort(function (a, b) { return b.r - a.r; });
          F(list, { id: 'leaks', sev: 'error', sure: 'likely', title: nf(leaks.length) + ' ' + plural(leaks.length, 'item does', 'items do') + ' not pass on what comes in', text: 'Most middle items (' + nf(ok.length) + ' of ' + nf(inter.length) + ') send out within 5% of what they receive, so this looks like conserved flow. These are off.', why: 'Flow that appears or vanishes in the middle usually means a missing link, a wrong amount, or a deliberate loss (waste, fees) that should be its own link.', items: leaks.map(function (x) { return g.nodes[x.i].id; }), rows: pickRows(leaks, MAX_ROWS).map(function (x) { return { 'Item': idLabel(g, x.i), 'Comes in': Math.round(sIn[x.i] * 100) / 100, 'Goes out': Math.round(sOut[x.i] * 100) / 100, 'Difference': (x.d > 0 ? '+' : '') + Math.round(x.d * 100) / 100 }; }) });
        }
      }
      var zero = []; for (i = 0; i < m; i++) if (A.w[i] === 0) zero.push(i);
      if (zero.length) F(list, { id: 'zeroweights', sev: 'note', sure: 'certain', title: nf(zero.length) + ' ' + plural(zero.length, 'link has', 'links have') + ' a weight of zero', text: 'They are drawn as the thinnest line and take no share of any split.', why: 'Zero can mean "none" or "not entered". If it means missing, leave the cell empty instead.', links: zero, rows: pickRows(zero, MAX_ROWS).map(function (e) { return { 'From': g.edges[e].from, 'To': g.edges[e].to }; }) });
    }

    /* ---------- states ---------- */
    if (g.states && g.states.names && g.states.names.length > 1) {
      var jumps = [], flick = [], ns = g.states.names.length;
      for (i = 0; i < m; i++) {
        var vv = g.edges[i].vals; if (!vv) continue;
        for (var s = 1; s < ns; s++) {
          var a = vv[s - 1], b = vv[s];
          if (a > 0 && b > 0 && (b / a >= 10 || a / b >= 10)) jumps.push({ e: i, s: s, a: a, b: b });
          if (s < ns - 1 && a > 0 && !(b > 0) && vv[s + 1] > 0) flick.push({ e: i, s: s });
        }
      }
      if (jumps.length) F(list, { id: 'statejumps', sev: 'warn', sure: 'possible', title: nf(jumps.length) + ' ' + plural(jumps.length, 'link changes', 'links change') + ' tenfold or more between neighboring states', text: 'Sudden jumps between ' + g.states.names.join(', ') + '.', why: 'Real shocks happen, but a tenfold jump is also the signature of a unit change or a misplaced decimal in one period.', links: jumps.map(function (x) { return x.e; }), rows: pickRows(jumps, MAX_ROWS).map(function (x) { return { 'Link': g.edges[x.e].from + ' → ' + g.edges[x.e].to, 'Between': g.states.names[x.s - 1] + ' and ' + g.states.names[x.s], 'From': x.a, 'To': x.b }; }) });
      if (flick.length) F(list, { id: 'stateflicker', sev: 'note', sure: 'possible', title: nf(flick.length) + ' ' + plural(flick.length, 'link disappears', 'links disappear') + ' for one state and then returns', text: 'Present, missing, present again.', why: 'Often a gap in the data for that period rather than a real stop.', links: flick.map(function (x) { return x.e; }), rows: pickRows(flick, MAX_ROWS).map(function (x) { return { 'Link': g.edges[x.e].from + ' → ' + g.edges[x.e].to, 'Missing in': g.states.names[x.s] }; }) });
    }

    /* ---------- insights ---------- */
    if (P && imp && P.n > 2 && m) {
      var strength = new Float64Array(P.n), totalW = 0;
      for (i = 0; i < P.m; i++) { var ww = P.rw[i]; strength[P.from[i]] += ww; strength[P.to[i]] += ww; totalW += ww; }
      var order = []; for (i = 0; i < P.n; i++) order.push(i);
      order.sort(function (a, b) { return strength[b] - strength[a]; });
      var top5 = order.slice(0, 5);
      if (totalW > 0) {
        var eo = []; for (i = 0; i < P.m; i++) eo.push(i);
        eo.sort(function (a, b) { return P.rw[b] - P.rw[a]; });
        var half = 0, cnt = 0; for (i = 0; i < eo.length; i++) { half += P.rw[eo[i]]; cnt++; if (half >= totalW * 0.5) break; }
        var hasRealW = wcol && wcol.kind === 'number';
        F(list, { id: 'concentration', sev: 'insight', sure: 'certain', title: hasRealW ? 'Half of all the weight sits in ' + nf(cnt) + ' of ' + nf(P.m) + ' links (' + Math.round(cnt / P.m * 100) + '%)' : 'The busiest ' + nf(top5.length) + ' items hold ' + Math.round(top5.reduce(function (a, x) { return a + strength[x]; }, 0) / (2 * totalW) * 100) + '% of all link ends', text: hasRealW ? 'The biggest link is ' + P.edges[P.eorig[eo[0]]].from + ' → ' + P.edges[P.eorig[eo[0]]].to + ' (' + C.fmt(P.rw[eo[0]]) + ').' : 'Busiest: ' + top5.map(function (x) { return P.nodes[x].label; }).join(', ') + '.', why: 'A heavy concentration means the picture is decided by a few things. Filter to the strongest links on the Map to see them clearly.', links: eo.slice(0, Math.min(cnt, 30)).map(function (e4) { return P.eorig[e4]; }), items: top5.map(function (x) { return P.nodes[x].id; }), rows: top5.map(function (x) { return { 'Item': P.nodes[x].label, 'Links': (P.outStart[x + 1] - P.outStart[x]) + (P.inStart[x + 1] - P.inStart[x]), 'Total weight': Math.round(strength[x] * 100) / 100 }; }) });
      }
      var chokes = imp.spine.filter(function (x) { return x !== P.start; });
      if (chokes.length) F(list, { id: 'chokes', sev: 'insight', sure: 'certain', title: nf(chokes.length) + ' ' + plural(chokes.length, 'item sits', 'items sit') + ' on every route from the start to the end', text: 'If ' + (chokes.length === 1 ? 'it' : 'any of them') + ' is blocked, nothing reaches the end: ' + chokes.slice(0, 5).map(function (x) { return P.nodes[x].label; }).join(', ') + (chokes.length > 5 ? ' and more' : '') + '.', why: 'Single points of failure. Use "Take it out (what if)" on the Map or the what-if sweep on the Advanced tab to see the damage.', items: chokes.map(function (x) { return P.nodes[x].id; }) });
      var src = [], snk = [];
      for (i = 0; i < P.n; i++) { if (!(P.inStart[i + 1] - P.inStart[i]) && (P.outStart[i + 1] - P.outStart[i])) src.push(i); if ((P.inStart[i + 1] - P.inStart[i]) && !(P.outStart[i + 1] - P.outStart[i])) snk.push(i); }
      if (src.length || snk.length) F(list, { id: 'sourcesinks', sev: 'insight', sure: 'certain', title: nf(src.length) + ' ' + plural(src.length, 'source') + ' and ' + nf(snk.length) + ' ' + plural(snk.length, 'end'), text: 'Sources have nothing flowing into them' + (src.length ? ' (' + src.slice(0, 4).map(function (x) { return P.nodes[x].label; }).join(', ') + (src.length > 4 ? ', …' : '') + ')' : '') + '; ends have no way on' + (snk.length ? ' (' + snk.slice(0, 4).map(function (x) { return P.nodes[x].label; }).join(', ') + (snk.length > 4 ? ', …' : '') + ')' : '') + '.', why: src.length > 1 ? 'More than one source: set them as starting items on the Advanced tab to release walkers from all of them.' : 'One source: the map reads naturally from it.', items: src.concat(snk).slice(0, 60).map(function (x) { return P.nodes[x].id; }) });
      var big = 0, bigN = 0; for (i = 0; i < sc.count; i++) if (compSize[i] > 1) { bigN++; if (compSize[i] > big) big = compSize[i]; }
      if (bigN) F(list, { id: 'loops', sev: 'insight', sure: 'certain', title: nf(bigN) + ' ' + plural(bigN, 'loop') + ' where flow can go round (the biggest has ' + nf(big) + ' items)', text: 'Items inside a loop can be visited more than once.', why: 'Walkers may pass through the same item several times; the Advanced tab reports steps per walker.', items: g.nodes.filter(function (x, j) { return compSize[sc.comp[j]] > 1; }).slice(0, 80).map(function (x) { return x.id; }) });
    }
    return finish(g, list, prof, A, t0, skipped);
  }

  function finish(g, list, prof, A, t0, skipped) {
    var order = { error: 0, warn: 1, note: 2, insight: 3 }, sure = { certain: 0, likely: 1, possible: 2 };
    list.sort(function (a, b) { return order[a.sev] - order[b.sev] || sure[a.sure] - sure[b.sure] || b.count - a.count; });
    var cnt = { error: 0, warn: 0, note: 0, insight: 0 }; list.forEach(function (f) { cnt[f.sev]++; });
    var bad = new Set(), badL = new Set();
    list.forEach(function (f) { if (f.sev === 'error' || f.sev === 'warn') { f.items.forEach(function (x) { bad.add(x); }); f.links.forEach(function (x) { badL.add(x); }); } });
    var verdict = cnt.error ? 'attention' : cnt.warn ? 'look' : 'clean';
    return {
      findings: list, counts: cnt, verdict: verdict, skipped: skipped, ms: now() - t0,
      stats: { items: g.nodes.length, links: g.edges.length, itemColumns: prof.nodes.length, linkColumns: prof.edges.length, itemsFlagged: bad.size, linksFlagged: badL.size, cleanShare: g.nodes.length + g.edges.length ? 1 - (bad.size + badL.size) / (g.nodes.length + g.edges.length) : 1 }
    };
  }

  /* ---------------------------------------------------------------- fixes (pure: give a graph, get a new graph) */
  function copy(g) { return Object.assign({}, g, { nodes: g.nodes.slice(), edges: g.edges.slice() }); }
  function cleanStr(s) { return typeof s === 'string' ? s.replace(/[​-‍⁠﻿­]/g, '').replace(/\s+/g, ' ').trim() : s; }
  function mergeNodes(g, keep, drop) {
    var gone = new Set(drop), out = copy(g);
    out.nodes = g.nodes.filter(function (n) { return !gone.has(n.id); });
    var keepNode = g.nodes.filter(function (n) { return n.id === keep; })[0];
    g.nodes.forEach(function (n) { if (gone.has(n.id) && keepNode) { if (!keepNode.group && n.group) keepNode.group = n.group; } });
    var seen = new Set();
    out.edges = g.edges.map(function (e) { return gone.has(e.from) || gone.has(e.to) ? Object.assign({}, e, { from: gone.has(e.from) ? keep : e.from, to: gone.has(e.to) ? keep : e.to }) : e; }).filter(function (e) {
      var k = e.from + '\u0001' + e.to + '\u0001' + (e.kind || '') + '\u0001' + (e.label || '') + '\u0001' + e.weight;
      if (seen.has(k)) return false; seen.add(k); return true;
    });
    if (gone.has(g.start)) out.start = keep;
    return out;
  }
  /** Applies a fix from a finding. Returns { graph, text } or null when there is nothing to do. */
  function applyFix(g, fix) {
    if (!fix) return null;
    var out = copy(g), changed = 0, i;
    if (fix.id === 'dropSelf') { out.edges = g.edges.filter(function (e) { return e.from !== e.to; }); changed = g.edges.length - out.edges.length; return changed ? { graph: out, text: 'removed ' + changed + ' self-link' + (changed === 1 ? '' : 's') } : null; }
    if (fix.id === 'dropDupLinks') {
      var seen = new Set(); out.edges = g.edges.filter(function (e) { var k = e.from + '\u0001' + e.to + '\u0001' + (e.kind || '') + '\u0001' + (e.label || '') + '\u0001' + e.weight; if (seen.has(k)) return false; seen.add(k); return true; });
      changed = g.edges.length - out.edges.length; return changed ? { graph: out, text: 'removed ' + changed + ' repeated link' + (changed === 1 ? '' : 's') } : null;
    }
    if (fix.id === 'dropIsolated') {
      var used = new Set(); g.edges.forEach(function (e) { used.add(e.from); used.add(e.to); });
      out.nodes = g.nodes.filter(function (n) { return used.has(n.id); }); changed = g.nodes.length - out.nodes.length;
      return changed ? { graph: out, text: 'removed ' + changed + ' unlinked item' + (changed === 1 ? '' : 's') } : null;
    }
    if (fix.id === 'trim') {
      var rename = new Map();
      out.nodes = g.nodes.map(function (n) {
        var id = cleanStr(n.id), lb = cleanStr(n.label), gr = cleanStr(n.group), at = n.attrs;
        if (id === n.id && lb === n.label && gr === n.group) return n;
        changed++; if (id !== n.id) rename.set(n.id, id);
        return Object.assign({}, n, { id: id, label: lb === n.id ? id : lb, group: gr });
      });
      var seenN = new Map(), merged = [];
      out.nodes.forEach(function (n) { if (seenN.has(n.id)) merged.push(n.id); else seenN.set(n.id, n); });
      out.edges = g.edges.map(function (e) { var f = rename.has(e.from) ? rename.get(e.from) : e.from, t = rename.has(e.to) ? rename.get(e.to) : e.to; return f === e.from && t === e.to ? e : Object.assign({}, e, { from: f, to: t }); });
      if (rename.has(g.start)) out.start = rename.get(g.start);
      if (merged.length) { var uniq = []; var have = new Set(); out.nodes.forEach(function (n) { if (!have.has(n.id)) { have.add(n.id); uniq.push(n); } }); out.nodes = uniq; }
      return changed ? { graph: out, text: 'cleaned ' + changed + ' name' + (changed === 1 ? '' : 's') + (merged.length ? ' (' + merged.length + ' duplicates joined)' : '') } : null;
    }
    if (fix.id === 'mergeSameLabel') {
      var by = new Map(); g.nodes.forEach(function (n) { var k = n.label || n.id; if (!by.has(k)) by.set(k, []); by.get(k).push(n.id); });
      var res = g; by.forEach(function (ids) { if (ids.length > 1) { res = mergeNodes(res, ids[0], ids.slice(1)); changed += ids.length - 1; } });
      return changed ? { graph: res, text: 'merged ' + changed + ' item' + (changed === 1 ? '' : 's') + ' into their namesakes' } : null;
    }
    if (fix.id === 'catMap') {
      var p = fix.params, map = p.map, has = function (k) { return Object.prototype.hasOwnProperty.call(map, k); };   /* own keys only (the map may have come through a copy that has the usual object members) */
      if (p.scope === 'nodes') out.nodes = g.nodes.map(function (n) {
        if (p.key === 'group') { if (has(n.group)) { changed++; return Object.assign({}, n, { group: map[n.group] }); } return n; }
        var v = n.attrs && n.attrs[p.key]; if (v !== undefined && has(String(v))) { changed++; var at = Object.assign({}, n.attrs); at[p.key] = map[String(v)]; return Object.assign({}, n, { attrs: at }); } return n;
      });
      else out.edges = g.edges.map(function (e) {
        if (p.key === 'kind') { if (has(e.kind)) { changed++; return Object.assign({}, e, { kind: map[e.kind] }); } return e; }
        var v = e.attrs && e.attrs[p.key]; if (v !== undefined && has(String(v))) { changed++; var at = Object.assign({}, e.attrs); at[p.key] = map[String(v)]; return Object.assign({}, e, { attrs: at }); } return e;
      });
      return changed ? { graph: out, text: 'unified ' + changed + ' spelling' + (changed === 1 ? '' : 's') } : null;
    }
    return null;
  }
  /** Markdown report of a result, for saving or sharing. */
  function toMarkdown(res, g) {
    var out = ['# Data check: ' + (g && g.name || 'Untitled'), '', res.stats.items + ' items, ' + res.stats.links + ' links. ' + res.counts.error + ' problem(s), ' + res.counts.warn + ' to look at, ' + res.counts.note + ' note(s), ' + res.counts.insight + ' insight(s).', ''];
    var names = { error: 'Problems', warn: 'To look at', note: 'Notes', insight: 'Insights' };
    ['error', 'warn', 'note', 'insight'].forEach(function (s) {
      var fs = res.findings.filter(function (f) { return f.sev === s; });
      if (!fs.length) return;
      out.push('## ' + names[s], '');
      fs.forEach(function (f) {
        out.push('### ' + f.title + ' (' + f.sure + ')', '', f.text, '', '_Why it matters:_ ' + f.why, '');
        if (f.rows && f.rows.length) {
          var keys = Object.keys(f.rows[0]);
          out.push('| ' + keys.join(' | ') + ' |', '| ' + keys.map(function () { return '---'; }).join(' | ') + ' |');
          f.rows.forEach(function (r) { out.push('| ' + keys.map(function (k) { return String(r[k] === undefined ? '' : r[k]).replace(/\|/g, '/'); }).join(' | ') + ' |'); });
          out.push('');
        }
      });
    });
    if (res.skipped.length) out.push('_Skipped for speed: ' + res.skipped.join(', ') + '._', '');
    return out.join('\n');
  }

  return { run: run, applyFix: applyFix, toMarkdown: toMarkdown, norm: norm, within1: within1, nearGroups: nearGroups, mergeNodes: mergeNodes };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NFMCheck;
