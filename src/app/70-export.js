/*!
 * Netflow Map app, part 9: the Export tab. Copyright (c) 2026 LFC Foundry. MIT License.
 */
TAB_HOOKS.export = function () { renderExport(); };
HOOKS.graph.push(function () { if (S.tab === 'export') renderExport(); });
function allCols(scope) { return (S.prof ? S.prof[scope] : []).filter(function (c) { return !c.builtin; }).map(function (c) { return c.key; }); }
function exportItemsCsv() {
  var cols = allCols('nodes'), rows = ['id,label,group,ending' + cols.map(function (c) { return ',' + csvCell(c); }).join('')];
  S.dg.nodes.forEach(function (n) { rows.push([n.id, n.label, n.group, n.valence].concat(cols.map(function (c) { return n.attrs ? n.attrs[c] : ''; })).map(csvCell).join(',')); });
  return rows.join('\n') + '\n';
}
function exportLinksCsv() {
  var cols = allCols('edges'), rows = ['from,to,label,weight,kind' + cols.map(function (c) { return ',' + csvCell(c); }).join('')];
  S.dg.edges.forEach(function (e) { rows.push([e.from, e.to, e.label, e.weight, e.kind].concat(cols.map(function (c) { return e.attrs ? e.attrs[c] : ''; })).map(csvCell).join(',')); });
  return rows.join('\n') + '\n';
}
/** Draws the key onto a picture so pictures carry their own explanation. */
function drawKeyOn(ctx, sc, W, H, theme, o) { NFMGifKey.drawKey(ctx, sc, W, H, o, S.V.fmt.font); }
/** Renders the current scene to a canvas of the wanted size (null when nothing is drawn). */
function sceneToCanvas(sc, w, hh, withKey) {
  return new Promise(function (resolve) {
    var hostEl = document.createElement('div'); hostEl.style.cssText = 'position:fixed;left:-9999px;top:0;width:' + w + 'px;height:' + hh + 'px'; document.body.appendChild(hostEl);
    NFMRender.createCanvas2D(hostEl, {}).then(function (r) {
      r.setScene(sc); r.resize(w, hh, 1);
      var k = Math.min(w / sc.w, hh / sc.h) * 0.98; r.draw({ k: k, tx: (w - sc.w * k) / 2 - sc.x0 * k, ty: (hh - sc.h * k) / 2 - sc.y0 * k, invalidate: function () {} });
      var c = document.createElement('canvas'); c.width = w; c.height = hh; var x = c.getContext('2d');
      x.fillStyle = sc.theme.hex.bg; x.fillRect(0, 0, w, hh);
      for (var i = 0; i < hostEl.children.length; i++) x.drawImage(hostEl.children[i], 0, 0);
      if (withKey) drawKeyOn(x, sc, w, hh);
      try { r.destroy(); } catch (e) { /* ignore */ } hostEl.remove(); resolve(c);
    }, function () { hostEl.remove(); resolve(null); });
  });
}
/** Runs fn(scene) with a picture that matches the data and settings now (built first if the data changed since the Map was last open), or says there is nothing to save. */
function withMap(fn) {
  ensureMap().then(function () {
    settleTurn();
    if (!S.scene) { toast('Nothing to save yet. Open the Map first.'); return; }
    fn(S.scene);
  });
}
function exportPng(scale, withKey) {
  withMap(function (sc) {
    var k = Math.min(scale, 6000 / Math.max(sc.w, sc.h)), w = Math.max(300, Math.round(sc.w * k)), hh = Math.max(300, Math.round(sc.h * k));
    sceneToCanvas(sc, w, hh, withKey).then(function (c) { if (!c) { toast('The picture could not be made.'); return; } c.toBlob(function (b) { if (b) download(fname('-' + S.V.view + '.png'), b); else toast('The picture could not be made.'); }, 'image/png'); });
  });
}
function renderExport() {
  var box = $('export-body'); if (!box) return;
  if (!S.graph.nodes.length) { mount(box, h('div', { class: 'card' }, [h('h2', null, 'Export'), h('p', { class: 'muted' }, 'Bring in data first.')])); return; }
  var needMap = !S.scene, pngScale = EXP.scale, key = EXP.key;
  var btn = function (label, fn, primary, off) { return h('button', { class: primary ? 'primary' : null, disabled: off, onclick: fn }, label); };
  mount(box, [
    h('div', { class: 'card' }, [h('h2', null, 'Data'), h('p', { class: 'muted small', style: { margin: 0 } }, 'Your data with all its columns, including calculated ones.'),
      h('div', { class: 'row' }, [btn('JSON (everything)', function () { download(fname('.json'), JSON.stringify({ name: S.graph.name, start: S.graph.start, flavor: S.graph.flavor, calc: S.graph.calc, roles: S.graph.roles, states: S.graph.states, nodes: S.graph.nodes, edges: S.graph.edges }, null, 1), 'application/json'); }), btn(cap(word('items')) + ' as CSV', function () { download(fname('-items.csv'), exportItemsCsv(), 'text/csv'); }), btn(cap(word('links')) + ' as CSV', function () { download(fname('-links.csv'), exportLinksCsv(), 'text/csv'); }), btn('Map file (.json.lfc)', function () { saveMapFile(); })]), h('p', { class: 'muted small', style: { margin: 0 } }, 'The map file keeps the data, the view and the finished picture in one small file. Drop it on the Data tab to open it.' + (MAPFILE.last ? ' ' + MAPFILE.last : ''))]),
    h('div', { class: 'card' }, [h('h2', null, 'Picture of the map'), h('p', { class: 'muted small', style: { margin: 0 } }, needMap ? 'Open the Map tab once first, so there is something to save.' : 'Exactly what the Map shows now, with your formatting.'),
      h('div', { class: 'row' }, [check('Include the key', key, function (on) { EXP.key = on; }),
        field('PNG size', select([[1, 'Normal'], [2, 'Sharp (2x)'], [3, 'Poster (3x)']], pngScale, function (v) { EXP.scale = +v; }))]),
      h('div', { class: 'row' }, [btn('PNG', function () { exportPng(EXP.scale, EXP.key); }, false, needMap), btn('SVG (grouped, small)', function () { saveSvg(true); }, false, needMap), btn('SVG (every item its own element)', function () { saveSvg(false); }, false, needMap), btn('Poster (print or PDF)', function () { printPoster(S.graph.name, ''); }, false, needMap)])]),
    gifCard(),
    h('div', { class: 'card' }, [h('h2', null, 'Reports and views'),
      h('div', { class: 'row' }, [btn('Data check report (Markdown)', function () { if (!CHK.res) { toast('Run the check first (Check tab).'); showTab('check'); return; } download(fname('-check.md'), NFMCheck.toMarkdown(CHK.res, S.graph), 'text/markdown'); }),
        btn('Saved views (JSON)', function () { download(fname('-views.json'), JSON.stringify({ name: S.graph.name, views: S.V.saved }, null, 1), 'application/json'); }, false, !S.V.saved.length),
        btn('This view as text to share', function () { copyText(encodeView(snapshot())); })])])
  ]);
}
var EXP = { scale: 2, key: true };
