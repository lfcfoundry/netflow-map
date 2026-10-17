/* Copyright (c) 2026 LFC Foundry. MIT License. 1,000-run simulation: the old per-end bookkeeping against the current sparse one, same graphs.
 *   node bench/sim-sparse.js node|chromium|firefox|webkit|epiphany      (NFM_OLD_REV = the commit to compare with, default HEAD^ )
 * Prints a Markdown row per case (milliseconds, lower is better) and checks that the results are identical. */
'use strict';
const fs = require('fs'), path = require('path'), NFM = path.join(__dirname, '..') + '/', R = (p) => fs.readFileSync(NFM + p, 'utf8');
const texts = { columns: R('src/columns.js'), engine: R('src/engine.js'), old: require('child_process').execSync('git show ' + (process.env.NFM_OLD_REV || 'HEAD^') + ':src/sim.js', { cwd: NFM, maxBuffer: 1 << 26 }).toString(), neu: R('src/sim.js'), gen: R('bench/gen.js') };
async function inPage(arg) {
  const { texts } = arg, g = globalThis, strip = (s) => s.replace(/if \(typeof module[^\n]*\n?/, '').replace(/var C = typeof NFMColumns[^\n]*\n/, 'var C = globalThis.NFMColumns;\n');
  (0, eval)(strip(texts.columns) + '\n;globalThis.NFMColumns = NFMColumns;'); (0, eval)(strip(texts.engine) + '\n;globalThis.NFMEngine = NFMEngine;');
  (0, eval)(strip(texts.old) + '\n;globalThis.SOld = NFMSim;'); (0, eval)(strip(texts.neu) + '\n;globalThis.SNew = NFMSim;'); (0, eval)(strip(texts.gen) + '\n;globalThis.NFMGen = NFMGen;');
  const rows = [];
  for (const [n, kind] of [[100000, 'simple'], [100000, 'moderate']]) {
    const P = g.NFMEngine.prepare(g.NFMColumns.derive(JSON.parse(JSON.stringify(g.NFMGen.graph(kind, n, 11)))), {}), row = { n, kind, ends: 0 }, snaps = {};
    for (const [name, S] of [['old', g.SOld], ['new', g.SNew]]) {
      const t = performance.now(), sm = S.create(P, { trials: 1000, seed: 1, sources: [{ v: 0, w: 1 }] }); sm.run(1000, 600000); const ms = performance.now() - t; row[name] = Math.round(ms); row.ends = sm.ends.length;
      const sn = sm.snapshot(); delete sn.busyMs; snaps[name] = JSON.stringify(sn.endpoints.slice(0, 200)) + sn.trials + JSON.stringify(sn.endpoints.length);
    }
    row.same = snaps.old === snaps.new; rows.push(row);
  }
  return rows;
}
(async () => {
  const which = process.argv[2] || 'node'; let rows, version;
  if (which === 'node') { rows = await inPage({ texts }); version = 'Node ' + process.version; }
  else { const D = await require('./driver.js').open(which, { timeout: 3600000 }); version = D.version; await D.goto('about:blank'); rows = await D.page.evaluate(inPage, { texts }); await D.close(); }
  console.log('\n' + version); rows.forEach((r) => console.log(`| ${r.n.toLocaleString('en-US')} | ${r.kind} (${r.ends} ends) | ${r.old} | ${r.new} | ${(r.old / r.new).toFixed(1)} | ${r.same ? 'yes' : 'NO'} |`));
  fs.writeFileSync(path.join(__dirname, 'results', 'sim-sparse-' + which + '.json'), JSON.stringify({ version, rows })); process.exit(0);
})();
