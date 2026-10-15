/* Copyright (c) 2026 JNFoo. MIT License. Turns bench/results/*.jsonl into the tables of docs/BENCHMARKS.md.
 * node bench/report.js            prints the markdown tables (the narrative around them is written by hand in docs/BENCHMARKS.md)
 * node bench/report.js <section>  csv | csvkind | stress | typed | limits | compare */
'use strict';
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, 'results');
const load = (name) => { const f = path.join(dir, name + '.jsonl'); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []; };
const BR = ['chromium', 'firefox'], BN = { chromium: 'Chromium 154', firefox: 'Firefox 158' };
const f0 = (x) => x === undefined || x === null ? '–' : x >= 100 ? Math.round(x).toLocaleString('en-US') : x >= 10 ? x.toFixed(0) : x.toFixed(1);
const sec = (ms) => ms === undefined || ms === null ? '–' : ms >= 10000 ? (ms / 1000).toFixed(0) + ' s' : ms >= 1000 ? (ms / 1000).toFixed(1) + ' s' : f0(ms) + ' ms';
const table = (head, rows) => ['| ' + head.join(' | ') + ' |', '| ' + head.map((h, i) => i === 0 ? '---' : '---:').join(' | ') + ' |'].concat(rows.map((r) => '| ' + r.join(' | ') + ' |')).join('\n');
const ratio = (a, b) => a && b ? (a / b).toFixed(2) + '×' : '–';
const sections = {
  csv() {
    const out = [];
    for (const b of BR) {
      const rows = load(b + '-csv').filter((r) => r.suite === 'csvGrid' && r.ok).map((r) => { const a = r.args, o = r.ok; return [a.rows.toLocaleString('en-US'), a.cols, a.quoted, a.len, a.multiline, (a.delim || ',').replace('\t', 'tab'), sec(o.ours), sec(o.papa), sec(o.d3), ratio(o.ours, o.papa)]; });
      out.push('**' + BN[b] + '**\n\n' + table(['rows', 'cols', 'share quoted', 'field length', 'share with line breaks', 'delimiter', 'ours', 'Papa Parse', 'd3-dsv', 'ours ÷ Papa'], rows));
    }
    return out.join('\n\n');
  },
  csvbefore() {   // the reader as it was (first benchmark run) against now, same files
    const out = [];
    for (const b of BR) {
      const was = load(b + '-csv-before').filter((r) => r.suite === 'csvGrid' && r.ok), now = load(b + '-csv').filter((r) => r.suite === 'csvGrid' && r.ok), rows = [];
      const seen = new Set();
      for (const r of now) {
        const a = r.args; if (a.rows !== 50000 || a.delim || (a.cols !== 6) || (a.multiline && a.multiline > 0.05)) continue; const sk = a.quoted + '|' + a.len + '|' + a.multiline; if (seen.has(sk)) continue; seen.add(sk);
        const o = was.find((x) => JSON.stringify(Object.assign({}, x.args, { check: 0 })) === JSON.stringify(Object.assign({}, a, { check: 0 })));
        if (o) rows.push(['quoted ' + a.quoted + ', field length ' + a.len, sec(o.ok.ours), sec(r.ok.ours), sec(r.ok.papa), sec(r.ok.d3), ratio(o.ok.ours, r.ok.ours)]);
      }
      out.push('**' + BN[b] + '** (50,000 rows, 6 columns)\n\n' + table(['data', 'ours: first version', 'ours: now', 'Papa Parse', 'd3-dsv', 'speedup'], rows));
    }
    return out.join('\n\n');
  },
  csvkind() {
    const out = [];
    for (const b of BR) {
      const rows = load(b + '-csv').filter((r) => r.suite === 'csvKind' && r.ok && !r.ok.error).map((r) => { const o = r.ok; return [o.kind, o.rows.toLocaleString('en-US'), o.MB + ' MB', sec(o.ours), sec(o.papa), sec(o.d3), ratio(o.ours, o.papa), sec(o.import), o.items.toLocaleString('en-US')]; });
      out.push('**' + BN[b] + '**\n\n' + table(['structure', 'rows', 'size', 'ours: parse', 'Papa Parse', 'd3-dsv', 'ours ÷ Papa', 'ours: full import into a graph', 'items'], rows));
    }
    return out.join('\n\n');
  },
  stress() {
    const out = [];
    for (const b of BR) {
      const rows = load(b + '-stress').filter((r) => r.ok && r.ok.n).map((r) => { const o = r.ok, c = (x) => x ? sec(x.ms) + ' / ' + x.stress.toFixed(3) : '–'; return [o.kind, o.n.toLocaleString('en-US'), c(o.ours_stress), c(o.before_stress), c(o.ours_force), c(o.d3force), c(o.forceatlas2)]; });
      out.push('**' + BN[b] + '** (time / layout score, lower score = truer)\n\n' + table(['structure', 'items', 'Stress (now)', 'Stress (before)', 'Force', 'd3-force', 'ForceAtlas2'], rows));
    }
    return out.join('\n\n');
  },
  typed() {
    const out = [];
    for (const b of BR) {
      const L = load(b + '-typed');
      const ps = L.filter((r) => r.suite === 'pairStore' && r.ok).map((r) => { const o = r.ok; return [o.k, o.pairs.toLocaleString('en-US'), o.variant, sec(o.buildMs), sec(o.sgdMs), o.nsPerUpdate + ' ns', o.heapMB === null ? '–' : o.heapMB + ' MB']; });
      const sr = L.filter((r) => r.suite === 'stressRun' && r.ok).map((r) => { const o = r.ok; return [o.kind, o.n.toLocaleString('en-US'), o.engine === 'before' ? 'before' : 'now', sec(o.ms), o.heapMB === null ? '–' : o.heapMB + ' MB', (r.rssPeakMB - r.rssBaseMB) + ' MB']; });
      const tr = L.filter((r) => r.suite === 'transfer' && r.ok).map((r) => { const o = r.ok; return [o.n.toLocaleString('en-US'), sec(o.objectsMs), sec(o.typedCopyMs), sec(o.typedMoveMs), o.objectsMB + ' MB', o.typedMB + ' MB']; });
      out.push('**' + BN[b] + ': the sweep itself, same pairs held three ways**\n\n' + table(['items', 'pairs', 'held as', 'build', '30 sweeps', 'per update', 'heap'], ps) +
        '\n\n**' + BN[b] + ': whole Stress layout, before and now**\n\n' + table(['structure', 'items', 'engine', 'time', 'heap', 'process memory growth'], sr) +
        '\n\n**' + BN[b] + ': sending a layout result (one object per item vs typed arrays)**\n\n' + table(['items', 'objects (structured clone)', 'typed arrays: copied', 'typed arrays: moved', 'object size (rough)', 'typed size'], tr));
    }
    return out.join('\n\n');
  },
  limits() {
    const out = [];
    for (const b of BR) {
      const L = load(b + '-limits'), rows = [];
      const cell = (st) => !st ? '–' : st.error ? (/too big for a layered/.test(st.error) ? 'refused (too big)' : '✗ ' + String(st.error).slice(0, 60)) : sec(st.ms);
      for (const kind of ['simple', 'moderate', 'complex']) for (const n of [100000, 500000, 1000000]) {
        const get = (via, stages) => L.find((r) => r.suite === 'limits' && r.args.kind === kind && r.args.n === n && r.args.via === via && JSON.stringify(r.args.stages) === JSON.stringify(stages));
        const csv = get('csv', ['csv_only']), core = get('graph', ['prepare', 'check', 'groups', 'sim']), flow = get('graph', ['flow']), force = get('graph', ['force']), stress = get('graph', ['stress']);
        const st = (r, k) => r ? (r.skipped ? 'skipped' : r.ok ? (r.ok.stages[k] ? cell(r.ok.stages[k]) : '–') : r.error ? (/out of memory/.test(r.error) ? '✗ out of memory' : '✗ ' + r.error.slice(0, 40)) : '–') : '–';
        rows.push([kind, n.toLocaleString('en-US'), csv && csv.ok && csv.ok.csvMB ? (csv.ok.rows || 0).toLocaleString('en-US') + ' rows, ' + csv.ok.csvMB + ' MB' : csv && csv.ok && csv.ok.stages.csv_text ? '✗ ' + csv.ok.stages.csv_text.error : csv && csv.error ? '✗ ' + csv.error.slice(0, 40) : '–', st(csv, 'csv_parse'), st(csv, 'csv_import'), st(core, 'prepare'), st(core, 'check'), st(core, 'groups'), st(core, 'sim_1000_runs'), st(flow, 'flow_layout'), st(force, 'force_layout'), st(stress, 'stress_layout')]);
      }
      out.push('**' + BN[b] + '**\n\n' + table(['structure', 'items', 'CSV file', 'CSV parse', 'CSV import', 'prepare', 'check', 'groups', '1,000 sim runs', 'flow layout', 'Force layout', 'Stress layout'], rows));
    }
    return out.join('\n\n');
  },
  compare() {
    const out = [];
    for (const b of BR) {
      const L = load(b + '-compare').concat(load(b + '-pack')), parts = [];
      const lay = L.filter((r) => r.suite === 'layered' && r.ok).map((r) => { const o = r.ok; return [o.n, sec(o.ours.ms), o.ours.cross, o.dagre ? sec(o.dagre.ms) : '–', o.dagre ? o.dagre.cross : '–', o.elk ? sec(o.elk.ms) : '–', o.elk ? o.elk.cross : '–']; });
      if (lay.length) parts.push('Layered drawing (time, crossings)\n\n' + table(['items', 'ours', 'crossings', 'dagre', 'crossings', 'ELK', 'crossings'], lay));
      const gr = L.filter((r) => r.suite === 'groups' && r.ok).map((r) => { const o = r.ok; return [o.n, o.planted, sec(o.ours.ms), o.ours.groups, o.ours.nmi, o.louvain ? sec(o.louvain.ms) : '–', o.louvain ? o.louvain.groups : '–', o.louvain ? o.louvain.nmi : '–']; });
      if (gr.length) parts.push('Found groups (time, groups found, match with the planted groups; 1.0 = perfect)\n\n' + table(['items', 'planted', 'ours', 'found', 'match', 'Louvain', 'found', 'match'], gr));
      const dr = L.find((r) => r.suite === 'draws' && r.ok);
      if (dr) parts.push('Random draws, 1,000,000 each (ms)\n\n' + table(['distribution', 'ours', 'd3-random', 'jStat'], Object.keys(dr.ok).map((k) => [k, f0(dr.ok[k].ours.ms), dr.ok[k].d3 ? f0(dr.ok[k].d3.ms) : '–', dr.ok[k].jstat ? f0(dr.ok[k].jstat.ms) : '–'])));
      const fo = L.find((r) => r.suite === 'formula' && r.ok);
      if (fo) parts.push('Formulas, ' + fo.ok.rows.toLocaleString('en-US') + ' rows: ours ' + sec(fo.ok.ours) + ', expr-eval ' + sec(fo.ok.exprEval) + ' (' + ratio(fo.ok.exprEval, fo.ok.ours) + ' faster)');
      const gf = L.filter((r) => r.suite === 'gif' && r.ok).map((r) => { const o = r.ok, g = o.gifenc_shared_palette; return [o.frames, o.w + '×' + o.h, sec(o.ours.ms), (o.ours.bytes / 1024).toFixed(0) + ' KB', o.ours.mse === undefined ? '–' : o.ours.mse.toFixed(3) + ' / ' + o.ours.psnr.toFixed(1) + ' dB', sec(g.ms), (g.bytes / 1024).toFixed(0) + ' KB', g.mse === undefined ? '–' : g.mse.toFixed(3) + ' / ' + g.psnr.toFixed(1) + ' dB']; });
      if (gf.length) parts.push('GIF export\n\n' + table(['frames', 'size', 'ours', 'file', 'ours: color error (MSE / PSNR)', 'gifenc', 'file', 'gifenc: color error'], gf));
      const pk = L.filter((r) => r.suite === 'pack' && r.ok).map((r) => { const o = r.ok; return [o.n.toLocaleString('en-US'), o.links.toLocaleString('en-US'), sec(o.objects_clone), sec(o.pack), sec(o.clone_packed), sec(o.unpack), sec(o.page_waits_objects), sec(o.page_waits_packed)]; });
      if (pk.length) parts.push('Sending a layout from the worker to the page (moderate network)\n\n' + table(['items', 'links', 'send as objects (write + read)', 'pack (worker)', 'send packed', 'unpack (page)', 'page waits, objects (half of the send)', 'page waits, packed'], pk));
      const ck = L.filter((r) => r.suite === 'check' && r.ok).map((r) => [r.args.kind, r.ok.n.toLocaleString('en-US'), r.ok.m.toLocaleString('en-US'), sec(r.ok.ms), r.ok.findings]);
      if (ck.length) parts.push('Checker\n\n' + table(['structure', 'items', 'links', 'time', 'findings'], ck));
      const ig = L.filter((r) => r.suite === 'ingest' && r.ok).map((r) => [r.ok.n.toLocaleString('en-US'), r.ok.links.toLocaleString('en-US'), sec(r.ok.json), sec(r.ok.csv), sec(r.ok.arrows)]);
      if (ig.length) parts.push('Ingestion, one network three ways\n\n' + table(['items', 'links', 'JSON', 'CSV', 'A -> B lines'], ig));
      const me = L.filter((r) => r.suite === 'memory' && r.ok).map((r) => [r.args.what, (r.rssPeakMB - L.find((x) => x.suite === 'memory' && x.args.what === 'baseline').rssPeakMB) + ' MB', r.ok.heapMB === null || r.ok.heapMB === undefined ? '–' : r.ok.heapMB + ' MB', r.ok.typed_arrays_MB === undefined ? '' : r.ok.typed_arrays_MB + ' MB typed']);
      if (me.length) parts.push('Memory at 10,000 items\n\n' + table(['what is held', 'process growth vs empty page', 'JS heap', 'note'], me));
      out.push('### ' + BN[b] + '\n\n' + parts.join('\n\n'));
    }
    return out.join('\n\n');
  }
};
const want = process.argv[2];
if (want) console.log(sections[want]()); else Object.keys(sections).forEach((k) => console.log('## ' + k + '\n\n' + sections[k]() + '\n'));
