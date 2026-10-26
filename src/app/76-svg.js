/*
 * Netflow Map app, part 11: the grouped SVG. The editable SVG writes every link, item and label as its own element with all its styling repeated, which is over 120,000 elements (16 MB) for 30,000 items.
 * The grouped one puts elements with the same look into one group (links with the same color, width and fading share one path), so the file is a fraction of the size and an editor can open it.
 * Copyright (c) 2026 LFC Foundry. MIT License.
 */
var SVG_PATH = /^<path d="([^"]*)" (fill="none" stroke="[^"]*" stroke-width="[^"]*")((?: opacity="[^"]*")?)\/>$/;
var SVG_DOT = /^<circle cx="([^"]*)" cy="([^"]*)" r="([^"]*)" (fill="[^"]*" stroke="[^"]*" stroke-width="[^"]*"(?: opacity="[^"]*")?)\/>$/;
var SVG_TEXT = /^<text x="([^"]*)" y="([^"]*)" (font-size="[^"]*" text-anchor="[^"]*" fill="[^"]*"(?: font-weight="[^"]*")?(?: opacity="[^"]*")?)>(.*)<\/text>$/;
/** Takes the SVG text of the full export and returns the grouped one. Order of looks is kept as first seen; maxLabels (when given) keeps the first labels only, which are the ones the map shows first. */
function groupSvg(svg, maxLabels, coarse) {
  var cut = coarse ? function (t) { return t.replace(/(\d+\.\d)\d+/g, '$1'); } : function (t) { return t; }, lines = svg.split('\n'), out = [], i = 0, kinds = [[SVG_PATH, 'p'], [SVG_DOT, 'c'], [SVG_TEXT, 't']];
  function kindOf(s) { for (var k = 0; k < 3; k++) { var m = kinds[k][0].exec(s); if (m) return [kinds[k][1], m]; } return null; }
  while (i < lines.length) {
    var first = kindOf(lines[i]);
    if (!first) { out.push(lines[i++]); continue; }
    var kind = first[0], groups = {}, order = [], j = i, key, g, m, r, seen = 0;
    for (; j < lines.length; j++) {
      r = j === i ? first : kindOf(lines[j]);
      if (!r || r[0] !== kind) break;
      m = r[1];
      if (kind === 't' && maxLabels !== undefined && ++seen > maxLabels) continue;
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
function saveSvg(grouped) {
  withMap(function (sc) {
    var t = performance.now(), svg = NFMScene.toSvg(sc, S.graph.name + ' (' + S.V.view + ')'), full = svg.length;
    if (grouped) {
      var big = sc.dots.length > 5000;
      svg = groupSvg(svg, big ? 600 : undefined, big);
      if (big) svg = svg.replace(/ width="\d+" height="\d+" font-family/, ' font-family');   /* coordinates keep one decimal, finer than a pixel at this size; no fixed size, so a browser fits the whole map to the window */
    }
    download(fname('-' + S.V.view + (grouped ? '-grouped' : '') + '.svg'), svg, 'image/svg+xml');
    toast('Saved the SVG: ' + (svg.length / 1048576 < 0.1 ? Math.round(svg.length / 1024) + ' KB' : (svg.length / 1048576).toFixed(1) + ' MB') + (grouped ? ' (the full one is ' + (full / 1048576).toFixed(1) + ' MB)' : '') + ' in ' + ((performance.now() - t) / 1000).toFixed(1) + ' s.', 5000);
  });
}
