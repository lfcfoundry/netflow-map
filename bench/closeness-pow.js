/* Copyright (c) 2026 LFC Foundry. MIT License. Closeness arrangement: the old engine (before the fixed-exponent pow() calls were removed) against the current one, same graphs.
 *   node bench/closeness-pow.js node|chromium|firefox|webkit|epiphany      (NFM_OLD_REV = the commit to compare with, default HEAD^ )
 * Prints a Markdown row per case (milliseconds, lower is better) and checks that the results are identical. */
'use strict';
const fs = require('fs'), path = require('path'), NFM = path.join(__dirname, '..') + '/';
const R = (p) => fs.readFileSync(NFM + p, 'utf8');
const strip = (s) => s.replace(/if \(typeof module[^\n]*\n?/, '').replace(/var C = typeof NFMColumns[^\n]*\n/, 'var C = globalThis.NFMColumns;\n');
const texts = { columns: R('src/columns.js'), old: require('child_process').execSync('git show ' + (process.env.NFM_OLD_REV || 'HEAD^') + ':src/engine.js', { cwd: NFM, maxBuffer: 1 << 26 }).toString(), neu: R('src/engine.js'), gen: R('bench/gen.js') };
async function inPage(arg) {
  const { texts, sizes } = arg, g = globalThis, strip = (s) => s.replace(/if \(typeof module[^\n]*\n?/, '').replace(/var C = typeof NFMColumns[^\n]*\n/, 'var C = globalThis.NFMColumns;\n');
  (0, eval)(texts.columns.replace(/if \(typeof module[^\n]*\n?/, '') + '\n;globalThis.NFMColumns = typeof NFMColumns !== "undefined" ? NFMColumns : globalThis.NFMColumns;');
  (0, eval)(strip(texts.old) + '\n;globalThis.EOld = NFMEngine;'); (0, eval)(strip(texts.neu) + '\n;globalThis.ENew = NFMEngine;');
  (0, eval)(texts.gen.replace(/if \(typeof module[^\n]*\n?/, '') + '\n;globalThis.NFMGen = NFMGen;');
  const rows = [];
  for (const [n, kind] of sizes) {
    const dg = g.NFMColumns.derive(JSON.parse(JSON.stringify(g.NFMGen.graph(kind, n, 11)))), row = { n, kind }, out = {};
    for (const [name, E] of [['old', g.EOld], ['new', g.ENew], ['old2', g.EOld], ['new2', g.ENew]]) {
      let best = Infinity, L; for (let r = 0; r < 3; r++) { const t = performance.now(); L = E.build(dg, { view: 'network', arrange: 'closeness', colorBy: 'group' }); best = Math.min(best, performance.now() - t); }
      row[name] = Math.round(best); out[name] = L.nodes.map((q) => [q.cx, q.cy]);
    }
    row.same = out.old.every((p, i) => p[0] === out.new[i][0] && p[1] === out.new[i][1]); rows.push(row);
  }
  return rows;
}
(async () => {
  const which = process.argv[2] || 'node', arg = { texts, sizes: [[3000, 'moderate'], [10000, 'moderate'], [10000, 'complex']] };
  let rows, version;
  if (which === 'node') { rows = await inPage(arg); version = 'Node ' + process.version; }
  else { const D = await require('./driver.js').open(which, { timeout: 3600000 }); version = D.version; await D.goto('about:blank'); rows = await D.page.evaluate(inPage, arg); await D.close(); }
  console.log('\n' + version); rows.forEach((r) => console.log(`| ${r.n.toLocaleString('en-US')} | ${r.kind} | ${Math.min(r.old, r.old2)} | ${Math.min(r.new, r.new2)} | ${(Math.min(r.old, r.old2) / Math.min(r.new, r.new2)).toFixed(2)} | ${r.same ? 'yes' : 'NO'} |`));
  fs.writeFileSync(path.join(__dirname, 'results', 'closeness-pow-' + which + '.json'), JSON.stringify({ version, rows }));
  process.exit(0);
})();
