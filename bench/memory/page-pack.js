// Copyright (c) 2026 LFC Foundry. MIT License.
// Stage A prototype (measurement only, nothing in the app changes): with a big network shown, pack every scene link into typed arrays, let the link objects go, and read the real heap, the packing time, the time to make link objects again (all of them, and a screenful) and how far the packed values drift from the originals.
// Run:  NFM_PLAYWRIGHT=<path to playwright-core> node bench/memory/page-pack.js 100000
// Line 1 prints the browser version. Chromium gives exact heap and a forced collection; for the other browsers use NFM_TIMEONLY=1 (times and drift only).
const path = require('path'), pw = require(process.env.NFM_PLAYWRIGHT || 'playwright-core');
const N = Number(process.argv[2]) || 30000, URL = 'file://' + path.resolve(process.env.NFM_PAGE || path.resolve(__dirname, '..', '..', 'index.html')) + '?tunesizes=1500';
const CH = process.env.NFM_CHROME || (process.env.HOME || '/root') + '/browsers/ungoogled-chromium-155.0.8059.39-1-x86_64_linux/chrome';
(async () => {
  const b = await pw.chromium.launch({ executablePath: CH, headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--js-flags=--expose-gc', '--enable-precise-memory-info'] });
  console.log('browser chromium', b.version(), ', items', N);
  const page = await (await b.newContext({ viewport: { width: 1100, height: 720 } })).newPage();
  await page.goto(URL); await page.waitForFunction(() => window.NFM && NFM.client() && NFM.client().mode !== 'starting', null, { timeout: 20000 });
  await page.evaluate((n) => { NFM.setGraph(NFMExamples.bigNetwork(n, 12, 7)); NFM.setV({ view: 'network', arrange: 'sphere' }); NFM.showTab('map'); }, N);
  await page.waitForFunction((n) => NFM.state.L && NFM.state.sceneOk && NFM.state.L.nodes.length > n * 0.98, N, { timeout: 240000 }); await new Promise((r) => setTimeout(r, 2000));
  const heap = async () => { for (let i = 0; i < 6; i++) { await page.evaluate(() => { gc(); }); await new Promise((r) => setTimeout(r, 150)); } return page.evaluate(() => performance.memory.usedJSHeapSize / 1048576); };
  const rows = [], before = await heap();
  const info = await page.evaluate(() => {
    const S = NFM.state, sc = S.scene, cs = sc.curves, M = cs.length, ids = new Map(); S.L.nodes.forEach((n, i) => ids.set(n.id, i)); const idList = S.L.nodes.map((n) => n.id);
    const sample = []; for (let i = 0; i < M; i += Math.max(1, Math.floor(M / 20000))) sample.push([i, JSON.stringify(cs[i])]);
    const P = new Float32Array(M * 8), BB = new Float32Array(M * 4), COL = new Uint8Array(M * 4), W = new Float32Array(M), BW = new Float32Array(M), DASH = new Float32Array(M), A = new Float32Array(M), EDGE = new Int32Array(M), FR = new Int32Array(M), TO = new Int32Array(M), FL = new Uint8Array(M);
    for (let i = 0; i < M; i++) { const c = cs[i]; if (c.bb === undefined) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (let j = 0; j < c.P.length; j += 2) { x0 = Math.min(x0, c.P[j]); x1 = Math.max(x1, c.P[j]); y0 = Math.min(y0, c.P[j + 1]); y1 = Math.max(y1, c.P[j + 1]); } c.bb = [x0 - 12, y0 - 12, x1 + 12, y1 + 12]; } }   /* the renderer adds the box in setScene; some browsers have not yet */
    const t0 = performance.now();
    for (let i = 0; i < M; i++) {
      const c = cs[i], p = c.P, o = i * 8; P[o] = p[0]; P[o + 1] = p[1]; P[o + 2] = p[2]; P[o + 3] = p[3]; P[o + 4] = p[4]; P[o + 5] = p[5]; P[o + 6] = p[6]; P[o + 7] = p[7];
      const bb = c.bb, q = i * 4; BB[q] = bb[0]; BB[q + 1] = bb[1]; BB[q + 2] = bb[2]; BB[q + 3] = bb[3];
      const k = c.color; COL[q] = Math.round(k[0] * 255); COL[q + 1] = Math.round(k[1] * 255); COL[q + 2] = Math.round(k[2] * 255); COL[q + 3] = Math.round(k[3] * 255);
      W[i] = c.w; BW[i] = c.base ? c.base.w : c.w; DASH[i] = c.dash; A[i] = c.a === undefined ? 1 : c.a; EDGE[i] = c.edge; FR[i] = ids.get(c.from); TO[i] = ids.get(c.to);
      FL[i] = (c.arrow ? 1 : 0) | (c.line ? 2 : 0) | (c.base && c.base.color === c.color ? 4 : 0);
    }
    const packMs = performance.now() - t0, packedMB = (P.byteLength + BB.byteLength + COL.byteLength + W.byteLength * 5 + EDGE.byteLength * 3 + FL.byteLength) / 1048576;
    const make = (i) => { const q = i * 4, col = [COL[q] / 255, COL[q + 1] / 255, COL[q + 2] / 255, COL[q + 3] / 255], o = i * 8, f = FL[i];
      return { P: [P[o], P[o + 1], P[o + 2], P[o + 3], P[o + 4], P[o + 5], P[o + 6], P[o + 7]], w: W[i], color: col, arrow: !!(f & 1), line: !!(f & 2), tip: undefined, edge: EDGE[i], from: idList[FR[i]], to: idList[TO[i]], dash: DASH[i], base: { w: BW[i], color: col }, a: A[i], bb: [BB[q], BB[q + 1], BB[q + 2], BB[q + 3]] }; };
    window.__pack = { make, M };
    // drift of packed values against the originals (sample), and the time to make objects again
    let dP = 0, dBB = 0, dCol = 0, dW = 0, wrong = 0;
    for (const [i] of sample) { const c = cs[i], m = make(i); for (let j = 0; j < 8; j++) dP = Math.max(dP, Math.abs(c.P[j] - m.P[j])); for (let j = 0; j < 4; j++) { dBB = Math.max(dBB, Math.abs(c.bb[j] - m.bb[j])); dCol = Math.max(dCol, Math.abs(c.color[j] - m.color[j]) * 255); } dW = Math.max(dW, Math.abs(c.w - m.w)); if (c.from !== m.from || c.to !== m.to || c.edge !== m.edge || c.arrow !== m.arrow || c.line !== m.line || c.dash !== m.dash) wrong++; }
    const t1 = performance.now(); let sink = 0; for (let i = 0; i < Math.min(M, 5000); i++) sink += make(i).w; const screenMs = performance.now() - t1;
    const t2 = performance.now(); const all = new Array(M); for (let i = 0; i < M; i++) all[i] = make(i); const allMs = performance.now() - t2;
    window.__make = make; return { M, packMs, packedMB, dP, dBB, dCol, dW, wrong, screenMs, allMs, sink };
  });
  let px = null;
  if (process.env.NFM_PIXELS) {   /* same picture from rebuilt link objects? screenshot, swap the objects for rebuilt ones, redraw, screenshot, compare every byte */
    const shot = async () => page.screenshot({ clip: { x: 0, y: 0, width: 1100, height: 720 } });
    const a = await shot();
    await page.evaluate(() => { const sc = NFM.state.scene, n = sc.curves.length, all = new Array(n); for (let i = 0; i < n; i++) all[i] = window.__make(i); sc.curves = all; const m = NFM.manager(); if (m && m.r) { m.r.setScene(sc); } });
    await new Promise((r) => setTimeout(r, 1500)); const c = await shot();
    px = { same: a.equals(c), bytes: a.length, differ: a.equals(c) ? 0 : [...a].reduce((k, v, i) => k + (v !== c[i] ? 1 : 0), 0) };
  }
  const objs = await heap(); rows.push(['scene before (all link objects held)', before]);
  // let the link objects go: the scene keeps only an empty list; the packed arrays stay in a page variable
  if (!px) await page.evaluate(() => { window.__sc = NFM.state.scene; window.__curves = NFM.state.scene.curves; NFM.state.scene.curves = []; window.__curves = null; window.__tmp = null; });
  const after = await heap(); rows.push(['link objects let go, packed arrays kept', after]);
  console.log('links', info.M, ' pack time', info.packMs.toFixed(0), 'ms (lower is better); packed size', info.packedMB.toFixed(1), 'MB');
  console.log('make all link objects again', info.allMs.toFixed(0), 'ms; a screenful (5,000)', info.screenMs.toFixed(1), 'ms (lower is better)');
  console.log('largest drift on a sample: path', info.dP.toExponential(2), ' box', info.dBB.toExponential(2), ' width', info.dW.toExponential(2), ' color (0 to 255 steps)', info.dCol.toFixed(2), ' fields that differ:', info.wrong);
  if (px) console.log('same picture after swapping in rebuilt link objects:', px.same, px.same ? '' : '(' + px.differ + ' of ' + px.bytes + ' bytes differ)');
  console.log('step'.padEnd(46) + ' page heap MB (lower is better)'); for (const [n, v] of rows) console.log(n.padEnd(46) + String(Math.round(v)).padStart(8));
  console.log('change'.padEnd(46) + String(Math.round(after - before)).padStart(8)); await b.close();
})();
