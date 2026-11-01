/*!
 * Netflow Map app, part 5b: the Charts tab (bars, lines, pie and more from the table's columns, drawn by src/plot.js). Copyright (c) 2026 LFC Foundry. MIT License.
 */
var CHT = { r: null, rP: null, scene: null, view: null, key: '' };
var CHART_DEFAULT = { rows: 'nodes', rowsPicked: false, type: 'bar', x: '', y: '', color: '', size: '', agg: 'sum', stack: 'stack', horizontal: false, sort: 'value', smooth: 0, index: false, bins: 0, cols: [] };
function chartSpec() { var c = S.V.chart; if (!c || typeof c !== 'object') c = S.V.chart = Object.assign({}, CHART_DEFAULT); Object.keys(CHART_DEFAULT).forEach(function (k) { if (c[k] === undefined) c[k] = Array.isArray(CHART_DEFAULT[k]) ? [] : CHART_DEFAULT[k]; }); return c; }
/** The columns of items or links with what kind each is (built-in ones first). */
function chartCols(rows) {
  var list = (rows === 'edges' ? S.prof.edges : S.prof.nodes) || [], out = [];
  list.forEach(function (c) { out.push({ key: c.key, name: c.name || c.key, kind: c.kind === 'number' ? 'num' : c.kind === 'date' ? 'date' : c.kind === 'category' ? 'cat' : 'text' }); });
  if (rows === 'edges') { out.unshift({ key: 'to', name: 'To', kind: 'text' }); out.unshift({ key: 'from', name: 'From', kind: 'text' }); }
  else {
    if (!out.some(function (x) { return x.key === 'group'; }) && S.graph.nodes.some(function (n) { return n.group != null && n.group !== ''; })) out.unshift({ key: 'group', name: word('Group'), kind: 'cat' });
    out.unshift({ key: 'id', name: 'Item', kind: 'text' });
  }
  if (rows === 'edges' && !out.some(function (x) { return x.key === 'weight'; })) out.push({ key: 'weight', name: 'Amount', kind: 'num' });
  return out;
}
function chartRows(rows) { return rows === 'edges' ? S.graph.edges : S.graph.nodes; }
/** Sensible columns for a chart type, from what the table has. */
function chartFill(c) {
  if (!c.rowsPicked) {   /* until Rows is picked by hand: the rows that have number columns (a flat table often comes in as links) */
    var numsIn = function (l) { return (l || []).some(function (x) { return x.kind === 'number' || x.kind === 'date'; }); };
    var want = numsIn(S.prof.nodes) || !numsIn(S.prof.edges) ? 'nodes' : 'edges'; if (want !== c.rows) { c.rows = want; c.x = c.y = c.color = c.size = ''; c.cols = []; }
  }
  var cols = chartCols(c.rows), need = NFMPlot.NEEDS[c.type] || {}, nums = cols.filter(function (x) { return x.kind === 'num'; }), cats = cols.filter(function (x) { return x.kind === 'cat'; }), dates = cols.filter(function (x) { return x.kind === 'date'; }), texts = cols.filter(function (x) { return x.kind === 'text' && x.key !== 'id'; });
  var has = function (k) { return cols.some(function (x) { return x.key === k; }); };
  var pick = function (want, avoid) { var l = want === 'num' ? dates.concat(nums) : want === 'cat' ? cats.concat(texts) : want === 'text' ? texts.concat(cats) : cols; l = l.filter(function (x) { return x.key !== avoid; }); return l.length ? l[0].key : ''; };
  var xAuto = !has(c.x); if (xAuto && need.x) c.x = need.x === 'num' ? (dates[0] || nums[0] || {}).key || '' : pick(need.x.replace('?', ''));
  if (xAuto) {   /* a few types want a better column than the first that fits */
    var avgLen = function (k) { var rs = chartRows(c.rows), n = Math.min(rs.length, 300), t = 0; for (var i = 0; i < n; i++) { var v = chartGet(rs[i], k); t += v == null ? 0 : String(v).length; } return n ? t / n : 0; };
    if (c.type === 'words') { var best = '', bl = 0; texts.concat(cats).forEach(function (x) { var l = avgLen(x.key); if (l > bl) { bl = l; best = x.key; } }); if (best) c.x = best; }
    else if (c.type === 'heat' && dates.length) c.x = dates[0].key;
    else if (c.type === 'qq' && nums.length) c.x = nums[0].key;
  }
  if (need.y && !has(c.y)) c.y = need.y === 'num' || need.y === 'num?' ? ((nums.filter(function (x) { return x.key !== c.x; })[0]) || {}).key || '' : '';
  if (need.color === 'cat' && !has(c.color)) c.color = pick('cat', c.x);
  if (need.cols && (!c.cols || c.cols.length < 2)) c.cols = nums.slice(0, 4).map(function (x) { return x.key; });
  return c;
}
function chartGet(r, k) {
  if (k === 'id' || k === 'label' || k === 'group' || k === 'from' || k === 'to' || k === 'weight' || k === 'kind' || k === 'valence') { var v = r[k]; return k === 'label' && v === undefined ? r.id : v; }
  var a = r.attrs; return a && Object.prototype.hasOwnProperty.call(a, k) ? a[k] : undefined;
}
function renderChartSide() {
  var side = $('charts-side'); if (!side) return; clear(side);
  var c = chartFill(chartSpec()), need = NFMPlot.NEEDS[c.type] || {}, cols = chartCols(c.rows);
  var colSel = function (label, key, kind, optional) {
    var opts = (optional ? [['', '(none)']] : []).concat(cols.filter(function (x) { return !kind || kind === 'any' || (kind === 'num' ? x.kind === 'num' || x.kind === 'date' : kind === 'cat' ? x.kind === 'cat' || x.kind === 'text' : kind === 'text' ? x.kind === 'text' || x.kind === 'cat' : true); }).map(function (x) { return [x.key, x.name + (x.kind === 'date' ? ' (date)' : '')]; }));
    return field(label, select(opts, c[key] || '', function (v) { c[key] = v; saveView(); drawChart(true); renderChartSide(); }));
  };
  var kids = [];
  kids.push(field('Rows', seg([['nodes', word('Items')], ['edges', 'Links']], c.rows, function (v) { c.rows = v; c.rowsPicked = true; c.x = c.y = c.color = c.size = ''; c.cols = []; chartFill(c); saveView(); renderChartSide(); drawChart(true); })));
  kids.push(field('Chart', select(NFMPlot.TYPES.map(function (t) { return [t[0], t[1]]; }), c.type, function (v) { c.type = v; chartFill(c); saveView(); renderChartSide(); drawChart(true); })));
  kids.push(h('p', { class: 'muted small', style: { margin: 0 } }, (NFMPlot.TYPES.filter(function (t) { return t[0] === c.type; })[0] || [])[2] || ''));
  var kindOf = function (s) { return s ? s.replace('?', '').replace('+', '') : ''; };
  if (need.x) kids.push(colSel(c.type === 'box' ? 'Split by' : c.type === 'words' ? 'Text column' : need.x === 'num' ? 'Along (x)' : 'Categories', 'x', kindOf(need.x), /\?/.test(need.x)));
  if (need.y) kids.push(colSel(c.type === 'box' || c.type === 'scatter' || c.type === 'hexbin' || c.type === 'connected' || c.type === 'voronoi' ? 'Up (y)' : 'Value', 'y', 'num', /\?/.test(need.y)));
  if (need.cols) {
    var nums = cols.filter(function (x) { return x.kind === 'num' || x.kind === 'date'; });
    kids.push(h('div', { class: 'field' }, [h('span', null, 'Number columns')].concat(nums.map(function (x) {
      var on = (c.cols || []).indexOf(x.key) >= 0;
      return h('label', { class: 'row tight' }, [h('input', { type: 'checkbox', checked: on, onchange: function (e) { var l = (c.cols || []).filter(function (k) { return k !== x.key; }); if (e.target.checked) l.push(x.key); c.cols = l; saveView(); drawChart(true); } }), h('span', null, x.name)]);
    }))));
  }
  if (need.color) kids.push(colSel(c.type === 'heat' ? 'Down (rows)' : c.type === 'ridgeline' ? 'One curve per' : 'Color by', 'color', 'cat', /\?/.test(need.color)));
  if (need.size) kids.push(colSel('Dot size', 'size', 'num', true));
  if (need.agg && c.y) kids.push(field('Combine values', select([['sum', 'Total'], ['mean', 'Average'], ['median', 'Middle (median)'], ['min', 'Lowest'], ['max', 'Highest'], ['count', 'Count of rows']], c.agg, function (v) { c.agg = v; saveView(); drawChart(true); })));
  if (need.stack && c.color) kids.push(field('Several colors', seg(c.type === 'area' ? [['stack', 'Stacked'], ['normalize', 'Shares'], ['stream', 'Stream'], ['none', 'Overlapping']] : [['stack', 'Stacked'], ['group', 'Side by side'], ['normalize', 'Shares']], c.stack, function (v) { c.stack = v; saveView(); drawChart(true); })));
  if (need.horizontal) kids.push(field('Bars', seg([['up', 'Upright'], ['side', 'Sideways']], c.horizontal ? 'side' : 'up', function (v) { c.horizontal = v === 'side'; saveView(); drawChart(true); })));
  if (need.sort) kids.push(field('Order', seg([['value', 'Biggest first'], ['name', 'By name'], ['none', 'As in the table']], c.sort, function (v) { c.sort = v; saveView(); drawChart(true); })));
  if (need.smooth) kids.push(field('Smooth over', select([['0', 'No smoothing'], ['3', '3 points'], ['7', '7 points'], ['30', '30 points']], String(c.smooth || 0), function (v) { c.smooth = Number(v); saveView(); drawChart(true); }), 'A moving average: each point becomes the average of the last few.'));
  if (need.index) kids.push(field('Scale', seg([['abs', 'Values'], ['idx', 'From 100']], c.index ? 'idx' : 'abs', function (v) { c.index = v === 'idx'; saveView(); drawChart(true); }), 'From 100 starts every line at 100, to compare growth.'));
  if (need.bins) kids.push(field('Bins', select([['0', 'Auto'], ['10', '10'], ['20', '20'], ['40', '40'], ['80', '80']], String(c.bins || 0), function (v) { c.bins = Number(v); saveView(); drawChart(true); })));
  kids.push(h('div', { class: 'row tight' }, [h('button', { class: 'sm', onclick: function () { if (CHT.scene) download(fname('-chart.svg'), NFMScene.toSvg(CHT.scene, S.graph.name || 'Chart'), 'image/svg+xml'); } }, 'Save as SVG')]));
  kids.push(h('p', { class: 'muted small', id: 'charts-note', style: { margin: 0 } }, ''));
  kids.forEach(function (k) { side.appendChild(k); });
}
function chartSize() { var st = $('charts-stage'); return st ? [Math.max(200, st.clientWidth), Math.max(200, st.clientHeight)] : [900, 560]; }
function drawChart(rebuild) {
  var host = $('charts-host'); if (!host || S.tab !== 'charts') return;
  var c = chartFill(chartSpec()), wh = chartSize(), key = [S.gver, themeName(), S.V.palette, JSON.stringify(c), wh[0], wh[1]].join('|');
  if (rebuild || key !== CHT.key || !CHT.scene) {
    CHT.key = key;
    CHT.scene = NFMPlot.make(chartRows(c.rows), c, { width: wh[0], height: wh[1], theme: themeName(), palette: S.V.palette, get: chartGet }, NFMScene);
    var note = $('charts-note'); if (note) note.textContent = nfmt(chartRows(c.rows).length) + ' rows, drawn in ' + Math.round(CHT.scene.ms) + ' ms.';
  }
  var go = function (r) { r.setScene(CHT.scene); r.resize(wh[0], wh[1], window.devicePixelRatio || 1); r.draw({ k: 1, tx: -CHT.scene.x0 - 10, ty: -CHT.scene.y0 - 10 }); };
  if (CHT.r) { go(CHT.r); return; }
  if (!CHT.rP) CHT.rP = new Promise(function (ok) { ok(NFMRender.createWebGL2(host, {})); }).catch(function () { clear(host); return NFMRender.createCanvas2D(host, {}); }).then(function (r) { CHT.r = r; return r; });
  CHT.rP.then(function () { drawChart(false); });
}
TAB_HOOKS.charts = function () {
  renderChartSide();
  requestAnimationFrame(function () { drawChart(false); });
};
HOOKS.graph.push(function () { if (S.tab === 'charts') { renderChartSide(); drawChart(true); } });
(function () {
  var st = $('charts-stage'), tip = $('charts-tip'); if (!st) return;
  st.addEventListener('pointermove', function (e) {
    if (!CHT.scene) return; var b = st.getBoundingClientRect(), x = e.clientX - b.left + CHT.scene.x0 + 10, y = e.clientY - b.top + CHT.scene.y0 + 10, m = NFMPlot.markAt(CHT.scene, x, y);
    if (!m) { tip.hidden = true; return; }
    tip.hidden = false; tip.textContent = m.t || ''; tip.style.left = Math.min(b.width - 200, e.clientX - b.left + 14) + 'px'; tip.style.top = (e.clientY - b.top + 14) + 'px';
  });
  st.addEventListener('pointerleave', function () { tip.hidden = true; });
  new ResizeObserver(function () { if (S.tab === 'charts') drawChart(false); }).observe(st);
})();
