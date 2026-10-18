// Copyright (c) 2026 LFC Foundry. MIT License.
// Stage A prototype, times only, in any of the four test browsers (one at a time): pack every scene link into typed arrays, make link objects again, and read how far the packed values drift. Heap is read by page-pack.js (Chromium only: the other browsers give no exact heap).
// Run:  node bench/memory/page-pack-times.js chromium|firefox|webkit|epiphany 100000      (Firefox: xvfb-run -a with NFM_HEADFUL=1, as in test/browser.test.js)
const path = require('path'), which = process.argv[2] || 'chromium', N = Number(process.argv[3]) || 30000;
const URL = 'file://' + path.resolve(process.env.NFM_PAGE || path.resolve(__dirname, '..', '..', 'index.html')) + '?tunesizes=1500', HOME = process.env.HOME || '/root';
async function open() {
  if (which === 'webkit' || which === 'epiphany') { const b = await require('../webkit-driver.js').launch({ browser: which === 'epiphany' ? 'epiphany' : 'webkitgtk', width: 1100, height: 720 }); return { page: b.page, close: () => b.close(), version: b.version, wait: (fn, arg, ms) => b.page.waitForFunction(fn, arg, { timeout: ms }) }; }
  if (which === 'firefox') { const pp = require(process.env.NFM_PUPPETEER || '/tmp/pptr/node_modules/puppeteer-core'); const b = await pp.launch({ browser: 'firefox', executablePath: process.env.NFM_FIREFOX || HOME + '/browsers/firefox/firefox', headless: !process.env.NFM_HEADFUL, protocol: 'webDriverBiDi', env: Object.assign({}, process.env, { LIBGL_ALWAYS_SOFTWARE: '1' }), extraPrefsFirefox: { 'webgl.force-enabled': true } }); const page = await b.newPage(); await page.setViewport({ width: 1100, height: 720 }); return { page, close: () => b.close(), version: 'firefox ' + await b.version(), wait: (fn, arg, ms) => page.waitForFunction(fn, { timeout: ms }, arg) }; }
  const pw = require(process.env.NFM_PLAYWRIGHT || 'playwright-core'); const b = await pw.chromium.launch({ executablePath: process.env.NFM_CHROME || HOME + '/browsers/ungoogled-chromium-155.0.8059.39-1-x86_64_linux/chrome', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await b.newContext({ viewport: { width: 1100, height: 720 } })).newPage(); return { page, close: () => b.close(), version: 'chromium ' + b.version(), wait: (fn, arg, ms) => page.waitForFunction(fn, arg, { timeout: ms }) };
}
(async () => {
  const B = await open(), page = B.page; console.log('browser', which, B.version, ', items', N);
  await page.goto(URL); await B.wait(() => window.NFM && NFM.client() && NFM.client().mode !== 'starting', null, 30000);
  await page.evaluate((a) => { NFM.setGraph(NFMExamples.bigNetwork(a.n, 12, 7)); NFM.setV({ view: 'network', arrange: a.ar }); NFM.showTab('map'); }, { n: N, ar: process.env.NFM_HOVER ? 'force' : 'sphere' });
  await B.wait((n) => NFM.state.L && NFM.state.sceneOk && NFM.state.L.nodes.length > n * 0.98, N, 300000); await new Promise((r) => setTimeout(r, 2000));
  if (process.env.NFM_HOVER) {   /* the first hover on a flat map: time of the first pick (builds the hover index) and of the next one, median of 3 fresh scenes is too slow, so the first of each of 3 different points on one scene is not possible; one scene, first and next */
    const r = await page.evaluate(() => { const sc = NFM.state.scene, t0 = performance.now(); NFMScene.pickEdge(sc, sc.x0 + sc.w / 2, sc.y0 + sc.h / 2, 8); const t1 = performance.now(), a = [], I = sc.eidx; for (let i = 0; i < 20; i++) { const q = performance.now(); NFMScene.pickEdge(sc, sc.x0 + sc.w * (0.3 + 0.02 * i), sc.y0 + sc.h / 2, 8); a.push(performance.now() - q); } a.sort((x, y) => x - y); return { first: t1 - t0, next: a[10], links: sc.curveCount(), idx: I.ids ? Math.round((I.segs.byteLength + I.sci.byteLength + I.off.byteLength + I.ids.byteLength + I.mark.byteLength) / 1048576) : null }; });
    console.log('flat map,', r.links, 'links: first hover (builds the index)', r.first.toFixed(0), 'ms; a later hover (median of 20)', r.next.toFixed(1), 'ms (lower is better); typed index', r.idx === null ? 'n/a (earlier index)' : r.idx + ' MB'); await B.close(); return;
  }
  if (process.env.NFM_REAL) {   /* the app's own link store: pack everything now, then read every link (makes the objects again); median of 3 */
    const R = []; for (let r = 0; r < 3; r++) R.push(await page.evaluate(() => { const sc = NFM.state.scene; sc.autoPack({ delay: 1e9, min: 1e12 }); sc.curves.length; const t0 = performance.now(), ok = sc.packNow(), pk = performance.now() - t0, t1 = performance.now(); sc.curves.length; return { M: sc.curveCount(), ok, pk, rd: performance.now() - t1 }; }));
    const m = (k) => R.map((x) => x[k]).sort((a, b) => a - b)[1]; console.log('app link store,', R[0].M, 'links, packed ok:', R.every((x) => x.ok), '; median of 3 (lower is better): pack all', m('pk').toFixed(0), 'ms; read every link (objects again)', m('rd').toFixed(0), 'ms'); await B.close(); return;
  }
  const runs = []; for (let r = 0; r < 3; r++) runs.push(await page.evaluate(() => {
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
    // drift of packed values against the originals (sample), and the time to make objects again
    let dP = 0, dBB = 0, dCol = 0, dW = 0, wrong = 0;
    for (const [i] of sample) { const c = cs[i], m = make(i); for (let j = 0; j < 8; j++) dP = Math.max(dP, Math.abs(c.P[j] - m.P[j])); for (let j = 0; j < 4; j++) { dBB = Math.max(dBB, Math.abs(c.bb[j] - m.bb[j])); dCol = Math.max(dCol, Math.abs(c.color[j] - m.color[j]) * 255); } dW = Math.max(dW, Math.abs(c.w - m.w)); if (c.from !== m.from || c.to !== m.to || c.edge !== m.edge || c.arrow !== m.arrow || c.line !== m.line || c.dash !== m.dash) wrong++; }
    const t1 = performance.now(); let sink = 0; for (let i = 0; i < Math.min(M, 5000); i++) sink += make(i).w; const screenMs = performance.now() - t1;
    const t2 = performance.now(); const all = new Array(M); for (let i = 0; i < M; i++) all[i] = make(i); const allMs = performance.now() - t2;
    return { M, packMs, packedMB, dP, dBB, dCol, dW, wrong, screenMs, allMs };
  }));
  const med = (k) => runs.map((x) => x[k]).sort((a, b) => a - b)[1], r0 = runs[0];
  console.log('links', r0.M, '; packed size', r0.packedMB.toFixed(1), 'MB; drift: path', r0.dP.toExponential(2), 'box', r0.dBB.toExponential(2), 'color steps', r0.dCol.toFixed(2), '; fields that differ', r0.wrong);
  console.log('median of 3 (lower is better): pack all', med('packMs').toFixed(0), 'ms; make all link objects again', med('allMs').toFixed(0), 'ms; make a screenful (5,000)', med('screenMs').toFixed(1), 'ms');
  await B.close();
})();
