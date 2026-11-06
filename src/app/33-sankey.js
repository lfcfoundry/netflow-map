/*!
 * Netflow Map app, part 5b: Sankey pictures. Hand edits (colors, labels, order, placement), their undo, the side panel and the click menus.
 * Copyright (c) 2026 LFC Foundry. MIT License.
 *
 * Everything the person changes by hand lives in S.V.sk so it is saved with the view:
 *   color, opacity, labels, nodeValues      how all flows and labels look
 *   nodeW, gap, pad, height, justify        size and spacing of the picture (layout; redone on the page, instantly)
 *   fixY {id: top}, order {layers, loops}   where bars were put by hand
 *   nodes {id: {fill, stroke, labelText, labelSize, labelColor, labelBold, labelShow, labelSide, hide, opacity}}
 *   links {"from>to": {color, color2, mode, opacity, hide, label}}
 */
var skHist = [], skLast = 0, skSoon = 0;
function skOn() { return !!(S.L && S.L.view === 'sankey' && S.L.sk); }   /* hand edits (drag a bar, edit a label) are for the left-to-right picture */
function skV() {
  var V = S.V, d = defaultView().sk;
  if (!V.sk || typeof V.sk !== 'object') V.sk = d;
  Object.keys(d).forEach(function (k) { if (V.sk[k] === undefined) V.sk[k] = d[k]; });
  return V.sk;
}
function skSettings() { var k = skV(); return { nodeW: k.nodeW, gap: k.gap, pad: k.pad, height: k.height, justify: k.justify, fixY: k.fixY, order: k.order }; }
/** Lays the picture out again right here (the order is kept; only places and sizes change). Cheap enough to do while dragging. */
function skRelayout() {
  if (!skOn()) return false;
  var op = NetflowSankey.options(skSettings()); op.fixedOrder = S.L.sk.order;
  NetflowSankey.apply(S.L, NetflowSankey.layout(S.L, op));
  return true;
}
function skKeepOrder() { var k = skV(), o = S.L && S.L.sk && S.L.sk.order; k.order = o && o.layers.reduce(function (a, l) { return a + l.length; }, 0) < 4000 ? JSON.parse(JSON.stringify(o)) : null; }
function skPush(force) {
  var now = performance.now(); if (!force && now - skLast < 1500) { skLast = now; return; } skLast = now;
  var k = skV(); skHist.push(JSON.stringify(k)); if (skHist.length > 60) skHist.shift();
}
function skUndo() {
  if (!skHist.length) { toast('Nothing to undo here.'); return; }
  S.V.sk = JSON.parse(skHist.pop()); saveView(); refreshMap('options'); renderRail(true); toast('Undone.');
}
function skCommit(relayout) { saveView(); if (relayout) skRelayout(); makeScene(false); if (S.tab === 'map') renderRail(true); }
function skLayoutSoon() { if (skSoon) return; skSoon = requestAnimationFrame(function () { skSoon = 0; skRelayout(); skKeepOrder(); saveView(); scheduleScene(); }); }
function skClean(patch, cur) {
  var o = Object.assign({}, cur || {}, patch);
  Object.keys(patch).forEach(function (p) { if (patch[p] === '' || patch[p] === undefined || patch[p] === null) delete o[p]; });
  return Object.keys(o).length ? o : null;
}
function skNodePatch(ids, patch) {
  skPush(true); var k = skV(); k.nodes = Object.assign({}, k.nodes);
  ids.forEach(function (id) { var o = skClean(patch, k.nodes[id]); if (o) k.nodes[id] = o; else delete k.nodes[id]; });
  skCommit(false);
}
function skLinkKey(ei) { var e = S.L.edges[ei], a = e && S.L.pos[e.from], b = e && S.L.pos[e.to]; return a && b ? (a.nodeId || a.id) + '>' + (b.nodeId || b.id) : null; }
function skLinkPatch(eis, patch) {
  skPush(true); var k = skV(); k.links = Object.assign({}, k.links);
  eis.forEach(function (ei) { var key = skLinkKey(ei); if (!key) return; var o = skClean(patch, k.links[key]); if (o) k.links[key] = o; else delete k.links[key]; });
  skCommit(false);
}
/** Hand edits laid over what the style rules say. */
function skStyleWrap(o) {
  var k = skV(), nodes = k.nodes, links = k.links, nn = Object.keys(nodes).length, ln = Object.keys(links).length;
  var vl = k.valueLabel && k.valueLabel !== 'none' ? k.valueLabel : (k.nodeValues ? 'under' : 'none');
  o.sk = { color: k.color, opacity: k.opacity, labels: k.labels, nodeValues: k.nodeValues, valueLabel: vl, unit: k.unit || '', percentOf: k.percentOf || 'total' };
  if (k.notes && k.notes.length) o.notes = k.notes;
  if (nn) { var bn = o.nodeStyle; o.nodeStyle = function (n) { var b = bn ? bn(n) : null, m = nodes[n.nodeId || n.id]; return m ? Object.assign({}, b || {}, m) : b; }; }
  if (ln) { var bl = o.linkStyle; o.linkStyle = function (e, ei) { var b = bl ? bl(e, ei) : null, key = skLinkKey(ei), m = key ? links[key] : null; return m ? Object.assign({}, b || {}, m) : b; }; }
}

/* ---------------------------------------------------------------- small pop-up: pick a color */
function askColor(title, def, reset) {
  return new Promise(function (resolve) {
    var dlg = $('dlg'), body = $('dlg-body'), pal = NFMScene.palette(lookNames().theme, S.V.palette).hex.groups.concat(['#1d2330', '#7b8294', '#ffffff']);
    var inp = h('input', { type: 'color', value: NFMScene.toHex(NFMScene.hex(def || '#4e79a7')), 'aria-label': 'Color', style: { width: '64px', height: '40px' } });
    var done = function (v) { dlg.close(); resolve(v); };
    var sw = h('div', { class: 'row tight', style: { flexWrap: 'wrap' } }, pal.map(function (c) { return h('button', { class: 'sm', 'aria-label': c, title: c, style: { background: c, width: '28px', height: '28px', padding: 0, border: '1px solid rgba(0,0,0,.25)', borderRadius: '6px' }, onclick: function () { done(c); } }); }));
    mount(body, [h('h3', { id: 'dlg-h' }, title), sw, h('div', { class: 'row', style: { alignItems: 'center' } }, [inp, h('span', { class: 'muted small' }, 'or choose any color')]),
      h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, [reset ? h('button', { onclick: function () { done(''); } }, reset) : null, h('button', { onclick: function () { done(null); } }, 'Cancel'), h('button', { class: 'primary', onclick: function () { done(inp.value); } }, 'OK')])]);
    dlg.onclose = function () { resolve(null); };
    dlg.showModal();
  });
}

/* ---------------------------------------------------------------- order: move a bar within its column */
function skColumn(id) {
  var o = S.L.sk.order; for (var li = 0; li < o.layers.length; li++) { var j = o.layers[li].indexOf(id); if (j >= 0) return { li: li, j: j, list: o.layers[li] }; } return null;
}
function skMove(ids, how) {
  var o = S.L && S.L.sk && S.L.sk.order; if (!o) return;
  skPush(true);
  var k = skV(); k.fixY = Object.assign({}, k.fixY);
  ids.forEach(function (id) {
    var c = skColumn(id); if (!c) return;
    c.list.forEach(function (x) { delete k.fixY[x]; });
    var list = c.list, j = c.j, real = function (q) { return list[q].charAt(0) !== '~'; }, t = j;
    if (how === 'up') { t = j - 1; while (t > 0 && !real(t)) t--; if (t < 0) t = 0; }
    else if (how === 'down') { t = j + 1; while (t < list.length - 1 && !real(t)) t++; if (t > list.length - 1) t = list.length - 1; }
    else if (how === 'top') t = 0; else if (how === 'bottom') t = list.length - 1;
    list.splice(j, 1); list.splice(t, 0, id);
  });
  skRelayout(); skKeepOrder(); skCommit(false);
}
function skResetPlace(ids) {
  skPush(true); var k = skV(); k.fixY = Object.assign({}, k.fixY);
  if (!ids) { k.fixY = {}; k.order = null; saveView(); refreshMap('options'); renderRail(true); toast('Back to the automatic arrangement.'); return; }
  ids.forEach(function (id) { delete k.fixY[id]; }); skRelayout(); skKeepOrder(); skCommit(false);
}

/* ---------------------------------------------------------------- dragging a bar up or down */
function skBeginDrag(q) {
  var id = q.hit.node.nodeId; if (id === undefined) { q.mode = 'pan'; return; }
  if (!S.sel.has(id)) setSel([id]);
  skPush(true);
  var y0 = {}, byId = new Map(); S.L.nodes.forEach(function (n) { byId.set(n.nodeId || n.id, n); });
  Array.from(S.sel).forEach(function (m) { var n = byId.get(m); if (n) y0[m] = n.y; });
  DRAG = { sk: true, ids: Object.keys(y0), y0: y0, w0: worldOf(q.x, q.y) };
}
function skDragTo(p) {
  var w = worldOf(p[0], p[1]), dy = w[1] - DRAG.w0[1], k = skV(); k.fixY = Object.assign({}, k.fixY);
  DRAG.ids.forEach(function (id) { k.fixY[id] = Math.max(0, DRAG.y0[id] + dy); });
  skRelayout(); scheduleScene();
}
function skEndDrag() { skKeepOrder(); saveView(); renderMapUI(); }

/* ---------------------------------------------------------------- menus */
var SK_COLOR_MODES = [['target', 'Same color as where it ends'], ['source', 'Same color as where it starts'], ['gradient', 'Fade from start color to end color'], ['solid', 'One neutral color']];
var SK_VALUE_MODES = [['none', 'No amounts'], ['under', 'Total under the name'], ['inline', 'Amount after the name'], ['percent', 'Percent under the name'], ['both', 'Amount and percent']];
function skVL(k) { return k.valueLabel && k.valueLabel !== 'none' ? k.valueLabel : (k.nodeValues ? 'under' : 'none'); }
function skSetVL(k, v) { k.valueLabel = v; k.nodeValues = v === 'under'; }
/** Notes written on the picture. {total}, {top}, {value:name}, {share:name} and {flow:from>to} are filled in with live numbers. */
var SK_NOTE_HINT = 'Numbers fill in by themselves: {total}, {top}, {value:Name}, {share:Name}, {flow:From>To}';
function skAddNote() {
  askText('Add a note', SK_NOTE_HINT, 'Total: {total}').then(function (v) {
    if (v === null || !String(v).trim()) return;
    var k = skV(); skPush(true); k.notes = (k.notes || []).slice(0, 19).concat([{ text: String(v).trim().slice(0, 300), x: 0.5, y: 0.04 + 0.08 * (k.notes || []).length % 0.9, align: 'c', size: 14 }]); skCommit(false);
  });
}
function skNotesPanel(k) {
  var ns = k.notes || [];
  return h('div', { style: { display: 'grid', gap: '6px' } }, [h('h4', { style: { margin: '4px 0 0' } }, 'Notes on the picture')].concat(ns.map(function (n, i) {
    return h('div', { class: 'row tight', style: { flexWrap: 'wrap' } }, [
      h('input', { type: 'text', maxlength: 300, value: n.text, 'aria-label': 'Note ' + (i + 1), style: { flex: '1 1 160px' }, onchange: function () { skPush(true); n.text = this.value.slice(0, 300); skCommit(false); } }),
      h('input', { type: 'range', min: 0, max: 1, step: 0.01, value: n.x, 'aria-label': 'Note ' + (i + 1) + ' across', style: { width: '70px' }, oninput: function () { n.x = +this.value; saveView(); scheduleScene(); } }),
      h('input', { type: 'range', min: 0, max: 1, step: 0.01, value: n.y, 'aria-label': 'Note ' + (i + 1) + ' down', style: { width: '70px' }, oninput: function () { n.y = +this.value; saveView(); scheduleScene(); } }),
      h('button', { class: 'sm', 'aria-label': 'Remove note ' + (i + 1), onclick: function () { skPush(true); k.notes.splice(i, 1); skCommit(false); } }, 'Remove')]);
  }), [h('div', { class: 'row tight' }, [h('button', { class: 'sm', onclick: skAddNote }, 'Add a note…')]), ns.length ? h('p', { class: 'muted small', style: { margin: 0 } }, SK_NOTE_HINT + '. Sliders: across, down.') : null]));
}
function skEditLabel(id) {
  var g = S.byId.get(id), cur = (skV().nodes[id] || {}).labelText || (g ? g.label : id);
  askText('Label text', 'Text shown next to the bar', cur).then(function (v) { if (v !== null) skNodePatch([id], { labelText: v === (g ? g.label : id) ? '' : v }); });
}
function skBarItems(ids) {
  var one = ids.length === 1 ? ids[0] : null, cur = one ? (skV().nodes[one] || {}) : {};
  var pinned = ids.some(function (id) { return skV().fixY[id] !== undefined; });
  return [
    { hd: 'This bar' },
    { t: 'Color…', fn: function () { askColor('Bar color', cur.fill, 'Back to automatic').then(function (c) { if (c !== null) skNodePatch(ids, { fill: c }); }); } },
    { t: 'Outline…', fn: function () { askColor('Outline color', cur.stroke, 'No outline').then(function (c) { if (c !== null) skNodePatch(ids, { stroke: c }); }); } },
    { t: 'Move up', fn: function () { skMove(ids, 'up'); } }, { t: 'Move down', fn: function () { skMove(ids, 'down'); } },
    { t: 'To the top of its column', fn: function () { skMove(ids, 'top'); } }, { t: 'To the bottom of its column', fn: function () { skMove(ids, 'bottom'); } },
    { t: 'Back to its automatic place', fn: function () { skResetPlace(ids); }, off: !pinned },
    { t: 'Hide this bar and its flows', fn: function () { skNodePatch(ids, { hide: true }); } }
  ];
}
function skTextItems(ids) {
  var one = ids.length === 1 ? ids[0] : null, cur = one ? (skV().nodes[one] || {}) : {}, it = [{ hd: 'Its label' }];
  if (one) it.push({ t: 'Edit the text…', fn: function () { skEditLabel(one); } });
  it.push({ t: 'Bigger', fn: function () { skNodePatch(ids, { labelSize: Math.min(3, (cur.labelSize || 1) * 1.2) }); } }, { t: 'Smaller', fn: function () { skNodePatch(ids, { labelSize: Math.max(0.5, (cur.labelSize || 1) / 1.2) }); } },
    { t: cur.labelBold ? 'Normal weight' : 'Bold', fn: function () { skNodePatch(ids, { labelBold: cur.labelBold ? '' : true }); } },
    { t: 'Color…', fn: function () { askColor('Label color', cur.labelColor, 'Back to automatic').then(function (c) { if (c !== null) skNodePatch(ids, { labelColor: c }); }); } },
    { t: 'Put it on the left', fn: function () { skNodePatch(ids, { labelSide: 'left' }); } }, { t: 'Put it on the right', fn: function () { skNodePatch(ids, { labelSide: 'right' }); } },
    { t: cur.labelShow === false ? 'Show the label' : 'Hide the label', fn: function () { skNodePatch(ids, { labelShow: cur.labelShow === false ? '' : false }); } },
    { t: 'Back to the default look', fn: function () { skNodePatch(ids, { fill: '', stroke: '', labelText: '', labelSize: '', labelColor: '', labelBold: '', labelSide: '', labelShow: '', hide: '', opacity: '' }); } });
  return it;
}
function skNodeItems(ids) { return skBarItems(ids).concat([{ sep: 1 }], skTextItems(ids), [{ sep: 1 }]); }
function skLinkItems(ei) {
  var key = skLinkKey(ei), cur = (key && skV().links[key]) || {}, op = cur.opacity === undefined ? skV().opacity : cur.opacity;
  return [
    { hd: 'This flow' },
    { t: 'Color…', fn: function () { askColor('Flow color', cur.color, 'Back to automatic').then(function (c) { if (c !== null) skLinkPatch([ei], { color: c, mode: '' }); }); } },
    { t: 'Fade to another color…', fn: function () { askColor('Fade to this color at the end', cur.color2, 'No fade').then(function (c) { if (c !== null) skLinkPatch([ei], { color2: c }); }); } },
    { t: 'Like where it starts', fn: function () { skLinkPatch([ei], { mode: 'source', color: '', color2: '' }); } }, { t: 'Like where it ends', fn: function () { skLinkPatch([ei], { mode: 'target', color: '', color2: '' }); } },
    { t: 'Start color to end color', fn: function () { skLinkPatch([ei], { mode: 'gradient', color: '', color2: '' }); } },
    { t: 'More see-through', fn: function () { skLinkPatch([ei], { opacity: Math.max(0.08, op - 0.12) }); } }, { t: 'Less see-through', fn: function () { skLinkPatch([ei], { opacity: Math.min(1, op + 0.12) }); } },
    { t: 'Put a label on it…', fn: function () { askText('Label for this flow', 'Text on the flow', cur.label || '').then(function (v) { if (v !== null) skLinkPatch([ei], { label: v }); }); } },
    { t: 'Hide this flow', fn: function () { skLinkPatch([ei], { hide: true }); } },
    { t: 'Back to the default look', fn: function () { skLinkPatch([ei], { color: '', color2: '', mode: '', opacity: '', hide: '', label: '' }); }, off: !Object.keys(cur).length },
    { sep: 1 }
  ];
}
function skLabelItems(id) {
  var g = S.byId.get(id);
  return [{ hd: 'Label: ' + (g ? g.label : id) }].concat(skTextItems([id]).slice(1), [{ sep: 1 }], skBarItems([id]), [{ sep: 1 }]);
}
function skBackgroundItems() {
  var k = skV(), it = [{ hd: 'Flows' }];
  SK_COLOR_MODES.forEach(function (m) { it.push({ t: (k.color === m[0] ? '✓ ' : '') + m[1], fn: function () { skPush(true); k.color = m[0]; skCommit(false); } }); });
  it.push({ t: 'More see-through', fn: function () { skPush(true); k.opacity = Math.max(0.08, k.opacity - 0.1); skCommit(false); } }, { t: 'Less see-through', fn: function () { skPush(true); k.opacity = Math.min(1, k.opacity + 0.1); skCommit(false); } },
    { sep: 1 }, { hd: 'Picture' },
    { t: (S.V.valueLabels ? '✓ ' : '') + 'Amounts on the flows', fn: function () { skPush(true); setV({ valueLabels: !S.V.valueLabels }, 'look'); renderRail(true); } },
    { t: (skVL(k) === 'under' ? '✓ ' : '') + 'Totals under the names', fn: function () { skPush(true); skSetVL(k, skVL(k) === 'under' ? 'none' : 'under'); skCommit(false); } },
    { t: (skVL(k) === 'inline' ? '✓ ' : '') + 'Amount after each name', fn: function () { skPush(true); skSetVL(k, skVL(k) === 'inline' ? 'none' : 'inline'); skCommit(false); } },
    { t: 'Add a note…', fn: function () { skAddNote(); } },
    { t: 'Thicker bars', fn: function () { skPush(true); k.nodeW = Math.min(80, k.nodeW + 6); skCommit(true); } }, { t: 'Thinner bars', fn: function () { skPush(true); k.nodeW = Math.max(4, k.nodeW - 4); skCommit(true); } },
    { t: 'Taller picture', fn: function () { skPush(true); k.height = Math.round((k.height || S.L.height) * 1.2); skCommit(true); } }, { t: 'Shorter picture', fn: function () { skPush(true); k.height = Math.max(200, Math.round((k.height || S.L.height) / 1.2)); skCommit(true); } },
    { t: 'Undo the last change', fn: skUndo, off: !skHist.length },
    { t: 'Back to the automatic arrangement', fn: function () { skResetPlace(null); } },
    { sep: 1 });
  return it;
}

/* ---------------------------------------------------------------- the panel on the Look tab */
function skPanel() {
  var k = skV(), later = function (f) { return function (x) { skPush(false); f(x); }; };
  var re = function () { skLayoutSoon(); };
  return section('Sankey picture', [
    field('Flow color', select(SK_COLOR_MODES, k.color, function (v) { skPush(true); k.color = v; skCommit(false); })),
    slider('Flow see-through', k.opacity, 0.08, 1, 0.02, later(function (x) { k.opacity = x; saveView(); scheduleScene(); }), function (x) { return Math.round((1 - x) * 100) + '%'; }),
    slider('Bar width', k.nodeW, 4, 60, 1, later(function (x) { k.nodeW = x; re(); }), function (x) { return Math.round(x) + ' px'; }),
    slider('Space between columns', k.gap || (S.L && S.L.sk && S.L.sk.cols > 1 ? Math.round(S.L.width / S.L.sk.cols) : 190), 80, 600, 5, later(function (x) { k.gap = x; re(); }), function (x) { return Math.round(x) + ' px'; }),
    slider('Space between bars', k.pad, 2, 60, 1, later(function (x) { k.pad = x; re(); }), function (x) { return Math.round(x) + ' px'; }),
    slider('Picture height', k.height || (S.L && S.L.height ? Math.round(S.L.height) : 600), 200, 2400, 20, later(function (x) { k.height = x; re(); }), function (x) { return Math.round(x) + ' px'; }),
    field('Labels', select([['auto', 'First column on the left, the rest on the right'], ['right', 'All on the right'], ['left', 'All on the left']], k.labels, function (v) { skPush(true); k.labels = v; skCommit(false); })),
    field('Amounts with the names', select(SK_VALUE_MODES, skVL(k), function (v) { skPush(true); skSetVL(k, v); skCommit(false); })),
    skVL(k) !== 'none' ? field('Unit (for example $ or GWh)', h('input', { type: 'text', maxlength: 12, value: k.unit || '', 'aria-label': 'Unit', onchange: function () { skPush(true); k.unit = this.value.trim(); skCommit(false); } })) : null,
    skVL(k) === 'percent' || skVL(k) === 'both' ? field('Percent of', select([['total', 'The whole picture'], ['column', 'Its column']], k.percentOf || 'total', function (v) { skPush(true); k.percentOf = v; skCommit(false); })) : null,
    check('Amounts on the flows', S.V.valueLabels, function (on) { skPush(true); setV({ valueLabels: on }, 'look'); }),
    h('div', { class: 'row tight' }, [h('button', { class: 'sm', disabled: !skHist.length, onclick: skUndo }, 'Undo last change'), h('button', { class: 'sm', onclick: function () { skResetPlace(null); } }, 'Automatic arrangement'),
      h('button', { class: 'sm', onclick: function () { skPush(true); k.nodes = {}; k.links = {}; skCommit(false); toast('Hand-made colors and labels cleared.'); } }, 'Clear hand edits')]),
    skNotesPanel(k),
    h('p', { class: 'muted small', style: { margin: 0 } }, 'Click a bar, flow or label for options (' + T('right-click', 'press and hold') + ' or double-click for the full menu). Drag a bar up or down to place it.')
  ]);
}
