/*!
 * Net Flow Map app: the Data tab and the Map tab. Copyright (c) 2026 JNFoo. MIT License.
 * Needs (in this order): env-probes, back-close, engine (as text), importers, scene, render, probe, engine-client, examples.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var debounce = function (fn, ms) { var t; return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); }; };
  var LS = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* none */ } }
  };
  var nfmt = function (n) { return Number(n).toLocaleString('en-US'); };

  /* ---------------------------------------------------------------- state */
  var engineSrc = $('nfm-engine-src').textContent, pageEngine = null;
  function getEngine() {
    if (!pageEngine) { var s = document.createElement('script'); s.textContent = engineSrc; document.head.appendChild(s); pageEngine = window.NFMEngine; }
    return pageEngine;
  }
  var EMPTY = function () { return { name: 'Untitled', start: null, nodes: [], edges: [] }; };
  var S = {
    graph: EMPTY(), hist: [], gver: 0, byId: new Map(), outAdj: new Map(), inAdj: new Map(), kinds: [], attrKeys: [],
    theme: 'auto', opts: { view: 'flow', colorBy: 'group', dir: 'LR', fold: true, merge: false, traffic: false, laneBy: 'group', mode: 'random', runs: 2000, weights: false },
    block: [], hideKinds: [], imp: null, tab: 'data', table: 'items', page: 0, filter: '',
    L: null, scene: null, view: { k: 1, tx: 0, ty: 0 }, fitKey: '', sel: null, ring: null, stageW: 1, stageH: 1, dpr: 1, mapSeq: 0, canary: null
  };
  var PAGE = 100;

  function loadPrefs() {
    try { var p = JSON.parse(LS.get('nfm-prefs') || '{}'); if (p.theme) S.theme = p.theme; if (p.opts) Object.keys(S.opts).forEach(function (k) { if (p.opts[k] !== undefined && typeof p.opts[k] === typeof S.opts[k]) S.opts[k] = p.opts[k]; }); if (p.method) S.method = p.method; } catch (e) { /* ignore */ }
  }
  var savePrefs = debounce(function () { LS.set('nfm-prefs', JSON.stringify({ theme: S.theme, opts: S.opts, method: S.method || 'auto' })); }, 300);
  var saveGraph = debounce(function () {
    if (!S.graph.nodes.length) { LS.del('nfm-graph'); return; }
    var txt = JSON.stringify(S.graph);
    if (txt.length < 1800000) LS.set('nfm-graph', txt); else LS.del('nfm-graph');
  }, 600);

  var toastT;
  function toast(msg, ms) { var t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, ms || 3600); }
  function say(msg) { var l = $('live'); l.textContent = ''; setTimeout(function () { l.textContent = msg; }, 30); }
  function nextFrame() { return new Promise(function (r) { setTimeout(r, 0); }); }

  /* ---------------------------------------------------------------- theme and tabs */
  function applyTheme() {
    var r = document.documentElement;
    if (S.theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', S.theme);
    if (S.scene && S.L) { makeScene(false); }
  }
  function themeName() { return S.theme === 'auto' ? (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : S.theme; }
  $('btn-theme').addEventListener('click', function () { S.theme = themeName() === 'dark' ? 'light' : 'dark'; savePrefs(); applyTheme(); });
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if (S.theme === 'auto') applyTheme(); });

  function showTab(name) {
    S.tab = name;
    ['data', 'map'].forEach(function (t) { $('tab-' + t).hidden = t !== name; $('tabbtn-' + t).setAttribute('aria-selected', t === name ? 'true' : 'false'); });
    if (name === 'map') mapShown();
  }
  $('tabbtn-data').addEventListener('click', function () { showTab('data'); });
  $('tabbtn-map').addEventListener('click', function () { showTab('map'); });
  document.querySelector('.tabs').addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { showTab(S.tab === 'data' ? 'map' : 'data'); $('tabbtn-' + S.tab).focus(); }
  });

  /* ---------------------------------------------------------------- the graph: one place that changes it */
  function indexGraph() {
    var g = S.graph, by = new Map(), out = new Map(), inn = new Map(), kinds = new Set(), keys = new Map();
    g.nodes.forEach(function (n) { by.set(n.id, n); Object.keys(n.attrs || {}).forEach(function (k) { keys.set(k, (keys.get(k) || 0) + 1); }); });
    g.edges.forEach(function (e) {
      if (!out.has(e.from)) out.set(e.from, []); out.get(e.from).push(e);
      if (!inn.has(e.to)) inn.set(e.to, []); inn.get(e.to).push(e);
      if (e.kind) kinds.add(e.kind);
    });
    S.byId = by; S.outAdj = out; S.inAdj = inn; S.kinds = Array.from(kinds).sort();
    S.attrKeys = Array.from(keys.entries()).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 12).map(function (x) { return x[0]; });
  }
  /** Replace the whole graph. push: remember the old one for Undo. */
  function setGraph(g, push) {
    if (push !== false) { S.hist.push(S.graph); if (S.hist.length > 25) S.hist.shift(); }
    S.graph = g; S.gver++;
    S.block = S.block.filter(function (id) { return g.nodes.some(function (n) { return n.id === id; }); });
    graphChanged();
  }
  /** Change the graph through fn(g), where g holds copies of the two lists; fn must replace objects, not change them in place. */
  function edit(fn, push) {
    var g = { name: S.graph.name, start: S.graph.start, nodes: S.graph.nodes.slice(), edges: S.graph.edges.slice() };
    fn(g);
    setGraph(g, push);
  }
  function graphChanged() {
    indexGraph();
    getEngine();
    if (client && client.mode !== 'starting') client.setGraph(S.graph);
    if (S.sel && !S.byId.has(S.sel)) S.sel = null;
    renderReport(); renderTidy(); renderTable(); renderOptions();
    $('b-undo').disabled = !S.hist.length;
    saveGraph();
    if (S.tab === 'map') refreshMap('data');
  }
  function undo() {
    if (!S.hist.length) return;
    S.graph = S.hist.pop(); S.gver++; graphChanged(); toast('Undone.');
  }
  $('b-undo').addEventListener('click', undo);
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !/input|textarea|select/i.test((e.target.tagName || '')) && S.hist.length) { e.preventDefault(); undo(); }
  });

  /* ---------------------------------------------------------------- Data tab: intake */
  var TEXT_EXT = /\.(md|markdown|txt|csv|tsv|json|canvas|jsonl|ndjson|dot|gv|tab)$/i, NOTE_EXT = /\.(md|markdown|txt)$/i;
  var MAX_FILES = 5000, MAX_NOTE = 1500000, MAX_ONE = 60000000;
  var skippedCount = 0;
  function readFile(file, path) {
    return new Promise(function (resolve) {
      var name = file.name, isNote = NOTE_EXT.test(name);
      if (!TEXT_EXT.test(name) && file.type && !/text|json|csv/.test(file.type)) { skippedCount++; return resolve(null); }
      if (file.size > MAX_ONE || (path && path.indexOf('/') > 0 && isNote && file.size > MAX_NOTE)) { skippedCount++; return resolve(null); }
      var done = function (t) { resolve({ name: name, path: path || file.webkitRelativePath || name, text: t }); };
      if (file.text) file.text().then(done, function () { skippedCount++; resolve(null); });
      else { var fr = new FileReader(); fr.onload = function () { done(String(fr.result)); }; fr.onerror = function () { skippedCount++; resolve(null); }; fr.readAsText(file); }
    });
  }
  function hiddenPath(p) { return /(^|\/)(\.[^/]+|node_modules)(\/|$)/.test(p); }
  function walkEntry(entry, path, acc) {
    return new Promise(function (resolve) {
      if (acc.count >= MAX_FILES) return resolve();
      if (entry.isFile) {
        if (hiddenPath(path + entry.name)) return resolve();
        entry.file(function (f) { acc.count++; readFile(f, path + entry.name).then(function (r) { if (r) acc.files.push(r); resolve(); }); }, function () { resolve(); });
      } else if (entry.isDirectory) {
        if (hiddenPath(path + entry.name + '/')) return resolve();
        var reader = entry.createReader(), all = [];
        var more = function () {
          reader.readEntries(function (batch) {
            if (!batch.length) { Promise.all(all.map(function (e) { return walkEntry(e, path + entry.name + '/', acc); })).then(resolve); return; }
            all = all.concat(Array.prototype.slice.call(batch)); more();
          }, function () { resolve(); });
        };
        more();
      } else resolve();
    });
  }
  function filesFromDrop(dt) {
    var acc = { files: [], count: 0 }, items = dt.items;
    if (items && items.length && items[0].webkitGetAsEntry) {
      var entries = [];
      for (var i = 0; i < items.length; i++) { var en = items[i].webkitGetAsEntry(); if (en) entries.push(en); }
      return Promise.all(entries.map(function (e) { return walkEntry(e, '', acc); })).then(function () { return acc.files; });
    }
    return Promise.all(Array.prototype.slice.call(dt.files).map(function (f) { return readFile(f, f.name); })).then(function (r) { return r.filter(Boolean); });
  }
  function filesFromInput(list) {
    var arr = Array.prototype.slice.call(list).filter(function (f) { return !hiddenPath(f.webkitRelativePath || f.name); }).slice(0, MAX_FILES);
    return Promise.all(arr.map(function (f) { return readFile(f, f.webkitRelativePath || f.name); })).then(function (r) { return r.filter(Boolean); });
  }
  function importMode() { return document.querySelector('input[name=mode]:checked').value; }
  function importOptions() {
    return { format: $('fmt').value, outlineSeparate: $('o-sep').checked, keepDuplicates: $('o-dups').checked };
  }
  function busy(msg) { var c = $('report'); c.hidden = false; $('stats').innerHTML = ''; $('notes').innerHTML = '<li>' + esc(msg) + '</li>'; $('mapping').hidden = true; }

  /** Everything that brings data in goes through here. */
  function ingest(files, extra) {
    if (!files.length) { toast('Nothing readable was found. Tables, JSON, outlines and Markdown notes work.'); return Promise.resolve(); }
    busy('Reading ' + files.length + ' file' + (files.length === 1 ? '' : 's') + '…');
    return nextFrame().then(function () {
      var opts = Object.assign(importOptions(), extra || {}), res;
      try { res = NFMImport.importAny(files, opts); }
      catch (err) { renderError(err.message); return; }
      var base = S.graph, mode = importMode();
      S.imp = { files: files, opts: opts, base: base, mode: mode, res: res, name: res.graph.name };
      var g = mode === 'merge' && base.nodes.length ? NFMImport.mergeGraphs(base, res.graph) : res.graph;
      if (mode === 'merge' && base.nodes.length) { g.name = base.name; } else g.name = res.graph.name;
      var note = skippedCount ? skippedCount + ' file' + (skippedCount === 1 ? ' was' : 's were') + ' skipped (not text, too large, or hidden).' : '';
      skippedCount = 0;
      if (note) res.report.notes.push(note);
      setGraph(g, true);
      $('report').scrollIntoView({ behavior: 'auto', block: 'nearest' });
    });
  }
  function renderError(msg) {
    var c = $('report'); c.hidden = false; $('stats').innerHTML = ''; $('mapping').hidden = true;
    $('notes').innerHTML = '<li><b>I could not read that.</b> ' + esc(msg) + '</li>';
  }

  $('b-files').addEventListener('click', function () { $('in-files').click(); });
  $('b-folder').addEventListener('click', function () { $('in-folder').click(); });
  $('drop').addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('in-files').click(); } });
  $('in-files').addEventListener('change', function (e) { var l = e.target.files; if (l && l.length) filesFromInput(l).then(ingest); e.target.value = ''; });
  $('in-folder').addEventListener('change', function (e) { var l = e.target.files; if (l && l.length) filesFromInput(l).then(ingest); e.target.value = ''; });
  $('b-paste').addEventListener('click', function () { $('pastebox').hidden = false; $('paste').focus(); });
  $('b-pastex').addEventListener('click', function () { $('pastebox').hidden = true; });
  $('b-read').addEventListener('click', function () { var t = $('paste').value; if (!t.trim()) { toast('Paste something first.'); return; } ingest([{ name: 'Pasted data', text: t }]).then(function () { $('pastebox').hidden = true; }); });
  ['dragenter', 'dragover'].forEach(function (ev) { document.addEventListener(ev, function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) { e.preventDefault(); if (S.tab === 'data') $('drop').classList.add('over'); } }); });
  document.addEventListener('dragleave', function (e) { if (!e.relatedTarget) $('drop').classList.remove('over'); });
  document.addEventListener('drop', function (e) {
    if (!e.dataTransfer || !e.dataTransfer.types || Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') < 0) return;
    e.preventDefault(); $('drop').classList.remove('over'); showTab('data');
    filesFromDrop(e.dataTransfer).then(ingest);
  });
  document.addEventListener('paste', function (e) {
    if (S.tab !== 'data' || /input|textarea|select/i.test(e.target.tagName || '')) return;
    var t = e.clipboardData && e.clipboardData.getData('text'); if (t && t.trim()) { e.preventDefault(); ingest([{ name: 'Pasted data', text: t }]); }
  });

  var exSel = $('examples');
  NFMExamples.LIST.forEach(function (x) { var o = document.createElement('option'); o.value = x.id; o.textContent = x.title; exSel.appendChild(o); });
  $('b-example').addEventListener('click', function () {
    var x = NFMExamples.LIST.filter(function (e) { return e.id === exSel.value; })[0];
    busy('Loading the example…');
    nextFrame().then(function () {
      var res = x.load(), base = S.graph, mode = importMode();
      S.imp = { files: null, opts: {}, base: base, mode: mode, res: res, name: res.graph.name };
      res.report.notes.push(x.blurb);
      setGraph(mode === 'merge' && base.nodes.length ? NFMImport.mergeGraphs(base, res.graph) : res.graph, true);
    });
  });

  /* ---------------------------------------------------------------- Data tab: report and table mapping */
  var ROLES = {
    edges: [['from', 'From (where a link starts)'], ['to', 'To (where it goes)'], ['weight', 'Weight'], ['label', 'Label on the link'], ['kind', 'Kind of link'], ['fromGroup', 'Group of the "from" item'], ['toGroup', 'Group of the "to" item']],
    tree: [['id', 'Item'], ['parent', 'Parent item'], ['label', 'Label'], ['group', 'Group'], ['valence', 'Ending (good / bad)'], ['start', 'Start flag']],
    nodes: [['id', 'Item'], ['links', 'Column that lists where it links'], ['label', 'Label'], ['group', 'Group'], ['valence', 'Ending (good / bad)'], ['start', 'Start flag']],
    matrix: []
  };
  var MODE_NAMES = { edges: 'One row per link (from, to)', nodes: 'One row per item, with a column listing its links', tree: 'One row per item, with a parent column', matrix: 'A grid (rows link to columns)' };
  function renderReport() {
    var g = S.graph, card = $('report');
    if (!g.nodes.length && !S.imp) { card.hidden = true; return; }
    card.hidden = false;
    var ghosts = g.nodes.filter(function (n) { return n.ghost; }).length, ends = g.nodes.filter(function (n) { return !S.outAdj.has(n.id); }).length;
    $('stats').innerHTML = '<div class="stat"><b>' + nfmt(g.nodes.length) + '</b><span>items</span></div><div class="stat"><b>' + nfmt(g.edges.length) + '</b><span>links</span></div><div class="stat"><b>' + nfmt(ends) + '</b><span>with no way on</span></div>' + (ghosts ? '<div class="stat"><b>' + nfmt(ghosts) + '</b><span>placeholders</span></div>' : '') + (g.start ? '<div class="stat"><b style="font-size:15px">' + esc((S.byId.get(g.start) || {}).label || g.start) + '</b><span>start</span></div>' : '');
    var notes = S.imp ? S.imp.res.report.notes : [];
    $('notes').innerHTML = (g.nodes.length ? '' : '<li>The data is empty now.</li>') + notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('');
    $('undoinfo').textContent = S.hist.length ? S.hist.length + ' step' + (S.hist.length === 1 ? '' : 's') + ' can be undone' : '';
    renderMapping();
  }
  function renderMapping() {
    var box = $('mapping'), imp = S.imp;
    if (!imp || !imp.res.rows || !imp.res.mapping) { box.hidden = true; return; }
    var m = imp.res.mapping, headers = m.headers, opt = function (sel) { return '<option value="-1">(none)</option>' + headers.map(function (h, i) { return '<option value="' + i + '"' + (sel === i ? ' selected' : '') + '>' + esc(h) + '</option>'; }).join(''); };
    var html = '<details' + (imp.mapOpen ? ' open' : '') + '><summary>Not what you expected? Change how this table is read</summary><div class="maprow" style="margin-top:10px">';
    html += '<label class="field"><span>Each row is</span><select data-map="mode">' + Object.keys(MODE_NAMES).map(function (k) { return '<option value="' + k + '"' + (m.mode === k ? ' selected' : '') + '>' + MODE_NAMES[k] + '</option>'; }).join('') + '</select></label>';
    html += '<label class="field"><span>Separator</span><select data-map="delim">' + [[',', 'Comma'], ['\t', 'Tab'], [';', 'Semicolon'], ['|', 'Bar']].map(function (d) { return '<option value="' + (d[0] === '\t' ? 'tab' : d[0]) + '"' + (imp.res.delimiter === d[0] ? ' selected' : '') + '>' + d[1] + '</option>'; }).join('') + '</select></label>';
    html += '<label class="field"><span>First row</span><select data-map="header"><option value="1"' + (m.header ? ' selected' : '') + '>Is a header (names)</option><option value="0"' + (!m.header ? ' selected' : '') + '>Is data</option></select></label>';
    (ROLES[m.mode] || []).forEach(function (r) { html += '<label class="field"><span>' + r[1] + '</span><select data-role="' + r[0] + '">' + opt(m.cols[r[0]] === undefined ? -1 : m.cols[r[0]]) + '</select></label>'; });
    html += '</div></details>';
    box.innerHTML = html; box.hidden = false;
    var det = box.querySelector('details'); det.addEventListener('toggle', function () { imp.mapOpen = det.open; });
  }
  $('mapping').addEventListener('change', function (e) {
    var imp = S.imp; if (!imp || !imp.res.rows) return;
    var m = JSON.parse(JSON.stringify(imp.res.mapping)), d = imp.res.delimiter, rows = imp.res.rows, t = e.target;
    if (t.dataset.map === 'mode') { var f = NFMImport.guessMapping(rows); m.mode = t.value; m.cols = {}; var keep = f.mode === t.value ? f.cols : {}; Object.keys(keep).forEach(function (k) { m.cols[k] = keep[k]; }); if (t.value !== f.mode) { m.cols.from = 0; m.cols.to = Math.min(1, m.headers.length - 1); if (t.value === 'tree' || t.value === 'nodes') { m.cols = { id: 0 }; if (t.value === 'tree') m.cols.parent = Math.min(1, m.headers.length - 1); else m.cols.links = Math.min(1, m.headers.length - 1); } } }
    else if (t.dataset.map === 'delim') { d = t.value === 'tab' ? '\t' : t.value; var raw = imp.files && imp.files[0] ? imp.files[0].text : ''; rows = NFMImport.parseDelimited(raw, d); var gm = NFMImport.guessMapping(rows); m = gm; }
    else if (t.dataset.map === 'header') { m.header = t.value === '1'; m.headers = m.header ? rows[0].map(function (c, i) { return c.trim() || 'column ' + (i + 1); }) : rows[0].map(function (_, i) { return 'column ' + (i + 1); }); }
    else if (t.dataset.role) { var v = parseInt(t.value, 10); if (v < 0) delete m.cols[t.dataset.role]; else m.cols[t.dataset.role] = v; }
    var out;
    try { out = NFMImport.importTable(rows, m, imp.name, Object.assign({}, imp.opts, { delimiter: d })); } catch (err) { toast('That setting did not work: ' + err.message); return; }
    out.rows = rows; out.delimiter = d; out.mapping = m;
    out.report.notes.unshift('Read as a table with your settings, ' + out.report.rows + ' rows.');
    imp.res = out;
    var g = imp.mode === 'merge' && imp.base.nodes.length ? NFMImport.mergeGraphs(imp.base, out.graph) : out.graph;
    imp.mapOpen = true;
    setGraph(g, false);
  });
  $('b-show').addEventListener('click', function () { showTab('map'); });

  /* ---------------------------------------------------------------- Data tab: tidy, exports, tables */
  var CLEANS = [['sameLabel', 'Merge items with the same name'], ['selfLinks', 'Remove links to self'], ['dupLinks', 'Remove repeated links'], ['isolated', 'Remove items with no links'], ['placeholders', 'Remove placeholders'], ['twoWay', 'Make every link two-way'], ['reverse', 'Reverse every link']];
  $('cleanbtns').innerHTML = CLEANS.map(function (c) { return '<button data-clean="' + c[0] + '">' + c[1] + '</button>'; }).join('');
  $('cleanbtns').addEventListener('click', function (e) {
    var k = e.target.dataset && e.target.dataset.clean; if (!k) return;
    var r = NFMImport.CLEAN[k](S.graph);
    if (!r.changed) { toast('Nothing to change.'); return; }
    setGraph(r.graph, true); toast('Done: ' + r.text + '.');
  });
  function renderTidy() {
    var card = $('tidy'); card.hidden = !S.graph.nodes.length; if (card.hidden) return;
    var sel = $('startsel'), g = S.graph, list = g.nodes.slice(0, 2000);
    var html = '<option value="">(pick automatically)</option>' + list.map(function (n) { return '<option value="' + esc(n.id) + '"' + (g.start === n.id ? ' selected' : '') + '>' + esc(n.label) + '</option>'; }).join('');
    if (g.start && !list.some(function (n) { return n.id === g.start; })) html += '<option value="' + esc(g.start) + '" selected>' + esc((S.byId.get(g.start) || {}).label || g.start) + '</option>';
    sel.innerHTML = html;
  }
  $('startsel').addEventListener('change', function (e) { var v = e.target.value; edit(function (g) { g.start = v || null; }); });

  function download(name, text, type) {
    var blob = new Blob([text], { type: type || 'text/plain' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  var fname = function (ext) { return (S.graph.name || 'map').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) + ext; };
  var csvCell = function (v) { v = v === undefined || v === null ? '' : String(v); if (/^[=+\-@\t\r]/.test(v) && isNaN(Number(v))) v = "'" + v; return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  $('b-exp-json').addEventListener('click', function () { download(fname('.json'), JSON.stringify({ name: S.graph.name, start: S.graph.start, nodes: S.graph.nodes, edges: S.graph.edges }, null, 1), 'application/json'); });
  $('b-exp-links').addEventListener('click', function () { download(fname('-links.csv'), 'from,to,label,weight,kind\n' + S.graph.edges.map(function (e) { return [e.from, e.to, e.label, e.weight, e.kind].map(csvCell).join(','); }).join('\n') + '\n', 'text/csv'); });
  $('b-exp-items').addEventListener('click', function () { download(fname('-items.csv'), 'id,label,group,ending\n' + S.graph.nodes.map(function (n) { return [n.id, n.label, n.group, n.valence].map(csvCell).join(','); }).join('\n') + '\n', 'text/csv'); });

  $('tb-items').addEventListener('click', function () { S.table = 'items'; S.page = 0; renderTable(); });
  $('tb-links').addEventListener('click', function () { S.table = 'links'; S.page = 0; renderTable(); });
  $('filter').addEventListener('input', debounce(function (e) { S.filter = e.target.value.trim().toLowerCase(); S.page = 0; renderTable(); }, 150));
  $('b-prev').addEventListener('click', function () { if (S.page > 0) { S.page--; renderTable(); } });
  $('b-next').addEventListener('click', function () { S.page++; renderTable(); });
  var tableRows = [];
  function renderTable() {
    var g = S.graph; if (!g.nodes.length) return;
    $('tb-items').setAttribute('aria-pressed', S.table === 'items'); $('tb-links').setAttribute('aria-pressed', S.table === 'links');
    var items = S.table === 'items', f = S.filter, rows = [];
    var src = items ? g.nodes : g.edges;
    for (var i = 0; i < src.length; i++) {
      var r = src[i];
      if (f) { var hay = items ? (r.id + ' ' + r.label + ' ' + r.group).toLowerCase() : (r.from + ' ' + r.to + ' ' + r.label + ' ' + r.kind).toLowerCase(); if (hay.indexOf(f) < 0) continue; }
      rows.push(i);
    }
    var pages = Math.max(1, Math.ceil(rows.length / PAGE)); if (S.page >= pages) S.page = pages - 1;
    var slice = rows.slice(S.page * PAGE, S.page * PAGE + PAGE); tableRows = slice;
    $('tinfo').textContent = nfmt(rows.length) + (items ? ' items' : ' links') + (pages > 1 ? ' · page ' + (S.page + 1) + ' of ' + pages : '');
    $('b-prev').disabled = S.page === 0; $('b-next').disabled = S.page >= pages - 1;
    var h;
    if (items) {
      h = '<thead><tr><th>Name</th><th>Label</th><th>Group</th><th>Ending</th><th>In</th><th>Out</th><th></th></tr></thead><tbody>' + slice.map(function (i) {
        var n = g.nodes[i], out = (S.outAdj.get(n.id) || []).length, inn = (S.inAdj.get(n.id) || []).length;
        return '<tr data-i="' + i + '"><td>' + esc(n.id) + (n.ghost ? ' <span class="pill ghost">placeholder</span>' : '') + '</td><td><input data-f="label" value="' + esc(n.label) + '" aria-label="Label of ' + esc(n.id) + '"></td><td><input data-f="group" value="' + esc(n.group) + '" aria-label="Group of ' + esc(n.id) + '"></td><td><select data-f="valence" aria-label="Ending of ' + esc(n.id) + '">' + [['', '—'], ['good', 'Good'], ['bad', 'Bad'], ['neutral', 'Other']].map(function (o) { return '<option value="' + o[0] + '"' + (n.valence === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></td><td>' + inn + '</td><td>' + out + '</td><td><button data-del aria-label="Remove ' + esc(n.id) + '">×</button></td></tr>';
      }).join('') + '</tbody>';
    } else {
      h = '<thead><tr><th>From</th><th>To</th><th>Label</th><th>Weight</th><th>Kind</th><th></th></tr></thead><tbody>' + slice.map(function (i) {
        var e = g.edges[i];
        return '<tr data-i="' + i + '"><td>' + esc((S.byId.get(e.from) || {}).label || e.from) + '</td><td>' + esc((S.byId.get(e.to) || {}).label || e.to) + '</td><td><input data-f="label" value="' + esc(e.label) + '" aria-label="Label of the link"></td><td><input data-f="weight" type="number" step="any" value="' + (e.weight === undefined ? '' : e.weight) + '" aria-label="Weight"></td><td><input data-f="kind" value="' + esc(e.kind) + '" aria-label="Kind"></td><td><button data-del aria-label="Remove this link">×</button></td></tr>';
      }).join('') + '</tbody>';
    }
    $('table').innerHTML = h;
    renderAddLink();
  }
  function renderAddLink() {
    var box = $('addlink'); if (S.table !== 'links') { box.innerHTML = ''; return; }
    if (box.dataset.ready === String(S.gver)) return;
    var dl = '<datalist id="dl-nodes">' + S.graph.nodes.slice(0, 3000).map(function (n) { return '<option value="' + esc(n.id) + '">' + esc(n.label) + '</option>'; }).join('') + '</datalist>';
    box.innerHTML = dl + '<input id="al-from" list="dl-nodes" placeholder="From (name)" aria-label="New link from"><input id="al-to" list="dl-nodes" placeholder="To (name)" aria-label="New link to"><input id="al-label" placeholder="Label (optional)" aria-label="New link label"><button id="al-add">Add link</button>';
    box.dataset.ready = String(S.gver);
    $('al-add').addEventListener('click', function () {
      var a = $('al-from').value.trim(), b = $('al-to').value.trim(), lb = $('al-label').value.trim();
      if (!a || !b) { toast('Fill in both ends of the link.'); return; }
      edit(function (g) {
        [a, b].forEach(function (id) { if (!S.byId.has(id) && !g.nodes.some(function (n) { return n.id === id; })) g.nodes.push({ id: id, label: id, group: '', valence: '', ghost: false, attrs: {} }); });
        g.edges.push({ from: a, to: b, label: lb, weight: undefined, kind: '', attrs: {} });
      });
      toast('Link added.');
    });
  }
  $('table').addEventListener('change', function (e) {
    var tr = e.target.closest('tr'), f = e.target.dataset.f; if (!tr || !f) return;
    var i = +tr.dataset.i, v = e.target.value;
    if (S.table === 'items') edit(function (g) { var n = Object.assign({}, g.nodes[i]); n[f] = f === 'valence' ? v : v.trim(); if (f === 'label' && !n.label) n.label = n.id; g.nodes[i] = n; });
    else edit(function (g) { var ed = Object.assign({}, g.edges[i]); if (f === 'weight') { var w = Number(v); ed.weight = v === '' || !isFinite(w) ? undefined : w; } else ed[f] = v.trim(); g.edges[i] = ed; });
  });
  $('table').addEventListener('click', function (e) {
    if (e.target.dataset.del === undefined) return;
    var tr = e.target.closest('tr'), i = +tr.dataset.i;
    if (S.table === 'items') edit(function (g) { var id = g.nodes[i].id; g.nodes.splice(i, 1); g.edges = g.edges.filter(function (x) { return x.from !== id && x.to !== id; }); if (g.start === id) g.start = null; });
    else edit(function (g) { g.edges.splice(i, 1); });
  });

  /* ================================================================ Map tab =============================================================== */
  var client = null, mgr = null, host = $('host'), stage = $('stage');
  var VIEWS = getEngine().VIEWS;
  var TASKS = [
    ['', 'Pick a question…', null, null],
    ['lead', 'How do things lead on from the start?', 'flow', 'group'],
    ['pass', 'What must everyone pass through?', 'spine', 'choke'],
    ['end', 'Where do players end up, and how likely?', 'river', 'odds'],
    ['outline', 'What is the big picture, in outline?', 'shape', 'group'],
    ['belong', 'Which items belong together?', 'network', 'found'],
    ['lanes', 'Show each group in its own band', 'lanes', 'group'],
    ['grid', 'Show every link in a grid', 'matrix', 'group'],
    ['jump', 'Which links jump far?', 'arc', 'group']
  ];
  var COLORS = [['group', 'Group'], ['found', 'Found groups (worked out from the links)'], ['choke', 'Choke points'], ['traffic', 'Share of routes passing'], ['odds', 'Where players end up'], ['heat', 'How busy (visits)'], ['none', 'No color']];
  $('view').innerHTML = VIEWS.map(function (v) { return '<option value="' + v[0] + '">' + esc(v[1]) + '</option>'; }).join('');
  $('want').innerHTML = TASKS.map(function (t) { return '<option value="' + t[0] + '">' + esc(t[1]) + '</option>'; }).join('');
  $('colorBy').innerHTML = COLORS.map(function (c) { return '<option value="' + c[0] + '">' + esc(c[1]) + '</option>'; }).join('');
  function syncControls() {
    $('view').value = S.opts.view; $('colorBy').value = S.opts.colorBy;
    var v = VIEWS.filter(function (x) { return x[0] === S.opts.view; })[0]; $('blurb').textContent = v ? v[2] : '';
  }
  $('view').addEventListener('change', function (e) { S.opts.view = e.target.value; optsChanged(); });
  $('colorBy').addEventListener('change', function (e) { S.opts.colorBy = e.target.value; optsChanged(); });
  $('want').addEventListener('change', function (e) {
    var t = TASKS.filter(function (x) { return x[0] === e.target.value; })[0]; e.target.value = '';
    if (!t || !t[2]) return;
    S.opts.view = t[2]; S.opts.colorBy = t[3];
    if (t[2] === 'lanes' && S.opts.laneBy === 'group' && !S.graph.nodes.some(function (n) { return n.group; })) { S.opts.laneBy = 'found'; }
    optsChanged();
  });
  function optsChanged() { savePrefs(); syncControls(); refreshMap('options'); }

  function engineColor() { return ['found', 'odds', 'heat'].indexOf(S.opts.colorBy) >= 0 ? S.opts.colorBy : 'group'; }
  function engineOpts() {
    var o = S.opts;
    return { view: o.view, dir: o.dir, fold: o.fold, merge: o.merge, laneBy: o.laneBy, colorBy: engineColor(), mode: o.mode, runs: o.runs, weights: o.weights, traffic: o.traffic, block: S.block.slice(), hideKinds: S.hideKinds.slice(), wantFlow: o.colorBy === 'odds' || o.colorBy === 'heat' };
  }

  /* ---- build and show */
  var busyT;
  function showMsg(html, buttons) {
    var m = $('msg'); m.hidden = false; var d = m.firstElementChild; d.innerHTML = html;
    (buttons || []).forEach(function (b) { var bt = document.createElement('button'); bt.textContent = b[0]; if (b[2]) bt.className = 'primary'; bt.addEventListener('click', b[1]); d.appendChild(bt); });
  }
  function hideMsg() { $('msg').hidden = true; }
  var lastEngineKey = '';
  function refreshMap(reason) {
    if (S.tab !== 'map') return;
    clearTimeout(busyT);
    if (!S.graph.nodes.length) {
      S.L = null; S.scene = null; if (mgr && mgr.r) { mgr.r.setScene(null); } hideInsight(); $('legend').hidden = true;
      showMsg('<b>Nothing to draw yet.</b><span class="muted small">Bring in a table, a JSON file, an outline or a folder of notes on the Data tab.</span>', [['Go to Data', function () { showTab('data'); }, true]]);
      closeDetails(); return;
    }
    if (!client || client.mode === 'starting') { showMsg('<b>Getting ready…</b>'); setTimeout(function () { refreshMap(reason); }, 150); return; }
    var seq = ++S.mapSeq, key = JSON.stringify(engineOpts()) + '|' + S.gver;
    busyT = setTimeout(function () { if (seq === S.mapSeq) showMsg('<b>Working out the map…</b><span class="muted small">' + nfmt(S.graph.nodes.length) + ' items, ' + nfmt(S.graph.edges.length) + ' links</span>'); }, 350);
    var t0 = performance.now();
    client.build(engineOpts()).then(function (res) {
      if (seq !== S.mapSeq) return;
      clearTimeout(busyT); hideMsg();
      S.L = res.L; S.ms = res.ms; S.totalMs = performance.now() - t0; lastEngineKey = key;
      var fk = S.opts.view + '|' + S.gver + '|' + S.opts.dir + '|' + S.opts.laneBy + '|' + S.block.length + '|' + S.hideKinds.length;
      makeScene(fk !== S.fitKey); S.fitKey = fk;
    }).catch(function (err) {
      if (err && err.message === 'superseded') return;
      if (seq !== S.mapSeq) return;
      clearTimeout(busyT);
      var big = /too big/.test(err.message);
      showMsg('<b>' + (big ? 'This map is too big for that view.' : 'The map could not be drawn.') + '</b><span class="muted small">' + esc(err.message) + '</span>', big ? [['Use the Network view', function () { S.opts.view = 'network'; optsChanged(); }, true]] : []);
    });
  }
  function makeScene(fit) {
    if (!S.L) return;
    S.scene = NFMScene.make(S.L, { colorBy: S.opts.colorBy, theme: themeName() });
    restyleSel();
    if (mgr && mgr.r) { mgr.r.setScene(S.scene); }
    if (fit) fitView(); else requestDraw();
    legend(); insight();
    if (S.sel) renderDetails();
    if (fit) { host.classList.remove('fade'); void host.offsetWidth; host.classList.add('fade'); }
  }
  function sceneNodeFor(id) { if (!S.scene || id == null) return null; for (var i = 0; i < S.scene.nodes.length; i++) if (S.scene.nodes[i].nodeId === id) return S.scene.nodes[i]; return null; }
  function neighborSet(id) {
    var s = new Set(); if (!S.scene) return s;
    var me = sceneNodeFor(id); if (!me) return s;
    s.add(me.key);
    (S.outAdj.get(id) || []).forEach(function (e) { var n = sceneNodeFor(e.to); if (n) s.add(n.key); });
    (S.inAdj.get(id) || []).forEach(function (e) { var n = sceneNodeFor(e.from); if (n) s.add(n.key); });
    return s;
  }
  function restyleSel() {
    if (!S.scene) return;
    if (S.sel) { var me = sceneNodeFor(S.sel); NFMScene.restyle(S.scene, neighborSet(S.sel), me && me.key); }
    else NFMScene.restyle(S.scene, null, null);
  }
  function legend() {
    var el = $('legend'), sc = S.scene;
    if (!sc || !sc.legend.length) { el.hidden = true; return; }
    el.hidden = false; el.innerHTML = sc.legend.map(function (l) { return '<span><i style="background:' + NFMScene.css(l[0]) + '"></i>' + esc(l[1]) + '</span>'; }).join('');
  }
  function hideInsight() { $('insight').hidden = true; }
  function goalText(L) { var k = L.imp.goalKind; return k === 'marked good' ? 'the good endings' : k === 'ends' ? 'the endings' : k === 'all ends' ? 'the endings' : 'the farthest items'; }
  function insight() {
    var L = S.L, el = $('insight'); if (!L) { el.hidden = true; return; }
    var p = [], im = L.imp, st = L.startId ? (S.byId.get(L.startId) || {}).label || L.startId : null;
    p.push(nfmt(L.n) + ' items and ' + nfmt(L.m) + ' links');
    if (L.view === 'lanes' && !L.laneNames) p.push('Lanes needs two or more groups; set "Group lanes by" in Options or color by Found groups');
    if (L.kind === 'shape') p.push(L.segs.length ? L.segs.length + ' stretch' + (L.segs.length === 1 ? '' : 'es') + ' between choke points' : 'no choke points, so no shape to show');
    else if (L.view === 'network') p.push('closeness on the page follows how connected things are');
    if (st && L.view !== 'network' && L.view !== 'matrix') {
      p.push(L.autoStart ? 'start is "' + st + '" (picked automatically; change it in Details or on the Data tab)' : 'start is "' + st + '"');
      if (im.chokeCount) p.push(im.chokeCount + ' choke point' + (im.chokeCount === 1 ? '' : 's') + ': every route to ' + goalText(L) + ' passes through ' + (im.chokeCount === 1 ? 'it' : 'them'));
      if (im.routesLog10 >= 2) p.push('roughly 10^' + Math.round(im.routesLog10) + ' different routes');
      if (L.flow && L.flow.outcome) { var o = L.flow.outcome; p.push((L.flow.exact ? 'exactly ' : 'about ') + Math.round(o.good * 100) + '% end well, ' + Math.round(o.bad * 100) + '% badly' + (o.stuck > 0.005 ? ', ' + Math.round(o.stuck * 100) + '% never finish' : '') + (L.flow.exact ? '' : ' (' + nfmt(L.flow.runs) + ' simulated players)')); }
      if (im.reached < L.n) p.push((L.n - im.reached) + ' item' + (L.n - im.reached === 1 ? ' is' : 's are') + ' never reached from the start');
    }
    if (client) p.push('drawn in ' + Math.round(S.ms || 0) + ' ms' + (client.mode === 'worker' ? ' by the helper' : '') + (mgr && mgr.r ? ' with ' + mgr.r.label : ''));
    el.hidden = false; el.textContent = p.join(' · ') + '.';
  }

  /* ---- renderer */
  function stageSize() {
    var r = stage.getBoundingClientRect(), w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height)), dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    while (w * h * dpr * dpr > 9e6 && dpr > 1) dpr -= 0.25;
    return { w: w, h: h, dpr: dpr };
  }
  function applySize() {
    var z = stageSize(); S.stageW = z.w; S.stageH = z.h; S.dpr = z.dpr;
    if (mgr && mgr.r) mgr.r.resize(z.w, z.h, z.dpr);
    requestDraw();
  }
  new ResizeObserver(function () { if (S.tab === 'map') { var was = { w: S.stageW, h: S.stageH }; applySize(); if (S.scene && was.w <= 2) fitView(); } }).observe(stage);
  var drawQueued = false;
  function requestDraw() {
    if (drawQueued) return; drawQueued = true;
    requestAnimationFrame(function () { drawQueued = false; if (mgr && mgr.r && S.scene) { try { mgr.r.draw(S.view); } catch (err) { mgr.log.push('draw: ' + err.message); } } });
  }
  function attach(r) {
    r.resize(S.stageW, S.stageH, S.dpr);
    if (S.scene) r.setScene(S.scene);
    requestDraw(); insight();
    $('chk-method').value = mgr.choice;
  }
  function fitView() {
    if (!S.scene) return;
    var z = stageSize(); S.stageW = z.w; S.stageH = z.h;
    var v = NFMProbe.fitView(S.scene, z.w, z.h); S.fitK = v.k; S.view = v; requestDraw();
  }
  var mgrStarting = false;
  function startRenderer() {
    if (mgr || mgrStarting) return;
    mgrStarting = true;
    mgr = new NFMRender.Manager(host, { onChange: attach, onRebuilt: function (r) { toast('The graphics were reset; the map is back.'); attach(r); }, onStepDown: function (n) { toast('Graphics kept failing, so I switched to a safer way of drawing.'); } });
    mgr.choice = S.method || 'auto';
    var ready = S.canary ? Promise.resolve(S.canary) : NFMProbe.canary();
    ready.then(function (c) {
      S.canary = c;
      mgr.canary = { canvas2d: { ok: true }, webgl2: { ok: c.webgl2.ok && !c.webgl2.software }, webgpu: { ok: c.webgpu.ok && !c.webgpu.software } };
      if (mgr.choice !== 'auto' && c[mgr.choice] && c[mgr.choice].ok) mgr.canary[mgr.choice].ok = true;
      return mgr.start();
    }).catch(function (err) { showMsg('<b>Nothing could draw the map.</b><span class="muted small">' + esc(err.message) + '</span>'); });
  }
  function mapShown() {
    syncControls();
    startRenderer();
    applySize();
    if (!S.scene || S.mapStale !== S.gver) { S.mapStale = S.gver; refreshMap('shown'); } else { requestDraw(); }
  }

  /* ---- pan, zoom, pick */
  var ptrs = new Map(), dragged = false, downAt = null, lastDist = 0;
  function clampZoom(k) { var lo = (S.fitK || 0.1) * 0.25, hi = Math.max(8, (S.fitK || 1) * 12); return Math.max(lo, Math.min(hi, k)); }
  function zoomAt(cx, cy, factor) {
    var k0 = S.view.k, k1 = clampZoom(k0 * factor), f = k1 / k0;
    S.view = { k: k1, tx: cx - (cx - S.view.tx) * f, ty: cy - (cy - S.view.ty) * f }; requestDraw();
  }
  function local(e) { var r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function worldOf(x, y) { return [(x - S.view.tx) / S.view.k, (y - S.view.ty) / S.view.k]; }
  function pickAt(x, y) { if (!S.scene) return null; var w = worldOf(x, y); return NFMScene.pick(S.scene, w[0], w[1], (e_isTouch ? 10 : 4) / S.view.k); }
  var e_isTouch = false;
  stage.addEventListener('pointerdown', function (e) {
    if (e.target.closest('button, .sheet, #msg > div, aside')) return;
    e_isTouch = e.pointerType === 'touch';
    stage.setPointerCapture && stage.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, local(e)); dragged = false; downAt = local(e);
    if (ptrs.size === 2) { var p = Array.from(ptrs.values()); lastDist = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]); }
    stage.focus({ preventScroll: true });
  });
  stage.addEventListener('pointermove', function (e) {
    var p = local(e);
    if (!ptrs.has(e.pointerId)) { if (e.pointerType === 'mouse') hover(p); return; }
    var prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, p);
    if (ptrs.size === 2) {
      var a = Array.from(ptrs.values()), d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]);
      if (lastDist > 0 && d > 0) zoomAt((a[0][0] + a[1][0]) / 2, (a[0][1] + a[1][1]) / 2, d / lastDist);
      lastDist = d; dragged = true; return;
    }
    if (ptrs.size === 1) {
      if (!dragged && Math.hypot(p[0] - downAt[0], p[1] - downAt[1]) < 5) return;
      dragged = true; stage.classList.add('drag');
      S.view = { k: S.view.k, tx: S.view.tx + p[0] - prev[0], ty: S.view.ty + p[1] - prev[1] }; requestDraw(); hideTip();
    }
  });
  function endPtr(e) {
    var had = ptrs.has(e.pointerId); ptrs.delete(e.pointerId); lastDist = 0; stage.classList.remove('drag');
    if (had && !dragged && ptrs.size === 0 && e.type === 'pointerup') {
      var p = local(e), n = pickAt(p[0], p[1]);
      if (n && n.nodeId !== undefined) select(n.nodeId, false); else select(null);
    }
    if (ptrs.size === 1) { dragged = true; }
  }
  stage.addEventListener('pointerup', endPtr); stage.addEventListener('pointercancel', endPtr);
  stage.addEventListener('wheel', function (e) {
    if (e.target.closest('.sheet, aside')) return;
    e.preventDefault(); var p = local(e), dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomAt(p[0], p[1], Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0016)));
  }, { passive: false });
  stage.addEventListener('dblclick', function (e) { if (e.target.closest('button, .sheet')) return; var p = local(e); zoomAt(p[0], p[1], 1.8); });
  $('z-in').addEventListener('click', function () { zoomAt(S.stageW / 2, S.stageH / 2, 1.4); });
  $('z-out').addEventListener('click', function () { zoomAt(S.stageW / 2, S.stageH / 2, 1 / 1.4); });
  $('b-fit').addEventListener('click', fitView);
  var tipEl = $('tip'), hoverRaf = 0;
  function hideTip() { tipEl.hidden = true; }
  function hover(p) {
    if (hoverRaf) return; hoverRaf = requestAnimationFrame(function () {
      hoverRaf = 0; var n = pickAt(p[0], p[1]);
      if (!n || n.nodeId === undefined) { hideTip(); stage.style.cursor = ''; return; }
      stage.style.cursor = 'pointer';
      var g = S.byId.get(n.nodeId), t = (g ? g.label : n.label) + (g && g.group ? ' · ' + g.group : '');
      tipEl.textContent = t; tipEl.hidden = false; tipEl.style.left = Math.min(S.stageW - 270, p[0] + 14) + 'px'; tipEl.style.top = (p[1] + 16) + 'px';
    });
  }
  stage.addEventListener('pointerleave', hideTip);

  /* ---- selection, details, keyboard */
  function select(id, center) {
    S.sel = id; restyleSel();
    if (mgr && mgr.r && mgr.r.restyle) mgr.r.restyle();
    if (id && center) centerOn(id);
    requestDraw(); renderDetails();
    if (id) { var g = S.byId.get(id); say('Selected ' + (g ? g.label : id) + '. ' + (S.outAdj.get(id) || []).length + ' way' + ((S.outAdj.get(id) || []).length === 1 ? '' : 's') + ' on, ' + (S.inAdj.get(id) || []).length + ' way' + ((S.inAdj.get(id) || []).length === 1 ? '' : 's') + ' in.'); }
  }
  function centerOn(id) {
    var n = sceneNodeFor(id); if (!n) return;
    var cx = (n.x + n.w / 2) * S.view.k + S.view.tx, cy = (n.y + n.h / 2) * S.view.k + S.view.ty;
    if (cx < 60 || cx > S.stageW - 60 || cy < 60 || cy > S.stageH - 60) { S.view = { k: S.view.k, tx: S.stageW / 2 - (n.x + n.w / 2) * S.view.k, ty: S.stageH / 2 - (n.y + n.h / 2) * S.view.k }; }
  }
  function closeDetails() { var d = $('details'); d.hidden = true; }
  var detailsBack = null;
  function renderDetails() {
    var d = $('details'), id = S.sel;
    if (!id || !S.byId.has(id)) { d.hidden = true; return; }
    var g = S.byId.get(id), n = sceneNodeFor(id), nn = n && n.n, outs = S.outAdj.get(id) || [], ins = S.inAdj.get(id) || [], L = S.L;
    var blocked = S.block.indexOf(id) >= 0;
    var lab = function (nid) { var x = S.byId.get(nid); return x ? x.label : nid; };
    var chips = function (list, key) { return list.length ? '<div class="chips">' + list.slice(0, 40).map(function (e) { return '<button class="chip" data-go="' + esc(e[key]) + '" title="' + esc(e.label || '') + '">' + esc(lab(e[key])) + '</button>'; }).join('') + (list.length > 40 ? '<span class="muted small">and ' + (list.length - 40) + ' more</span>' : '') + '</div>' : '<span class="muted small">none</span>'; };
    var h = '<div class="row"><h3 style="flex:1">' + esc(g.label) + '</h3><button class="quiet" id="d-close" aria-label="Close details">✕</button></div>';
    h += '<div class="row tight">' + (g.group ? '<span class="pill">' + esc(g.group) + '</span>' : '') + (id === (L && L.startId) ? '<span class="pill">start</span>' : '') + (nn && nn.choke ? '<span class="pill">choke point</span>' : '') + (g.valence ? '<span class="pill ' + (g.valence === 'good' ? 'good' : g.valence === 'bad' ? 'bad' : '') + '">' + (g.valence === 'neutral' ? 'other ending' : g.valence + ' ending') + '</span>' : '') + (g.ghost ? '<span class="pill ghost">placeholder</span>' : '') + (nn && nn.unreached ? '<span class="pill">not reached</span>' : '') + '</div>';
    var rows = [['Ways on', outs.length], ['Ways in', ins.length]];
    if (nn && L && L.startId && L.view !== 'network') { rows.push(['Routes passing through', Math.round((nn.traffic || 0) * 100) + '%']); if (L.flow) { rows.push([L.flow.exact ? 'Expected visits per player' : 'Average visits per player', (nn.visits || 0).toFixed(2)]); if (nn.pGood + nn.pBad > 0.001) rows.push(['Ends well from here', Math.round(nn.pGood / (nn.pGood + nn.pBad) * 100) + '%']); } }
    h += '<table class="t"><tbody>' + rows.map(function (r) { return '<tr><td>' + r[0] + '</td><td><b>' + r[1] + '</b></td></tr>'; }).join('') + '</tbody></table>';
    h += '<div><b class="small">Leads to</b>' + chips(outs, 'to') + '</div><div><b class="small">Comes from</b>' + chips(ins, 'from') + '</div>';
    var attrs = Object.keys(g.attrs || {}); if (attrs.length) h += '<div><b class="small">Details from the data</b><table class="t"><tbody>' + attrs.slice(0, 12).map(function (k) { return '<tr><td>' + esc(k) + '</td><td>' + esc(String(g.attrs[k]).slice(0, 120)) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    h += '<div class="row tight"><button data-act="start">Make this the start</button>' + (!outs.length ? '<button data-act="good">Mark as good ending</button><button data-act="bad">Mark as bad ending</button>' : '') + (g.valence ? '<button data-act="clear">Clear ending mark</button>' : '') + '<button data-act="block">' + (blocked ? 'Put it back' : 'Take it out (what if)') + '</button></div>';
    if (outs.length) h += '<span class="muted small">Good and bad marks are for endings, items with no way on.</span>';
    d.innerHTML = h; d.hidden = false;
    if (detailsBack) detailsBack.destroy();
    if (window.matchMedia && matchMedia('(max-width:760px)').matches && window.BackClose) detailsBack = BackClose.watch(d, function () { select(null); });
  }
  $('details').addEventListener('click', function (e) {
    var go = e.target.closest('[data-go]'); if (go) { select(go.dataset.go, true); return; }
    if (e.target.closest('#d-close')) { select(null); return; }
    var a = e.target.dataset.act; if (!a || !S.sel) return;
    var id = S.sel;
    if (a === 'start') edit(function (g) { g.start = id; });
    else if (a === 'good' || a === 'bad') edit(function (g) { var i = g.nodes.findIndex(function (n) { return n.id === id; }); g.nodes[i] = Object.assign({}, g.nodes[i], { valence: a }); });
    else if (a === 'clear') edit(function (g) { var i = g.nodes.findIndex(function (n) { return n.id === id; }); g.nodes[i] = Object.assign({}, g.nodes[i], { valence: '' }); });
    else if (a === 'block') { var i = S.block.indexOf(id); if (i >= 0) S.block.splice(i, 1); else S.block.push(id); renderOptions(); refreshMap('block'); renderDetails(); }
  });
  stage.addEventListener('keydown', function (e) {
    if (e.target !== stage) return;
    var k = e.key, id = S.sel;
    if (k === '+' || k === '=') { zoomAt(S.stageW / 2, S.stageH / 2, 1.3); e.preventDefault(); return; }
    if (k === '-' || k === '_') { zoomAt(S.stageW / 2, S.stageH / 2, 1 / 1.3); e.preventDefault(); return; }
    if (k === '0') { fitView(); e.preventDefault(); return; }
    if (k === 'Escape') { if (id) select(null); return; }
    if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Enter'].includes(k)) return;
    e.preventDefault();
    if (!id) { var first = S.L && S.L.startId; if (!first && S.scene && S.scene.nodes.length) first = S.scene.nodes[0].nodeId; if (first) select(first, true); return; }
    if (k === 'Enter') { renderDetails(); var d = $('details'); if (!d.hidden) d.querySelector('button').focus(); return; }
    if (k === 'ArrowRight' || (k === 'ArrowDown' && S.opts.dir === 'TB' && !S.ring)) {
      var outs = S.outAdj.get(id) || []; if (!outs.length) { say('No way on from here.'); return; }
      S.ring = { list: outs.map(function (x) { return x.to; }), i: 0 }; select(S.ring.list[0], true); return;
    }
    if (k === 'ArrowLeft') { var ins = S.inAdj.get(id) || []; if (!ins.length) { say('Nothing leads here.'); return; } var par = ins[0].from; var sib = (S.outAdj.get(par) || []).map(function (x) { return x.to; }); S.ring = { list: sib, i: Math.max(0, sib.indexOf(id)) }; select(par, true); return; }
    if (S.ring && S.ring.list.length > 1 && S.ring.list.indexOf(id) >= 0) {
      var n = S.ring.list.length, i = S.ring.list.indexOf(id) + (k === 'ArrowDown' ? 1 : -1); i = (i + n) % n; S.ring.i = i; select(S.ring.list[i], true); return;
    }
    say('No other choice at this point.');
  });

  /* ---- options sheet */
  var optsEl = $('options');
  function renderOptions() {
    var o = S.opts, h = '';
    h += '<div class="head"><h3>Options</h3><button class="quiet" data-close aria-label="Close options">✕</button></div>';
    h += '<div class="field"><span>Direction (Flow view)</span><div class="seg" role="group"><button data-dir="LR" aria-pressed="' + (o.dir === 'LR') + '">Left to right</button><button data-dir="TB" aria-pressed="' + (o.dir === 'TB') + '">Top to bottom</button></div></div>';
    h += '<label><input type="checkbox" data-o="fold"' + (o.fold ? ' checked' : '') + '> Fold straight runs of items into one box</label>';
    h += '<label><input type="checkbox" data-o="merge"' + (o.merge ? ' checked' : '') + '> Merge parallel arrows</label>';
    h += '<label><input type="checkbox" data-o="traffic"' + (o.traffic ? ' checked' : '') + '> Make busy items bigger</label>';
    h += '<label class="field"><span>Group lanes by</span><select data-o="laneBy"><option value="group">The group column</option><option value="found">Found groups (from the links)</option>' + S.attrKeys.map(function (k) { return '<option value="' + esc(k) + '">' + esc(k) + '</option>'; }).join('') + '</select></label>';
    h += '<label class="field"><span>How simulated players choose</span><select data-o="mode"><option value="random">At random (exact odds, no dice)</option><option value="first">First-timers: always the first option</option><option value="curious">Curious: prefer places not seen yet</option></select></label>';
    if (o.mode !== 'random') h += '<label class="field"><span>Number of simulated players</span><select data-o="runs">' + [500, 2000, 10000, 50000].map(function (r) { return '<option value="' + r + '"' + (o.runs === r ? ' selected' : '') + '>' + nfmt(r) + '</option>'; }).join('') + '</select></label>';
    h += '<label><input type="checkbox" data-o="weights"' + (o.weights ? ' checked' : '') + '> Use link weights as the odds of taking a link</label>';
    h += '<div class="field"><span>Taken out for "what if" (' + S.block.length + ')</span>' + (S.block.length ? '<div class="chips">' + S.block.map(function (id) { var n = S.byId.get(id); return '<span class="chip x" data-unblock="' + esc(id) + '" role="button" tabindex="0">' + esc(n ? n.label : id) + '</span>'; }).join('') + '</div><button data-unblockall>Put everything back</button>' : '<span class="muted small">Select an item and choose "Take it out" to see what happens without it.</span>') + '</div>';
    if (S.kinds.length) h += '<div class="field"><span>Kinds of link to show</span>' + S.kinds.map(function (k) { return '<label><input type="checkbox" data-kind="' + esc(k) + '"' + (S.hideKinds.indexOf(k) < 0 ? ' checked' : '') + '> ' + esc(k) + '</label>'; }).join('') + '</div>';
    optsEl.innerHTML = h;
    optsEl.querySelector('[data-o=laneBy]').value = o.laneBy; optsEl.querySelector('[data-o=mode]').value = o.mode;
  }
  var optsBack = null;
  function toggleSheet(el, on) {
    if (on === undefined) on = el.hidden;
    if (on) { ['options', 'compare'].forEach(function (id) { if ($(id) !== el) $(id).hidden = true; }); }
    el.hidden = !on;
    if (on && window.BackClose && window.matchMedia && matchMedia('(max-width:760px)').matches) { if (optsBack) optsBack.destroy(); optsBack = BackClose.watch(el, function () { el.hidden = true; }); }
  }
  $('b-opts').addEventListener('click', function () { renderOptions(); toggleSheet(optsEl); });
  optsEl.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest('[data-close]')) { optsEl.hidden = true; return; }
    if (t.dataset.dir) { S.opts.dir = t.dataset.dir; renderOptions(); optsChanged(); return; }
    if (t.dataset.unblock !== undefined) { S.block = S.block.filter(function (x) { return x !== t.dataset.unblock; }); renderOptions(); refreshMap('block'); return; }
    if (t.dataset.unblockall !== undefined) { S.block = []; renderOptions(); refreshMap('block'); }
  });
  optsEl.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset.unblock !== undefined) { e.preventDefault(); e.target.click(); } });
  optsEl.addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.kind) { var k = t.dataset.kind, i = S.hideKinds.indexOf(k); if (t.checked && i >= 0) S.hideKinds.splice(i, 1); else if (!t.checked && i < 0) S.hideKinds.push(k); refreshMap('kinds'); return; }
    var f = t.dataset.o; if (!f) return;
    S.opts[f] = t.type === 'checkbox' ? t.checked : (f === 'runs' ? +t.value : t.value);
    if (f === 'mode') renderOptions();
    optsChanged();
  });

  /* ---- compare sheet */
  var cmpEl = $('compare');
  $('b-compare').addEventListener('click', function () {
    if (!S.graph.nodes.length) { toast('Bring in some data first.'); return; }
    toggleSheet(cmpEl, true);
    cmpEl.innerHTML = '<div class="head"><h3>Compare views</h3><button class="quiet" data-close aria-label="Close">✕</button></div><p class="muted small" style="margin:0">Working out all the views…</p>';
    var o = engineOpts(); o.wantFlow = false;
    client.compare(o).then(function (r) { renderCompare(r.L); }).catch(function (err) { if (err.message !== 'superseded') cmpEl.innerHTML += '<p>' + esc(err.message) + '</p>'; });
  });
  var SCORE_NAMES = [['crossings', 'Few crossings'], ['neighbors', 'Neighbors stay close'], ['groups', 'Groups together'], ['flow', 'Reads in one direction'], ['compact', 'Compact'], ['speed', 'Quick to make']];
  function renderCompare(rows) {
    var E = getEngine(), names = {}; E.VIEWS.forEach(function (v) { names[v[0]] = v[1]; });
    var pct = function (x) { return x === null || x === undefined ? '–' : Math.round(x * 100); };
    var best = {}; ['edit', 'beats', 'groups'].forEach(function (t) { var b = -1; rows.forEach(function (r) { if (r.tasks && r.tasks[t] > b) { b = r.tasks[t]; best[t] = r.view; } }); });
    var h = '<div class="head"><h3>Compare views</h3><button class="quiet" data-close aria-label="Close">✕</button></div><p class="muted small" style="margin:0">Scores are 0 to 100, higher is better. The three tasks weigh the scores differently. Click a row to open that view.</p><div class="tablewrap"><table class="t"><thead><tr><th>View</th>' + ['edit', 'beats', 'groups'].map(function (t) { return '<th>' + E.TASKS[t].label + '</th>'; }).join('') + SCORE_NAMES.map(function (s) { return '<th>' + s[1] + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (r) {
      if (r.skipped) { h += '<tr><td>' + esc(names[r.view]) + '</td><td colspan="' + (3 + SCORE_NAMES.length) + '" class="muted">' + esc(r.skipped) + '</td></tr>'; return; }
      h += '<tr data-view="' + r.view + '" style="cursor:pointer"><td><b>' + esc(names[r.view]) + '</b></td>' + ['edit', 'beats', 'groups'].map(function (t) { return '<td class="' + (best[t] === r.view ? 'best' : '') + '">' + pct(r.tasks[t]) + '</td>'; }).join('') + SCORE_NAMES.map(function (s) { return '<td>' + pct(r.scores[s[0]]) + '</td>'; }).join('') + '</tr>';
    });
    cmpEl.innerHTML = h + '</tbody></table></div>';
  }
  cmpEl.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) { cmpEl.hidden = true; return; }
    var tr = e.target.closest('tr[data-view]'); if (tr) { S.opts.view = tr.dataset.view; cmpEl.hidden = true; optsChanged(); }
  });

  /* ---- exports */
  $('b-svg').addEventListener('click', function () { if (!S.scene) { toast('Nothing to save yet.'); return; } download(fname('-' + S.opts.view + '.svg'), NFMScene.toSvg(S.scene, S.graph.name + ' (' + S.opts.view + ')'), 'image/svg+xml'); });
  $('b-png').addEventListener('click', function () {
    if (!S.scene) { toast('Nothing to save yet.'); return; }
    var sc = S.scene, k = Math.min(2, 4000 / Math.max(sc.w, sc.h)), w = Math.max(200, Math.round(sc.w * k)), h = Math.max(200, Math.round(sc.h * k));
    var hostEl = document.createElement('div'); hostEl.style.cssText = 'position:fixed;left:-9999px;top:0;width:' + w + 'px;height:' + h + 'px'; document.body.appendChild(hostEl);
    NFMRender.createCanvas2D(hostEl, {}).then(function (r) {
      r.setScene(sc); r.resize(w, h, 1); r.draw({ k: k, tx: -sc.x0 * k, ty: -sc.y0 * k });
      var c = document.createElement('canvas'); c.width = w; c.height = h; var x = c.getContext('2d'); x.drawImage(hostEl.children[0], 0, 0); x.drawImage(hostEl.children[1], 0, 0);
      c.toBlob(function (b) { hostEl.remove(); if (!b) { toast('The picture could not be made.'); return; } var url = URL.createObjectURL(b), a = document.createElement('a'); a.href = url; a.download = fname('-' + S.opts.view + '.png'); document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000); }, 'image/png');
    });
  });

  /* ---- device check */
  var chk = $('dlg-check');
  $('btn-check').addEventListener('click', function () { chk.showModal(); $('chk-method').value = (mgr && mgr.choice) || S.method || 'auto'; });
  $('chk-close').addEventListener('click', function () { chk.close(); });
  $('chk-method').addEventListener('change', function (e) { S.method = e.target.value; savePrefs(); if (mgr) { var c = e.target.value; if (c !== 'auto' && S.canary && S.canary[c]) mgr.canary[c] = { ok: true }; mgr.use(c).then(function (r) { toast('Now drawing with ' + r.label + '.'); }); } });
  function syntheticScene(n, m, seed) {
    var s = seed | 0, rnd = function () { s = (s + 0x6d2b79f5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    var cols = Math.ceil(Math.sqrt(n * 1.6)), nodes = [], pos = {}, edges = [];
    for (var i = 0; i < n; i++) { var nd = { id: 'n' + i, nodeId: 'n' + i, label: 'Item ' + i, sub: '', group: 'g' + (i % 7), x: (i % cols) * 230, y: Math.floor(i / cols) * 90, w: 176, h: 56, layer: i % cols, traffic: rnd(), choke: i % 17 === 0, visits: rnd(), pGood: rnd(), pBad: rnd(), pNeutral: 0, deg: 2, start: i === 0, end: i % 29 === 0, valence: i % 29 === 0 ? (i % 2 ? 'good' : 'bad') : '', unreached: false, ghost: false, run: false, k: 1 }; nodes.push(nd); pos[nd.id] = nd; }
    for (var j = 0; j < m; j++) { var a = Math.floor(rnd() * n), b = Math.min(n - 1, a + 1 + Math.floor(rnd() * cols * 1.5)); edges.push({ from: 'n' + a, to: 'n' + b, label: '', count: 1, flow: rnd(), weight: 1, kind: b % cols > a % cols ? 'fwd' : 'back', pts: [] }); }
    edges.forEach(function (e) { if (e.kind === 'back') e.kind = 'fwd'; });
    var L = { kind: 'nodes', dir: 'LR', view: 'flow', nodes: nodes, edges: edges, pos: pos, lanes: [], width: cols * 230, height: Math.ceil(n / cols) * 90, imp: { goal: [], goalKind: '', spine: [], routesLog10: 0, reached: n, chokeCount: 0 } };
    return NFMScene.make(L, { colorBy: 'odds', theme: themeName() });
  }
  $('chk-run').addEventListener('click', function () {
    var out = $('chk-out'), btn = $('chk-run'); btn.disabled = true; out.innerHTML = '<p class="muted" id="chk-step">Starting…</p>';
    NFMProbe.check({
      onStep: function (t) { var el = $('chk-step'); if (el) el.textContent = t; },
      makeScene: function (kind) {
        if (kind === 'stress') return syntheticScene(1600, 3600, 5);
        var E = getEngine(), x = NFMExamples.LIST[0].load(), L = E.build(x.graph, { view: 'flow', colorBy: 'odds', wantFlow: true });
        return NFMScene.make(L, { colorBy: 'odds', theme: 'light' });
      }
    }).then(function (r) {
      out.innerHTML = '<div class="verdict ' + r.verdict + '">' + esc(r.headline) + '</div><ul class="checks" style="margin-top:10px">' + r.lines.map(function (l) { return '<li class="' + (l.ok === true ? 'ok' : l.ok === false ? 'no' : 'meh') + '">' + esc(l.text) + '</li>'; }).join('') + '</ul><p class="muted small">Took ' + r.data.seconds.toFixed(1) + ' seconds. Version @@VERSION@@.</p>';
      S.checkResult = r;
    }).catch(function (err) { out.innerHTML = '<div class="verdict limited">The check itself ran into a problem: ' + esc(err.message) + '</div>'; }).then(function () { btn.disabled = false; });
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) requestDraw(); });

  /* ---------------------------------------------------------------- boot */
  loadPrefs(); applyTheme(); syncControls();
  client = new NFMEngineClient.Client(engineSrc, getEngine);
  var saved = LS.get('nfm-graph');
  if (saved) { try { S.graph = NFMImport.sanitizeGraph(JSON.parse(saved)); S.gver++; } catch (e) { LS.del('nfm-graph'); } }
  indexGraph(); renderReport(); renderTidy(); renderTable(); renderOptions();
  $('b-undo').disabled = true;
  client.start().then(function () { client.setGraph(S.graph); if (S.tab === 'map') refreshMap('boot'); });
  window.NFM = { state: S, engine: getEngine, client: function () { return client; }, manager: function () { return mgr; }, showTab: showTab, setGraph: setGraph, ingest: ingest, refreshMap: refreshMap, select: select };
})();
