/* Copyright (c) 2026 LFC Foundry. MIT License. Time the animated GIF maker in a FRESH page each time, one browser:
 *   node bench/gif-ab.js chromium|firefox|webkit <old.html> <new.html> [repeats=3] [items=400]
 * Rows: old page with its plain 10 FPS turn; new page, same settings; new page at 25 FPS; new page at 25 FPS with the full filter chain on 1, 2 and 4 workers.
 * Prints the median "made in" milliseconds (lower is better), the picture count and the size. Versions take turns inside each repeat. */
'use strict';
const path = require('path'), which = process.argv[2] || 'chromium', OLD = path.resolve(process.argv[3]), NEW = path.resolve(process.argv[4]), R = +(process.argv[5] || 3), N = +(process.argv[6] || 400);
const FULL = { glow: 0.6, blur: 1, vignette: 0.4, sharpen: 0.3, saturation: 0.2 };
const ALL = [
  { name: 'old page, 10 FPS (its "2 s" turn is 60 pictures)', file: OLD, old: true, fps: 10, sec: '2' },
  { name: 'new page, 10 FPS, 6 s turn (same 60 pictures)', file: NEW, fps: 10, sec: '6' },
  { name: 'new page, 25 FPS, 2 s turn (50 pictures)', file: NEW, fps: 25, sec: '2' },
  { name: 'new page, 25 FPS, full filters, 1 worker', file: NEW, fps: 25, sec: '2', filter: FULL, workers: 1 },
  { name: 'new page, 25 FPS, full filters, 2 workers', file: NEW, fps: 25, sec: '2', filter: FULL, workers: 2 },
  { name: 'new page, 25 FPS, full filters, 4 workers', file: NEW, fps: 25, sec: '2', filter: FULL, workers: 4 }];
const rows = process.env.ROWS ? process.env.ROWS.split(',').map((i) => ALL[+i]) : ALL;
(async () => {
  const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1], res = rows.map(() => []); let version = '';
  for (let rep = 0; rep < R; rep++) for (let r = 0; r < rows.length; r++) {
    const row = rows[r], D = await require('./driver.js').open(which, { timeout: 300000 });
    try {
      version = D.version; await D.goto('file://' + row.file);
      const t0 = Date.now(); while (Date.now() - t0 < 60000 && !(await D.page.evaluate(() => typeof NFM !== 'undefined' && !!NFM.setGraph && typeof NFMExamples !== 'undefined'))) await new Promise((q) => setTimeout(q, 100));
      const out = await D.page.evaluate(async (c) => {
        const S = NFM.state, tick = (ms) => new Promise((q) => setTimeout(q, ms)); if (c.workers) window.NFM_GIF_WORKERS = c.workers;
        NFM.setGraph(NFMExamples.bigNetwork(c.n, 3, 7)); NFM.showTab('map'); NFM.setV({ view: 'network', arrange: 'force3d' });
        for (let i = 0; i < 400 && !(S.L && S.L.is3d && S.scene && S.scene.is3d && !NFM.pending()); i++) await tick(50);
        NFM.showTab('export'); await tick(300);
        const by = (t) => [...document.querySelectorAll('#gif-card label.field')].find((l) => l.textContent.startsWith(t)).querySelector('select'), put = (s, v) => { s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); };
        put(by('Width'), '960'); put(by('Smoothness'), String(c.fps)); put(by('Seconds per turn'), c.sec);
        if (c.filter) { await NFM.gifRun({ filter: Object.assign({ brightness: 0, contrast: 0, saturation: 0, warmth: 0, hue: 0, tone: 'none', blur: 0, sharpen: 0, glow: 0, vignette: 0 }, c.filter), pause: 0, turns: 1 }); }
        else document.getElementById('gif-go').click();
        for (let i = 0; i < 6000; i++) { const b = document.getElementById('gif-go'); const im = document.querySelector('#gif-out img'); if (b && !b.disabled && im && im.complete) break; await tick(100); }
        const t = document.querySelector('#gif-out p').textContent, m = /([\d,]+) pictures?, .*?, ([\d.]+) (KB|MB), made in ([\d.]+) seconds/.exec(t);
        return m ? { frames: +m[1].replace(/,/g, ''), size: m[2] + ' ' + m[3], ms: +m[4] * 1000 } : { err: t };
      }, { sec: row.sec, fps: row.fps, filter: row.filter, workers: row.workers, n: N });
      if (out.err) throw new Error(out.err); res[r].push(out); console.error(`rep ${rep + 1}/${R} ${row.name}: ${out.ms} ms`);
    } finally { await D.close(); }
  }
  console.log(`\n${version}, ${N}-item 3D map, 960 wide, median of ${R} fresh pages taking turns, lower is better`);
  console.log('| Case | Pictures | Size | Made in (s) |\n|---|---:|---|---:|');
  rows.forEach((row, r) => { const ms = res[r].map((x) => x.ms); console.log(`| ${row.name} | ${res[r][0].frames} | ${res[r][0].size} | ${(med(ms) / 1000).toFixed(1)} |`); });
})().catch((e) => { console.error(e); process.exit(1); });
