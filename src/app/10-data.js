/*!
 * Netflow Map app, part 2: the Data tab (bring in, what I found, columns workbench). Copyright (c) 2026 LFC Foundry. MIT License.
 */
/* ---------------------------------------------------------------- intake */
var TEXT_EXT = /\.(md|markdown|txt|text|csv|tsv|tab|psv|dsv|prn|json|canvas|jsonl|ndjson|dot|gv|gml|graphml|gexf|xml)$/i, ARCHIVE_EXT = /\.(zip|xlsx|xlsm)$/i, NOTE_EXT = /\.(md|markdown|txt)$/i;
var MAX_FILES = 5000, MAX_NOTE = 1500000, MAX_ONE = 60000000, MAX_ZIP = 300000000, skippedCount = 0, archiveNotes = [];
function asBytes(file) {
  if (file.arrayBuffer) return file.arrayBuffer().then(function (b) { return new Uint8Array(b); });
  return new Promise(function (ok, no) { var fr = new FileReader(); fr.onload = function () { ok(new Uint8Array(fr.result)); }; fr.onerror = no; fr.readAsArrayBuffer(file); });
}
/** A .zip or .xlsx: opened here (safely, with limits) into several text files. */
function readArchive(file, path) {
  var name = file.name;
  if (file.size > MAX_ZIP) { archiveNotes.push('"' + name + '" is larger than ' + Math.round(MAX_ZIP / 1e6) + ' MB and was not opened.'); return Promise.resolve(null); }
  busy('Opening ' + name + '…');
  return asBytes(file).then(function (u8) { return NFMUnpack.expand(u8, name); }).then(function (r) {
    r.notes.forEach(function (n) { archiveNotes.push(n); });
    var base = (path && path.indexOf('/') > 0 ? path.replace(/[^\/]*$/, '') : '');
    return r.files.map(function (f) { return { name: f.name, path: base + name + '!/' + f.path, text: f.text }; });
  }, function (err) { archiveNotes.push('"' + name + '": ' + (err && err.message || 'could not be opened') ); return null; });
}
function readFile(file, path) {
  return new Promise(function (resolve) {
    var name = file.name, isNote = NOTE_EXT.test(name);
    if (/\.lfc$/i.test(name)) { MAPFILE.queue.push(file); return resolve(null); }   /* a map file is opened whole, not read as text */
    if (ARCHIVE_EXT.test(name) || file.type === 'application/zip' || file.type === 'application/x-zip-compressed' || /spreadsheetml/.test(file.type || '')) return resolve(readArchive(file, path));
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
      entry.file(function (f) { acc.count++; readFile(f, path + entry.name).then(function (r) { if (r) acc.files.push.apply(acc.files, [].concat(r)); resolve(); }); }, function () { resolve(); });
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
  return Promise.all(Array.prototype.slice.call(dt.files).map(function (f) { return readFile(f, f.name); })).then(flatten);
}
function flatten(list) { var out = []; list.forEach(function (r) { if (r) out.push.apply(out, [].concat(r)); }); return out; }
function filesFromInput(list) {
  var arr = Array.prototype.slice.call(list).filter(function (f) { return !hiddenPath(f.webkitRelativePath || f.name); }).slice(0, MAX_FILES);
  return Promise.all(arr.map(function (f) { return readFile(f, f.webkitRelativePath || f.name); })).then(flatten);
}
function importMode() { return document.querySelector('input[name=mode]:checked').value; }
function importOptions() { return { format: $('fmt').value, outlineSeparate: $('o-sep').checked, keepDuplicates: $('o-dups').checked }; }
function busy(msg) { var c = $('report'); c.hidden = false; $('stats').textContent = ''; mount($('notes'), h('li', null, msg)); $('mapping').hidden = true; }
function renderError(msg) { var c = $('report'); c.hidden = false; $('stats').textContent = ''; $('mapping').hidden = true; mount($('notes'), h('li', null, [h('b', null, 'I could not read that. '), msg])); }

/* Files under this many characters are read on the page: a round trip to the worker costs more than reading them (2,000 items: 28 ms on the page, 38 ms through the worker; 8,000 items: 85 and 104). */
var WORKER_READ_MIN = 1000000;
/** Everything that brings data in goes through here. */
function ingest(files, extra, open) {
  if (MAPFILE.queue.length) { var mf = MAPFILE.queue[0]; MAPFILE.queue = []; skippedCount = 0; return openMapFile(mf); }
  if (!files.length) {
    if (archiveNotes.length) { var why = archiveNotes.join(' '); archiveNotes = []; skippedCount = 0; renderError(why); return Promise.resolve(); }
    toast('Nothing readable was found. Tables, JSON, graph files, outlines, notes, Excel and zips of these work.'); return Promise.resolve();
  }
  busy('Reading ' + plural(files.length, 'file') + '…');
  return nextFrame().then(function () {
    var opts = Object.assign(importOptions(), extra || {});
    /* the worker reads the file when it can (the page is held about a quarter as long); otherwise, and for a merge, the page reads it as before */
    var chars = files.reduce(function (n, f) { return n + (f.text ? f.text.length : 0); }, 0);
    var viaWorker = importMode() === 'merge' || chars < WORKER_READ_MIN ? Promise.resolve(null) : client.importFiles(files, opts).catch(function () { return null; });   /* any trouble in the worker: the page reads it, and shows the real message if the file is bad */
    return viaWorker.then(function (r) {
      if (r) { r.rowsDropped && files.length === 1 && (r.rowsFrom = files[0].text); delete r.rowsDropped; return r; }
      return NFMImport.importAny(files, opts);
    }).then(function (res) { afterRead(files, opts, res, open); }, function (err) { renderError(String(err && err.message || err).replace(/^Error: /, '')); });
  });
}
function afterRead(files, opts, res, open) {
  {
    var base = S.graph, mode = importMode();
    S.imp = leanImport({ files: files, opts: opts, base: mode === 'merge' ? base : null, mode: mode, res: res, name: res.graph.name });   /* the graph before is kept only to merge into again */
    var merged = mode === 'merge' && base.nodes.length, g = merged ? NFMImport.mergeGraphs(base, res.graph) : res.graph;
    g.name = merged ? base.name : res.graph.name;
    if (skippedCount) res.report.notes.push(plural(skippedCount, 'file was', 'files were') + ' skipped (not text, too large, or hidden).');
    skippedCount = 0;
    if (archiveNotes.length) { archiveNotes.forEach(function (n) { res.report.notes.push(n); }); archiveNotes = []; }
    SAFE.del('nfm-v:' + g.name);
    if (res.ix && !merged) HANDIX = { g: g, fi: res.ix.fi, ti: res.ix.ti, kinds: res.ix.kinds };   /* where each link's ends sit and the link kinds, worked out by the worker */
    if (res.prof && !merged) HANDPROF = { g: g, p: res.prof };   /* the worker worked out the column profile while it read the file */
    setGraph(g, true, merged); shareTextSoon();
    if (open && !merged && cleanRead(res, g)) { autoOpen(res, g); return; }   /* a table that reads cleanly goes straight to the map (a Sankey when it has from, to and a weight); anything unclear stops here on the Data tab */
    $('report').scrollIntoView({ behavior: 'auto', block: 'nearest' });
  }
}
/* A table read counts as clean when it is one table of links (or a parent column), the header row was found, the file said nothing but how it was read,
   and nothing was merged, dropped, left out or shortened. Anything else stays on the Data tab so the person can check it first. */
function cleanRead(res, g) {
  var m = res && res.mapping, c = res && res.report && res.report.counts;
  if (!m || res.kind !== 'table' || (m.mode !== 'edges' && m.mode !== 'tree') || m.guessedHeader) return false;
  if (!res.report.notes || res.report.notes.length !== 1 || !g.nodes.length) return false;
  if (c) for (var k in c) if (c[k]) return false;
  return true;
}
var AUTO_SANKEY_MAX = 2000;
function autoOpen(res, g) {
  var m = res.mapping;
  if (m.mode === 'edges' && m.cols.weight !== undefined && g.nodes.length >= 2 && g.nodes.length <= AUTO_SANKEY_MAX && g.edges.length) { setV({ view: 'sankey', colorBy: 'odds' }, 'none'); res.report.notes.push('Opened as a Sankey because the table has from, to and amount columns. Other views: Look tab, or Ask.'); }
  showTab('map');
}
function bindIntake() {
  $('b-files').addEventListener('click', function () { $('in-files').click(); });
  $('b-folder').addEventListener('click', function () { $('in-folder').click(); });
  $('drop').addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('in-files').click(); } });
  $('in-files').addEventListener('change', function (e) { var l = e.target.files; if (l && l.length) filesFromInput(l).then(function (f) { return ingest(f, null, true); }); e.target.value = ''; });
  $('in-folder').addEventListener('change', function (e) { var l = e.target.files; if (l && l.length) filesFromInput(l).then(function (f) { return ingest(f, null, true); }); e.target.value = ''; });
  $('b-paste').addEventListener('click', function () { $('pastebox').hidden = false; $('paste').focus(); });
  $('b-pastex').addEventListener('click', function () { $('pastebox').hidden = true; });
  $('b-read').addEventListener('click', function () { var t = $('paste').value; if (!t.trim()) { toast('Paste something first.'); return; } ingest([{ name: 'Pasted data', text: t }], null, true).then(function () { $('pastebox').hidden = true; }); });
  ['dragenter', 'dragover'].forEach(function (ev) { document.addEventListener(ev, function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) { e.preventDefault(); if (S.tab === 'data') $('drop').classList.add('over'); } }); });
  document.addEventListener('dragleave', function (e) { if (!e.relatedTarget) $('drop').classList.remove('over'); });
  document.addEventListener('drop', function (e) {
    if (!e.dataTransfer || !e.dataTransfer.types || Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') < 0) return;
    e.preventDefault(); $('drop').classList.remove('over'); showTab('data');
    filesFromDrop(e.dataTransfer).then(function (f) { return ingest(f, null, true); });
  });
  document.addEventListener('paste', function (e) {
    if (S.tab !== 'data' || /input|textarea|select/i.test(e.target.tagName || '')) return;
    var t = e.clipboardData && e.clipboardData.getData('text'); if (t && t.trim()) { e.preventDefault(); ingest([{ name: 'Pasted data', text: t }], null, true); }
  });
  var exSel = $('examples');
  NFMExamples.LIST.forEach(function (x) { exSel.appendChild(opt(x.id, x.title)); });
  $('b-example').addEventListener('click', function () {
    var x = NFMExamples.LIST.filter(function (e) { return e.id === exSel.value; })[0];
    busy('Loading the example…');
    nextFrame().then(function () {
      var res = x.load(), base = S.graph, mode = importMode(), merged = mode === 'merge' && base.nodes.length;
      S.imp = { files: null, opts: {}, base: mode === 'merge' ? base : null, mode: mode, res: res, name: res.graph.name };
      res.report.notes.push(x.blurb);
      SAFE.del('nfm-v:' + res.graph.name);
      setGraph(merged ? NFMImport.mergeGraphs(base, res.graph) : res.graph, true, merged); shareTextSoon();
    });
  });
  $('b-undo').addEventListener('click', undo);
}

/* The cells of an imported table are kept for "Change how this table is read". They take more memory than the map itself (300,000 rows:
   about 49 MB in Node, the map 75 MB), so when the file's text is at hand only the text is kept and the cells are read again from it when
   a setting there changes: the same cells, since they come from the same text with the same separator. */
function leanImport(imp) {
  var r = imp.res;
  if (r && r.rows && r.kind !== undefined && r.kind !== 'table') return imp;
  if (r && r.rows && r.delimiter && imp.files && imp.files.length === 1 && typeof imp.files[0].text === 'string') { r.rowsFrom = imp.files[0].text; r.rows = null; }
  return imp;
}
function importRows(imp) { var r = imp.res; return r.rows || NFMImport.parseDelimited(r.rowsFrom, r.delimiter); }

/* ---------------------------------------------------------------- what I found */
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
  /* placeholders: counted by the item index, kept up for changed items (a pass over every item was about 8 ms of each change on a 16 MB
     table, Chromium); items with no way on: counted from the link list's own numbers (on a 16 MB table a name lookup per item took about 27 ms of every change) */
  var ghosts = IDX.g === g && IDX.ghosts >= 0 ? IDX.ghosts : g.nodes.filter(function (n) { return n.ghost; }).length, ends = S.outAdj.none ? S.outAdj.none() : -1;
  if (ends < 0) ends = g.nodes.filter(function (n) { return !S.outAdj.has(n.id); }).length;
  var stat = function (b, s, small) { return h('div', { class: 'stat' }, [h('b', small ? { style: { fontSize: '15px' } } : null, b), h('span', null, s)]); };
  mount($('stats'), [stat(nfmt(g.nodes.length), word('items')), stat(nfmt(nEdges(g)), word('links')), stat(nfmt(ends), 'with no way on'), ghosts ? stat(nfmt(ghosts), 'placeholders') : null,
    g.start ? stat((S.byId.get(g.start) || {}).label || g.start, 'start', true) : null,
    S.prof ? stat(nfmt(S.prof.nodes.filter(function (c) { return !c.builtin; }).length + S.prof.edges.filter(function (c) { return !c.builtin; }).length), 'extra columns') : null]);
  var notes = S.imp ? S.imp.res.report.notes : [];
  mount($('notes'), (g.nodes.length ? [] : [h('li', null, 'The data is empty now.')]).concat(notes.map(function (n) { return h('li', null, n); })));
  $('undoinfo').textContent = S.hist.length ? plural(S.hist.length, 'step') + ' can be undone' : '';
  if (!$('b-show')) {
    var row = $('b-undo').parentNode;
    row.appendChild(h('button', { id: 'b-show', class: 'primary', onclick: function () { showTab('map'); } }, 'Show the map'));
    row.appendChild(h('button', { id: 'b-chk', onclick: function () { showTab('check'); } }, 'Check the data'));
  }
  renderMapping();
}
function renderMapping() {
  var box = $('mapping'), imp = S.imp;
  if (!imp || !(imp.res.rows || imp.res.rowsFrom) || !imp.res.mapping) { box.hidden = true; return; }
  var m = imp.res.mapping, headers = m.headers;
  var sel = function (attrs, cur, items) { var s = h('select', attrs, items.map(function (o) { return opt(o[0], o[1], String(o[0]) === String(cur)); })); s.value = cur; return s; };
  var cols = [[-1, '(none)']].concat(headers.map(function (x, i) { return [i, x]; }));
  var body = h('div', { class: 'maprow', style: { marginTop: '10px' } }, [
    field('Each row is', sel({ 'data-map': 'mode' }, m.mode, Object.keys(MODE_NAMES).map(function (k) { return [k, MODE_NAMES[k]]; }))),
    field('Separator', sel({ 'data-map': 'delim' }, imp.res.delimiter === '\t' ? 'tab' : imp.res.delimiter, [[',', 'Comma'], ['tab', 'Tab'], [';', 'Semicolon'], ['|', 'Bar']])),
    field('First row', sel({ 'data-map': 'header' }, m.header ? '1' : '0', [['1', 'Is a header (names)'], ['0', 'Is data']]))
  ].concat((ROLES[m.mode] || []).map(function (r) { return field(r[1], sel({ 'data-role': r[0] }, m.cols[r[0]] === undefined ? -1 : m.cols[r[0]], cols)); })));
  var det = h('details', { open: !!imp.mapOpen }, [h('summary', null, 'Not what you expected? Change how this table is read'), body]);
  det.addEventListener('toggle', function () { imp.mapOpen = det.open; });
  mount(box, det); box.hidden = false;
}
function bindMapping() {
  $('mapping').addEventListener('change', function (e) {
    var imp = S.imp; if (!imp || !(imp.res.rows || imp.res.rowsFrom)) return;
    var m = JSON.parse(JSON.stringify(imp.res.mapping)), d = imp.res.delimiter, rows = importRows(imp), t = e.target;
    if (t.dataset.map === 'mode') {
      var f = NFMImport.guessMapping(rows); m.mode = t.value; m.cols = {};
      var keep = f.mode === t.value ? f.cols : {}; Object.keys(keep).forEach(function (k) { m.cols[k] = keep[k]; });
      if (t.value !== f.mode) { m.cols.from = 0; m.cols.to = Math.min(1, m.headers.length - 1); if (t.value === 'tree' || t.value === 'nodes') { m.cols = { id: 0 }; if (t.value === 'tree') m.cols.parent = Math.min(1, m.headers.length - 1); else m.cols.links = Math.min(1, m.headers.length - 1); } }
    } else if (t.dataset.map === 'delim') {
      d = t.value === 'tab' ? '\t' : t.value; var raw = imp.files && imp.files[0] ? imp.files[0].text : ''; rows = NFMImport.parseDelimited(raw, d); m = NFMImport.guessMapping(rows);
    } else if (t.dataset.map === 'header') {
      m.header = t.value === '1'; m.headers = m.header ? rows[0].map(function (c, i) { return c.trim() || 'column ' + (i + 1); }) : rows[0].map(function (_, i) { return 'column ' + (i + 1); });
    } else if (t.dataset.role) { var v = parseInt(t.value, 10); if (v < 0) delete m.cols[t.dataset.role]; else m.cols[t.dataset.role] = v; }
    var out;
    try { out = NFMImport.importTable(rows, m, imp.name, Object.assign({}, imp.opts, { delimiter: d })); } catch (err) { toast('That setting did not work: ' + err.message); return; }
    out.rows = rows; out.delimiter = d; out.mapping = m;
    out.report.notes.unshift('Read as a table with your settings, ' + out.report.rows + ' rows.');
    imp.res = out; leanImport(imp);
    var g = imp.mode === 'merge' && imp.base.nodes.length ? NFMImport.mergeGraphs(imp.base, out.graph) : out.graph;
    imp.mapOpen = true;
    /* the table is read again from the import, so edits made since (Nodes tab, fixes, merges) are replaced: remember the graph as it was, one Undo brings it back */
    setGraph(g, true, true);
    toast('Read the table again with your settings. Anything you edited since can be undone (' + T('Ctrl+Z', 'Undo on the Data tab') + ').', 6000);
  });
}

/* ---------------------------------------------------------------- channels: the choices for "use on the map as" */
var SYS_NODE = [['sys:degree', 'Number of links'], ['sys:in', 'Links coming in'], ['sys:out', 'Links going out'], ['sys:inW', 'Weight coming in'], ['sys:outW', 'Weight going out'], ['sys:traffic', 'Share of routes passing'], ['sys:visits', 'Expected visits'], ['sys:sim', 'Simulated visits']];
var SYS_EDGE = [['sys:count', 'Number of links merged here'], ['sys:flow', 'Flow carried'], ['sys:sim', 'Simulated traffic']];
function colsOf(scope, kinds) { return (S.prof ? S.prof[scope] : []).filter(function (c) { return kinds.indexOf(c.kind) >= 0 && c.key !== 'label'; }); }
function colName(scope, key) { var c = S.prof && NFMColumns.findCol(S.prof[scope], key); return c ? c.name : key; }
/** Plain words for a channel string. */
function chLabel(ch, scope) {
  if (!ch) return '';
  if (ch === 'weight') return 'Weight';
  var t = NFMColumns.split(ch), tbl = scope === 'edges' ? SYS_EDGE : SYS_NODE;
  if (t.t === 'col') return colName(scope || 'nodes', t.key);
  for (var i = 0; i < tbl.length; i++) if (tbl[i][0] === ch) return tbl[i][1];
  for (i = 0; i < SYS_NODE.length; i++) if (SYS_NODE[i][0] === ch) return SYS_NODE[i][1];
  return ch;
}
function widthChoices() {
  var out = [['', 'Same width for every link']];
  if (S.prof) {
    var w = NFMColumns.findCol(S.prof.edges, 'weight'); if (w && w.kind === 'number') out.push(['weight', 'Weight (' + NFMColumns.fmt(w.min) + ' to ' + NFMColumns.fmt(w.max) + ')']);
    colsOf('edges', ['number']).filter(function (c) { return c.key !== 'weight'; }).forEach(function (c) { out.push(['col:' + c.key, c.name + ' (' + NFMColumns.fmt(c.min) + ' to ' + NFMColumns.fmt(c.max) + ')']); });
  }
  return out.concat(SYS_EDGE.map(function (s) { return [s[0], s[1]]; }));
}
function sizeChoices() {
  var out = [['', 'Same size for every ' + word('item')]];
  colsOf('nodes', ['number']).forEach(function (c) { out.push(['col:' + c.key, c.name + ' (' + NFMColumns.fmt(c.min) + ' to ' + NFMColumns.fmt(c.max) + ')']); });
  return out.concat(SYS_NODE);
}
function colorChoices() {
  var out = [['group', 'Group'], ['found', 'Found groups (worked out from the links)'], ['choke', 'Choke points'], ['traffic', 'Share of routes passing'], ['odds', word('odds')], ['heat', 'How busy (visits)'], ['sim', 'Simulation result'], ['none', 'No color']];
  colsOf('nodes', ['category', 'number']).forEach(function (c) { if (c.key !== 'group') out.push(['col:' + c.key, c.name + (c.kind === 'number' ? ' (number)' : '')]); });
  return out.concat(SYS_NODE.slice(0, 5));
}
function edgeColorChoices() {
  var out = [['', 'One color']];
  colsOf('edges', ['category', 'number']).forEach(function (c) { out.push(['col:' + c.key, c.name + (c.kind === 'number' ? ' (number)' : '')]); });
  return out.concat([['sys:flow', 'Flow carried']]);
}
function linkLabelChoices() {
  var out = [['', 'Link label (if any)'], ['none', 'No link labels']];
  colsOf('edges', ['category', 'number', 'text']).forEach(function (c) { out.push(['col:' + c.key, c.name]); });
  return out;
}

/* ---------------------------------------------------------------- the columns workbench (Data tab, step 3) */
var calcDraft = null;
function sparkFor() { return null; }
function colSummary(c) {
  var f = NFMColumns.fmt;
  if (c.kind === 'number') return f(c.min) + ' to ' + f(c.max) + ', average ' + f(c.mean) + (c.numN < c.n ? ', ' + (c.n - c.numN) + ' not numbers' : '');
  if (c.kind === 'category') return c.cats.slice(0, 4).map(function (x) { return x[0] + ' (' + x[1] + ')'; }).join(', ') + (c.distinct > 4 ? ', +' + (c.distinct - 4) + ' more' : '');
  if (c.kind === 'date') return 'dates';
  return c.sample.map(function (x) { return String(x).slice(0, 24); }).join('; ');
}
function useOptions(scope, c) {
  var V = S.V, ch = 'col:' + c.key, o = [['', 'Not used']];
  if (c.builtin && c.key === 'weight') return [['', 'Not used'], ['width', 'Link width'], ['ecolor', 'Link color']];
  if (scope === 'nodes') {
    if (c.kind === 'number') o.push(['size', 'Item size'], ['color', 'Item color (scale)'], ['label', 'Show in the label']);
    else if (c.kind === 'category') o.push(['color', 'Item color (groups)'], ['label', 'Show in the label'], ['lane', 'Lanes and group shapes']);
    else o.push(['label', 'Show in the label']);
  } else {
    if (c.kind === 'number') o.push(['width', 'Link width'], ['ecolor', 'Link color (scale)'], ['llabel', 'Show on the link']);
    else if (c.kind === 'category') o.push(['ecolor', 'Link color (kinds)'], ['llabel', 'Show on the link']);
    else o.push(['llabel', 'Show on the link']);
  }
  return o;
}
function useNow(scope, c) {
  var V = S.V, ch = c.key === 'weight' && scope === 'edges' ? 'weight' : 'col:' + c.key;
  if (scope === 'nodes') { if (V.sizeBy === ch) return 'size'; if (V.colorBy === ch || (c.key === 'group' && V.colorBy === 'group')) return 'color'; if (V.labelCol === c.key) return 'label'; if (V.laneBy === c.key) return 'lane'; }
  else { if (V.widthBy === ch) return 'width'; if (V.edgeColorBy === ch) return 'ecolor'; if (V.linkLabels === ch) return 'llabel'; }
  return '';
}
function applyUse(scope, c, use) {
  var ch = c.key === 'weight' && scope === 'edges' ? 'weight' : 'col:' + c.key, V = S.V, p = {}, was = useNow(scope, c);
  if (scope === 'nodes') {
    if (was === 'size') p.sizeBy = ''; if (was === 'color') p.colorBy = c.key === 'group' ? 'group' : 'group'; if (was === 'label') p.labelCol = ''; if (was === 'lane') p.laneBy = 'group';
    if (use === 'size') p.sizeBy = ch; if (use === 'color') p.colorBy = c.key === 'group' ? 'group' : ch; if (use === 'label') p.labelCol = c.key; if (use === 'lane') p.laneBy = c.key;
  } else {
    if (was === 'width') p.widthBy = ''; if (was === 'ecolor') p.edgeColorBy = ''; if (was === 'llabel') p.linkLabels = '';
    if (use === 'width') p.widthBy = ch; if (use === 'ecolor') p.edgeColorBy = ch; if (use === 'llabel') p.linkLabels = ch;
  }
  setV(p); renderCols();
  if (use) toast(scope === 'nodes' ? 'Done. See it on the Map tab.' : 'Done. See it on the Map tab.');
}
function colTable(scope) {
  var list = S.prof[scope].filter(function (c) { return !(scope === 'nodes' && c.key === 'valence' && !S.story); });
  if (!list.length) return h('p', { class: 'muted small' }, 'No columns yet.');
  var rows = list.map(function (c) {
    var calc = (S.graph.calc || []).some(function (x) { return x.scope === scope && x.name === c.key; });
    var sel = select(useOptions(scope, c), useNow(scope, c), function (v) { applyUse(scope, c, v); }, { 'aria-label': 'Use ' + c.name + ' on the map as' });
    var kindTxt = { number: 'number', category: 'category', text: 'text', date: 'date' }[c.kind] || c.kind;
    return h('tr', null, [
      h('td', { class: 'nm' }, [c.name, calc ? h('span', { class: 'pill', style: { marginLeft: '6px' } }, 'calculated') : null]),
      h('td', null, [h('span', { class: 'kind' }, kindTxt), h('div', { class: 'muted small' }, plural(c.n, 'value'))]),
      h('td', { class: 'small' }, colSummary(c)),
      h('td', null, sel)
    ]);
  });
  return h('div', { class: 'tablewrap' }, h('table', { class: 't cw' }, [h('thead', null, h('tr', null, ['Column', 'Type', 'What is in it', 'Use on the map as'].map(function (x) { return h('th', null, x); }))), h('tbody', null, rows)]));
}
function previewCalc(c) {
  if (!c.formula.trim()) return { ok: false, text: 'Type a formula, like  amount / degree  or  log10(outW + 1).' };
  try { NFMColumns.compile(c.formula); } catch (err) { return { ok: false, text: err.message }; }
  var g = S.graph, cand = (g.calc || []).filter(function (x) { return !(x.scope === c.scope && x.name === c.name); }).concat([{ scope: c.scope, name: c.name || 'preview', formula: c.formula }]);
  var tmp = { name: g.name + '·preview', start: g.start, flavor: g.flavor, calc: cand, nodes: g.nodes, edges: g.edges }, d = NFMColumns.derive(tmp);
  var list = (c.scope === 'edges' ? d.edges : d.nodes), nm = c.name || 'preview', vals = [], bad = 0;
  for (var i = 0; i < list.length; i++) { var v = list[i].attrs && list[i].attrs[nm]; if (v === '' || v === undefined) bad++; else vals.push(v); }
  if (!vals.length) return { ok: false, text: 'It gives no number for any ' + (c.scope === 'edges' ? 'link' : 'item') + '. Check the column names.' };
  var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
  return { ok: true, text: 'Looks right: ' + NFMColumns.fmt(mn) + ' to ' + NFMColumns.fmt(mx) + (bad ? '; ' + plural(bad, (c.scope === 'edges' ? 'link' : 'item') + ' has', (c.scope === 'edges' ? 'links' : 'items') + ' have') + ' no number' : '') + '. First few: ' + vals.slice(0, 4).map(function (v) { return NFMColumns.fmt(v); }).join(', ') };
}
function calcEditor() {
  var g = S.graph, list = g.calc || [], box = h('div', { style: { display: 'grid', gap: '8px' } });
  list.forEach(function (c, i) {
    box.appendChild(h('div', { class: 'calc' }, [
      h('div', null, [h('b', null, c.name), h('div', { class: 'muted small' }, c.scope === 'edges' ? 'on each link' : 'on each ' + word('item'))]),
      h('code', { style: { padding: '6px 8px' } }, c.formula),
      h('button', { class: 'sm danger', onclick: function () { edit(function (gg) { gg.calc = (gg.calc || []).filter(function (_, k) { return k !== i; }); }); renderCols(); } }, 'Remove')
    ]));
  });
  var d = calcDraft || (calcDraft = { scope: 'nodes', name: '', formula: '' });
  var pv = h('div', { class: 'pv' }), name = h('input', { type: 'text', placeholder: 'New column name', value: d.name, 'aria-label': 'Name of the new column' }), formula = h('input', { type: 'text', placeholder: 'Formula, e.g. outW / (inW + 1)', value: d.formula, 'aria-label': 'Formula', spellcheck: 'false', style: { width: '100%' } });
  var scopeSel = select([['nodes', 'On each ' + word('item')], ['edges', 'On each link']], d.scope, function (v) { d.scope = v; update(); });
  var update = function () { d.name = name.value.trim(); d.formula = formula.value; var r = previewCalc(d); pv.textContent = r.text; pv.className = 'pv' + (r.ok ? '' : ' bad'); add.disabled = !(r.ok && /^[A-Za-z_][\w ]*$/.test(d.name)); };
  var add = h('button', { class: 'primary', disabled: true, onclick: function () {
    var nm = d.name, c = { scope: d.scope, name: nm, formula: d.formula };
    edit(function (gg) { gg.calc = (gg.calc || []).filter(function (x) { return !(x.scope === c.scope && x.name === c.name); }).concat([c]).slice(0, 40); });
    calcDraft = null; renderCols(); toast('Added the column "' + nm + '". It is in the lists above and ready to use.');
  } }, 'Add column');
  name.addEventListener('input', update); formula.addEventListener('input', debounce(update, 120));
  box.appendChild(h('div', { class: 'calc' }, [name, formula, add, h('div', { style: { gridColumn: '1/-1' } }, scopeSel), pv]));
  box.appendChild(h('p', { class: 'muted small', style: { margin: 0 } }, 'You can use column names, numbers, + - * / ^ %, comparisons, and, or, not, and functions like ' + NFMColumns.FUNCS.slice(0, 14).join(', ') + '. Items also know degree, in, out, inW and outW (links and weight in and out). On a link, use from.name and to.name to reach its ends.'));
  setTimeout(update, 0);
  return box;
}
function renderCols() {
  var card = $('cols'), g = S.graph;
  if (!g.nodes.length || !S.prof) { card.hidden = true; return; }
  card.hidden = false;
  var V = S.V, kids = [h('h2', null, '3. Your columns')];
  kids.push(h('p', { class: 'muted small', style: { margin: 0 } }, 'Everything in your data can drive the map. Pick what each column does; the Map tab shows it right away, and its key says what the colors, sizes and widths mean.'));
  /* the big roles first */
  var roles = h('div', { class: 'maprow' }, [
    field('Link width', select(widthChoices(), V.widthBy, function (v) { setV({ widthBy: v }); renderCols(); }), 'Wider links carry more.'),
    field(cap(word('item')) + ' size', select(sizeChoices(), V.sizeBy, function (v) { setV({ sizeBy: v }); renderCols(); })),
    field(cap(word('item')) + ' color', select(colorChoices(), V.colorBy, function (v) { setV({ colorBy: v }); renderCols(); })),
    field('Link color', select(edgeColorChoices(), V.edgeColorBy, function (v) { setV({ edgeColorBy: v }); renderCols(); })),
    field('Link labels', select(linkLabelChoices(), V.linkLabels || '', function (v) { setV({ linkLabels: v }); renderCols(); })),
    field('When links join, combine their numbers by', select([['sum', 'Adding them up'], ['mean', 'Average'], ['max', 'Largest']], V.agg, function (v) { setV({ agg: v }); }))
  ]);
  kids.push(roles);
  var wcol = V.widthBy ? chLabel(V.widthBy, 'edges') : '';
  if (!V.widthBy && NFMColumns.findCol(S.prof.edges, 'weight')) kids.push(h('p', { class: 'small', style: { margin: 0, color: 'var(--gold)' } }, 'Your links have weights, but link width is off, so every line looks the same. Pick Weight above to make heavier links wider.'));
  kids.push(h('h3', null, cap(word('items')) + ' (' + nfmt(g.nodes.length) + ')'), colTable('nodes'));
  kids.push(h('h3', null, cap(word('links')) + ' (' + nfmt(nEdges(g)) + ')'), colTable('edges'));
  kids.push(h('h3', null, 'Calculated columns'), h('p', { class: 'muted small', style: { margin: 0 } }, 'Make a new column from the others, for example a ratio, a share, or a score. It works like any other column.'), calcEditor());
  if (S.story) kids.push(h('p', { class: 'muted small', style: { margin: 0 } }, 'This looks like a story, so good and bad endings and starting points are available on the Nodes tab and in the Details panel.'));
  mount(card, kids);
}
HOOKS.graph.push(function () { renderReport(); renderCols(); });
