/* Copyright (c) 2026 LFC Foundry. MIT License.
 *   node bench/vs-libs-run.js <firefox|chromium|webkit> [plan] [--out=file.jsonl]
 * Runs the bench/vs-libs.js suites, each in a freshly loaded bench/page.html, in ONE browser; prints the browser version first.
 * Plans: landing (everything on the landing page), quick (small sizes, to check the harness). Memory rows are Chromium only (the JS heap read over the DevTools protocol). */
'use strict';
const fs = require('fs'), path = require('path'), { open } = require('./driver.js');
const which = process.argv[2] || 'chromium', planName = process.argv[3] || 'landing', flag = (k) => (process.argv.find((a) => a.startsWith('--' + k + '=')) || '').split('=')[1];
const J = (suite, args) => ({ suite, args });
const plans = {
  quick: () => [J('vsNet', { n: 300 }), J('vsFlow', { n: 100, m: 180 }), J('vsSankey', { n: 100, m: 150 }), J('vsCsv', { n: 5000 }), J('vsMem', { n: 2000, what: 'ours' }), J('vsMem', { n: 2000, what: 'graphology' })],
  sankey: () => [[100, 150], [400, 616], [1500, 2283]].map(([n, m]) => J('vsSankey', { n, m })),
  landing: () => [].concat(
    [1000, 5000, 10000].map((n) => J('vsNet', { n, libs: n > 1000 ? ['d3', 'd3c', 'fa2'] : ['d3', 'd3c', 'fa2', 'cose'] })),
    [[200, 360], [400, 760], [1000, 1900]].map(([n, m]) => J('vsFlow', { n, m })),
    [[100, 150], [400, 616], [1500, 2283]].map(([n, m]) => J('vsSankey', { n, m })),
    [J('vsCsv', { n: 188000 })],
    which === 'chromium' ? [10000, 100000].flatMap((n) => ['ours', 'graphology', 'cytoscape'].map((what) => J('vsMem', { n, what }))) : []),
};
const jobs = plans[planName](), out = flag('out') || path.join(__dirname, 'results', `vs-libs-${which}-${planName}.jsonl`);
fs.mkdirSync(path.dirname(out), { recursive: true });
(async () => {
  const D = await open(which, { timeout: 1800000, args: which === 'chromium' ? ['--disable-features=BackForwardCache'] : [] });
  console.log('Browser: ' + D.version);
  for (const j of jobs) {
    const t0 = Date.now(); let rec;
    try {
      await D.goto('file://' + path.join(__dirname, 'page.html'));
      await new Promise((r) => setTimeout(r, 300));
      if (j.suite === 'vsMem') {   /* Chromium only: JS heap over the DevTools protocol, two full collections before each reading */
        const s = await D.page.context().newCDPSession(D.page), U = async () => { await s.send('HeapProfiler.collectGarbage'); await s.send('HeapProfiler.collectGarbage'); return (await s.send('Runtime.getHeapUsage')).usedSize; };
        await D.eval((n) => SUITES.vsMemPrep({ n }), j.args.n); const b = await U(); const h = await D.eval((w) => SUITES.vsMemHold({ what: w }), j.args.what); const a = await U(); await s.detach();
        rec = { suite: j.suite, args: j.args, browser: D.version, ok: { n: j.args.n, links: h.links, what: j.args.what, heapMB: Math.round((a - b) / 104857.6) / 10 }, wallMs: Date.now() - t0 };
        fs.appendFileSync(out, JSON.stringify(rec) + '\n'); console.log(`${which} vsMem ${JSON.stringify(j.args)} -> ${rec.ok.heapMB} MB`); continue;
      }
      const res = await D.eval(async (jj) => { try { return { ok: await SUITES[jj.suite](jj.args) }; } catch (e) { return { error: String(e && e.message || e).slice(0, 200) }; } }, j);
      rec = Object.assign({ suite: j.suite, args: j.args, browser: D.version }, res, { wallMs: Date.now() - t0 });
    } catch (e) { rec = { suite: j.suite, args: j.args, browser: D.version, error: String(e && e.message || e).slice(0, 200) }; }
    fs.appendFileSync(out, JSON.stringify(rec) + '\n');
    console.log(`${which} ${j.suite} ${JSON.stringify(j.args)} -> ${rec.ok ? JSON.stringify(rec.ok).slice(0, 300) : rec.error} (${Math.round((Date.now() - t0) / 1000)} s)`);
  }
  await D.close(); console.log('done');
})().catch((e) => { console.error('runner crash', e); process.exit(2); });
