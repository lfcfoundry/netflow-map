/*!
 * Netflow Map app, part 3: the Nodes tab (tidy up, edit the item and link tables). Copyright (c) 2026 LFC Foundry. MIT License.
 */
var NT = { table: 'items', page: 0, filter: '', sort: null, size: 100, built: false };
var CLEANS = [['sameLabel', 'Merge items with the same name'], ['selfLinks', 'Remove links to self'], ['dupLinks', 'Remove repeated links'], ['isolated', 'Remove items with no links'], ['placeholders', 'Remove placeholders'], ['twoWay', 'Make every link two-way'], ['reverse', 'Reverse every link']];
function nodesShell() {
  var root = $('nodes-body');
  if (NT.built) return;
  NT.built = true;
  var tidy = h('div', { class: 'card', id: 'tidy' }, [
    h('h2', null, 'Tidy up'),
    h('div', { class: 'row tight', id: 'cleanbtns' }, CLEANS.map(function (c) {
      return h('button', { onclick: function () {
        var r = NFMImport.CLEAN[c[0]](S.graph);
        if (!r.changed) { toast('Nothing to change.'); return; }
        setGraph(r.graph, true, true); toast('Done: ' + r.text + '.');
      } }, c[1]);
    })),
    h('div', { class: 'row' }, [h('label', { class: 'field', style: { display: 'inline-grid' } }, [h('span', null, 'Where it starts'), h('select', { id: 'startsel', onchange: function (e) { var v = e.target.value; edit(function (g) { g.start = v || null; }); } })]),
      h('span', { class: 'spacer' }), h('button', { onclick: function () { showTab('check'); } }, 'Find problems in the data')])
  ]);
  var tbl = h('div', { class: 'card' }, [
    h('div', { class: 'row' }, [
      seg([['items', 'Items'], ['links', 'Links']], NT.table, function (v) { NT.table = v; NT.page = 0; NT.sort = null; renderTable(); }), 
      h('input', { type: 'search', id: 'nt-filter', placeholder: 'Filter rows…', 'aria-label': 'Filter rows', oninput: debounce(function (e) { NT.filter = e.target.value.trim().toLowerCase(); NT.page = 0; renderTable(); }, 150) }),
      h('span', { class: 'spacer' }), h('span', { class: 'muted small', id: 'tinfo' }),
      h('button', { id: 'b-prev', onclick: function () { if (NT.page > 0) { NT.page--; renderTable(); } } }, 'Previous'),
      h('button', { id: 'b-next', onclick: function () { NT.page++; renderTable(); } }, 'Next')
    ]),
    h('div', { class: 'tablewrap', style: { maxHeight: '60vh' } }, h('table', { class: 't', id: 'table' })),
    h('div', { class: 'row', id: 'addlink' })
  ]);
  mount(root, [tidy, tbl, h('p', { class: 'muted small' }, 'Edits are saved as you go and can be undone on the Data tab or with ' + T('Ctrl+Z', 'the Undo button') + '. Calculated columns are shown but cannot be typed over.')]);
  bindNodes();
}
function renderTidy() {
  if (!NT.built) return;
  var g = S.graph, sel = $('startsel'); $('tidy').hidden = !g.nodes.length; if (!g.nodes.length) return;
  var list = g.nodes.slice(0, 2000);
  mount(sel, [opt('', '(pick automatically)', !g.start)].concat(list.map(function (n) { return opt(n.id, n.label, g.start === n.id); })));
  if (g.start && !list.some(function (n) { return n.id === g.start; })) sel.appendChild(opt(g.start, (S.byId.get(g.start) || {}).label || g.start, true));
}
function sortVal(row, key, items) {
  if (key === '#in') return (S.inAdj.get(row.id) || []).length; if (key === '#out') return (S.outAdj.get(row.id) || []).length;
  var v = key === 'id' ? row.id : key === 'from' || key === 'to' ? ((S.byId.get(row[key]) || {}).label || row[key]) : (row[key] !== undefined && key in row ? row[key] : row.attrs && row.attrs[key]);
  return v === undefined || v === null ? '' : v;
}
function renderTable() {
  if (!NT.built) return;
  var g = S.dg || S.graph, items = NT.table === 'items', f = NT.filter, rows = [], src = items ? g.nodes : g.edges, i;
  if (!g.nodes.length) { mount($('table'), h('tbody', null, h('tr', null, h('td', null, 'Nothing here yet. Bring in data on the Data tab.')))); $('tinfo').textContent = ''; return; }
  var extra = S.prof[items ? 'nodes' : 'edges'].filter(function (c) { return !c.builtin; });
  var calcNames = new Set((S.graph.calc || []).filter(function (c) { return c.scope === (items ? 'nodes' : 'edges'); }).map(function (c) { return c.name; }));
  for (i = 0; i < src.length; i++) {
    var r = src[i];
    if (f) { var hay = items ? (r.id + ' ' + r.label + ' ' + r.group + ' ' + Object.keys(r.attrs || {}).map(function (k) { return r.attrs[k]; }).join(' ')) : ((S.byId.get(r.from) || {}).label + ' ' + (S.byId.get(r.to) || {}).label + ' ' + r.label + ' ' + r.kind + ' ' + Object.keys(r.attrs || {}).map(function (k) { return r.attrs[k]; }).join(' ')); if (hay.toLowerCase().indexOf(f) < 0) continue; }
    rows.push(i);
  }
  if (NT.sort) { var k = NT.sort.key, d = NT.sort.dir; rows.sort(function (a, b) { var x = sortVal(src[a], k, items), y = sortVal(src[b], k, items), nx = Number(x), ny = Number(y); if (x !== '' && y !== '' && nx === nx && ny === ny) return (nx - ny) * d; return (String(x) < String(y) ? -1 : String(x) > String(y) ? 1 : 0) * d; }); }
  var pages = Math.max(1, Math.ceil(rows.length / NT.size)); if (NT.page >= pages) NT.page = pages - 1;
  var slice = rows.slice(NT.page * NT.size, NT.page * NT.size + NT.size);
  $('tinfo').textContent = nfmt(rows.length) + (items ? ' items' : ' links') + (pages > 1 ? ' · page ' + (NT.page + 1) + ' of ' + pages : '');
  $('b-prev').disabled = NT.page === 0; $('b-next').disabled = NT.page >= pages - 1;
  var th = function (label, key) { return h('th', { style: { cursor: 'pointer' }, onclick: function () { NT.sort = NT.sort && NT.sort.key === key ? { key: key, dir: -NT.sort.dir } : { key: key, dir: 1 }; renderTable(); }, 'aria-sort': NT.sort && NT.sort.key === key ? (NT.sort.dir > 0 ? 'ascending' : 'descending') : 'none' }, label + (NT.sort && NT.sort.key === key ? (NT.sort.dir > 0 ? ' ▴' : ' ▾') : '')); };
  var cell = function (idx, key, val, attr, ro, label) {
    var inp = h('input', { value: val === undefined || val === null ? '' : val, 'aria-label': label, disabled: ro, 'data-i': idx, 'data-f': key, 'data-a': attr ? '1' : null });
    return h('td', null, inp);
  };
  var head, body;
  if (items) {
    head = [th('Name', 'id'), th('Label', 'label'), th('Group', 'group')].concat(S.story ? [th('Ending', 'valence')] : []).concat(extra.map(function (c) { return th(c.name, c.key); }), [th('In', '#in'), th('Out', '#out'), h('th')]);
    body = slice.map(function (i) {
      var n = src[i], out = (S.outAdj.get(n.id) || []).length, inn = (S.inAdj.get(n.id) || []).length;
      var tds = [h('td', null, [n.id, n.ghost ? h('span', { class: 'pill ghost', style: { marginLeft: '5px' } }, 'placeholder') : null]), cell(i, 'label', n.label, false, false, 'Label of ' + n.id), cell(i, 'group', n.group, false, false, 'Group of ' + n.id)];
      if (S.story) tds.push(h('td', null, select([['', '—'], ['good', 'Good'], ['bad', 'Bad'], ['neutral', 'Other']], n.valence || '', null, { 'data-i': i, 'data-f': 'valence', 'aria-label': 'Ending of ' + n.id })));
      extra.forEach(function (c) { tds.push(cell(i, c.key, n.attrs && n.attrs[c.key], true, calcNames.has(c.key), c.name + ' of ' + n.id)); });
      tds.push(h('td', null, inn), h('td', null, out), h('td', { style: { whiteSpace: 'nowrap' } }, [
        h('button', { class: 'sm', title: 'Show on the map', 'aria-label': 'Show ' + n.id + ' on the map', onclick: function () { S.sel = new Set([n.id]); showTab('map'); } }, '◎'),
        h('button', { class: 'sm danger', 'data-del': i, 'aria-label': 'Remove ' + n.id }, '×')]));
      return h('tr', { 'data-i': i }, tds);
    });
  } else {
    head = [th('From', 'from'), th('To', 'to'), th('Weight', 'weight'), th('Label', 'label'), th('Kind', 'kind')].concat(extra.filter(function (c) { return !c.builtin; }).map(function (c) { return th(c.name, c.key); }), [h('th')]);
    body = slice.map(function (i) {
      var e = src[i], tds = [h('td', null, (S.byId.get(e.from) || {}).label || e.from), h('td', null, (S.byId.get(e.to) || {}).label || e.to), cell(i, 'weight', e.weight, false, false, 'Weight'), cell(i, 'label', e.label, false, false, 'Label of the link'), cell(i, 'kind', e.kind, false, false, 'Kind')];
      extra.forEach(function (c) { tds.push(cell(i, c.key, e.attrs && e.attrs[c.key], true, calcNames.has(c.key), c.name)); });
      tds.push(h('td', null, h('button', { class: 'sm danger', 'data-del': i, 'aria-label': 'Remove this link' }, '×')));
      return h('tr', { 'data-i': i }, tds);
    });
  }
  mount($('table'), [h('thead', null, h('tr', null, head)), h('tbody', null, body)]);
  renderAddLink();
}
function renderAddLink() {
  var box = $('addlink'); if (NT.table !== 'links') { clear(box); return; }
  if (box.dataset.ready === String(S.gver)) return;
  box.dataset.ready = String(S.gver);
  var dl = h('datalist', { id: 'dl-nodes' }, S.graph.nodes.slice(0, 3000).map(function (n) { return h('option', { value: n.id }, n.label); }));
  var a = h('input', { list: 'dl-nodes', placeholder: 'From (name)', 'aria-label': 'New link from' }), b = h('input', { list: 'dl-nodes', placeholder: 'To (name)', 'aria-label': 'New link to' }), w = h('input', { placeholder: 'Weight', type: 'number', step: 'any', 'aria-label': 'New link weight', style: { maxWidth: '110px' } });
  mount(box, [dl, a, b, w, h('button', { onclick: function () {
    var x = a.value.trim(), y = b.value.trim(); if (!x || !y) { toast('Fill in both ends of the link.'); return; }
    var wt = Number(w.value);
    edit(function (g) {
      [x, y].forEach(function (id) { if (!S.byId.has(id) && !g.nodes.some(function (n) { return n.id === id; })) g.nodes.push({ id: id, label: id, group: '', valence: '', ghost: false, attrs: {} }); });
      g.edges.push({ from: x, to: y, label: '', weight: w.value === '' || !isFinite(wt) ? undefined : wt, kind: '', attrs: {} });
    });
    toast('Link added.');
  } }, 'Add link')]);
}
function bindNodes() {
  var tb = $('table');
  tb.addEventListener('change', function (e) {
    var t = e.target, f = t.dataset.f; if (f === undefined) return;
    var i = +t.dataset.i, v = t.value, isAttr = t.dataset.a === '1';
    if (NT.table === 'items') edit(function (g) {
      var n = Object.assign({}, g.nodes[i]);
      if (isAttr) n.attrs = Object.assign({}, n.attrs, { [f]: v }); else { n[f] = f === 'valence' ? v : v.trim(); if (f === 'label' && !n.label) n.label = n.id; }
      g.nodes[i] = n;
    });
    else edit(function (g) {
      var ed = Object.assign({}, g.edges[i]);
      if (isAttr) ed.attrs = Object.assign({}, ed.attrs, { [f]: v });
      else if (f === 'weight') { var w = Number(v); ed.weight = v === '' || !isFinite(w) ? undefined : w; } else ed[f] = v.trim();
      g.edges[i] = ed;
    });
  });
  tb.addEventListener('click', function (e) {
    var b = e.target.closest('[data-del]'); if (!b) return;
    var i = +b.dataset.del;
    if (NT.table === 'items') edit(function (g) { var id = g.nodes[i].id; g.nodes.splice(i, 1); g.edges = g.edges.filter(function (x) { return x.from !== id && x.to !== id; }); if (g.start === id) g.start = null; });
    else edit(function (g) { g.edges.splice(i, 1); });
  });
}
TAB_HOOKS.nodes = function () { nodesShell(); renderTidy(); renderTable(); };
HOOKS.graph.push(function () { if (S.tab === 'nodes' || NT.built) { renderTidy(); renderTable(); } });
