/* Copyright (c) 2026 JNFoo. MIT License. Experiment: does WebAssembly speed up the stress layout's inner loop (sgdSweep)?
 *   node bench/wasm/exp.js            runs in Node (V8), Firefox 158 and ungoogled-chromium 154, prints a table
 * The engine is loaded unchanged except that sgdSweep may hand its work to a WebAssembly build of the same loop (bench/wasm/sweep.c).
 * The pairs are copied into WebAssembly memory once per layout; the item positions are copied in and out on every sweep (that cost is included). */
'use strict';
const fs = require('fs'), path = require('path');
const R = (p) => fs.readFileSync(path.join(__dirname, '..', '..', p), 'utf8');
const texts = { columns: R('src/columns.js'), engine: R('src/engine.js').replace('function sgdSweep(X, pa, pb, pd, pw, cnt, eta, back) {', 'function sgdSweep(X, pa, pb, pd, pw, cnt, eta, back) { if (globalThis.__wasmSweep) return globalThis.__wasmSweep(X, pa, pb, pd, pw, cnt, eta, back);'), gen: R('bench/gen.js') };
if (texts.engine === R('src/engine.js')) throw new Error('could not patch the engine (sgdSweep signature changed)');
const wasm = { plain: fs.readFileSync(path.join(__dirname, 'sweep-plain.wasm')).toString('base64'), simd: fs.readFileSync(path.join(__dirname, 'sweep-simd.wasm')).toString('base64') };
const SIZES = [[3000, 'moderate'], [10000, 'moderate'], [30000, 'moderate'], [10000, 'complex']];

/* runs inside the page (or Node): returns rows */
async function inPage(arg) {
  const { texts, wasm, sizes } = arg;
  const g = globalThis;
  (0, eval)(texts.columns.replace(/if \(typeof module[^\n]*\n?/, '') + '\n;globalThis.NFMColumns = typeof NFMColumns !== "undefined" ? NFMColumns : globalThis.NFMColumns;');
  (0, eval)(texts.engine.replace(/if \(typeof module[^\n]*\n?/, '').replace(/var C = typeof NFMColumns[^\n]*\n/, 'var C = globalThis.NFMColumns;\n') + '\n;globalThis.NFMEngine = NFMEngine;');
  (0, eval)(texts.gen.replace(/if \(typeof module[^\n]*\n?/, '') + '\n;globalThis.NFMGen = NFMGen;');
  const E = g.NFMEngine, C = g.NFMColumns, GEN = g.NFMGen, rows = [];
  const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  async function mk(b64) {
    const mem = new WebAssembly.Memory({ initial: 1024, maximum: 32768 });   // 64 MB to start
    const inst = (await WebAssembly.instantiate(bytes(b64), { env: { memory: mem } })).instance, ex = inst.exports, wmem = ex.memory || mem;
    let cache = null;
    return function (X, pa, pb, pd, pw, cnt, eta, back) {
      if (!cache || cache.pa !== pa) {
        const need = (1 << 20) + X.length * 8 + cnt * 16 + 64;
        if (need > wmem.buffer.byteLength) wmem.grow(Math.ceil((need - wmem.buffer.byteLength) / 65536));
        const xo = 1 << 20, ao = xo + X.length * 8, bo = ao + cnt * 4, dof = bo + cnt * 4, wo = dof + cnt * 4;
        new Int32Array(wmem.buffer, ao, cnt).set(pa.subarray(0, cnt)); new Int32Array(wmem.buffer, bo, cnt).set(pb.subarray(0, cnt));
        new Float32Array(wmem.buffer, dof, cnt).set(pd.subarray(0, cnt)); new Float32Array(wmem.buffer, wo, cnt).set(pw.subarray(0, cnt));
        cache = { pa, xo, ao, bo, dof, wo };
      }
      new Float64Array(wmem.buffer, cache.xo, X.length).set(X);
      ex.sweep(cache.xo, cache.ao, cache.bo, cache.dof, cache.wo, cnt, eta, back);
      X.set(new Float64Array(wmem.buffer, cache.xo, X.length));
    };
  }
  const variants = { js: null, wasm: await mk(wasm.plain), 'wasm+simd': await mk(wasm.simd) };
  for (const [n, kind] of sizes) {
    const graph = GEN.graph(kind, n, 11), dg = C.derive(JSON.parse(JSON.stringify(graph)));
    const row = { n, kind }, outs = {};
    for (const [vn, fn] of Object.entries(variants)) {
      g.__wasmSweep = fn;
      let best = Infinity, L;
      for (let r = 0; r < (n >= 30000 ? 2 : 3); r++) { const t = performance.now(); L = E.build(dg, { view: 'network', arrange: 'stress', colorBy: 'group' }); best = Math.min(best, performance.now() - t); }
      row[vn] = Math.round(best); outs[vn] = L.nodes.map((q) => q.cx);
    }
    g.__wasmSweep = null;
    let same = true; for (let i = 0; i < outs.js.length; i++) if (Math.abs(outs.js[i] - outs.wasm[i]) > 1e-6) { same = false; break; }
    row.same = same; rows.push(row);
  }
  return rows;
}
(async () => {
  const arg = { texts, wasm, sizes: SIZES }, all = {};
  all.node = await inPage(arg);
  const { open } = require('../driver.js');
  for (const which of ['chromium', 'firefox']) {
    const D = await open(which, { timeout: 1800000 });
    try { await D.goto('about:blank'); all[which + ' ' + D.version.replace(/^chromium /, '')] = await D.page.evaluate(inPage, arg); }
    catch (e) { all[which] = 'failed: ' + e.message; }
    await D.close();
  }
  for (const [k, rows] of Object.entries(all)) {
    console.log('\n' + k);
    if (!Array.isArray(rows)) { console.log(rows); continue; }
    console.log('| items | kind | JS ms | WebAssembly ms | WebAssembly+SIMD ms | same result |\n| ---: | --- | ---: | ---: | ---: | --- |');
    rows.forEach((r) => console.log(`| ${r.n} | ${r.kind} | ${r.js} | ${r.wasm} | ${r['wasm+simd']} | ${r.same ? 'yes' : 'NO'} |`));
  }
  fs.writeFileSync(path.join(__dirname, '..', 'results', 'wasm.json'), JSON.stringify(all, null, 1));
})();
