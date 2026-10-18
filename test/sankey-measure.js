/* Copyright (c) 2026 LFC Foundry. MIT License. The yardstick for Sankey pictures (tests and the before-and-after lab): counts crossings, bars crossed, band width spread and bend of any picture, old or new.
   It lived in the app's own Sankey file; the app now uses the JS-modules netflow-sankey (vendor/netflow-sankey.js), which has no yardstick, so it stays here. */
(function () {
'use strict';
var EPS = 1e-9;
/* ---------------------------------------------------------------- the yardstick (same for the old and the new picture) */
function centerline(b, n) { var pts = [], t, m0 = (b.y0a + b.y0b) / 2, m1 = (b.y1a + b.y1b) / 2; for (var q = 0; q <= n; q++) { t = q / n; var s = 1 - t; pts.push([s * s * s * b.x0 + 3 * s * s * t * b.xm + 3 * s * t * t * b.xm + t * t * t * b.x1, s * s * s * m0 + 3 * s * s * t * m0 + 3 * s * t * t * m1 + t * t * t * m1]); } return pts; }
function segCross(p, q, r, s) {
  var d1x = q[0] - p[0], d1y = q[1] - p[1], d2x = s[0] - r[0], d2y = s[1] - r[1], den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < 1e-12) return false;
  var t = ((r[0] - p[0]) * d2y - (r[1] - p[1]) * d2x) / den, u = ((r[0] - p[0]) * d1y - (r[1] - p[1]) * d1x) / den;
  return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999;
}
/**
 * measure(g, edgeFlow, only): only (optional Set of edge indexes) limits the count to those links, so two pictures that draw different links can be compared fairly. g = { bands, loops (optional), nodes: [{id, x, y, w, h}], height, width }.
 * Returns { crossings, crossingWeight (percent of the most it could be: sum of flow*flow over crossing pairs / total flow squared), nodeHits (links drawn over an item they do not touch),
 *           widthSpread (thickest per unit flow / thinnest per unit flow: 1 means every band is as thick as its flow), drawnShare (share of the flow that is drawn as a band),
 *           bend (flow-weighted average rise or fall of a band as a share of the picture height) }.
 */
function measure(g, edgeFlow, only) {
  var bands = only ? g.bands.filter(function (b) { return only.has(b.edge); }) : g.bands, N = 16, lines = bands.map(function (b) { return centerline(b, N); }), nCross = 0, wCross = 0, totalFlow = 0, i, j, a, b, q, r;
  var flowOf = function (ei) { return edgeFlow(ei); }, seen = {};
  bands.forEach(function (bd) { if (!seen[bd.edge]) { seen[bd.edge] = 1; totalFlow += flowOf(bd.edge); } });
  var allFlow = totalFlow + (g.loops || []).reduce(function (s, l) { return s + flowOf(l.edge); }, 0) + (g.undrawn || 0);
  for (i = 0; i < bands.length; i++) for (j = i + 1; j < bands.length; j++) {
    if (bands[i].edge === bands[j].edge) continue;
    a = bands[i]; b = bands[j]; if (a.x1 <= b.x0 || b.x1 <= a.x0) continue;
    var hit = false;
    for (q = 0; q < N && !hit; q++) for (r = 0; r < N && !hit; r++) if (segCross(lines[i][q], lines[i][q + 1], lines[j][r], lines[j][r + 1])) hit = true;
    if (hit) { nCross++; wCross += flowOf(a.edge) * flowOf(b.edge); }
  }
  var hits = {};
  g.nodes.forEach(function (n) {
    bands.forEach(function (bd, bi) {
      var e = bd.edge; if (bd.from === n.id || bd.to === n.id) return;
      var ln = lines[bi];
      for (var p = 0; p < ln.length; p++) { var pt = ln[p]; if (pt[0] > n.x + 1 && pt[0] < n.x + n.w - 1 && pt[1] > n.y + 1 && pt[1] < n.y + n.h - 1) { hits[e + ':' + n.id] = 1; break; }
        if (p + 1 < ln.length && n.w > 0) { /* a long band can jump over a narrow bar between two samples */ var nx = ln[p + 1]; if ((pt[0] < n.x + n.w / 2) !== (nx[0] < n.x + n.w / 2)) { var tt = (n.x + n.w / 2 - pt[0]) / ((nx[0] - pt[0]) || 1e-9), yy = pt[1] + tt * (nx[1] - pt[1]); if (yy > n.y + 1 && yy < n.y + n.h - 1) { hits[e + ':' + n.id] = 1; break; } } } }
    });
  });
  var lo = Infinity, hi = 0; bands.forEach(function (bd) { var fl = flowOf(bd.edge), tk = ((bd.y0b - bd.y0a) + (bd.y1b - bd.y1a)) / 2; if (fl > EPS && tk > 0.81) { var t = tk / fl; lo = Math.min(lo, t); hi = Math.max(hi, t); } });
  var bend = 0, bw = 0; bands.forEach(function (bd) { var fl = flowOf(bd.edge); bend += fl * Math.abs((bd.y1a + bd.y1b) / 2 - (bd.y0a + bd.y0b) / 2); bw += fl; });
  var drawn = seen, drawnFlow = totalFlow + (g.loops || []).reduce(function (s, l) { return s + flowOf(l.edge); }, 0);
  return { crossings: nCross, crossingWeight: totalFlow > 0 ? 100 * wCross / (totalFlow * totalFlow) : 0, nodeHits: Object.keys(hits).length, widthSpread: isFinite(lo) && lo > 0 ? hi / lo : 1, drawnShare: allFlow > 0 ? drawnFlow / allFlow : 1, bend: bw > 0 && g.height ? bend / bw / g.height : 0, height: g.height, width: g.width, drawn: Object.keys(drawn).length };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { measure: measure }; else this.NFMSankeyMeasure = { measure: measure };
}).call(typeof self !== 'undefined' ? self : this);
