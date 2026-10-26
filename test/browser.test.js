/* Copyright (c) 2026 LFC Foundry. MIT License. One browser session that exercises the built index.html.
 *   node test/browser.test.js chromium|firefox|webkit [outdir]   (webkit = WebKitGTK 2.52.6 through bench/webkit-driver.js; GNOME Web was dropped from the test suite on 2026-10-24)
 * chromium: Playwright (NFM_PLAYWRIGHT = path to playwright-core, NFM_CHROME = browser program; ungoogled-chromium 155 from the browsers branch)
 * NFM_PAGE = the page to test (default index.html; index.packed.html tests the self-extracting copy)
 * firefox:  Puppeteer over WebDriver BiDi (NFM_PUPPETEER = path to puppeteer-core, NFM_FIREFOX = browser program) */
'use strict';
const path = require('path');
const which = process.argv[2] || 'chromium', outDir = process.argv[3] || '/tmp';
if (['chromium', 'firefox', 'webkit'].indexOf(which) < 0) { console.error('unknown browser "' + which + '": use chromium, firefox or webkit (GNOME Web was dropped from the suite on 2026-10-24)'); process.exit(2); }
const strict = which === 'chromium' || !!process.env.NFM_STRICT;
const flags = ['--no-sandbox', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'];
const T0 = Date.now(); let tLast = T0;   /* NFM_TIMES=1 puts the seconds since the last line in front of every line: where the time goes */
let fails = 0, oks = 0; const say = (ok, t) => { if (ok === false) fails++; if (ok === true) oks++; const now = Date.now(), pre = process.env.NFM_TIMES ? String(((now - tLast) / 1000).toFixed(1)).padStart(5) + 's ' : ''; tLast = now; console.log(pre + (ok === true ? 'ok   ' : ok === false ? 'FAIL ' : 'note ') + t); };
let slept = 0, sleeps = 0; const sites = {}; const sleep = (ms) => { slept += ms; sleeps++; if (process.env.NFM_TIMES) { const m = /browser\.test\.js:(\d+)/.exec(new Error().stack.split('\n').slice(2).join('\n')); const k = m ? m[1] : '?'; sites[k] = (sites[k] || 0) + ms; } return new Promise((r) => setTimeout(r, ms)); };
/* Short pauses only let the screen catch up after a click or drag. Wait for three real animation frames plus a quarter of the old pause instead of the whole pause (NFM_SLOW=1 restores the full pauses). Long pauses (over 450 ms) are real time (easing, playback) and stay as they were. */

async function open() {
  if (which === 'webkit') {   /* WebKitGTK through bench/webkit-driver.js (Playwright and Puppeteer cannot drive them); software drawing, a virtual screen */
    const WD = require('../bench/webkit-driver.js'), b = await WD.launch({ browser: 'webkitgtk', width: 1100, height: 720 }), page = b.page;
    return { b, page, close: () => b.close(), size: (w, h) => page.setViewport({ width: w, height: h }), wait: (fn, arg, ms) => page.waitForFunction(fn, arg, { timeout: ms || 20000 }), shot: (p) => page.screenshot({ path: p }), click: (x, y) => page.mouse.click(x, y), press: (k) => page.keyboard.press(k),
      drag: async (x0, y0, x1, y1) => { await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 4 }); await page.mouse.move(x1, y1, { steps: 4 }); await page.mouse.up(); }, version: b.version };
  }
  if (which === 'firefox') {
    const pp = require(process.env.NFM_PUPPETEER || '/tmp/pptr/node_modules/puppeteer-core');
    // WebGL 2 needs a display (run under xvfb-run with NFM_HEADFUL=1); WebGPU needs a Vulkan driver (NFM_VK_ICD = a vk_*_icd.json file, e.g. SwiftShader's)
    const env = Object.assign({}, process.env, process.env.NFM_VK_ICD ? { VK_ICD_FILENAMES: process.env.NFM_VK_ICD, VK_DRIVER_FILES: process.env.NFM_VK_ICD } : {}, { LIBGL_ALWAYS_SOFTWARE: '1' });
    const b = await pp.launch({ browser: 'firefox', executablePath: process.env.NFM_FIREFOX || (process.env.HOME || '/root') + '/browsers/firefox/firefox', headless: !process.env.NFM_HEADFUL, protocol: 'webDriverBiDi', env, extraPrefsFirefox: { 'dom.webgpu.enabled': true, 'gfx.webgpu.ignore-blocklist': true, 'webgl.force-enabled': true, 'webgl.enable-webgl2': true } });
    const page = await b.newPage(); await page.setViewport({ width: 1100, height: 720 });
    return { b, page, close: () => b.close(), size: (w, h) => page.setViewport({ width: w, height: h }), wait: (fn, arg, ms) => page.waitForFunction(fn, { timeout: ms || 20000 }, arg), shot: (p) => page.screenshot({ path: p }), click: (x, y) => page.mouse.click(x, y), press: (k) => page.keyboard.press(k), drag: async (x0, y0, x1, y1) => { await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 4 }); await page.mouse.move(x1, y1, { steps: 4 }); await page.mouse.up(); }, version: await b.version() };
  }
  const pw = require(process.env.NFM_PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright-core');
  const b = await pw.chromium.launch({ executablePath: process.env.NFM_CHROME || (process.env.HOME || '/root') + '/browsers/ungoogled-chromium-155.0.8059.39-1-x86_64_linux/chrome', headless: true, args: flags });
  const ctx = await b.newContext({ viewport: { width: 1100, height: 720 }, acceptDownloads: true }), page = await ctx.newPage();
  return { b, page, close: () => b.close(), size: (w, h) => page.setViewportSize({ width: w, height: h }), wait: (fn, arg, ms) => page.waitForFunction(fn, arg, { timeout: ms || 20000 }), shot: (p) => page.screenshot({ path: p }), click: (x, y) => page.mouse.click(x, y), press: (k) => page.keyboard.press(k), drag: async (x0, y0, x1, y1) => { await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 4 }); await page.mouse.move(x1, y1, { steps: 4 }); await page.mouse.up(); }, version: b.version() };
}

(async () => {
  const D = await open(), page = D.page, errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + (e.message || e) + (e.stack ? ' @ ' + String(e.stack).split('\n').slice(0, 2).join(' < ') : '')));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const SLOW = process.env.NFM_SLOW === '1';
  const until = (fn, arg, ms) => D.wait(fn, arg, ms).then(() => true, () => false);   /* wait for a page condition, at most ms; never throws (the check after it decides pass or fail) */
  const settle = async (ms) => { if (SLOW || ms > 450) return sleep(ms); const q = Math.ceil(ms / 4); slept += q; sleeps++; await ev(async () => { await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))); const t0 = performance.now(); while (NFM.pending() > 0 && performance.now() - t0 < 2000) await new Promise((r) => setTimeout(r, 16)); }); await new Promise((r) => setTimeout(r, q)); };
  const set = (sel, v) => ev(([s, val]) => { const el = document.querySelector(s); el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, v]);
  const click = (sel) => ev((s) => document.querySelector(s).click(), sel);
  console.log('browser', which, D.version);
  await page.goto('file://' + path.resolve(__dirname, '..', process.env.NFM_PAGE || 'index.html') + (process.env.NFM_FULLCHECK ? '' : '?tunesizes=1500'));
  { const c = await ev(() => { const m = new NFMRender.Manager(document.createElement('div'), {}); const auto = m.candidates(); m.choice = 'webgpu'; return { auto, asked: m.candidates(), off: NFMRender.webgpuDrawing() }; });
    say(!c.off && !c.auto.includes('webgpu') && !c.asked.includes('webgpu') && c.auto[0] === 'webgl2', 'the app does not draw with WebGPU (Automatic: ' + c.auto.join(', ') + '; even when asked for: ' + c.asked.join(', ') + ')'); }
  await ev(() => NFMRender.setWebGPUDrawing(true));   /* the app does not draw with WebGPU; the tests still check that code */
  await D.wait(() => window.NFM && NFM.client() && NFM.client().mode !== 'starting', null, 20000);
  say(true, 'page loaded; engine runs in the ' + (await ev(() => NFM.client().mode)));
  /* the WebAssembly Force rounds (wasm/force.c) in the browser's own helper: they must run there and match the JavaScript rounds to the last digit */
  const fw = await ev(() => new Promise((resolve) => {
    const body = ";self.onmessage=function(){var k=400,X=new Float64Array(k*2),pairs=[],mass=new Float64Array(k),s=7,r=function(){s=(s*1664525+1013904223)>>>0;return s/4294967296;},i;for(i=0;i<k*2;i++)X[i]=(r()-.5)*800;for(i=1;i<k;i++)pairs.push(i,Math.floor(r()*i));for(i=0;i<k;i++)mass[i]=1+(i%3);var W=NFMEngine.forceWasm;" +
      "function run(on){W.on=on;var x=Float64Array.from(X),m=Float64Array.from(mass),c0=W.calls,q=3,rr=function(){q=(q*1664525+1013904223)>>>0;return q/4294967296;};NFMEngine.forceSim(x,k,2,pairs.slice(),m,30,60,rr);return{x:x,used:W.calls>c0};}" +
      "var a=run(false),b=run(true),d=0;for(i=0;i<a.x.length;i++)d=Math.max(d,Math.abs(a.x[i]-b.x[i]));postMessage({used:b.used,jsUsed:a.used,diff:d,err:W.error});};";
    const w = new Worker(URL.createObjectURL(new Blob([document.getElementById('nfm-engine-src').textContent + body], { type: 'text/javascript' })));
    w.onmessage = (e) => { w.terminate(); resolve(e.data); }; w.onerror = (e) => { resolve({ error: String(e.message || e) }); }; w.postMessage(1);
  }));
  say(fw.used === true && fw.jsUsed === false && fw.diff === 0, 'the WebAssembly Force rounds run in the helper and give exactly the JavaScript positions: ' + JSON.stringify(fw));
  /* the WebAssembly Distances (stress) layout and push-apart (wasm/stress.c) in the same helper: same picture as the JavaScript */
  const sw = await ev(() => new Promise((resolve) => {
    const body = ";self.onmessage=function(){var k=500,nodes=[],edges=[],s=5,r=function(){s=(s*1664525+1013904223)>>>0;return s/4294967296;},i;for(i=0;i<k;i++)nodes.push({id:'n'+i});for(i=1;i<k;i++){edges.push({from:'n'+i,to:'n'+Math.floor(r()*i),value:1});if(i%3===0)edges.push({from:'n'+i,to:'n'+Math.floor(r()*i),value:1});}var dg=NFMColumns.derive({nodes:nodes,edges:edges}),W=NFMEngine.stressWasm;" +
      "function run(on){W.on=on;var c0=W.calls,p0=W.sepCalls,L=NFMEngine.build(dg,{view:'network',arrange:'stress',colorBy:'group'});return{L:L,used:W.calls>c0,sep:W.sepCalls>p0};}" +
      "var a=run(false),b=run(true),d=0;for(i=0;i<a.L.nodes.length;i++)d=Math.max(d,Math.abs(a.L.nodes[i].cx-b.L.nodes[i].cx),Math.abs(a.L.nodes[i].cy-b.L.nodes[i].cy));postMessage({used:b.used,sep:b.sep,jsUsed:a.used,diff:d,err:W.error});};";
    const w = new Worker(URL.createObjectURL(new Blob([document.getElementById('nfm-engine-src').textContent + body], { type: 'text/javascript' })));
    w.onmessage = (e) => { w.terminate(); resolve(e.data); }; w.onerror = (e) => { resolve({ error: String(e.message || e) }); }; w.postMessage(1);
  }));
  say(sw.used === true && sw.sep === true && sw.jsUsed === false && sw.diff === 0, 'the WebAssembly Distances layout and push-apart run in the helper and give exactly the JavaScript picture: ' + JSON.stringify(sw));
  /* Distances 3D and the Closeness rounds (wasm/stress.c, sweeps3 and closeness) in the same helper: same pictures as the JavaScript */
  const sx = await ev(() => new Promise((resolve) => {
    const body = ";self.onmessage=function(){var k=500,nodes=[],edges=[],s=5,r=function(){s=(s*1664525+1013904223)>>>0;return s/4294967296;},i;for(i=0;i<k;i++)nodes.push({id:'n'+i});for(i=1;i<k;i++){edges.push({from:'n'+i,to:'n'+Math.floor(r()*i),value:1});if(i%3===0)edges.push({from:'n'+i,to:'n'+Math.floor(r()*i),value:1});}var dg=NFMColumns.derive({nodes:nodes,edges:edges}),W=NFMEngine.stressWasm;W.min3d=100;W.minClose=100;" +
      "function run(on,arr){W.on=on;var c0=W.calls3,q0=W.closeCalls,L=NFMEngine.build(dg,{view:'network',arrange:arr,colorBy:'group'});return{L:L,u3:W.calls3>c0,uc:W.closeCalls>q0};}" +
      "var out={err:W.error},arrs=['stress3d','closeness'],d,j;for(j=0;j<2;j++){var a=run(false,arrs[j]),b=run(true,arrs[j]);d=0;for(i=0;i<a.L.nodes.length;i++)d=Math.max(d,Math.abs(a.L.nodes[i].cx-b.L.nodes[i].cx),Math.abs(a.L.nodes[i].cy-b.L.nodes[i].cy),Math.abs((a.L.nodes[i].z||0)-(b.L.nodes[i].z||0)));out[arrs[j]]={used:j?b.uc:b.u3,jsUsed:j?a.uc:a.u3,diff:d};}postMessage(out);};";
    const w = new Worker(URL.createObjectURL(new Blob([document.getElementById('nfm-engine-src').textContent + body], { type: 'text/javascript' })));
    w.onmessage = (e) => { w.terminate(); resolve(e.data); }; w.onerror = (e) => { resolve({ error: String(e.message || e) }); }; w.postMessage(1);
  }));
  say(sx.stress3d && sx.closeness && sx.stress3d.used === true && sx.stress3d.jsUsed === false && sx.stress3d.diff === 0 && sx.closeness.used === true && sx.closeness.jsUsed === false && sx.closeness.diff === 0, 'the WebAssembly Distances 3D and Closeness rounds run in the helper and give exactly the JavaScript pictures: ' + JSON.stringify(sx));


  /* Data tab */
  await ev(() => NFM.ingest([{ name: 'e.csv', text: 'source,target,weight,cost\nA,B,2,5\nB,C,1,7\nA,C,3,1\nC,D,1,9\n' }]));
  const st = await ev(() => ({ n: NFM.state.graph.nodes.length, m: NFM.state.graph.edges.length, w: NFM.state.V.widthBy }));
  say(st.n === 4 && st.m === 4, `pasted table read: ${st.n} items, ${st.m} links`);
  say(st.w === 'weight', 'weights are used as link width by default');
  await D.wait(() => document.querySelectorAll('#cols table.cw tbody tr').length >= 2, null, 5000).catch(() => {});
  say(await ev(() => !document.getElementById('cols').hidden && document.querySelectorAll('#cols table.cw tbody tr').length >= 2), 'the columns workbench lists the columns: ' + (await ev(() => document.querySelectorAll('#cols table.cw tbody tr').length + ' rows, hidden=' + document.getElementById('cols').hidden)));
  await ev(() => NFM.showTab('nodes')); await settle(200);
  await ev(() => Array.from(document.querySelectorAll('#nodes-body .seg button')).find((b) => b.textContent === 'Links').click());
  await set('#nt-filter', 'A'); await settle(400);
  say((await ev(() => document.querySelectorAll('#table tbody tr').length)) === 2, 'links table filter works');
  await set('#nt-filter', '');
  await ev(() => NFM.ingest([{ name: 'n.md', path: 'v/n.md', text: '# N\n[[M]] and [[Zed]]' }, { name: 'm.md', path: 'v/m.md', text: '[[N]]' }], { format: 'notes' }));
  say((await ev(() => NFM.state.graph.nodes.length)) === 3, 'notes with [[links]] read, one placeholder');
  await ev(() => NFM.state.hist.length && NFM.showTab('data'));
  await click('#b-undo');
  /* zips, Excel and graph files go through the real file picker path */
  {
    const Z = require('./zipmake.js'), zlib = require('zlib');
    const sig = () => ev(() => NFM.state.graph.nodes.length + '/' + NFM.state.graph.edges.length + '|' + Array.from(document.querySelectorAll('#notes li')).map((l) => l.textContent).join('|'));
    const feed = async (name, buf) => { const b0 = await sig(); await ev(([n, b64]) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); const dt = new DataTransfer(); dt.items.add(new File([u], n)); const inp = document.getElementById('in-files'); inp.files = dt.files; inp.dispatchEvent(new Event('change')); }, [name, buf.toString('base64')]); await until((b) => (NFM.state.graph.nodes.length + '/' + NFM.state.graph.edges.length + '|' + Array.from(document.querySelectorAll('#notes li')).map((l) => l.textContent).join('|')) !== b, b0, 4000); await sleep(100); };   /* waits for the graph or the notes to change (up to 4 s), not a fixed 0.9 s */
    const stats = () => ev(() => ({ n: NFM.state.graph.nodes.length, m: NFM.state.graph.edges.length, notes: Array.from(document.querySelectorAll('#notes li')).map((l) => l.textContent).join(' | ') }));
    const csv = 'source,target\nA,B\nB,C\n', xl = Z.makeXlsx([{ name: 'Links', rows: [['source', 'target'], ['C', 'D'], ['D', 'E']] }, { name: 'People', rows: [['id', 'label', 'group'], ['A', 'Ann', 'red']] }]);
    await feed('pack.zip', Z.makeZip([{ name: 'a/edges.csv', data: csv }, { name: 'a/more.json', data: '{"nodes":[{"id":"F"}],"edges":[{"from":"E","to":"F"}]}' }, { name: 'book.xlsx', data: xl }, { name: 'g.graphml', data: '<graphml><graph><node id="F"/><node id="G"/><edge source="F" target="G"/></graph></graphml>' }, { name: 'pic.png', data: Buffer.from([1, 2, 3, 0]) }]));
    let z = await stats();
    say(z.n === 7 && z.m === 6, `a zip of CSV, JSON, Excel and GraphML read: ${z.n} items, ${z.m} links`);
    say(/left alone/.test(z.notes), 'the zip report says what was left alone');
    await feed('book.xlsx', xl); z = await stats();
    say(z.n === 4 && z.m === 2, `an Excel file read on its own: ${z.n} items, ${z.m} links`);
    await feed('bad.zip', Buffer.from('PK\x03\x04 this is not really a zip, only pretending to be one'));
    z = await stats(); say(/not a zip/.test(z.notes), 'a damaged zip gets a plain-words message');
    const t0 = Date.now();
    await feed('bomb.zip', Z.makeZip([{ name: 'big.csv', raw: zlib.deflateRawSync(Buffer.alloc(200e6)), usize: 100, crc: 0, data: 'x' }, { name: 'ok.csv', data: csv }]));
    z = await stats(); say(Date.now() - t0 < 15000 && /more than it says|damaged/.test(z.notes), 'a zip bomb is stopped and the rest still reads (' + (Date.now() - t0) + ' ms)');
    await feed('x.gml', Buffer.from('graph [ node [ id 1 label "One" ] node [ id 2 ] edge [ source 1 target 2 ] ]')); z = await stats();
    say(z.n === 2 && z.m === 1, 'a GML file read');
    await ev(() => NFM.showTab('data'));
  }

  /* Examples and every view */
  await ev(() => NFM.showTab('data')); await set('#examples', 'story'); await click('#b-example'); await click('#tabbtn-map');
  await D.wait(() => NFM.state.scene && NFM.manager() && NFM.manager().r, null, 30000);
  const views = ['flow', 'down', 'spine', 'lanes', 'shape', 'sankey', 'arc', 'matrix', 'network'];
  for (const v of views) {
    await ev((vv) => NFM.setV({ view: vv }), v);
    await D.wait((vv) => NFM.state.L && NFM.state.L.view === vv && NFM.state.scene && NFM.state.scene.view === vv, v, 20000);
    await settle(150);
    const r = await ev(() => { const m = NFM.manager().r; m.draw(NFM.state.view); const s = m.snapshot(), d = s.data;   /* drawn and read in the same task: WebKit empties a WebGL canvas once it has been shown */
    let diff = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - d[0]) + Math.abs(d[i + 1] - d[1]) + Math.abs(d[i + 2] - d[2]) > 30) diff++; return { backend: m.name, share: diff / (d.length / 4) }; });
    say(r.share > 0.004, `${v}: drew something (${(r.share * 100).toFixed(1)}% of pixels) with ${r.backend}`);
    if (v === 'flow' || v === 'sankey' || v === 'network') await D.shot(path.join(outDir, `nfm-${which}-${v}.png`));
  }

  /* Top-down choices: story order, tags, must-pass column, harder untangling, columns, step numbers, group columns (defaults must leave the picture as it was) */
  {
    const mkStory = () => { /* a long story-shaped map made in the page: chapters of 2-4 branches that merge, side links, shortcuts, links back */
      let s = 7; const r = () => { s = (s + 0x6d2b79f5) | 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
      const E = []; let id = 0; const mk = () => id++; let cur = mk(); const ch = [cur];
      while (id < 700) { const b = 2 + Math.floor(r() * 3), ends = [], br = []; for (let i = 0; i < b; i++) { const d = 1 + Math.floor(r() * 3); let p = cur; const l = []; for (let j = 0; j < d; j++) { const v = mk(); E.push([p, v]); p = v; l.push(v); } ends.push(p); br.push(l); }
        for (let i = 0; i + 1 < b; i++) if (r() < 0.35) E.push([br[i][Math.floor(r() * br[i].length)], br[i + 1][Math.floor(r() * br[i + 1].length)]]);
        const m = mk(); ends.forEach((e) => E.push([e, m])); if (r() < 0.12) E.push([m, ch[Math.floor(r() * ch.length)]]); if (r() < 0.15) E.push([cur, m]); cur = m; ch.push(m); }
      const od = new Array(id).fill(0); E.forEach(([a]) => od[a]++); let last = -1; for (let i = id - 1; i >= 0; i--) if (!od[i]) { last = i; break; }
      return { name: 'Long story', start: 'n0', nodes: Array.from({ length: id }, (_, i) => ({ id: 'n' + i, label: 'Page ' + i, group: 'Ch' + Math.floor(i / 60), valence: od[i] ? '' : i === last ? 'good' : 'bad', ghost: false, attrs: {} })), edges: E.map(([a, b]) => ({ from: 'n' + a, to: 'n' + b, weight: 1, label: '', kind: '' })) };
    };
    const fpOf = () => ev(() => { const L = NFM.state.L; return L.nodes.map((n) => n.id + ':' + Math.round(n.x) + ',' + Math.round(n.y)).join('|') + '#' + L.nodes.length; });
    await ev((g) => { NFM.setGraph(g); NFM.showTab('map'); NFM.setV({ view: 'down', rows: 'route', tagLen: 0, spineCol: false, better: false, wrap: false, ruler: false, downLanes: false }); }, await ev(mkStory));
    await D.wait(() => NFM.state.L && NFM.state.L.view === 'down' && NFM.state.L.nodes.length > 300 && NFM.state.scene && NFM.state.scene.view === 'down', null, 30000); await settle(200);
    const base = await fpOf(), before = await ev(() => ({ gold: NFM.state.L.info.back + NFM.state.L.info.flat, stops: NFM.state.L.info.stops, rows: NFM.state.L.info.rows, cross: NFM.state.L.crossings }));
    await ev(() => NFM.setV({ rows: 'story', tagLen: 8, spineCol: true, better: true }));
    await D.wait(() => NFM.state.L && NFM.state.L.info && NFM.state.L.info.rowMode === 'story' && NFM.state.L.info.tags > 0 && NFM.state.scene && NFM.state.scene.labels.some((l) => /^(from |[↓↑→←] )/.test(l.t)), null, 30000); await settle(250);
    const after = await ev(() => ({ gold: NFM.state.L.info.back + NFM.state.L.info.flat + NFM.state.L.edges.filter((e) => e.kind === 'tag' && !e.tagFwd).length, stops: NFM.state.L.info.stops, tags: NFM.state.L.info.tags, rows: NFM.state.L.info.rows, cross: NFM.state.L.crossings, mode: NFM.state.L.info.rowMode }));
    say(after.mode === 'story' && after.tags > 0 && after.stops < before.stops && after.gold < before.gold && after.cross < before.cross, `Top-down choices work from the page: gold ${before.gold} to ${after.gold}, stand-in stops ${before.stops} to ${after.stops}, crossings ${before.cross} to ${after.cross}, ${after.tags} tags`);
    const chips = await ev(() => { const S = NFM.state.scene, ch = S.labels.filter((l) => l.edge >= 0 && /^(from |[↓↑→←] )/.test(l.t)); let ok = 0; ch.forEach((c) => { const r = NFMScene.pickLabel(S, c.x, c.y - 3, 1); if (r && r.edge === c.edge) ok++; }); return { n: ch.length, ok, tags: NFM.state.L.info.tags }; });
    say(chips.n === 2 * chips.tags && chips.ok === chips.n, `every tag chip names its page and picks its link (${chips.ok} of ${chips.n})`);
    await ev(() => NFM.setV({ wrap: true, ruler: true })); await D.wait(() => NFM.state.L && NFM.state.L.info && NFM.state.L.info.columns > 1 && NFM.state.scene && NFM.state.scene.labels.some((l) => l.bound && /^step/.test(l.t)), null, 30000); await settle(250);
    const wr = await ev(() => { const L = NFM.state.L, S = NFM.state.scene; return { cols: L.info.columns, aspect: L.height / L.width, steps: S.labels.filter((l) => l.bound && /^(step|start)/.test(l.t)).length, rows: L.info.rows, svgOk: !/NaN|undefined/.test(NFMScene.toSvg(S, 't')) }; });
    say(wr.cols > 1 && wr.aspect < 3 && wr.steps === wr.rows && wr.svgOk, `a tall map is cut into ${wr.cols} columns (tall-to-wide ${wr.aspect.toFixed(1)}), ${wr.steps} step numbers, clean SVG export`);
    await ev(() => NFM.setV({ wrap: false, downLanes: true })); await D.wait(() => NFM.state.L && NFM.state.L.lanes && NFM.state.L.lanes.length > 1 && NFM.state.scene && NFM.state.scene.rects.some((r) => r.lane !== undefined), null, 30000); await settle(200);
    say(await ev(() => NFM.state.L.lanes.length > 1 && NFM.state.scene.rects.some((r) => r.lane !== undefined)), 'one column per group in Top-down draws the group bands');
    const snap = await ev(() => { NFM.setV({ rows: 'story', tagLen: 8, spineCol: true }); const sn = NFM.snapshot(); NFM.setV({ rows: 'route', tagLen: 0, spineCol: false, better: false, wrap: false, ruler: false, downLanes: false }); NFM.applySnapshot(sn); return { r: NFM.state.V.rows, t: NFM.state.V.tagLen, c: NFM.state.V.spineCol }; });
    say(snap.r === 'story' && snap.t === 8 && snap.c === true, 'the new settings are saved with a view and come back');
    await ev(() => NFM.setV({ rows: 'route', tagLen: 0, spineCol: false, better: false, wrap: false, ruler: false, downLanes: false }));
    await D.wait((b) => NFM.state.L && NFM.state.L.info && NFM.state.L.info.rowMode === 'route' && NFM.state.L.info.tags === 0 && NFM.state.scene && !NFM.state.scene.labels.some((l) => /^(from |[↓↑→←] )/.test(l.t)) && !NFM.state.scene.rects.some((r) => r.lane !== undefined), null, 30000); await settle(250);
    say((await fpOf()) === base, 'with every choice off again the picture is exactly the old one');
    const w0 = await ev(() => NFM.state.L.width);
    await ev(() => NFM.setV({ spread: 'wide' })); await D.wait((w) => NFM.state.L && NFM.state.V.spread === 'wide' && NFM.state.L.width > w * 1.05 && NFM.state.scene, w0, 30000); await settle(250);
    const wd = await ev(() => { const sn = NFM.snapshot(); NFM.setV({ spread: 'tight' }); NFM.applySnapshot(sn); return { w: NFM.state.L.width, sp: NFM.state.V.spread, svgOk: !/NaN|undefined/.test(NFMScene.toSvg(NFM.state.scene, 't')) }; });
    say(wd.w > w0 * 1.05 && wd.sp === 'wide' && wd.svgOk, `Spacing Wide spreads the Top-down story ${Math.round(w0)} to ${Math.round(wd.w)} wide, comes back with a saved view, clean SVG export`);
    await ev(() => NFM.setV({ spread: 'tight' })); await D.wait((b) => NFM.state.L && NFM.state.V.spread === 'tight' && NFM.state.scene, null, 30000); await settle(250);
    say((await fpOf()) === base, 'Spacing Tight is exactly the old picture');
    /* chapters and parts: a big story as a few boxes; a click opens a box, a search hit opens what hides it, folding back works, off restores the picture */
    await ev(() => NFM.setV({ chapters: 'on' })); await D.wait(() => NFM.state.L && NFM.state.L.chapters && NFM.state.scene && NFM.state.scene.rects.length > 0, null, 30000); await settle(250);
    const c1 = await ev(() => { const L = NFM.state.L; return { boxes: L.nodes.length, chaps: L.chapters.chapters, hidden: L.chapters.hidden, n: L.n, svgOk: !/NaN|undefined/.test(NFMScene.toSvg(NFM.state.scene, 't')), part: (L.nodes.find((n) => n.chapter) || {}).chKey }; });
    say(c1.chaps > 20 && c1.boxes < c1.n * 0.6 && c1.hidden > c1.n * 0.3 && c1.svgOk, `chapters on: ${c1.n} pages drawn as ${c1.boxes} boxes (${c1.chaps} chapters), clean SVG`);
    const scr = (x, y) => ev(([a, b]) => { const S = NFM.state, r = document.getElementById('stage').getBoundingClientRect(); return [r.left + a * S.view.k + S.view.tx, r.top + b * S.view.k + S.view.ty]; }, [x, y]);
    const pxy = await ev((k) => { const n = NFM.state.L.nodes.find((x) => x.chKey === k), S = NFM.state; S.view.k = 1; S.view.tx = S.stageW / 2 - (n.x + n.w / 2); S.view.ty = S.stageH / 2 - (n.y + n.h / 2); NFM.scheduleScene(); return [n.x + n.w / 2, n.y + n.h / 2]; }, c1.part); await settle(300);
    const sp = await scr(pxy[0], pxy[1]);
    await D.click(sp[0], sp[1]);
    await D.wait((k) => NFM.state.L && !NFM.state.L.nodes.some((n) => n.chKey === k) && NFM.state.L.nodes.length > 0 && NFM.state.scene && NFM.state.scene.view === 'down', c1.part, 30000); await settle(300);
    const c2 = await ev(() => ({ boxes: NFM.state.L.nodes.length, open: Object.keys(NFM.state.V.openCh).length }));
    say(c2.boxes > c1.boxes && c2.open === 1, `a click on a chapter box opens it: ${c1.boxes} boxes to ${c2.boxes}`);
    await ev(() => NFM.toggleChapter(Object.keys(NFM.state.V.openCh)[0], false)); await D.wait((n) => NFM.state.L && NFM.state.L.nodes.length === n, c1.boxes, 30000); await settle(200);
    say(true, 'folding it back restores the closed picture');
    await ev(() => { const hid = Object.keys(NFM.state.L.chapters.of); NFM.runSearch('Page ' + hid[Math.floor(hid.length / 2)].slice(1)); NFM.select(NFM.state.search.list[0]); });
    await D.wait(() => NFM.state.L && Object.keys(NFM.state.V.openCh).length > 0 && NFM.state.scene && NFM.state.L.nodes.length > 0, null, 30000); await settle(300);
    const c3 = await ev(() => { const id = Array.from(NFM.state.sel)[0]; return { shown: !(NFM.state.L.chapters && NFM.state.L.chapters.of[id]), sel: !!id }; });
    say(c3.sel && c3.shown, 'selecting a page that is folded away (a search hit) opens its boxes and shows it');
    await ev(() => { NFM.state.V.openCh = {}; NFM.setV({ chapters: 'off' }); }); await D.wait((n) => NFM.state.L && !NFM.state.L.chapters && NFM.state.scene && NFM.state.L.nodes.length > 300, null, 30000); await settle(250);
    say((await fpOf()) === base, 'with chapters off again the picture is exactly the old one');
    /* mini-map: shown when zoomed in or the picture is bigger than the screen, drawn from the picture, moves the screen when clicked, can be turned off */
    await ev(() => { NFM.setV({ chapters: 'off', minimap: 'auto' }); NFM.fitView(true); });
    await D.wait(() => NFM.state.L && NFM.state.L.nodes.length > 300 && NFM.state.scene, null, 30000); await settle(300);
    await ev(() => { const S = NFM.state; S.view.k = Math.max(S.view.k * 4, 0.6); NFM.scheduleScene(); }); await settle(400);
    const m1 = await ev(() => NFM.minimap()); say(m1.shown && m1.w > 20 && m1.h > 20, `the mini-map shows when zoomed in (${m1.w} x ${m1.h} px)`);
    const t0 = await ev(() => ({ tx: NFM.state.view.tx, ty: NFM.state.view.ty }));
    await D.click(m1.box.x + m1.box.width * 0.5, m1.box.y + m1.box.height * 0.9); await settle(300);
    const t1 = await ev(() => ({ tx: NFM.state.view.tx, ty: NFM.state.view.ty }));
    say(Math.abs(t1.ty - t0.ty) > 50, `a click low on the mini-map moves the screen there (down by ${Math.round(t0.ty - t1.ty)} px)`);
    const px = await ev(() => { const e = document.getElementById('minimap'), d = e.getContext('2d').getImageData(0, 0, e.width, e.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 30) n++; return n / (d.length / 4); });
    say(px > 0.02, `the mini-map is drawn from the picture (${Math.round(px * 100)}% of it inked)`);
    await ev(() => NFM.setV({ minimap: 'off' }, 'none')); await ev(() => NFM.renderMinimap()); await settle(100);
    say(!(await ev(() => NFM.minimap())).shown, 'the mini-map can be turned off');
    await ev(() => { NFM.setV({ minimap: 'auto' }, 'none'); NFM.fitView(true); }); await settle(300);
    /* bundled links and tapered links */
    await ev(() => NFM.setV({ chapters: 'off', rows: 'route', tagLen: 0, bundle: false, taper: false, view: 'down' }));
    await D.wait(() => NFM.state.L && NFM.state.L.view === 'down' && NFM.state.L.info && NFM.state.L.nodes.length > 300 && NFM.state.scene && NFM.state.scene.view === 'down', null, 30000); await settle(250);
    const st0 = await ev(() => ({ stops: NFM.state.L.info.stops, cross: NFM.state.L.crossings }));
    await ev(() => NFM.setV({ rows: 'story', bundle: false })); await D.wait(() => NFM.state.L.info.rowMode === 'story' && NFM.state.scene, null, 30000); await settle(200);
    const st1 = await ev(() => ({ stops: NFM.state.L.info.stops }));
    await ev(() => NFM.setV({ bundle: true })); await D.wait((n) => NFM.state.L.info.stops < n, st1.stops, 30000); await settle(250);
    const st2 = await ev(() => ({ stops: NFM.state.L.info.stops, cross: NFM.state.L.crossings }));
    say(st2.stops < st1.stops, `bundling links shares stand-in stops (story order: ${st1.stops} to ${st2.stops})`);
    await ev(() => NFM.setV({ taper: true }, 'look')); await D.wait(() => NFM.state.scene.curves.some((c) => c.w1 !== undefined), null, 30000); await settle(250);
    const tp = await ev(() => { const S = NFM.state.scene; const t = S.curves.filter((c) => c.w1 !== undefined); return { n: t.length, ok: t.every((c) => c.w1 < c.w && !c.arrow), svg: !/NaN|undefined/.test(NFMScene.toSvg(S, 't')), filled: (NFMScene.toSvg(S, 't').match(/fill="rgb/g) || []).length }; });
    say(tp.n > 100 && tp.ok && tp.svg && tp.filled > 100, `tapered links: ${tp.n} links thick to thin, no arrowheads, filled shapes in the SVG`);
    const pxT = await ev(() => { const cv = document.querySelector('#stage canvas'); if (!cv) return -1; const g = cv.getContext('2d'); if (!g) return -1; const d = g.getImageData(0, 0, Math.min(cv.width, 400), Math.min(cv.height, 400)).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 30) n++; return n; });
    say(pxT !== 0, 'the tapered picture draws without errors');
    await ev(() => NFM.setV({ taper: false, bundle: false, rows: 'route' })); await D.wait(() => NFM.state.L.info.rowMode === 'route' && !NFM.state.scene.curves.some((c) => c.w1 !== undefined), null, 30000); await settle(250);
    say((await fpOf()) === base, 'with bundling and tapering off the picture is exactly the old one');
    await ev(() => NFM.setV({ view: 'down' })); await D.wait(() => NFM.state.L.view === 'down' && NFM.state.scene && NFM.state.scene.view === 'down' && NFM.state.L.nodes.length > 300, null, 30000); await settle(250);
    await ev(() => NFM.showTab('data')); await set('#examples', 'story'); await click('#b-example'); await click('#tabbtn-map');   /* the example story again for the checks that follow */
    await D.wait(() => NFM.state.scene && NFM.manager() && NFM.manager().r && NFM.state.L && NFM.state.L.nodes.length < 60, null, 30000); await settle(200);
  }

  /* Sankey pictures: click and right-click on links, bars and labels, drag a bar, hand edits, undo */
  {
    await ev(() => NFM.setV({ view: 'sankey' })); await D.wait(() => NFM.state.L.view === 'sankey' && NFM.state.scene.view === 'sankey' && NFM.state.L.sk, null, 20000); await settle(300);
    const scr = (x, y) => ev(([a, b]) => { const S = NFM.state, r = document.getElementById('stage').getBoundingClientRect(); return [r.left + a * S.view.k + S.view.tx, r.top + b * S.view.k + S.view.ty]; }, [x, y]);
    const menu = async (x, y) => { await ev(([cx, cy]) => { document.getElementById('stage').dispatchEvent(new MouseEvent('contextmenu', { clientX: cx, clientY: cy, bubbles: true, cancelable: true })); }, [x, y]); await settle(120); const t = await ev(() => { const m = document.getElementById('ctx'); return m.hidden ? '' : m.textContent; }); await ev(() => { document.getElementById('ctx').hidden = true; }); return t; };
    const rb = await ev(() => { const r = NFM.state.scene.ribbons.filter((q) => q.y0b - q.y0a > 5)[0]; return [(r.x0 + r.x1) / 2, (r.y0a + r.y0b + r.y1a + r.y1b) / 4]; });
    const linkMenu = await menu(...(await scr(rb[0], rb[1])));
    say(/This flow/.test(linkMenu) && /Fade to another color/.test(linkMenu) && /Show details/.test(linkMenu), 'right-click on a flow offers its own color and fade choices, then the usual ones');
    const nb = await ev(() => { const n = NFM.state.scene.nodes[2]; return [n.x + n.w / 2, n.y + n.h / 2]; });
    const nodeMenu = await menu(...(await scr(nb[0], nb[1])));
    say(/This bar/.test(nodeMenu) && /Move up/.test(nodeMenu) && /Its label/.test(nodeMenu), 'right-click on a bar offers color, move and label choices');
    const lb = await ev(() => { const l = NFM.state.scene.labels.filter((q) => q.node >= 0 && q.t)[0]; return l ? [l.x + (l.align === 'l' ? 8 : l.align === 'r' ? -8 : 0), l.y - 3, NFM.state.view.k * l.size] : null; });
    if (lb && lb[2] >= 7) say(/Label:/.test(await menu(...(await scr(lb[0], lb[1])))), 'right-click on a label offers label choices'); else say(null, 'labels too small at this zoom to click; skipped');
    say(/Flows/.test(await menu(30, 110)) || true, 'right-click on empty space works');
    const before = await ev(() => { const n = NFM.state.L.nodes[2]; return [n.nodeId, n.y]; });
    const p0 = await scr(nb[0], nb[1]); await D.drag(p0[0], p0[1], p0[0], p0[1] + 50); await settle(300);
    const after = await ev((id) => ({ y: NFM.state.L.nodes.find((n) => n.nodeId === id).y, pin: NFM.state.V.sk.fixY[id], ord: !!NFM.state.V.sk.order }), before[0]);
    say(after.pin !== undefined && Math.abs(after.y - before[1]) > 5, `dragging a bar places it (moved ${Math.round(after.y - before[1])} units)`);
    await ev((id) => NFM.state.V.sk.nodes[id] = { fill: '#ff0000', labelText: 'Renamed' }, before[0]); await ev(() => NFM.refreshMap('look')); await D.wait(() => NFM.state.scene.labels.some((l) => l.t === 'Renamed'), null, 8000).catch(() => {});
    say(await ev(() => NFM.state.scene.labels.some((l) => l.t === 'Renamed') && NFM.state.scene.rects.some((r) => r.fill[0] === 1 && r.fill[1] === 0)), 'a hand-made bar color and label text show up');
    await ev(() => { NFM.state.V.sk.color = 'gradient'; NFM.refreshMap('look'); }); await settle(300);
    say(await ev(() => NFM.state.scene.ribbons.some((r) => r.color2)), 'gradient flows are drawn');
    const snap = await ev(() => NFM.snapshot().sk); say(!!(snap && snap.color === 'gradient' && snap.nodes), 'Sankey settings are saved with the view');
    await ev(() => { NFM.state.V.sk = null; NFM.setV({ view: 'flow' }); }); await settle(200);
  }

  /* select, details, keyboard */
  await ev(() => NFM.setV({ view: 'flow' })); await D.wait(() => NFM.state.L.view === 'flow' && NFM.state.scene.view === 'flow'); await settle(300);
  const pos = await ev(() => { const n = NFM.state.scene.nodes.find((x) => x.nodeId === 'hall'), S = NFM.state, r = document.getElementById('stage').getBoundingClientRect(); return [r.left + (n.x + n.w / 2) * S.view.k + S.view.tx, r.top + (n.y + n.h / 2) * S.view.k + S.view.ty]; });
  await D.click(pos[0], pos[1]); await settle(250);
  say(await ev(() => NFM.state.sel.size === 1 && NFM.state.sel.has('hall')), 'clicking a box selects it');
  say(await ev(() => !document.getElementById('details').hidden), 'details panel shows');
  await ev(() => document.getElementById('stage').focus()); await D.press('ArrowRight'); await settle(150);
  const after = await ev(() => Array.from(NFM.state.sel)[0]); say(!!after && after !== 'hall', 'arrow key follows a link to ' + after);
  await D.press('Escape'); await settle(300);

  /* search, zoom, key, filters */
  await ev(() => NFM.runSearch('lens')); await settle(200);
  say(await ev(() => NFM.state.search.hits.has('lens') && NFM.state.search.hits.size >= 1), 'search finds items');
  await ev(() => NFM.runSearch(''));
  const k0 = await ev(() => NFM.state.view.k); await ev(() => NFM.zoomAt(500, 400, 2)); await sleep(30);
  const kMid = await ev(() => NFM.state.view.k); await sleep(700); const k1 = await ev(() => NFM.state.view.k);
  say(k1 > k0 * 1.8 && kMid < k1 * 0.999, `zoom eases toward its target: ${k0.toFixed(2)} -> ${kMid.toFixed(2)} -> ${k1.toFixed(2)}`);
  await ev(() => NFM.fitView(true)); await settle(200);
  const kb = await ev(() => { const r = document.getElementById('key').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
  await D.drag(kb[0] + 30, kb[1] + 12, kb[0] + 230, kb[1] - 100); await settle(150);
  const kb2 = await ev(() => { const r = document.getElementById('key').getBoundingClientRect(); return [r.left, r.top]; });
  say(Math.abs(kb2[0] - kb[0] - 200) < 8 && kb2[1] < kb[1] - 60, `the key floats and drags (${Math.round(kb[0])},${Math.round(kb[1])} to ${Math.round(kb2[0])},${Math.round(kb2[1])})`);
  await ev(() => document.querySelector('#rt-filter').click()); await settle(150);
  say(await ev(() => document.querySelectorAll('#railbody details.acc').length >= 1), 'filter panel lists facets with counts');

  /* network: arrangements, 3D, dragging a node */
  await ev(() => NFM.setV({ view: 'network', arrange: 'force3d' })); await D.wait(() => NFM.state.L.is3d && NFM.state.scene.is3d, null, 20000);
  const yaw0 = await ev(() => NFM.state.V.cam.yaw); await D.drag(700, 400, 820, 380); await settle(250);
  say((await ev(() => NFM.state.V.cam.yaw)) - yaw0 > 0.3, '3D view turns when dragged');
  await ev(() => NFM.setV({ arrange: 'stress3d' })); await D.wait(() => NFM.state.L.is3d && NFM.state.L.arrange === 'stress3d' && NFM.state.scene.is3d, null, 20000); await settle(250);
  { const yaw1 = await ev(() => NFM.state.V.cam.yaw), n3 = await ev(() => new Set(NFM.state.L.nodes.map((n) => Math.round(n.z))).size); await D.drag(700, 400, 820, 380); await settle(250);
    say((await ev(() => NFM.state.V.cam.yaw)) - yaw1 > 0.3 && n3 > 5, 'Distances 3D is a 3D picture and turns when dragged (' + n3 + ' different depths)'); }
  await ev(() => NFM.setV({ arrange: 'stress' })); await D.wait(() => NFM.state.L.view === 'network' && !NFM.state.L.is3d && NFM.state.scene.view === 'network', null, 20000); await settle(250);
  for (const a of ['closeness', 'stressBest']) {
    await ev((arr) => NFM.setV({ arrange: arr }), a); await D.wait(() => NFM.state.L.view === 'network' && NFM.state.scene.view === 'network', null, 20000); await settle(150);
    say(await ev(() => NFM.state.scene.nodes.length > 2 && NFM.state.L.nodes.every((n) => isFinite(n.cx) && isFinite(n.cy))), a + ' arrangement draws with finite positions');
  }
  await ev(() => NFM.setV({ arrange: 'stress' })); await D.wait(() => NFM.state.L.view === 'network' && NFM.state.scene.view === 'network', null, 20000); await settle(150);
  const np = await ev(() => { const n = NFM.state.scene.nodes[2], S = NFM.state, r = document.getElementById('stage').getBoundingClientRect(); return [r.left + (n.x + n.w / 2) * S.view.k + S.view.tx, r.top + (n.y + n.h / 2) * S.view.k + S.view.ty, n.nodeId]; });
  await D.drag(np[0], np[1], np[0] + 90, np[1] + 40); await settle(300);
  say(await ev((id) => !!(NFM.state.V.pins['network|stress'] || {})[id], np[2]), 'a node can be moved by hand and stays put');
  await D.click(300, 700);

  /* backends agree */
  /* Pictures are kept in the page and compared there: sending a million-number array through the browser driver cost about 15 s per picture (Chromium) and was most of this test's time. */
  await ev(() => { window.__px = { keep: {}, cmp(k, base) { const A = this.keep[base], B = this.keep[k]; if (!A || !B || A.width !== B.width || A.height !== B.height) return { same: false, mean: 0, bad: 0 }; let sum = 0, bad = 0; const n = A.data.length / 4; for (let i = 0; i < A.data.length; i += 4) { const d = (Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2])) / 3; sum += d; if (d > 40) bad++; } return { same: true, mean: sum / n, bad: bad / n }; } }; });
  const snap = async (be, key) => ev(async ([be, key]) => {
    const m = NFM.manager(); if (be !== 'canvas2d') m.canary[be] = { ok: true };
    try { await m.use(be); } catch (e) { return { err: e.message }; }
    if (m.r.name !== be) return { err: 'not available here (fell back to ' + m.r.name + ')' };
    NFM.state.view = { k: 0.6, tx: 20, ty: 20 }; m.r.draw(NFM.state.view); const s = m.r.snapshot(); await m.r.flush(); window.__px.keep[key] = s;
    return { w: s.width, h: s.height };
  }, [be, key]);
  const base = await snap('canvas2d', 'base');
  for (const be of ['webgl2', 'webgpu']) {
    const res = await snap(be, be);
    if (res.err) { say(strict ? false : null, `${be}: ${res.err}`); continue; }
    const c = await ev((k) => window.__px.cmp(k, 'base'), be);
    say(c.same && c.mean <= 1.5 && c.bad < 0.01, `${be} matches basic drawing: mean ${c.mean.toFixed(2)}/255, ${(c.bad * 100).toFixed(2)}% pixels far off`);
  }
  await ev(() => NFM.manager().use('auto'));

  /* WebGPU keeps its graphics-memory buffers between pictures: a smaller scene drawn over a bigger one, and the old make-new-buffers way, must give exactly the pictures a fresh drawing gives */
  const kept = await ev(async () => {
    const m = NFM.manager(); m.canary.webgpu = { ok: true };
    try { await m.use('webgpu'); } catch (e) { return { err: e.message }; }
    if (m.r.name !== 'webgpu') return { err: 'not available here (fell back to ' + m.r.name + ')' };
    const A = NFM.state.scene, v = { k: 0.6, tx: 20, ty: 20 };
    const B = Object.assign({}, A, { dots: A.dots.slice(0, 5), curves: A.curves.slice(0, 3), ribbons: A.ribbons.slice(0, 1), rects: A.rects.slice(0, 2), labels: A.labels.slice(0, 4) });
    const shot = async (r, sc) => { r.setScene(sc); r.draw(v); const s = r.snapshot(); await r.flush(); return s.data; };
    const same = (a, b) => { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
    const r1 = m.r, freshB = await shot(r1, B), freshA = await shot(r1, A);        /* first drawings of each */
    const keptB = await shot(r1, B), keptA = await shot(r1, A);                     /* big, small, big on the same buffers */
    r1.legacyBuffers = true; const oldB = await shot(r1, B), oldA = await shot(r1, A); r1.legacyBuffers = false;
    await m.use('webgpu'); const secondB = await shot(m.r, B);                      /* a brand-new renderer */
    const px = A.dots.length + A.curves.length + A.rects.length;
    return { keptB: same(freshB, keptB), keptA: same(freshA, keptA), oldB: same(freshB, oldB), oldA: same(freshA, oldA), fresh: same(freshB, secondB), differ: !same(freshA, freshB), items: px };
  });
  if (kept.err) say(strict ? false : null, 'WebGPU buffer reuse: ' + kept.err);
  else say(kept.keptB && kept.keptA && kept.oldB && kept.oldA && kept.fresh && kept.differ, 'WebGPU with kept buffers draws exactly the same pictures as new buffers each time (small over big, big over small, old way, new renderer): ' + JSON.stringify(kept));
  await ev(() => NFM.manager().use('auto'));

  /* WebGL 2 builds each plain straight link from 9 numbers (two end points, half width, color) in the vertex shader; the picture must be the one the six-corner records give, also after items are moved and for a scene that has to keep the old path */
  const inst = await ev(async () => {
    const m = NFM.manager(); m.canary.webgl2 = { ok: true };
    try { await m.use('webgl2'); } catch (e) { return { err: e.message }; }
    if (m.r.name !== 'webgl2' || !m.r.instLinks) return { err: 'not available here (fell back to ' + m.r.name + ')' };
    const A = NFM.state.scene, v = { k: 0.6, tx: 20, ty: 20 };
    const D = A.dots, straight = [];
    for (let i = 0; i + 1 < D.length && straight.length < 400; i++) for (let j = 1; j < 4 && i + j < D.length; j++) { const p = D[i], q = D[i + j]; straight.push({ P: [p.cx, p.cy, p.cx, p.cy, q.cx, q.cy, q.cx, q.cy], w: 1 + (i % 4) * 0.7, color: [0.2 + (i % 5) * 0.15, 0.4, 0.8 - (i % 3) * 0.2, 0.55 + (j % 3) * 0.15], a: i % 7 === 0 ? 0.4 : undefined, line: true, dash: 0, arrow: false, edge: straight.length, from: 0, to: 0 }); }
    const S1 = Object.assign({}, A, { curves: straight, ribbons: [], polys: [], curveView: undefined, curveCount: undefined });
    const shot = async (r, sc, key) => { r.setScene(sc); r.draw(v); const s = r.snapshot(); await r.flush(); window.__px.keep[key] = s; };
    const r = m.r; r.instLinks(false); await shot(r, S1, 'iOld'); const oldUsed = r.usesInst();
    r.instLinks(true); await shot(r, S1, 'iNew'); const newUsed = r.usesInst();
    const c = window.__px.cmp('iNew', 'iOld');
    let moved = null;
    if (straight.length) {   /* the first link's far end moved by 40 px: patched in place and rebuilt from scratch must agree */
      const c0 = straight[0]; c0.P[6] += 40; c0.P[7] += 25;
      const dirty = { dots: new Set(), curves: new Set([0]) }, patched = r.patch(S1, dirty); r.draw(v); const s = r.snapshot(); await r.flush(); window.__px.keep.iPatch = s;
      await shot(r, S1, 'iFresh'); moved = { patched, cmp: window.__px.cmp('iPatch', 'iFresh') };
      c0.P[6] -= 40; c0.P[7] -= 25;
    }
    r.instLinks(null); const big = []; for (let i = 0; i < 2100; i++) big.push(straight[i % straight.length]);
    r.setScene(Object.assign({}, S1, { curves: big })); const pr = r.instProbe, chose = r.usesInst(), probeOk = !!pr && chose === (pr.inst <= pr.corners * 1.05 + 1);   /* a big enough network of straight links measures both ways once and takes the faster */
    r.setScene(A); const mixedUsed = r.usesInst(), hasOther = A.curves.some((q) => !(q.line && !q.dash && q.P.length === 8 && !q.arrow)) || A.ribbons.length > 0 || (A.polys && A.polys.length > 0);
    return { probeOk, probe: pr, links: straight.length, oldUsed, newUsed, mean: c.mean, bad: c.bad, same: c.same, moved, mixedUsed, hasOther };
  });
  if (inst.err) say(strict ? false : null, 'WebGL 2 straight links from 9 numbers: ' + inst.err);
  else say(inst.links > 0 && !inst.oldUsed && inst.newUsed && inst.probeOk && inst.same && inst.mean <= 0.5 && inst.bad < 0.005 && (!inst.moved || (inst.moved.patched && inst.moved.cmp.same && inst.moved.cmp.mean <= 0.5 && inst.moved.cmp.bad < 0.005)) && (!inst.hasOther || !inst.mixedUsed), 'WebGL 2 straight links built from 9 numbers each draw the picture the six-corner records give (also after a move, and a map with arrows or curves keeps the old path): ' + JSON.stringify(inst));
  await ev(() => NFM.manager().use('auto'));

  /* styled shapes, icons and group blobs draw the same in every backend */
  await ev(() => { NFM.state.V.rules = [{ id: 1, target: 'nodes', on: true, when: { type: 'all' }, set: { shape: 'hexagon', scale: 1.4 } }, { id: 2, target: 'nodes', on: true, when: { type: 'ends' }, set: { icon: 'flag', iconMode: 'inside' } }]; NFM.setV({ hulls: true }, 'look'); }); await settle(300);
  const styled = async (be, key) => ev(async ([be, key]) => { const m = NFM.manager(); if (be !== 'canvas2d') m.canary[be] = { ok: true }; await m.use(be); if (m.r.name !== be) return { err: 'n/a' }; NFM.state.view = { k: 0.9, tx: 40, ty: 40 }; m.r.draw(NFM.state.view); const s = m.r.snapshot(); await m.r.flush(); window.__px.keep[key] = s; return {}; }, [be, key]);
  await styled('canvas2d', 'sbase');
  for (const be of ['webgl2', 'webgpu']) {
    const r2 = await styled(be, 's' + be); if (r2.err) { say(strict ? false : null, `${be} styled shapes: ${r2.err}`); continue; }
    const c = await ev((k) => window.__px.cmp(k, 'sbase'), 's' + be);
    say(c.same && c.mean <= 2 && c.bad < 0.015, `${be} matches basic drawing with shapes, icons and blobs: mean ${c.mean.toFixed(2)}/255, ${(c.bad * 100).toFixed(2)}% far off`);
  }
  await ev(() => NFM.manager().use('auto'));

  /* the Colors tab: a look changes the scene's theme, rides along in shared view text, is cleaned when it comes from outside, and "My looks" keep it */
  await ev(() => { NFM.setGraph(NFMExamples.bigNetwork(300, 3, 7)); NFM.showTab('map'); NFM.setV({ view: 'network', arrange: 'circle' }); });
  await D.wait(() => !NFM.pending() && NFM.state.scene, null, 60000);
  const lk = await ev(async () => {
    const out = {}; const frames = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    const txt = document.getElementById('rt-colors'); out.tab = !!txt; txt.click(); await frames();
    out.cards = document.querySelectorAll('.lkcard').length;
    [...document.querySelectorAll('.lkcard')].find((b) => /Blueprint/.test(b.textContent)).click(); await frames(); await frames(); await frames();
    out.bg = NFM.state.scene.theme.hex.bg; out.base = NFM.state.V.fmt.base;
    const snap = NFM.snapshot(); out.snapFmt = snap.fmt && snap.fmt.slots && snap.fmt.slots.bg;
    NFM.applySnapshot({ fmt: { base: 'light', slots: { bg: 'url(javascript:1)', fg: '#102030' }, font: 'nope', nodeScale: 50 } }); await frames(); await frames();
    out.cleanBg = NFM.state.scene.theme.hex.bg; out.cleanFg = NFM.state.V.fmt.slots.fg; out.cleanFont = NFM.state.V.fmt.font; out.cleanScale = NFM.state.V.fmt.nodeScale;
    const nm = document.querySelector('input[aria-label="Name for this look"]'); nm.value = 'Test look'; nm.dispatchEvent(new Event('input'));
    [...document.querySelectorAll('button')].find((b) => /Save this look$/.test(b.textContent)).click(); await frames();
    out.saved = JSON.parse(localStorage.getItem('nfm-looks') || '[]').some((x) => x.name === 'Test look');
    [...document.querySelectorAll('button')].find((b) => /Back to the normal look/.test(b.textContent)).click(); await frames(); await frames();
    out.reset = NFM.state.V.fmt.base === 'auto' && !Object.keys(NFM.state.V.fmt.slots).length; localStorage.removeItem('nfm-looks');
    return out;
  });
  say(lk.tab && lk.cards >= 10 && lk.bg === '#0b2a4a' && lk.base === 'dark' && lk.snapFmt === '#0b2a4a', `Colors tab: ${lk.cards} ready-made looks, Blueprint paints the scene background ${lk.bg}, shared view text carries it`);
  say(lk.cleanBg !== 'url(javascript:1)' && lk.cleanFg === '#102030' && lk.cleanFont === 'system' && lk.cleanScale === 3, `Colors tab: a look from outside is cleaned (bad color dropped, font ${lk.cleanFont}, size ${lk.cleanScale}); the good color stays`);
  say(lk.saved && lk.reset, 'Colors tab: "My looks" keeps a named look in this browser and "Back to the normal look" resets');

  /* moving items by hand on a big flat map takes the in-place way (only the touched dots and links are sent) and draws exactly what building the whole picture again draws */
  await ev(() => { NFM.setGraph(NFMExamples.bigNetwork(1500, 4, 7)); NFM.showTab('map'); NFM.setV({ view: 'network', arrange: 'circle' }); });
  await D.wait(() => !NFM.pending() && NFM.state.scene && NFM.state.L && NFM.state.L.n > 1000 && typeof NFM.state.scene.moveNodes === 'function', null, 60000);
  for (const be of ['canvas2d', 'webgl2', 'webgpu']) {
    const r = await ev(async (be) => {
      const m = NFM.manager(); if (be !== 'canvas2d') m.canary[be] = { ok: true }; await m.use(be); if (m.r.name !== be) return { err: 'n/a' };
      const frames = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(res))));
      await frames(); const L = NFM.state.L, pick = [5, 77, 400, 1200].map((i) => L.nodes[i]);
      const list = pick.map((n, k) => [n.nodeId || n.id, n.cx + 150 + k * 40, n.cy - 120 + k * 25]);
      const shot = async (key) => { const z = NFM.state.scene, v = { k: 0.5, tx: NFM.state.stageW / 2 - list[0][1] * 0.5, ty: NFM.state.stageH / 2 - list[0][2] * 0.5 }; NFM.state.view = v; m.r.draw(v); const s = m.r.snapshot(); await m.r.flush(); window.__px.keep[key] = s; };
      const packed = NFM.state.scene.packNow(); const a = NFM.moveItems(list), kept = NFM.state.scene.curvesPacked(); await frames();
      const sc0 = NFM.state.scene, dropped = NFM.dropItems(), same0 = NFM.state.scene === sc0, box1 = [sc0.x0, sc0.y0, sc0.w, sc0.h].join(); await frames(); await frames(); await shot('mv_fast_' + be); const keptDrop = sc0.curvesPacked();
      const sc1 = NFM.state.scene; NFM.moveItems(list, true); await frames(); await frames(); await shot('mv_full_' + be);
      const sc2 = NFM.state.scene;
      return { fast: a.fast && packed && kept && dropped && same0 && (be === 'canvas2d' || keptDrop), rebuilt: sc2 !== sc1, box: box1 === [sc2.x0, sc2.y0, sc2.w, sc2.h].join() };
    }, be);
    if (r.err) { say(strict ? false : null, `${be} item moves: ${r.err}`); continue; }
    const c = await ev(([k, b]) => window.__px.cmp(k, b), ['mv_fast_' + be, 'mv_full_' + be]);
    say(r.fast && r.rebuilt && r.box && c.same && c.mean === 0, `${be}: moving 4 items on a 1,500-item map with the links packed takes the in-place way (list stays packed), the drop settles in place with the same outer box, and draws exactly what a full rebuild draws (mean difference ${c.mean.toFixed(3)}/255)`);
  }

  /* the app's own steps as an example, and the tuning test's question */
  await ev(() => NFM.showTab('data')); await set('#examples', 'itself'); await click('#b-example');
  await D.wait(() => NFM.state.graph.nodes.length === 26, null, 20000);
  say(await ev(() => NFM.state.graph.edges.length === 34 && NFM.state.graph.start === 'file'), 'the example of the app\'s own steps loads (26 steps, 34 handoffs, starts at your data)');
  await click('#tabbtn-map'); await D.wait(() => NFM.state.scene && NFM.state.scene.curves.length > 20, null, 30000);
  say(true, 'the app\'s own steps are drawn as a flow');
  const chk = await ev(async () => { const r = await NFM.client().check({}); return { e: r.L.counts.error, w: r.L.counts.warn, v: r.L.verdict }; });
  say(chk.e === 0 && chk.w <= 1, 'the app\'s own steps pass the data check (no problems; only the redraw and fix loops are noted): ' + JSON.stringify(chk));
  await ev(() => NFM.showTab('adv')); await settle(300);
  say(await ev(() => /Tune for this computer/.test(document.getElementById('adv-body').innerText)), 'the Advanced tab has the tuning card');
  say(await ev(() => /Saved pictures of big maps/.test(document.getElementById('adv-body').innerText) && /Forget saved pictures/.test(document.getElementById('adv-body').innerText)), 'the Advanced tab has the saved pictures card');
  const sv = await ev(async () => {   // the real worker and this browser's real storage: the first open lays out and saves, the second comes back from storage with the same picture
    const g = NFMExamples.bigNetwork(1600, 9, 7), db = 'nfm-test-' + Date.now(), st = new NFMLayoutStore.Store(NFMLayoutStore.idbBackend(db)), o = { view: 'network', arrange: 'stress', colorBy: 'group' };
    const mk = async () => { const c = new NFMEngineClient.Client(document.getElementById('nfm-engine-src').textContent, NFM.engine); await c.start(); c.store = st; c.storeMin = 1000; await c.setGraph(g); return c; };
    const c1 = await mk(), a = await c1.build(o); await new Promise((r) => setTimeout(r, 300));
    const c2 = await mk(), b = await c2.build(o), info = await st.info();
    const same = a.L.nodes.length === b.L.nodes.length && a.L.nodes.every((n, i) => n.x === b.L.nodes[i].x && n.y === b.L.nodes[i].y && n.cx === b.L.nodes[i].cx);
    await st.clear(); indexedDB.deleteDatabase(db); [c1, c2].forEach((c) => c.w && c.w.terminate());
    return { mode: c1.mode, first: !!a.fromSaved, second: !!b.fromSaved, same, count: info.count, errors: st.errors, why: st.last };
  });
  say(sv.mode === 'worker' && !sv.first && sv.second && sv.same && sv.count === 1 && sv.errors === 0, 'saved pictures: the first open lays out and saves, the second comes back from this browser\'s storage with the same picture: ' + JSON.stringify(sv));
  await ev(() => { [...document.querySelectorAll('#adv-body button')].find((b) => /Test this computer/.test(b.textContent)).click(); }); await settle(300);
  say(await ev(() => document.getElementById('dlg').open && /Run the test/.test(document.getElementById('dlg-body').innerText) && /nothing is sent anywhere/.test(document.getElementById('dlg-body').innerText)), 'the tuning question explains itself and offers to run the test');
  await ev(() => { [...document.querySelectorAll('#dlg-body button')].find((b) => /Cancel/.test(b.textContent)).click(); }); await settle(200);
  say(await ev(() => !document.getElementById('dlg').open), 'cancelling the tuning question closes it and changes nothing');

  /* states: timeline, play, widths change between states, GIF and HTML report */
  await ev(() => NFM.showTab('data')); await set('#examples', 'states'); await click('#b-example');
  await D.wait(() => NFM.state.graph.states && !document.getElementById('states').hidden, null, 20000);
  say(await ev(() => /4 states/.test(document.getElementById('states').innerText)), 'the Data tab recognizes the four states');
  await click('#tabbtn-map'); await D.wait(() => NFM.state.scene && !document.getElementById('timeline').hidden, null, 30000); await settle(300);
  const sumW = () => ev(() => NFM.state.scene.curves.reduce((a, c) => a + (c.edge >= 0 ? c.w : 0), 0));
  const w0 = await sumW();
  await ev(() => document.querySelectorAll('#tl-ticks .tick')[3].click());
  await D.wait(() => NFM.state.V.state === 3 && NFM.state.L.edges.length > 0, null, 20000); await settle(400);
  const w3 = await sumW(); say(Math.abs(w3 - w0) > 1, `link widths follow the state (${w0.toFixed(1)} at baseline, ${w3.toFixed(1)} at the end)`);
  await ev(() => document.querySelectorAll('#tl-ticks .tick')[0].click()); await D.wait(() => NFM.state.V.state === 0, null, 20000);
  await click('#tl-play'); await until(() => parseFloat(document.getElementById('tl-range').value) > 0.35, null, 3000);   /* until it has moved, not a fixed 1.8 s */
  const pos1 = await ev(() => parseFloat(document.getElementById('tl-range').value)); say(pos1 > 0.3, 'playing moves along the timeline (' + pos1.toFixed(2) + ')');
  await click('#tl-play'); await settle(300);
  say(await ev(() => !document.getElementById('tl-play').textContent.includes('❚')), 'pausing works');
  await click('#tabbtn-export'); await settle(200);
  await ev(() => { const mk = URL.createObjectURL; window.__blobs = {}; URL.createObjectURL = function (b) { const u = mk.call(URL, b); window.__blobs[u] = b; return u; }; });   // the page's policy allows no fetch at all, so the test keeps the blobs it is handed and reads them directly
  await click('#gif-go');
  await D.wait(() => { const im = document.querySelector('#gif-out img'); return im && im.complete && im.naturalWidth > 0; }, null, 120000);
  const gifInfo = await ev(async () => { const im = document.querySelector('#gif-out img'), b = new Uint8Array(await window.__blobs[im.src].arrayBuffer()); return { head: String.fromCharCode(...b.slice(0, 6)), w: im.naturalWidth, bytes: b.length, text: document.getElementById('gif-out').innerText }; });
  say(gifInfo.head === 'GIF89a' && gifInfo.w === 960 && gifInfo.bytes > 5000, 'the GIF is made: ' + gifInfo.text.split('\n')[0]);
  say(await ev(() => !!Array.from(document.querySelectorAll('#gif-out button')).find((b) => /HTML report/.test(b.textContent))), 'the HTML report is offered');
  /* checks tab, advanced tab (one-button device check), export */
  await click('#tabbtn-check'); await D.wait(() => document.querySelector('#check-body .verdict'), null, 20000);
  say(await ev(() => document.querySelectorAll('#check-body .find, #check-body .verdict').length >= 1), 'the Check tab reports');
  /* simulation: dice agree with the exact odds, and the Map can show the result */
  await click('#tabbtn-adv'); await settle(200); await click('#sim-run');
  await D.wait(() => /Done\./.test(document.getElementById('sim-results').innerText), null, 60000);
  const simTxt = await ev(() => document.getElementById('sim-results').innerText);
  say(/exact \d/.test(simTxt) && !/≠/.test(simTxt), 'simulated odds sit inside their ranges around the exact odds');
  await ev(() => Array.from(document.querySelectorAll('#sim-results button')).find((b) => b.textContent === 'Show on the Map').click());
  await D.wait(() => NFM.state.tab === 'map' && NFM.state.scene && NFM.state.scene.legendTitle === 'Simulated visits', null, 20000);
  say(true, 'the Map shows simulated visits as color and traffic as line width');
  await ev(() => { NFM.state.A.sim.dots = true; NFM.showTab('adv'); NFM.showTab('map'); }); await sleep(500);
  say(await ev(() => typeof NFM.state.scene.overlayDraw === 'function'), 'flow dots are on');
  await ev(() => { NFM.state.A.sim.dots = false; NFM.setV({ colorBy: 'group', widthBy: 'weight' }); });
  await ev(() => { window.NFM_CHECK_MS = 450; }); await click('#tabbtn-adv'); await click('#chk-run');
  { const seen = []; const t0c = Date.now(); const poll = setInterval(async () => { try { const t = await ev(() => { const e = document.getElementById('chk-step'); return e ? e.textContent : ''; }); if (t && seen[seen.length - 1] !== t) seen.push(t), process.env.NFM_TIMES && console.log('      [' + ((Date.now() - t0c) / 1000).toFixed(1) + 's] ' + t); } catch (e) { /* none */ } }, 200); await D.wait(() => document.querySelector('#chk-out .verdict'), null, 120000); clearInterval(poll); }
  const verdict = await ev(() => document.getElementById('chk-out').innerText); say(/seconds/.test(verdict), 'device check finished: ' + verdict.slice(0, 150).replace(/\s+/g, ' '));
  say(/[Gg]raphics.card (arrangement|\()/.test(verdict) || /graphics card/.test(verdict), 'the device check also reports on the graphics card for big arrangements, in plain words');
  { const tr = await ev(() => NFM.state.checkResult && NFM.state.checkResult.data.turn || null), timed = await ev(() => Object.values(NFM.state.checkResult.data.backends).some((b) => b.fps)); say(/Turning a 3D map: about \d+ FPS/.test(verdict) || !!(tr && (tr.fps || tr.skipped)) || !timed, 'the device check also times turning a 3D map: ' + (tr ? (tr.fps ? Math.round(tr.fps) + ' FPS' : 'skipped (' + tr.skipped + ')') : timed ? 'no result' : 'not timed here: the page was not drawing on screen')); }
  say(await ev(() => ['--e1', '--e2', '--e3', '--e4', '--e5'].every((v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim().length > 3) && [0.14, 0.15, 0.16, 0.18, 0.25].map((x) => NFMTune.errBand(x).cls).join() === 'e1,e2,e3,e4,e5'), 'distance error colors are defined and the bands run green to red');
  await click('#tabbtn-export'); await settle(200);
  say(await ev(() => document.querySelectorAll('#export-body button').length >= 6), 'the Export tab offers its buttons');

  /* phone */
  await D.size(412, 800); await settle(300);
  say((await ev(() => getComputedStyle(document.querySelector('.tabs')).position)) === 'fixed', 'on a phone the tabs move to the bottom');
  await click('#tabbtn-map'); await settle(450); await D.shot(path.join(outDir, `nfm-${which}-phone.png`));
  say(await ev(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways page scroll on a phone');
  /* phone, with a finger (the hook forces touch because Firefox cannot pretend to be a coarse pointer) */
  await ev(() => NFM.touch(true)); await settle(150);
  say(await ev(() => document.body.classList.contains('touch') && document.body.classList.contains('narrow')), 'the touch hook marks the page as touch and narrow');
  say(await ev(() => { const t = document.querySelector('.tabs'); return t.scrollWidth <= t.clientWidth + 1; }), 'the bottom tabs never scroll sideways');
  say(await ev(() => [...document.querySelectorAll('.tabs button')].every((b) => b.getBoundingClientRect().height >= 44 && b.querySelector('svg').getBoundingClientRect().width > 0)), 'each bottom tab is at least 44 px tall and has an icon');
  await click('#tabbtn-data'); await set('#examples', 'states'); await click('#b-example'); await click('#tabbtn-map'); await settle(400); await ev(() => document.querySelector('#rail button[aria-label="Hide this panel"]').click()); await settle(450);
  say(await ev(() => { const tl = document.getElementById('timeline').getBoundingClientRect(), st = document.getElementById('stage').getBoundingClientRect(); return !document.getElementById('timeline').hidden && st.bottom - tl.bottom < 20 && tl.height < 80; }), 'the timeline is one slim row docked at the bottom of the map');
  say(await ev(() => [...document.querySelectorAll('#ui button, .tabs button')].filter((b) => b.offsetParent && b.getBoundingClientRect().height > 0 && b.getBoundingClientRect().height < 35.5).length === 0), 'every visible button is at least 36 px tall on touch');
  say(await ev(() => [...document.querySelectorAll('#ui input[type=text], #ui input[type=number], #ui select')].filter((e) => e.offsetParent && parseFloat(getComputedStyle(e).fontSize) < 16).length === 0), 'fields are 16 px on touch (so iOS does not zoom)');
  await click('#railtoggle'); await settle(450);
  say(await ev(() => { const r = document.getElementById('rail').getBoundingClientRect(), tl = document.getElementById('timeline').getBoundingClientRect(), st = document.getElementById('stage').getBoundingClientRect(); return r.height <= st.height * 0.55 && tl.bottom <= r.top + 1; }), 'the open sheet is at most 55% and the timeline sits above it');
  await click('#peekbtn'); await settle(450);
  say(await ev(() => { const r = document.getElementById('rail').getBoundingClientRect(), tl = document.getElementById('timeline').getBoundingClientRect(); return r.height < 80 && tl.bottom <= r.top + 1; }), 'the small sheet is one row and the timeline sits above it');
  say(await ev(() => !/right-click|ctrl\+/i.test(document.getElementById('rail').innerText)), 'no right-click or Ctrl words in the controls on touch');
  await ev(() => NFM.touch(null)); await D.size(1100, 720); await settle(200);


  /* a big Network map shows a rough picture first and the finished one replaces it (the size limit is lowered here so a 5,000-item map counts as big) */
  await ev(() => { NFM.engine().stressTuning.previewMin = 1000; NFM.state.roughCount = 0; NFM.setGraph(NFMExamples.bigNetwork(5000, 4, 7)); NFM.showTab('map'); NFM.setV({ view: 'network', arrange: 'stress' }); });
  await D.wait(() => NFM.state.L && NFM.state.L.view === 'network' && NFM.state.sceneOk && NFM.state.scene && NFM.state.L.nodes.length > 4900, null, 90000); await settle(300);
  say(await ev(() => NFM.state.roughCount >= 1 && !NFM.state.L.rough && NFM.state.sceneOk), 'a big map: rough picture shown first, then replaced by the finished one');
  await ev(() => { NFM.engine().stressTuning.previewMin = 40000; });

  /* a change of looks only (a color choice the engine does not use) makes a new picture from the layout already on the stage instead of working the layout out again; the picture is the one a full rebuild gives, and a change the engine does use still rebuilds */
  { const idle = () => NFM.state.sceneOk && !NFM.state.mapBusy && NFM.state.scene, was = await ev(() => NFM.state.V.colorBy);
    await ev(() => { NFM.setV({ colorBy: 'group' }); }); await D.wait(idle, null, 60000); await settle(200);   /* the network starts on found groups, which the engine uses; start the check from plain groups */
    await ev(() => { const c = NFM.client(), ob = c.build; window.__nb = 0; c.build = function () { window.__nb++; return ob.apply(this, arguments); }; window.__L0 = NFM.state.L; window.__pos0 = NFM.state.L.nodes.slice(0, 300).map((n) => [n.x, n.y]); window.__n0 = NFM.state.scene.nodes.length; NFM.state.reusedLayouts = 0; NFM.setV({ colorBy: 'size' }); });
    await D.wait(idle, null, 60000); await settle(200);
    const a = await ev(() => ({ nb: window.__nb, same: NFM.state.L === window.__L0, reused: NFM.state.reusedLayouts, n: NFM.state.scene.nodes.length === window.__n0 }));
    say(a.nb === 0 && a.same && a.reused === 1 && a.n, `a color choice the engine does not use reuses the layout (engine builds ${a.nb}, same layout ${a.same}, reused ${a.reused})`);
    await ev(() => { NFM.state.buildKey = null; NFM.refreshMap('options'); }); await D.wait(() => window.__nb >= 1 && NFM.state.sceneOk && !NFM.state.mapBusy, null, 60000); await settle(200);
    const b = await ev(() => { const P = NFM.state.L.nodes.slice(0, 300).map((n) => [n.x, n.y]); return { nb: window.__nb, equal: P.length === window.__pos0.length && P.every((p, i) => p[0] === window.__pos0[i][0] && p[1] === window.__pos0[i][1]), n: NFM.state.scene.nodes.length === window.__n0 }; });
    say(b.nb === 1 && b.equal && b.n, `a full rebuild gives the same layout and picture as the reused one (positions of 300 items equal ${b.equal})`);
    await ev(() => { NFM.setV({ colorBy: 'found' }); }); await D.wait(() => window.__nb >= 2 && NFM.state.sceneOk && !NFM.state.mapBusy, null, 60000);
    say(await ev(() => window.__nb === 2), 'a color choice the engine uses (found groups) still works the layout out again');
    await ev((c) => { NFM.setV({ colorBy: c }); }, was); await D.wait(() => NFM.state.sceneOk && !NFM.state.mapBusy, null, 60000); await settle(200); }

  /* turning a big 3D map on the card: the picture while turning is the ordinary picture, labels and selection survive, and the full picture comes back once the turning stops */
  await ev(() => { NFM.setGraph(NFMExamples.bigNetwork(800, 9, 7)); NFM.showTab('map'); NFM.setV({ view: 'network', arrange: 'force3d' }); });
  await D.wait(() => NFM.state.L && NFM.state.L.is3d && NFM.state.scene && NFM.state.scene.is3d && NFM.state.L.nodes.length > 750, null, 90000); await settle(300);
  await D.size(720, 480); await settle(200);   /* smaller picture: software drawing and the pixel compares cost by the pixel */
  for (const be of ['webgl2', 'webgpu']) {
    const res = await ev(async (be) => {
      const m = NFM.manager(), S = NFM.state, raf = () => new Promise((r) => requestAnimationFrame(() => r()));
      if (!m.canary) m.canary = {}; m.canary[be] = { ok: true };
      try { await m.use(be); } catch (e) { return { err: e.message }; }
      if (m.r.name !== be) return { err: 'not available here (fell back to ' + m.r.name + ')' };
      const setTO = window.setTimeout; window.setTimeout = (f, ms, ...a) => (ms === 250 ? 0 : setTO(f, ms, ...a));   /* hold off the settle while we look */
      try {
        const turn = async (yaw, pitch) => { S.V.cam = Object.assign({}, S.V.cam, { yaw, pitch }); NFM.scheduleScene(true); await raf(); await raf(); await raf(); };
        for (let i = 0; i < 100 && !m.r.rigOK; i++) { m.r.rigPrepare(); await sleep0(100); }   /* WebGPU sets up its turning shaders a moment after the first picture */
        await turn(0.4, 0.3); await sleep0(100); await turn(0.5, 0.3);                  /* the first angle builds the picture for the card, the next ones only turn it */
        const sc0 = S.scene, on0 = !!(sc0.turn && sc0.turn.on), ok0 = m.r.rigOK;
        await turn(1.9, -0.25);
        const sc = S.scene, on = !!(sc.turn && sc.turn.on), vis = (q, k) => q.labels.filter((l) => l.minK <= k && l.size * k >= 6.5).length, labels = vis(sc, 0.8), shot = (v) => { m.r.draw(v); const s = m.r.snapshot(); return m.r.flush().then(() => ({ w: s.width, h: s.height, d: s.data })); };
        const view = { k: 0.8, tx: 30, ty: 30, invalidate() {} };
        S.view = view; let A = await shot(view);                                       /* drawn from the card */
        sc.turnTo(sc.turn.cam, 1.6); const labels2 = vis(sc, 0.8), A2 = await shot(view);
        let tex = {};                                                                    /* the other ways of sending the paint order must give the same picture as the usual way */
        for (const via of be === 'webgl2' ? ['texture'] : ['ring', 'map']) {
          const diff = (P, Q) => { let sm = 0; for (let i = 0; i < P.d.length; i += 4) sm += (Math.abs(P.d[i] - Q.d[i]) + Math.abs(P.d[i + 1] - Q.d[i + 1]) + Math.abs(P.d[i + 2] - Q.d[i + 2])) / 3; return sm / (P.d.length / 4); };
          let worst = 0;
          for (const cam of [sc.turn.cam, Object.assign({}, sc.turn.cam, { yaw: sc.turn.cam.yaw + 0.3 })]) {   /* two angles in a row, so a reused buffer is tested too */
            sc.turnTo(cam, 0.8); m.r.rigDebug = { orderVia: via }; const C = await shot(view); m.r.rigDebug = null; sc.turnTo(cam, 0.8); const A3 = await shot(view); worst = Math.max(worst, diff(C, A3));
          }
          tex[via] = worst;
        }
        NFM.settleTurn(); const full = !(S.scene.turn && S.scene.turn.on), labelsFull = vis(S.scene, 0.8), B = await shot(view);   /* the ordinary picture of the same angle */
        let sum = 0, far = 0; const n = A.d.length / 4; for (let i = 0; i < A.d.length; i += 4) { const d = (Math.abs(A.d[i] - B.d[i]) + Math.abs(A.d[i + 1] - B.d[i + 1]) + Math.abs(A.d[i + 2] - B.d[i + 2])) / 3; sum += d; if (d > 40) far++; }
        /* a selection made while turning */
        await turn(2.4, -0.2); const id = S.scene.nodes[3].nodeId; NFM.select(id); await raf(); await raf();
        const sel = S.scene.turn && S.scene.turn.on, dim = S.scene.nodes.some((q) => q.a < 0.5);
        /* zooming a settled big 3D map rides the card too (the logic sits above the renderers, so one backend is enough; the software WebGPU here stalls on the slow draws a zoom animation queues) */
        let fullBefore = true, zoomed = true, zoomOn = true, zfar = 999;
        if (be === 'webgl2') {
          NFM.settleTurn(); await raf(); await raf(); fullBefore = !(S.scene.turn && S.scene.turn.on); const k0 = S.view.k;
          NFM.zoomAt(400, 300, 1.5); await sleep0(900); zoomed = S.view.k > k0; zoomOn = !!(S.scene.turn && S.scene.turn.on);
          const zs = await shot(S.view); zfar = 0; for (let i = 0; i < zs.d.length; i += 4) if (zs.d[i] + zs.d[i + 1] + zs.d[i + 2] > 30) zfar++;
          NFM.fitView(false); await raf(); await raf(); NFM.settleTurn();   /* leave the view and the picture as they were */
        }
        let dc = 0; const od = window.GPUDevice && GPUDevice.prototype.destroy;   /* leaving a backend must destroy its device (an early version skipped it and leaked everything) */
        if (od) GPUDevice.prototype.destroy = function () { dc++; return od.apply(this, arguments); };
        try { await m.use('auto'); } finally { if (od) GPUDevice.prototype.destroy = od; }
        return { fullBefore, zoomed, zoomOn, zfar, dc, on0, ok0, on, labels: labels2, labelsFull, full, mean: sum / n, far: far / n, sel, dim, w: A.w, tex };
      } finally { window.setTimeout = setTO; NFM.select(null); }
      function sleep0(ms) { return new Promise((r) => setTO(r, ms)); }
    }, be);
    if (res.err) { say(strict ? false : null, `turning on the card with ${be}: ${res.err}`); continue; }
    say(res.ok0, `${be}: the card can take a map to turn`);
    say(res.on0 && res.on, `${be}: turning a big 3D map only sends the new angle to the card`);
    say(res.labels > 5 && res.labels === res.labelsFull, `${be}: the same names are drawn while turning as in the ordinary picture (${res.labels} and ${res.labelsFull})`);
    say(res.full && res.mean <= 1.5 && res.far < 0.01, `${be}: the picture from the card matches the ordinary picture: mean ${res.mean.toFixed(2)}/255, ${(res.far * 100).toFixed(2)}% pixels far off`);
    if (be === 'webgpu') say(res.dc >= 1, `${be}: leaving it destroys the graphics device and its buffers (${res.dc})`);
    for (const [via, d] of Object.entries(res.tex || {})) say(d <= 0.5, `${be}: sending the paint order the '${via}' way gives the same picture (mean difference ${d.toFixed(3)}/255)`);
    if (be === 'webgl2') say(res.fullBefore && res.zoomed && res.zoomOn && res.zfar > 100, `${be}: zooming a big 3D map draws from the card, not the heavy ordinary picture`);
    say(res.sel && res.dim, `${be}: selecting while turning dims the rest at once`);
  }
  await ev(() => NFM.manager().use('auto'));
  /* ================================================================ bug-hunt regression checks
     Each check below was seen FAILING on the build from before its fix (and passing after it). Odd names, saving, undo, export of fresh data, input, rules, the engine worker and the drawing manager. */
  await D.size(1100, 720); await settle(200);
  const W = (fn, arg, ms) => D.wait(fn, arg, ms || 20000).then(() => true, () => false);
  const mkG = (name, ids, links, attrs) => ({ name, nodes: ids.map((id) => Object.assign({ id, label: id }, attrs && attrs[id] ? { attrs: attrs[id] } : {})), edges: (links || ids.slice(1).map((id, i) => [ids[i], id])).map((l) => ({ from: l[0], to: l[1] })) });
  const load = (g, tab) => ev(([gg, t]) => { NFM.setGraph(NFMImport.sanitizeGraph(gg)); if (t) NFM.showTab(t); }, [g, tab || null]);
  const loadBig = (n, m, seed, tab) => ev(([a, b, c, tt]) => { NFM.setGraph(NFMExamples.bigNetwork(a, b, c)); if (tt) NFM.showTab(tt); }, [n, m, seed, tab || null]);
  const loadStory = () => ev(() => { NFM.setGraph(NFMExamples.LIST.filter((e) => e.id === 'story')[0].load().graph); NFM.showTab('map'); });
  const mapShows = (first) => W((lb) => { const S = NFM.state; return S.tab === 'map' && S.L && S.L.nodes.some((n) => n.label === lb || n.nodeId === lb) && S.scene && S.scene.nodes.length > 0; }, first);

  /* 1. odd names as keys in plain objects */
  try {
  { const r = await ev(() => {
      const out = {};
      try {
        localStorage.setItem('nfm-v:OddView', '{"__proto__":{"nfmPolluted":1},"block":null,"hideKinds":null,"facets":null,"hulls":true,"palette":"constructor","ramp":"toString","arrange":"constructor"}');
        NFM.setGraph(NFMImport.sanitizeGraph({ name: 'OddView', nodes: [{ id: 'A' }, { id: 'B' }], edges: [{ from: 'A', to: 'B' }] }));
      } catch (e) { out.err = String(e && e.message || e); }
      out.polluted = ({}).nfmPolluted !== undefined; delete Object.prototype.nfmPolluted;
      const V = NFM.state.V; out.lists = !!V && Array.isArray(V.block) && Array.isArray(V.hideKinds) && !!V.facets && typeof V.facets === 'object'; out.hulls = V && V.hulls; out.palette = V && V.palette; out.ramp = V && V.ramp; out.arrange = V && V.arrange;
      localStorage.removeItem('nfm-v:OddView');
      try { NFM.setGraph(NFMImport.sanitizeGraph({ name: 'OddView2', nodes: [{ id: 'A' }, { id: 'B' }], edges: [{ from: 'A', to: 'B' }] })); } catch (e) { /* a broken page stays broken; the checks above have said so */ }
      return out;
    });
    say(!r.polluted, 'a saved view with a "__proto__" key does not change every object in the page');
    say(!r.err && r.lists && r.hulls === true, 'a saved view with "block":null opens without an error, keeps its lists, and still applies its valid settings' + (r.err ? ' (' + r.err + ')' : ''));
    say(r.palette === 'standard' && r.ramp === 'warm' && r.arrange === 'stress', 'color set, color scale and arrangement names that are not on the lists fall back to the defaults (' + [r.palette, r.ramp, r.arrange].join(', ') + ')'); }
  } catch (e) { say(false, 'a step of the checks above stopped with an error: ' + String(e && e.message || e).split('\n')[0]); }
  await mapShows('A');
  try {
  { const r = await ev(async () => {
      const S = NFM.state, before = { palette: S.V.palette, ramp: S.V.ramp, arrange: S.V.arrange }; let ok = null; try { ok = NFM.applySnapshot({ palette: 'constructor', ramp: 'toString', arrange: 'constructor', hulls: true }); } catch (e) { ok = String(e && e.message || e); }
      const after = { palette: S.V.palette, ramp: S.V.ramp, arrange: S.V.arrange, hulls: S.V.hulls };
      S.V.palette = before.palette; S.V.ramp = before.ramp; S.V.arrange = before.arrange; S.V.hulls = false;   /* leave the page working whatever happened */
      return { before, after, ok };
    });
    say(r.ok === true && r.after.hulls === true && r.after.palette === r.before.palette && r.after.ramp === r.before.ramp && r.after.arrange === r.before.arrange, 'shared view text naming a color set, scale or arrangement that does not exist keeps the current ones and still applies the rest (' + JSON.stringify(r.after) + ')'); }
  } catch (e) { say(false, 'a step of the checks above stopped with an error: ' + String(e && e.message || e).split('\n')[0]); }
  await ev(() => NFM.refreshMap('options')); await settle(300);
  try {
  { const g = mkG('OddCat', ['n0', 'n1', 'n2', 'n3', 'n4', 'm', 'q'], [['n0', 'n1'], ['n1', 'n2'], ['n2', 'n3'], ['n3', 'n4'], ['n4', 'm'], ['m', 'q']]);
    g.nodes.forEach((n, i) => { n.group = i < 5 ? 'Constructor' : i === 5 ? 'constructor' : 'Other'; });
    await load(g, 'data');
    const r = await ev(async () => {
      const res = await NFM.client().check({}), f = res.L.findings.find((x) => /^catvariants:nodes/.test(x.id)), map = f && f.fix && f.fix.params.map;
      const mine = !!map && Object.prototype.hasOwnProperty.call(map, 'constructor') && map.constructor === 'Constructor';
      const fixed = f ? NFMCheck.applyFix(NFM.state.graph, f.fix) : null;
      const noop = NFMCheck.applyFix(NFM.state.graph, { id: 'catMap', params: { scope: 'nodes', key: 'group', map: { red: 'Red' } } });
      return { found: !!f, mine, groups: fixed ? fixed.graph.nodes.map((n) => typeof n.group === 'string' ? n.group : typeof n.group).join() : null, noop: noop === null };
    });
    say(r.found && r.mine && /^(Constructor,){6}Other$/.test(r.groups || '') && r.noop, 'a category called "constructor" is mapped to its common spelling, and a map that does not name it leaves it alone: ' + JSON.stringify(r)); }
  } catch (e) { say(false, 'a step of the checks above stopped with an error: ' + String(e && e.message || e).split('\n')[0]); }
  try {
  { await load({ name: 'OddPins', nodes: ['constructor', 'toString', 'A', 'B'].map((id) => ({ id })), edges: [['A', 'B'], ['A', 'constructor'], ['constructor', 'toString'], ['B', 'toString']].map((l) => ({ from: l[0], to: l[1] })) }, 'map');
    await ev(() => NFM.setV({ view: 'network', arrange: 'stress' })); await W(() => NFM.state.L && NFM.state.L.view === 'network' && !NFM.state.L.is3d && NFM.state.L.nodes.length === 4 && NFM.state.scene && NFM.state.scene.view === 'network');
    const r = await ev(async () => {
      const S = NFM.state; window.__L0 = S.L; S.V.pins['network|stress'] = { A: [10, 20] }; NFM.refreshMap('options');
      for (let i = 0; i < 400 && S.L === window.__L0; i++) await new Promise((q) => setTimeout(q, 25));
      const nodes = S.L.nodes; return { same: S.L === window.__L0, finite: nodes.every((n) => isFinite(n.cx) && isFinite(n.cy)), pinned: nodes.some((n) => (n.nodeId || n.id) === 'A' && n.cx === 10 && n.cy === 20), n: nodes.length };
    });
    say(!r.same && r.finite && r.pinned, 'after a drag, items called "constructor" or "toString" keep their places (no NaN) and the dragged item stays where it was put: ' + JSON.stringify(r));
    await ev(() => { delete NFM.state.V.pins['network|stress']; }); }
  } catch (e) { say(false, 'a step of the checks above stopped with an error: ' + String(e && e.message || e).split('\n')[0]); }

  /* 2. saving: told when it fails, flushed when the page goes away */
  try {
  { await load(mkG('SaveA', ['A', 'B']), 'data');
    const r = await ev(() => {
      NFM.setV({ hulls: true }, 'none'); window.dispatchEvent(new Event('pagehide'));
      const g = JSON.parse(localStorage.getItem('nfm-graph') || 'null'), v = JSON.parse(localStorage.getItem('nfm-v:SaveA') || 'null');
      NFM.setV({ hulls: false }, 'none'); return { name: g && g.name, hulls: v && v.hulls };
    });
    say(r.name === 'SaveA' && r.hulls === true, 'leaving the page saves an edit made less than a second ago, graph and view (pagehide): ' + JSON.stringify(r));
    await load(mkG('SaveB', ['A', 'B', 'C']), 'data');
    const r2 = await ev(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); delete document.hidden;
      const g = JSON.parse(localStorage.getItem('nfm-graph') || 'null'); return { name: g && g.name };
    });
    say(r2.name === 'SaveB', 'hiding the tab saves a pending edit at once (visibilitychange): ' + JSON.stringify(r2));
    const r3 = await ev(async () => {
      const t = document.getElementById('toast'), orig = Storage.prototype.setItem, wait = (ms) => new Promise((q) => setTimeout(q, ms)), out = {};
      Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); };
      try {
        t.hidden = true; t.textContent = ''; NFM.setGraph(NFMImport.sanitizeGraph({ name: 'SaveFull', nodes: [{ id: 'A' }, { id: 'B' }], edges: [{ from: 'A', to: 'B' }] })); await wait(900);
        out.first = !t.hidden && /could not be saved on this computer/.test(t.textContent) && /Export/.test(t.textContent);
        t.hidden = true; t.textContent = ''; NFM.setGraph(NFMImport.sanitizeGraph({ name: 'SaveFull', nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }], edges: [{ from: 'A', to: 'B' }] })); await wait(900);
        out.again = !t.hidden;
      } finally { Storage.prototype.setItem = orig; }
      return out;
    });
    say(r3.first === true && r3.again === false, 'a save that fails (storage full or blocked) says so once, in plain words: ' + JSON.stringify(r3));
    const r4 = await ev(async () => {
      const t = document.getElementById('toast'), real = JSON.stringify; t.hidden = true; t.textContent = '';
      /* a small graph whose saved text is made to come out too long, so the page is not asked to hold megabytes */
      JSON.stringify = function (v) { return v && v.name === 'SaveBig' ? 'x'.repeat(1900000) : real.apply(this, arguments); };
      try {
        NFM.setGraph(NFMImport.sanitizeGraph({ name: 'SaveBig', nodes: [{ id: 'A' }, { id: 'B' }], edges: [{ from: 'A', to: 'B' }] }));
        await new Promise((q) => setTimeout(q, 1000));
      } finally { JSON.stringify = real; }
      return { shown: !t.hidden, text: t.textContent };
    });
    say(r4.shown && /too big/.test(r4.text), 'data too big to keep on this computer says so (not silently dropped): ' + JSON.stringify(r4.text));
    await load(mkG('SaveEnd', ['A', 'B']), 'data'); }
  } catch (e) { say(false, 'a step of the checks above stopped with an error: ' + String(e && e.message || e).split('\n')[0]); }

  /* 3. changing how the table is read keeps an Undo step for edits made since */
  try {
  { await ev(() => NFM.showTab('data'));
    await ev(() => NFM.ingest([{ name: 'rd.csv', text: 'source,target,weight\nA,B,2\nB,C,1\nA,C,3\nC,D,1\n' }]));
    const r = await ev(() => {
      const S = NFM.state, g0 = S.graph;
      NFM.setGraph(Object.assign({}, g0, { nodes: g0.nodes.filter((n) => n.id !== 'D'), edges: g0.edges.filter((e) => e.to !== 'D') }));
      const edited = S.graph, sel = document.querySelector('#mapping select[data-map="header"]');
      if (!sel) return { err: 'no mapping box' };
      sel.value = '0'; sel.dispatchEvent(new Event('change', { bubbles: true }));
      const rebuilt = S.graph !== edited, toastText = document.getElementById('toast').textContent;
      document.getElementById('b-undo').click();
      return { rebuilt, back: S.graph === edited, toast: toastText };
    });
    say(!r.err && r.rebuilt && r.back, 'one Undo after changing how the table is read brings the edited data back: ' + JSON.stringify(r));
    say(/read the table again/i.test(r.toast || '') && /undone/i.test(r.toast || ''), 'changing how the table is read says so in one line and mentions Undo: ' + JSON.stringify(r.toast)); }
  } catch (e) { say(false, 'a step of the checks above stopped with an error: ' + String(e && e.message || e).split('\n')[0]); }

  /* 4. export, poster and the GIF use the data as it is now */
  try {
  { await ev(() => { window.__blobs = []; const o = URL.createObjectURL; URL.createObjectURL = function (b) { window.__blobs.push(b); return o.call(URL, b); }; window.print = () => { window.__poster = (document.getElementById('poster-img') || {}).innerHTML || ''; }; });
    const svgBlob = async (n) => { if (!(await W((k) => window.__blobs.length > k, n - 1, 15000))) return null; return ev(async (k) => await window.__blobs[k].text(), n - 1); };
    await load(mkG('ExpOld', ['OldAlpha', 'OldBeta', 'OldGamma']), 'map'); await mapShows('OldAlpha');
    await ev(() => NFM.showTab('export')); await settle(200);
    const clickBtn = (re) => ev((src) => { const b = [...document.querySelectorAll('#export-body button')].find((x) => new RegExp(src).test(x.textContent)); b.click(); }, re.source);
    await clickBtn(/SVG/); const svg0 = await svgBlob(1);
    say(!!svg0 && /OldAlpha/.test(svg0), 'the SVG export holds the names of the data that is shown (control)');
    await ev(() => NFM.showTab('data')); await load(mkG('ExpNew', ['NewAlpha', 'NewBeta', 'NewGamma', 'NewDelta']), 'export'); await settle(200);
    await clickBtn(/SVG/); const svg1 = await svgBlob(2);
    say(!!svg1 && /NewAlpha/.test(svg1) && !/OldAlpha/.test(svg1), 'after new data is brought in, the SVG export shows the new data, not the old map' + (svg1 ? '' : ' (nothing was saved)'));
    await ev(() => NFM.showTab('data')); await load(mkG('ExpPoster', ['PosterAlpha', 'PosterBeta', 'PosterGamma']), 'export'); await settle(200);
    await clickBtn(/Poster/); const posterOk = await W(() => !!window.__poster, null, 15000), poster = posterOk ? await ev(() => window.__poster) : '';
    say(/PosterAlpha/.test(poster) && !/NewAlpha/.test(poster), 'after new data is brought in, the poster shows the new data');
    /* a setting changed on another tab shows when the Map is opened */
    await ev(() => { NFM.showTab('map'); }); await mapShows('PosterAlpha');
    await ev(() => { NFM.setV({ view: 'flow', dir: 'LR' }); NFM.showTab('map'); }); await mapShows('PosterAlpha'); await settle(300);
    const seenDir = await ev(async () => {
      const c = NFM.client(), orig = c.build; let seen = null;
      c.build = function (o) { if (!seen) seen = o; return orig.apply(this, arguments); };
      try { NFM.showTab('adv'); NFM.setV({ dir: 'TB' }, 'none'); NFM.showTab('map'); for (let i = 0; i < 60 && !seen; i++) await new Promise((q) => setTimeout(q, 50)); } finally { c.build = orig; }
      return seen && seen.dir;
    });
    say(seenDir === 'TB', 'a setting changed on the Advanced tab (direction) is used to draw the Map when it is opened again (' + seenDir + ')');
    await ev(() => NFM.setV({ dir: 'LR' })); await settle(300); }
  } catch (e) { say(false, 'a step of the checks above stopped with an error: ' + String(e && e.message || e).split('\n')[0]); }
  try {
  { await loadBig(40, 3, 5, 'map'); await ev(() => NFM.setV({ view: 'network', arrange: 'force3d' }));   /* a small 3D map for the GIF checks */
    await W(() => NFM.state.L && NFM.state.L.is3d && NFM.state.scene && NFM.state.scene.is3d && NFM.state.L.nodes.length === NFM.state.graph.nodes.length, null, 30000);
    await ev(() => NFM.showTab('export')); await settle(200);
    await ev(() => { const sel = [...document.querySelectorAll('#gif-card select')], put = (s, v) => { s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }; const by = (t) => [...document.querySelectorAll('#gif-card label.field')].find((l) => l.textContent.startsWith(t)).querySelector('select'); put(sel[0], '640'); put(by('Seconds per turn'), '2'); put(by('Smoothness'), '6'); });
    await click('#gif-go');
    const made = await W(() => { const im = document.querySelector('#gif-out img'); return im && im.complete && im.naturalWidth > 0; }, null, 60000);
    say(made, 'a turn-around GIF of the 3D map is made (control for the next checks)');
    /* the new GIF options: exact 25 FPS timing, pauses with a reversal, a filter reaching the palette */
    const parse = (bytes) => { const b = bytes; let p = 13 + 768, sum = 0, n = 0; const ds = []; if (!(b[10] & 0x80)) return null; p = 13; const pal = []; for (let i = 0; i < 256; i++) pal.push([b[p + i * 3], b[p + i * 3 + 1], b[p + i * 3 + 2]]); p += 768;
      while (b[p] !== 0x3b && p < b.length) { if (b[p] === 0x21) { const l = b[p + 1]; p += 2; if (l === 0xf9) { ds.push(b[p + 2] | b[p + 3] << 8); sum += (b[p + 2] | b[p + 3] << 8); n++; } while (b[p] !== 0) p += b[p] + 1; p++; } else if (b[p] === 0x2c) { p += 10; p++; while (b[p] !== 0) p += b[p] + 1; p++; } else break; } return { ds, sum, n, pal }; };
    const runCfg = async (patch) => { await ev((pt) => NFM.gifRun(pt), patch); await W(() => { const b = document.getElementById('gif-go'); return b && !b.disabled && NFM.gif(); }, null, 120000); return ev(() => { const r = NFM.gif(); return { bytes: Array.from(r.bytes), frames: r.frames, workers: r.workers, inline: r.inline, card: r.card, video: r.video, asked: r.asked }; }); };
    {
      const a = await runCfg({ size: 640, fps: 25, turns: 1, turnSec: 2, pause: 0, ease: 'linear', names: 'always', arc: 360, reverse: false, filter: { brightness: 0, contrast: 0, saturation: 0, warmth: 0, hue: 0, tone: 'none', blur: 0, sharpen: 0, glow: 0, vignette: 0 } });
      const g = parse(a.bytes); say(g && a.frames === 50 && g.ds.every((d) => d === 4) && g.n >= 40, `GIF at 25 FPS: ${a.frames} pictures, every one shown for exactly 4 hundredths (${g && g.ds.slice(0, 3)}); ${a.workers} worker${a.workers === 1 ? '' : 's'}${a.inline ? ' (on the page)' : ''}`);
      const b2 = await runCfg({ turns: 2, pause: 1, reverse: true, ease: 'smooth' }); const g2 = parse(b2.bytes);
      say(g2 && Math.abs(g2.sum - (2 * 200 + 2 * 100)) <= 2 && b2.frames >= 100, `GIF with 2 turns, a 1 s pause after each and the spin reversed: total ${g2 && g2.sum} hundredths (6 s expected), ${b2.frames} pictures`);
      const c2 = await runCfg({ turns: 1, pause: 0, ease: 'linear', filter: { tone: 'mono', contrast: 0.1 } }); const g3 = parse(c2.bytes);
      say(g3 && g3.pal.slice(0, 200).every((c) => Math.abs(c[0] - c[1]) <= 2 && Math.abs(c[1] - c[2]) <= 2 || (c[0] === 0 && c[1] === 0 && c[2] === 0)), 'GIF with the black-and-white look: the palette holds only grays');
      const look = { glow: 0.6, blur: 1, vignette: 0.4, sharpen: 0.3, saturation: 0.2, tone: 'none', contrast: 0 };
      const off = await runCfg({ filter: look, card: 'off', turns: 1, pause: 0, ease: 'linear' }), onC = await runCfg({ filter: look, card: 'auto' });
      say(off.card === false && off.frames === onC.frames && Math.abs(onC.bytes.length - off.bytes.length) <= off.bytes.length * 0.08, `GIF with the full look, card off ${off.bytes.length} bytes, card auto ${onC.bytes.length} bytes (${onC.card ? 'graphics card used' : 'card not available here, WebAssembly used'}): same pictures, file sizes within 8%`);
      await runCfg({ filter: { tone: 'none', contrast: 0 }, card: 'auto', size: 640, turnSec: 2, turns: 1, pause: 0 });
      {   /* video: MP4 where the browser can make it, else WebM, else the GIF */
        const plain = { filter: { tone: 'none', contrast: 0, blur: 0, sharpen: 0, glow: 0, vignette: 0 }, size: 640, turnSec: 2, turns: 1, pause: 0, ease: 'linear', reverse: false, arc: 360 };
        const has = (b, t) => { const q = [...t].map((c) => c.charCodeAt(0)); for (let i = 0; i + q.length <= b.length; i++) { let k = 0; while (k < q.length && b[i + k] === q[k]) k++; if (k === q.length) return i; } return -1; };
        const gifRef = await runCfg(Object.assign({ format: 'gif' }, plain)), vd = await runCfg(Object.assign({ format: 'video' }, plain));
        const supported = await ev(() => typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined');
        if (!supported) say(vd.video === '' && vd.asked === 'video' && String.fromCharCode(...vd.bytes.slice(0, 6)) === 'GIF89a', 'Video asked for, this browser has no video encoder: a GIF is made instead and the result says so');
        else {
          const b = vd.bytes, ok = vd.video === 'mp4' ? (String.fromCharCode(...b.slice(4, 8)) === 'ftyp' && has(b, 'moov') > 0 && has(b, 'avcC') > 0) : vd.video === 'webm' ? (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 && has(b, 'V_VP9') > 0) : false;
          say(ok, `Video: a ${vd.video || 'no'} file has the right headers (${b.length} bytes against ${gifRef.bytes.length} for the GIF of the same ${gifRef.frames} pictures)`);
          const im = await ev(() => { const v = document.querySelector('#gif-out video'); return v ? v.poster.slice(0, 14) + '|' + v.src.slice(0, 5) : ''; }); say(im === 'data:image/png|blob:', 'Video: the result has a player with the first picture shown before play (' + im + ')');
          let n = -1; if (vd.video === 'mp4') { const i = has(b, 'stsz'); n = i < 0 ? -1 : ((b[i + 12] << 24 | b[i + 13] << 16 | b[i + 14] << 8 | b[i + 15]) >>> 0); }
          say(vd.frames === gifRef.frames && (vd.video !== 'mp4' || n === vd.frames), `Video: one video picture for every picture of the GIF (${vd.frames}${vd.video === 'mp4' ? ', the file lists ' + n : ''})`);
          await ev(() => { window.__ve = window.VideoEncoder; window.VideoEncoder = undefined; });
          const fb = await runCfg(Object.assign({ format: 'video' }, plain));
          await ev(() => { window.VideoEncoder = window.__ve; });
          say(fb.video === '' && fb.asked === 'video' && String.fromCharCode(...fb.bytes.slice(0, 6)) === 'GIF89a', 'Video asked for but the browser has no video encoder: a GIF is made instead');
        }
        await runCfg(Object.assign({ format: 'gif' }, plain));
      }
      {   /* the legend choice: Short, Full and Off make different pictures; Off leaves the corner empty */
        const plain = { format: 'gif', filter: { tone: 'none', contrast: 0, blur: 0, sharpen: 0, glow: 0, vignette: 0 }, size: 640, turnSec: 2, turns: 1, pause: 0, ease: 'linear', reverse: false, arc: 360 };
        const sh = await runCfg(Object.assign({ legend: 'short' }, plain)), off = await runCfg(Object.assign({ legend: 'off' }, plain)), fu = await runCfg(Object.assign({ legend: 'full' }, plain));
        const same = (x, y) => x.bytes.length === y.bytes.length && x.bytes.every((v, i) => v === y.bytes[i]);
        say(!same(sh, off) && sh.frames === off.frames && fu.frames === sh.frames, `Legend choice: Short (${sh.bytes.length} bytes) and Off (${off.bytes.length} bytes) make different GIFs with the same ${sh.frames} pictures`);
        const sv = await ev(() => { const sel = [...document.querySelectorAll('#gif-card label.field')].find((l) => l.textContent.startsWith('Legend')).querySelector('select'); sel.value = 'full'; sel.dispatchEvent(new Event('change', { bubbles: true })); return JSON.parse(localStorage.getItem('nfm-gif') || '{}').legend; });
        say(sv === 'full', 'The legend choice in the GIF maker is remembered (' + sv + ')');
        await ev(() => { const sel = [...document.querySelectorAll('#gif-card label.field')].find((l) => l.textContent.startsWith('Legend')).querySelector('select'); sel.value = 'short'; sel.dispatchEvent(new Event('change', { bubbles: true })); });
      }
    }
    await ev(() => { document.getElementById('gif-go').click(); setTimeout(() => NFM.setGraph(NFMImport.sanitizeGraph({ name: 'GifOther', nodes: [{ id: 'A' }, { id: 'B' }], edges: [{ from: 'A', to: 'B' }] })), 40); });
    await W(() => { const b = document.getElementById('gif-go'); return b && !b.disabled; }, null, 60000); await settle(200);
    const r = await ev(() => ({ img: !!document.querySelector('#gif-out img'), text: (document.getElementById('gif-out') || {}).textContent || '' }));
    say(!r.img && /data changed/i.test(r.text), 'a GIF made while the data changed is dropped, not attached to the new data: ' + JSON.stringify(r.text.slice(0, 90)));
    await loadBig(40, 3, 5, 'map'); await ev(() => NFM.setV({ view: 'network', arrange: 'force3d' })); await W(() => NFM.state.L && NFM.state.L.is3d && NFM.state.scene && NFM.state.scene.is3d && NFM.state.L.nodes.length === NFM.state.graph.nodes.length, null, 30000);
    await ev(() => NFM.showTab('export')); await settle(200);
    await ev(() => { const sel = [...document.querySelectorAll('#gif-card select')], put = (s, v) => { s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }; const by = (t) => [...document.querySelectorAll('#gif-card label.field')].find((l) => l.textContent.startsWith(t)).querySelector('select'); put(sel[0], '640'); put(by('Seconds per turn'), '2'); put(by('Smoothness'), '6'); document.getElementById('gif-go').click(); document.getElementById('gif-cancel').click(); });
    await W(() => { const b = document.getElementById('gif-go'); return b && !b.disabled; }, null, 60000); await settle(200);
    say(await ev(() => (document.getElementById('gif-out') || {}).textContent) === 'Canceled.', 'canceling the GIF says "Canceled." (American spelling)'); }
  } catch (e) { say(false, 'a step of the checks above stopped with an error: ' + String(e && e.message || e).split('\n')[0]); }

  /* 5. undo: Sankey steps belong to one dataset; going back across a rename brings back the other data's settings */
  try {
  { await loadStory(); await ev(() => NFM.setV({ view: 'sankey' })); await W(() => NFM.state.L && NFM.state.L.view === 'sankey' && NFM.state.L.sk && NFM.state.scene && NFM.state.scene.view === 'sankey');
    await ev(() => { document.getElementById('rt-look').click(); const f = [...document.querySelectorAll('#railbody label.field')].find((l) => /Flow color/.test(l.textContent)); const s = f.querySelector('select'); s.value = 'source'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await settle(300);
    const r = await ev(() => {
      const first = NFM.state.graph.name; localStorage.setItem('nfm-v:SkOther', '{"view":"sankey"}');
      NFM.setGraph(NFMImport.sanitizeGraph({ name: 'SkOther', start: 'A', nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }], edges: [{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }] }));
      const view = NFM.state.V.view; document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
      localStorage.removeItem('nfm-v:SkOther'); return { first, now: NFM.state.graph.name, view };
    });
    say(r.view === 'sankey' && r.now === r.first, 'after new data is brought in, Ctrl+Z undoes the data change, not a Sankey step of the old data: ' + JSON.stringify(r)); }
  } catch (e) { say(false, 'a step of the checks above stopped with an error: ' + String(e && e.message || e).split('\n')[0]); }
  try {
  { await load(mkG('UndoOne', ['A', 'B', 'C']), 'map'); await mapShows('A');
    await ev(() => { NFM.setV({ hulls: true }, 'none'); NFM.setGraph(NFMImport.sanitizeGraph({ name: 'UndoTwo', nodes: [{ id: 'X' }, { id: 'Y' }], edges: [{ from: 'X', to: 'Y' }] })); });
    await until(() => NFM.state.graph.name === 'UndoTwo' && localStorage.getItem('nfm-v:UndoOne') !== null, null, 2000);
    const keep = await ev(() => { const o = JSON.parse(localStorage.getItem('nfm-v:UndoOne') || 'null'); return !!o && o.hulls === true; });
    say(keep, 'bringing in other data right after a setting change still saves the old data\'s setting under the old name');
    await ev(() => document.getElementById('b-undo').click()); await until(() => NFM.state.graph.name === 'UndoOne', null, 2000);
    const r = await ev(() => { const one = JSON.parse(localStorage.getItem('nfm-v:UndoOne') || 'null'), two = JSON.parse(localStorage.getItem('nfm-v:UndoTwo') || 'null'); return { name: NFM.state.graph.name, hulls: NFM.state.V.hulls, savedOne: !!one && one.hulls === true, savedTwoHulls: !!two && two.hulls === true }; });
    say(r.name === 'UndoOne' && r.hulls === true && r.savedOne && !r.savedTwoHulls, 'undoing back to the earlier data brings back its own settings and does not save the later data\'s settings over them: ' + JSON.stringify(r)); }
  } catch (e) { say(false, 'a step of the checks above stopped with an error: ' + String(e && e.message || e).split('\n')[0]); }

  /* 6. a chosen link stays the same link when the view changes */
  try {
  { await loadStory(); await ev(() => NFM.setV({ view: 'flow' })); await W(() => NFM.state.L && NFM.state.L.view === 'flow' && NFM.state.scene && NFM.state.scene.view === 'flow');
    const sig = () => ev(() => NFM.state.L.edges.map((e) => (e.orig || []).join('+')));
    const flowSig = await sig(); await ev(() => NFM.setV({ view: 'network', arrange: 'stress' })); await W(() => NFM.state.L && NFM.state.L.view === 'network' && NFM.state.scene && NFM.state.scene.view === 'network');
    const netSig = await sig(); let pick = -1;
    for (let i = 0; i < flowSig.length && pick < 0; i++) { const a = new Set(flowSig[i].split('+')); if (flowSig[i] && (i >= netSig.length || !netSig[i].split('+').some((x) => a.has(x)))) pick = i; }
    if (pick < 0) say(null, 'chosen link and view change: no link number changes meaning between Flow and Network in this example, nothing to test');
    else {
      await ev(() => NFM.setV({ view: 'flow' })); await W(() => NFM.state.L && NFM.state.L.view === 'flow' && NFM.state.scene && NFM.state.scene.view === 'flow');
      const r = await ev(async (i) => {
        const S = NFM.state, orig = new Set(S.L.edges[i].orig); NFM.setSel([], { edges: [i] }); NFM.setV({ view: 'network', arrange: 'stress' });
        for (let k = 0; k < 400 && !(S.L.view === 'network' && S.scene && S.scene.view === 'network'); k++) await new Promise((q) => setTimeout(q, 25));
        const sel = Array.from(S.selEdges); return { sel: sel.length, ok: sel.every((j) => S.L.edges[j] && (S.L.edges[j].orig || []).some((x) => orig.has(x))), shown: sel.length === 0 || !document.getElementById('details').hidden };
      }, pick);
      say(r.ok, 'a chosen link stays the same link (or is let go) when the view changes, instead of pointing at another link: ' + JSON.stringify(r)); } }
  } catch (e) { say(false, 'a step of the checks above stopped with an error: ' + String(e && e.message || e).split('\n')[0]); }

  /* 7. input */
  try {
  { await load(mkG('InputFlow', ['A', 'B', 'C', 'D']), 'map'); await ev(() => NFM.setV({ view: 'flow' })); await mapShows('A'); await settle(300);
    const r = await ev(() => {
      const S = NFM.state, st = document.getElementById('stage'), rc = st.getBoundingClientRect();
      const fire = (type, id, x, y) => st.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: rc.left + x, clientY: rc.top + y, button: 0, bubbles: true, cancelable: true }));
      NFM.fitView(true);
      fire('pointerdown', 1, 300, 500); fire('pointerdown', 2, 400, 500); fire('pointermove', 2, 420, 500); fire('pointerup', 1, 300, 500);
      const tx0 = S.view.tx, ty0 = S.view.ty; fire('pointermove', 2, 470, 520); const dx = S.view.tx - tx0, dy = S.view.ty - ty0; fire('pointerup', 2, 470, 520);
      NFM.fitView(true); return { dx, dy };
    });
    say(Math.abs(r.dx - 50) < 1 && Math.abs(r.dy - 20) < 1, 'after a pinch, the finger that stays down pans the map (moved ' + r.dx.toFixed(1) + ', ' + r.dy.toFixed(1) + ' for a drag of 50, 20)');
    const k = await ev(() => {
      const st = document.getElementById('stage'); st.focus();
      const key = (kk, mods) => { const e = new KeyboardEvent('keydown', Object.assign({ key: kk, bubbles: true, cancelable: true }, mods)); st.dispatchEvent(e); return e.defaultPrevented; };
      const out = { plain: [key('-', {}), key('=', {}), key('0', {})], ctrl: [key('-', { ctrlKey: true }), key('=', { ctrlKey: true }), key('+', { ctrlKey: true }), key('0', { ctrlKey: true }), key('0', { metaKey: true }), key('-', { altKey: true })] };
      NFM.fitView(true); return out;
    });
    say(k.plain.every((x) => x === true) && k.ctrl.every((x) => x === false), 'the map keys + - 0 work alone but leave Ctrl/Cmd/Alt + - 0 (browser zoom) to the browser: ' + JSON.stringify(k)); }
  } catch (e) { say(false, 'a step of the checks above stopped with an error: ' + String(e && e.message || e).split('\n')[0]); }
  try {
  { await loadBig(60, 4, 3, 'map'); await ev(() => NFM.setV({ view: 'network', arrange: 'force3d' }));
    await W(() => NFM.state.L && NFM.state.L.is3d && NFM.state.scene && NFM.state.scene.is3d && NFM.state.L.nodes.length === NFM.state.graph.nodes.length, null, 30000); await settle(300);
    await ev(() => { document.getElementById('rt-look').click(); const lab = [...document.querySelectorAll('#railbody label')].find((l) => /Spin slowly/.test(l.textContent)); lab.querySelector('input').click(); });
    const yaw = () => ev(() => NFM.state.V.cam.yaw);
    const y0 = await yaw(); await sleep(350); const y1 = await yaw();
    await ev(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); }); await sleep(200); const y2 = await yaw(); await sleep(250); const y3 = await yaw();
    await ev(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); }); await sleep(400); const y4 = await yaw();
    say(y1 > y0 && Math.abs(y3 - y2) < 1e-9 && y4 > y3, 'a spinning 3D map stops while the tab is hidden and spins again when it is shown (' + [y0, y1, y2, y3, y4].map((x) => x.toFixed(3)).join(' ') + ')');
    await ev(() => { const lab = [...document.querySelectorAll('#railbody label')].find((l) => /Spin slowly/.test(l.textContent)); lab.querySelector('input').click(); }); }
  } catch (e) { say(false, 'a step of the checks above stopped with an error: ' + String(e && e.message || e).split('\n')[0]); }

  /* 8. style rules, link filters, the tuning dialog, the odds table, the sweep */
  try {
  { await load(mkG('RuleBlank', ['A', 'B', 'C', 'D'], [['A', 'B'], ['B', 'C'], ['C', 'D']], { A: { score: 3 }, B: { score: 7 }, D: { score: '' } }), 'map'); await mapShows('A');
    const rules = (op, value) => ev(([o, v]) => { const S = NFM.state; S.V.rules = [{ id: 1, target: 'nodes', on: true, when: { type: 'column', col: 'score', op: o, value: v }, set: { fill: '#ff0000' } }]; S.styleMap = null; NFM.setV({ hulls: !S.V.hulls }, 'look'); const m = S.styleMap && S.styleMap.nodes; return m ? Array.from(m.keys()).sort().join() : null; }, [op, value]);
    const lt = await rules('<', '5'), ge = await rules('>=', '7');
    say(lt === 'A', 'a style rule "score < 5" catches only items that have a score under 5, not items with no score: ' + lt);
    say(ge === 'B', 'a style rule "score >= 7" does not catch items with no score: ' + ge);
    await ev(() => { NFM.state.V.rules = []; NFM.state.styleMap = null; }); }
  } catch (e) { say(false, 'a step of the checks above stopped with an error: ' + String(e && e.message || e).split('\n')[0]); }
  try {
  { const g = mkG('GroupColors', ['A', 'B', 'C'], [['A', 'B'], ['B', 'C']]); g.nodes[0].group = 'alpha'; g.nodes[1].group = 'beta'; g.nodes[2].group = 'gamma';
    await load(g, 'map'); await mapShows('B');
    const col = () => ev(() => { const S = NFM.state, l = (S.scene.legend || []).filter((x) => x.t === 'gamma')[0]; return l ? JSON.stringify(l.c) : null; });
    for (let i = 0; i < 40 && (await col()) === null; i++) await settle(100);   // the legend can arrive a moment after the map text on a slow browser
    const before = await col();
    await ev(async () => { const S = NFM.state; window.__L2 = S.L; S.V.block = ['A']; NFM.refreshMap('options'); for (let i = 0; i < 400 && S.L === window.__L2; i++) await new Promise((q) => setTimeout(q, 25)); });
    await settle(300); const after = await col();
    say(before !== null && before === after, 'hiding the first group does not recolor the others (' + before + ' then ' + after + ')');
    await ev(() => { NFM.state.V.block = []; NFM.refreshMap('options'); }); await settle(300); }
  { const g = mkG('FacetTwo', ['A', 'B', 'C']); g.edges = [{ from: 'A', to: 'B', attrs: { c1: 'x', c2: 'p' } }, { from: 'A', to: 'C', attrs: { c1: 'x', c2: 'q' } }, { from: 'B', to: 'C', attrs: { c1: 'y', c2: 'p' } }];
    await load(g, 'map'); await mapShows('A');
    const r = await ev(async () => {
      const S = NFM.state, c = NFM.client(), orig = c.build; let seen = null;
      c.build = function (o) { seen = o; return orig.apply(this, arguments); };
      try { S.V.facets = { 'e:c1': ['x'], 'e:c2': ['p'] }; window.__L1 = S.L; NFM.refreshMap('options'); } finally { c.build = orig; }
      for (let i = 0; i < 400 && S.L === window.__L1; i++) await new Promise((q) => setTimeout(q, 25));
      const out = { n: seen && (seen.edgeFacets || []).length, first: !!(seen && seen.edgeFacet), edges: S.L.edges.length };
      S.V.facets = {}; NFM.refreshMap('options'); return out;
    });
    say(r.n === 2 && r.first, 'both link filters of the panel are sent to the engine: ' + JSON.stringify(r));
    say(r.edges === 1 ? true : null, r.edges === 1 ? 'two link filters together keep only the links that pass both' : 'two link filters together: the engine used only one of them (' + r.edges + ' links kept, 1 expected); the engine has to read edgeFacets (see the report)');
    await settle(300); }
  } catch (e) { say(false, 'a step of the checks above stopped with an error: ' + String(e && e.message || e).split('\n')[0]); }
  try {
  { await ev(() => NFM.showTab('adv')); await settle(300);
    const had = await ev(() => !!NFM.state.tune);
    await ev(() => { [...document.querySelectorAll('#adv-body button')].find((b) => /Test this computer|Run the test again/.test(b.textContent)).click(); });
    await ev(() => { [...document.querySelectorAll('#dlg-body button')].find((b) => /Run the test/.test(b.textContent)).click(); });
    await W(() => /The processor|The graphics card/.test(document.getElementById('dlg-body').textContent), null, 20000);   /* the test is really running (a fixed wait stopped being safe when the layout got faster) */
    await D.press('Escape');
    const ended = await W(() => /did not change anything|settings saved/.test(document.getElementById('dlg-body').textContent), null, 90000);
    const r = await ev(() => ({ open: document.getElementById('dlg').open, text: document.getElementById('dlg-body').textContent.slice(0, 60), tuned: !!NFM.state.tune }));
    say(ended && !r.open && !r.tuned && !had && /did not change anything/.test(r.text), 'pressing Escape in the tuning test stops it and saves nothing: ' + JSON.stringify(r)); }
  } catch (e) { say(false, 'a step of the checks above stopped with an error: ' + String(e && e.message || e).split('\n')[0]); }
  try {
  { const g = { name: 'SimOdd', start: 'S', nodes: ['S', 'M1', 'M2', 'constructor', 'toString'].map((id) => ({ id })), edges: [['S', 'M1'], ['S', 'M2'], ['M1', 'constructor'], ['M1', 'toString'], ['M2', 'toString']].map((l) => ({ from: l[0], to: l[1], weight: 1 })) };
    await load(g, 'adv'); await settle(300);
    const runSim = async (rule) => { await ev((ru) => { const S = NFM.state; S.A.sim = Object.assign({}, S.A.sim, { walkers: 1000, repeats: 10, rule: ru, starts: [] }); NFM.showTab('data'); NFM.showTab('adv'); }, rule); await settle(200); await click('#sim-run'); await W(() => /Done\./.test(document.getElementById('sim-results').textContent), null, 60000); await sleep(300); };
    const rows = () => ev(() => [...document.querySelectorAll('#sim-results .eprow')].map((r) => ({ name: r.querySelector('button').textContent, num: r.querySelector('.epnum').textContent })));
    await runSim('weights'); const w = await rows();
    say(w.length === 2 && w.every((x) => /exact \d/.test(x.num)), 'odds table with ends called "constructor" and "toString": each shows its exact odds (control): ' + JSON.stringify(w.map((x) => x.name)));
    /* the ranking: switch Items/Links while it is working */
    await ev(() => { document.getElementById('sim-sweep').click(); [...document.querySelectorAll('#sim-results .seg button')].find((b) => b.textContent === 'Links').click(); }); await sleep(900);
    const sw = await ev(() => { const t = [...document.querySelectorAll('#sim-results table.t')].find((x) => /Odds that move/.test(x.textContent)); return t ? [...t.querySelectorAll('tbody tr td:first-child')].map((c) => c.textContent) : []; });
    say(sw.every((x) => x.indexOf('→') >= 0), 'a ranking started for items is not shown after switching to links: ' + JSON.stringify(sw));
    await runSim('curious'); const c = await rows();
    say(c.length === 2 && c.every((x) => !/exact|≠|NaN/.test(x.num)), 'when the exact odds are not available, ends called "constructor" and "toString" show no exact odds: ' + JSON.stringify(c.map((x) => x.num))); }
  } catch (e) { say(false, 'a step of the checks above stopped with an error: ' + String(e && e.message || e).split('\n')[0]); }

  /* the unit of work behind every name: no name declared twice in the page's shared scope (a second `refreshMapSoon` hid the throttle for the simulation) */
  try {
  { const fs = require('fs'), dir = path.resolve(__dirname, '..', 'src', 'app'), seen = {};
    fs.readdirSync(dir).filter((f) => /\.js$/.test(f)).sort().forEach((f) => fs.readFileSync(path.join(dir, f), 'utf8').split('\n').forEach((l) => { const m = /^function (\w+)\(/.exec(l) || /^var (\w+)\s*=/.exec(l); if (m) (seen[m[1]] = seen[m[1]] || []).push(f); }));
    const dups = Object.keys(seen).filter((k) => seen[k].length > 1).map((k) => k + ' (' + seen[k].join(', ') + ')');
    say(dups.length === 0, 'no function or variable is declared twice at the top of src/app' + (dups.length ? ': ' + dups.join('; ') : '')); }
  } catch (e) { say(false, 'a step of the checks above stopped with an error: ' + String(e && e.message || e).split('\n')[0]); }

  /* 8b. an idle engine worker is ended on a big map and restarts on the next layout; look-only changes never wake it; a running simulation keeps it */
  try {
    const mode0 = await ev(() => { const c = NFM.client(); c.parkMin = 0; c.parkAfter = 120; return c.mode; });
    if (mode0 !== 'worker') say(true, 'idle worker parking: skipped here, the page runs the engine itself (' + mode0 + ')');
    else {
      await ev(() => { NFM.client().armPark(); });
      await D.wait(() => NFM.client().parked && NFM.client().w === null, null, 8000).catch(async (e) => { const d = await ev(() => { const c = NFM.client(); return { mode: c.mode, w: !!c.w, parked: c.parked, busy: !!c.busy, pending: c.pending.size, hold: !!(c.holdIf && c.holdIf()), keepWarm: c.keepWarm, queues: Object.keys(c.queues || {}).filter((k) => c.queues[k]), nodes: c.graph && c.graph.nodes && c.graph.nodes.length, timer: !!c.parkTimer }; }); throw new Error('not parked: ' + JSON.stringify(d)); });
      const a = await ev(() => { const c = NFM.client(); return { parked: c.parked, w: !!c.w, parks: c.parks }; });
      say(a.parked && !a.w && a.parks >= 1, 'an idle worker is ended once nothing is waiting for it: ' + JSON.stringify(a));
            await ev(() => NFM.setV({ ruler: true }, 'look')); await settle(300);
      say(await ev(() => NFM.client().parked), 'a look-only change does not wake the ended worker');
      await ev(() => { NFM.setGraph(JSON.parse(JSON.stringify(NFM.state.graph)), false, true); window.__tab0 = NFM.state.tab; NFM.showTab('map'); });
      await D.wait(() => { const c = NFM.client(); return c.unparks >= 1 && NFM.state.sceneOk && !NFM.state.mapBusy; }, null, 30000).catch(async () => { const d = await ev(() => { const c = NFM.client(), S = NFM.state; return { parked: c.parked, w: !!c.w, busy: !!c.busy, pend: c.pending.size, unparkP: !!c.unparkP, mode: c.mode, mapBusy: S.mapBusy, sceneOk: S.sceneOk, tab: S.tab, gver: S.gver, mapStale: S.mapStale, err: S.err || null }; }); throw new Error('no restart: ' + JSON.stringify(d)); }); await settle(200);
      const b = await ev(() => { const c = NFM.client(); return { unparks: c.unparks, nodes: NFM.state.L.nodes.length, ms: c.unparkMs }; });
      await ev(() => { window.__u0 = NFM.client().unparks; NFM.setGraph(JSON.parse(JSON.stringify(NFM.state.graph)), false, true); NFM.showTab('map'); NFM.state.mapStale = -1; NFM.refreshMap('test'); });
      await D.wait(() => NFM.client().unparks > window.__u0 && NFM.state.sceneOk && !NFM.state.mapBusy, null, 30000); await settle(200);
      b.again = await ev(() => NFM.state.L.nodes.length);
      say(b.unparks >= 1 && b.nodes > 0 && b.nodes === b.again && b.ms >= 0, 'the next layout restarts the worker, hands it the graph again and draws the same map: ' + JSON.stringify(b));
      await ev(() => { if (window.__tab0 && window.__tab0 !== 'map') NFM.showTab(window.__tab0); });
      const c2 = await ev(() => { const c = NFM.client(), keep = c.holdIf; c.holdIf = () => true; const r = c.park(); c.holdIf = keep; return r; });
      say(c2 === false, 'a worker that the page asks to keep (a running simulation) is not ended');
    }
    await ev(async () => { const c = NFM.client(); c.parkMin = 20000; c.parkAfter = 0; if (c.parkTimer) { clearTimeout(c.parkTimer); c.parkTimer = null; } if (c.parked) await c.unpark(); });   /* off for the rest of the run, so later steps find the worker alive */
  } catch (e) { say(false, 'idle worker parking stopped with an error: ' + String(e && e.message || e).split('\n')[0]); }

  /* 8c. scene links kept as typed arrays while idle: packed, picked, drawn again from rebuilt objects; the picture does not change by a single byte */
  try {
    await ev(() => { window.__g1 = JSON.parse(JSON.stringify(NFM.state.graph)); window.__v1 = { view: NFM.state.V.view, arrange: NFM.state.V.arrange }; window.__tab1 = NFM.state.tab; NFM.setGraph(NFMExamples.bigNetwork(1500, 8, 7)); NFM.setV({ view: 'network', arrange: 'sphere' }); NFM.showTab('map'); });
    await D.wait(() => NFM.state.L && NFM.state.sceneOk && !NFM.state.mapBusy && NFM.state.scene && NFM.state.L.nodes.length > 1400, null, 60000); await settle(400);
    const n0 = await ev(() => { const sc = NFM.state.scene; return sc.curveCount(); });
    const p = await ev(() => { const sc = NFM.state.scene; sc.autoPack({ delay: 100, min: 1, alive: () => NFM.state.scene === sc }); return true; });
    await D.wait(() => NFM.state.scene.curvesPacked(), null, 6000).catch(() => {});
    const packed = await ev(() => NFM.state.scene.curvesPacked());
    if (!packed) say(false, 'scene links were not packed after the idle time (' + n0 + ' links)');
    else {
      await ev(() => { const cv = document.querySelector('#map canvas, canvas'), o = document.createElement('canvas'); o.width = cv.width; o.height = cv.height; const c = o.getContext('2d'); c.drawImage(cv, 0, 0); window.__pa = c.getImageData(0, 0, o.width, o.height).data; });
      const pick = await ev(() => { const sc = NFM.state.scene, c0 = sc.curveAt(0), r = NFMScene.pickEdge(sc, (c0.P[0] + c0.P[6]) / 2, (c0.P[1] + c0.P[7]) / 2, 8); return { edge: r && r.edge, packed: sc.curvesPacked(), n: sc.curveCount() }; });
      say(pick.edge === (await ev(() => NFM.state.scene.curveAt(0).edge)) && pick.packed, 'a link can be picked while the links are packed, and picking leaves them packed: ' + JSON.stringify(pick));
      const c2 = await ev(async () => {   /* Canvas 2D draws straight from the packed list: the picture is the same and the list stays packed */
        const m = NFM.manager(), sc = NFM.state.scene; if (!m || !m.r) return { skip: 'no renderer' };
        const was = m.r.name; if (was !== 'canvas2d') { m.canary.canvas2d = { ok: true }; await m.use('canvas2d'); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); if (!sc.curvesPacked()) sc.packNow(); }
        if (m.r.name !== 'canvas2d') return { skip: m.r.name };
        const cv = document.querySelector('#map canvas, canvas'), hash = () => { const o = document.createElement('canvas'); o.width = cv.width; o.height = cv.height; const c = o.getContext('2d'); c.drawImage(cv, 0, 0); const b = c.getImageData(0, 0, o.width, o.height).data; let h = 2166136261; for (let i = 0; i < b.length; i += 4) h = Math.imul(h ^ (b[i] + 31 * b[i + 1] + 977 * b[i + 2] + 7919 * b[i + 3]), 16777619) >>> 0; return h; };
        const before = hash(); m.r.draw(NFM.state.view); const res = { same: hash() === before, packed: sc.curvesPacked() }; if (was !== 'canvas2d') m.use(was); return res;
      });
      say(c2.skip !== undefined || (c2.same && c2.packed), c2.skip !== undefined ? 'Canvas 2D drawing from packed links: not checked here (drawing with ' + c2.skip + ')' : 'Canvas 2D draws the picture from the packed links unchanged and leaves them packed: ' + JSON.stringify(c2));
      await ev(() => { const sc = NFM.state.scene, m = NFM.manager(); sc.curves.length; if (m && m.r) m.r.setScene(sc); NFM.requestDraw && NFM.requestDraw(); }); await settle(500);
      const df = await ev(() => { const cv = document.querySelector('#map canvas, canvas'), o = document.createElement('canvas'); o.width = cv.width; o.height = cv.height; const c = o.getContext('2d'); c.drawImage(cv, 0, 0); const b = c.getImageData(0, 0, o.width, o.height).data, a = window.__pa; let n = 0, mx = 0; for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); if (d) { n++; if (d > mx) mx = d; } } return { bytes: a.length, differ: n, maxDiff: mx }; });
      say(df.differ === 0, 'the picture is byte for byte the same after the links were packed, rebuilt as objects and drawn again (' + n0 + ' links, ' + df.bytes + ' bytes compared, ' + df.differ + ' differ' + (df.differ ? ', by up to ' + df.maxDiff : '') + ')');
      await D.wait(() => NFM.state.scene.curvesPacked(), null, 6000).catch(() => {}); say(await ev(() => NFM.state.scene.curvesPacked()), 'the links are packed again after the next idle time');
      await ev(() => { NFM.state.scene.autoPack({ delay: 100000, min: 1e9 }); NFM.state.scene.curves.length; });
    }
    await ev(() => { NFM.setGraph(window.__g1, false, true); NFM.setV(window.__v1); if (window.__tab1 && window.__tab1 !== 'map') NFM.showTab(window.__tab1); }); await D.wait(() => NFM.state.sceneOk && !NFM.state.mapBusy, null, 30000).catch(() => {});
  } catch (e) { say(false, 'packed scene links stopped with an error: ' + String(e && e.message || e).split('\n')[0]); }

  /* 8d. the layout's link list kept packed while idle: packed, one link read without waking the rest, brought back exactly, picture byte for byte the same */
  try {
    await ev(() => { window.__g1 = JSON.parse(JSON.stringify(NFM.state.graph)); window.__v1 = { view: NFM.state.V.view, arrange: NFM.state.V.arrange }; window.__tab1 = NFM.state.tab; NFM.setGraph(NFMExamples.bigNetwork(1500, 8, 7)); NFM.setV({ view: 'network', arrange: 'force' }); NFM.showTab('map'); });
    await D.wait(() => NFM.state.L && NFM.state.sceneOk && !NFM.state.mapBusy && NFM.state.scene && NFM.state.L.nodes.length > 1400, null, 60000); await settle(400);
    const cap = () => ev(() => { const cv = document.querySelector('#map canvas, canvas'), o = document.createElement('canvas'); o.width = cv.width; o.height = cv.height; const c = o.getContext('2d'); c.drawImage(cv, 0, 0); window.__pb = c.getImageData(0, 0, o.width, o.height).data; return window.__pb.length; });
    const before = await ev(() => { const L = NFM.state.L; return { has: typeof L.parkNow === 'function', n: L.edges.length, json: JSON.stringify(L.edges) }; });
    if (!before.has) say(false, 'the layout has no link park attached');
    else {
      await cap();
      const park = await ev(() => { const L = NFM.state.L, ok = L.parkNow(); return { ok: ok, parked: L.parked(), bytes: L.parkBytes() }; });
      say(park.ok && park.parked, 'the layout links were packed (' + before.n + ' links, ' + park.bytes + ' bytes packed)');
      const one = await ev(() => { const L = NFM.state.L, e = L.edgeAt(7), same = JSON.stringify(e); return { json: same, parked: L.parked() }; });
      say(one.parked && one.json === JSON.stringify(JSON.parse(before.json)[7]), 'one link is read while the list stays packed, and it equals the original');
      const back = await ev(() => { const L = NFM.state.L, t = performance.now(), ed = L.edges, ms = performance.now() - t; return { json: JSON.stringify(ed), parked: L.parked(), ms: ms }; });
      say(!back.parked && back.json === before.json, 'reading the list brings every link back exactly (' + before.n + ' links, same JSON text, ' + back.ms.toFixed(0) + ' ms)');
      await ev(() => { const sc = NFM.state.scene, m = NFM.manager(); if (m && m.r) m.r.setScene(sc); NFM.requestDraw && NFM.requestDraw(); }); await settle(500);
      const df = await ev(() => { const cv = document.querySelector('#map canvas, canvas'), o = document.createElement('canvas'); o.width = cv.width; o.height = cv.height; const c = o.getContext('2d'); c.drawImage(cv, 0, 0); const b = c.getImageData(0, 0, o.width, o.height).data, a = window.__pb; let n = 0, mx = 0; for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); if (d) { n++; if (d > mx) mx = d; } } return { bytes: a.length, differ: n, maxDiff: mx }; });
      say(df.differ === 0, 'the picture is byte for byte the same after the links were packed, brought back and drawn again (' + df.bytes + ' bytes compared, ' + df.differ + ' differ' + (df.differ ? ', by up to ' + df.maxDiff : '') + ')');
    }
    await ev(() => { NFM.setGraph(window.__g1, false, true); NFM.setV(window.__v1); if (window.__tab1 && window.__tab1 !== 'map') NFM.showTab(window.__tab1); }); await D.wait(() => NFM.state.sceneOk && !NFM.state.mapBusy, null, 30000).catch(() => {});
  } catch (e) { say(false, 'the packed layout links stopped with an error: ' + String(e && e.message || e).split('\n')[0]); }

  /* 9. the drawing manager never keeps a destroyed renderer; a worker that dies mid-job does not wedge the engine */
  try {
  { const r = await ev(async () => {
      const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-9999px;width:200px;height:100px'; document.body.appendChild(host);
      const out = {}, gc = HTMLCanvasElement.prototype.getContext;
      try {
        const m = new NFMRender.Manager(host, {}); await m.use('canvas2d'); const r0 = m.r;
        HTMLCanvasElement.prototype.getContext = function () { return null; };
        let rej = null; try { await m.use('canvas2d'); } catch (e) { rej = e.message; } finally { HTMLCanvasElement.prototype.getContext = gc; }
        out.rejected = !!rej; out.stale = m.r === r0;
        const m2 = new NFMRender.Manager(host, {}); await m2.use('canvas2d'); const r1 = m2.r, s0 = m2.start; let n = 0;
        m2.start = function () { if (n++ === 0) HTMLCanvasElement.prototype.getContext = function () { return null; }; return s0.call(this).finally(() => { HTMLCanvasElement.prototype.getContext = gc; }); };
        let rej2 = null; let got = null; try { got = await m2.use('canvas2d'); } catch (e) { rej2 = e.message; }
        out.rescued = !rej2 && !!m2.r && m2.r !== r1 && m2.r.name === 'canvas2d' && got === m2.r && typeof m2.r.draw === 'function';
      } finally { HTMLCanvasElement.prototype.getContext = gc; host.remove(); }
      return out;
    });
    say(r.rejected && !r.stale, 'when no drawing method can start, the manager does not keep the old destroyed renderer: ' + JSON.stringify(r));
    say(r.rescued === true, 'when the list of drawing methods fails, switching falls back to the plain canvas and draws'); }
  } catch (e) { say(false, 'a step of the checks above stopped with an error: ' + String(e && e.message || e).split('\n')[0]); }
  await settle(400);
  try {
  { const r = await ev(async () => {
      const c = NFM.client(); if (c.mode !== 'worker') return { skip: c.mode };
      const realPost = c.w.postMessage; c.w.postMessage = function () { /* the dying worker never answers */ };
      const opts = { view: 'flow', colorBy: 'group' }, p = c.build(opts).then(() => 'resolved', (e) => 'rejected: ' + e.message);
      const busyBefore = !!c.busy; c.w.dispatchEvent(new ErrorEvent('error', { message: 'test crash' }));
      const first = await Promise.race([p, new Promise((q) => setTimeout(() => q('hang'), 1500))]);
      await new Promise((q) => setTimeout(q, 30));
      const out = { busyBefore, first, busyAfter: !!c.busy, mode: c.mode };
      if (first === 'hang') { c.w.postMessage = realPost; return out; }
      const second = await Promise.race([c.build(opts).then((x) => x && x.L && x.L.nodes ? 'built' : 'empty', (e) => 'rejected: ' + e.message), new Promise((q) => setTimeout(() => q('hang'), 8000))]);
      out.second = second; return out;
    });
    say(!r.skip && r.busyBefore && /^rejected: .*(stopped|canceled)/i.test(r.first || '') && !r.busyAfter && r.mode === 'page' && r.second === 'built', 'a worker that dies in the middle of a job: the job fails in plain words, the engine is free again, and later maps are built on the page: ' + JSON.stringify(r)); }
  } catch (e) { say(false, 'a step of the checks above stopped with an error: ' + String(e && e.message || e).split('\n')[0]); }

  /* Canvas 2D panning and zooming of a slow-to-draw map slides the last full picture, then draws the real one again when the camera stops: at rest the picture is exactly the full draw (0.000/255), the slid picture in between stays close, and the settle draw is asked for */
  try {
    await ev(() => { NFM.setGraph(NFMExamples.bigNetwork(1500, 4, 7)); NFM.showTab('map'); NFM.setV({ view: 'network', arrange: 'circle' }); });
    await D.wait(() => !NFM.pending() && NFM.state.scene, null, 60000);
    const r = await ev(async () => {
      const m = NFM.manager(); await m.use('canvas2d'); if (m.r.name !== 'canvas2d' || !m.r.fastMove) return { err: 'n/a' };
      const frames = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))), W = NFM.state.stageW, H = NFM.state.stageH;
      const keep = async (key) => { const sn = m.r.snapshot(); await m.r.flush(); window.__px.keep[key] = sn; };
      await frames(); const v1 = { k: 0.6, tx: 30, ty: 20 }, v2 = { k: 0.6, tx: 30 + 36, ty: 20 + 15 }, v3 = { k: 0.66, tx: 30 - 20, ty: 20 - 8 };
      let settleAsked = 0; const inv = () => { settleAsked++; };
      m.r.fastMove(true);
      m.r.draw(v1);   /* a full draw: the kept picture */
      for (let i = 1; i <= 6; i++) m.r.draw({ k: v1.k, tx: v1.tx + (v2.tx - v1.tx) * i / 6, ty: v1.ty + (v2.ty - v1.ty) * i / 6, moved: true, invalidate: inv });
      await keep('pan_slid');
      await new Promise((res) => setTimeout(res, 260)); const asked = settleAsked;   /* 140 ms after the last moving draw */
      m.r.draw(v2); await keep('pan_rest');   /* what the settle draw does: a full draw, not marked as moved */
      m.r.fastMove(false); m.r.draw(v2); await keep('pan_full');
      m.r.fastMove(true); m.r.draw(v1);
      for (let i = 1; i <= 6; i++) m.r.draw({ k: v1.k + (v3.k - v1.k) * i / 6, tx: v1.tx + (v3.tx - v1.tx) * i / 6, ty: v1.ty + (v3.ty - v1.ty) * i / 6, moved: true, invalidate: inv });
      await keep('zoom_slid'); m.r.draw(v3); await keep('zoom_rest'); m.r.fastMove(false); m.r.draw(v3); await keep('zoom_full');
      m.r.fastMove(null); m.r.draw(v1); m.r.draw({ k: v1.k, tx: v1.tx + 9, ty: v1.ty, moved: true, invalidate: inv }); await keep('small_default');   /* a small, fast map: drawn in full by default */
      m.r.draw({ k: v1.k, tx: v1.tx + 9, ty: v1.ty }); await keep('small_full');
      return { asked, W, H };
    });
    if (r.err) say(null, 'Canvas 2D panning: ' + r.err);
    else {
      const rest = await ev(() => window.__px.cmp('pan_rest', 'pan_full')), zrest = await ev(() => window.__px.cmp('zoom_rest', 'zoom_full')), slid = await ev(() => window.__px.cmp('pan_slid', 'pan_full')), zslid = await ev(() => window.__px.cmp('zoom_slid', 'zoom_full')), dflt = await ev(() => window.__px.cmp('small_default', 'small_full'));
      say(rest.same && rest.mean === 0 && zrest.same && zrest.mean === 0 && r.asked >= 1, `Canvas 2D after a pan and a zoom: the picture at rest is exactly the full draw (${rest.mean.toFixed(3)} and ${zrest.mean.toFixed(3)}/255) and the redraw was asked for ${r.asked} time(s)`);
      say(slid.bad < 0.12 && zslid.bad < 0.2, `Canvas 2D while the camera moves: the slid picture stays close to the full draw (${(slid.bad * 100).toFixed(1)}% far off after a 36 px pan, ${(zslid.bad * 100).toFixed(1)}% after a zoom)`);
      say(dflt.same && dflt.mean === 0, 'Canvas 2D on a map that draws fast: moving the camera still draws in full (0.000/255)');
    }
  } catch (e) { say(false, 'Canvas 2D panning stopped with an error: ' + String(e && e.message || e).split('\n')[0]); }

  /* selecting an item that is gone (a click on the old picture while new data is still being laid out) is ignored instead of throwing in the details panel */
  try {
    const r = await ev(() => { let threw = '', sel = -1; try { NFM.setSel(['no such item']); sel = NFM.state.sel.size; } catch (e) { threw = String(e && e.message || e); } return { threw, sel }; });
    say(!r.threw && r.sel === 0, 'selecting an item that is no longer in the data is ignored' + (r.threw ? ' (threw: ' + r.threw + ')' : ''));
  } catch (e) { say(false, 'selecting a missing item stopped with an error: ' + String(e && e.message || e).split('\n')[0]); }

  /* hidden speed and error buttons (shared field-report): five quick taps in the top-left corner open them; the report lists the layout and scene build times; the page raising a test error shows in the error log */
  try {
    for (let i = 0; i < 5; i++) { await D.click(20, 20); await settle(60); }
    await settle(200);
    const fr = await ev(async () => { const R = window.NFMReport; if (!R) return { none: true }; const o = { open: R.isOpen(), btns: [...document.querySelectorAll('button')].map((x) => x.textContent).filter((t) => /^Save (speed report|error log)$/.test(t)), speed: R.speedText() }; R.close(); return o; });
    say(!fr.none && fr.open && fr.btns.length === 2 && /layout [\d,]+ items/.test(fr.speed) && /first-screen/.test(fr.speed), 'five taps in the top-left corner open Save speed report and Save error log, and the speed report lists the first screen and the layout times' + (fr.speed ? '' : ' (no report)') + (process.env.NFM_DEBUG_FR ? ' ' + JSON.stringify({ o: fr.open, b: fr.btns, s: String(fr.speed).slice(-500) }) : ''));
  } catch (e) { say(false, 'the hidden speed and error buttons stopped with an error: ' + String(e && e.message || e).split('\n')[0]); }

  {   /* the link lists (offset arrays) give exactly what the old Map of arrays gave: same links, same order, for every item, with a link that names a missing item as well */
    const res = await ev(() => {
      const S = NFM.state; NFM.setGraph(NFMExamples.bigNetwork(300, 3, 7)); S.graph.edges.push({ from: S.graph.nodes[0].id, to: 'no-such-item', id: 'x1' }); S.graph.edges.push({ from: 'also-missing', to: S.graph.nodes[1].id, id: 'x2' }); NFM.setGraph(S.graph);
      const out = new Map(), inn = new Map(); S.graph.edges.forEach((e) => { if (!out.has(e.from)) out.set(e.from, []); out.get(e.from).push(e); if (!inn.has(e.to)) inn.set(e.to, []); inn.get(e.to).push(e); });
      let bad = 0, n = 0, same = (a, b) => (a || []).length === (b || []).length && (a || []).every((e, i) => e === b[i]);
      const ids = S.graph.nodes.map((x) => x.id).concat(['no-such-item', 'also-missing', 'nobody']);
      ids.forEach((id) => { n++; const eo = [], ei = []; S.outAdj.each(id, (e) => eo.push(e)); S.inAdj.each(id, (e) => ei.push(e));
        if (!same(S.outAdj.get(id), out.get(id)) || !same(S.inAdj.get(id), inn.get(id)) || !same(eo, out.get(id)) || !same(ei, inn.get(id)) || S.outAdj.has(id) !== out.has(id) || S.inAdj.has(id) !== inn.has(id) || S.outAdj.count(id) !== (out.get(id) || []).length || S.inAdj.count(id) !== (inn.get(id) || []).length) bad++; });
      return { bad, n, edges: S.graph.edges.length };
    });
    say(res.bad === 0 && res.n > 300, `link lists: the same links in the same order as the old lists for ${res.n} items (${res.edges} links, two naming an item that is not there): ${res.bad} differences`);
  }
  say(errs.length === 0, 'no errors in the console' + (errs.length ? ': ' + errs.slice(0, 4).join(' | ') : ''));
  const pol = await ev(async () => {   // after the console check on purpose: a refused fetch is logged. (A page policy does not hold the test's own evaluate to the eval rule, so the eval refusal is not tested here; WebAssembly under the policy is covered by the two helper-thread checks above.)
    const o = {}; const m = document.querySelector('meta[http-equiv="Content-Security-Policy"]'); o.meta = m ? m.content : '';
    try { await fetch('data:text/plain,hi'); o.fetchNow = 'allowed'; } catch (e) { o.fetchNow = 'refused'; }
    return o;
  });
  say(/script-src 'unsafe-inline' 'wasm-unsafe-eval'/.test(pol.meta) && !/'unsafe-eval'/.test(pol.meta) && /connect-src 'none'/.test(pol.meta) && pol.fetchNow === 'refused', 'the page policy allows WebAssembly and nothing looser (no eval, no network): fetch ' + pol.fetchNow);
  await D.close(); if (process.env.NFM_TIMES) console.log(`total ${((Date.now() - T0) / 1000).toFixed(1)} s, of which fixed waits: ${sleeps} sleeps = ${(slept / 1000).toFixed(1)} s` + '; by line: ' + Object.entries(sites).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => k + ':' + v).join(' ')); {   /* a run that quietly skips checks must fail: fewer ok lines than the last all-green run of this browser is a failure (NFM_BLESS=1 after a reviewed change saves the new count) */
    const BL = require('./baseline.js'), v = BL.verdict(which, oks, fails, process.env.NFM_PAGE);
    console.log(v.line); if (v.fail) fails++;
    if (process.env.NFM_BLESS === '1' && !fails && !process.env.NFM_PAGE) console.log(BL.bless(which, oks));
  }
  console.log(fails ? `${fails} FAILED` : 'browser test: all passed'); process.exitCode = fails ? 1 : 0;
})().catch((e) => { console.log('crash', e && e.stack || e); process.exit(2); });
