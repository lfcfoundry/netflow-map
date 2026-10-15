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
  var BAD_KEYS = { '__proto__': 1, 'constructor': 1, 'prototype': 1 };

  /* ------------------------------------------------------------ builder: one place that makes nodes and edges safely */
  function Builder(name, opts) {
    this.g = { name: name || 'Untitled', start: null, nodes: [], edges: [] };
    this.opts = opts || {};
    this.map = new Map();
    this.ci = !!this.opts.caseInsensitive;
    this.r = { dupNodes: 0, selfLoops: 0, dupEdges: 0, droppedEdges: 0, ghosts: 0, emptyIds: 0, trimmed: 0, capped: false, notes: [] };
    this.edgeKeys = new Set();
  }
  function clip(s, n) { s = String(s === undefined || s === null ? '' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function cleanText(s) {
    s = String(s === undefined || s === null ? '' : s);
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
        if (props.attrs) for (var a in props.attrs) if (!BAD_KEYS[a] && !(a in nd.attrs) && Object.keys(nd.attrs).length < MAX_ATTRS) nd.attrs[a] = props.attrs[a];
      }
      return nd;
    }
    if (this.g.nodes.length >= MAX_NODES) { this.r.capped = true; return null; }
    nd = { id: id, label: id, group: '', valence: '', ghost: false, attrs: {} };
    if (props) {
      if (props.label) nd.label = clip(cleanText(props.label), MAX_LABEL) || id;
      if (props.group) nd.group = clip(cleanText(props.group), 80);
      if (props.valence) nd.valence = props.valence;
      if (props.ghost) nd.ghost = true;
      if (props.attrs) for (var b in props.attrs) if (!BAD_KEYS[b] && Object.keys(nd.attrs).length < MAX_ATTRS) nd.attrs[b] = props.attrs[b];
    }
    this.map.set(k, nd);
    this.g.nodes.push(nd);
    return nd;
  };
  Builder.prototype.edge = function (a, b, props) {
    if (!a || !b) { this.r.droppedEdges++; return null; }
    props = props || {};
    if (a === b) this.r.selfLoops++;
    var kind = props.kind || '', label = props.label ? clip(cleanText(props.label), MAX_LABEL) : '';
    var dk = a.id + '\u0001' + b.id + '\u0001' + kind + '\u0001' + label;
    if (this.edgeKeys.has(dk)) { this.r.dupEdges++; if (!this.opts.keepDuplicates) return null; }
    if (this.g.edges.length >= MAX_EDGES) { this.r.capped = true; return null; }
    this.edgeKeys.add(dk);
    var wt = props.weight === undefined || props.weight === '' || props.weight === null ? undefined : Number(props.weight);
    var e = { from: a.id, to: b.id, label: label, weight: isFinite(wt) ? wt : undefined, kind: kind, attrs: {} };
    if (props.attrs) for (var x in props.attrs) if (!BAD_KEYS[x] && Object.keys(e.attrs).length < MAX_ATTRS) e.attrs[x] = props.attrs[x];
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
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); }).slice(0, 12), best = ',', bestScore = 0;
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
  /** Full parser: quotes, doubled quotes, line breaks inside quotes, any single-character delimiter. */
  function parseDelimited(text, d) {
    text = stripBom(text);
    var rows = [], row = [], cur = '', q = false, i = 0, n = text.length;
    while (i < n) {
      var ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i += 2; continue; } q = false; i++; continue; }
        cur += ch; i++; continue;
      }
      if (ch === '"' && cur === '') { q = true; i++; continue; }
      if (ch === d) { row.push(cur); cur = ''; i++; continue; }
      if (ch === '\r') { i++; continue; }
      if (ch === '\n') { row.push(cur); cur = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; i++; continue; }
      cur += ch; i++;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
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
    var extra = function (row, skip) { var a = {}; headers.forEach(function (h, i) { if (skip.indexOf(i) < 0 && row[i] !== undefined && String(row[i]).trim() !== '') a[h] = row[i]; }); return a; };
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
  function pick(o, names) { for (var i = 0; i < names.length; i++) if (o[names[i]] !== undefined && o[names[i]] !== null && o[names[i]] !== '') return o[names[i]]; return undefined; }
  function scalar(v) { return v !== null && typeof v === 'object' ? undefined : v; }
  function importJSON(text, name, opts) {
    var data;
    try { data = JSON.parse(stripBom(text)); }
    catch (err) {
      var lines = stripBom(text).split(/\r?\n/).filter(function (l) { return l.trim(); });
      try { data = lines.map(function (l) { return JSON.parse(l); }); } catch (e2) { throw new Error('This is not valid JSON: ' + err.message); }
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
    var B = new Builder(name, opts), lines = stripBom(text).split(/\r?\n/), count = 0, skipped = 0;
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
    var B = new Builder(name, Object.assign({ caseInsensitive: !opts.outlineSeparate }, opts)), lines = stripBom(text).split(/\r?\n/);
    var items = [], tabs = 0, headingSeen = false;
    lines.forEach(function (raw) {
      if (!raw.trim()) return;
      var hm = raw.match(/^(#{1,6})\s+(.*)$/);
      if (hm) { headingSeen = true; items.push({ kind: 'h', level: hm[1].length - 1, text: hm[2] }); return; }
      var m = raw.match(/^([ \t]*)([-*+•▪◦]|\d+[.)])?\s*(.*)$/);
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
    block.split(/\r?\n/).forEach(function (l) {
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

  /* ------------------------------------------------------------ choosing a reader */
  function sniff(text, filename) {
    var t = stripBom(String(text)).trim(), ext = (filename || '').toLowerCase().split('.').pop();
    if (!t) return 'empty';
    if (ext === 'json' || ext === 'canvas' || ext === 'jsonl' || ext === 'ndjson' || /^[\[{]/.test(t)) {
      try { JSON.parse(t); return 'json'; } catch (e) { if (ext === 'json' || ext === 'canvas') return 'json'; }
    }
    if (ext === 'dot' || ext === 'gv') return 'arrows';
    var lines = t.split(/\r?\n/).filter(function (l) { return l.trim(); });
    var arrows = lines.filter(function (l) { return /(->|=>|→|<->|-->)/.test(l); }).length;
    if (arrows >= Math.max(2, lines.length * 0.5)) return 'arrows';
    if (ext === 'csv' || ext === 'tsv') return 'table';
    if (ext === 'md' || ext === 'markdown') return /\[\[|\]\(/.test(t) ? 'notes' : 'outline';
    var d = sniffDelimiter(t);
    if (d && lines.length >= 2) return 'table';
    if (/\[\[[^\]]+\]\]/.test(t) && lines.length < 4) return 'notes';
    return 'outline';
  }
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
    var results = files.map(function (f) {
      var kind = fmt || sniff(f.text, f.name);
      if (kind === 'empty') throw new Error('"' + f.name + '" is empty.');
      var nm = f.name.replace(/\.[^.]+$/, '');
      var out = kind === 'table' ? importDelimited(f.text, nm, opts) : kind === 'json' ? importJSON(f.text, nm, opts) : kind === 'arrows' ? importArrows(f.text, nm, opts) : kind === 'notes' ? importNotes([f], nm, opts) : importOutline(f.text, nm, opts);
      out.kind = kind;
      return out;
    });
    var first = results[0];
    if (results.length === 1) return first;
    var merged = mergeGraphs(results[0].graph, results[1].graph);
    for (var i = 2; i < results.length; i++) merged = mergeGraphs(merged, results[i].graph);
    merged.name = name;
    var notes = [];
    results.forEach(function (r, i) { notes.push('File ' + (i + 1) + ' (' + files[i].name + '): ' + r.report.nodes + ' items, ' + r.report.edges + ' links.'); });
    return { graph: merged, report: { format: 'several files', nodes: merged.nodes.length, edges: merged.edges.length, ghosts: 0, notes: notes, counts: {} }, kind: 'several' };
  }

  /* ------------------------------------------------------------ merging and tidying */
  function copyGraph(g) { return JSON.parse(JSON.stringify(g)); }
  /** Adds graph b to graph a (items matched by id; links added unless already there). Returns a new graph. */
  function mergeGraphs(a, b) {
    var g = copyGraph(a), byId = new Map(g.nodes.map(function (n) { return [n.id, n]; })), seen = new Set(g.edges.map(function (e) { return e.from + '\u0001' + e.to + '\u0001' + e.kind + '\u0001' + e.label; }));
    b.nodes.forEach(function (n) {
      var ex = byId.get(n.id);
      if (!ex) { var c = JSON.parse(JSON.stringify(n)); g.nodes.push(c); byId.set(c.id, c); }
      else {
        if (!ex.group && n.group) ex.group = n.group;
        if (!ex.valence && n.valence) ex.valence = n.valence;
        if (ex.ghost && !n.ghost) { ex.ghost = false; ex.label = n.label; }
        Object.keys(n.attrs || {}).forEach(function (k) { if (!(k in ex.attrs)) ex.attrs[k] = n.attrs[k]; });
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
    return g;
  }
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
    if (raw.roles && typeof raw.roles === 'object') { g.roles = {}; ['colorBy', 'sizeBy', 'widthBy', 'edgeColorBy', 'linkLabels', 'orderBy'].forEach(function (k) { if (typeof raw.roles[k] === 'string') g.roles[k] = clip(raw.roles[k], 80); }); }
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
    importOutline: importOutline, importNotes: importNotes, guessMapping: guessMapping, parseDelimited: parseDelimited, sniffDelimiter: sniffDelimiter,
    sniff: sniff, mergeGraphs: mergeGraphs, CLEAN: CLEAN, sanitizeGraph: sanitizeGraph, valenceOf: valenceOf
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NFMImport;
