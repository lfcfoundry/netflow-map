/* Copyright (c) 2026 LFC Foundry. MIT License. Plain straight links on the WebGL 2 card: the six-corner records (60 numbers a link) against 9 numbers a link built into a quad by the vertex shader, taking turns in one page per browser.
 *   node bench/inst-links.js chromium|firefox|webkit|epiphany [rounds]
 * Per size (10,000 / 100,000 / 300,000 links): milliseconds of main-thread work to put a new scene on the card (setScene: building the arrays and sending them), the first draw and the picture check (the pictures must be the same). Milliseconds and megabytes, lower is better. */
'use strict';
const path = require('path');
(async () => {
  const which = process.argv[2] || 'chromium', rounds = +(process.argv[3] || 5);
  const D = await require('./driver.js').open(which, { timeout: 3600000 });
  const wait = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await D.page.evaluate(fn)) return; await new Promise((r) => setTimeout(r, 250)); } throw new Error('timed out waiting'); };
  await D.goto('file://' + path.resolve(__dirname, '..', 'index.html')); await wait(() => typeof NFM !== 'undefined', 60000);
  await D.page.evaluate(() => { NFM.setGraph(NFMExamples.bigNetwork(3000, 4, 7)); NFM.showTab('map'); NFM.setV({ view: 'network', arrange: 'circle' }); });
  await wait(() => !NFM.pending() && !!NFM.state.scene && !!NFM.manager().canary, 600000);
  const res = await D.page.evaluate(async ([rounds]) => {
    const m = NFM.manager(); m.canary.webgl2 = { ok: true }; await m.use('webgl2'); if (m.r.name !== 'webgl2') return { err: 'n/a' };
    const r = m.r, A = NFM.state.scene, D = A.dots, v = { k: 0.6, tx: 20, ty: 20 }, med = (a) => a.slice().sort((p, q) => p - q)[a.length >> 1];
    const out = {};
    for (const N of [10000, 100000, 300000]) {
      const links = []; let s = 12345; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
      for (let i = 0; i < N; i++) { const p = D[Math.floor(rnd() * D.length)], q = D[Math.floor(rnd() * D.length)]; links.push({ P: [p.cx, p.cy, p.cx, p.cy, q.cx, q.cy, q.cx, q.cy], w: 1 + (i % 4) * 0.5, color: [0.3, 0.4 + (i % 3) * 0.1, 0.8, 0.5 + (i % 4) * 0.1], line: true, dash: 0, arrow: false, edge: i, from: 0, to: 0 }); }
      const S1 = Object.assign({}, A, { curves: links, ribbons: [], polys: [], curveView: undefined, curveCount: undefined });
      const t = { old: { set: [], draw: [], again: [] }, inst: { set: [], draw: [], again: [] } };
      const once = async (on) => { r.instLinks(on); const t0 = performance.now(); r.setScene(S1); const t1 = performance.now(); r.draw(v); await r.flush(); const t2 = performance.now(); const k = on ? t.inst : t.old; k.set.push(t1 - t0); k.draw.push(t2 - t1); const u = []; for (let q = 0; q < 3; q++) { const a0 = performance.now(); r.draw(v); await r.flush(); u.push(performance.now() - a0); } u.sort((p, q) => p - q); k.again.push(u[1]); };
      await once(false); await once(true);   // warm-up pair
      [t.old, t.inst].forEach((q) => { q.set.length = q.draw.length = q.again.length = 0; });
      for (let k = 0; k < rounds; k++) { const order = k % 2 ? [true, false] : [false, true]; for (const on of order) await once(on); }
      r.instLinks(false); r.setScene(S1); r.draw(v); const a = r.snapshot(); await r.flush(); const ad = new Uint8ClampedArray(a.data);
      r.instLinks(true); r.setScene(S1); r.draw(v); const b = r.snapshot(); await r.flush(); let bad = 0, sum = 0; for (let i = 0; i < ad.length; i += 4) { const d = (Math.abs(ad[i] - b.data[i]) + Math.abs(ad[i + 1] - b.data[i + 1]) + Math.abs(ad[i + 2] - b.data[i + 2])) / 3; sum += d; if (d > 2) bad++; }
      r.instLinks(null); r.setScene(S1); const pick = { chose: r.usesInst(), probe: r.instProbe };
      out[N] = { pick, oldSet: med(t.old.set), instSet: med(t.inst.set), oldDraw: med(t.old.draw), instDraw: med(t.inst.draw), oldAgain: med(t.old.again), instAgain: med(t.inst.again), mb: [N * 240 / 1048576, N * 36 / 1048576], mean: sum / (ad.length / 4), badPct: bad / (ad.length / 4) * 100 };
    }
    return out;
  }, [rounds]);
  const version = D.version; await D.close();
  if (res.err) { console.log(version + ': ' + res.err); process.exit(0); }
  console.log('\n' + version + ' (median of ' + rounds + ' rounds, taking turns; main-thread ms, lower is better)');
  console.log('| Links | Put on card: corners ms | 9 numbers ms | Faster | First draw: corners ms | 9 numbers ms | Redraw: corners ms | 9 numbers ms | Data: corners MB | 9 numbers MB | Picture mean diff / pixels off | The app own pick (probe ms: 9 numbers vs corners) |\n|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const N of Object.keys(res)) { const x = res[N]; console.log('| ' + (+N).toLocaleString('en-US') + ' | ' + x.oldSet.toFixed(1) + ' | ' + x.instSet.toFixed(1) + ' | ' + (x.oldSet / x.instSet).toFixed(1) + 'x | ' + x.oldDraw.toFixed(1) + ' | ' + x.instDraw.toFixed(1) + ' | ' + x.oldAgain.toFixed(1) + ' | ' + x.instAgain.toFixed(1) + ' | ' + x.mb[0].toFixed(1) + ' | ' + x.mb[1].toFixed(1) + ' | ' + x.mean.toFixed(3) + ' / ' + x.badPct.toFixed(3) + '% | ' + (x.pick.chose ? '9 numbers' : 'corners') + (x.pick.probe ? ' (' + x.pick.probe.inst.toFixed(1) + ' vs ' + x.pick.probe.corners.toFixed(1) + ' ms)' : '') + ' |'); }
  require('fs').writeFileSync(path.join(__dirname, 'results', 'inst-links-' + which + '.json'), JSON.stringify({ version, rounds, res }, null, 1));
  process.exit(0);
})();
