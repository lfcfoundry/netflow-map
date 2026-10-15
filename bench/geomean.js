/* Copyright (c) 2026 JNFoo. MIT License. Overall scorecard: every head-to-head between our module and other software becomes one ratio
 * (other ÷ ours, so above 1 means we are better), and the geometric mean of the ratios says by how much on average.
 *   speed    time of the other / time of ours                           (all browsers, all areas)
 *   memory   memory held by the other / memory held by ours             (Chromium heap; Firefox gives no heap number)
 *   truth    layout score of the other / ours (lower score is truer); layered crossings; found-group match (ours / other)
 * Each comparison counts once. Comparisons where both times are under 3 ms are left out (below Firefox's timer resolution).
 *   node bench/geomean.js            prints markdown;   node bench/geomean.js --json   prints the list of comparisons */
'use strict';
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, 'results');
const load = (n) => { const f = path.join(dir, n + '.jsonl'); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []; };
const C = [];   // { area, metric, browser, label, vs, ours, other, ratio }
let dropped = 0;
function add(area, metric, browser, label, vs, ours, other, higherIsBetter) {
  if (ours === undefined || other === undefined || ours === null || other === null || !(ours > 0) || !(other > 0)) return;
  if (metric === 'speed' && ours < 3 && other < 3) { dropped++; return; }
  C.push({ area, metric, browser, label, vs, ours, other, ratio: higherIsBetter ? ours / other : other / ours });
}
for (const b of ['chromium', 'firefox']) {
  const csv = load(b + '-csv');
  csv.filter((r) => r.suite === 'csvGrid' && r.ok).forEach((r) => { const a = r.args, lbl = `${a.rows} rows, ${a.cols} cols, quoted ${a.quoted}, len ${a.len}, breaks ${a.multiline}${a.delim ? ', delim ' + JSON.stringify(a.delim) : ''}`; add('CSV parsing', 'speed', b, lbl, 'Papa Parse', r.ok.ours, r.ok.papa); add('CSV parsing', 'speed', b, lbl, 'd3-dsv', r.ok.ours, r.ok.d3); });
  csv.filter((r) => r.suite === 'csvKind' && r.ok && !r.ok.error).forEach((r) => { const lbl = `${r.ok.kind} ${r.ok.rows} rows`; add('CSV parsing', 'speed', b, lbl, 'Papa Parse', r.ok.ours, r.ok.papa); add('CSV parsing', 'speed', b, lbl, 'd3-dsv', r.ok.ours, r.ok.d3); });
  load(b + '-stress').filter((r) => r.ok && r.ok.n).forEach((r) => {
    const o = r.ok, lbl = `${o.kind} ${o.n} items`;
    [['Stress layout', o.ours_stress], ['Force layout', o.ours_force]].forEach(([area, mine]) => {
      add(area, 'speed', b, lbl, 'd3-force', mine.ms, o.d3force.ms); add(area, 'speed', b, lbl, 'ForceAtlas2', mine.ms, o.forceatlas2.ms);
      add(area + ' truth', 'truth', b, lbl, 'd3-force', mine.stress, o.d3force.stress); add(area + ' truth', 'truth', b, lbl, 'ForceAtlas2', mine.stress, o.forceatlas2.stress);
    });
  });
  const cmp = load(b + '-compare');
  cmp.filter((r) => r.suite === 'layered' && r.ok).forEach((r) => { const o = r.ok, lbl = `${o.n} items`; if (o.dagre) { add('Layered drawing', 'speed', b, lbl, 'dagre', o.ours.ms, o.dagre.ms); add('Layered drawing truth', 'truth', b, lbl, 'dagre (crossings)', o.ours.cross, o.dagre.cross); } if (o.elk) { add('Layered drawing', 'speed', b, lbl, 'ELK', o.ours.ms, o.elk.ms); add('Layered drawing truth', 'truth', b, lbl, 'ELK (crossings)', o.ours.cross, o.elk.cross); } });
  cmp.filter((r) => r.suite === 'groups' && r.ok && r.ok.louvain).forEach((r) => { const o = r.ok, lbl = `${o.n} items`; add('Found groups', 'speed', b, lbl, 'Louvain', o.ours.ms, o.louvain.ms); add('Found groups truth', 'truth', b, lbl, 'Louvain (match)', o.ours.nmi, o.louvain.nmi, true); });
  cmp.filter((r) => r.suite === 'draws' && r.ok).forEach((r) => Object.keys(r.ok).forEach((k) => { const d = r.ok[k]; add('Random draws', 'speed', b, k, 'd3-random', d.ours.ms, d.d3 && d.d3.ms); add('Random draws', 'speed', b, k, 'jStat', d.ours.ms, d.jstat && d.jstat.ms); }));
  cmp.filter((r) => r.suite === 'formula' && r.ok).forEach((r) => add('Formulas', 'speed', b, `${r.ok.rows} rows`, 'expr-eval', r.ok.ours, r.ok.exprEval));
  cmp.filter((r) => r.suite === 'gif' && r.ok).forEach((r) => add('GIF export', 'speed', b, `${r.ok.frames} frames`, 'gifenc', r.ok.ours.ms, r.ok.gifenc_shared_palette.ms));
  cmp.filter((r) => r.suite === 'gif' && r.ok).forEach((r) => add('GIF export', 'memory', b, `${r.ok.frames} frames file size`, 'gifenc', r.ok.ours.bytes, r.ok.gifenc_shared_palette.bytes));
  cmp.filter((r) => r.suite === 'gif' && r.ok && r.ok.ours.mse > 0 && r.ok.gifenc_shared_palette.mse > 0).forEach((r) => add('GIF export truth', 'truth', b, `${r.ok.frames} frames color error`, 'gifenc', r.ok.ours.mse, r.ok.gifenc_shared_palette.mse));   // mean squared color error of the decoded animation, lower is truer
  if (b === 'chromium') {
    const mem = (what) => { const r = cmp.find((x) => x.suite === 'memory' && x.args.what === what && x.ok); return r && r.ok.heapMB; };
    add('Network memory', 'memory', b, '10,000 items held', 'graphology', mem('prepare'), mem('graphology'));
    add('Network memory', 'memory', b, '10,000 items held', 'Cytoscape', mem('prepare'), mem('cytoscape'));
  }
}
// first place: in one benchmark row (same browser, same data) our entry beats every other entry in the row
function firstPlaces(list) {
  const rows = new Map();
  list.forEach((c) => { const k = c.browser + '|' + c.area + '|' + c.label; if (!rows.has(k)) rows.set(k, []); rows.get(k).push(c.ratio); });
  let first = 0; rows.forEach((rs) => { if (rs.every((r) => r > 1.03)) first++; });
  return { first, rows: rows.size };
}
const gm = (xs) => xs.length ? Math.exp(xs.reduce((s, x) => s + Math.log(x), 0) / xs.length) : NaN;
const fx = (x) => isNaN(x) ? '–' : x >= 10 ? x.toFixed(1) + '×' : x.toFixed(2) + '×';
const wins = (xs) => xs.filter((x) => x > 1.03).length, ties = (xs) => xs.filter((x) => x >= 1 / 1.03 && x <= 1.03).length, loss = (xs) => xs.filter((x) => x < 1 / 1.03).length;
const row = (name, list) => { const r = list.map((c) => c.ratio); return `| ${name} | ${list.length} | ${wins(r)} / ${ties(r)} / ${loss(r)} | ${fx(gm(r))} |`; };
const head = '| | comparisons | wins / ties / losses | geometric mean (other ÷ ours) |\n| --- | ---: | ---: | ---: |';
if (process.argv.includes('--json')) { console.log(JSON.stringify(C)); process.exit(0); }
const speed = C.filter((c) => c.metric === 'speed'), all = C;
const out = [];
out.push(`**Overall** (a ratio above 1 means our module is better; a win is a ratio over 1.03, a tie is within 3%)\n\n${head}\n${row('Speed only, both browsers', speed)}\n${row('Speed only, Chromium 154', speed.filter((c) => c.browser === 'chromium'))}\n${row('Speed only, Firefox 158', speed.filter((c) => c.browser === 'firefox'))}\n${row('Speed + memory + layout truth, both browsers', all)}\n${row('Speed + memory + layout truth, Chromium 154', all.filter((c) => c.browser === 'chromium'))}\n${row('Speed + memory + layout truth, Firefox 158', all.filter((c) => c.browser === 'firefox'))}`);
const fpAll = firstPlaces(speed), fpC = firstPlaces(speed.filter((c) => c.browser === 'chromium')), fpF = firstPlaces(speed.filter((c) => c.browser === 'firefox'));
out.push(`**First places on speed:** one benchmark row is one data set in one browser (for example Stress at 3,000 complex items in Firefox, against d3-force and ForceAtlas2 together). We come first, ahead of every competitor in the row, in ${fpAll.first} of ${fpAll.rows} rows (Chromium ${fpC.first} of ${fpC.rows}, Firefox ${fpF.first} of ${fpF.rows}).`);
const areas = [...new Set(C.map((c) => c.area))];
out.push(`**By area** (both browsers, all metrics in the area)\n\n${head}\n${areas.map((a) => row(a, C.filter((c) => c.area === a))).join('\n')}`);
const vss = [...new Set(C.map((c) => c.vs))];
out.push(`**By competitor** (all areas and metrics)\n\n${head}\n${vss.map((v) => row(v, C.filter((c) => c.vs === v))).join('\n')}`);
// the same mean with each area counted once (so the 168 CSV and layout rows cannot outvote the 3 formula rows)
const areaMeans = areas.map((a) => gm(C.filter((c) => c.area === a).map((c) => c.ratio)));
out.push(`**Each area counted once:** the geometric mean of the ${areas.length} area means is ${fx(gm(areaMeans))}. Left out as below timer resolution: ${dropped} comparisons.`);
console.log(out.join('\n\n'));
