// Copyright (c) 2026 LFC Foundry. MIT License.
// Netflow Map in ungoogled-chromium: which parts of the page state hold the JavaScript heap with a big network shown. Each object is counted once, under the first state field that reaches it; sizes are estimates (8 bytes a slot, 24 bytes an object, typed arrays exact) and are compared with the exact heap.
// Run:  NFM_PLAYWRIGHT=<path to playwright-core> node bench/memory/page-who.js 100000
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
  for (let i = 0; i < 6; i++) { await page.evaluate(() => { gc(); }); await new Promise((r) => setTimeout(r, 150)); }
  const r = await page.evaluate(() => {
    const S = NFM.state, seen = new Set(), rows = [], heapMB = performance.memory.usedJSHeapSize / 1048576;
    const roots = []; for (const k of Object.keys(S)) { const v = S[k]; if (v && typeof v === 'object') roots.push(['S.' + k, v]); }
    const sizeOf = (o) => { if (ArrayBuffer.isView(o)) return { b: o.byteLength, typed: o.byteLength, n: 1 }; if (Array.isArray(o)) return { b: 16 + 8 * o.length, typed: 0, n: 1 }; if (o instanceof Map || o instanceof Set) return { b: 64 + 24 * o.size, typed: 0, n: 1 }; let c = 0; for (const _ in o) c++; return { b: 24 + 8 * c, typed: 0, n: 1 }; };
    for (const [name, root] of roots) {
      let bytes = 0, typed = 0, objs = 0; const stack = [root];
      while (stack.length) {
        const o = stack.pop(); if (!o || typeof o !== 'object' || seen.has(o)) continue; seen.add(o);
        if (o instanceof Node || o instanceof Window || o instanceof WebGLRenderingContext || (window.WebGL2RenderingContext && o instanceof WebGL2RenderingContext) || o instanceof Worker) continue;
        const s = sizeOf(o); bytes += s.b; typed += s.typed; objs += s.n;
        if (ArrayBuffer.isView(o)) continue;
        if (o instanceof Map) { for (const [k, v] of o) { stack.push(k, v); } continue; }
        if (o instanceof Set) { for (const v of o) stack.push(v); continue; }
        if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) { const v = o[i]; if (v && typeof v === 'object') stack.push(v); } continue; }
        let d; try { for (const k in o) { const v = o[k]; if (v && typeof v === 'object') stack.push(v); } } catch (e) {}
      }
      rows.push({ name, mb: bytes / 1048576, typedMB: typed / 1048576, objs });
    }
    rows.sort((a, b) => b.mb - a.mb); return { heapMB, rows: rows.slice(0, 14), total: rows.reduce((a, x) => a + x.mb, 0), nodes: S.L.nodes.length, edges: S.L.edges.length };
  });
  if (process.env.NFM_INSIDE) {   /* one level deeper: the parts of one state field (NFM_INSIDE=scene or L) */
    const q = await page.evaluate((key) => {
      const S = NFM.state, root = S[key], seen = new Set(), out = [];
      const sz = (o) => { if (ArrayBuffer.isView(o)) return o.byteLength; if (Array.isArray(o)) return 16 + 8 * o.length; if (o instanceof Map || o instanceof Set) return 64 + 24 * o.size; let c = 0; for (const _ in o) c++; return 24 + 8 * c; };
      for (const k of Object.keys(root)) {
        const v = root[k]; let bytes = 0, objs = 0, len = v && v.length !== undefined ? v.length : (v && v.size);
        if (v && typeof v === 'object') { const st = [v]; while (st.length) { const o = st.pop(); if (!o || typeof o !== 'object' || seen.has(o)) continue; seen.add(o); if (o instanceof Node || o instanceof Window) continue; bytes += sz(o); objs++; if (ArrayBuffer.isView(o)) continue; if (o instanceof Map) { for (const [a, c] of o) st.push(a, c); continue; } if (o instanceof Set) { for (const c of o) st.push(c); continue; } if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) if (o[i] && typeof o[i] === 'object') st.push(o[i]); continue; } for (const kk in o) { const c = o[kk]; if (c && typeof c === 'object') st.push(c); } } }
        out.push({ k, mb: bytes / 1048576, objs, len, t: Array.isArray(v) ? 'array' : v && v.constructor ? v.constructor.name : typeof v });
      }
      out.sort((a, b) => b.mb - a.mb); return out.slice(0, 16);
    }, process.env.NFM_INSIDE);
    console.log('inside S.' + process.env.NFM_INSIDE + ' (est. MB, objects, length, kind)'); for (const x of q) console.log(('  ' + x.k).padEnd(24) + x.mb.toFixed(1).padStart(8) + String(x.objs).padStart(10) + String(x.len === undefined ? '' : x.len).padStart(9) + '  ' + x.t);
  }
  console.log('exact page heap', Math.round(r.heapMB), 'MB; estimated from state', Math.round(r.total), 'MB; nodes', r.nodes, 'edges', r.edges);
  console.log('state field'.padEnd(22) + 'est. MB'.padStart(9) + '  of it typed'.padStart(13) + '  objects');
  for (const x of r.rows) console.log(x.name.padEnd(22) + x.mb.toFixed(1).padStart(9) + x.typedMB.toFixed(1).padStart(13) + String(x.objs).padStart(10));
  await b.close();
})();
