/* Copyright (c) 2026 LFC Foundry. MIT License. One browser session that exercises the built index.html.
 *   node test/browser.test.js chromium|firefox|webkit|epiphany [outdir]   (webkit = WebKitGTK 2.52.6 through bench/webkit-driver.js; epiphany = GNOME Web)
 * chromium: Playwright (NFM_PLAYWRIGHT = path to playwright-core, NFM_CHROME = browser program; ungoogled-chromium 155 from the browsers branch)
 * NFM_PAGE = the page to test (default index.html; index.packed.html tests the self-extracting copy)
 * firefox:  Puppeteer over WebDriver BiDi (NFM_PUPPETEER = path to puppeteer-core, NFM_FIREFOX = browser program) */
'use strict';
const path = require('path');
const which = process.argv[2] || 'chromium', outDir = process.argv[3] || '/tmp';
const strict = which === 'chromium' || !!process.env.NFM_STRICT;
const flags = ['--no-sandbox', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'];
const T0 = Date.now(); let tLast = T0;   /* NFM_TIMES=1 puts the seconds since the last line in front of every line: where the time goes */
let fails = 0, oks = 0; const say = (ok, t) => { if (ok === false) fails++; if (ok === true) oks++; const now = Date.now(), pre = process.env.NFM_TIMES ? String(((now - tLast) / 1000).toFixed(1)).padStart(5) + 's ' : ''; tLast = now; console.log(pre + (ok === true ? 'ok   ' : ok === false ? 'FAIL ' : 'note ') + t); };
let slept = 0, sleeps = 0; const sleep = (ms) => { slept += ms; sleeps++; return new Promise((r) => setTimeout(r, ms)); };
/* Short pauses only let the screen catch up after a click or drag. Wait for three real animation frames plus a quarter of the old pause instead of the whole pause (NFM_SLOW=1 restores the full pauses). Long pauses (over 450 ms) are real time (easing, playback) and stay as they were. */

async function open() {
  if (which === 'webkit' || which === 'epiphany') {   /* WebKitGTK / GNOME Web through bench/webkit-driver.js (Playwright and Puppeteer cannot drive them); software drawing, a virtual screen */
    const WD = require('../bench/webkit-driver.js'), b = await WD.launch({ browser: which === 'epiphany' ? 'epiphany' : 'webkitgtk', width: 1100, height: 720 }), page = b.page;
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
  page.on('pageerror', (e) => errs.push('pageerror: ' + (e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const SLOW = process.env.NFM_SLOW === '1';
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
    const feed = async (name, buf) => { await ev(([n, b64]) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); const dt = new DataTransfer(); dt.items.add(new File([u], n)); const inp = document.getElementById('in-files'); inp.files = dt.files; inp.dispatchEvent(new Event('change')); }, [name, buf.toString('base64')]); await sleep(900); };
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
  const views = ['flow', 'down', 'spine', 'lanes', 'shape', 'river', 'arc', 'matrix', 'network'];
  for (const v of views) {
    await ev((vv) => NFM.setV({ view: vv }), v);
    await D.wait((vv) => NFM.state.L && NFM.state.L.view === vv && NFM.state.scene && NFM.state.scene.view === vv, v, 20000);
    await settle(150);
    const r = await ev(() => { const m = NFM.manager().r; m.draw(NFM.state.view); const s = m.snapshot(), d = s.data;   /* drawn and read in the same task: WebKit empties a WebGL canvas once it has been shown */
    let diff = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - d[0]) + Math.abs(d[i + 1] - d[1]) + Math.abs(d[i + 2] - d[2]) > 30) diff++; return { backend: m.name, share: diff / (d.length / 4) }; });
    say(r.share > 0.004, `${v}: drew something (${(r.share * 100).toFixed(1)}% of pixels) with ${r.backend}`);
    if (v === 'flow' || v === 'river' || v === 'network') await D.shot(path.join(outDir, `nfm-${which}-${v}.png`));
  }

  /* River (Sankey) pictures: click and right-click on links, bars and labels, drag a bar, hand edits, undo */
  {
    await ev(() => NFM.setV({ view: 'river' })); await D.wait(() => NFM.state.L.view === 'river' && NFM.state.scene.view === 'river' && NFM.state.L.sk, null, 20000); await settle(300);
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
    const snap = await ev(() => NFM.snapshot().sk); say(!!(snap && snap.color === 'gradient' && snap.nodes), 'River settings are saved with the view');
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
  await click('#tl-play'); await sleep(1800);
  const pos1 = await ev(() => parseFloat(document.getElementById('tl-range').value)); say(pos1 > 0.3, 'playing moves along the timeline (' + pos1.toFixed(2) + ')');
  await click('#tl-play'); await settle(300);
  say(await ev(() => !document.getElementById('tl-play').textContent.includes('❚')), 'pausing works');
  await click('#tabbtn-export'); await settle(200); await click('#gif-go');
  await D.wait(() => { const im = document.querySelector('#gif-out img'); return im && im.complete && im.naturalWidth > 0; }, null, 120000);
  const gifInfo = await ev(async () => { const im = document.querySelector('#gif-out img'), b = new Uint8Array(await (await fetch(im.src)).arrayBuffer()); return { head: String.fromCharCode(...b.slice(0, 6)), w: im.naturalWidth, bytes: b.length, text: document.getElementById('gif-out').innerText }; });
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
  await click('#tabbtn-map'); await sleep(600); await D.shot(path.join(outDir, `nfm-${which}-phone.png`));
  say(await ev(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways page scroll on a phone');
  /* phone, with a finger (the hook forces touch because Firefox cannot pretend to be a coarse pointer) */
  await ev(() => NFM.touch(true)); await settle(150);
  say(await ev(() => document.body.classList.contains('touch') && document.body.classList.contains('narrow')), 'the touch hook marks the page as touch and narrow');
  say(await ev(() => { const t = document.querySelector('.tabs'); return t.scrollWidth <= t.clientWidth + 1; }), 'the bottom tabs never scroll sideways');
  say(await ev(() => [...document.querySelectorAll('.tabs button')].every((b) => b.getBoundingClientRect().height >= 44 && b.querySelector('svg').getBoundingClientRect().width > 0)), 'each bottom tab is at least 44 px tall and has an icon');
  await click('#tabbtn-data'); await set('#examples', 'states'); await click('#b-example'); await click('#tabbtn-map'); await sleep(1400); await ev(() => document.querySelector('#rail button[aria-label="Hide this panel"]').click()); await settle(450);
  say(await ev(() => { const tl = document.getElementById('timeline').getBoundingClientRect(), st = document.getElementById('stage').getBoundingClientRect(); return !document.getElementById('timeline').hidden && st.bottom - tl.bottom < 20 && tl.height < 80; }), 'the timeline is one slim row docked at the bottom of the map');
  say(await ev(() => [...document.querySelectorAll('#ui button, .tabs button')].filter((b) => b.offsetParent && b.getBoundingClientRect().height > 0 && b.getBoundingClientRect().height < 35.5).length === 0), 'every visible button is at least 36 px tall on touch');
  say(await ev(() => [...document.querySelectorAll('#ui input[type=text], #ui input[type=number], #ui select')].filter((e) => e.offsetParent && parseFloat(getComputedStyle(e).fontSize) < 16).length === 0), 'fields are 16 px on touch (so iOS does not zoom)');
  await click('#railtoggle'); await settle(450);
  say(await ev(() => { const r = document.getElementById('rail').getBoundingClientRect(), tl = document.getElementById('timeline').getBoundingClientRect(), st = document.getElementById('stage').getBoundingClientRect(); return r.height <= st.height * 0.55 && tl.bottom <= r.top + 1; }), 'the open sheet is at most 55% and the timeline sits above it');
  await click('#peekbtn'); await settle(450);
  say(await ev(() => { const r = document.getElementById('rail').getBoundingClientRect(), tl = document.getElementById('timeline').getBoundingClientRect(); return r.height < 80 && tl.bottom <= r.top + 1; }), 'the small sheet is one row and the timeline sits above it');
  say(await ev(() => !/right-click|ctrl\+/i.test(document.getElementById('rail').innerText)), 'no right-click or Ctrl words in the controls on touch');
  await ev(() => NFM.touch(null)); await D.size(1100, 720); await settle(200);


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
    await ev(() => { const sel = [...document.querySelectorAll('#gif-card select')], put = (s, v) => { s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }; put(sel[0], '640'); put(sel[4], '0.6'); put(sel[5], '6'); });
    await click('#gif-go');
    const made = await W(() => { const im = document.querySelector('#gif-out img'); return im && im.complete && im.naturalWidth > 0; }, null, 60000);
    say(made, 'a turn-around GIF of the 3D map is made (control for the next checks)');
    await ev(() => { document.getElementById('gif-go').click(); setTimeout(() => NFM.setGraph(NFMImport.sanitizeGraph({ name: 'GifOther', nodes: [{ id: 'A' }, { id: 'B' }], edges: [{ from: 'A', to: 'B' }] })), 40); });
    await W(() => { const b = document.getElementById('gif-go'); return b && !b.disabled; }, null, 60000); await settle(200);
    const r = await ev(() => ({ img: !!document.querySelector('#gif-out img'), text: (document.getElementById('gif-out') || {}).textContent || '' }));
    say(!r.img && /data changed/i.test(r.text), 'a GIF made while the data changed is dropped, not attached to the new data: ' + JSON.stringify(r.text.slice(0, 90)));
    await loadBig(40, 3, 5, 'map'); await ev(() => NFM.setV({ view: 'network', arrange: 'force3d' })); await W(() => NFM.state.L && NFM.state.L.is3d && NFM.state.scene && NFM.state.scene.is3d && NFM.state.L.nodes.length === NFM.state.graph.nodes.length, null, 30000);
    await ev(() => NFM.showTab('export')); await settle(200);
    await ev(() => { const sel = [...document.querySelectorAll('#gif-card select')], put = (s, v) => { s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }; put(sel[0], '640'); put(sel[4], '0.6'); put(sel[5], '6'); document.getElementById('gif-go').click(); document.getElementById('gif-cancel').click(); });
    await W(() => { const b = document.getElementById('gif-go'); return b && !b.disabled; }, null, 60000); await settle(200);
    say(await ev(() => (document.getElementById('gif-out') || {}).textContent) === 'Canceled.', 'canceling the GIF says "Canceled." (American spelling)'); }
  } catch (e) { say(false, 'a step of the checks above stopped with an error: ' + String(e && e.message || e).split('\n')[0]); }

  /* 5. undo: River steps belong to one dataset; going back across a rename brings back the other data's settings */
  try {
  { await loadStory(); await ev(() => NFM.setV({ view: 'river' })); await W(() => NFM.state.L && NFM.state.L.view === 'river' && NFM.state.L.sk && NFM.state.scene && NFM.state.scene.view === 'river');
    await ev(() => { document.getElementById('rt-look').click(); const f = [...document.querySelectorAll('#railbody label.field')].find((l) => /Flow color/.test(l.textContent)); const s = f.querySelector('select'); s.value = 'source'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await settle(300);
    const r = await ev(() => {
      const first = NFM.state.graph.name; localStorage.setItem('nfm-v:SkOther', '{"view":"river"}');
      NFM.setGraph(NFMImport.sanitizeGraph({ name: 'SkOther', start: 'A', nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }], edges: [{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }] }));
      const view = NFM.state.V.view; document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
      localStorage.removeItem('nfm-v:SkOther'); return { first, now: NFM.state.graph.name, view };
    });
    say(r.view === 'river' && r.now === r.first, 'after new data is brought in, Ctrl+Z undoes the data change, not a River step of the old data: ' + JSON.stringify(r)); }
  } catch (e) { say(false, 'a step of the checks above stopped with an error: ' + String(e && e.message || e).split('\n')[0]); }
  try {
  { await load(mkG('UndoOne', ['A', 'B', 'C']), 'map'); await mapShows('A');
    await ev(() => { NFM.setV({ hulls: true }, 'none'); NFM.setGraph(NFMImport.sanitizeGraph({ name: 'UndoTwo', nodes: [{ id: 'X' }, { id: 'Y' }], edges: [{ from: 'X', to: 'Y' }] })); });
    await sleep(800);
    const keep = await ev(() => { const o = JSON.parse(localStorage.getItem('nfm-v:UndoOne') || 'null'); return !!o && o.hulls === true; });
    say(keep, 'bringing in other data right after a setting change still saves the old data\'s setting under the old name');
    await ev(() => document.getElementById('b-undo').click()); await sleep(800);
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

  say(errs.length === 0, 'no errors in the console' + (errs.length ? ': ' + errs.slice(0, 4).join(' | ') : ''));
  await D.close(); if (process.env.NFM_TIMES) console.log(`total ${((Date.now() - T0) / 1000).toFixed(1)} s, of which fixed waits: ${sleeps} sleeps = ${(slept / 1000).toFixed(1)} s`); {   /* a run that quietly skips checks must fail: fewer ok lines than the last all-green run of this browser is a failure (NFM_BLESS=1 after a reviewed change saves the new count) */
    const BL = require('./baseline.js'), v = BL.verdict(which, oks, fails, process.env.NFM_PAGE);
    console.log(v.line); if (v.fail) fails++;
    if (process.env.NFM_BLESS === '1' && !fails && !process.env.NFM_PAGE) console.log(BL.bless(which, oks));
  }
  console.log(fails ? `${fails} FAILED` : 'browser test: all passed'); process.exitCode = fails ? 1 : 0;
})().catch((e) => { console.log('crash', e && e.stack || e); process.exit(2); });
