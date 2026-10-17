/* Copyright (c) 2026 LFC Foundry. MIT License. The Distances (stress) arrangement: the previous build's engine, the new JavaScript (hop-code pair lists, WebAssembly off) and the new WebAssembly pipeline (wasm/stress.c).
 *   node bench/stress-wasm.js node|chromium|firefox|webkit|epiphany [reps]     prints Markdown tables (milliseconds and megabytes, lower is better), saves bench/results/stress-wasm-<engine>.json
 * Each variant runs in a fresh page (a fresh process for Node), because a page that has already run one variant has trained the JavaScript compiler on it and the next one looks slower or faster than it is.
 * NFM_OLD_REV (default HEAD) names the git revision whose src/engine.js is the "before" engine. The pictures of the three are compared too (the largest position difference must be 0). */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const R = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const rev = process.env.NFM_OLD_REV || 'HEAD';
const texts = { columns: R('src/columns.js'), engine: R('src/engine.js'), old: cp.execSync('git show ' + rev + ':src/engine.js', { cwd: path.join(__dirname, '..'), maxBuffer: 1 << 28 }).toString(), gen: R('bench/gen.js') };
const CASES = [[3000, 'moderate'], [10000, 'moderate'], [30000, 'moderate'], [10000, 'complex']];
async function inPage(arg) {
  const { texts, variant, reps, cases } = arg, g = globalThis, ev = (code) => (0, eval)(code);
  const strip = (t) => t.replace(/if \(typeof module[^\n]*\n?/, '');
  ev(strip(texts.columns) + '\n;globalThis.NFMColumns = typeof NFMColumns !== "undefined" ? NFMColumns : globalThis.NFMColumns;');
  ev(strip(variant === 'before' ? texts.old : texts.engine).replace(/var C = typeof NFMColumns[^\n]*\n/, 'var C = globalThis.NFMColumns;\n') + '\n;globalThis.NFMEngine = NFMEngine;');
  ev(strip(texts.gen) + '\n;globalThis.NFMGen = NFMGen;');
  const E = g.NFMEngine, C = g.NFMColumns, GEN = g.NFMGen, W = E.stressWasm, rows = [];
  if (W) W.on = variant === 'wasm';
  for (const [n, kind] of cases) {
    const dg = C.derive(JSON.parse(JSON.stringify(GEN.graph(kind, n, 11)))), t = []; let L;
    for (let r = 0; r < reps; r++) { const t0 = performance.now(); L = E.build(dg, { view: 'network', arrange: 'stress', colorBy: 'group' }); t.push(performance.now() - t0); }
    t.sort((a, b) => a - b);
    const pos = L.nodes.map((q) => [q.cx, q.cy]), pairs = W ? W.pairs : 0;
    rows.push({ n, kind, ms: Math.round(t[t.length >> 1]), best: Math.round(t[0]), pairs, pairMB: pairs ? +(pairs * (variant === 'before' ? 16 : 10) / 1048576).toFixed(1) : null, ran: W ? { stress: W.calls, push: W.sepCalls, error: W.error } : null, pos });
  }
  return rows;
}
if (process.argv[2] !== '__node') (async () => {
  const which = process.argv[2] || 'node', reps = +(process.argv[3] || 3), out = {}; let version = '';
  for (const variant of ['before', 'js', 'wasm']) {
    let rows;
    if (which === 'node') { const r = cp.spawnSync(process.execPath, [__filename, '__node', variant, String(reps)], { maxBuffer: 1 << 30 }); if (r.status) throw new Error(String(r.stderr)); rows = JSON.parse(r.stdout.toString()); version = 'Node ' + process.version; }
    else { const D = await require('./driver.js').open(which, { timeout: 3600000 }); version = D.version; await D.goto('about:blank'); rows = await D.page.evaluate(inPage, { texts, variant, reps, cases: CASES }); await D.close(); }
    out[variant] = rows;
  }
  const same = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs(a[i][0] - b[i][0]), Math.abs(a[i][1] - b[i][1])); return d; };
  console.log('\n' + version + ' (median of ' + reps + ' runs, fresh page per variant; milliseconds and megabytes, lower is better; before = ' + rev + ')\n\n| items | before ms | new JavaScript ms | WebAssembly ms | WebAssembly vs before (times faster, higher is better) | pair memory before MB | now MB | largest position difference |\n|---|---|---|---|---|---|---|---|');
  CASES.forEach(([n, kind], i) => {
    const b = out.before[i], j = out.js[i], w = out.wasm[i], d = Math.max(same(b.pos, j.pos), same(b.pos, w.pos));
    console.log(`| ${n.toLocaleString('en-US')} ${kind} | ${b.ms} | ${j.ms} | ${w.ms} | ${(b.ms / w.ms).toFixed(2)} | ${w.pairs ? (w.pairs * 16 / 1048576).toFixed(1) : '?'} | ${w.pairMB} | ${d} |`);
  });
  for (const v of Object.keys(out)) out[v].forEach((r) => { delete r.pos; });
  fs.writeFileSync(path.join(__dirname, 'results', 'stress-wasm-' + which + '.json'), JSON.stringify({ version, rev, reps, out }, null, 1));
  process.exit(0);
})();
if (process.argv[2] === '__node') {   // child process for one Node variant: prints its rows (positions included) as JSON
  (async () => { const rows = await inPage({ texts, variant: process.argv[3], reps: +process.argv[4], cases: CASES }); process.stdout.write(JSON.stringify(rows)); })();
}
