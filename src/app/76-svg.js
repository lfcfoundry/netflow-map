/*
 * Netflow Map app, part 11: the grouped SVG. The editable SVG writes every link, item and label as its own element with all its styling repeated, which is over 120,000 elements (16 MB) for 30,000 items.
 * The grouped one puts elements with the same look into one group (links with the same color, width and fading share one path), so the file is a fraction of the size and an editor can open it.
 * Copyright (c) 2026 LFC Foundry. MIT License.
 */
var SVG_PATH = /^<path d="([^"]*)" (fill="none" stroke="[^"]*" stroke-width="[^"]*")((?: opacity="[^"]*")?)\/>$/;
var SVG_DOT = /^<circle cx="([^"]*)" cy="([^"]*)" r="([^"]*)" (fill="[^"]*" stroke="[^"]*" stroke-width="[^"]*"(?: opacity="[^"]*")?)\/>$/;
var SVG_TEXT = /^<text x="([^"]*)" y="([^"]*)" (font-size="[^"]*" text-anchor="[^"]*" fill="[^"]*"(?: font-weight="[^"]*")?(?: opacity="[^"]*")?)>(.*)<\/text>$/;
/** Takes the SVG text of the full export and returns the grouped one. Order of looks is kept as first seen; maxLabels (when given) keeps at most that many labels, in list order, and drops any label whose box overlaps one already kept. */
function groupSvg(svg, maxLabels, coarse) {
  var cut = coarse ? function (t) { return t.replace(/(\d+\.\d)\d+/g, '$1'); } : function (t) { return t; }, lines = svg.split('\n'), out = [], i = 0, kinds = [[SVG_PATH, 'p'], [SVG_DOT, 'c'], [SVG_TEXT, 't']];
  function kindOf(s) { for (var k = 0; k < 3; k++) { var m = kinds[k][0].exec(s); if (m) return [kinds[k][1], m]; } return null; }
  var taken = {};
  /** True when the label's box overlaps no label kept before it (and keeps the box when it fits): a grid of cells finds the neighbors without comparing every pair. */
  function roomFor(m) {
    var size = +/font-size="([^"]*)"/.exec(m[3])[1], mid = /text-anchor="([^"]*)"/.exec(m[3])[1], w = m[4].length * size * 0.55, x = +m[1], y = +m[2];
    var x0 = mid === 'start' ? x : mid === 'end' ? x - w : x - w / 2, x1 = x0 + w, y0 = y - size, y1 = y + size * 0.25, cx, cy, c, b, n;
    for (cx = Math.floor(x0 / 60); cx <= Math.floor(x1 / 60); cx++) for (cy = Math.floor(y0 / 60); cy <= Math.floor(y1 / 60); cy++) {
      c = taken[cx + ',' + cy];
      if (c) for (n = 0; n < c.length; n++) { b = c[n]; if (x0 < b[2] && x1 > b[0] && y0 < b[3] && y1 > b[1]) return false; }
    }
    b = [x0, y0, x1, y1];
    for (cx = Math.floor(x0 / 60); cx <= Math.floor(x1 / 60); cx++) for (cy = Math.floor(y0 / 60); cy <= Math.floor(y1 / 60); cy++) (taken[cx + ',' + cy] || (taken[cx + ',' + cy] = [])).push(b);
    return true;
  }
  while (i < lines.length) {
    var first = kindOf(lines[i]);
    if (!first) { out.push(lines[i++]); continue; }
    var kind = first[0], groups = {}, order = [], j = i, key, g, m, r, seen = 0;
    for (; j < lines.length; j++) {
      r = j === i ? first : kindOf(lines[j]);
      if (!r || r[0] !== kind) break;
      m = r[1];
      if (kind === 't' && maxLabels !== undefined && (seen >= maxLabels || !roomFor(m))) continue;
      if (kind === 't') seen++;
      key = kind === 'p' ? m[2] + m[3] : kind === 'c' ? m[4] : m[3];
      g = groups[key] || (groups[key] = { attrs: key, items: [] });
      if (!g.items.length) order.push(key);
      g.items.push(kind === 'p' ? cut(m[1]) : kind === 'c' ? '<circle cx="' + cut(m[1]) + '" cy="' + cut(m[2]) + '" r="' + cut(m[3]) + '"/>' : '<text x="' + cut(m[1]) + '" y="' + cut(m[2]) + '">' + m[4] + '</text>');
    }
    order.forEach(function (k) {
      var a = groups[k];
      if (kind === 'p') { for (var s = 0; s < a.items.length; s += 4000) out.push('<path d="' + a.items.slice(s, s + 4000).join('') + '" ' + a.attrs + '/>'); }
      else out.push('<g ' + a.attrs + '>' + a.items.join('') + '</g>');
    });
    i = j;
  }
  return out.join('\n');
}
/** For a big map the item labels are 11 units in a map thousands of units wide, which is a pile of specks when the whole map is on screen. This keeps the best connected items and sets their names large enough to read at that size (groupSvg then drops any that overlap). */
function bigMapLabels(sc) {
  var deg = {}, byText = {}, size = Math.round(sc.w / 80);
  S.graph.edges.forEach(function (e) { deg[e.from] = (deg[e.from] || 0) + 1; deg[e.to] = (deg[e.to] || 0) + 1; });
  S.graph.nodes.forEach(function (nd) { var t = String(nd.label || nd.id), d = deg[nd.id] || 0; if (!(byText[t] >= d)) byText[t] = d; });
  return sc.labels.filter(function (l) { return !l.bg && !l.rot; }).map(function (l) { return [byText[l.t] || 0, l]; }).sort(function (a, b) { return b[0] - a[0]; }).map(function (p) { return Object.assign({}, p[1], { size: size, y: p[1].y - size * 0.6, bold: true }); });
}
/** The SVG text of a scene: the full one, or the grouped one ({ svg, full } with the length of the full one). */
function svgText(sc, grouped) {
  var big = grouped && sc.dots.length > 5000, svg, full;
  if (big) sc = Object.assign({}, sc, { labels: bigMapLabels(sc) });
  svg = NFMScene.toSvg(sc, S.graph.name + ' (' + S.V.view + ')'); full = svg.length;
  if (grouped) {
    svg = groupSvg(svg, big ? 150 : undefined, big);
    if (big) svg = svg.replace(/ width="\d+" height="\d+" font-family/, ' font-family');   /* coordinates keep one decimal, finer than a pixel at this size; no fixed size, so a browser fits the whole map to the window */
  }
  return { svg: svg, full: full };
}
function saveSvg(grouped) {
  withMap(function (sc) {
    var t = performance.now(), r = svgText(sc, grouped), svg = r.svg;
    download(fname('-' + S.V.view + (grouped ? '-grouped' : '') + '.svg'), svg, 'image/svg+xml');
    toast('Saved the SVG: ' + (svg.length / 1048576 < 0.1 ? Math.round(svg.length / 1024) + ' KB' : (svg.length / 1048576).toFixed(1) + ' MB') + (grouped ? ' (the full one is ' + (r.full / 1048576).toFixed(1) + ' MB)' : '') + ' in ' + ((performance.now() - t) / 1000).toFixed(1) + ' s.', 5000);
  });
}
