/* Copyright (c) 2026 LFC Foundry. MIT License. Which actions of the app hold the screen for more than 8 ms in a row? (Chromium only: it uses the browser's own sampling profiler; this finds the places to fix, it is not a speed claim.)
 *   node bench/longtasks.js [items] [page.html]
 * Set NFM_METHOD=webgl2 (with NFM_CHROME_ARGS) to profile the WebGL drawing path instead of the Canvas 2D fallback.
 * NFM_STEP=drag (a step name's start) lists where the time goes for that step only.
 * Runs a scripted visit (open a big Network map, move over it, zoom, drag, click, change tabs) with the profiler on, joins neighboring busy samples into stretches, and lists every stretch over 8 ms with the page functions that took the time.
 * "Busy" means the main thread was running something other than waiting; two tasks that run back to back show as one stretch, so a long stretch is a place to look, not proof of one long task. */
'use strict';
const path = require('path');
(async () => {
  const items = +(process.argv[2] || 10000), page = path.resolve(process.argv[3] || path.join(__dirname, '..', 'index.html')), LIMIT = 8;
  const D = await require('./driver.js').open('chromium', { timeout: 600000 }), P = D.page, cdp = await P.context().newCDPSession(P);
  if (process.env.NFM_METHOD) await P.addInitScript((m) => { try { localStorage.setItem('nfm-prefs', JSON.stringify({ method: m })); } catch (e) { /* ignore */ } }, process.env.NFM_METHOD);
  await P.goto('file://' + page); await P.waitForFunction(() => typeof NFM !== 'undefined'); await new Promise((r) => setTimeout(r, 800));
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start'); const wall0 = Date.now();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), steps = [];
  const step = async (name, fn) => { const t0 = Date.now(); await fn(); steps.push([name, t0, Date.now()]); };
  await step('open a ' + items + '-item Network map', async () => { await P.evaluate((n) => { NFM.setGraph(NFMExamples.bigNetwork(n, 4, 7)); NFM.showTab('map'); NFM.setV({ view: 'network', arrange: 'stress' }); }, items); await P.waitForFunction(() => NFM.state.mapBuilt && !NFM.pending(), null, { timeout: 120000 }).catch(() => {}); await sleep(1500); });
  const box = await P.evaluate(() => { const r = document.getElementById('stage').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await step('move the pointer over the map', async () => { for (let i = 0; i < 60; i++) { await P.mouse.move(box.x + box.w * (0.2 + 0.6 * (i / 60)), box.y + box.h * (0.3 + 0.2 * Math.sin(i / 6))); } await sleep(300); });
  await step('zoom with the wheel', async () => { await P.mouse.move(box.x + box.w / 2, box.y + box.h / 2); for (let i = 0; i < 12; i++) { await P.mouse.wheel(0, -240); await sleep(40); } await sleep(500); for (let i = 0; i < 12; i++) { await P.mouse.wheel(0, 240); await sleep(40); } await sleep(500); });
  await step('drag the map', async () => { await P.mouse.move(box.x + box.w / 2, box.y + box.h / 2); await P.mouse.down(); for (let i = 0; i < 30; i++) await P.mouse.move(box.x + box.w / 2 + i * 6, box.y + box.h / 2 + i * 3); await P.mouse.up(); await sleep(400); });
  await step('click an item', async () => { await P.mouse.click(box.x + box.w / 2, box.y + box.h / 2); await sleep(500); });
  await step('change tabs', async () => { for (const t of ['adv', 'map', 'adv', 'map']) { await P.evaluate((t) => NFM.showTab(t), t); await sleep(400); } });
  await step('change the arrangement', async () => { await P.evaluate(() => NFM.setV({ view: 'network', arrange: 'closeness' })); await P.waitForFunction(() => !NFM.pending(), null, { timeout: 120000 }).catch(() => {}); await sleep(1500); });
  const { profile } = await cdp.send('Profiler.stop'); const version = D.version; await D.close();
  const nodes = new Map(profile.nodes.map((n) => [n.id, n])), parent = new Map(); profile.nodes.forEach((n) => (n.children || []).forEach((c) => parent.set(c, n.id)));
  const name = (n) => (n.callFrame.functionName || '(anonymous)') + ':' + n.callFrame.lineNumber;
  const t0 = profile.startTime; let t = 0; const runs = []; let cur = null;
  profile.samples.forEach((id, i) => {
    const dt = profile.timeDeltas[i] / 1000, n = nodes.get(id), idle = /^\((idle|program)\)$/.test(n.callFrame.functionName); const at = t + dt; t = at;
    if (idle) { if (cur) { runs.push(cur); cur = null; } return; }
    if (!cur) cur = { start: at - dt, ms: 0, by: new Map() }; cur.ms += dt;
    let k = id, top = null; while (k !== undefined) { const nn = nodes.get(k); if (nn.callFrame.url === '' || /file:/.test(nn.callFrame.url) || nn.callFrame.url === undefined) top = nn; k = parent.get(k); }
    const own = name(n); cur.by.set(own, (cur.by.get(own) || 0) + dt);
  });
  if (cur) runs.push(cur);
  const only = process.env.NFM_STEP, long = runs.filter((r) => r.ms > LIMIT && (!only || stepOf(r).indexOf(only) === 0)).sort((a, b) => b.ms - a.ms);
  console.log('\n' + version + ' (' + items + ' items; stretches of busy main thread over ' + LIMIT + ' ms; milliseconds, lower is better)\n\nsteps: ' + steps.map((s) => s[0]).join(' | '));
  console.log('\nbusy stretches over ' + LIMIT + ' ms: ' + long.length + ' of ' + runs.length + '; the longest: ' + long.slice(0, 12).map((r) => r.ms.toFixed(0)).join(', ') + ' ms\n');
  function stepOf(r) { const w = wall0 + r.start; const s = steps.find((q) => w >= q[1] - 5 && w <= q[2] + 5); return s ? s[0] : '(between steps)'; }
  const per = new Map(); steps.forEach((q) => per.set(q[0], { n: 0, long: 0, max: 0 })); per.set('(between steps)', { n: 0, long: 0, max: 0 });
  runs.forEach((r) => { const e = per.get(stepOf(r)); e.n++; if (r.ms > LIMIT) e.long++; if (r.ms > e.max) e.max = r.ms; });
  console.log('| step | busy stretches | over ' + LIMIT + ' ms | longest ms |\n|---|---|---|---|'); per.forEach((e, k) => { if (e.n) console.log('| ' + k + ' | ' + e.n + ' | ' + e.long + ' | ' + e.max.toFixed(0) + ' |'); }); console.log('');
  const agg = new Map(); long.forEach((r) => r.by.forEach((v, k) => agg.set(k, (agg.get(k) || 0) + v)));
  console.log('| where the time goes in those stretches (own time) | ms |\n|---|---|'); [...agg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).forEach(([k, v]) => console.log(`| ${k} | ${v.toFixed(0)} |`));
  process.exit(0);
})();
