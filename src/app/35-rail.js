/*!
 * Netflow Map app, part 6: the left rail (Ask, Look, Filter, Find, Style, Views), the top bar and the floating key. Copyright (c) 2026 LFC Foundry. MIT License.
 */
var RAIL = { tab: 'ask', open: true, peek: false };
var VIEW_NOTES = {
  flow: ['Reads left to right, so you can follow how things lead on from the start.', 'Hides how items relate across branches; the same item may sit far from a close neighbor.'],
  down: ['The same drawing as Flow, top to bottom.', 'As Flow.'],
  spine: ['Puts the places every route must pass on one line.', 'Side branches are squeezed; it needs a start and an end to mean much.'],
  lanes: ['One band per group, so you can see how routes cross between groups.', 'Needs two or more groups; items in several groups sit in the middle.'],
  shape: ['Names the stretches between choke points by their pattern.', 'Individual items are folded away.'],
  sankey: ['Wider bands mean more of the flow takes that link.', 'Needs a start; small flows look like hairlines.'],
  arc: ['Everything on one line, arcs show links; long arcs are long jumps.', 'Groups and direction are hard to see.'],
  matrix: ['A grid of who links to whom; patterns show clusters and loops without any crossing lines.', 'Paths are hard to follow by eye.'],
  network: ['Closeness on the page follows closeness in the data, so clusters show up.', 'Exact positions mean little; only closeness does. Dense data can look like a hairball, so try the strongest-links slider.']
};
function askList() {
  var st = S.story;
  return [['', 'Pick a question…', null, null],
    ['lead', 'How do things lead on from the start?', 'flow', 'group'], ['pass', 'What must everything pass through?', 'spine', 'choke'],
    ['end', st ? 'Where do players end up, and how likely?' : 'Where does the flow end up, and how likely?', 'sankey', 'odds'],
    ['outline', 'What is the big picture, in outline?', 'shape', 'group'], ['belong', 'Which ' + word('items') + ' belong together?', 'network', 'found'],
    ['lanes', 'Show each group in its own band', 'lanes', 'group'], ['grid', 'Show every link in a grid', 'matrix', 'group'], ['jump', 'Which links jump far?', 'arc', 'group'],
    ['heavy', 'Which links carry the most?', 'network', null, 'width'], ['big', 'Which ' + word('items') + ' matter most?', 'network', null, 'size']];
}
function askApply(key) {
  var t = askList().filter(function (x) { return x[0] === key; })[0]; if (!t || !t[2]) return;
  var p = { view: t[2] };
  if (t[3]) p.colorBy = t[3];
  if (t[4] === 'width' && !S.V.widthBy) { var wc = widthChoices()[1]; if (wc) p.widthBy = wc[0]; }
  if (t[4] === 'size') { p.sizeBy = S.V.sizeBy || 'sys:inW'; if (!NFMColumns.findCol(S.prof.edges, 'weight')) p.sizeBy = S.V.sizeBy || 'sys:degree'; p.colorBy = 'choke'; }
  if (t[2] === 'lanes' && S.V.laneBy === 'group' && !S.graph.nodes.some(function (n) { return n.group; })) p.laneBy = 'found';
  if (t[3] === 'odds' && !S.graph.start) { /* the engine picks a start */ }
  setV(p);
}

/* ---------------------------------------------------------------- building the map UI once */
function buildMapUI() {
  var ui = $('ui');
  var tabs = [['ask', 'Ask'], ['look', 'Look'], ['filter', 'Filter'], ['find', 'Find'], ['style', 'Style'], ['colors', 'Colors'], ['views', 'Views']];
  var rail = h('div', { id: 'rail', class: 'glass', role: 'complementary', 'aria-label': 'Map controls' }, [
    h('div', { class: 'tabsrow', role: 'tablist' }, tabs.map(function (t) { return h('button', { role: 'tab', id: 'rt-' + t[0], 'aria-selected': String(t[0] === RAIL.tab), onclick: function () { railTab(t[0]); } }, t[1]); }).concat([h('button', { class: 'quiet peekbtn', id: 'peekbtn', style: { flex: '0 0 34px' }, title: 'Make this panel small or large', 'aria-label': 'Make this panel small or large', onclick: function () { setPeek(!RAIL.peek); } }, '⌄'), h('button', { class: 'quiet', style: { flex: '0 0 34px' }, title: 'Hide this panel', 'aria-label': 'Hide this panel', onclick: function () { setRail(false); } }, '‹')])),
    h('div', { class: 'body', id: 'railbody' })
  ]);
  var toggle = h('button', { id: 'railtoggle', class: 'glass icon', title: 'Show the controls', 'aria-label': 'Show the controls', onclick: function () { setRail(true); } }, '☰');
  var bar = h('div', { id: 'bar', class: 'glass' }, [h('div', { class: 'sum', id: 'sum', title: 'Why this view, and what it hides', onclick: function () { railTab('ask'); setRail(true); } }), h('div', { class: 'seg', id: 'tools', role: 'group', 'aria-label': 'Mouse tool' }, [
    h('button', { 'data-tool': 'hand', title: T('Move and select (drag the background to pan; Shift-drag = box, Alt-drag = lasso)', 'Move and select (drag the background to pan; use the box or lasso tool to select)'), 'aria-pressed': 'true', onclick: function () { setTool('hand'); } }, '✋'),
    h('button', { 'data-tool': 'box', title: 'Drag a box around items to select them', onclick: function () { setTool('box'); } }, '▭'),
    h('button', { 'data-tool': 'lasso', title: 'Draw around items to select them', onclick: function () { setTool('lasso'); } }, '◌')]),
    h('button', { class: 'sm', title: 'Fit everything on screen', onclick: function () { fitView(); } }, 'Fit'),
    h('button', { class: 'sm', id: 'keybtn', title: 'Show or hide the key', onclick: function () { S.V.key.hide = !S.V.key.hide; saveView(); renderKey(); } }, 'Key')]);
  var zoom = h('div', { id: 'zoom' }, [h('button', { class: 'glass', 'aria-label': 'Zoom in', onclick: function () { zoomAt(S.stageW / 2, S.stageH / 2, 1.5); } }, '+'), h('button', { class: 'glass', 'aria-label': 'Zoom out', onclick: function () { zoomAt(S.stageW / 2, S.stageH / 2, 1 / 1.5); } }, '−')]);
  var key = h('div', { id: 'key', class: 'glass', hidden: true });
  var minimap = buildMinimap();
  var details = h('aside', { id: 'details', class: 'glass', hidden: true, 'aria-label': 'Details' });
  var selbar = h('div', { id: 'selbar', class: 'glass', hidden: true });
  [rail, toggle, bar, zoom, minimap, key, details, selbar].forEach(function (e) { ui.appendChild(e); });
  if (window.matchMedia && matchMedia('(max-width:820px)').matches) RAIL.open = false;
  setRail(RAIL.open);
  bindKeyDrag();
}
function railMode() { var u = $('ui'); if (u) u.dataset.rail = !RAIL.open ? 'closed' : RAIL.peek ? 'peek' : 'open'; }
function setPeek(on) { RAIL.peek = on; railMode(); var r = $('rail'); r.classList.toggle('peek', on); var b = $('peekbtn'); if (b) b.textContent = on ? '⌃' : '⌄'; if (!on) renderRail(true); }
function setRail(on) { RAIL.open = on; railMode(); $('rail').classList.toggle('closed', !on); if (S.scene) { var v = freeBoxChanged(); } renderKey(); }
function freeBoxChanged() { return null; }
function setTool(t) { S.tool = t; Array.prototype.forEach.call(document.querySelectorAll('#tools button'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.tool === t)); }); stage.classList.toggle('pick', t !== 'hand'); }
function railTab(t) {
  RAIL.tab = t; setRail(true); if (RAIL.peek) setPeek(false);
  Array.prototype.forEach.call(document.querySelectorAll('#rail .tabsrow [role=tab]'), function (b) { b.setAttribute('aria-selected', String(b.id === 'rt-' + t)); });
  renderRail(true);
}
function renderMapUI() {
  if (!S.mapBuilt) return;
  renderBar(); renderKey(); renderSelbar(); renderDetails(); renderRail(false); renderTimeline();
}
function renderBar() {
  var el = $('sum'), L = S.L, V = S.V;
  if (!L || !S.graph.nodes.length) { el.textContent = 'No data yet.'; return; }
  var parts = [], vn = (VIEWS.filter(function (x) { return x[0] === V.view; })[0] || [])[1] || V.view;
  parts.push(vn + (V.view === 'network' ? ' (' + (ARR[V.arrange] || '') + ')' : '') + ': ' + plural(L.n, word('item')) + ', ' + plural(L.m, word('link')));
  var cut = strongestCut(); if (cut.min !== null) parts.push('strongest ' + V.strongest + '% of links (' + nfmt(cut.total - cut.shown) + ' weaker hidden)');
  if (V.around) parts.push('only around ' + labelOf(V.around.id) + ', ' + V.around.depth + ' step' + (V.around.depth > 1 ? 's' : ''));
  if (V.only) parts.push('only ' + V.only.length + ' chosen');
  if (V.block.length) parts.push(V.block.length + ' taken out');
  var fk = Object.keys(V.facets).filter(function (k) { return V.facets[k] && V.facets[k].length; }); if (fk.length) parts.push('filtered by ' + fk.map(function (k) { return k.slice(2); }).join(', '));
  if (V.widthBy) parts.push('width = ' + chLabel(V.widthBy, 'edges'));
  if (V.sizeBy) parts.push('size = ' + chLabel(V.sizeBy));
  if (V.colorBy && V.colorBy !== 'none') parts.push('color = ' + (V.colorBy === 'group' ? 'group' : V.colorBy === 'found' ? 'found groups' : V.colorBy === 'odds' ? word('odds').toLowerCase() : V.colorBy === 'sim' ? 'simulated visits' : chLabel(V.colorBy)));
  if (L.view === 'lanes' && !L.laneNames) parts.push('Lanes needs two or more groups; try coloring by found groups');
  el.textContent = parts.join(' · ');
  el.title = T('Click', 'Tap') + ' for why this view and what it hides';
}

/* ---------------------------------------------------------------- the floating key */
var KEYDRAG = null;
function keyPos() {
  var k = S.V.key, W = S.stageW, H = S.stageH, el = $('key'), kw = el.offsetWidth || 180, kh = el.offsetHeight || 80;
  var x = k.x === null ? (RAIL.open && W > 820 ? 332 : 12) : k.x, y = k.y === null ? H - kh - 12 - (hasStates() ? 70 : 0) : k.y;
  return [clamp(x, 4, Math.max(4, W - kw - 4)), clamp(y, 4, Math.max(4, H - 40))];
}
function renderKeyPos() { /* the key stays where it is on the screen while the map moves */ }
function renderKey() {
  var el = $('key'); if (!el) return;
  var sc = S.scene, V = S.V, edit = !!S.keyEdit;
  var btn = $('keybtn'); if (btn) btn.setAttribute('aria-pressed', String(!V.key.hide));
  if (!sc || !sc.legend || !sc.legend.length || V.key.hide) { el.hidden = true; return; }
  el.hidden = false; el.classList.toggle('min', !!V.key.min);
  if (NFMLook.plainColors(V.fmt) && V.fmt.font === 'system') { el.style.background = el.style.color = el.style.borderColor = el.style.fontFamily = ''; }
  else { var kt = sc.theme; el.style.background = NFMScene.css(NFMScene.alpha(kt.box, 0.94)); el.style.color = NFMScene.css(kt.fg); el.style.borderColor = NFMScene.css(NFMScene.alpha(kt.boxLine, 0.8)); el.style.fontFamily = NFMLook.fontStack(V.fmt.font); }
  var ed = V.key.edits;
  var title = sc.legendTitle || 'Key';
  var head = h('div', { class: 'kh', 'data-drag': '1' }, [edit ? h('input', { class: 'ed', type: 'text', value: title, 'aria-label': 'Key title', onchange: function (e) { setKeyEdit('__title', { }, e.target.value); }, onpointerdown: function (e) { e.stopPropagation(); } }) : h('span', null, title),
    h('button', { title: edit ? 'Done editing the key' : 'Rename, recolor or hide entries', 'aria-label': 'Edit the key', onclick: function (e) { e.stopPropagation(); S.keyEdit = !S.keyEdit; renderKey(); }, onpointerdown: function (e) { e.stopPropagation(); } }, edit ? '✓' : '✎'),
    h('button', { title: V.key.min ? 'Expand' : 'Shrink', 'aria-label': 'Shrink or expand the key', onclick: function (e) { e.stopPropagation(); V.key.min = !V.key.min; saveView(); renderKey(); }, onpointerdown: function (e) { e.stopPropagation(); } }, V.key.min ? '▢' : '–'),
    h('button', { title: 'Hide the key', 'aria-label': 'Hide the key', onclick: function (e) { e.stopPropagation(); V.key.hide = true; saveView(); renderKey(); }, onpointerdown: function (e) { e.stopPropagation(); } }, '✕')]);
  var body = h('div', { class: 'kb' });
  sc.legend.forEach(function (l, i) {
    var k = l.key || l.t;
    if (l.k === 'swatch' || l.k === 'mark') {
      var gname = typeof k === 'string' && k.indexOf('g:') === 0 ? k.slice(2) : null;
      var sw = edit && gname !== null ? h('input', { type: 'color', value: NFMScene.toHex(l.c), 'aria-label': 'Color of ' + l.t, style: { width: '22px', height: '20px' }, onchange: function (e) { var gc = Object.assign({}, V.groupColors); gc[gname] = e.target.value; V.groupColors = gc; saveView(); makeScene(false); } }) : h('i', { class: 'sw' + (l.dot || l.k === 'mark' ? ' dot' : ''), style: { background: NFMScene.css(l.c) } });
      var row = h('div', { class: 'it' + (ed[k] && ed[k].hide ? ' off' : '') }, [sw, edit ? h('input', { class: 'ed', type: 'text', value: l.t, 'aria-label': 'Name of this entry', onchange: function (e) { setKeyEdit(k, { t: e.target.value }); } }) : h('span', null, l.t),
        edit ? h('button', { class: 'sm', title: 'Hide this entry', 'aria-label': 'Hide this entry', onclick: function () { setKeyEdit(k, { hide: true }); } }, '✕') : null]);
      if (!edit && gname !== null) { row.title = 'Click to select this group'; row.addEventListener('click', function () { setSel(idsOfGroup(gname)); }); }
      body.appendChild(row);
    } else if (l.k === 'ramp') {
      var stops = []; for (var q = 0; q <= 6; q++) { var c = l.ramp ? NFMScene.rampAt(l.ramp, q / 6) : NFMScene.mix(l.a, l.b, q / 6); stops.push(NFMScene.css(c)); }
      if (l.t) body.appendChild(h('div', { class: 'head2' }, l.t));
      body.appendChild(h('div', { class: 'rampbar', style: { background: 'linear-gradient(90deg,' + stops.join(',') + ')' } }));
      body.appendChild(h('div', { class: 'lohi' }, [h('span', null, l.lo), h('span', null, l.hi)]));
    } else if (l.k === 'size') {
      body.appendChild(h('div', { class: 'head2' }, l.t));
      body.appendChild(h('div', { class: 'row tight', style: { alignItems: 'flex-end' } }, [8, 14, 22].map(function (d) { return h('i', { class: 'sw dot', style: { width: d + 'px', height: d + 'px', background: 'transparent' } }); }).concat([h('span', { class: 'muted small' }, l.lo + ' to ' + l.hi)])));
    } else if (l.k === 'width') {
      body.appendChild(h('div', { class: 'head2' }, l.t));
      body.appendChild(h('div', { class: 'row tight', style: { alignItems: 'center' } }, [1, 3, 7].map(function (d) { return h('i', { style: { display: 'inline-block', width: '26px', height: d + 'px', background: 'var(--fg)', opacity: '.7', borderRadius: '2px' } }); }).concat([h('span', { class: 'muted small' }, l.lo + ' to ' + l.hi)])));
    } else if (l.k === 'text') body.appendChild(h('div', { class: l.head ? 'head2' : 'muted small' }, l.t));
  });
  if (edit) {
    var hidden = Object.keys(ed).filter(function (k) { return ed[k] && ed[k].hide; });
    if (hidden.length) body.appendChild(h('button', { class: 'sm', onclick: function () { Object.keys(ed).forEach(function (k) { if (ed[k]) delete ed[k].hide; }); saveView(); makeScene(false); } }, 'Show ' + hidden.length + ' hidden'));
    body.appendChild(h('button', { class: 'sm', onclick: function () { V.key.edits = {}; V.groupColors = {}; saveView(); makeScene(false); } }, 'Reset the key'));
  }
  mount(el, [head, body]);
  var p = keyPos(); el.style.left = p[0] + 'px'; el.style.top = p[1] + 'px';
}
function setKeyEdit(k, patch, titleText) {
  var ed = S.V.key.edits;
  if (k === '__title') ed.__title = titleText; else ed[k] = Object.assign({}, ed[k] || {}, patch);
  saveView(); makeScene(false);
}
function bindKeyDrag() {
  var el = $('key');
  el.addEventListener('pointerdown', function (e) {
    var hd = e.target.closest('.kh'); if (!hd || e.target.closest('button, input')) return;
    e.preventDefault(); el.setPointerCapture(e.pointerId); var p = keyPos();
    KEYDRAG = { sx: e.clientX, sy: e.clientY, x: p[0], y: p[1], id: e.pointerId }; el.classList.add('dragging');
  });
  el.addEventListener('pointermove', function (e) {
    if (!KEYDRAG || KEYDRAG.id !== e.pointerId) return;
    var W = S.stageW, H = S.stageH, x = clamp(KEYDRAG.x + e.clientX - KEYDRAG.sx, 4, W - el.offsetWidth - 4), y = clamp(KEYDRAG.y + e.clientY - KEYDRAG.sy, 4, H - 36);
    el.style.left = x + 'px'; el.style.top = y + 'px'; S.V.key.x = x; S.V.key.y = y;
  });
  var end = function () { if (!KEYDRAG) return; KEYDRAG = null; el.classList.remove('dragging'); saveView(); };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  el.addEventListener('keydown', function (e) { /* move with arrow keys when the header has focus */ });
}

/* ---------------------------------------------------------------- rail panels */
function section(title, kids) { return h('div', { style: { display: 'grid', gap: '8px' } }, [h('h4', null, title)].concat(kids)); }
function slider(label, v, min, max, step, onin, fmtv) {
  var out = h('span', { class: 'muted small' }, fmtv ? fmtv(v) : String(v));
  var r = h('input', { type: 'range', min: min, max: max, step: step, value: v, 'aria-label': label });
  r.addEventListener('input', function () { var x = +r.value; out.textContent = fmtv ? fmtv(x) : String(x); onin(x); });
  return h('label', { class: 'field' }, [h('span', { style: { display: 'flex', justifyContent: 'space-between' } }, [label, out]), r]);
}
function renderRail(force) {
  var body = $('railbody'); if (!body) return;
  var ae = document.activeElement;
  if (!force && ae && body.contains(ae) && /^(INPUT|TEXTAREA)$/.test(ae.tagName) && ae.type !== 'checkbox') return;
  if (!S.graph.nodes.length) { mount(body, h('p', { class: 'muted' }, 'Bring in data on the Data tab, then the controls appear here.')); return; }
  var scroll = body.scrollTop, fn = { ask: panelAsk, look: panelLook, filter: panelFilter, find: panelFind, style: panelStyle, colors: panelColors, views: panelViews }[RAIL.tab];
  mount(body, fn()); body.scrollTop = force ? 0 : scroll;
}

/* ---- Ask */
function panelAsk() {
  var V = S.V, vn = VIEWS.filter(function (x) { return x[0] === V.view; })[0] || ['', V.view, ''], note = VIEW_NOTES[V.view] || ['', ''];
  var kids = [];
  var q = select(askList().map(function (x) { return [x[0], x[1]]; }), '', function (v) { askApply(v); }, { 'aria-label': 'Ask a question' });
  kids.push(section('What do you want to know?', [q]));
  var cut = strongestCut(), L = S.L, why = [];
  why.push(h('p', { style: { margin: 0 } }, [h('b', null, vn[1] + '. '), note[0]]));
  why.push(h('p', { class: 'muted', style: { margin: 0, fontSize: '13px' } }, [h('b', null, 'What it hides: '), note[1]]));
  var hid = [];
  if (cut.min !== null) hid.push(nfmt(cut.total - cut.shown) + ' weaker links are not drawn.');
  if (V.block.length) hid.push(plural(V.block.length, 'item') + ' taken out.');
  if (V.only) hid.push('Showing only ' + V.only.length + ' chosen items.');
  if (V.around) hid.push('Showing only the area around ' + labelOf(V.around.id) + '.');
  if (L && L.view === 'network' && L.n > 400 && V.strongest === 100) hid.push('With this many items, try the strongest-links slider on the Filter tab.');
  if (hid.length) why.push(h('p', { class: 'small', style: { margin: 0, color: 'var(--gold)' } }, hid.join(' ')));
  kids.push(section('Why this view', why));
  if (L) {
    var rows = [[cap(word('items')), nfmt(L.n)], [cap(word('links')), nfmt(L.m)]];
    if (L.imp && L.startId && L.view !== 'network') { rows.push(['Start', labelOf(L.startId) + (L.autoStart ? ' (picked automatically)' : '')]); if (L.imp.chokeCount) rows.push(['Choke points', L.imp.chokeCount]); if (L.flow && L.flow.outcome && S.story) { var o = L.flow.outcome; rows.push(['End well / badly', Math.round(o.good * 100) + '% / ' + Math.round(o.bad * 100) + '%']); } }
    rows.push(['Worked out in', Math.round(S.ms || 0) + ' ms' + (client && client.mode === 'worker' ? ' (background)' : '')]);
    kids.push(section('This map', [kvTable(rows)]));
  }
  kids.push(section('Same data, five ways', [fiveWays()]));
  return kids;
}
var THUMB = { cache: new Map(), host: null, busy: false };
function fiveViews() {
  var l = ['network'], hasStart = S.graph.start || S.story;
  if (hasStart) l.push('flow'); if (new Set(S.graph.nodes.map(function (n) { return n.group; })).size > 1) l.push('lanes');
  l.push('arc', 'matrix'); if (l.length < 5 && hasStart) l.push('spine'); if (l.length < 5) l.push('shape');
  return l.filter(function (v, i) { return l.indexOf(v) === i; }).slice(0, 5);
}
function fiveWays() {
  var box = h('div', { class: 'five' }), small = S.graph.nodes.length <= 700 && S.graph.edges.length <= 3000;
  fiveViews().forEach(function (v) {
    var name = (VIEWS.filter(function (x) { return x[0] === v; })[0] || [])[1] || v, cv = small ? h('canvas', { width: 168, height: 108 }) : null;
    var b = h('button', { 'aria-pressed': String(S.V.view === v), title: name, onclick: function () { setV({ view: v }); } }, [cv, h('span', null, name)]);
    box.appendChild(b); if (cv) thumbInto(v, cv);
  });
  return box;
}
function thumbInto(view, cv) {
  var o = engineOpts(); o.view = view; o.wantFlow = false; delete o.minEdge && 0;
  var key = [S.gver, view, o.colorBy, o.widthBy, o.sizeBy, o.arrange, themeName(), JSON.stringify(o.block), o.keep ? o.keep.length : 0, JSON.stringify(o.minEdge || null)].join('|');
  var draw = function (src) { var x = cv.getContext('2d'); x.clearRect(0, 0, 168, 108); x.drawImage(src, 0, 0, 168, 108); };
  if (THUMB.cache.has(key)) { draw(THUMB.cache.get(key)); return; }
  setTimeout(function () {
    if (!cv.isConnected) return;
    try {
      var E = getEngine(), L = E.build(S.dg, o), sc = NFMScene.make(L, Object.assign(sceneOpts(), { lab: { items: { show: false }, links: { show: false }, groups: { show: false } }, lens: null }));
      if (!THUMB.host) { THUMB.host = document.createElement('div'); THUMB.host.style.cssText = 'position:fixed;left:-9999px;top:0;width:336px;height:216px'; document.body.appendChild(THUMB.host); }
      var hostEl = THUMB.host; clear(hostEl);
      NFMRender.createCanvas2D(hostEl, {}).then(function (r) {
        r.setScene(sc); r.resize(336, 216, 1); var k = Math.min(336 / sc.w, 216 / sc.h) * 0.94; r.draw({ k: k, tx: (336 - sc.w * k) / 2 - sc.x0 * k, ty: (216 - sc.h * k) / 2 - sc.y0 * k });
        var c = document.createElement('canvas'); c.width = 336; c.height = 216; var x = c.getContext('2d'); x.fillStyle = sc.theme.hex.bg; x.fillRect(0, 0, 336, 216); for (var i = 0; i < hostEl.children.length; i++) x.drawImage(hostEl.children[i], 0, 0);
        THUMB.cache.set(key, c); if (THUMB.cache.size > 40) THUMB.cache.delete(THUMB.cache.keys().next().value); draw(c); try { r.destroy(); } catch (e) { /* ignore */ }
      });
    } catch (err) { /* a view that cannot be drawn just stays blank */ }
  }, 30);
}

/* ---- Look */
function panelLook() {
  var V = S.V, L = S.L, kids = [];
  var vdesc = (VIEWS.filter(function (x) { return x[0] === V.view; })[0] || [])[2] || '';
  var k1 = [select(VIEWS.map(function (v) { return [v[0], v[1]]; }), V.view, function (v) { setV({ view: v }); }, { 'aria-label': 'View' }), h('span', { class: 'muted small' }, vdesc)];
  if (V.view === 'network') {
    var nItems = (L && L.n) || S.graph.nodes.length;
    if ((V.arrange === 'stress' || V.arrange === 'stressBest') && nItems > getEngine().stressTuning.fullMax && client && !client.cardP) client.cardProbe().then(function () { if (S.tab === 'map' && S.V.view === 'network') renderMapUI(); });   // one start-up test of the graphics card, then the advice text can say what it will do
    var adv = adviceFor(V.arrange, nItems);
    if (V.arrange === 'stressBest' && S.cardUsed) adv.text += ' The graphics card made this picture' + (S.cardUsed.ms ? ' in ' + (S.cardUsed.ms >= 1000 ? (S.cardUsed.ms / 1000).toFixed(1) + ' s' : S.cardUsed.ms + ' ms') : '') + '.';
    else if (V.arrange === 'stressBest' && client && client.cardWhy && nItems > getEngine().stressTuning.fullMax) adv.text += ' The graphics card was not used (' + client.cardWhy.replace(/\.$/, '') + '), so the processor did it.';
    k1.push(field('Arrangement', select(Object.keys(ARR).map(function (k) { return [k, ARR[k]]; }), V.arrange, function (v) { setV({ arrange: v }); }), adv.text));
    if (adv.offer) k1.push(h('div', { class: 'row tight' }, [h('button', { class: 'sm', onclick: function () { setV({ arrange: adv.offer }); } }, 'Use ' + ARR[adv.offer].toLowerCase())]));
    k1.push(check('Group shapes (soft blobs around each group)', V.hulls, function (on) { setV({ hulls: on }, 'look'); }));
    k1.push(slider('Curved links', V.curve, 0, 0.6, 0.05, function (x) { V.curve = x; saveView(); scheduleScene(); }, function (x) { return x ? Math.round(x * 100) + '%' : 'straight'; }));
    k1.push(check('Fisheye (magnifies around the mouse)', V.lens.on, function (on) { V.lens.on = on; saveView(); if (on && !S.lens) S.lens = { x: 0, y: 0, r: 0 }; makeScene(false); }));
    if (V.lens.on) k1.push(slider('Fisheye strength', V.lens.d, 0.5, 10, 0.5, function (x) { V.lens.d = x; saveView(); scheduleScene(); }));
    if (L && L.is3d) {
      k1.push(h('div', { class: 'rule' }, [h('b', { class: 'small' }, '3D view: drag to turn, wheel to zoom'), h('div', { class: 'row tight' }, [
        h('button', { class: 'sm', onclick: function () { snapCam('front'); } }, 'Front'), h('button', { class: 'sm', onclick: function () { snapCam('side'); } }, 'Side'), h('button', { class: 'sm', onclick: function () { snapCam('top'); } }, 'Top'), h('button', { class: 'sm', onclick: function () { snapCam('reset'); } }, 'Reset')]),
        check('Spin slowly', V.cam.spin, function (on) { V.cam.spin = on; saveView(); spinLoop(); }), slider('Depth (perspective)', V.cam.persp, 1.2, 6, 0.1, function (x) { V.cam.persp = x; scheduleScene(true); })]));
    }
    if (canDrag()) k1.push(h('div', { class: 'row tight' }, [h('button', { class: 'sm', onclick: function () { clearPins(); } }, 'Let everything float again'), h('span', { class: 'muted small' }, 'Drag an item to move it.')]));
  }
  if (['flow', 'down', 'spine', 'lanes'].indexOf(V.view) >= 0) k1.push(check('Taper links (thick at the start, thin at the end)', V.taper, function (on) { setV({ taper: on }, 'look'); }));
  if (!(L && L.is3d)) k1.push(field('Mini-map', seg([['auto', 'Auto'], ['on', 'Always'], ['off', 'Off']], V.minimap, function (v) { setV({ minimap: v }, 'none'); renderMinimap(); }), 'A small picture of the whole map in the corner with a frame for what is on screen; click or drag it to move around. Auto shows it when you are zoomed in or the map is bigger than the screen.'));
  if (V.view === 'flow') k1.push(field('Direction', seg([['LR', 'Left to right'], ['TB', 'Top to bottom']], V.dir, function (v) { setV({ dir: v }); })));
  if (['flow', 'down', 'spine', 'lanes'].indexOf(V.view) >= 0) k1.push(field('Spacing', seg([['tight', 'Tight'], ['wide', 'Wide']], V.spread, function (v) { setV({ spread: v }); }), 'Tight packs the boxes close together. Wide gives a looser, more tree-like drawing with more room between boxes and rows, easier to read on a wide screen.'));
  if (['flow', 'down', 'spine', 'lanes', 'sankey'].indexOf(V.view) >= 0) { k1.push(check('Fold straight runs into one box', V.fold, function (on) { setV({ fold: on }); })); k1.push(check('Merge parallel arrows', V.merge, function (on) { setV({ merge: on }); })); }
  if (V.view === 'flow' || V.view === 'down') {
    k1.push(field('Rows', seg([['route', 'Shortest route'], ['story', 'Story order']], V.rows, function (v) { setV({ rows: v }); }), 'Story order puts every page below all the pages that lead to it, so gold links are real loops only.'));
    k1.push(field('Chapters', seg([['auto', 'Auto'], ['on', 'Always'], ['off', 'Off']], V.chapters, function (v) { setV({ chapters: v }); }), 'Folds the pages between must-pass pages into one box each, and runs of those into parts, so a big story fits on a screen. Auto starts above 1,500 pages. Click a box to open it; right-click a page inside to fold it back.'));
    if (S.L && S.L.chapters) k1.push(h('div', { class: 'row tight' }, [h('span', { class: 'muted small' }, plural(S.L.chapters.parts, 'part') + ' and ' + plural(S.L.chapters.chapters, 'chapter') + ' folded, hiding ' + nfmt(S.L.chapters.hidden) + ' pages. '), Object.keys(V.openCh).length ? h('button', { class: 'sm', onclick: function () { S.V.openCh = {}; setV({}); } }, 'Fold all back') : null]));
    k1.push(check('Draw very long links as tags', V.tagLen > 0, function (on) { setV({ tagLen: on ? 8 : 0 }); }));
    k1.push(check('Keep must-pass pages in one column', V.spineCol, function (on) { setV({ spineCol: on }); }));
    k1.push(check('Bundle links that share a start or an end', V.bundle, function (on) { setV({ bundle: on }); }));
    k1.push(check('Untangle harder (a little slower)', V.better, function (on) { setV({ better: on }); }));
    if (V.view === 'down' || V.dir === 'TB') {
      k1.push(check('Show step numbers down the side', V.ruler, function (on) { setV({ ruler: on }); }));
      k1.push(check('Cut a very tall map into columns', V.wrap, function (on) { setV({ wrap: on }); }));
    }
    if (V.view === 'down') k1.push(check('One column per group', V.downLanes, function (on) { setV({ downLanes: on }); }));
  }
  if (V.view === 'lanes') k1.push(field('Group lanes by', select([['group', 'The group column'], ['found', 'Found groups']].concat(colsOf('nodes', ['category']).filter(function (c) { return c.key !== 'group'; }).map(function (c) { return ['col:' + c.key, c.name]; }).map(function (x) { return [x[0].slice(4), x[1]]; })), V.laneBy, function (v) { setV({ laneBy: v }); })));
  kids.push(section('View', k1));
  if (V.view === 'sankey') kids.push(skPanel());
  kids.push(section('Colors, sizes and widths', [
    field(cap(word('item')) + ' color', select(colorChoices(), V.colorBy, function (v) { setV({ colorBy: v }); })),
    field(cap(word('item')) + ' size', select(sizeChoices(), V.sizeBy, function (v) { setV({ sizeBy: v }); })),
    field('Link width', select(widthChoices(), V.widthBy, function (v) { setV({ widthBy: v }); })),
    field('Link color', select(edgeColorChoices(), V.edgeColorBy, function (v) { setV({ edgeColorBy: v }); })),
    field('Width scale', seg([['sqrt', 'Gentle'], ['linear', 'Exact'], ['log', 'Squeeze big']], V.widthScale, function (v) { setV({ widthScale: v }, 'look'); renderRail(true); })),
    slider('Make all lines', V.widthMul, 0.3, 3, 0.1, function (x) { V.widthMul = x; saveView(); scheduleScene(); }, function (x) { return Math.round(x * 100) + '%'; }),
    field('Color set', select(Object.keys(NFMScene.PALETTES).map(function (k) { return [k, k.charAt(0).toUpperCase() + k.slice(1)]; }), V.palette, function (v) { setV({ palette: v }, 'look'); })),
    field('Color scale for numbers', select(NFMScene.RAMP_NAMES ? Object.keys(NFMScene.RAMP_NAMES).map(function (k) { return [k, NFMScene.RAMP_NAMES[k]]; }) : [['warm', 'Warm']], V.ramp, function (v) { setV({ ramp: v }, 'look'); }))
  ]));
  var lab = V.lab;
  kids.push(section('Labels', [
    check('Show ' + word('item') + ' labels', lab.items.show, function (on) { setV({ lab: { items: { show: on } } }, 'look'); }),
    slider('Label size', lab.items.scale, 0.5, 2.5, 0.1, function (x) { lab.items.scale = x; saveView(); scheduleScene(false, true); }, function (x) { return Math.round(x * 100) + '%'; }),
    field('Label color', select([['auto', 'Normal'], ['group', 'Match the group'], ['fill', 'Match the ' + word('item') + ' color'], ['value', 'Match the number scale'], ['fixed', 'One color']], lab.items.color, function (v) { setV({ lab: { items: { color: v } } }, 'look'); renderRail(true); })),
    lab.items.color === 'fixed' ? h('input', { type: 'color', value: lab.items.fixed, 'aria-label': 'Label color', onchange: function (e) { setV({ lab: { items: { fixed: e.target.value } } }, 'look'); } }) : null,
    slider('Always label the top few', lab.items.topN, 0, 100, 1, function (x) { lab.items.topN = x; saveView(); scheduleScene(false, true); }, function (x) { return x ? 'top ' + x : 'off'; }),
    field('Label text adds', select([['', 'Nothing']].concat(colsOf('nodes', ['category', 'number', 'text']).map(function (c) { return [c.key, c.name]; })), V.labelCol || '', function (v) { setV({ labelCol: v }, 'look'); })),
    check('Show link labels', lab.links.show, function (on) { setV({ lab: { links: { show: on } } }, 'look'); }),
    check('Show the number on each link', V.valueLabels, function (on) { setV({ valueLabels: on }, 'look'); }),
    check('Show group names', lab.groups.show, function (on) { setV({ lab: { groups: { show: on } } }, 'look'); })
  ]));
  return kids;
}

/* ---- Filter */
function facetCols() { return S.prof.nodes.filter(function (c) { return c.kind === 'category' && c.cats && c.cats.length > 1 && !(c.key === 'valence' && !S.story); }).slice(0, 6); }
function facetCount(col, val) {
  var V = S.V, n = 0, others = Object.keys(V.facets).filter(function (k) { return k !== 'n:' + col && k.indexOf('n:') === 0 && V.facets[k] && V.facets[k].length; });
  S.dg.nodes.forEach(function (nd) { if (nodeCat(nd, col) === val && others.every(function (k) { return V.facets[k].indexOf(nodeCat(nd, k.slice(2))) >= 0; })) n++; });
  return n;
}
function panelFilter() {
  var V = S.V, kids = [], cut = strongestCut();
  var hasW = !!cut.ch;
  kids.push(section('Strongest links', [hasW ? slider('Show only the strongest', V.strongest, 1, 100, 1, function (x) { V.strongest = x; strongestLive(); }, function (x) { return x + '%'; }) : h('p', { class: 'muted small', style: { margin: 0 } }, 'Needs a weight or a number column on the links. Pick Link width on the Data tab.'),
    hasW ? h('div', { class: 'small', id: 'strongcount' }, strongText(cut)) : null]));
  var fcs = facetCols();
  if (fcs.length) kids.push(section('Narrow down by', fcs.map(function (c) {
    var key = 'n:' + c.key, cur = V.facets[key] || [], vals = c.cats.slice(0, 14);
    return h('details', { class: 'acc', open: cur.length > 0 }, [h('summary', null, [c.name, cur.length ? h('span', { class: 'pill' }, cur.length + ' chosen') : null]), h('div', { class: 'facet' }, vals.map(function (v) {
      var on = cur.indexOf(v[0]) >= 0, cnt = facetCount(c.key, v[0]);
      return h('label', null, [h('input', { type: 'checkbox', checked: on, onchange: function (e) { var s = (V.facets[key] || []).slice(), i = s.indexOf(v[0]); if (e.target.checked && i < 0) s.push(v[0]); else if (!e.target.checked && i >= 0) s.splice(i, 1); V.facets = Object.assign({}, V.facets); if (s.length) V.facets[key] = s; else delete V.facets[key]; saveView(); refreshMap('options'); renderRail(true); } }), v[0], h('span', { class: 'n' }, nfmt(cnt))]);
    }).concat(cur.length ? [h('button', { class: 'sm', onclick: function () { delete V.facets[key]; V.facets = Object.assign({}, V.facets); saveView(); refreshMap('options'); renderRail(true); } }, 'Clear')] : []))]);
  })));
  var ecs = S.prof.edges.filter(function (c) { return c.kind === 'category' && c.cats && c.cats.length > 1 && c.key !== 'label'; }).slice(0, 2);
  if (ecs.length) kids.push(section('Narrow the links by', ecs.map(function (c) {
    var key = 'e:' + c.key, cur = V.facets[key] || [];
    return h('details', { class: 'acc', open: cur.length > 0 }, [h('summary', null, c.name), h('div', { class: 'facet' }, c.cats.slice(0, 14).map(function (v) {
      return h('label', null, [h('input', { type: 'checkbox', checked: cur.indexOf(v[0]) >= 0, onchange: function (e) { var s = (V.facets[key] || []).slice(), i = s.indexOf(v[0]); if (e.target.checked && i < 0) s.push(v[0]); else if (!e.target.checked && i >= 0) s.splice(i, 1); V.facets = Object.assign({}, V.facets); if (s.length) V.facets[key] = s; else delete V.facets[key]; saveView(); refreshMap('options'); } }), v[0], h('span', { class: 'n' }, nfmt(v[1]))]);
    }))]);
  })));
  var ar = V.around, sel1 = S.sel.size === 1 ? Array.from(S.sel)[0] : null;
  kids.push(section('Around one ' + word('item'), [ar ? h('div', { class: 'rule' }, [h('div', null, 'Showing the area around ' + labelOf(ar.id)), slider('Steps away', ar.depth, 1, 6, 1, function (x) { ar.depth = x; saveView(); refreshMapSoon(); }), h('button', { class: 'sm', onclick: function () { V.around = null; saveView(); refreshMap('options'); renderRail(true); } }, 'Show everything')])
    : h('div', { class: 'row tight' }, [h('button', { class: 'sm', disabled: !sel1, onclick: function () { setAround(sel1, 2); renderRail(true); } }, sel1 ? 'Around ' + labelOf(sel1) : 'Select one ' + word('item') + ' first'), h('span', { class: 'muted small' }, 'or right-click one.')])]));
  if (V.only) kids.push(section('Chosen ' + word('items'), [h('div', { class: 'small' }, 'Showing only ' + V.only.length + ' chosen.'), h('button', { class: 'sm', onclick: function () { V.only = null; saveView(); refreshMap('options'); renderRail(true); } }, 'Show everything')]));
  kids.push(section('Taken out (what if)', [V.block.length ? h('div', { class: 'chips' }, V.block.map(function (id) { return h('button', { class: 'chip x', onclick: function () { setV({ block: V.block.filter(function (x) { return x !== id; }) }); renderRail(true); } }, labelOf(id)); })) : h('span', { class: 'muted small' }, 'Right-click an item and choose "Take it out" to see the map without it.'),
    V.block.length ? h('button', { class: 'sm', onclick: function () { setV({ block: [] }); renderRail(true); } }, 'Put everything back') : null]));
  if (S.kinds.length) kids.push(section('Kinds of link', S.kinds.map(function (k) { return check(k, V.hideKinds.indexOf(k) < 0, function (on) { var hk = V.hideKinds.slice(), i = hk.indexOf(k); if (on && i >= 0) hk.splice(i, 1); else if (!on && i < 0) hk.push(k); setV({ hideKinds: hk }); }); })));
  kids.push(h('button', { onclick: function () { V.strongest = 100; V.facets = {}; V.around = null; V.only = null; V.block = []; V.hideKinds = []; saveView(); refreshMap('options'); renderRail(true); } }, 'Reset all filters'));
  return kids;
}
function strongText(cut) { return cut.min === null ? 'Showing all ' + nfmt(cut.total) + ' links.' : 'Showing ' + nfmt(cut.shown) + ' of ' + nfmt(cut.total) + ' links (those with ' + chLabel(cut.ch, 'edges') + ' of ' + NFMColumns.fmt(cut.min) + ' or more).'; }
var refreshMapSoon = debounce(function () { refreshMap('options'); }, 140);   /* (the simulation's own, slower refresh is refreshMapThrottled in 61-sim.js: the two shared one name and the throttle never ran) */
function strongestLive() { saveView(); var c = strongestCut(), el = $('strongcount'); if (el) el.textContent = strongText(c); refreshMapSoon(); }

/* ---- Find */
var edgeIdxCache = null;
function edgeIdxMap() { if (!edgeIdxCache || edgeIdxCache.v !== S.gver) { var m = new Map(); S.graph.edges.forEach(function (e, i) { m.set(e, i); }); edgeIdxCache = { v: S.gver, m: m }; } return edgeIdxCache.m; }
function reach(start, forward) {
  var seen = new Set([start]), q = [start], eix = edgeIdxMap(), edges = new Set();
  while (q.length) { var id = q.pop(); (forward ? S.outAdj : S.inAdj).get(id) && (forward ? S.outAdj : S.inAdj).get(id).forEach(function (e) { var o = forward ? e.to : e.from; edges.add(eix.get(e)); if (!seen.has(o)) { seen.add(o); q.push(o); } }); }
  return { nodes: seen, edges: edges };
}
function routeCompute(a, b, mode) {
  var eix = edgeIdxMap();
  if (mode === 'short' && b) {
    var prev = new Map([[a, null]]), q = [a], i = 0;
    while (i < q.length && !prev.has(b)) { var id = q[i++]; (S.outAdj.get(id) || []).forEach(function (e) { if (!prev.has(e.to)) { prev.set(e.to, [id, e]); q.push(e.to); } }); }
    if (!prev.has(b)) return null;
    var nodes = new Set([b]), edges = new Set(), cur = b; while (prev.get(cur)) { var p = prev.get(cur); nodes.add(p[0]); edges.add(eix.get(p[1])); cur = p[0]; }
    return { nodes: nodes, edges: edges, ends: [a, b], steps: edges.size };
  }
  var f = reach(a, true);
  if (!b) return { nodes: f.nodes, edges: f.edges, ends: [a] };
  var bk = reach(b, false), nodes2 = new Set(), edges2 = new Set();
  f.nodes.forEach(function (id) { if (bk.nodes.has(id)) nodes2.add(id); });
  if (!nodes2.has(b)) return null;
  S.graph.edges.forEach(function (e, i) { if (nodes2.has(e.from) && nodes2.has(e.to) && f.nodes.has(e.from) && bk.nodes.has(e.to)) edges2.add(i); });
  return { nodes: nodes2, edges: edges2, ends: [a, b] };
}
function routeThrough(e) {
  var up = reach(e.from, false), down = reach(e.to, true), nodes = new Set(), edges = new Set();
  up.nodes.forEach(function (x) { nodes.add(x); }); down.nodes.forEach(function (x) { nodes.add(x); }); up.edges.forEach(function (x) { edges.add(x); }); down.edges.forEach(function (x) { edges.add(x); }); (e.orig || []).forEach(function (o) { edges.add(o); });
  S.route = { nodes: nodes, edges: edges, ends: [e.from, e.to] }; applyStyle(); renderMapUI(); toast('Lit up everything upstream and downstream of that link. Esc clears it.');
}
var ROUTE_UI = { a: '', b: '', mode: 'all' };
function setRouteFrom(id) { ROUTE_UI.a = id; renderRail(true); }
function panelFind() {
  var kids = [];
  var inp = h('input', { type: 'search', id: 'search', placeholder: 'Search names, groups, columns…', 'aria-label': 'Search', value: S.search.q, autocomplete: 'off' });
  var list = h('div', { class: 'hits', id: 'hits' }), info = h('div', { class: 'small muted', id: 'hitinfo' });
  var paint = function () {
    var ids = S.search.list; info.textContent = S.search.q ? (ids.length ? plural(ids.length, 'match', 'matches') + '. Press Enter to jump to the next one.' : 'Nothing matches that.') : '';
    mount(list, ids.slice(0, 50).map(function (id, i) { var n = S.byId.get(id); return h('button', { class: i === S.search.cur ? 'cur' : '', onclick: function () { S.search.cur = i; setSel([id], { center: true }); paint(); } }, [n.label, n.group ? h('span', { class: 'muted small' }, '  ' + n.group) : null]); }));
  };
  inp.addEventListener('input', debounce(function () { runSearch(inp.value); paint(); if (S.search.list.length) { var v = fitTarget(S.search.list.slice(0, 200)); if (v && S.search.list.length < 60) viewTo(v, 420); } }, 120));
  inp.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && S.search.list.length) { e.preventDefault(); S.search.cur = (S.search.cur + (e.shiftKey ? -1 : 1) + S.search.list.length) % S.search.list.length; var id = S.search.list[S.search.cur]; setSel([id], { center: true }); paint(); }
    else if (e.key === 'Escape') { inp.value = ''; runSearch(''); paint(); stage.focus(); }
  });
  kids.push(section('Search', [inp, info, list])); paint();
  var dl = h('datalist', { id: 'dl-find' }, S.graph.nodes.slice(0, 3000).map(function (n) { return h('option', { value: n.label }, n.id); }));
  var byLabel = function (t) { t = (t || '').trim(); if (!t) return ''; if (S.byId.has(t)) return t; var m = S.graph.nodes.filter(function (n) { return n.label === t; })[0] || S.graph.nodes.filter(function (n) { return n.label.toLowerCase() === t.toLowerCase(); })[0]; return m ? m.id : ''; };
  var a = h('input', { list: 'dl-find', placeholder: 'From…', 'aria-label': 'Route from', value: ROUTE_UI.a ? labelOf(ROUTE_UI.a) : '' }), b = h('input', { list: 'dl-find', placeholder: 'To (empty = any end)', 'aria-label': 'Route to', value: ROUTE_UI.b ? labelOf(ROUTE_UI.b) : '' });
  var res = h('div', { class: 'small', id: 'routeinfo' });
  var go = function () {
    var A = byLabel(a.value), B = byLabel(b.value); ROUTE_UI.a = A; ROUTE_UI.b = B;
    if (!A) { res.textContent = 'Pick where to start from.'; return; }
    var r = routeCompute(A, B, ROUTE_UI.mode);
    if (!r) { res.textContent = 'There is no way from ' + labelOf(A) + ' to ' + labelOf(B) + '.'; return; }
    S.route = r; applyStyle(); renderMapUI(); setTimeout(function () { var v = fitTarget(Array.from(r.nodes).slice(0, 400)); if (v) viewTo(v, 480); }, 0);
    res.textContent = (ROUTE_UI.mode === 'short' && r.steps ? 'Shortest route: ' + r.steps + ' step' + (r.steps === 1 ? '' : 's') + '. ' : '') + plural(r.nodes.size, word('item')) + ' and ' + plural(r.edges.size, word('link')) + ' lit up.';
  };
  kids.push(section('Light up routes', [h('p', { class: 'muted small', style: { margin: 0 } }, 'Everything not on the route fades. You can also ' + T('right-click', 'press and hold') + ' an item or link.'), dl, a, b, seg([['all', 'Every route'], ['short', 'Shortest only']], ROUTE_UI.mode, function (m) { ROUTE_UI.mode = m; renderRail(true); }),
    h('div', { class: 'row tight' }, [h('button', { class: 'primary', onclick: go }, 'Light up'), h('button', { onclick: function () { S.route = null; ROUTE_UI.a = ROUTE_UI.b = ''; applyStyle(); renderMapUI(); renderRail(true); } }, 'Clear')]), res]));
  return kids;
}

/* ---- Style */
var STYLE_WHEN = [['all', 'All'], ['group', 'A group'], ['column', 'A column value'], ['set', 'A saved set'], ['formula', 'A formula'], ['ends', 'End points (no way on)']];
var STYLE_WHEN_LINK = [['all', 'All links'], ['kind', 'A kind of link'], ['column', 'A column value'], ['formula', 'A formula'], ['between', 'Links between groups']];
var SHAPES = [['', 'Default'], ['dot', 'Circle'], ['square', 'Square'], ['rounded', 'Rounded box'], ['diamond', 'Diamond'], ['hexagon', 'Hexagon'], ['triangle', 'Triangle']];
function openStyleFor(when, ids, target, ei) {
  var V = S.V, rule = { id: Date.now(), target: target === 'links' ? 'links' : 'nodes', on: true, when: when, set: {} };
  if (when.type === 'set' && !when.name) { var nm = 'Selection ' + (Object.keys(V.sets).length + 1); V.sets = Object.assign({}, V.sets); V.sets[nm] = (ids || Array.from(S.sel)).slice(); rule.when = { type: 'set', name: nm }; }
  rule.set = rule.target === 'links' ? { color: '#e15759', wmul: 2 } : { fill: '#f28e2b' };
  V.rules = V.rules.concat([rule]); saveView(); railTab('style'); makeScene(false);
}
function ruleCard(r, i) {
  var V = S.V, links = r.target === 'links', w = r.when, st = r.set;
  var upd = function (patch, rebuild) { Object.assign(r.set, patch); Object.keys(patch).forEach(function (k) { if (patch[k] === '' || patch[k] === undefined || patch[k] === null) delete r.set[k]; }); S.styleMap = null; saveView(); makeScene(false); if (rebuild) renderRail(true); };
  var updW = function (patch) { r.when = Object.assign({}, r.when, patch); S.styleMap = null; saveView(); makeScene(false); renderRail(true); };
  var head = h('div', { class: 'rh' }, [check('', r.on !== false, function (on) { r.on = on; S.styleMap = null; saveView(); makeScene(false); }, { 'aria-label': 'Rule on' }), h('b', null, (links ? 'Links' : cap(word('items'))) + ': ' + ruleName(r)),
    h('button', { class: 'sm', title: 'Move up', disabled: i === 0, onclick: function () { moveRule(i, -1); } }, '↑'), h('button', { class: 'sm', title: 'Move down', disabled: i === V.rules.length - 1, onclick: function () { moveRule(i, 1); } }, '↓'), h('button', { class: 'sm danger', 'aria-label': 'Remove rule', onclick: function () { V.rules.splice(i, 1); S.styleMap = null; saveView(); makeScene(false); renderRail(true); } }, '×')]);
  var when = [select(links ? STYLE_WHEN_LINK : STYLE_WHEN, w.type, function (v) { updW({ type: v }); }, { 'aria-label': 'Applies to' })];
  if (w.type === 'group') when.push(select(groupNames().map(function (g) { return [g, g]; }), w.value || '', function (v) { updW({ value: v }); }));
  if (w.type === 'kind') when.push(select(S.kinds.concat(['(none)']).map(function (g) { return [g, g]; }), w.value || '', function (v) { updW({ value: v }); }));
  if (w.type === 'column') {
    var cols = (links ? S.prof.edges : S.prof.nodes).map(function (c) { return [c.key, c.name]; });
    when.push(h('div', { class: 'grid3' }, [select(cols, w.col || cols[0] && cols[0][0], function (v) { updW({ col: v }); }), select([['=', 'is'], ['!=', 'is not'], ['>', '>'], ['>=', '≥'], ['<', '<'], ['<=', '≤'], ['contains', 'contains']], w.op || '=', function (v) { updW({ op: v }); }), h('input', { type: 'text', value: w.value === undefined ? '' : w.value, 'aria-label': 'Value', onchange: function (e) { updW({ value: e.target.value }); } })]));
    if (!w.col && cols[0]) w.col = cols[0][0];
  }
  if (w.type === 'set') when.push(select(Object.keys(V.sets || {}).map(function (g) { return [g, g + ' (' + V.sets[g].length + ')']; }).concat(Object.keys(V.sets || {}).length ? [] : [['', 'No sets yet. Select items, then right-click: Save as a set']]), w.name || '', function (v) { updW({ name: v }); }));
  if (w.type === 'formula') { var fi = h('input', { type: 'text', value: w.formula || '', placeholder: links ? 'e.g. weight > 100' : 'e.g. degree > 5 and outW > 20', 'aria-label': 'Formula', spellcheck: 'false', onchange: function (e) { updW({ formula: e.target.value }); } }); when.push(fi, h('span', { class: 'muted small' }, 'True when the result is not zero. Works like calculated columns.')); }
  var look = [];
  var colorRow = function (label, key) { return h('label', { class: 'field' }, [h('span', null, label), h('div', { class: 'row tight' }, [h('input', { type: 'color', value: st[key] || '#888888', onchange: function (e) { upd(JSON.parse('{"' + key + '":"' + e.target.value + '"}'), true); } }), st[key] ? h('button', { class: 'sm quiet', onclick: function () { var p = {}; p[key] = ''; upd(p, true); } }, 'default') : h('span', { class: 'muted small' }, 'default')])]); };
  if (!links) {
    look.push(h('div', { class: 'grid2' }, [colorRow('Fill', 'fill'), colorRow('Outline', 'stroke')]));
    look.push(h('div', { class: 'grid2' }, [field('Shape', select(SHAPES, st.shape || '', function (v) { upd({ shape: v }); }), S.L && S.L.view !== 'network' && S.L.view !== 'arc' ? 'Shapes show in Network and Arc views.' : null),
      field('Icon', select([['', 'None']].concat(Object.keys(NFMScene.ICONS).map(function (k) { return [k, k]; })), st.image ? '' : (st.icon || ''), function (v) { upd({ icon: v, image: '' }, true); }))]));
    look.push(h('div', { class: 'row tight' }, [h('label', { class: 'sm', style: { cursor: 'pointer' } }, [h('span', { class: 'pill' }, st.image ? 'Change picture…' : 'Use a picture…'), h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: function (e) { pictureFor(e.target.files[0], function (url) { upd({ image: url, icon: '' }, true); }); } })]), st.image ? h('button', { class: 'sm', onclick: function () { upd({ image: '' }, true); } }, 'Remove picture') : null,
      st.icon || st.image ? select([['replace', 'Replaces the shape'], ['inside', 'Sits inside the shape']], st.iconMode || 'replace', function (v) { upd({ iconMode: v }); }) : null]));
    look.push(slider('Size', st.scale || 1, 0.4, 3, 0.1, function (x) { upd({ scale: x }); }, function (x) { return Math.round(x * 100) + '%'; }));
    look.push(slider('See-through', st.opacity === undefined ? 1 : st.opacity, 0.05, 1, 0.05, function (x) { upd({ opacity: x }); }, function (x) { return Math.round((1 - x) * 100) + '%'; }));
    look.push(h('div', { class: 'grid2' }, [select([['', 'Label: normal'], ['show', 'Label: always show'], ['hide', 'Label: hide']], st.labelShow === true ? 'show' : st.labelShow === false ? 'hide' : '', function (v) { upd({ labelShow: v === 'show' ? true : v === 'hide' ? false : '' }); }), check('Bold label', st.labelBold, function (on) { upd({ labelBold: on || '' }); })]));
    look.push(h('div', { class: 'grid2' }, [colorRow('Label color', 'labelColor'), slider('Label size', st.labelSize || 1, 0.5, 3, 0.1, function (x) { upd({ labelSize: x }); }, function (x) { return Math.round(x * 100) + '%'; })]));
    look.push(h('input', { type: 'text', value: st.labelText || '', placeholder: 'Use this text for the label', 'aria-label': 'Label text', onchange: function (e) { upd({ labelText: e.target.value.slice(0, 80) }); } }));
  } else {
    look.push(colorRow('Color', 'color'));
    look.push(slider('Width', st.wmul || 1, 0.3, 5, 0.1, function (x) { upd({ wmul: x }); }, function (x) { return Math.round(x * 100) + '%'; }));
    look.push(h('div', { class: 'grid2' }, [field('Line', select([['', 'Solid'], ['dot', 'Dotted'], ['dash', 'Dashed'], ['long', 'Long dashes']], st.dash || '', function (v) { upd({ dash: v }); })), field('Arrowhead', select([['', 'Normal'], ['on', 'Always'], ['off', 'None']], st.arrow === true ? 'on' : st.arrow === false ? 'off' : '', function (v) { upd({ arrow: v === 'on' ? true : v === 'off' ? false : '' }); }))]));
    look.push(slider('See-through', st.opacity === undefined ? 1 : st.opacity, 0.05, 1, 0.05, function (x) { upd({ opacity: x }); }, function (x) { return Math.round((1 - x) * 100) + '%'; }));
    look.push(h('input', { type: 'text', value: st.label === undefined ? '' : st.label, placeholder: 'Use this text as the link label', 'aria-label': 'Link label', onchange: function (e) { upd({ label: e.target.value.slice(0, 60) }); } }));
  }
  look.push(check('Hide these', st.hide, function (on) { upd({ hide: on || '' }); }));
  return h('div', { class: 'rule' }, [head, h('div', { style: { display: 'grid', gap: '6px' } }, when), h('hr'), h('div', { style: { display: 'grid', gap: '8px' } }, look)]);
}
function groupNames() { return Array.from(new Set(S.dg.nodes.map(function (n) { return n.group || '(none)'; }))).sort(); }
function ruleName(r) { var w = r.when || {}; return w.type === 'all' ? 'everything' : w.type === 'group' ? 'group ' + (w.value || '?') : w.type === 'kind' ? 'kind ' + (w.value || '?') : w.type === 'column' ? (w.col || '?') + ' ' + (w.op || '=') + ' ' + (w.value === undefined ? '?' : w.value) : w.type === 'set' ? 'set ' + (w.name || '?') : w.type === 'formula' ? 'formula' : w.type === 'ends' ? 'end points' : w.type === 'between' ? 'between groups' : '?'; }
function moveRule(i, d) { var r = S.V.rules, j = i + d; if (j < 0 || j >= r.length) return; var t = r[i]; r[i] = r[j]; r[j] = t; S.styleMap = null; saveView(); makeScene(false); renderRail(true); }
/** Shrinks a chosen picture so it fits in saved settings. */
function pictureFor(file, cb) {
  if (!file) return;
  var fr = new FileReader();
  fr.onload = function () {
    var im = new Image();
    im.onload = function () { var s = 96 / Math.max(im.width, im.height, 1), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.width * Math.min(1, s))); c.height = Math.max(1, Math.round(im.height * Math.min(1, s))); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); cb(c.toDataURL('image/png')); };
    im.onerror = function () { toast('That picture could not be read.'); };
    im.src = String(fr.result);
  };
  fr.readAsDataURL(file);
}
function panelStyle() {
  var V = S.V, kids = [];
  kids.push(h('p', { class: 'muted small', style: { margin: 0 } }, 'Rules change how ' + word('items') + ' and links look. Later rules win. They can apply to everything, a group, a column value, a saved set, or a formula.'));
  kids.push(h('div', { class: 'row tight' }, [
    h('button', { class: 'sm', onclick: function () { V.rules = V.rules.concat([{ id: Date.now(), target: 'nodes', on: true, when: { type: 'all' }, set: { fill: '#4e79a7' } }]); saveView(); makeScene(false); renderRail(true); } }, '+ ' + cap(word('items'))),
    h('button', { class: 'sm', onclick: function () { V.rules = V.rules.concat([{ id: Date.now(), target: 'links', on: true, when: { type: 'all' }, set: { color: '#e15759' } }]); saveView(); makeScene(false); renderRail(true); } }, '+ Links')]));
  V.rules.forEach(function (r, i) { kids.push(ruleCard(r, i)); });
  if (!V.rules.length) kids.push(h('p', { class: 'muted small' }, 'No rules yet. Or select items on the map and use Style… in the bar.'));
  var sets = Object.keys(V.sets || {});
  if (sets.length) kids.push(section('Saved sets', sets.map(function (n) { return h('div', { class: 'row tight' }, [h('button', { class: 'chip', onclick: function () { setSel(V.sets[n]); } }, n + ' (' + V.sets[n].length + ')'), h('button', { class: 'sm danger', 'aria-label': 'Delete set ' + n, onclick: function () { var s = Object.assign({}, V.sets); delete s[n]; V.sets = s; saveView(); renderRail(true); } }, '×')]); })));
  /* words */
  var wk = [['walker', 'One simulated traveler'], ['walkers', 'Many travelers'], ['item', 'One item'], ['items', 'Items'], ['link', 'One link'], ['links', 'Links'], ['end', 'One end point'], ['ends', 'End points'], ['odds', 'Heading for "where it ends"'], ['flow', 'Heading for flow']];
  kids.push(acc('Words used', [h('p', { class: 'muted small', style: { margin: 0 } }, 'Change the words in the panels and key. Leave empty for the default.')].concat(wk.map(function (x) { return field(x[1], h('input', { type: 'text', value: (V.vocab || {})[x[0]] || '', placeholder: (S.story ? VOCAB.story : VOCAB.data)[x[0]], onchange: function (e) { V.vocab = Object.assign({}, V.vocab); if (e.target.value.trim()) V.vocab[x[0]] = e.target.value.trim().slice(0, 40); else delete V.vocab[x[0]]; saveView(); renderMapUI(); renderRail(true); } })); }).concat([h('button', { class: 'sm', onclick: function () { V.vocab = {}; saveView(); renderMapUI(); renderRail(true); } }, 'Back to the default words')]))));
  var gs = groupNames();
  kids.push(acc('Group colors', gs.length > 40 ? [h('p', { class: 'muted small' }, 'Too many groups to list. Use rules, or edit them in the key.')] : gs.map(function (g, i) { var base = NFMScene.palette(lookNames().theme, V.palette).hex.groups; var cur = V.groupColors[g] || base[i % base.length]; return h('div', { class: 'row tight' }, [h('input', { type: 'color', value: NFMScene.toHex(NFMScene.hex(cur)), 'aria-label': 'Color of ' + g, onchange: function (e) { V.groupColors = Object.assign({}, V.groupColors); V.groupColors[g] = e.target.value; saveView(); makeScene(false); } }), h('span', null, g), V.groupColors[g] ? h('button', { class: 'sm quiet', onclick: function () { delete V.groupColors[g]; V.groupColors = Object.assign({}, V.groupColors); saveView(); makeScene(false); renderRail(true); } }, 'default') : null]); }).concat([h('p', { class: 'muted small' }, 'Colors follow the group order of the current color set.')])));
  kids.push(h('div', { class: 'row tight' }, [h('button', { class: 'sm', onclick: function () { S.keyEdit = true; V.key.hide = false; renderKey(); } }, 'Edit the key'), h('button', { class: 'sm', onclick: function () { V.rules = []; V.groupColors = {}; V.key.edits = {}; V.marks = {}; V.vocab = {}; S.styleMap = null; saveView(); makeScene(false); renderRail(true); } }, 'Clear all styling')]));
  return kids;
}

/* ---- Views */
var SNAP_KEYS = ['view', 'arrange', 'colorBy', 'sizeBy', 'widthBy', 'edgeColorBy', 'linkLabels', 'labelCol', 'dir', 'spread', 'fold', 'merge', 'rows', 'chapters', 'openCh', 'minimap', 'bundle', 'taper', 'tagLen', 'spineCol', 'better', 'wrap', 'ruler', 'downLanes', 'laneBy', 'agg', 'strongest', 'facets', 'around', 'block', 'hideKinds', 'only', 'sets', 'marks', 'rules', 'palette', 'ramp', 'groupColors', 'widthScale', 'widthMul', 'hulls', 'curve', 'valueLabels', 'lab', 'lens', 'cam', 'vocab', 'pins', 'sk', 'fmt'];
function snapshot() { var o = {}; SNAP_KEYS.forEach(function (k) { o[k] = JSON.parse(JSON.stringify(S.V[k] === undefined ? null : S.V[k])); }); return o; }
/** Only known settings of the right kind are accepted from shared text. */
function cleanSnapshot(o) {
  var D = defaultView(), out = {};
  if (!o || typeof o !== 'object') return null;
  SNAP_KEYS.forEach(function (k) {
    var v = o[k]; if (v === undefined) return;
    var d = D[k];
    if (typeof d === 'string') { if (typeof v === 'string' && v.length < 200) out[k] = v; }
    else if (typeof d === 'number') { if (typeof v === 'number' && isFinite(v)) out[k] = v; }
    else if (typeof d === 'boolean') { if (typeof v === 'boolean') out[k] = v; }
    else if (Array.isArray(d)) { if (Array.isArray(v) && v.length < 5000) out[k] = k === 'rules' ? v.map(cleanRule).filter(Boolean).slice(0, 60) : v.filter(function (x) { return typeof x === 'string'; }); }
    else if (k === 'around') { if (v && typeof v.id === 'string' && typeof v.depth === 'number') out[k] = { id: v.id, depth: clamp(v.depth | 0, 1, 6) }; else out[k] = null; }
    else if (k === 'only') { out[k] = Array.isArray(v) ? v.filter(function (x) { return typeof x === 'string'; }).slice(0, 5000) : null; }
    else if (k === 'sets') { if (v && typeof v === 'object') { var s = {}; Object.keys(v).slice(0, 60).forEach(function (n) { if (Array.isArray(v[n])) s[String(n).slice(0, 60)] = v[n].filter(function (x) { return typeof x === 'string'; }).slice(0, 5000); }); out[k] = s; } }
    else if (k === 'marks' || k === 'groupColors' || k === 'vocab') { if (v && typeof v === 'object') { var m = {}; Object.keys(v).slice(0, 500).forEach(function (n) { if (typeof v[n] === 'string' && v[n].length < 80) m[n] = v[n]; }); out[k] = m; } }
    else if (k === 'facets') { if (v && typeof v === 'object') { var f = {}; Object.keys(v).slice(0, 20).forEach(function (n) { if (Array.isArray(v[n])) f[n] = v[n].filter(function (x) { return typeof x === 'string'; }).slice(0, 200); }); out[k] = f; } }
    else if (k === 'pins') { if (v && typeof v === 'object') { var p = {}; Object.keys(v).slice(0, 20).forEach(function (vk) { if (v[vk] && typeof v[vk] === 'object') { p[vk] = {}; Object.keys(v[vk]).slice(0, 5000).forEach(function (id) { var a = v[vk][id]; if (Array.isArray(a) && typeof a[0] === 'number' && typeof a[1] === 'number') p[vk][id] = [a[0], a[1]]; }); } }); out[k] = p; } }
    else if (k === 'fmt') { out[k] = NFMLook.clean(v); }
    else if (k === 'sk') { var sk = cleanSk(v); if (sk) out[k] = sk; }
    else if (k === 'lab' || k === 'lens' || k === 'cam') { if (v && typeof v === 'object') { var q = JSON.parse(JSON.stringify(D[k])); Object.keys(q).forEach(function (a) { if (v[a] && typeof v[a] === 'object' && typeof q[a] === 'object') { Object.keys(q[a]).forEach(function (b) { if (typeof v[a][b] === typeof q[a][b]) q[a][b] = v[a][b]; }); } else if (typeof v[a] === typeof q[a]) q[a] = v[a]; }); out[k] = q; } }
  });
  if (out.view && !VIEWS.some(function (x) { return x[0] === out.view; })) delete out.view;
  if (out.arrange !== undefined && !own(ARR, out.arrange)) delete out.arrange;
  if (out.palette !== undefined && !own(NFMScene.PALETTES, out.palette)) delete out.palette;   /* names on a fixed list only: "constructor" used to be accepted and then broke every drawing */
  if (out.ramp !== undefined && !own(NFMScene.RAMPS, out.ramp)) delete out.ramp;
  return out;
}
var RULE_SET_KEYS = { fill: 's', stroke: 's', shape: 's', scale: 'n', opacity: 'n', icon: 's', image: 's', iconMode: 's', hide: 'b', labelShow: 'b', labelColor: 's', labelSize: 'n', labelBold: 'b', labelText: 's', color: 's', wmul: 'n', dash: 's', arrow: 'b', label: 's', bend: 'n', w: 'n' };
function cleanRule(r) {
  if (!r || typeof r !== 'object') return null;
  var out = { id: Date.now() + Math.random(), target: r.target === 'links' ? 'links' : 'nodes', on: r.on !== false, when: { type: 'all' }, set: {} }, w = r.when || {};
  if (['all', 'group', 'kind', 'column', 'set', 'formula', 'ends', 'between'].indexOf(w.type) >= 0) { out.when.type = w.type; ['value', 'col', 'op', 'name', 'formula'].forEach(function (k) { if (typeof w[k] === 'string' && w[k].length < 300) out.when[k] = w[k]; else if (k === 'value' && typeof w[k] === 'number') out.when[k] = w[k]; }); }
  var s = r.set || {};
  Object.keys(RULE_SET_KEYS).forEach(function (k) {
    var t = RULE_SET_KEYS[k], v = s[k]; if (v === undefined) return;
    if (t === 's' && typeof v === 'string' && v.length < (k === 'image' ? 60000 : 200) && (k !== 'image' || /^data:image\/(png|jpeg|gif|webp);base64,/.test(v)) && (k !== 'fill' && k !== 'stroke' && k !== 'labelColor' && k !== 'color' || /^#[0-9a-f]{3,8}$/i.test(v))) out.set[k] = v;
    else if (t === 'n' && typeof v === 'number' && isFinite(v)) out.set[k] = v; else if (t === 'b' && typeof v === 'boolean') out.set[k] = v;
  });
  return out;
}
var SK_NODE_KEYS = { fill: 's', stroke: 's', labelText: 's', labelSize: 'n', labelColor: 's', labelBold: 'b', labelShow: 'b', labelSide: 's', hide: 'b', opacity: 'n' }, SK_LINK_KEYS = { color: 's', color2: 's', mode: 's', opacity: 'n', hide: 'b', label: 's' };
/** Only known Sankey picture settings of the right kind are accepted from shared text. */
function cleanSk(v) {
  if (!v || typeof v !== 'object') return null;
  var d = defaultView().sk, o = JSON.parse(JSON.stringify(d)), num = function (x, lo, hi, def) { return typeof x === 'number' && isFinite(x) ? Math.max(lo, Math.min(hi, x)) : def; };
  if (['target', 'source', 'gradient', 'solid'].indexOf(v.color) >= 0) o.color = v.color;
  if (['auto', 'left', 'right'].indexOf(v.labels) >= 0) o.labels = v.labels;
  o.opacity = num(v.opacity, 0.05, 1, d.opacity); o.nodeW = num(v.nodeW, 4, 80, d.nodeW); o.gap = num(v.gap, 60, 700, d.gap); o.pad = num(v.pad, 2, 80, d.pad); o.height = num(v.height, 0, 4000, 0);
  if (typeof v.nodeValues === 'boolean') o.nodeValues = v.nodeValues; if (typeof v.justify === 'boolean') o.justify = v.justify;
  var colorOk = function (x) { return typeof x === 'string' && /^#[0-9a-f]{3,8}$/i.test(x); };
  var clean = function (src, keys, max) {
    var out = {}; if (!src || typeof src !== 'object') return out;
    Object.keys(src).slice(0, max).forEach(function (id) {
      var e = src[id], r = {}; if (!e || typeof e !== 'object') return;
      Object.keys(keys).forEach(function (k) {
        var x = e[k], t = keys[k]; if (x === undefined) return;
        if (t === 'n' && typeof x === 'number' && isFinite(x)) r[k] = x; else if (t === 'b' && typeof x === 'boolean') r[k] = x;
        else if (t === 's' && typeof x === 'string' && x.length < 200) { if ((k === 'fill' || k === 'stroke' || k === 'labelColor' || k === 'color' || k === 'color2') && !colorOk(x)) return; r[k] = x; }
      });
      if (Object.keys(r).length) out[String(id).slice(0, 200)] = r;
    });
    return out;
  };
  o.nodes = clean(v.nodes, SK_NODE_KEYS, 5000); o.links = clean(v.links, SK_LINK_KEYS, 8000);
  if (v.fixY && typeof v.fixY === 'object') Object.keys(v.fixY).slice(0, 5000).forEach(function (id) { if (typeof v.fixY[id] === 'number' && isFinite(v.fixY[id])) o.fixY[id] = v.fixY[id]; });
  var ord = v.order; if (ord && Array.isArray(ord.layers) && Array.isArray(ord.loops) && ord.layers.length < 400 && ord.layers.every(function (l) { return Array.isArray(l) && l.length < 5000 && l.every(function (x) { return typeof x === 'string'; }); })) o.order = { layers: ord.layers, loops: ord.loops.filter(function (x) { return typeof x === 'string' && x.length < 400; }) };
  return o;
}
function applySnapshot(snap, camV) {
  var c = cleanSnapshot(snap); if (!c) return false;
  Object.keys(c).forEach(function (k) { S.V[k] = c[k]; }); S.styleMap = null; S.route = null; saveView(); refreshMap('options'); renderRail(true);
  if (camV) setTimeout(function () { viewTo(camV, 400); }, 300);
  return true;
}
function encodeView(snap) { return 'NFM-VIEW1:' + btoa(unescape(encodeURIComponent(JSON.stringify(snap)))); }
function decodeView(txt) {
  txt = (txt || '').trim(); if (txt.indexOf('NFM-VIEW1:') !== 0) return null;
  try { return JSON.parse(decodeURIComponent(escape(atob(txt.slice(10))))); } catch (e) { return null; }
}
function panelViews() {
  var V = S.V, kids = [], nm = h('input', { type: 'text', placeholder: 'Name this view', 'aria-label': 'View name', maxlength: 60 });
  kids.push(section('Save this view', [h('p', { class: 'muted small', style: { margin: 0 } }, 'Saves the view, filters, colors, rules and positions (not the data), and where you are looking.'), nm,
    h('button', { class: 'primary', onclick: function () { var name = nm.value.trim() || 'View ' + (V.saved.length + 1); V.saved = V.saved.concat([{ name: name.slice(0, 60), snap: snapshot(), cam: { k: S.view.k, tx: S.view.tx, ty: S.view.ty, w: S.stageW, h: S.stageH } }]).slice(-30); saveView(); renderRail(true); toast('Saved "' + name + '".'); } }, 'Save')]));
  kids.push(section('Saved views', V.saved.length ? V.saved.map(function (s, i) {
    return h('div', { class: 'rule' }, [h('div', { class: 'rh' }, [h('b', null, s.name), h('button', { class: 'sm', onclick: function () { applySnapshot(s.snap, s.cam && s.cam.w ? { k: s.cam.k * S.stageW / s.cam.w, tx: s.cam.tx, ty: s.cam.ty } : null); } }, 'Open'), h('button', { class: 'sm', title: 'Copy as text to share', onclick: function () { copyText(encodeView(s.snap)); } }, 'Copy as text'), h('button', { class: 'sm danger', 'aria-label': 'Delete ' + s.name, onclick: function () { V.saved = V.saved.filter(function (_, k) { return k !== i; }); saveView(); renderRail(true); } }, '×')])]);
  }) : [h('span', { class: 'muted small' }, 'None yet.')]));
  var paste = h('textarea', { placeholder: 'Paste shared view text here (starts with NFM-VIEW1:)', 'aria-label': 'Shared view text', style: { minHeight: '70px' } });
  kids.push(section('Open a shared view', [paste, h('button', { onclick: function () { var snap = decodeView(paste.value); if (!snap || !applySnapshot(snap)) toast('That does not look like shared view text.'); else toast('Opened the shared view. Use the same data for it to make sense.'); } }, 'Open it')]));
  var title = h('input', { type: 'text', placeholder: 'Poster title', value: S.graph.name, 'aria-label': 'Poster title' }), cap2 = h('input', { type: 'text', placeholder: 'A line under the title (optional)', 'aria-label': 'Poster caption' });
  kids.push(section('Poster', [title, cap2, h('button', { onclick: function () { printPoster(title.value, cap2.value); } }, 'Print or save as PDF')]));
  kids.push(h('button', { class: 'sm', onclick: function () { LS.del(VKEY()); S.V = defaultView(); loadView(); saveView(); S.styleMap = null; refreshMap('options'); renderRail(true); } }, 'Reset every setting for this data'));
  return kids;
}
function printPoster(title, caption) {
  withMap(function (scene) {
    var old = $('poster'); if (old) old.remove();
    var svg = NFMScene.toSvg(scene, title || S.graph.name), box = h('div', { id: 'poster' }, [h('h1', null, title || S.graph.name), caption ? h('p', null, caption) : null, h('div', { id: 'poster-img' }), h('p', { class: 'small' }, $('sum').textContent), h('p', { class: 'small' }, 'Made with Netflow Map.')]);
    document.body.appendChild(box);
    $('poster-img').innerHTML = svg; /* our own SVG; names inside it are escaped by the exporter */
    var s = $('poster-img').querySelector('svg'); if (s) { s.removeAttribute('width'); s.removeAttribute('height'); s.style.width = '100%'; s.style.height = 'auto'; }
    setTimeout(function () { window.print(); setTimeout(function () { box.remove(); }, 800); }, 60);
  });
}
HOOKS.graph.push(function () { S.styleMap = null; strongestCut.c = null; S.search = { q: '', hits: new Set(), list: [], cur: 0 }; S.route = null; });
