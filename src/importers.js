/*!
 * Net Flow Map importers: turn text, tables, JSON and notes into one graph, and say what was kept, changed or dropped.
 * Copyright (c) 2026 JNFoo. MIT License. No DOM; runs in the page or in Node.
 *
 * Graph: { name, start, nodes: [{id, label, group, valence, ghost, attrs}], edges: [{from, to, label, weight, kind, attrs}] }
 * Report: { format, nodes, edges, ghosts, notes: [plain-words lines], counts: {...} }
 */
var NFMImport = (function () {
  'use strict';
  var MAX_NODES = 200000, MAX_EDGES = 800000, MAX_LABEL = 400, MAX_ATTRS = 40;
  var LINEBREAK = /\r\n|[\n\r\u2028\u2029]/;   // every kind of line end: Windows, Unix, old Mac, Unicode
  var BAD_KEYS = { '__proto__': 1, 'constructor': 1, 'prototype': 1 };

  /* ------------------------------------------------------------ builder: one place that makes nodes and edges safely */
  function Builder(name, opts) {
    this.g = { name: name || 'Untitled', start: null, nodes: [], edges: [] };
    this.opts = opts || {};
    this.maxNodes = this.opts.maxNodes || MAX_NODES; this.maxEdges = this.opts.maxEdges || MAX_EDGES;
    this.map = new Map();
    this.ci = !!this.opts.caseInsensitive;
    this.r = { dupNodes: 0, selfLoops: 0, dupEdges: 0, droppedEdges: 0, ghosts: 0, emptyIds: 0, trimmed: 0, capped: false, notes: [] };
    this.edgeKeys = new Set(); this.nodeIx = new Map();
  }
  function clip(s, n) { s = String(s === undefined || s === null ? '' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  var PLAIN = /^[\x20-\x7e]*$/;   // printable ASCII: nothing to normalize or strip, only trim
  function cleanText(s) {
    s = typeof s === 'string' ? s : String(s === undefined || s === null ? '' : s);
    if (PLAIN.test(s)) return s.trim();
    try { s = s.normalize('NFC'); } catch (e) { /* old engines */ }
    return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u200B\u2028\u2029\uFEFF]/g, '').trim();
  }
  Builder.prototype.key = function (id) { return this.ci ? id.toLowerCase() : id; };
  Builder.prototype.node = function (rawId, props) {
    var id = cleanText(rawId);
    if (!id) { this.r.emptyIds++; return null; }
    if (id.length > MAX_LABEL) { id = clip(id, MAX_LABEL); this.r.trimmed++; }
    var k = this.key(id), nd = this.map.get(k);
    if (nd) {
      if (props) {
        this.r.dupNodes++;
        if (props.label && (!nd.label || nd.label === nd.id)) nd.label = clip(cleanText(props.label), MAX_LABEL);
        if (props.group && !nd.group) nd.group = clip(cleanText(props.group), 80);
        if (props.valence && !nd.valence) nd.valence = props.valence;
        if (props.ghost === false) nd.ghost = false;
        if (props.attrs) { var have = Object.keys(nd.attrs).length; for (var a in props.attrs) if (!BAD_KEYS[a] && !(a in nd.attrs) && have < MAX_ATTRS) { nd.attrs[a] = props.attrs[a]; have++; } }
      }
      return nd;
    }
    if (this.g.nodes.length >= this.maxNodes) { this.r.capped = true; return null; }
    nd = { id: id, label: id, group: '', valence: '', ghost: false, attrs: {} };
    if (props) {
      if (props.label) nd.label = clip(cleanText(props.label), MAX_LABEL) || id;
      if (props.group) nd.group = clip(cleanText(props.group), 80);
      if (props.valence) nd.valence = props.valence;
      if (props.ghost) nd.ghost = true;
      if (props.attrs) { var cnt = 0; for (var b in props.attrs) if (!BAD_KEYS[b] && cnt < MAX_ATTRS) { nd.attrs[b] = props.attrs[b]; cnt++; } }
    }
    this.map.set(k, nd);
    this.nodeIx.set(nd, this.g.nodes.length);
    this.g.nodes.push(nd);
    return nd;
  };
  Builder.prototype.edge = function (a, b, props) {
    if (!a || !b) { this.r.droppedEdges++; return null; }
    props = props || {};
    if (a === b) this.r.selfLoops++;
    var kind = props.kind || '', label = props.label ? clip(cleanText(props.label), MAX_LABEL) : '';
    // a plain link (no kind, no label) is remembered by the two items' positions as one number; the rest by text
    var ia = this.nodeIx.get(a), ib = this.nodeIx.get(b);
    var dk = kind === '' && label === '' && ia !== undefined && ib !== undefined ? ia * 33554432 + ib : a.id + '\u0001' + b.id + '\u0001' + kind + '\u0001' + label;
    if (this.edgeKeys.has(dk)) { this.r.dupEdges++; if (!this.opts.keepDuplicates) return null; }
    if (this.g.edges.length >= this.maxEdges) { this.r.capped = true; return null; }
    this.edgeKeys.add(dk);
    var wt = props.weight === undefined || props.weight === '' || props.weight === null ? undefined : Number(props.weight);
    var e = { from: a.id, to: b.id, label: label, weight: isFinite(wt) ? wt : undefined, kind: kind, attrs: {} };
    if (props.attrs) { var ec = 0; for (var x in props.attrs) if (!BAD_KEYS[x] && ec < MAX_ATTRS) { e.attrs[x] = props.attrs[x]; ec++; } }
    this.g.edges.push(e);
    return e;
  };
  Builder.prototype.done = function (format) {
    var r = this.r, notes = r.notes.slice();
    if (r.dupNodes) notes.push(r.dupNodes + ' repeated item' + (r.dupNodes === 1 ? ' was' : 's were') + ' merged into one.');
    if (r.dupEdges) notes.push(r.dupEdges + ' repeated link' + (r.dupEdges === 1 ? ' was' : 's were') + (this.opts.keepDuplicates ? ' kept.' : ' dropped.'));
    if (r.selfLoops) notes.push(r.selfLoops + ' link' + (r.selfLoops === 1 ? ' points' : 's point') + ' from an item to itself (kept).');
    if (r.droppedEdges) notes.push(r.droppedEdges + ' link' + (r.droppedEdges === 1 ? ' was' : 's were') + ' dropped because an end was empty.');
    if (r.emptyIds) notes.push(r.emptyIds + ' row' + (r.emptyIds === 1 ? ' had' : 's had') + ' no name and ' + (r.emptyIds === 1 ? 'was' : 'were') + ' skipped.');
    if (r.trimmed) notes.push(r.trimmed + ' very long name' + (r.trimmed === 1 ? ' was' : 's were') + ' shortened.');
    if (r.ghosts) notes.push(r.ghosts + ' item' + (r.ghosts === 1 ? ' is' : 's are') + ' mentioned in links but never described (shown as placeholders).');
    if (r.capped) notes.push('The file is very large; reading stopped at ' + MAX_NODES + ' items or ' + MAX_EDGES + ' links.');
    var report = { format: format, nodes: this.g.nodes.length, edges: this.g.edges.length, ghosts: r.ghosts, notes: notes, counts: { dupNodes: r.dupNodes, dupEdges: r.dupEdges, selfLoops: r.selfLoops, dropped: r.droppedEdges } };
    return { graph: this.g, report: report };
  };

  /* ------------------------------------------------------------ delimited text */
  function stripBom(t) { return t.charCodeAt(0) === 0xfeff ? t.slice(1) : t; }
  function sniffDelimiter(text) {
    var lines = text.split(LINEBREAK).filter(function (l) { return l.trim(); }).slice(0, 12), best = ',', bestScore = 0;
    [',', '\t', ';', '|'].forEach(function (d) {
      var counts = lines.map(function (l) { return splitLine(l, d).length; });
      var first = counts[0] || 1;
      if (first < 2) return;
      var same = counts.filter(function (c) { return c === first; }).length;
      var score = same * 10 + first;
      if (same >= Math.max(2, Math.floor(counts.length * 0.7)) && score > bestScore) { best = d; bestScore = score; }
    });
    return bestScore ? best : null;
  }
  function splitLine(line, d) {
    var out = [], cur = '', q = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"' && !cur) q = true;
      else if (ch === d) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  }
  /**
   * Full parser: quotes, doubled quotes, line breaks inside quotes, any single-character delimiter.
   * Fast where it can be: a line with no quote mark in it is cut with the browser's own split (no per-character work, which is what made long
   * fields slow); only records that contain a quote go through the character loop, and inside quotes that loop jumps from quote to quote.
   * Same results as the plain character-by-character reader (test/importers.test.js compares them on thousands of random tables).
   */
  function parseDelimited(text, d) {
    text = stripBom(text);
    var rows = [], n = text.length, pos = 0, dc = d.charCodeAt(0), nextQuote = text.indexOf('"');
    while (pos < n) {
      var nl = text.indexOf('\n', pos), end = nl < 0 ? n : nl;
      if (nextQuote >= 0 && nextQuote < pos) nextQuote = text.indexOf('"', pos);
      if (nextQuote < 0 || nextQuote >= end) {   // no quote on this line: cut it with split
        var line = text.slice(pos, end);
        if (line.indexOf('\r') >= 0) line = line.replace(/\r/g, '');
        var parts = line.split(d);
        if (parts.length > 1 || parts[0] !== '') rows.push(parts);
        pos = end + 1; continue;
      }
      var row = [], cur = '', q = false, i = pos, ended = false;
      while (i < n) {
        if (q) {
          var k = text.indexOf('"', i);
          if (k < 0) { cur += text.slice(i); i = n; break; }
          cur += text.slice(i, k);
          if (text.charCodeAt(k + 1) === 34) { cur += '"'; i = k + 2; continue; }
          q = false; i = k + 1; continue;
        }
        var ch = text.charCodeAt(i);
        if (ch === 34 && cur === '') { q = true; i++; continue; }
        if (ch === dc) { row.push(cur); cur = ''; i++; continue; }
        if (ch === 13) { i++; continue; }
        if (ch === 10) { row.push(cur); cur = ''; if (row.length > 1 || row[0] !== '') rows.push(row); i++; ended = true; break; }
        var st = i++, c2;   // an ordinary run of characters: take it whole up to the next delimiter, line end or carriage return
        while (i < n) { c2 = text.charCodeAt(i); if (c2 === dc || c2 === 10 || c2 === 13) break; i++; }
        cur += text.slice(st, i);
      }
      if (!ended && (cur !== '' || row.length)) { row.push(cur); rows.push(row); }
      pos = i;
    }
    return rows;
  }
  var ROLE = {
    from: /^(source|from|src|parent|origin|tail|node1|node_1|node 1|u|a|left|start node|predecessor|in)$/i,
    to: /^(target|to|dst|dest|destination|child|head|node2|node_2|node 2|v|b|right|end node|successor|next|out)$/i,
    weight: /^(weight|value|count|strength|w|amount|frequency|freq)$/i,
    label: /^(label|name|title|relation|relationship|edge_label|text|description)$/i,
    kind: /^(type|kind|category|edge_type|relation_type|rel)$/i,
    id: /^(id|key|node|node_id|nodeid|name|title|item|page)$/i,
    parent: /^(parent|parent_id|parentid|parent id|manager|reports_to|supervisor)$/i,
    group: /^(group|class|cluster|community|team|department|type|category|kind|module|section)$/i,
    valence: /^(valence|outcome|result|ending|status)$/i,
    links: /^(links|next|targets|children|goto|go_to|edges|connections|neighbors|neighbours|see also|related|leads_to|depends_on|requires|prerequisites)$/i,
    fromGroup: /^(source|from|src)[ _-]?(group|type|class|category)$/i,
    toGroup: /^(target|to|dst)[ _-]?(group|type|class|category)$/i,
    start: /^(start|is_start|first)$/i
  };
  function looksNumeric(s) { return /^-?\d+([.,]\d+)?$/.test(String(s).trim()); }
  /** Guess how to read a table. Returns { mode, cols: {...role: columnIndex}, header, headers, delimiter }. The page lets the user change it. */
  function guessMapping(rows) {
    if (!rows.length) return { mode: 'edges', cols: {}, header: true, headers: [] };
    var first = rows[0], hasHeader = first.some(function (c) { return c.trim() && !looksNumeric(c); }) && (rows.length < 2 || first.every(function (c, i) { return !rows[1][i] || looksNumeric(rows[1][i]) === looksNumeric(c) || !looksNumeric(c); }));
    var headers = hasHeader ? first.map(function (c, i) { return c.trim() || 'column ' + (i + 1); }) : first.map(function (_, i) { return 'column ' + (i + 1); });
    var cols = {}, used = {};
    var find = function (role, skipUsed) {
      for (var i = 0; i < headers.length; i++) if (ROLE[role].test(headers[i].trim()) && !(skipUsed && used[i])) return i;
      return -1;
    };
    var mode = 'edges';
    var f = find('from'), t = find('to');
    if (rows.length > 2 && rows[0].length === rows.length && rows[0].length > 2 && looksNumericMatrix(rows) && rows[0].slice(1).every(function (c) { return c.trim() && !looksNumeric(c); })) mode = 'matrix';
    else if (hasHeader && f >= 0 && t >= 0 && f !== t) { cols.from = f; cols.to = t; used[f] = used[t] = 1; }
    else {
      var idc = find('id'), pc = find('parent'), lc = find('links');
      if (hasHeader && pc >= 0 && idc >= 0 && idc !== pc) { mode = 'tree'; cols.id = idc; cols.parent = pc; used[idc] = used[pc] = 1; }
      else if (hasHeader && lc >= 0) { mode = 'nodes'; cols.id = idc >= 0 && idc !== lc ? idc : (lc === 0 ? 1 : 0); cols.links = lc; used[cols.id] = used[lc] = 1; }
      else if (hasHeader && idc >= 0 && headers.some(function (h, i) { return i !== idc && /^(label|name|title|text|group|cluster|community|class|category|type|valence|outcome|start)$/i.test(h.trim()); })) { mode = 'nodes'; cols.id = idc; used[idc] = 1; }   // a table that only describes items (no links column)
      else if (rows.length > 2 && rows[0].length === rows.length && rows[0].length > 2 && looksNumericMatrix(rows)) mode = 'matrix';
      else { cols.from = 0; cols.to = headers.length > 1 ? 1 : 0; used[0] = used[cols.to] = 1; }
    }
    ['weight', 'label', 'kind'].forEach(function (r) { var i = find(r, true); if (i >= 0 && mode === 'edges') { cols[r] = i; used[i] = 1; } });
    if (mode === 'edges') {
      var fg = find('fromGroup', true), tg = find('toGroup', true);
      if (fg >= 0) { cols.fromGroup = fg; used[fg] = 1; }
      if (tg >= 0) { cols.toGroup = tg; used[tg] = 1; }
    } else {
      var lb = -1;
      for (var i = 0; i < headers.length; i++) if (!used[i] && /^(label|name|title|text)$/i.test(headers[i].trim())) { lb = i; break; }
      if (lb >= 0) { cols.label = lb; used[lb] = 1; }
      var g = find('group', true), v = find('valence', true), s = find('start', true);
      if (g >= 0) { cols.group = g; used[g] = 1; }
      if (v >= 0) { cols.valence = v; used[v] = 1; }
      if (s >= 0) { cols.start = s; used[s] = 1; }
    }
    return { mode: mode, cols: cols, header: hasHeader, headers: headers };
  }
  function looksNumericMatrix(rows) {
    var r = rows.slice(1, Math.min(rows.length, 6));
    return r.every(function (row) { return row.slice(1).every(function (c) { return c.trim() === '' || looksNumeric(c); }); });
  }
  var VAL = { good: 'good', win: 'good', success: 'good', won: 'good', bad: 'bad', lose: 'bad', fail: 'bad', failure: 'bad', lost: 'bad', neutral: 'neutral', end: 'neutral', ending: 'neutral' };
  function valenceOf(s) { return VAL[String(s || '').trim().toLowerCase()] || ''; }
  function num(s, dec) { s = String(s).trim(); if (dec === ',') s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, ''); var v = Number(s); return isFinite(v) ? v : undefined; }

  /** Read table rows into a graph using a mapping (from guessMapping, possibly changed by the user). */
  function importTable(rows, map, name, opts) {
    opts = opts || {};
    var B = new Builder(name, opts), cols = map.cols, mode = map.mode, body = map.header ? rows.slice(1) : rows, headers = map.headers || [];
    var dec = opts.decimal || (opts.delimiter === ';' ? ',' : '.');
    var extraCache = new Map();   // the extra columns for one set of skipped columns, worked out once
    var extra = function (row, skip) {
      var ix = extraCache.get(skip);
      if (!ix) { ix = []; headers.forEach(function (h, i) { if (skip.indexOf(i) < 0) ix.push(i); }); extraCache.set(skip, ix); }
      var a = {};
      for (var k = 0; k < ix.length; k++) { var v = row[ix[k]]; if (v !== undefined && String(v).trim() !== '') a[headers[ix[k]]] = v; }
      return a;
    };
    var cell = function (row, c) { return c === undefined || c < 0 ? '' : row[c] === undefined ? '' : String(row[c]).trim(); };
    var rowCount = 0, badNum = 0;
    if (mode === 'edges') {
      var skip = ['from', 'to', 'weight', 'label', 'kind', 'fromGroup', 'toGroup'].map(function (r) { return cols[r]; }).filter(function (x) { return x !== undefined; });
      body.forEach(function (row) {
        rowCount++;
        var a = B.node(cell(row, cols.from), cols.fromGroup !== undefined ? { group: cell(row, cols.fromGroup) } : null);
        var b = B.node(cell(row, cols.to), cols.toGroup !== undefined ? { group: cell(row, cols.toGroup) } : null);
        var wraw = cell(row, cols.weight), w = wraw === '' ? undefined : num(wraw, dec);
        if (wraw !== '' && w === undefined) badNum++;
        B.edge(a, b, { label: cell(row, cols.label), weight: w, kind: cell(row, cols.kind), attrs: extra(row, skip) });
      });
    } else if (mode === 'tree') {
      var skip2 = [cols.id, cols.parent, cols.label, cols.group, cols.valence, cols.start].filter(function (x) { return x !== undefined; });
      body.forEach(function (row) {
        rowCount++;
        var nd = B.node(cell(row, cols.id), { label: cell(row, cols.label), group: cell(row, cols.group), valence: valenceOf(cell(row, cols.valence)), attrs: extra(row, skip2) });
        var pr = cell(row, cols.parent);
        if (nd && pr) B.edge(B.node(pr), nd, { kind: 'contains' });
        if (nd && cols.start !== undefined && /^(1|true|yes|y|start)$/i.test(cell(row, cols.start))) B.g.start = nd.id;
      });
    } else if (mode === 'nodes') {
      var skip3 = [cols.id, cols.links, cols.label, cols.group, cols.valence, cols.start].filter(function (x) { return x !== undefined; });
      var pending = [];
      body.forEach(function (row) {
        rowCount++;
        var nd = B.node(cell(row, cols.id), { label: cell(row, cols.label), group: cell(row, cols.group), valence: valenceOf(cell(row, cols.valence)), attrs: extra(row, skip3) });
        if (!nd) return;
        if (cols.start !== undefined && /^(1|true|yes|y|start)$/i.test(cell(row, cols.start))) B.g.start = nd.id;
        cell(row, cols.links).split(/\s*[;|,\n]\s*/).forEach(function (t) { if (t) pending.push([nd, t]); });
      });
      pending.forEach(function (p) {
        var existed = B.map.has(B.key(cleanText(p[1])));
        var tn = B.node(p[1], existed ? null : { ghost: true });
        if (!existed && tn) B.r.ghosts++;
        B.edge(p[0], tn, {});
      });
    } else if (mode === 'matrix') {
      var colNames = rows[0].slice(1).map(function (s) { return s.trim(); });
      rows.slice(1).forEach(function (row) {
        var a = B.node(String(row[0]).trim());
        colNames.forEach(function (cn, j) {
          var v = String(row[j + 1] === undefined ? '' : row[j + 1]).trim();
          if (v === '' || v === '0') return;
          var w = num(v, dec);
          B.edge(a, B.node(cn), { weight: w !== undefined && w !== 1 ? w : undefined });
        });
      });
      rowCount = rows.length - 1;
    }
    if (badNum) B.r.notes.push(badNum + ' weight' + (badNum === 1 ? ' was' : 's were') + ' not numbers and ' + (badNum === 1 ? 'was' : 'were') + ' left empty.');
    if (!B.g.edges.length && rowCount) B.r.notes.push('No links were found. Check which columns are "from" and "to" in the table settings.');
    var out = B.done('table');
    out.report.rows = rowCount;
    out.report.mapping = map;
    return out;
  }
  function importDelimited(text, name, opts) {
    var d = (opts && opts.delimiter) || sniffDelimiter(stripBom(text)) || ',';
    var rows = parseDelimited(text, d);
    var map = (opts && opts.mapping) || guessMapping(rows);
    var out = importTable(rows, map, name, Object.assign({}, opts, { delimiter: d }));
    out.rows = rows; out.delimiter = d; out.mapping = map;
    var lbl = d === '\t' ? 'tab' : d === ',' ? 'comma' : d === ';' ? 'semicolon' : 'bar';
    out.report.notes.unshift('Read as a table separated by ' + lbl + 's, ' + out.report.rows + ' row' + (out.report.rows === 1 ? '' : 's') + (map.header ? ' under a header row.' : ' with no header row.'));
    return out;
  }

  /* ------------------------------------------------------------ JSON in many shapes */
  function pick(o, names) { if (o === null || typeof o !== 'object') return undefined; for (var i = 0; i < names.length; i++) if (o[names[i]] !== undefined && o[names[i]] !== null && o[names[i]] !== '') return o[names[i]]; return undefined; }
  function scalar(v) { return v !== null && typeof v === 'object' ? undefined : v; }
  function importJSON(text, name, opts) {
    var data;
    try { data = JSON.parse(stripBom(text)); }
    catch (err) {
      var lines = stripBom(text).split(LINEBREAK).filter(function (l) { return l.trim(); });
      try { data = lines.map(function (l) { return JSON.parse(l); }); } catch (e2) { throw new Error('This is not valid JSON: ' + err.message); }
    }
    if (data && !Array.isArray(data) && Array.isArray(data.nodes) && Array.isArray(data.edges) && (data.states || data.calc || data.roles)) {
      var sg = sanitizeGraph(Object.assign({}, data, { name: data.name || name }));
      return { graph: sg, report: { format: 'Net Flow Map JSON', nodes: sg.nodes.length, edges: sg.edges.length, ghosts: 0, notes: ['Read back with its calculated columns, column roles' + (sg.states ? ' and ' + sg.states.names.length + ' states' : '') + ' where the file had them.'] } };
    }
    var B = new Builder(name, opts), shape = 'unknown';
    var nodeProps = function (o) {
      var attrs = {}, skip = { id: 1, key: 1, name: 1, label: 1, title: 1, group: 1, type: 1, class: 1, category: 1, cluster: 1, community: 1, valence: 1, outcome: 1, x: 1, y: 1, size: 1, color: 1, text: 1, data: 1 };
      Object.keys(o).forEach(function (k) { if (!skip[k] && !BAD_KEYS[k] && scalar(o[k]) !== undefined) attrs[k] = o[k]; });
      var g = scalar(pick(o, ['group', 'cluster', 'community', 'class', 'category', 'type']));
      return { label: scalar(pick(o, ['label', 'name', 'title', 'text'])), group: g === undefined ? '' : String(g), valence: valenceOf(scalar(pick(o, ['valence', 'outcome']))), attrs: attrs };
    };
    var idOf = function (o) { var v = scalar(pick(o, ['id', 'key', '_id', 'name', 'label', 'title'])); return v === undefined ? undefined : String(v); };
    var edgeFrom = function (o) { return pick(o, ['source', 'from', 'src', 'fromNode', 'start', 'u', 'a', 'parent']); };
    var edgeTo = function (o) { return pick(o, ['target', 'to', 'dst', 'toNode', 'end', 'v', 'b', 'child']); };
    var refId = function (v, list) {
      if (v !== null && typeof v === 'object') return refId(pick(v, ['id', 'key', 'name']), list);
      if (list && typeof v === 'number' && list.byIndex && !list.ids.has(String(v))) { var nd = list.byIndex[v]; return nd ? nd : null; }
      return v === undefined ? undefined : String(v);
    };
    var addEdges = function (arr, nodeList) {
      arr.forEach(function (e) {
        var a, b;
        if (Array.isArray(e)) { a = e[0]; b = e[1]; e = { weight: e[2] }; }
        else { a = edgeFrom(e); b = edgeTo(e); }
        var ra = refId(a, nodeList), rb = refId(b, nodeList);
        var w = scalar(pick(e, ['weight', 'value', 'strength', 'count', 'w']));
        B.edge(typeof ra === 'object' && ra ? B.node(idOf(ra) || '') : B.node(ra === undefined ? '' : ra), typeof rb === 'object' && rb ? B.node(idOf(rb) || '') : B.node(rb === undefined ? '' : rb), {
          label: scalar(pick(e, ['label', 'name', 'relation', 'title', 'text'])), weight: w, kind: scalar(pick(e, ['kind', 'type', 'edge_type'])) !== undefined ? String(scalar(pick(e, ['kind', 'type', 'edge_type']))) : ''
        });
      });
    };
    var addNodes = function (arr) {
      var ids = new Set(), byIndex = [];
      arr.forEach(function (o, i) {
        if (o === null || typeof o !== 'object') { var s = B.node(String(o)); byIndex[i] = s; if (s) ids.add(s.id); return; }
        var inner = o.data && typeof o.data === 'object' ? Object.assign({}, o, o.data) : o;
        var id = idOf(inner);
        if (id === undefined) { B.r.emptyIds++; return; }
        var nd = B.node(id, nodeProps(inner));
        byIndex[i] = nd; if (nd) ids.add(nd.id);
      });
      return { ids: ids, byIndex: byIndex.map(function (n) { return n ? { id: n.id } : null; }) };
    };
    var root = data;
    if (Array.isArray(data)) {
      var sample = data.slice(0, 20);
      var edgeLike = sample.length && sample.every(function (e) { return Array.isArray(e) ? e.length >= 2 : e && typeof e === 'object' && edgeFrom(e) !== undefined && edgeTo(e) !== undefined; });
      if (edgeLike) { shape = 'list of links'; addEdges(data, null); }
      else if (sample.length && sample.every(function (o) { return o && typeof o === 'object'; })) {
        shape = 'list of items'; var nl0 = addNodes(data);
        data.forEach(function (o) { var id = idOf(o); var tos = o && (o.links || o.children || o.next || o.to || o.targets); if (id !== undefined && Array.isArray(tos)) tos.forEach(function (t) { B.edge(B.node(id), B.node(String(scalar(t) !== undefined ? t : pick(t, ['id', 'to', 'target', 'name']))), { label: t && t.label }); }); });
        void nl0;
      } else throw new Error('This JSON is a list, but not a list of links or of items.');
    } else if (root && typeof root === 'object') {
      if (Array.isArray(root.passages)) {
        shape = 'story'; B.g.flavor = 'story'; var byId = {};
        root.passages.forEach(function (p) { byId[p.id] = p; var nd = B.node(String(p.id), { label: p.name || p.title || p.id, valence: p.ending ? valenceOf(p.valence) || 'neutral' : '', group: p.group || '' }); void nd; });
        root.passages.forEach(function (p) {
          (p.choices || p.links || []).forEach(function (c) {
            var to = c.to || c.target || c.link;
            if (to === undefined || to === '') return;
            var tn = byId[to] ? B.node(String(to)) : B.node(String(to), { ghost: true });
            if (!byId[to] && tn) B.r.ghosts++;
            B.edge(B.node(String(p.id)), tn, { label: c.label || c.text });
          });
        });
        if (root.start !== undefined) B.g.start = String(root.start);
      } else if (root.elements) {
        shape = 'Cytoscape.js'; var els = root.elements, ns = Array.isArray(els) ? els.filter(function (x) { return !(x.data && x.data.source !== undefined); }) : els.nodes || [], es = Array.isArray(els) ? els.filter(function (x) { return x.data && x.data.source !== undefined; }) : els.edges || [];
        var nl = addNodes(ns); addEdges(es.map(function (e) { return e.data || e; }), nl);
      } else if (Array.isArray(root.nodes) && (Array.isArray(root.edges) || Array.isArray(root.links))) {
        var isCanvas = root.nodes.some(function (n) { return n && (n.type === 'text' || n.type === 'file' || n.type === 'group') && n.x !== undefined; }) && Array.isArray(root.edges) && root.edges.some(function (e) { return e.fromNode !== undefined; });
        shape = isCanvas ? 'JSON Canvas' : 'nodes and links';
        var nodeArr = root.nodes;
        if (isCanvas) {
          nodeArr = root.nodes.filter(function (n) { return n.type !== 'group'; }).map(function (n) {
            var t = n.type === 'text' ? String(n.text || '').split(/\n/)[0].replace(/^#+\s*/, '') : n.type === 'file' ? String(n.file || '').split('/').pop().replace(/\.[^.]+$/, '') : n.url || n.id;
            return { id: n.id, label: t || n.id, group: n.color ? 'color ' + n.color : '', type: undefined };
          });
          var dropped = root.nodes.length - nodeArr.length;
          if (dropped) B.r.notes.push(dropped + ' canvas group box' + (dropped === 1 ? ' was' : 'es were') + ' left out (they are drawing frames, not items).');
        }
        var nl2 = addNodes(nodeArr);
        addEdges(root.edges || root.links, nl2);
      } else if (Array.isArray(root.nodes)) {
        shape = 'items only'; addNodes(root.nodes);
      } else if (Array.isArray(root.edges) || Array.isArray(root.links)) {
        shape = 'links only'; addEdges(root.edges || root.links, null);
      } else {
        var keys = Object.keys(root), ok = keys.length && keys.every(function (k) { var v = root[k]; return Array.isArray(v) || (v && typeof v === 'object' && Object.keys(v).every(function (kk) { return typeof v[kk] === 'number'; })); });
        if (!ok) throw new Error('This JSON is not a graph shape I know (nodes and links, Cytoscape.js, JSON Canvas, a story, a list of links, or "name: [targets]").');
        shape = 'adjacency lists';
        keys.forEach(function (k) {
          var a = B.node(k), v = root[k];
          if (Array.isArray(v)) v.forEach(function (t) { B.edge(a, B.node(String(scalar(t) !== undefined ? t : pick(t, ['id', 'to', 'target', 'name']))), {}); });
          else Object.keys(v).forEach(function (t) { B.edge(a, B.node(t), { weight: v[t] }); });
        });
      }
    } else throw new Error('This JSON holds a single value, not a graph.');
    B.r.notes.unshift('Read as JSON (' + shape + ').');
    return B.done('json');
  }

  /* ------------------------------------------------------------ arrow lines, including simple DOT */
  function importArrows(text, name, opts) {
    var B = new Builder(name, opts), lines = stripBom(text).split(LINEBREAK), count = 0, skipped = 0;
    var unq = function (s) { s = s.trim().replace(/;$/, '').trim(); if (/^".*"$/.test(s)) s = s.slice(1, -1).replace(/\\"/g, '"'); return s; };
    var ARROW = /\s*(<->|<-->|<=>|--+>|->|=>|→|⟶|⇒|--|—)\s*/;
    lines.forEach(function (raw) {
      var line = raw.trim();
      if (!line || /^(#|\/\/|\/\*|\*|digraph|graph|strict|subgraph|node\s*\[|edge\s*\[|\}|\{)/i.test(line) || /^[a-z_]+\s*=/.test(line)) return;
      var label = '';
      var br = line.match(/\[\s*(?:[^\]]*?)label\s*=\s*"?([^"\],]*)"?[^\]]*\]\s*;?\s*$/);
      if (br) { label = br[1]; line = line.replace(/\[[^\]]*\]\s*;?\s*$/, ''); }
      else line = line.replace(/\[[^\]]*\]\s*;?\s*$/, '');
      var colon = line.match(/^(.*?)\s+:\s+(.*)$/) || line.match(/^([^:]*?->[^:]*?):\s*(.*)$/);
      if (colon && !label) { line = colon[1]; label = colon[2]; }
      var parts = line.split(ARROW);
      if (parts.length < 3) { if (line.trim()) skipped++; return; }
      for (var i = 0; i + 2 < parts.length + 0; i += 2) {
        var a = unq(parts[i]), arrow = parts[i + 1], b = unq(parts[i + 2]);
        if (!a || !b) { B.r.droppedEdges++; continue; }
        var na = B.node(a), nb = B.node(b), back = arrow.indexOf('<') === 0, two = /<.*>/.test(arrow) || arrow === '--' || arrow === '—';
        if (back && !two) B.edge(nb, na, { label: label }); else B.edge(na, nb, { label: label });
        if (two) B.edge(nb, na, { label: label, kind: arrow === '--' || arrow === '—' ? 'undirected' : '' });
        count++;
      }
    });
    if (skipped) B.r.notes.push(skipped + ' line' + (skipped === 1 ? ' had' : 's had') + ' no arrow and ' + (skipped === 1 ? 'was' : 'were') + ' skipped.');
    B.r.notes.unshift('Read as arrow lines like "A -> B".');
    return B.done('arrows');
  }

  /* ------------------------------------------------------------ outlines (indent, bullets, headings) */
  function importOutline(text, name, opts) {
    opts = opts || {};
    var B = new Builder(name, Object.assign({ caseInsensitive: !opts.outlineSeparate }, opts)), lines = stripBom(text).split(LINEBREAK);
    var items = [], tabs = 0, headingSeen = false;
    lines.forEach(function (raw) {
      if (!raw.trim()) return;
      var hm = raw.match(/^(#{1,6})\s+(.*)$/);
      if (hm) { headingSeen = true; items.push({ kind: 'h', level: hm[1].length - 1, text: hm[2] }); return; }
      var m = raw.match(/^([ \t]*)([-*+•▪◦]|\d+[.)])?\s*(.*)$/);
      if (!m) return;
      var indent = m[1].replace(/\t/g, '    ').length, body = m[3];
      if (!body.trim()) return;
      items.push({ kind: m[2] ? 'b' : 'p', indent: indent, text: body });
      if (/\t/.test(m[1])) tabs++;
    });
    var indents = Array.from(new Set(items.filter(function (i) { return i.kind !== 'h'; }).map(function (i) { return i.indent; }))).sort(function (a, b) { return a - b; });
    var stack = [], baseLevel = 0, seq = 0, linksMade = 0;
    items.forEach(function (it) {
      var level;
      if (it.kind === 'h') { level = it.level; baseLevel = level + 1; }
      else level = (headingSeen ? baseLevel : 0) + indents.indexOf(it.indent);
      var txt = it.text.replace(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g, function (_, t) { return t; });
      var wiki = []; it.text.replace(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g, function (_, t) { wiki.push(t.trim()); return ''; });
      txt = txt.replace(/\*\*|__|`/g, '').trim();
      var id = opts.outlineSeparate ? txt + ' #' + (++seq) : txt;
      var nd = B.node(id, { label: txt });
      if (!nd) return;
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      if (stack.length) B.edge(stack[stack.length - 1].nd, nd, { kind: 'contains' });
      stack.push({ level: level, nd: nd });
      wiki.forEach(function (w) { var ex = B.map.has(B.key(w)); var t = B.node(w, ex ? null : { ghost: true }); if (!ex && t) B.r.ghosts++; if (t && t !== nd) { B.edge(nd, t, { kind: 'link' }); linksMade++; } });
    });
    var multiRoot = B.g.nodes.filter(function (n) { return !B.g.edges.some(function (e) { return e.to === n.id; }); }).length;
    B.r.notes.unshift('Read as an outline (' + (headingSeen ? 'headings and ' : '') + (tabs ? 'tab' : 'space') + ' indents). Each item links to the items under it.');
    if (linksMade) B.r.notes.push(linksMade + ' [[wiki link]]' + (linksMade === 1 ? '' : 's') + ' inside items became extra links.');
    if (multiRoot > 1) B.r.notes.push('There are ' + multiRoot + ' top-level items; the map starts from the largest.');
    if (!opts.outlineSeparate) B.r.notes.push('Items with the same text are treated as one item. Turn on "repeated names are separate" if that is wrong.');
    return B.done('outline');
  }

  /* ------------------------------------------------------------ notes: Markdown files linking to each other */
  function parseFront(text) {
    var m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    var fm = { tags: [], aliases: [], body: text };
    if (!m) return fm;
    fm.body = text.slice(m[0].length);
    var block = m[1], cur = null;
    block.split(LINEBREAK).forEach(function (l) {
      var kv = l.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
      if (kv) {
        cur = kv[1].toLowerCase();
        var v = kv[2].trim();
        if (cur === 'tags' || cur === 'tag' || cur === 'aliases' || cur === 'alias') {
          var arr = cur.indexOf('tag') === 0 ? fm.tags : fm.aliases;
          if (v) v.replace(/^\[|\]$/g, '').split(/[,\s]+(?=[^\s])/).forEach(function (t) { t = t.replace(/^["'#]|["']$/g, '').trim(); if (t) arr.push(t); });
        } else if (cur === 'title' && v) fm.title = v.replace(/^["']|["']$/g, '');
      } else if (cur && /^\s*-\s+/.test(l)) {
        var item = l.replace(/^\s*-\s+/, '').replace(/^["'#]|["']$/g, '').trim();
        if (cur === 'tags' || cur === 'tag') fm.tags.push(item); else if (cur === 'aliases' || cur === 'alias') fm.aliases.push(item);
      }
    });
    return fm;
  }
  function stemOf(path) { return path.replace(/\\/g, '/').split('/').pop().replace(/\.(md|markdown|txt)$/i, ''); }
  /** files: [{name, path, text}] */
  function importNotes(files, name, opts) {
    opts = opts || {};
    var B = new Builder(name, Object.assign({ caseInsensitive: true }, opts));
    var docs = files.map(function (f) {
      var path = (f.path || f.name || '').replace(/\\/g, '/'), fm = parseFront(String(f.text || ''));
      return { path: path, stem: stemOf(path), fm: fm, folder: path.indexOf('/') > 0 ? path.split('/').slice(-2, -1)[0] : '' };
    });
    var stemCount = {};
    docs.forEach(function (d) { var k = d.stem.toLowerCase(); stemCount[k] = (stemCount[k] || 0) + 1; });
    docs.forEach(function (d) { d.id = stemCount[d.stem.toLowerCase()] > 1 ? d.path.replace(/\.(md|markdown|txt)$/i, '') : d.stem; });
    var lookup = new Map();
    docs.forEach(function (d) {
      [d.id, d.stem, d.path.replace(/\.(md|markdown|txt)$/i, '')].concat(d.fm.aliases).forEach(function (k) { if (k) { var lk = k.toLowerCase(); if (!lookup.has(lk)) lookup.set(lk, d); } });
    });
    docs.forEach(function (d) {
      var body = d.fm.body, h1 = body.match(/^#\s+(.+)$/m);
      var label = d.fm.title || (h1 ? h1[1].replace(/\*\*|__|`/g, '').trim() : d.stem);
      var group = d.fm.tags[0] || d.folder || '';
      var attrs = {};
      if (d.fm.tags.length) attrs.tags = d.fm.tags.join(', ');
      if (d.path.indexOf('/') > 0) attrs.folder = d.path.split('/').slice(0, -1).join('/');
      B.node(d.id, { label: label, group: group, attrs: attrs });
    });
    var links = 0, embeds = 0, ambiguous = 0;
    docs.forEach(function (d) {
      var body = d.fm.body.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ');
      var from = B.node(d.id);
      var target = function (raw, kind) {
        var t = raw.replace(/[#^|].*$/, '').replace(/\.(md|markdown)$/i, '').trim();
        if (!t) return;
        try { t = decodeURIComponent(t); } catch (e) { /* keep as is */ }
        var hit = lookup.get(t.toLowerCase()) || lookup.get(stemOf(t).toLowerCase());
        var to;
        if (hit) to = B.node(hit.id);
        else { var ex = B.map.has(B.key(t)); to = B.node(t, ex ? null : { ghost: true }); if (!ex && to) B.r.ghosts++; }
        if (to && to !== from) { B.edge(from, to, { kind: kind }); if (kind === 'embed') embeds++; else links++; }
      };
      body.replace(/(!?)\[\[([^\]\n]+)\]\]/g, function (_, bang, t) { target(t, bang ? 'embed' : 'link'); return ''; });
      body.replace(/(?<!!)\[[^\]\n]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, function (_, t) { if (/^[a-z][a-z0-9+.-]*:|^#|^mailto:/i.test(t)) return ''; target(t, 'link'); return ''; });
    });
    B.r.notes.unshift('Read ' + docs.length + ' note' + (docs.length === 1 ? '' : 's') + ' and found ' + links + ' link' + (links === 1 ? '' : 's') + (embeds ? ' and ' + embeds + ' embed' + (embeds === 1 ? '' : 's') : '') + '. Names are matched without regard to capital letters, paths or file endings; the first tag (or the folder) becomes the group.');
    void ambiguous;
    return B.done('notes');
  }

  /* ------------------------------------------------------------ XML scanner (no entity tricks, no DOCTYPE processing, no recursion) */
  var XML_MAX_DEPTH = 2000;
  function xmlDecode(s) {
    if (s.indexOf('&') < 0) return s;
    return s.replace(/&(#x[0-9a-f]{1,6}|#[0-9]{1,7}|lt|gt|amp|quot|apos);/gi, function (m, e) {
      var c = e.toLowerCase();
      if (c === 'lt') return '<'; if (c === 'gt') return '>'; if (c === 'amp') return '&'; if (c === 'quot') return '"'; if (c === 'apos') return "'";
      var cp = c.charAt(1) === 'x' ? parseInt(c.slice(2), 16) : parseInt(c.slice(1), 10);
      return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : '\ufffd';
    });
  }
  var ATTR = /([^\s=\/"'<>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  var TAGEND = /[^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>/y;
  /** Walks XML text. h.open(name, attrs, selfClosing), h.close(name), h.text(string). Names lose their prefix (x:y -> y); attrs keep both forms. */
  function xmlScan(text, h) {
    var i = 0, n = text.length, depth = 0, lt, e;
    while (i < n) {
      lt = text.indexOf('<', i);
      if (lt < 0) { if (h.text && i < n) h.text(xmlDecode(text.slice(i))); break; }
      if (lt > i && h.text) h.text(xmlDecode(text.slice(i, lt)));
      if (text.charCodeAt(lt + 1) === 33) {                       // <!
        if ((text.charCodeAt(lt + 2) === 45 && text.charCodeAt(lt + 3) === 45)) { e = text.indexOf('-->', lt + 4); if (e < 0) throw new Error('The XML is cut off.'); i = e + 3; continue; }
        if (text.startsWith('<![CDATA[', lt)) { e = text.indexOf(']]>', lt + 9); if (e < 0) throw new Error('The XML is cut off.'); if (h.text) h.text(text.slice(lt + 9, e)); i = e + 3; continue; }
        e = text.indexOf('>', lt); var br = text.indexOf('[', lt);   // DOCTYPE, possibly with an inner subset that we skip unread
        if (br >= 0 && (e < 0 || br < e)) { var close = text.indexOf(']', br); e = close < 0 ? -1 : text.indexOf('>', close); }
        if (e < 0) throw new Error('The XML is cut off.');
        i = e + 1; continue;
      }
      if (text.charCodeAt(lt + 1) === 63) { e = text.indexOf('?>', lt + 2); if (e < 0) throw new Error('The XML is cut off.'); i = e + 2; continue; }
      TAGEND.lastIndex = lt + 1;
      var m = TAGEND.exec(text);
      if (!m) throw new Error('The XML is cut off.');
      i = lt + 1 + m[0].length;
      var body = m[0].slice(0, -1);
      if (body.charCodeAt(0) === 47) {                            // </name>
        depth--;
        var cn = body.slice(1).trim(), cc = cn.indexOf(':');
        if (h.close) h.close(cc >= 0 ? cn.slice(cc + 1) : cn);
        continue;
      }
      var self = body.charCodeAt(body.length - 1) === 47;
      if (self) body = body.slice(0, -1);
      var sp = body.search(/[\s]/), nm = sp < 0 ? body : body.slice(0, sp), col = nm.indexOf(':');
      var attrs = {};
      if (sp >= 0) {
        ATTR.lastIndex = 0;
        var am;
        while ((am = ATTR.exec(body.slice(sp)))) {
          var v = xmlDecode(am[2] !== undefined ? am[2] : am[3]), an = am[1], ac = an.indexOf(':');
          if (BAD_KEYS[an]) continue;
          attrs[an] = v;
          if (ac >= 0 && !(an.slice(ac + 1) in attrs) && !BAD_KEYS[an.slice(ac + 1)]) attrs[an.slice(ac + 1)] = v;
        }
      }
      var local = col >= 0 ? nm.slice(col + 1) : nm;
      if (h.open) h.open(local, attrs, self);
      if (self) { if (h.close) h.close(local); } else if (++depth > XML_MAX_DEPTH) throw new Error('The XML is nested too deeply to be real data.');
    }
  }

  /* ------------------------------------------------------------ graph files: GraphML, GEXF, GML, Graphviz DOT */
  var GROUP_NAMES = { group: 1, community: 1, cluster: 1, modularity_class: 1, class: 1, module: 1, category: 1, type: 1 };
  var LABEL_NAMES = { label: 1, name: 1, title: 1, labels: 1 };
  var WEIGHT_NAMES = { weight: 1, value: 1, w: 1, strength: 1, count: 1 };
  /** Shared finish for the three readers: nodes first (so placeholders are only for ends never described), then links. */
  function finishGraphFile(B, nodes, edges, directedDefault, format, intro) {
    nodes.forEach(function (x) { B.node(x.id, { label: x.label, group: x.group, attrs: x.attrs }); });
    edges.forEach(function (x) {
      var a = x.from, b = x.to;
      var na = B.map.get(B.key(cleanText(a))), nb = B.map.get(B.key(cleanText(b)));
      if (!na && cleanText(a)) { na = B.node(a, { ghost: true }); if (na) B.r.ghosts++; }
      if (!nb && cleanText(b)) { nb = B.node(b, { ghost: true }); if (nb) B.r.ghosts++; }
      B.edge(na, nb, { label: x.label, weight: x.weight, kind: x.directed === false || (x.directed === undefined && !directedDefault) ? 'undirected' : '', attrs: x.attrs });
    });
    B.r.notes.unshift(intro);
    return B.done(format);
  }
  function typed(v, type) { if (/^(int|long|float|double|integer|number|real)/i.test(type || '')) { var x = Number(v); if (v !== '' && isFinite(x)) return x; } else if (/^bool/i.test(type || '')) return /^(true|1)$/i.test(v) ? 1 : 0; return v; }
  function applyProp(target, name, val, type, isNode) {
    if (val === '' || val === undefined) return;
    var ln = String(name).toLowerCase();
    if (LABEL_NAMES[ln] && !target.label) target.label = String(val);
    else if (isNode && GROUP_NAMES[ln] && !target.group) target.group = String(val);
    else if (!isNode && WEIGHT_NAMES[ln] && target.weight === undefined && isFinite(Number(val))) target.weight = Number(val);
    else if (!BAD_KEYS[name] && Object.keys(target.attrs).length < MAX_ATTRS) target.attrs[name] = typeof val === 'string' ? typed(val, type) : val;
  }

  function importGraphML(text, name, opts) {
    var B = new Builder(name, opts), keys = {}, nodes = [], edges = [], stack = [], cur = null, dkey = null, buf = null, ybuf = null, defDir = true, graphs = 0, hyper = 0;
    xmlScan(stripBom(text), {
      open: function (tag, a, self) {
        if (tag === 'key') keys[a.id] = { name: a['attr.name'] || a.id, type: a['attr.type'] || '', dom: a['for'] || 'all' };
        else if (tag === 'graph') { graphs++; if (graphs === 1) defDir = a.edgedefault !== 'undirected'; stack.push(cur); cur = null; }
        else if (tag === 'node') { stack.push(cur); cur = { kind: 'n', id: a.id || '', label: '', group: '', attrs: {} }; if (self) { nodes.push(cur); cur = stack.pop(); } }
        else if (tag === 'edge') { stack.push(cur); cur = { kind: 'e', from: a.source || '', to: a.target || '', label: '', weight: undefined, attrs: {}, directed: a.directed === undefined ? undefined : a.directed === 'true' }; if (self) { edges.push(cur); cur = stack.pop(); } }
        else if (tag === 'hyperedge') hyper++;
        else if (tag === 'data' && cur) { dkey = a.key; buf = ''; }
        else if ((tag === 'NodeLabel' || tag === 'EdgeLabel') && cur) ybuf = '';
      },
      text: function (t) { if (buf !== null) buf += t; if (ybuf !== null) ybuf += t; },
      close: function (tag) {
        if (tag === 'graph') cur = stack.pop() || null;
        else if (tag === 'node' && cur && cur.kind === 'n') { nodes.push(cur); cur = stack.pop() || null; }
        else if (tag === 'edge' && cur && cur.kind === 'e') { edges.push(cur); cur = stack.pop() || null; }
        else if ((tag === 'NodeLabel' || tag === 'EdgeLabel') && cur && ybuf !== null) { var yl = ybuf.replace(/\s+/g, ' ').trim(); if (yl && !cur.ylabel) cur.ylabel = yl; ybuf = null; }
        else if (tag === 'data' && cur && buf !== null) {
          var kd = keys[dkey] || { name: dkey || 'data', type: '' };
          if (buf.trim()) applyProp(cur, kd.name, buf.trim(), kd.type, cur.kind === 'n');
          buf = null; dkey = null;
        }
      }
    });
    nodes.forEach(function (x) { if (!x.label && x.ylabel) x.label = x.ylabel; });
    edges.forEach(function (x) { if (!x.label && x.ylabel) x.label = x.ylabel; });
    if (hyper) B.r.notes.push(hyper + ' hyperedge' + (hyper === 1 ? '' : 's') + ' (links joining more than two items) can\'t be shown and ' + (hyper === 1 ? 'was' : 'were') + ' skipped.');
    return finishGraphFile(B, nodes, edges, defDir, 'graphml', 'Read as a GraphML file.');
  }

  function importGEXF(text, name, opts) {
    var B = new Builder(name, opts), nattr = {}, eattr = {}, cls = 'node', nodes = [], edges = [], cur = null, defDir = true, inNodes = false;
    xmlScan(stripBom(text), {
      open: function (tag, a, self) {
        if (tag === 'graph') defDir = a.defaultedgetype !== 'undirected';
        else if (tag === 'attributes') cls = a['class'] === 'edge' ? 'edge' : 'node';
        else if (tag === 'attribute') (cls === 'edge' ? eattr : nattr)[a.id] = { name: a.title || a.id, type: a.type || '' };
        else if (tag === 'node') { cur = { kind: 'n', id: a.id || '', label: a.label || '', group: '', attrs: {} }; if (self) { nodes.push(cur); cur = null; } }
        else if (tag === 'edge') {
          cur = { kind: 'e', from: a.source || '', to: a.target || '', label: a.label || '', weight: a.weight !== undefined && isFinite(Number(a.weight)) ? Number(a.weight) : undefined, attrs: {}, directed: a.type === undefined ? undefined : a.type !== 'undirected' };
          if (self) { edges.push(cur); cur = null; }
        }
        else if (tag === 'attvalue' && cur) { var def = (cur.kind === 'e' ? eattr : nattr)[a['for']] || { name: a['for'] || 'value', type: '' }; applyProp(cur, def.name, a.value, def.type, cur.kind === 'n'); }
      },
      close: function (tag) {
        if (tag === 'node' && cur && cur.kind === 'n') { nodes.push(cur); cur = null; }
        else if (tag === 'edge' && cur && cur.kind === 'e') { edges.push(cur); cur = null; }
      }
    });
    void inNodes;
    return finishGraphFile(B, nodes, edges, defDir, 'gexf', 'Read as a GEXF (Gephi) file.');
  }

  /** GML: key value pairs and [ nested lists ]; read with an explicit stack so hostile nesting can't overflow. */
  function gmlTokens(text) {
    var out = [], re = /\s*(?:(#[^\n]*)|("(?:[^"\\]|\\.)*"?)|(\[)|(\])|([^\s\[\]"]+))/gy, m, last = 0;
    text = stripBom(text);
    re.lastIndex = 0;
    while (re.lastIndex < text.length && (m = re.exec(text))) {
      if (m[1] !== undefined) continue;
      if (m[2] !== undefined) out.push({ s: xmlDecode(m[2].slice(1, m[2].length > 1 && m[2].slice(-1) === '"' ? -1 : undefined)) });
      else if (m[3]) out.push('[');
      else if (m[4]) out.push(']');
      else if (m[5] !== undefined) out.push(m[5]);
      if (re.lastIndex === last) break;
      last = re.lastIndex;
    }
    return out;
  }
  function importGML(text, name, opts) {
    var B = new Builder(name, opts), toks = gmlTokens(text), nodes = [], edges = [], directed = false;
    if (!toks.some(function (t) { return typeof t === 'string' && t.toLowerCase() === 'graph'; })) throw new Error('This does not look like a GML file (no "graph [" section).');
    // a hand-rolled walk: re-scan tokens for node/edge blocks, which sit one level inside graph
    var depth = 0, block = null;
    for (var j = 0; j < toks.length; j++) {
      var t = toks[j];
      if (t === '[') { depth++; continue; }
      if (t === ']') { if (block && depth === block.depth) { (block.type === 'node' ? nodes : edges).push(block.o); block = null; } depth--; continue; }
      if (typeof t !== 'string') continue;
      var lt = t.toLowerCase(), nx = toks[j + 1];
      if (nx === '[' && depth === 1 && (lt === 'node' || lt === 'edge') && !block) { block = { type: lt, depth: depth + 1, o: lt === 'node' ? { id: '', label: '', group: '', attrs: {} } : { from: '', to: '', label: '', weight: undefined, attrs: {} } }; continue; }
      if (depth === 1 && lt === 'directed' && nx !== undefined && typeof nx === 'string') directed = nx === '1' || /^true$/i.test(nx);
      if (block && depth === block.depth && nx !== undefined && nx !== '[' && nx !== ']') {
        var val = typeof nx === 'string' ? nx : nx.s;
        if (block.type === 'node') { if (lt === 'id') block.o.id = val; else applyProp(block.o, lt, val, '', true); }
        else if (lt === 'source') block.o.from = val; else if (lt === 'target') block.o.to = val; else applyProp(block.o, lt, val, '', false);
      }
      if (nx !== undefined && nx !== '[' && nx !== ']') j++;   // the value belongs to this key
    }
    return finishGraphFile(B, nodes, edges, directed, 'gml', 'Read as a GML file.');
  }

  /** Graphviz DOT: nodes, node attributes (label, group via clusters), edges with chains, sets and undirected links. Layout hints are ignored. */
  function dotTokens(text) {
    var out = [], re = /\s*(?:(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\[\s\S])*"?)|(<(?:[^<>]|<[^<>]*>)*>)|(->|--)|([{}\[\];,=:+])|([^\s{}\[\];,=:+"<>-]+|-))/gy, m, last = 0;
    text = stripBom(text); re.lastIndex = 0;
    while (re.lastIndex < text.length && (m = re.exec(text))) {
      if (m[1] !== undefined) { /* comment */ }
      else if (m[2] !== undefined) out.push({ s: m[2].replace(/^"|"$/g, '').replace(/\\(["\\])/g, '$1').replace(/\\n/g, '\n') });
      else if (m[3] !== undefined) out.push({ s: m[3].slice(1, -1).replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim() });
      else if (m[4] !== undefined) out.push(m[4]);
      else if (m[5] !== undefined) out.push(m[5]);
      else if (m[6] !== undefined) out.push(m[6]);
      if (re.lastIndex === last) break;
      last = re.lastIndex;
    }
    return out;
  }
  function importDOT(text, name, opts) {
    var B = new Builder(name, opts), toks = dotTokens(text), nodes = new Map(), order = [], edges = [], i = 0, directedGraph = true;
    var scopes = [{ group: '', members: null }], nodeDefaults = [{}];
    var isId = function (t) { return t !== undefined && (typeof t === 'object' || /^[^{}\[\];,=:+]/.test(t) && t !== '->' && t !== '--'); };
    var idOf = function (t) { return typeof t === 'object' ? t.s : t; };
    var KW = /^(strict|graph|digraph|subgraph|node|edge)$/i;
    var touch = function (id) {
      var nd = nodes.get(id);
      if (!nd) { if (nodes.size >= (B.maxNodes + 1)) return null; nd = { id: id, label: '', group: scopes[scopes.length - 1].group, attrs: {} }; nodes.set(id, nd); order.push(nd); }
      else if (!nd.group && scopes[scopes.length - 1].group) nd.group = scopes[scopes.length - 1].group;
      for (var s = 0; s < scopes.length; s++) if (scopes[s].members) scopes[s].members.add(id);
      return nd;
    };
    var attrList = function () {   // at '[': read a=b pairs until ']'
      var a = {};
      i++;
      while (i < toks.length && toks[i] !== ']') {
        var k = toks[i];
        if (isId(k) && toks[i + 1] === '=' && isId(toks[i + 2])) { a[String(idOf(k)).toLowerCase()] = idOf(toks[i + 2]); i += 3; } else i++;
        if (toks[i] === ';' || toks[i] === ',') i++;
      }
      i++;
      return a;
    };
    var first = String(toks[0] && toks[0].s !== undefined ? toks[0].s : toks[0]).toLowerCase();
    if (first === 'strict') directedGraph = String(toks[1]).toLowerCase() !== 'graph'; else directedGraph = first !== 'graph';
    var guard = 0, anon = 0;
    var operand = function () {    // an id, id:port, or { set } / subgraph; returns array of ids or null
      var t = toks[i];
      if (t === '{' || (typeof t === 'string' && t.toLowerCase() === 'subgraph')) return block();
      if (!isId(t) || (typeof t === 'string' && KW.test(t))) return null;
      i++;
      var id = idOf(t);
      while (toks[i] === ':' && isId(toks[i + 1])) i += 2;   // port
      if (!touch(id)) return [];
      return [id];
    };
    var block = function () {       // subgraph [name] { ... } -> its member ids
      var nm = '';
      if (typeof toks[i] === 'string' && toks[i].toLowerCase() === 'subgraph') { i++; if (isId(toks[i]) && toks[i] !== '{') { nm = idOf(toks[i]); i++; } }
      if (toks[i] !== '{') return [];
      i++;
      if (scopes.length > 200) throw new Error('This DOT file is nested too deeply to be real data.');
      var sc = { group: /^cluster/i.test(nm) ? nm : scopes[scopes.length - 1].group, members: new Set(), label: '' };
      scopes.push(sc); nodeDefaults.push(Object.assign({}, nodeDefaults[nodeDefaults.length - 1]));
      statements('}');
      scopes.pop(); nodeDefaults.pop();
      if (sc.label && /^cluster/i.test(nm)) sc.members.forEach(function (id) { var nd = nodes.get(id); if (nd && nd.group === nm) nd.group = sc.label; });
      if (toks[i] === '}') i++;
      return Array.from(sc.members);
    };
    var statements = function (stop) {
      while (i < toks.length && toks[i] !== stop) {
        if (++guard > 40000000) throw new Error('This DOT file is too large to read.');
        var t = toks[i];
        if (t === ';' || t === ',') { i++; continue; }
        if (typeof t === 'string' && /^(node|edge|graph)$/i.test(t) && toks[i + 1] === '[') { var kind = t.toLowerCase(); i++; var al = attrList(); if (kind === 'node') Object.assign(nodeDefaults[nodeDefaults.length - 1], al); continue; }
        if (isId(t) && toks[i + 1] === '=' && isId(toks[i + 2]) && typeof t === 'string' && !KW.test(t)) { if (String(t).toLowerCase() === 'label' && scopes.length > 1) scopes[scopes.length - 1].label = idOf(toks[i + 2]); i += 3; continue; }
        // header: [strict] (di)graph [name] {
        if (typeof t === 'string' && /^(strict|graph|digraph)$/i.test(t) && stop === undefined) { while (i < toks.length && toks[i] !== '{') i++; i++; continue; }
        var left = operand();
        if (left === null) { i++; continue; }
        var chain = [left], ops = [];
        while (toks[i] === '->' || toks[i] === '--') { ops.push(toks[i]); i++; var r = operand(); if (r === null) break; chain.push(r); }
        var attrs = {};
        while (toks[i] === '[') Object.assign(attrs, attrList());
        if (!ops.length) {
          left.forEach(function (id) {
            var nd = nodes.get(id); if (!nd) return;
            var all = Object.assign({}, nodeDefaults[nodeDefaults.length - 1], attrs);
            if (attrs.label !== undefined && attrs.label !== '\\N') nd.label = attrs.label;
            if (all.group !== undefined && !nd.group) nd.group = String(all.group);
          });
        } else {
          for (var c = 0; c + 1 < chain.length; c++) {
            for (var x = 0; x < chain[c].length; x++) for (var y = 0; y < chain[c + 1].length; y++) {
              if (edges.length >= B.maxEdges + 1) break;
              edges.push({ from: chain[c][x], to: chain[c + 1][y], label: attrs.label || '', weight: attrs.weight !== undefined && isFinite(Number(attrs.weight)) ? Number(attrs.weight) : undefined, attrs: {}, directed: ops[c] === '->' });
            }
          }
        }
      }
    };
    void anon;
    statements(undefined);
    return finishGraphFile(B, order, edges, directedGraph, 'dot', 'Read as a Graphviz DOT file.');
  }

  /* ------------------------------------------------------------ Excel: sheets of an .xlsx become tables */
  var XL_COLS = 16384;
  function colIndex(ref) { var m = /^([A-Za-z]{1,3})/.exec(ref || ''); if (!m) return -1; var s = m[1].toUpperCase(), n = 0; for (var i = 0; i < s.length; i++) n = n * 26 + s.charCodeAt(i) - 64; return n - 1; }
  var XL_BUILTIN_DATES = { 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 19: 1, 20: 1, 21: 1, 22: 1, 45: 1, 46: 1, 47: 1 };
  function isDateFormat(code) { var c = String(code).replace(/"[^"]*"|\\.|\[[^\]]*\]|_.|\*./g, ''); return /[ymdhs]/i.test(c) && !/^(general|0|#)/i.test(c) || /[dy]{2}|m{1,2}[\/\-.]|[hH]:|:[sS]/.test(c) && /[ymdhs]/i.test(c); }
  function xlDate(serial, d1904) {
    if (!isFinite(serial) || serial < 0 || serial > 2958465) return null;
    var ms = Math.round((serial - (d1904 ? 24107 : 25569)) * 86400000), d = new Date(ms);
    if (isNaN(d.getTime())) return null;
    var iso = d.toISOString();
    return serial % 1 === 0 ? iso.slice(0, 10) : iso.slice(0, 19).replace('T', ' ');
  }
  function csvCell(v) { return /[",\r\n]/.test(v) || /^\s|\s$/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  /** parts: { 'xl/workbook.xml': text, ... } (only the ones that exist). Returns [{ sheet, csv, rows }]. */
  function xlsxSheets(parts, opts) {
    opts = opts || {};
    var maxRows = opts.maxRows || 2000000, sst = [], dateXf = {}, d1904 = false, sheets = [], rels = {};
    if (parts['xl/sharedStrings.xml']) {
      var cur = null, inT = false;
      xmlScan(parts['xl/sharedStrings.xml'], {
        open: function (t, a) { if (t === 'si') cur = ''; else if (t === 't' && cur !== null) inT = true; else if ((t === 'rPh' || t === 'phoneticPr') && cur !== null) inT = false; },
        text: function (s) { if (inT && cur !== null && cur.length < 40000) cur += s; },
        close: function (t) { if (t === 't') inT = false; else if (t === 'si') { sst.push(cur || ''); cur = null; if (sst.length > 5000000) throw new Error('This workbook has too many distinct text values.'); } }
      });
    }
    if (parts['xl/styles.xml']) {
      var fmts = {}, inXfs = false, xi = 0;
      xmlScan(parts['xl/styles.xml'], {
        open: function (t, a) {
          if (t === 'numFmt') fmts[a.numFmtId] = a.formatCode || '';
          else if (t === 'cellXfs') { inXfs = true; xi = 0; }
          else if (t === 'xf' && inXfs) { var id = Number(a.numFmtId); if (XL_BUILTIN_DATES[id] || (fmts[id] !== undefined && isDateFormat(fmts[id]))) dateXf[xi] = 1; xi++; }
        },
        close: function (t) { if (t === 'cellXfs') inXfs = false; }
      });
    }
    if (parts['xl/workbook.xml']) xmlScan(parts['xl/workbook.xml'], { open: function (t, a) { if (t === 'sheet') sheets.push({ name: a.name || 'Sheet' + (sheets.length + 1), rid: a['r:id'] || a.id }); else if (t === 'workbookPr' && /^(1|true)$/i.test(a.date1904 || '')) d1904 = true; } });
    if (parts['xl/_rels/workbook.xml.rels']) xmlScan(parts['xl/_rels/workbook.xml.rels'], { open: function (t, a) { if (t === 'Relationship' && a.Id) rels[a.Id] = a.Target || ''; } });
    var out = [];
    sheets.forEach(function (sh, si) {
      var target = rels[sh.rid] || 'worksheets/sheet' + (si + 1) + '.xml';
      target = target.replace(/^\/?(xl\/)?/, '').replace(/^\.\//, '');
      var xml = parts['xl/' + target];
      if (!xml) return;
      var lines = [], row = null, rowHas = false, c = null, cell = null, inV = false, inIs = false, rowCount = 0, lastCol = -1, truncated = false;
      var flushRow = function () {
        if (!row) return;
        if (rowHas) {
          var end = row.length; while (end > 0 && (row[end - 1] === undefined || row[end - 1] === '')) end--;
          var s = new Array(end);
          for (var q = 0; q < end; q++) s[q] = row[q] === undefined ? '' : csvCell(row[q]);
          lines.push(s.join(','));
          if (++rowCount >= maxRows) truncated = true;
        }
        row = null; rowHas = false;
      };
      xmlScan(xml, {
        open: function (t, a, self) {
          if (truncated) return;
          if (t === 'row') { flushRow(); row = []; lastCol = -1; }
          else if (t === 'c') {
            cell = { type: a.t || 'n', xf: Number(a.s) || 0, v: '' };
            var ci = colIndex(a.r); if (ci < 0) ci = lastCol + 1;
            if (ci >= XL_COLS) { cell = null; return; }
            cell.col = ci; lastCol = ci;
            if (self) cell = null;
          }
          else if (t === 'v' && cell) inV = true;
          else if (t === 'is' && cell) inIs = true;
          else if (t === 't' && cell && inIs) inV = true;
        },
        text: function (s) { if (cell && inV && cell.v.length < 40000) cell.v += s; },
        close: function (t) {
          if (t === 'v' || (t === 't' && inIs)) inV = false;
          else if (t === 'is') inIs = false;
          else if (t === 'c' && cell) {
            var v = cell.v;
            if (cell.type === 's') v = sst[Number(v)] !== undefined ? sst[Number(v)] : '';
            else if (cell.type === 'b') v = v === '1' ? 'TRUE' : 'FALSE';
            else if (cell.type === 'n' || cell.type === '') { if (v !== '' && dateXf[cell.xf]) { var dt = xlDate(Number(v), d1904); if (dt) v = dt; } else if (v !== '' && isFinite(Number(v))) v = String(Number(v)); }
            if (v !== '' && row) { if (!row) row = []; row[cell.col] = v; rowHas = true; }
            cell = null;
          }
          else if (t === 'row') flushRow();
        }
      });
      flushRow();
      if (lines.length) out.push({ sheet: sh.name, csv: lines.join('\n'), rows: lines.length, truncated: truncated });
    });
    return out;
  }

  /* ------------------------------------------------------------ choosing a reader */
  function sniff(text, filename) {
    var t = stripBom(String(text)).trim(), ext = (filename || '').toLowerCase().split('.').pop();
    if (!t) return 'empty';
    if (ext === 'json' || ext === 'canvas' || ext === 'jsonl' || ext === 'ndjson' || /^[\[{]/.test(t)) {
      try { JSON.parse(t); return 'json'; } catch (e) { if (ext === 'json' || ext === 'canvas') return 'json'; }
    }
    if (ext === 'graphml') return 'graphml';
    if (ext === 'gexf') return 'gexf';
    if (ext === 'gml' || /^(creator\b[^\n]*\n\s*)?graph\s*\[/i.test(t)) return 'gml';
    if (ext === 'dot' || ext === 'gv' || /^(strict\s+)?(di)?graph\b[^{]*\{/i.test(t)) return 'dot';
    var root = /<(?:\w+:)?(graphml|gexf)\b/i.exec(t.slice(0, 6000));
    if (root && t.charAt(0) === '<') return root[1].toLowerCase();
    if (ext === 'xml' || /^<\?xml/i.test(t)) return 'xml';
    var lines = t.split(LINEBREAK).filter(function (l) { return l.trim(); });
    var arrows = lines.filter(function (l) { return /(->|=>|→|<->|-->)/.test(l); }).length;
    if (arrows >= Math.max(2, lines.length * 0.5)) return 'arrows';
    if (ext === 'csv' || ext === 'tsv') return 'table';
    if (ext === 'md' || ext === 'markdown') return /\[\[|\]\(/.test(t) ? 'notes' : 'outline';
    var d = sniffDelimiter(t);
    if (d && lines.length >= 2) return 'table';
    if (/\[\[[^\]]+\]\]/.test(t) && lines.length < 4) return 'notes';
    return 'outline';
  }
  function xmlNotGraph(n) { throw new Error('"' + n + '" is an XML file, but not a kind of network file I know (GraphML and GEXF work).'); }
  /** One call: files [{name, path, text}] or one pasted text, format 'auto' | 'table' | 'json' | 'arrows' | 'outline' | 'notes'. */
  function importAny(files, opts) {
    opts = opts || {};
    if (!Array.isArray(files)) files = [{ name: opts.name || 'Pasted data', text: String(files) }];
    files = files.filter(function (f) { return f && typeof f.text === 'string'; });
    if (!files.length) throw new Error('There was nothing to read.');
    var fmt = opts.format && opts.format !== 'auto' ? opts.format : null;
    var name = opts.name || (files.length === 1 ? files[0].name.replace(/\.[^.]+$/, '') : 'Imported notes');
    var textFiles = files.filter(function (f) { return /\.(md|markdown|txt)$/i.test(f.name) || /\.(md|markdown|txt)$/i.test(f.path || ''); });
    if (!fmt && files.length > 1 && textFiles.length === files.length) fmt = 'notes';
    if (fmt === 'notes' || (!fmt && files.length > 1)) {
      if (fmt === 'notes' || files.every(function (f) { return sniff(f.text, f.name) === 'notes' || sniff(f.text, f.name) === 'outline'; })) return importNotes(files, name, opts);
    }
    var skippedFiles = [], firstErr = null, used = [];
    var results = files.map(function (f) {
      try { var o = readOne(f); used.push(f); return o; }
      catch (e) { if (files.length === 1) throw e; if (!firstErr) firstErr = e; skippedFiles.push('"' + f.name + '" was skipped: ' + e.message.replace(/^"[^"]*" /, '')); return null; }
    }).filter(Boolean);
    function readOne(f) {
      var kind = fmt || sniff(f.text, f.name);
      if (kind === 'empty') throw new Error('"' + f.name + '" is empty.');
      var nm = f.name.replace(/\.[^.]+$/, '');
      var out = kind === 'table' ? importDelimited(f.text, nm, opts) : kind === 'json' ? importJSON(f.text, nm, opts) : kind === 'arrows' ? importArrows(f.text, nm, opts) : kind === 'graphml' ? importGraphML(f.text, nm, opts) : kind === 'gexf' ? importGEXF(f.text, nm, opts) : kind === 'gml' ? importGML(f.text, nm, opts) : kind === 'dot' ? importDOT(f.text, nm, opts) : kind === 'xml' ? xmlNotGraph(f.name) : kind === 'notes' ? importNotes([f], nm, opts) : importOutline(f.text, nm, opts);
      out.kind = kind;
      return out;
    }
    if (!results.length) throw firstErr || new Error('There was nothing to read.');
    files = used;
    var first = results[0];
    if (results.length === 1) { if (skippedFiles.length) first.report.notes = skippedFiles.slice(0, 8).concat(first.report.notes); return first; }
    var merged = mergeMany(results.map(function (r) { return r.graph; }));
    merged.name = name;
    var notes = [];
    results.forEach(function (r, i) { if (i < 12) notes.push('File ' + (i + 1) + ' (' + files[i].name + '): ' + r.report.nodes + ' items, ' + r.report.edges + ' links.'); });
    if (results.length > 12) notes.push('…and ' + (results.length - 12) + ' more files, all merged by name.');
    if (skippedFiles.length) { skippedFiles.slice(0, 8).forEach(function (x) { notes.push(x); }); if (skippedFiles.length > 8) notes.push('…and ' + (skippedFiles.length - 8) + ' more files were skipped.'); }
    return { graph: merged, report: { format: 'several files', nodes: merged.nodes.length, edges: merged.edges.length, ghosts: 0, notes: notes, counts: {} }, kind: 'several' };
  }

  /* ------------------------------------------------------------ merging and tidying */
  function copyGraph(g) { return JSON.parse(JSON.stringify(g)); }
  /** Adds the graphs after the first to a copy of the first (items matched by id; links added unless already there). Linear in the total size. */
  function mergeMany(list) {
    var g = copyGraph(list[0]), byId = new Map(g.nodes.map(function (n) { return [n.id, n]; })), seen = new Set(g.edges.map(function (e) { return e.from + '\u0001' + e.to + '\u0001' + e.kind + '\u0001' + e.label; }));
    for (var li = 1; li < list.length; li++) {
      var b = list[li];
      b.nodes.forEach(function (n) {
        var ex = byId.get(n.id);
        if (!ex) { var c = JSON.parse(JSON.stringify(n)); g.nodes.push(c); byId.set(c.id, c); }
        else {
          if (!ex.group && n.group) ex.group = n.group;
          if (!ex.valence && n.valence) ex.valence = n.valence;
          if (ex.ghost && !n.ghost) { ex.ghost = false; ex.label = n.label; }
          Object.keys(n.attrs || {}).forEach(function (k) { if (!(k in ex.attrs) && !BAD_KEYS[k]) ex.attrs[k] = n.attrs[k]; });
        }
      });
      b.edges.forEach(function (e) {
        var k = e.from + '\u0001' + e.to + '\u0001' + e.kind + '\u0001' + e.label;
        if (!seen.has(k)) { seen.add(k); g.edges.push(JSON.parse(JSON.stringify(e))); }
      });
      if (!g.start && b.start) g.start = b.start;
      if (!g.flavor && b.flavor) g.flavor = b.flavor;
      if (!g.calc && b.calc) g.calc = b.calc;
      if (!g.roles && b.roles) g.roles = b.roles;
      if (!g.states && b.states) g.states = b.states;
    }
    return g;
  }
  function mergeGraphs(a, b) { return mergeMany([a, b]); }
  /** Tidying actions. Each returns { graph, changed: number, text }. */
  var CLEAN = {
    selfLinks: function (g) { var c = copyGraph(g), n = c.edges.length; c.edges = c.edges.filter(function (e) { return e.from !== e.to; }); return { graph: c, changed: n - c.edges.length, text: 'removed ' + (n - c.edges.length) + ' link' + (n - c.edges.length === 1 ? '' : 's') + ' that point to themselves' }; },
    dupLinks: function (g) { var c = copyGraph(g), seen = new Set(), n = c.edges.length; c.edges = c.edges.filter(function (e) { var k = e.from + '\u0001' + e.to + '\u0001' + e.kind + '\u0001' + e.label; if (seen.has(k)) return false; seen.add(k); return true; }); return { graph: c, changed: n - c.edges.length, text: 'removed ' + (n - c.edges.length) + ' repeated link' + (n - c.edges.length === 1 ? '' : 's') }; },
    isolated: function (g) { var c = copyGraph(g), used = new Set(); c.edges.forEach(function (e) { used.add(e.from); used.add(e.to); }); var n = c.nodes.length; c.nodes = c.nodes.filter(function (x) { return used.has(x.id) || x.id === c.start; }); return { graph: c, changed: n - c.nodes.length, text: 'removed ' + (n - c.nodes.length) + ' item' + (n - c.nodes.length === 1 ? '' : 's') + ' with no links' }; },
    placeholders: function (g) { var c = copyGraph(g), gone = new Set(c.nodes.filter(function (x) { return x.ghost; }).map(function (x) { return x.id; })); c.nodes = c.nodes.filter(function (x) { return !gone.has(x.id); }); var n = c.edges.length; c.edges = c.edges.filter(function (e) { return !gone.has(e.from) && !gone.has(e.to); }); return { graph: c, changed: gone.size, text: 'removed ' + gone.size + ' placeholder item' + (gone.size === 1 ? '' : 's') + ' and ' + (n - c.edges.length) + ' link' + (n - c.edges.length === 1 ? '' : 's') + ' to them' }; },
    twoWay: function (g) { var c = copyGraph(g), have = new Set(c.edges.map(function (e) { return e.from + '\u0001' + e.to; })), add = []; c.edges.forEach(function (e) { if (!have.has(e.to + '\u0001' + e.from)) { have.add(e.to + '\u0001' + e.from); add.push({ from: e.to, to: e.from, label: e.label, weight: e.weight, kind: e.kind, attrs: {} }); } }); c.edges = c.edges.concat(add); return { graph: c, changed: add.length, text: 'added ' + add.length + ' return link' + (add.length === 1 ? '' : 's') }; },
    reverse: function (g) { var c = copyGraph(g); c.edges.forEach(function (e) { var t = e.from; e.from = e.to; e.to = t; }); return { graph: c, changed: c.edges.length, text: 'reversed the direction of ' + c.edges.length + ' link' + (c.edges.length === 1 ? '' : 's') }; },
    sameLabel: function (g) {
      var c = copyGraph(g), byLabel = new Map(), map = {}, gone = 0;
      c.nodes.forEach(function (n) { var k = n.label.toLowerCase().trim(); if (!byLabel.has(k)) byLabel.set(k, n); else { map[n.id] = byLabel.get(k).id; gone++; } });
      c.nodes = c.nodes.filter(function (n) { return !map[n.id]; });
      c.edges.forEach(function (e) { if (map[e.from]) e.from = map[e.from]; if (map[e.to]) e.to = map[e.to]; });
      if (c.start && map[c.start]) c.start = map[c.start];
      return { graph: c, changed: gone, text: 'merged ' + gone + ' item' + (gone === 1 ? '' : 's') + ' that had the same name' };
    }
  };

  function edgeAttrs(e) {
    var attrs = {};
    if (e.attrs && typeof e.attrs === 'object') Object.keys(e.attrs).slice(0, MAX_ATTRS).forEach(function (k) { if (!BAD_KEYS[k]) attrs[k] = clip(e.attrs[k], 300); });
    return attrs;
  }
  /** Make sure a graph read from storage or a file of ours is safe to use. */
  function sanitizeGraph(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) throw new Error('This is not a saved graph.');
    var ids = new Set(), g = { name: clip(cleanText(raw.name || 'Untitled'), 120), start: raw.start ? String(raw.start) : null, nodes: [], edges: [] };
    raw.nodes.forEach(function (n) {
      if (!n || n.id === undefined) return;
      var id = String(n.id);
      if (ids.has(id) || g.nodes.length >= MAX_NODES) return;
      ids.add(id);
      var attrs = {};
      if (n.attrs && typeof n.attrs === 'object') Object.keys(n.attrs).slice(0, MAX_ATTRS).forEach(function (k) { if (!BAD_KEYS[k]) attrs[k] = clip(n.attrs[k], 300); });
      g.nodes.push({ id: id, label: clip(n.label === undefined ? id : n.label, MAX_LABEL), group: clip(n.group || '', 80), valence: valenceOf(n.valence), ghost: !!n.ghost, attrs: attrs });
    });
    raw.edges.forEach(function (e) {
      if (!e || !ids.has(String(e.from)) || !ids.has(String(e.to)) || g.edges.length >= MAX_EDGES) return;
      var w = Number(e.weight);
      g.edges.push({ from: String(e.from), to: String(e.to), label: clip(e.label || '', MAX_LABEL), weight: isFinite(w) && e.weight !== null && e.weight !== '' && e.weight !== undefined ? w : undefined, kind: clip(e.kind || '', 40), attrs: edgeAttrs(e) });
    });
    if (g.start && !ids.has(g.start)) g.start = null;
    if (raw.flavor === 'story' || raw.flavor === 'data') g.flavor = raw.flavor;
    if (Array.isArray(raw.calc)) g.calc = raw.calc.slice(0, 40).filter(function (c) { return c && typeof c.name === 'string' && typeof c.formula === 'string' && c.name; }).map(function (c) { return { scope: c.scope === 'edges' ? 'edges' : 'nodes', name: clip(cleanText(c.name), 60), formula: clip(c.formula, 500) }; });
    if (raw.roles && typeof raw.roles === 'object') { g.roles = {}; ['colorBy', 'sizeBy', 'widthBy', 'edgeColorBy', 'linkLabels', 'orderBy', 'view'].forEach(function (k) { if (typeof raw.roles[k] === 'string') g.roles[k] = clip(raw.roles[k], 80); }); }
    if (raw.states && Array.isArray(raw.states.names) && raw.states.names.length > 1) {
      g.states = { names: raw.states.names.slice(0, 60).map(function (x) { return clip(cleanText(String(x)), 60); }) };
      var ns = g.states.names.length, vals = function (a) { return Array.isArray(a) ? a.slice(0, ns).map(function (x) { var v = Number(x); return x === null || x === '' || !isFinite(v) ? null : v; }) : null; };
      raw.nodes.forEach(function (n) { if (n && n.vals) { var nn = g.nodes.filter(function (q) { return q.id === String(n.id); })[0]; if (nn) nn.vals = vals(n.vals); } });
      var k2 = 0; raw.edges.forEach(function (e) { if (!e || !ids.has(String(e.from)) || !ids.has(String(e.to))) return; var ge = g.edges[k2++]; if (ge && e.vals) ge.vals = vals(e.vals); });
    }
    return g;
  }

  return {
    importAny: importAny, importDelimited: importDelimited, importTable: importTable, importJSON: importJSON, importArrows: importArrows,
    importGraphML: importGraphML, importGEXF: importGEXF, importGML: importGML, importDOT: importDOT, xlsxSheets: xlsxSheets, xmlScan: xmlScan, Builder: Builder,
    importOutline: importOutline, importNotes: importNotes, guessMapping: guessMapping, parseDelimited: parseDelimited, sniffDelimiter: sniffDelimiter,
    sniff: sniff, mergeGraphs: mergeGraphs, CLEAN: CLEAN, sanitizeGraph: sanitizeGraph, valenceOf: valenceOf
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NFMImport;
