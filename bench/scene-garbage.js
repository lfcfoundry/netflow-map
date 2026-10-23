/* Copyright (c) 2026 LFC Foundry. MIT License. Where the garbage of rebuilding the picture of a big flat Network map comes from (Chromium only: its sampling heap profiler tells which function made each allocation).
 *   node bench/scene-garbage.js [items] [index.html]
 * Rebuilds the picture (NFM.scheduleScene, as a setting change does), samples every allocation of the middle rebuild, and prints the functions that allocated most, in MB, plus the page's heap before and after. Allocation sizes are not timings. */
'use strict';
const path = require('path'), fs = require('fs');
(async () => {
  const LINES = fs.readFileSync(path.resolve(process.argv[3] || path.join(__dirname, '..', 'index.html')), 'utf8').split('\n');
  const items = +(process.argv[2] || 100000), file = path.resolve(process.argv[3] || path.join(__dirname, '..', 'index.html'));
  const D = await require('./driver.js').open('chromium', { timeout: 3600000 });
  const wait = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await D.page.evaluate(fn)) return; await new Promise((r) => setTimeout(r, 200)); } throw new Error('timed out'); };
  await D.goto('file://' + file); await wait(() => typeof NFM !== 'undefined', 60000);
  await D.page.evaluate((n) => { NFM.setGraph(NFMExamples.bigNetwork(n, 4, 7)); NFM.showTab('map'); NFM.setV({ view: 'network', arrange: 'circle' }); }, items);
  await wait(() => !NFM.pending() && !!NFM.state.scene, 600000);
  if (process.env.NFM_BACKEND) await D.page.evaluate(async (b) => { const m = NFM.manager(); m.canary[b] = { ok: true }; await m.use(b); return m.r.name; }, process.env.NFM_BACKEND);
  const cdp = await D.page.context().newCDPSession(D.page);
  await cdp.send('HeapProfiler.enable');
  const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); const m = await cdp.send('Runtime.getHeapUsage'); return m.usedSize / 1048576; };
  const rebuild = (k) => D.page.evaluate(async (k) => { const sc0 = NFM.state.scene; NFM.scheduleScene(); const t0 = Date.now(); while (NFM.state.scene === sc0 && Date.now() - t0 < 120000) await new Promise((r) => setTimeout(r, 20)); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); return NFM.state.scene !== sc0; }, k);
  await rebuild(1); const before = await heap();
  /* how much of a rebuild's time the garbage collector takes (trace events named MinorGC and MajorGC, with their durations) */
  const events = []; cdp.on('Tracing.dataCollected', (d) => events.push(...d.value)); await cdp.send('Tracing.start', { categories: 'devtools.timeline,v8', transferMode: 'ReportEvents' });
  const tw0 = Date.now(); await rebuild(3); const twall = Date.now() - tw0; const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r)); await cdp.send('Tracing.end'); await done;
  const gc = events.filter((e) => /^(MinorGC|MajorGC|V8\.GCScavenger|V8\.GCCompactor)$/.test(e.name) && e.ph === 'X'), gcMs = (re) => gc.filter((e) => re.test(e.name)).reduce((a, e) => a + e.dur / 1000, 0);
  console.log('GC during one rebuild (wall ' + twall + ' ms): minor ' + gcMs(/Minor|Scavenger/).toFixed(0) + ' ms in ' + gc.filter((e) => /Minor|Scavenger/.test(e.name)).length + ' collections, major ' + gcMs(/Major|Compactor/).toFixed(0) + ' ms in ' + gc.filter((e) => /Major|Compactor/.test(e.name)).length);
  await cdp.send('HeapProfiler.startSampling', { samplingInterval: 8192 });
  await rebuild(2);
  const prof = (await cdp.send('HeapProfiler.stopSampling')).profile, byFn = new Map(); let total = 0;
  const nm = (cf) => (cf.functionName || '(anon)') + ':' + cf.lineNumber + ':' + cf.columnNumber, byPath = new Map();
  (function walk(n, path) { const s = n.selfSize || 0; const pth = path.concat(nm(n.callFrame)).slice(-5); if (s > 0) byPath.set(pth.join(' < '), (byPath.get(pth.join(' < ')) || 0) + s); total += s; const cf = n.callFrame, key = (cf.functionName || '(anonymous)') + ' ' + cf.url.split('/').pop() + ':' + cf.lineNumber + ':' + cf.columnNumber; if (s) byFn.set(key, (byFn.get(key) || 0) + s); (n.children || []).forEach((c) => walk(c, pth)); })(prof.head, []);
  console.log('Biggest call paths (last 5 callers, innermost first is the right end):'); [...byPath].sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([k, v]) => console.log((v / 1048576).toFixed(1) + ' MB  ' + k));
  const after = await heap();
  console.log('drawing: ' + await D.page.evaluate(() => NFM.manager().r.name) + ', items', items, 'heap after a settled rebuild before/after (MB): ' + before.toFixed(0) + ' / ' + after.toFixed(0) + '; sampled allocation of one rebuild: ' + (total / 1048576).toFixed(0) + ' MB');
  console.log('| MB | function |\n|---:|---|'); [...byFn].sort((a, b) => b[1] - a[1]).slice(0, 14).forEach(([k, v]) => { const m = /:(-?\d+):(-?\d+)$/.exec(k), ln = LINES[+m[1]] || '', at = ln.slice(+m[2], +m[2] + 90); console.log('| ' + (v / 1048576).toFixed(1) + ' | ' + k.replace(/ index.html/, '') + ' `' + at.replace(/\|/g, '/') + '` |'); });
  await D.close();
})();
